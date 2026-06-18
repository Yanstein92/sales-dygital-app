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
} from 'firebase/auth';
import {
  getFirestore,
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
} from 'firebase/firestore';

// Warning: For a client side app, the VITE_ prefixed keys must be added to .env
// We keep fallbacks to avoid breaking the user's current testing flow until they configure VITE_ secrets.
const env = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyD4mE-5BO0kRVmonutJoJx6PQsuVl7OqSE",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "sales-dygital.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "sales-dygital",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "sales-dygital.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "903151549257",
  appId: env.VITE_FIREBASE_APP_ID || "1:903151549257:web:7615f78e85a39173887898",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-5XEJ6BGMMP"
};

// Check if embedded Canvas Auth is present
const isCanvasEnvironment = typeof (window as any).__firebase_config !== 'undefined' && (window as any).__firebase_config !== "";
const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'kdb-export-app';

// Always use the real firebase config provided above, but we still handle canvas pathing 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Data structure paths: For now we retain the existing logic to not break active data, 
// but we prepare for companies architecture via context.
export const getDbPath = (colName: string, companyId: string) => 
  isCanvasEnvironment ? `artifacts/${appId}/companies/${companyId}/${colName}` : `companies/${companyId}/${colName}`;

// Fallback for user path (retro-compatibility)
export const getUserPath = (colName: string, userId: string) => 
  isCanvasEnvironment ? `artifacts/${appId}/users/${userId}/${colName}` : `users/${userId}/${colName}`;

export const getUserDocPath = (userId: string) => 
  isCanvasEnvironment ? `artifacts/${appId}/users/${userId}` : `users/${userId}`;

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
};
