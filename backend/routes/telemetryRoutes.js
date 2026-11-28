const express = require('express');
const router = express.Router();
const {
  ingestTelemetry,
  getLogs,
  exportLogsCsv,
  dispatchModbusWrite,
  getPendingWrites,
} = require('../controllers/telemetryController');
const { requireAuth } = require('../middleware/auth');

// Hardware Ingestion Endpoints (Open to Gateway)
// Supports standard REST, Firebase RTDB-style .json suffix, and POST/PUT/PATCH methods
const handleIngest = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return ingestTelemetry(req, res);
  }
  next();
};

router.all('/machines/:machineId/read', handleIngest);
router.all('/machines/:machineId/read.json', handleIngest);
router.all('/:machineId/read.json', handleIngest);
router.all('/:machineId/read', handleIngest);
router.all('/read.json', handleIngest);
router.all('/read', handleIngest);
router.all('/ap', handleIngest);
router.all('/api', handleIngest);
router.post('/telemetry/ingest', ingestTelemetry);

// Modbus Control: Gateway polling for pending writes
router.get('/machines/:machineId/write/pending', getPendingWrites);

// Client Protected Endpoints: Modbus Write, Historical Logs, CSV Export
router.post('/machines/:machineId/write', requireAuth, dispatchModbusWrite);
router.get('/machines/:machineId/logs', requireAuth, getLogs);
router.get('/machines/:machineId/logs/export', requireAuth, exportLogsCsv);

module.exports = router;
