# THE MONITOR — Technical Changes & Flutter Integration Guide

> **Document Purpose**: This document summarizes all architectural updates, Firebase database schemas, authentication workflows, and screen logic made to the **Power Monitoring** system. Use this guide to implement or sync these exact features into the **Flutter Android APK** app.

---

## 1. Executive Summary of Updates

1. **User Management & Per-User Machine Assignment**:
   - Administrators can create new operator/user accounts directly within the app without losing their active login session.
   - Administrators can assign specific machines (e.g. `MC_001`, `MC_002`) to each user.
   - Standard users only see their assigned machines on their dashboard.
2. **Three Distinct Account Roles**:
   - `user`: Standard User (View Assigned Only) — Read-only telemetry, Settings button hidden.
   - `user_editor`: Standard User (View Assigned & Editable Reg Names) — Telemetry filtered to assigned machines, can open Settings to edit register display names and custom labels, cannot add or delete machines.
   - `admin`: Administrator (Full Access) — Unrestricted view of all machines, add/delete machines, and user management.
3. **Firebase Realtime Database Schema (`/power_app_users`)**:
   - Stores user roles, machine assignment arrays, and access flags under sanitized email keys.
4. **Dynamic Custom Groups & Telemetry Layout**:
   - Telemetry registers support custom categories/groups (e.g. `ONE`, `Sensors`, `Production`).
   - Custom groups appear as interactive tabs AND in an "Other Section" directly below the active tab.

---

## 2. Firebase Realtime Database Architecture

### A. New Root Node: `/power_app_users`
Stores user roles, access flags, and assigned machine numbers.

```json
{
  "power_app_users": {
    "operator1@factory_com": {
      "email": "operator1@factory.com",
      "role": "user",
      "assignedMachines": [1, 2],
      "allMachines": false,
      "createdAt": 1731843000000,
      "updatedAt": 1731843000000
    },
    "supervisor@factory_com": {
      "email": "supervisor@factory.com",
      "role": "user_editor",
      "assignedMachines": [1, 3],
      "allMachines": false,
      "updatedAt": 1731843000000
    },
    "tapcloud10@gmail_com": {
      "email": "tapcloud10@gmail.com",
      "role": "admin",
      "assignedMachines": [1, 2, 3],
      "allMachines": true,
      "updatedAt": 1731843000000
    }
  }
}
```

#### Field Specifications:
| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | `String` | User's email address. |
| `role` | `String` | Access role: `"admin"`, `"user_editor"`, or `"user"`. |
| `assignedMachines` | `List<int>` | Array of integer machine numbers (e.g. `[1, 3]` maps to `MC_001` and `MC_003`). |
| `allMachines` | `bool` | If `true`, the user can view all machines across the plant. |
| `updatedAt` | `int` | Unix timestamp of last assignment change. |

---

### B. Sanitizing Email Keys for RTDB in Dart
Firebase Realtime Database keys cannot contain `.`, `#`, `$`, `[`, or `]`. Use this Flutter helper:

```dart
String sanitizeEmailKey(String email) {
  return email
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[.#$\[\]]'), '_');
}
```

---

### C. Dart Data Model for User Permissions

```dart
class PowerAppUser {
  final String email;
  final String role; // 'admin', 'user_editor', 'user'
  final List<int> assignedMachines;
  final bool allMachines;
  final int? updatedAt;

  PowerAppUser({
    required this.email,
    required this.role,
    required this.assignedMachines,
    required this.allMachines,
    this.updatedAt,
  });

  bool get isAdmin => role == 'admin';
  bool get isEditor => role == 'user_editor';
  bool get isViewOnly => role == 'user';

  factory PowerAppUser.fromMap(String email, Map<dynamic, dynamic>? map) {
    if (map == null) {
      return PowerAppUser(
        email: email,
        role: 'user',
        assignedMachines: [],
        allMachines: false,
      );
    }

    final rawAssigned = map['assignedMachines'];
    List<int> assigned = [];
    if (rawAssigned is List) {
      assigned = rawAssigned.map((e) => int.tryParse(e.toString()) ?? 0).where((e) => e > 0).toList();
    }

    return PowerAppUser(
      email: map['email'] ?? email,
      role: map['role'] ?? 'user',
      assignedMachines: assigned,
      allMachines: map['allMachines'] == true,
      updatedAt: map['updatedAt'] is int ? map['updatedAt'] : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'email': email,
      'role': role,
      'assignedMachines': assignedMachines,
      'allMachines': allMachines,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    };
  }
}
```

---

## 3. The 3 User Access Roles & Flutter UI Rules

| Role | Dashboard Telemetry | Settings / Configuration Screen | Edit Register Names & Labels | Add / Delete Machines | Manage Users |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`user`** *(Standard User - View Assigned Only)* | Only assigned machines | ❌ **Hidden** | ❌ Read-only | ❌ No | ❌ No |
| **`user_editor`** *(Standard User - View Assigned & Editable Reg Names)* | Only assigned machines | ✅ **Accessible** | ✅ **Yes** (Can edit custom labels & address names for assigned machines) | ❌ **Hidden / Disabled** | ❌ No |
| **`admin`** *(Administrator - Full Access)* | All machines | ✅ **Accessible** | ✅ **Yes** | ✅ **Yes** (Full control) | ✅ **Yes** (Create users & assign machines) |

### Hardcoded Fallback Admin Whitelist:
If `/power_app_users` is empty or offline, always treat `tapcloud10@gmail.com` as an Administrator.

```dart
bool isUserAdmin(String? email) {
  if (email == null) return false;
  return email.trim().toLowerCase() == 'tapcloud10@gmail.com';
}
```

---

## 4. Flutter Implementation: Creating Users Without Logging Out Admin

In Firebase Auth, calling `FirebaseAuth.instance.createUserWithEmailAndPassword()` on the default instance **replaces the active user session**, logging the Admin out.

To avoid this in Flutter, use a **temporary secondary `FirebaseApp` instance**:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';

Future<UserCredential?> adminCreateUserAccount({
  required String email,
  required String password,
  required String role, // 'user', 'user_editor', 'admin'
  required List<int> assignedMachines,
  required bool allMachines,
}) async {
  final String secondaryAppName = 'UserCreation_${DateTime.now().millisecondsSinceEpoch}';
  
  // 1. Initialize temporary secondary app sharing the same Firebase options
  FirebaseApp secondaryApp = await Firebase.initializeApp(
    name: secondaryAppName,
    options: Firebase.app().options,
  );

  try {
    // 2. Create the user credential on the isolated secondary app
    FirebaseAuth secondaryAuth = FirebaseAuth.instanceFor(app: secondaryApp);
    UserCredential cred = await secondaryAuth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password.trim(),
    );

    // 3. Sign out of secondary app immediately
    await secondaryAuth.signOut();

    // 4. Save user permissions to Firebase Realtime Database
    final String sanitizedKey = sanitizeEmailKey(email);
    final DatabaseReference userRef = FirebaseDatabase.instance.ref('power_app_users/$sanitizedKey');
    
    await userRef.set({
      'email': email.trim().toLowerCase(),
      'role': role,
      'assignedMachines': (allMachines || role == 'admin') ? [] : assignedMachines,
      'allMachines': (allMachines || role == 'admin'),
      'createdAt': ServerValue.timestamp,
      'updatedAt': ServerValue.timestamp,
    });

    return cred;
  } finally {
    // 5. Clean up the secondary app instance
    await secondaryApp.delete();
  }
}
```

---

## 5. Flutter Implementation: Filtering Telemetry by User Assignment

### A. Determining Active Machines for Current User:
```dart
List<int> getVisibleMachines({
  required PowerAppUser currentUser,
  required List<int> allPlantMachines, // e.g. [1, 2, 3, 4]
}) {
  if (currentUser.isAdmin || currentUser.allMachines) {
    return allPlantMachines;
  }
  return allPlantMachines
      .where((machineNum) => currentUser.assignedMachines.contains(machineNum))
      .toList();
}
```

### B. Handling Zero Assigned Machines:
If `currentUser.assignedMachines.isEmpty && !currentUser.isAdmin`:
Render a friendly placeholder screen in Flutter:
> **⚠️ No Machines Assigned Yet**
> *Please contact your administrator to configure your machine access permissions.*

### C. Listening to Telemetry Streams in Flutter:
Only subscribe to the Firebase paths for visible machines:
```dart
for (int machineNum in visibleMachines) {
  final String machineId = "MC_${machineNum.toString().padLeft(3, '0')}"; // e.g. MC_001
  FirebaseDatabase.instance.ref('Power/$machineId').onValue.listen((event) {
    // Update state for this machine
  });
}
```

---

## 6. Flutter UI Screens Checklist

1. **Dashboard Screen**:
   - Header with current user email, role badge (`Admin`, `Editor`, or `View Only`), and Logout button.
   - Show `👥 Users` button in App Bar **only if `currentUser.isAdmin`**.
   - Show `⚙️ Settings` button in App Bar **if `currentUser.isAdmin || currentUser.isEditor`** (hidden for standard `user`).
   - Machine selector tabs filtered to `visibleMachines`.
2. **User Management Screen/Dialog (Admin Only)**:
   - Form to input: `User Email`, `Initial Password` (min 6 chars), and `Account Role` dropdown:
     - `Standard User (View Assigned Only)`
     - `Standard User (View Assigned and editable reg address name)`
     - `Administrator (Full Access)`
   - Checkbox list of available machines (`MC_001`, `MC_002`, etc.) with "Select All" / "Clear" and "All Machines" checkbox.
   - User Directory listing all accounts with their assigned machines and an "Edit" / "Delete" button.
3. **Machine Settings Screen**:
   - For `admin`: Allow adding machines, deleting machines, and editing register display labels.
   - For `user_editor`: Hide "Add Machine" and "Delete Machine" buttons; allow editing register display labels and custom names for their assigned units.

---

## 7. Web Application Reference Map

Your friend can inspect these web files in the repository as a 1:1 reference:

| Feature / Logic | Web Reference File |
| :--- | :--- |
| **Email Sanitization** | `src/constants/admins.js` (`sanitizeEmailKey`) |
| **Secondary App Creation** | `src/firebase/auth.js` (`adminCreateUser`) |
| **User State & Role Listener** | `src/contexts/authContext/index.jsx` |
| **Machine Config & Filter Logic**| `src/contexts/machineConfigContext/index.jsx` |
| **User Management Modal UI** | `src/components/common/UserManagerModal.jsx` |
| **Dashboard Machine Filter** | `src/components/home/IotChiller3.jsx` |
| **Settings / Label Editor UI** | `src/components/common/MachineManagerModal.jsx` |
