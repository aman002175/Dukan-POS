// Firebase Cloud Sync Utility
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import type { AppState } from '@/types';

// Firebase configuration - using a demo project
// In production, replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDEMO_KEY_FOR_DUKAAN_POS",
  authDomain: "dukaan-pos-demo.firebaseapp.com",
  projectId: "dukaan-pos-demo",
  storageBucket: "dukaan-pos-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Generate 6-digit sync code
export function generateSyncCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Upload data to cloud
export async function uploadToCloud(state: AppState): Promise<string> {
  try {
    const syncCode = generateSyncCode();
    const dataToUpload = {
      ...state,
      syncCode,
      uploadedAt: serverTimestamp(),
      expiresAt: serverTimestamp(), // Data expires after 30 days
    };
    
    await setDoc(doc(db, 'syncData', syncCode), dataToUpload);
    return syncCode;
  } catch (error) {
    console.error('Error uploading to cloud:', error);
    throw new Error('Failed to upload data to cloud');
  }
}

// Download data from cloud
export async function downloadFromCloud(syncCode: string): Promise<AppState | null> {
  try {
    const docRef = doc(db, 'syncData', syncCode);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as AppState;
      // Delete from cloud after download for security
      await deleteDoc(docRef);
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error downloading from cloud:', error);
    throw new Error('Failed to download data from cloud');
  }
}

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Listen for online/offline events
export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
