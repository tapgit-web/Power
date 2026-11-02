// List of authorized administrator email addresses.
// Only accounts in this list can see the "Machines" management popup and configure machines.

export const ADMIN_EMAILS = [
  "tapcloud10@gmail.com",
];

/**
 * Checks if a Firebase user is an authorized admin.
 * Automatically handles and strips any accidental bracket wrapping (e.g. "[user@email.com]").
 * @param {object} user - Firebase user object (must have email property)
 * @returns {boolean}
 */
export const isUserAdmin = (user) => {
  if (!user || !user.email) return false;
  const clean = (str) => (str || "").replace(/[[\]"']/g, "").trim().toLowerCase();
  const userEmail = clean(user.email);
  return ADMIN_EMAILS.some((adminEmail) => clean(adminEmail) === userEmail);
};
