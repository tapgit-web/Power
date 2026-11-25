# Power Monitoring & Control System — API & URL Reference Guide

> **Base Production URL:** `https://power-2-ceh7.onrender.com`  
> **Socket.IO Real-time URL:** `wss://power-2-ceh7.onrender.com`  
> **Local Backend URL:** `http://localhost:5000`

---

## 1. IoT Gateway Ingestion URLs (Hardware to Cloud)

These endpoints are open to your hardware IoT Gateway (no bearer token required). They accept **`POST`**, **`PUT`**, and **`PATCH`** requests.

| URL Path | Method | Purpose & Usage |
| :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/read` | `POST` / `PUT` | **Recommended full endpoint** for a specific machine (e.g. `TAP002` or `MC_001`). |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/read.json` | `POST` / `PUT` | Full endpoint with `.json` suffix for Firebase RTDB-compatible gateway firmware. |
| `https://power-2-ceh7.onrender.com/:machineId/read` | `POST` / `PUT` | Short URL alias (e.g. `/TAP002/read`) to save gateway memory/character limits. |
| `https://power-2-ceh7.onrender.com/:machineId/read.json` | `POST` / `PUT` | Short URL alias with `.json` suffix (e.g. `/TAP002/read.json`). |
| `https://power-2-ceh7.onrender.com/read` | `POST` / `PUT` | Root URL alias where the machine ID is auto-extracted from payload root (`MC_001`). |
| `https://power-2-ceh7.onrender.com/read.json` | `POST` / `PUT` | Root URL alias with `.json` suffix (Firebase root format). |
| `https://power-2-ceh7.onrender.com/api/telemetry/ingest` | `POST` | Generic telemetry ingestion route. |

### IoT Gateway Recommended Configuration:
* **URL:** `https://power-2-ceh7.onrender.com/api/machines/TAP002/read`
* **Protocol:** `HTTP PUT` or `HTTP POST`
* **Content Type:** `Text Plain` *(or `JSON`)*
* **SSL:** `SSL With No Authentication`
* **Access Token:** Any string or device ID (e.g., `4423A77ED7EF3E57B57F1CD28C6E0122`)

---

## 2. Remote Modbus Downlink & Machine Control

Used for remote machine control (start/stop pumps, chillers, counter reset) and gateway command polling.

| URL Path | Method | Auth | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/write/pending` | `GET` | **None** | Polled by IoT Gateway to retrieve unexecuted Modbus write commands. |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/write` | `POST` | **User JWT** | Dispatches a Modbus command (e.g. coil ON/OFF, register write) from Web/App. |

---

## 3. System Status & Diagnostics

Public health check endpoints used by uptime monitoring (UptimeRobot, Render, etc.) and diagnostics.

| URL Path | Method | Auth | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/health` | `GET` | **None** | Returns service status, MongoDB readyState, and active machine count + IDs. |
| `https://power-2-ceh7.onrender.com/` | `GET` / `HEAD` | **None** | Root service probe (used by Render health check). |

---

## 4. User Authentication & Profile

Handles secure user login and profile inspection. Uses JWT tokens in the `Authorization: Bearer <token>` header.

| URL Path | Method | Auth | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/auth/login` | `POST` | **None** | Login with `email` and `password`. Returns JWT token and user info. |
| `https://power-2-ceh7.onrender.com/api/auth/register` | `POST` | **None** | Register a new user account with default viewer permissions. |
| `https://power-2-ceh7.onrender.com/api/auth/me` | `GET` | **User JWT** | Returns current logged-in user profile, role, and assigned machines. |

---

## 5. Admin User Management (RBAC)

Restricted to users with the **`admin`** role.

| URL Path | Method | Auth | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/admin/users` | `GET` | **Admin JWT** | Returns all registered users with their roles and assigned machines. |
| `https://power-2-ceh7.onrender.com/api/admin/users` | `POST` | **Admin JWT** | Creates a new user with specific role and machine assignments. |
| `https://power-2-ceh7.onrender.com/api/admin/users/:id` | `PUT` | **Admin JWT** | Updates user role, password, `allMachines` flag, or `assignedMachines` array. |
| `https://power-2-ceh7.onrender.com/api/admin/users/:id` | `DELETE` | **Admin JWT** | Permanently deletes a user account. |

---

## 6. Machine Management & Register Customization

Manages machine configurations, categories, custom names, and register labels.

| URL Path | Method | Auth | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/machines` | `GET` | **User JWT** | Lists all active machines accessible to the logged-in user. |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId` | `GET` | **User JWT** | Returns full configuration and latest telemetry values for one machine. |
| `https://power-2-ceh7.onrender.com/api/machines` | `POST` | **Admin JWT** | Creates / registers a new machine in MongoDB Atlas. |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId` | `PUT` | **Admin JWT** | Updates machine displayName, category, deviceId, or register schema. |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId` | `DELETE` | **Admin JWT** | Deactivates / removes a machine. |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/labels` | `PUT` | **Editor/Admin** | Updates user-friendly register labels (e.g. `bottle_count` &rarr; "Bottle Count"). |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/logging` | `PUT` | **Admin JWT** | Toggles telemetry history logging ON/OFF and sets interval in seconds. |
| `https://power-2-ceh7.onrender.com/api/machines/config/settings` | `GET` | **Admin JWT** | Fetches global system settings (e.g., global logging enabled status). |
| `https://power-2-ceh7.onrender.com/api/machines/config/settings` | `PUT` | **Admin JWT** | Updates global system settings. |

---

## 7. Historical Telemetry Logs & CSV Export

Retrieves logged historical data and generates CSV reports for analytics.

| URL Path | Method | Auth | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/logs` | `GET` | **User JWT** | Queries historical logs with optional `startDate`, `endDate`, and `limit`. |
| `https://power-2-ceh7.onrender.com/api/machines/:machineId/logs/export` | `GET` | **User JWT** | Streams a direct `.csv` spreadsheet file download of logged telemetry. |

---

## 8. Real-Time WebSockets (Socket.IO)

Provides bidirectional, zero-latency streaming between Gateway, Backend, and Frontend.

* **Connection URL:** `https://power-2-ceh7.onrender.com` (Transport: `websocket`, `polling`)
* **Client Emit Events:**
  * `join_machine` with `{ machineId: "TAP002" }` &rarr; Subscribes client to live updates for this machine.
  * `leave_machine` with `{ machineId: "TAP002" }` &rarr; Unsubscribes client.
* **Server Broadcast Events:**
  * `telemetry_update` &rarr; Pushes new telemetry snapshot `{ machineId, values, timestamp }` instantly to joined clients.
  * `modbus_command` &rarr; Emits queued command execution status.

---

## 9. Frontend Configuration

In `frontend/.env`:
```ini
REACT_APP_BACKEND_URL=https://power-2-ceh7.onrender.com
```
Used by `frontend/src/services/api.js` and `frontend/src/services/socket.js` to communicate with the cloud backend without any Firebase dependency.
