import api, { setAuthToken } from "./api";

/**
 * Sign in using Custom Backend (Node.js + Express + JWT + MongoDB Atlas)
 */
export const doSignInWithEmailAndPassword = async (email, password) => {
  const backendRes = await api.login(email, password);
  if (backendRes.success && backendRes.data?.user) {
    const user = backendRes.data.user;
    window.dispatchEvent(
      new CustomEvent('auth-state-change', { detail: { user } })
    );
    return user;
  }
  throw new Error(backendRes.error || 'Invalid email or password');
};

/**
 * Register a new user using Custom Backend
 */
export const doCreateUserWithEmailAndPassword = async (email, password) => {
  const backendRes = await api.register(email, password);
  if (backendRes.success && backendRes.data?.user) {
    const user = backendRes.data.user;
    window.dispatchEvent(
      new CustomEvent('auth-state-change', { detail: { user } })
    );
    return { user };
  }
  throw new Error(backendRes.error || 'Registration failed');
};

/**
 * Sign out of Custom Backend
 */
export const doSignOut = async () => {
  api.logout();
  setAuthToken(null);
  window.dispatchEvent(
    new CustomEvent('auth-state-change', { detail: { user: null } })
  );
};

/**
 * Create a new user from Admin panel without changing current admin session
 */
export const adminCreateUser = async (email, password, role = 'user', assignedMachines = []) => {
  const res = await api.createUser({
    email,
    password,
    role,
    assignedMachines,
    allMachines: role === 'admin',
  });

  if (res.success && res.data?.user) {
    return res.data.user;
  }
  throw new Error(res.error || 'Failed to create user in backend');
};

// Placeholders for legacy auth methods
export const doSignInWithGoogle = async () => {
  throw new Error('Google sign-in is not supported on the custom backend.');
};

export const doPasswordReset = async () => {
  throw new Error('Password reset should be requested via your system administrator.');
};

export const doPasswordChange = async () => {
  throw new Error('Password update via user profile is not supported directly.');
};

export const doSendEmailVerification = async () => {
  return true;
};
