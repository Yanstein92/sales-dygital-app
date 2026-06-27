import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc as firebaseSetDoc,
  deleteDoc as firebaseDeleteDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  limit,
  or,
  collectionGroup
} from 'firebase/firestore';

// Warning: For a client side app, the VITE_ prefixed keys must be added to .env
// We keep fallbacks to avoid breaking the user's current testing flow until they configure VITE_ secrets.
const envApiKey = (import.meta as any).env.VITE_FIREBASE_API_KEY;
const isEnvApiKeyValid = envApiKey && envApiKey.startsWith('AIza');

const getEnvParam = (key: string, dummyValue: string, fallback: string) => {
  const v = (import.meta as any).env[key];
  return (v && v !== dummyValue && isEnvApiKeyValid) ? v : fallback;
};

const firebaseConfig = {
  apiKey: isEnvApiKeyValid ? envApiKey : "AIzaSyD4mE-5BO0kRVmonutJoJx6PQsuVl7OqSE",
  authDomain: getEnvParam('VITE_FIREBASE_AUTH_DOMAIN', 'salesdygital321321', "sales-dygital.firebaseapp.com"),
  projectId: getEnvParam('VITE_FIREBASE_PROJECT_ID', 'salesdygital321321', "sales-dygital"),
  storageBucket: getEnvParam('VITE_FIREBASE_STORAGE_BUCKET', 'salesdygital321321', "sales-dygital.firebasestorage.app"),
  messagingSenderId: getEnvParam('VITE_FIREBASE_MESSAGING_SENDER_ID', 'salesdygital321321', "903151549257"),
  appId: getEnvParam('VITE_FIREBASE_APP_ID', 'salesdygital321321', "1:903151549257:web:7615f78e85a39173887898"),
  measurementId: getEnvParam('VITE_FIREBASE_MEASUREMENT_ID', 'salesdygital321321', "G-5XEJ6BGMMP")
};

// Check if embedded Canvas Auth is present
const isCanvasEnvironment = typeof (window as any).__firebase_config !== 'undefined' && (window as any).__firebase_config !== "";
const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'kdb-export-app';

let finalFirebaseConfig = firebaseConfig;
if (isCanvasEnvironment) {
  try {
    const canvasConfig = (window as any).__firebase_config;
    if (canvasConfig) {
      finalFirebaseConfig = typeof canvasConfig === 'string' ? JSON.parse(canvasConfig) : canvasConfig;
    }
  } catch (e) {
    console.error("Error parsing canvas firebase config, using fallback", e);
  }
}

const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Data structure paths: For now we retain the existing logic to not break active data, 
// but we prepare for companies architecture via context.
export const getDbPath = (colName: string, companyId: string) => 
  isCanvasEnvironment ? `artifacts/${appId}/companies/${companyId}/${colName}` : `companies/${companyId}/${colName}`;

// Fallback for user path (retro-compatibility)
export const getUserPath = (colName: string, userId: string) => 
  isCanvasEnvironment ? `artifacts/${appId}/users/${userId}/${colName}` : `users/${userId}/${colName}`;

export const getUserDocPath = (userId: string) => 
  isCanvasEnvironment ? `artifacts/${appId}/users/${userId}` : `users/${userId}`;

async function setDoc(docRef: any, data: any, options?: any) {
  try {
    await firebaseSetDoc(docRef, data, options);
  } catch (error: any) {
    console.warn("Client-side setDoc failed. Falling back to server database proxy...", error);
    const path = docRef?.parent?.path || '';
    const docId = docRef?.id || '';
    if (path && docId) {
      try {
        const res = await fetch('/api/db/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, docId, data, merge: options?.merge !== false })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Erreur de proxy de base de données");
        }
        console.log("Server-side setDoc fallback succeeded!");
        return;
      } catch (proxyError: any) {
        console.error("Server-side fallback also failed:", proxyError);
        throw error;
      }
    }
    throw error;
  }
}

async function deleteDoc(docRef: any) {
  try {
    await firebaseDeleteDoc(docRef);
  } catch (error: any) {
    console.warn("Client-side deleteDoc failed. Falling back to server database proxy...", error);
    const path = docRef?.parent?.path || '';
    const docId = docRef?.id || '';
    if (path && docId) {
      try {
        const res = await fetch('/api/db/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, docId })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Erreur de proxy de base de données");
        }
        console.log("Server-side deleteDoc fallback succeeded!");
        return;
      } catch (proxyError: any) {
        console.error("Server-side fallback also failed:", proxyError);
        throw error;
      }
    }
    throw error;
  }
}

export {
  app,
  auth,
  db,
  isCanvasEnvironment,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  limit,
  or,
  collectionGroup,
};
