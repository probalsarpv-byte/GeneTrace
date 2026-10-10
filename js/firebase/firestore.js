import { FIREBASE_ENABLED } from './firebase-config.js';

export async function createUserProfile(uid, data) {
  if (!FIREBASE_ENABLED) return { success: false, reason: 'Firebase not configured.' };
  try {
    const db = firebase.firestore();
    const docData = {
      uid: uid,
      displayName: data.displayName || '',
      email: data.email || '',
      role: 'user',
      plan: 'free',
      planStatus: 'active',
      premiumUntil: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(uid).set(docData, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function getUserProfile(uid) {
  if (!FIREBASE_ENABLED) return null;
  try {
    const db = firebase.firestore();
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function updateUserProfile(uid, updates) {
  if (!FIREBASE_ENABLED) return { success: false, reason: 'Firebase not configured.' };
  try {
    const db = firebase.firestore();
    await db.collection('users').doc(uid).update(updates);
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function getAllUsers() {
  if (!FIREBASE_ENABLED) return [];
  try {
    const db = firebase.firestore();
    const snapshot = await db.collection('users').get();
    const users = [];
    snapshot.forEach(doc => users.push(doc.data()));
    return users;
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

export async function setUserPlan(uid, plan, premiumUntil) {
  if (!FIREBASE_ENABLED) return { success: false, reason: 'Firebase not configured.' };
  try {
    const db = firebase.firestore();
    await db.collection('users').doc(uid).update({
      plan: plan,
      premiumUntil: premiumUntil
    });
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function setUserRole(uid, role) {
  if (!FIREBASE_ENABLED) return { success: false, reason: 'Firebase not configured.' };
  try {
    const db = firebase.firestore();
    await db.collection('users').doc(uid).update({
      role: role
    });
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function getFeatureConfig() {
  if (!FIREBASE_ENABLED) return null;
  try {
    const db = firebase.firestore();
    const doc = await db.collection('config').doc('features').get();
    if (doc.exists) return doc.data();
    return null;
  } catch (error) {
    return null;
  }
}

export async function setFeatureConfig(featureId, config) {
  if (!FIREBASE_ENABLED) return { success: false, reason: 'Firebase not configured.' };
  try {
    const db = firebase.firestore();
    await db.collection('config').doc('features').set({
      [featureId]: config
    }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function trackUsage(uid, featureId) {
  if (!FIREBASE_ENABLED) return { success: false, reason: 'Firebase not configured.' };
  try {
    const db = firebase.firestore();
    const docRef = db.collection('usage').doc(uid).collection('features').doc(featureId);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        transaction.set(docRef, { count: 1, lastUsed: firebase.firestore.FieldValue.serverTimestamp() });
      } else {
        transaction.update(docRef, { 
          count: firebase.firestore.FieldValue.increment(1),
          lastUsed: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

export async function getUserUsage(uid) {
  if (!FIREBASE_ENABLED) return {};
  try {
    const db = firebase.firestore();
    const snapshot = await db.collection('usage').doc(uid).collection('features').get();
    const usage = {};
    snapshot.forEach(doc => {
      usage[doc.id] = doc.data();
    });
    return usage;
  } catch (error) {
    return {};
  }
}

export async function logAnalytic(event, data) {
  if (!FIREBASE_ENABLED) return { success: false };
  try {
    const db = firebase.firestore();
    await db.collection('analytics').add({
      event: event,
      data: data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getSystemStats() {
  if (!FIREBASE_ENABLED) return null;
  try {
    const db = firebase.firestore();
    const usersSnap = await db.collection('users').get();
    let totalUsers = 0;
    let freeUsers = 0;
    let premiumUsers = 0;
    let activeToday = 0;
    const now = new Date();
    
    usersSnap.forEach(doc => {
      const data = doc.data();
      totalUsers++;
      if (data.plan === 'free') freeUsers++;
      else premiumUsers++;
      
      if (data.lastLogin) {
        const lastLogin = data.lastLogin.toDate();
        if (now.toDateString() === lastLogin.toDateString()) {
          activeToday++;
        }
      }
    });
    
    return { totalUsers, freeUsers, premiumUsers, activeToday, projects: 0, reportsGenerated: 0 };
  } catch (error) {
    return null;
  }
}
