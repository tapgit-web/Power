# Power Monitoring & Control Custom Backend

A high-performance Node.js, Express, Socket.IO, and MongoDB Atlas backend for multi-machine industrial IoT telemetry and Modbus PLC remote control.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment (`.env`)
Create or edit `.env` in the `backend/` folder:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/power_monitor?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
ADMIN_INITIAL_PASSWORD=admin123
```

### 3. Start the Server
```bash
npm start
# or for auto-reload development:
npm run dev
```

---

## 📡 Hardware Ingestion API (`read`)

The IoT Gateway / Field Controller pushes live telemetry for any machine (e.g. `SAFC_M33` or `MC_001`):

* **Method**: `POST`
* **URL**: `http://<SERVER_IP>:5000/api/machines/SAFC_M33/read`
* **Headers**: `Content-Type: application/json`
* **Body**:
```json
{
  "read": {
    "plc_device_2CD555577610CB5489A3789152DC0924": [
      {
        "ts": 1795441232454,
        "values": {
          "bottle_count": 18332,
          "bottle_count1": 57,
          "chiller": 164,
          "comp": 0,
          "fan": 0,
          "pump": 1,
          "fsw_trip": 1,
          "kp1_trip": 1
        }
      }
    ]
  }
}
```

---

## 📤 Remote Modbus Control API (`write`)

Trigger physical PLC coil and register commands:

* **Method**: `POST`
* **URL**: `http://<SERVER_IP>:5000/api/machines/SAFC_M33/write`
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`, `Content-Type: application/json`
* **Body**:
```json
{
  "startingRegAddr": 520,
  "data": "1",
  "requestType": 5
}
```

---

## 🔌 WebSockets (Socket.IO)

* **Connection URL**: `ws://<SERVER_IP>:5000`
* **Join Machine Room**: `socket.emit('join_machine', 'SAFC_M33')`
* **Listen for Live Stream**: `socket.on('telemetry_update', (data) => console.log(data))`

---

## 👥 User Roles & Permissions

1. **`user`**: View assigned machines only (`assignedMachines: ["SAFC_M33"]`). Read-only.
2. **`user_editor`**: View assigned machines and edit register display names and custom labels. Can dispatch Modbus writes for assigned units.
3. **`admin`**: Full access to all machines, add/delete machines, toggle logging, and manage user accounts.
