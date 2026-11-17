# THE MONITOR — Technical Changes & Feature Update Guide

> **Document Purpose**: This document summarizes all architectural updates, database structures, authentication logic, and component additions made to the **Power Monitoring** system. Use this guide to sync changes with teammates working on native mobile APK or web versions.

---

## 1. Executive Summary of Updates

1. **User Management & Per-User Machine Assignment**:
   - Administrators can now create new users directly from the UI without getting logged out.
   - Administrators can assign specific machines (e.g. `MC_001`, `MC_002`) to individual users.
   - Standard users only see their assigned machines on their dashboard.
2. **Firebase Realtime Database Schema Expansion**:
   - New root node `/power_app_users` stores user roles and per-user machine assignment lists.
   - Email addresses are sanitized for RTDB key compatibility (converting `.`, `#`, `$`, `[`, `]` to `_`).
3. **Dynamic Custom Groups & Telemetry Layout**:
   - Telemetry registers support custom categories/groups (e.g. `ONE`, `Sensors`, `Production`).
   - Custom groups appear as interactive tabs AND in an "Other Section" directly below the active tab.
4. **Standalone React Native Mobile App (`Power-Mobile`)**:
   - Created standalone Expo SDK 58 React Native app in `d:\TAP\Tap-git\Power-Mobile`.
   - Native Firebase Auth persistence via `AsyncStorage`.
   - Configured for direct Android `.apk` generation via `eas.json`.

---

## 2. Firebase Database Schema Changes

### A. New Node: `/power_app_users`
Stores user roles, access flags, and assigned machine numbers.

```json
{
  "power_app_users": {
    "operator1@company_com": {
      "email": "operator1@company.com",
      "role": "user",
      "assignedMachines": [1, 2],
      "allMachines": false,
      "createdAt": 1731843000000,
      "updatedAt": 1731843000000
    },
    "tapcloud10@gmail_com": {
      "email": "tapcloud10@gmail.com",
      "role": "admin",
      "assignedMachines": [1],
      "allMachines": true,
      "updatedAt": 1731843000000
    }
  }
}
```

#### Field Specifications:
| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | `string` | User's email address. |
| `role` | `"admin" \| "user"` | Access role. |
| `assignedMachines` | `number[]` | Array of integer machine IDs (e.g. `[1, 3]` maps to `MC_001` and `MC_003`). |
| `allMachines` | `boolean` | If `true`, the user can view all machines regardless of list. |
| `updatedAt` | `number` | Unix timestamp of last assignment change. |

### B. Sanitizing Email Keys for RTDB
Firebase keys cannot contain characters like `.` or `@`. Use this helper function:
```javascript
export const sanitizeEmailKey = (email) => {
  if (!email) return "";
  return String(email)
    .replace(/[[\]"']/g, "")
    .trim()
    .toLowerCase()
    .replace(/[.#$[\]]/g, "_");
};
```

---

## 3. Authentication & User Creation Architecture

### A. Admin Whitelist (`src/constants/admins.js`)
- Primary Admin: `tapcloud10@gmail.com`.
- Helper: `isUserAdmin(user)` checks if current user is an authorized admin.

### B. Background User Creation (`src/firebase/auth.js` / Mobile `AuthContext.js`)
Standard Firebase `createUserWithEmailAndPassword(auth, email, password)` replaces the active user session on the client. To allow the Admin to create users **without logging out**, a temporary secondary Firebase App instance is used:

```javascript
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

export const adminCreateUser = async (email, password) => {
  const secondaryAppName = `UserCreation_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
    await signOut(secondaryAuth);
    return cred.user;
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch (e) {
      // ignore disposal error
    }
  }
};
```

---

## 4. Per-User Machine Filtering Logic

### In `src/contexts/machineConfigContext/`:
```javascript
const getCategoryConfig = (categoryKey = 'power_meters') => {
  const cat = machinesConfig[categoryKey] || DEFAULT_MACHINES_CONFIG.power_meters;
  const baseAllowed = cat?.allowed || [];

  // Filter machines if user is a standard user with assigned machines
  let effectiveAllowed = baseAllowed;
  if (!isAdmin && Array.isArray(assignedMachines)) {
    effectiveAllowed = baseAllowed.filter((num) => assignedMachines.includes(num));
  }

  return {
    allowedNumbers: effectiveAllowed,
    allAllowedNumbers: baseAllowed,
    machineNames: cat?.names || {},
    machineAddresses: cat?.addresses || {},
    machineCustomLabels: cat?.customLabels || {},
    label: cat?.label || categoryKey,
    allTelemetryAddresses,
    allAddressKeys
  };
};
```

### In `src/components/home/IotChiller3.jsx` (and Mobile `DashboardScreen.js`):
1. Filters the Firebase root keys to only fetch telemetry for `allowedNumbers`.
2. If `!isAdmin && assignedMachines.length === 0`:
   - Renders a warning card: *"No Machines Assigned Yet — Please contact your administrator to configure machine access."*

---

## 5. UI Components Added / Updated

### 1. `UserManagerModal` (`src/components/common/UserManagerModal.jsx` / Mobile `src/components/UserManagerModal.js`)
- **Header**: Brand title, Admin Only badge, and close button.
- **Search Bar**: Quick search to find users by email.
- **Create User Form**:
  - Inputs for Email, Password, and Role.
  - Multi-select machine checkboxes (`MC_001`, `MC_002`, etc.) with "Select All" / "Clear".
  - "All Machines" toggle for plant managers.
- **User Directory**:
  - Lists all users with their active machine chips.
  - "Edit Machines" trigger allowing inline permission edits with instant cloud sync.
  - Delete user permissions button.

### 2. `Header` (`src/components/header/index.jsx` / Mobile `src/components/Header.js`)
- Added **"Users"** button (`👥 Users`) displayed **only when `isAdmin === true`**.
- Opens `UserManagerModal`.

### 3. `IotChiller3` / Mobile `DashboardScreen`
- **Hero Card**: High-contrast Active Energy (`kWh`) & Grid Frequency (`Hz`).
- **Telemetry Tabs**: `VLN` (with Avg), `VLL` (with Avg), `I` (with Avg), `Power` (W, PF, kVA, etc.), and `VAF` (Phase R, Y, B sub-tabs).
- **Lower Custom Groups Section**: Any custom registers (e.g. `ONE [aaa: 8787]`) are rendered directly below the active tab.

---

## 6. Project Files Map

| File Path | Description of Changes |
| :--- | :--- |
| `src/constants/admins.js` | Added `sanitizeEmailKey(email)` for RTDB path safety. |
| `src/firebase/firebase.js` | Exported `firebaseConfig` object for secondary app initialization. |
| `src/firebase/auth.js` | Added `adminCreateUser(email, password)` without sign-out. |
| `src/contexts/authContext/` | Subscribes to user profile in `/power_app_users`, exposes `assignedMachines`. |
| `src/contexts/machineConfigContext/` | Added `allUsers` state, `saveUserPermissions`, `deleteUserPermissions`, and filtered `allowedNumbers`. |
| `src/components/common/UserManagerModal.jsx` | *(New)* Full user creation & machine assignment modal for Web. |
| `src/components/header/index.jsx` | Added Admin "Users" button and modal rendering. |
| `src/components/home/IotChiller3.jsx` | Guard for zero assigned machines and per-user telemetry filtering. |
| `src/components/auth/register/index.jsx` | Auto-registers self-signed users into `/power_app_users` with empty assignment. |

---

## 7. Instructions for Mobile APK Development

The standalone mobile project is in:
📁 **[`d:\TAP\Tap-git\Power-Mobile`](file:///d:/TAP/Tap-git/Power-Mobile)**

### Key Mobile Dependencies:
- `firebase@^13.3.0`
- `@react-native-async-storage/async-storage@2.2.0`
- `react-native-safe-area-context`
- `@expo/vector-icons`

### To Build the APK:
1. **Cloud Build (Recommended — No Android Studio needed)**:
   ```bash
   cd d:\TAP\Tap-git\Power-Mobile
   npx eas-cli login
   npx eas-cli build -p android --profile preview
   ```
2. **Local Build**:
   ```bash
   cd d:\TAP\Tap-git\Power-Mobile
   npx expo prebuild --platform android
   cd android
   .\gradlew assembleRelease
   ```
   Output: `android/app/build/outputs/apk/release/app-release.apk`
