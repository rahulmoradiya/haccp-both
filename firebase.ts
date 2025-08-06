import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyBjJ8oKwTmyez89yje7Rzgg6bP_Oli8udk',
  authDomain: 'monitoringhub-11e20.firebaseapp.com',
  projectId: 'monitoringhub-11e20',
  storageBucket: 'monitoringhub-11e20.appspot.com',
  messagingSenderId: '401237586879',
  appId: '1:401237586879:web:6c8b12584d4a4f14e0e70a',
  measurementId: 'G-WLJYCMLK1S',
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { app };
