import { FIREBASE_CONFIG, FIREBASE_ENABLED } from './firebase-config.js';

let app = null;
let auth = null;
let currentUser = null;
let authStateListeners = [];

export function initFirebaseAuth() {
  if (!FIREBASE_ENABLED) return;
  // Initialize Firebase (assuming SDK is loaded globally via CDN)
  if (window.firebase) {
    if (!firebase.apps.length) {
      app = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      app = firebase.app();
    }
    auth = firebase.auth();
    auth.onAuthStateChanged(user => {
      currentUser = user;
      authStateListeners.forEach(listener => listener(user));
    });
  } else {
    console.warn("Firebase SDK not found globally.");
  }
}

export async function registerUser(email, password, displayName) {
  if (!FIREBASE_ENABLED) {
    return { success: false, reason: 'Firebase not configured. See js/firebase/firebase-config.js' };
  }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    await user.updateProfile({ displayName });
    
    // Create Firestore document
    const db = firebase.firestore();
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      displayName: displayName,
      email: email,
      role: 'user',
      plan: 'free',
      planStatus: 'active',
      premiumUntil: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, user };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function loginUser(email, password) {
  if (!FIREBASE_ENABLED) {
    return { success: false, reason: 'Firebase not configured. See js/firebase/firebase-config.js' };
  }
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    // Update lastLogin
    const db = firebase.firestore();
    await db.collection('users').doc(userCredential.user.uid).update({
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function logoutUser() {
  if (!FIREBASE_ENABLED) {
    return { success: false, reason: 'Firebase not configured. See js/firebase/firebase-config.js' };
  }
  try {
    await auth.signOut();
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function resetPassword(email) {
  if (!FIREBASE_ENABLED) {
    return { success: false, reason: 'Firebase not configured. See js/firebase/firebase-config.js' };
  }
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export function onAuthStateChanged(callback) {
  if (!FIREBASE_ENABLED) {
    callback(null);
    return () => {};
  }
  authStateListeners.push(callback);
  if (auth) {
    return auth.onAuthStateChanged(callback);
  } else {
    // If auth isn't ready yet, the listener will be called once auth initializes
    return () => {
      authStateListeners = authStateListeners.filter(l => l !== callback);
    };
  }
}

export function getCurrentUser() {
  if (!FIREBASE_ENABLED) return null;
  return currentUser || (auth ? auth.currentUser : null);
}

export function isLoggedIn() {
  return !!getCurrentUser();
}
