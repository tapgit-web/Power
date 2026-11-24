import React, { useContext, useState, useEffect, useCallback } from "react";
import { isUserAdmin } from "../../constants/admins";
import api, { getAuthToken, setAuthToken } from "../../services/api";

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

  // Check Custom Backend session on mount / token refresh
  const checkBackendSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setUserProfile(null);
      setUserLoggedIn(false);
      setIsEmailUser(false);
      setLoading(false);
      return false;
    }

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
      } else {
        // Token expired or invalid
        setAuthToken(null);
        setCurrentUser(null);
        setUserProfile(null);
        setUserLoggedIn(false);
        setIsEmailUser(false);
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.warn("Could not restore custom backend session:", err.message);
      setLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Check custom backend JWT token on mount
    checkBackendSession();

    // Listen for custom auth events dispatched by api.login / api.logout
    const handleCustomAuth = (e) => {
      if (!isMounted) return;
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

  const isAdmin = currentUser
    ? isUserAdmin(currentUser) || userProfile?.role === "admin"
    : false;

  const canEditRegisterNames =
    isAdmin || userProfile?.role === "user_editor";

  // If user is admin or allMachines is true, assignedMachines is null (unrestricted access)
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
