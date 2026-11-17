import React, { useContext, useState, useEffect } from "react";
import { auth, app } from "../../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import { isUserAdmin, sanitizeEmailKey } from "../../constants/admins";

const database = getDatabase(app);

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [isEmailUser, setIsEmailUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, initializeUser);
    return unsubscribe;
  }, []);

  async function initializeUser(user) {
    if (user) {
      setCurrentUser({ ...user });

      // check if provider is email and password login
      const isEmail = user.providerData.some(
        (provider) => provider.providerId === "password"
      );
      setIsEmailUser(isEmail);
      setUserLoggedIn(true);
    } else {
      setCurrentUser(null);
      setUserLoggedIn(false);
      setIsEmailUser(false);
      setUserProfile(null);
    }

    setLoading(false);
  }

  // Subscribe to the logged-in user's profile and assigned machines in RTDB
  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      setUserProfile(null);
      return;
    }

    const emailKey = sanitizeEmailKey(currentUser.email);
    const userRef = ref(database, `power_app_users/${emailKey}`);
    const unsubscribe = onValue(
      userRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === "object") {
          setUserProfile(val);
        } else {
          setUserProfile(null);
        }
      },
      (err) => {
        console.error("Error reading user profile:", err);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const isAdmin = currentUser
    ? isUserAdmin(currentUser) || userProfile?.role === "admin"
    : false;

  // If user is admin or allMachines is true, assignedMachines is null (meaning unrestricted/all)
  // Otherwise, returns the array of machine numbers (e.g. [1, 2])
  const assignedMachines =
    isAdmin || userProfile?.allMachines === true
      ? null
      : Array.isArray(userProfile?.assignedMachines)
      ? userProfile.assignedMachines
      : [];

  const value = {
    userLoggedIn,
    isEmailUser,
    currentUser,
    setCurrentUser,
    isAdmin,
    userProfile,
    assignedMachines,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
