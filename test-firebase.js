// Test Firebase connection and permissions
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBjJ8oKwTmyez89yje7Rzgg6bP_Oli8udk',
  authDomain: 'monitoringhub-11e20.firebaseapp.com',
  projectId: 'monitoringhub-11e20',
  storageBucket: 'monitoringhub-11e20.appspot.com',
  messagingSenderId: '401237586879',
  appId: '1:401237586879:web:6c8b12584d4a4f14e0e70a',
  measurementId: 'G-WLJYCMLK1S',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testFirebaseConnection() {
  try {
    console.log('🧪 Testing Firebase connection...');
    
    // Test 1: Check if we can read the companies collection
    console.log('📋 Testing companies collection access...');
    const companiesSnap = await getDocs(collection(db, 'companies'));
    console.log('✅ Successfully read companies collection. Found', companiesSnap.docs.length, 'companies');
    
    // Test 2: Check if we can read a specific company's users
    if (companiesSnap.docs.length > 0) {
      const firstCompany = companiesSnap.docs[0];
      console.log('🔍 Testing users collection for company:', firstCompany.id);
      const usersSnap = await getDocs(collection(db, 'companies', firstCompany.id, 'users'));
      console.log('✅ Successfully read users collection. Found', usersSnap.docs.length, 'users');
    }
    
    console.log('🎉 All Firebase tests passed!');
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

// Run the test
testFirebaseConnection(); 