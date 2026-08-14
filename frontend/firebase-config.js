// Firebase Web SDK Configuration — GeoSafe System
// Replace these with your Firebase Project Configuration from Firebase Console (https://console.firebase.google.com)

const firebaseConfig = {
  apiKey: "AIzaSyDemoGeoSafeKey_ReplaceWithYourActualKey",
  authDomain: "geosafe-bayanan.firebaseapp.com",
  projectId: "geosafe-bayanan",
  storageBucket: "geosafe-bayanan.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Check if Firebase SDK is loaded
let db = null;
let auth = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    console.log('Firebase initialized successfully for GeoSafe');
  }
} catch (e) {
  console.warn('Firebase initialization notice:', e.message);
}
