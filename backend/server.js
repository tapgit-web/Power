const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initializeSockets } = require('./sockets/socketManager');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO engine
const io = initializeSockets(server);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check & Root
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Power Monitoring & Control Backend',
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin/users', require('./routes/userRoutes'));
app.use('/api', require('./routes/telemetryRoutes'));
app.use('/api/machines', require('./routes/machineRoutes'));
app.use('/', require('./routes/telemetryRoutes')); // Backwards compatibility for root /:machineId/read.json

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas and start HTTP + Socket.IO server
const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Power Monitoring Backend Server Running on Port ${PORT}`);
    console.log(`📡 Ingestion API: POST http://localhost:${PORT}/api/machines/:machineId/read`);
    console.log(`🔌 WebSockets:   ws://localhost:${PORT}`);
    console.log(`🏥 Health Check: GET  http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
