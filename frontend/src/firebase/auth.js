import { auth, firebaseConfig } from "./firebase";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserSessionPersistence,
  signOut
} from "firebase/auth";
import api, { setAuthToken } from "../services/api";

// Set session-only persistence for Firebase
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Failed to set session persistence:', error);
});

export const doCreateUserWithEmailAndPassword = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

/**
 * Sign in using custom backend JWT API first.
 * Falls back to Firebase Auth if backend is unreachable or returns an error.
 */
export const doSignInWithEmailAndPassword = async (email, password) => {
  try {
    const backendRes = await api.login(email, password);
    if (backendRes.success && backendRes.data?.user) {
      console.log('✅ [Auth] Signed in via Custom Backend');
      window.dispatchEvent(
        new CustomEvent('auth-state-change', { detail: { user: backendRes.data.user } })
      );
      return backendRes.data.user;
    }
  } catch (backendErr) {
    console.warn('⚠️ [Auth] Custom backend login attempt failed, trying Firebase:', backendErr.message);
  }

  // Fallback to Firebase
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const doSignInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const doSignOut = async () => {
  api.logout();
  setAuthToken(null);
  window.dispatchEvent(
    new CustomEvent('auth-state-change', { detail: { user: null } })
  );
  try {
    await auth.signOut();
  } catch (e) {
    // ignore
  }
};

export const doPasswordReset = (email) => {
  return sendPasswordResetEmail(auth, email);
};

export const doPasswordChange = (password) => {
  return updatePassword(auth.currentUser, password);
};

export const doSendEmailVerification = () => {
  return sendEmailVerification(auth.currentUser, {
    url: `${window.location.origin}/home`,
  });
};

/**
 * Creates a new user without logging out the current admin session.
 * Syncs with both Custom Backend and Firebase.
 */
export const adminCreateUser = async (email, password, role = 'user', assignedMachines = []) => {
  // 1. Try Custom Backend
  try {
    await api.createUser({ email, password, role, assignedMachines, allMachines: role === 'admin' });
    console.log(`✅ [Auth] User "${email}" created in Custom Backend`);
  } catch (backendErr) {
    console.warn('⚠️ [Auth] Could not create user in custom backend:', backendErr.message);
  }

  // 2. Also create in Firebase secondary app
  const secondaryAppName = `UserCreationApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return cred.user;
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch (e) {
      // ignore app disposal error
    }
  }
};
