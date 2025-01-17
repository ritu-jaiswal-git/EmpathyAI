// import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';

// import { getFirestore } from 'firebase/firestore';
// const firebaseConfig = {
//     apiKey: "AIzaSyAaqom27qucRMOXJJ03IAGA8LiPYiCxwOU",
//     authDomain: "empathyai-71e90.firebaseapp.com",
//     databaseURL: "https://empathyai-71e90-default-rtdb.firebaseio.com",
//     projectId: "empathyai-71e90",
//     storageBucket: "empathyai-71e90.appspot.com",
//     messagingSenderId: "523011715771",
//     appId: "1:523011715771:web:c1f434592b57a15b3a6f9e",
//     measurementId: "G-T7S210PVP5"
//   };
  
// const app = initializeApp(firebaseConfig);

// const auth = getAuth(app)
// const db = getFirestore(app)

// export { app, auth };
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaqom27qucRMOXJJ03IAGA8LiPYiCxwOU",
  authDomain: "empathyai-71e90.firebaseapp.com",
  databaseURL: "https://empathyai-71e90-default-rtdb.firebaseio.com",
  projectId: "empathyai-71e90",
  storageBucket: "empathyai-71e90.appspot.com",
  messagingSenderId: "523011715771",
  appId: "1:523011715771:web:c1f434592b57a15b3a6f9e",
  measurementId: "G-T7S210PVP5"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Use getFirestore to get the Firestore instance
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.error('Firebase persistence error:', err.code);
});

// Export Auth
export const auth = getAuth(app);



