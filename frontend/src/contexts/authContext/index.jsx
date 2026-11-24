import React, { useContext, useState, useEffect, useCallback } from "react";
import { auth, app } from "../../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import { isUserAdmin, sanitizeEmailKey } from "../../constants/admins";
import api, { getAuthToken } from "../../services/api";

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

  // Check Custom Backend session on mount
  const checkBackendSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return false;

    try {
      const res = await api.getMe();
      if (res.success && res.data?.user) {
        const u = res.data.user;
        setCurrentUser({ email: u.email, uid: u._id || u.id, ...u });
        setUserProfile(u);
        setUserLoggedIn(true);
        setIsEmailUser(true);
        setLoading(false);
        return true;
      }
    } catch (err) {
      console.warn("Could not restore custom backend session:", err.message);
    }
    return false;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Check custom backend token first
    checkBackendSession().then((hasSession) => {
      if (hasSession && isMounted) return;

      // 2. If no backend session, listen to Firebase auth
      const unsubscribeFirebase = onAuthStateChanged(auth, (user) => {
        if (!isMounted) return;
        if (user) {
          setCurrentUser({ ...user });
          const isEmail = user.providerData.some(
            (provider) => provider.providerId === "password"
          );
          setIsEmailUser(isEmail);
          setUserLoggedIn(true);
        } else if (!getAuthToken()) {
          setCurrentUser(null);
          setUserLoggedIn(false);
          setIsEmailUser(false);
          setUserProfile(null);
        }
        setLoading(false);
      });

      return unsubscribeFirebase;
    });

    // 3. Listen for local auth-state-change events (from api.login / logout)
    const handleCustomAuth = (e) => {
      const user = e.detail?.user;
      if (user) {
        setCurrentUser({ email: user.email, uid: user.id || user._id, ...user });
        setUserProfile(user);
        setUserLoggedIn(true);
        setIsEmailUser(true);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserLoggedIn(false);
        setIsEmailUser(false);
      }
      setLoading(false);
    };

    window.addEventListener("auth-state-change", handleCustomAuth);

    return () => {
      isMounted = false;
      window.removeEventListener("auth-state-change", handleCustomAuth);
    };
  }, [checkBackendSession]);

  // Subscribe to the logged-in user's profile in Firebase RTDB if Firebase user
  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      return;
    }

    // If profile was already loaded from custom backend, keep it
    if (userProfile?.role) return;

    const emailKey = sanitizeEmailKey(currentUser.email);
    const userRef = ref(database, `power_app_users/${emailKey}`);
    const unsubscribe = onValue(
      userRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === "object") {
          setUserProfile(val);
        }
      },
      (err) => {
        console.error("Error reading user profile from Firebase:", err);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  const isAdmin = currentUser
    ? isUserAdmin(currentUser) || userProfile?.role === "admin"
    : false;

  const canEditRegisterNames =
    isAdmin || userProfile?.role === "user_editor";

  // If user is admin or allMachines is true, assignedMachines is null (unrestricted)
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
    canEditRegisterNames,
    userProfile,
    assignedMachines,
    refreshUserSession: checkBackendSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
