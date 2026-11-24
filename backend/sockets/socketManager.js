const jwt = require('jsonwebtoken');
const { JWT_SECRET, canAccessMachine } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

let ioInstance = null;

// In-memory latest snapshot cache for instant delivery on connect
const latestTelemetryCache = new Map();

const initializeSockets = (server) => {
  const { Server } = require('socket.io');

  const io = new Server(server, {
    cors: {
      origin: '*', // Allow React Web and Flutter mobile origins
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  // Socket authentication middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    // Allow unauthenticated connection for gateway ingestion test if needed,
    // but tag socket with guest/authenticated state
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          assignedMachines: decoded.assignedMachines || [],
          allMachines: Boolean(decoded.allMachines),
        };
      } catch (err) {
        // Invalid token
        return next(new Error('Authentication error: Invalid token'));
      }
    } else {
      // Guest or local monitoring client
      socket.user = null;
    }

    next();
  });

  io.on('connection', (socket) => {
    const userEmail = socket.user ? socket.user.email : 'Anonymous/Guest';
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id} (${userEmail})`);

    // Handle room subscription: join_machine
    socket.on('join_machine', (machineId) => {
      if (!machineId) return;

      const cleanId = String(machineId).trim();

      // Check permissions if user is authenticated
      if (socket.user && !canAccessMachine(socket.user, cleanId)) {
        socket.emit('error_message', {
          message: `Access denied to machine: ${cleanId}`,
        });
        return;
      }

      const roomName = `machine_${cleanId}`;
      socket.join(roomName);
      console.log(`📡 [Socket.IO] Socket ${socket.id} joined ${roomName}`);

      // Immediately send latest cached telemetry snapshot if available
      if (latestTelemetryCache.has(cleanId)) {
        socket.emit('telemetry_update', latestTelemetryCache.get(cleanId));
      }
    });

    // Handle multi-machine room subscriptions: join_machines
    socket.on('join_machines', (machineIds) => {
      if (!Array.isArray(machineIds)) return;

      machineIds.forEach((mId) => {
        const cleanId = String(mId).trim();
        if (!socket.user || canAccessMachine(socket.user, cleanId)) {
          const roomName = `machine_${cleanId}`;
          socket.join(roomName);
          if (latestTelemetryCache.has(cleanId)) {
            socket.emit('telemetry_update', latestTelemetryCache.get(cleanId));
          }
        }
      });
    });

    // Handle leave_machine
    socket.on('leave_machine', (machineId) => {
      if (!machineId) return;
      socket.leave(`machine_${machineId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Broadcast telemetry packet to machine room & global stream
const broadcastTelemetry = (machineId, payload) => {
  if (!ioInstance) return;

  // Update in-memory snapshot cache
  latestTelemetryCache.set(machineId, payload);

  // Emit to specific machine room
  ioInstance.to(`machine_${machineId}`).emit('telemetry_update', payload);

  // Emit to global admin monitor room
  ioInstance.to('admin_global').emit('telemetry_update', payload);
};

// Broadcast Modbus write command dispatched
const broadcastModbusCommand = (machineId, commandPayload) => {
  if (!ioInstance) return;
  ioInstance.to(`machine_${machineId}`).emit('modbus_command', commandPayload);
};

const getLatestCache = (machineId) => {
  return latestTelemetryCache.get(machineId) || null;
};

module.exports = {
  initializeSockets,
  broadcastTelemetry,
  broadcastModbusCommand,
  getLatestCache,
};
