import { db, auth, isFirebaseEnabled, handleFirestoreError, OperationType, loginAnonymouslyIfNeeded } from './firebase';
import { doc, setDoc, getDoc, getDocs, collection, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { CricketMatch, DailyAttendance } from './types';

const LOCAL_STORAGE_KEY = 'utrecht_ultimates_cricket_matches';

// Get matches saved locally in LocalStorage
function getLocalMatches(): CricketMatch[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to parse local matches:", err);
    return [];
  }
}

// Save local matches to LocalStorage
function saveLocalMatches(matches: CricketMatch[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(matches));
  } catch (err) {
    console.warn("Failed to save local matches:", err);
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
      console.warn("Failed to fetch matches from Firestore, falling back to LocalStorage:", error);
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
      console.warn("Firestore onSnapshot error:", error);
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

// 5. Fetch attendance for a specific date
export async function fetchAttendance(dateId: string): Promise<DailyAttendance | null> {
  const localKey = `utrecht_ultimates_cricket_attendance_${dateId}`;
  
  // Try remote first if Firebase is active
  if (isFirebaseEnabled && db) {
    try {
      await loginAnonymouslyIfNeeded();
      const docSnap = await getDoc(doc(db, 'attendance', dateId));
      if (docSnap.exists()) {
        const remoteData = docSnap.data() as DailyAttendance;
        // Cache to local storage
        localStorage.setItem(localKey, JSON.stringify(remoteData));
        return remoteData;
      }
    } catch (error) {
      console.warn("Failed to fetch attendance from Firestore, checking local cache", error);
    }
  }

  // Backup: read from local Storage
  try {
    const raw = localStorage.getItem(localKey);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to read local attendance", err);
    return null;
  }
}

// 6. Save attendance for a specific date
export async function saveAttendance(attendance: DailyAttendance): Promise<void> {
  const localKey = `utrecht_ultimates_cricket_attendance_${attendance.id}`;
  
  // Write locally
  try {
    localStorage.setItem(localKey, JSON.stringify(attendance));
  } catch (err) {
    console.warn("Failed to write local attendance", err);
  }

  // Write to Firestore if Firebase is active
  if (isFirebaseEnabled && db) {
    try {
      await loginAnonymouslyIfNeeded();
      const sanitized = sanitizeForFirestore(attendance);
      await setDoc(doc(db, 'attendance', attendance.id), sanitized);
      console.log("Attendance synced to Firestore successfully:", attendance.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `attendance/${attendance.id}`);
    }
  }
}

// 7. Register viewer session heartbeat
export async function registerViewerHeartbeat(sessionId: string): Promise<void> {
  if (isFirebaseEnabled && db) {
    try {
      await setDoc(doc(db, 'viewers', sessionId), {
        id: sessionId,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.warn("Failed to register viewer heartbeat:", error);
    }
  }
}

// 8. Listen to active viewers count
export function listenActiveViewers(
  onUpdate: (count: number) => void
): () => void {
  if (!isFirebaseEnabled || !db) {
    // offline visual dummy simulation
    onUpdate(1);
    return () => {};
  }

  try {
    const unsub = onSnapshot(collection(db, 'viewers'), (snapshot) => {
      const activeThreshold = Date.now() - 30000; // 30 seconds threshold
      let activeCount = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.updatedAt && typeof data.updatedAt === 'number' && data.updatedAt > activeThreshold) {
          activeCount++;
        }
      });
      
      onUpdate(activeCount > 0 ? activeCount : 1);
    }, (error) => {
      console.warn("Error listening to active viewers:", error);
      onUpdate(1);
    });

    return unsub;
  } catch (err) {
    console.warn("Could not attach viewers listener:", err);
    onUpdate(1);
    return () => {};
  }
}

// 9. Subscribe to all matches in real-time
export function listenAllMatches(
  onUpdate: (matches: CricketMatch[]) => void
): () => void {
  const localMatches = getLocalMatches();

  if (!isFirebaseEnabled || !db) {
    // offline visual dummy simulation
    onUpdate(localMatches.sort((a, b) => b.updatedAt - a.updatedAt));
    const interval = setInterval(() => {
      const currentLocals = getLocalMatches();
      onUpdate(currentLocals.sort((a, b) => b.updatedAt - a.updatedAt));
    }, 2000);
    return () => clearInterval(interval);
  }

  try {
    const unsub = onSnapshot(collection(db, 'matches'), (snapshot) => {
      const fbMatches: CricketMatch[] = [];
      snapshot.forEach((doc) => {
        fbMatches.push(doc.data() as CricketMatch);
      });

      // Merge and sort by timestamp
      const locals = getLocalMatches();
      const all = [...fbMatches];
      for (const lm of locals) {
        if (!all.some(fm => fm.id === lm.id)) {
          all.push(lm);
        }
      }
      onUpdate(all.sort((a, b) => b.updatedAt - a.updatedAt));
    }, (error) => {
      console.warn("Error listening to all matches from Firestore, falling back to LocalStorage:", error);
      const locals = getLocalMatches();
      onUpdate(locals.sort((a, b) => b.updatedAt - a.updatedAt));
    });

    return unsub;
  } catch (err) {
    console.warn("Could not attach all matches listener:", err);
    const locals = getLocalMatches();
    onUpdate(locals.sort((a, b) => b.updatedAt - a.updatedAt));
    return () => {};
  }
}

// 10. Subscribe to daily attendance in real-time
export function listenAttendance(
  dateId: string,
  onUpdate: (attendance: DailyAttendance | null) => void
): () => void {
  const localKey = `utrecht_ultimates_cricket_attendance_${dateId}`;

  const getLocal = () => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  if (!isFirebaseEnabled || !db) {
    onUpdate(getLocal());
    const interval = setInterval(() => {
      onUpdate(getLocal());
    }, 2000);
    return () => clearInterval(interval);
  }

  try {
    const unsub = onSnapshot(doc(db, 'attendance', dateId), (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data() as DailyAttendance;
        // cache locally
        localStorage.setItem(localKey, JSON.stringify(remoteData));
        onUpdate(remoteData);
      } else {
        onUpdate(getLocal());
      }
    }, (error) => {
      console.warn("Error listening to attendance from Firestore:", error);
      onUpdate(getLocal());
    });

    return unsub;
  } catch (err) {
    console.warn("Could not attach attendance listener:", err);
    onUpdate(getLocal());
    return () => {};
  }
}


