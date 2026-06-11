import { db, auth, isFirebaseEnabled, handleFirestoreError, OperationType, loginAnonymouslyIfNeeded } from './firebase';
import { doc, setDoc, getDoc, getDocs, collection, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { CricketMatch } from './types';

const LOCAL_STORAGE_KEY = 'utrecht_ultimates_cricket_matches';

// Get matches saved locally in LocalStorage
function getLocalMatches(): CricketMatch[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to parse local matches:", err);
    return [];
  }
}

// Save local matches to LocalStorage
function saveLocalMatches(matches: CricketMatch[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(matches));
  } catch (err) {
    console.error("Failed to save local matches:", err);
  }
}

// Recursive function to strip any 'undefined' property before writing to Firestore
function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  const result: any = {};
  for (const key of Object.keys(data)) {
    const value = (data as any)[key];
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result;
}

// 1. Save or sync match (creates/updates)
export async function saveMatch(match: CricketMatch): Promise<void> {
  // Sync creator ID if active to ensure local and remote are in sync
  if (isFirebaseEnabled && db) {
    try {
      const uid = await loginAnonymouslyIfNeeded();
      if (!match.creatorId && uid) {
        match.creatorId = uid;
      }
    } catch (e) {
      console.warn("Could not fetch user/guest ID for assignment:", e);
    }
  }

  // Fallback to local guest ID if still empty
  if (!match.creatorId) {
    try {
      const uid = await loginAnonymouslyIfNeeded();
      if (uid) {
        match.creatorId = uid;
      }
    } catch (e) {
      // Offline fallback
    }
  }

  // Always save locally first with the creatorId set
  const locals = getLocalMatches();
  const idx = locals.findIndex(m => m.id === match.id);
  if (idx > -1) {
    locals[idx] = match;
  } else {
    locals.push(match);
  }
  saveLocalMatches(locals);

  // Sync with Firestore if active
  if (isFirebaseEnabled && db) {
    try {
      const matchWithCreator = {
        ...match,
        updatedAt: Date.now()
      };
      
      const sanitized = sanitizeForFirestore(matchWithCreator);
      await setDoc(doc(db, 'matches', match.id), sanitized);
      console.log("Match synced to Firestore successfully:", match.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${match.id}`);
    }
  }
}

// 2. Retrieve all matches (combines firebase list and local backups)
export async function fetchAllMatches(): Promise<CricketMatch[]> {
  const localMatches = getLocalMatches();

  if (isFirebaseEnabled && db) {
    try {
      await loginAnonymouslyIfNeeded();
      const querySnapshot = await getDocs(collection(db, 'matches'));
      const fbMatches: CricketMatch[] = [];
      querySnapshot.forEach((doc) => {
        fbMatches.push(doc.data() as CricketMatch);
      });

      // Merge and sort by timestamp
      const all = [...fbMatches];
      for (const lm of localMatches) {
        if (!all.some(fm => fm.id === lm.id)) {
          all.push(lm);
        }
      }
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error("Failed to fetch matches from Firestore, falling back to LocalStorage:", error);
      return localMatches.sort((a, b) => b.updatedAt - a.updatedAt);
    }
  }

  return localMatches.sort((a, b) => b.updatedAt - a.updatedAt);
}

// 3. Real-time match listener (for Live Scorecard Viewing)
export function listenToMatch(
  matchId: string,
  onUpdate: (match: CricketMatch) => void,
  onError: (err: any) => void
): () => void {
  // If Firebase is disabled or fails to hook up, fall back to polling localStorage as a standby
  if (!isFirebaseEnabled || !db) {
    console.log("Firebase offline, listening to real-time simulation via local store.");
    const updateHandler = () => {
      const locals = getLocalMatches();
      const found = locals.find(m => m.id === matchId);
      if (found) onUpdate(found);
    };

    // Run immediately and start polling every 2 seconds for local changes
    updateHandler();
    const interval = setInterval(updateHandler, 2000);
    return () => clearInterval(interval);
  }

  // Active firestore stream
  try {
    const unsub = onSnapshot(doc(db, 'matches', matchId), (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as CricketMatch);
      } else {
        // Fallback to local
        const locals = getLocalMatches();
        const found = locals.find(m => m.id === matchId);
        if (found) onUpdate(found);
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      // Fallback
      const locals = getLocalMatches();
      const found = locals.find(m => m.id === matchId);
      if (found) onUpdate(found);
      
      handleFirestoreError(error, OperationType.GET, `matches/${matchId}`);
      onError(error);
    });

    return unsub;
  } catch (err) {
    onError(err);
    return () => {};
  }
}

// 4. Delete match from local storage and firestore
export async function deleteMatch(matchId: string): Promise<void> {
  // Always delete locally first
  const locals = getLocalMatches();
  const filtered = locals.filter(m => m.id !== matchId);
  saveLocalMatches(filtered);

  // Sync deletion with Firestore if active
  if (isFirebaseEnabled && db) {
    try {
      await loginAnonymouslyIfNeeded();
      await deleteDoc(doc(db, 'matches', matchId));
      console.log("Match deleted from Firestore successfully:", matchId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `matches/${matchId}`);
    }
  }
}
