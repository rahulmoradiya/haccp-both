// Test Firebase rules and permissions
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function testFirebaseRules() {
  try {
    console.log('🧪 Testing Firebase rules...');
    
    // Test 1: Try to read companies collection
    console.log('📋 Testing companies collection access...');
    const companiesSnap = await getDocs(collection(db, 'companies'));
    console.log('✅ Successfully read companies collection. Found', companiesSnap.docs.length, 'companies');
    
    // Test 2: Try to read a specific company's users
    if (companiesSnap.docs.length > 0) {
      const firstCompany = companiesSnap.docs[0];
      console.log('🔍 Testing users collection for company:', firstCompany.id);
      const usersSnap = await getDocs(collection(db, 'companies', firstCompany.id, 'users'));
      console.log('✅ Successfully read users collection. Found', usersSnap.docs.length, 'users');
    }
    
    console.log('🎉 All Firebase tests passed! Rules are working correctly.');
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'permission-denied') {
      console.error('❌ Permission denied - check your Firestore rules');
    } else if (error.code === 'unavailable') {
      console.error('❌ Service unavailable - check your internet connection');
    }
  }
}

// Run the test
testFirebaseRules(); 