# THE MONITOR — Industrial IoT Power & PLC Monitoring System

A full-stack, real-time industrial monitoring and Modbus control platform. Supports multi-machine telemetry, dynamic per-machine register schemas, 3-tier user access control, and Admin-controlled conditional data logging.

---

## 📁 Project Structure

```
Power/
├── backend/                  # Node.js + Express + Socket.IO + MongoDB Atlas Server
│   ├── config/               # Database connection & constants
│   ├── controllers/          # Ingestion, Auth, Machine, User controllers
│   ├── middleware/           # JWT & 3-Tier RBAC middleware
│   ├── models/               # MongoDB models (Machine, User, TelemetryLog, CommandWrite)
│   ├── routes/               # REST API route handlers
│   ├── sockets/              # Socket.IO room subscriptions & real-time broadcast
│   ├── tests/                # Automated verification tests (read ingest & Modbus write)
│   ├── package.json
│   └── README.md
│
├── frontend/                 # React Web Dashboard
│   ├── public/               # Static assets & HTML entry
│   ├── src/                  # React components, contexts, and views
│   │   ├── components/       # Header, Modals (User/Machine), Chiller Dashboard
│   │   ├── contexts/         # AuthContext & MachineConfigContext
│   │   ├── services/         # Custom API (api.js) & Socket.IO (socket.js)
│   │   └── constants/        # Admin lists & register definitions
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── package.json              # Root project manager & runner
├── IMPLEMENTATION_PLAN.md    # Detailed technical architecture plan
└── CHANGES_SUMMARY.md        # Technical changes & Flutter mobile sync guide
```

---

## 🚀 Running the Project

### 1. Run the Backend Server (Port 5000)
```bash
npm run start:backend
# or from inside the backend folder:
cd backend && npm start
```

### 2. Run the Frontend Web Dashboard (Port 3000)
```bash
npm run start:frontend
# or from inside the frontend folder:
cd frontend && npm start
```

### 3. Build the Frontend for Production
```bash
npm run build:frontend
```

---

## 📡 Ingestion API (`read`) & Modbus Control (`write`)

* **Ingestion URL**: `POST http://<SERVER_IP>:5000/api/machines/:machineId/read` (e.g. `SAFC_M33`)
* **Control URL**: `POST http://<SERVER_IP>:5000/api/machines/:machineId/write` (Dispatches `do_mb_write`)
* **Realtime Sockets**: `ws://<SERVER_IP>:5000`
