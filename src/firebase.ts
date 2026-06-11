import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Define the shape of errors as expected by system specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

let app;
export let db: Firestore | null = null;
export let auth: any = null;
export let isFirebaseEnabled = false;

// Check if a valid API key is available
if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
    auth = getAuth(app);
    isFirebaseEnabled = true;
    console.log("Firebase initialized successfully with config:", firebaseConfig.projectId);
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.log("Using Offline/Local state storage. (No API Key found in firebase-applet-config.json)");
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Function to log in anonymously if Firebase is enabled.
// If anonymous sign-in is disabled in the Firebase console, we fallback gracefully
// to a client-side persistent unique guest ID to avoid breaking the user experience.
export async function loginAnonymouslyIfNeeded(): Promise<string | null> {
  if (!isFirebaseEnabled || !auth) return getPersistentGuestId();
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    console.warn("Anonymous sign-in is disabled in the Firebase console. Falling back to persistent local guest ID. Error detail:", err);
    return getPersistentGuestId();
  }
}

function getPersistentGuestId(): string {
  const key = 'utrecht_ultimates_cricket_guest_id';
  let guestId = localStorage.getItem(key);
  if (!guestId) {
    guestId = 'guest-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(key, guestId);
  }
  return guestId;
}
