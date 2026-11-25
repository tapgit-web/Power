const mongoose = require('mongoose');
const Machine = require('../models/Machine');
const TelemetryLog = require('../models/TelemetryLog');
const CommandWrite = require('../models/CommandWrite');
const SystemSettings = require('../models/SystemSettings');
const { broadcastTelemetry, broadcastModbusCommand } = require('../sockets/socketManager');
const { canAccessMachine } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Parse gateway payload flexibly (supports arrays, Firebase-style {"0":...} objects, and root machine nesting)
const parseGatewayPayload = (rawBody, defaultMachineId = '') => {
  let detectedMachineId = defaultMachineId;
  let deviceId = '';
  let timestamp = Date.now();
  let values = {};

  if (!rawBody) {
    return { machineId: detectedMachineId, deviceId, timestamp, values };
  }

  let node = rawBody;

  // Handle raw string payload
  if (typeof node === 'string') {
    try {
      node = JSON.parse(node);
    } catch (e) {}
  }

  // Handle Form URL Encoded body where raw JSON string was parsed as a dictionary key: { '{"read":...}': '' }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    const keys = Object.keys(node);
    if (keys.length === 1 && typeof keys[0] === 'string' && keys[0].trim().startsWith('{')) {
      try {
        node = JSON.parse(keys[0]);
      } catch (e) {}
    }
  }

  // 1. If payload is wrapped in machineId (e.g. { "MC_001": { "read": { ... } } })
  const topKeys = Object.keys(node);
  if (topKeys.length === 1 && !['read', 'values', 'write'].includes(topKeys[0]) && !topKeys[0].startsWith('plc_device')) {
    if (!detectedMachineId || detectedMachineId === 'SAFC_M33' || detectedMachineId === 'machines') {
      detectedMachineId = topKeys[0];
    }
    node = node[topKeys[0]];
  }

  // 2. Unroll "read" node if present
  if (node && typeof node === 'object' && node.read !== undefined && typeof node.read === 'object') {
    node = node.read;
  }

  // 3. Find deviceId and telemetry values inside node
  if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    if (keys.length > 0) {
      const plcKey = keys.find(k => k.startsWith('plc_device')) || keys[0];
      const records = node[plcKey];

      if (records && (Array.isArray(records) || typeof records === 'object')) {
        deviceId = plcKey;
        // Supports both Array [ { ts, values } ] and Object { "0": { ts, values } }
        const recordsList = Array.isArray(records) ? records : Object.values(records);
        const latest = recordsList[recordsList.length - 1] || recordsList[0];

        if (latest && typeof latest === 'object') {
          timestamp = latest.ts || latest.timestamp || latest.time || Date.now();
          values = latest.values && typeof latest.values === 'object' ? latest.values : latest;
        }
      } else if (node.values && typeof node.values === 'object') {
        timestamp = node.ts || node.timestamp || Date.now();
        values = node.values;
      } else {
        values = node;
      }
    }
  }

  return {
    machineId: detectedMachineId,
    deviceId,
    timestamp: Number(timestamp) || Date.now(),
    values: values && typeof values === 'object' ? values : {},
  };
};

// Ingestion Handler: POST /api/machines/:machineId/read (or /api/telemetry/ingest)
const ingestTelemetry = async (req, res) => {
  try {
    let routeMachineId = (req.params.machineId || req.body?.machineId || req.query?.machineId || '').trim();
    if (routeMachineId === 'machines' || routeMachineId === 'read') {
      routeMachineId = '';
    }
    const parsed = parseGatewayPayload(req.body, routeMachineId);
    const machineId = (parsed.machineId || routeMachineId || 'SAFC_M33').trim();
    const { deviceId, timestamp, values } = parsed;

    if (Object.keys(values).length === 0) {
      console.warn(`⚠️ [Telemetry Ingestion] Received request on "${req.originalUrl}" but 0 register values found! Body preview:`, JSON.stringify(req.body).slice(0, 300));
      return res.status(400).json({ error: 'No telemetry values found in payload' });
    }

    const payload = {
      machineId,
      deviceId,
      timestamp,
      values,
      receivedAt: Date.now(),
    };

    const registerKeys = Object.keys(values);
    const samplePreview = registerKeys.slice(0, 6).map(k => `${k}: ${values[k]}`).join(', ');
    console.log(`📥 [TELEMETRY INGESTION] Machine: "${machineId}" | Device: "${deviceId || 'N/A'}" | ${registerKeys.length} registers (${samplePreview}${registerKeys.length > 6 ? '...' : ''})`);

    // 1. Broadcast to Web & Flutter dashboards immediately
    broadcastTelemetry(machineId, payload);

    let logged = false;

    // 2. If MongoDB is connected, update machine metadata & check conditional logging
    if (mongoose.connection.readyState === 1) {
      let machine = await Machine.findById(machineId);

      // Auto-register machine if it doesn't exist yet
      if (!machine) {
        machine = await Machine.create({
          _id: machineId,
          machineId,
          displayName: machineId,
          category: 'power_meters',
          deviceId,
          isActive: true,
          isLoggingEnabled: false,
          loggingIntervalSec: 60,
        });
        console.log(`✨ [Machine] Auto-discovered new machine: ${machineId}`);
      }

      // Update lastSeen & latestValues in Machine record
      machine.lastSeen = new Date();
      machine.latestValues = values;
      if (deviceId && !machine.deviceId) {
        machine.deviceId = deviceId;
      }

      // 3. Conditional Logging Check
      // Telemetry is ONLY saved if both global logging and machine logging are enabled
      const settings = await SystemSettings.findById('global_config');
      const isGlobalOn = settings ? settings.globalLoggingEnabled : false;
      const isMachineOn = machine.isLoggingEnabled;

      if (isGlobalOn && isMachineOn) {
        const now = Date.now();
        const lastLogged = machine.lastLoggedAt ? new Date(machine.lastLoggedAt).getTime() : 0;
        const intervalMs = (machine.loggingIntervalSec || 60) * 1000;

        // Throttle writes by configured interval
        if (now - lastLogged >= intervalMs) {
          await TelemetryLog.create({
            machineId,
            deviceId: deviceId || machine.deviceId,
            timestamp: new Date(timestamp),
            values,
          });
          machine.lastLoggedAt = new Date(now);
          logged = true;
        }
      }

      await machine.save();
    }

    return res.status(200).json({
      status: 'success',
      machineId,
      registersCount: Object.keys(values).length,
      logged,
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    return res.status(500).json({ error: 'Failed to process telemetry ingestion' });
  }
};

// Query historical telemetry logs: GET /api/machines/:machineId/logs
const getLogs = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { from, to, limit = 500 } = req.query;

    if (!canAccessMachine(req.user, machineId)) {
      return res.status(403).json({ error: 'Access denied to this machine logs' });
    }

    const query = { machineId };

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const logs = await TelemetryLog.find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit, 10) || 500, 2000));

    return res.status(200).json({
      machineId,
      count: logs.length,
      logs,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

// Export logs as CSV for Excel: GET /api/machines/:machineId/logs/export
const exportLogsCsv = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { from, to } = req.query;

    if (!canAccessMachine(req.user, machineId)) {
      return res.status(403).json({ error: 'Access denied to export logs' });
    }

    const query = { machineId };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const logs = await TelemetryLog.find(query).sort({ timestamp: 1 }).limit(5000);

    if (logs.length === 0) {
      return res.status(404).send('No logs found for the selected date range.');
    }

    // Collect all unique value keys across logs
    const allKeys = new Set();
    logs.forEach((log) => {
      if (log.values && typeof log.values === 'object') {
        Object.keys(log.values).forEach((k) => allKeys.add(k));
      }
    });

    const headers = ['Timestamp', 'ISO Date', 'Machine ID', ...Array.from(allKeys)];
    const csvRows = [headers.join(',')];

    logs.forEach((log) => {
      const row = [
        new Date(log.timestamp).getTime(),
        `"${new Date(log.timestamp).toISOString()}"`,
        `"${log.machineId}"`,
        ...Array.from(allKeys).map((k) => (log.values && log.values[k] !== undefined ? log.values[k] : '')),
      ];
      csvRows.push(row.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${machineId}_logs_${Date.now()}.csv"`);
    return res.status(200).send(csvRows.join('\n'));
  } catch (error) {
    return res.status(500).send('Failed to generate CSV export');
  }
};

// Dispatch Modbus Control Command: POST /api/machines/:machineId/write
const dispatchModbusWrite = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { writeList, startingRegAddr, data, requestType, method = 'do_mb_write' } = req.body;

    // Check permission: Admin or user_editor with access to machine
    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.USER_EDITOR) {
      return res.status(403).json({ error: 'Permission denied: Editor or Admin required to issue write commands' });
    }

    if (!canAccessMachine(req.user, machineId)) {
      return res.status(403).json({ error: 'Permission denied for this machine' });
    }

    // Format write_list
    let formattedList = [];
    if (Array.isArray(writeList) && writeList.length > 0) {
      formattedList = writeList;
    } else if (startingRegAddr !== undefined && data !== undefined) {
      formattedList = [
        {
          starting_reg_addr: Number(startingRegAddr),
          data: String(data),
          data_type: 0,
          request_type: Number(requestType) || 5, // 5 = Write Single Coil
        },
      ];
    } else {
      return res.status(400).json({ error: 'Must provide writeList array or startingRegAddr + data' });
    }

    let commandId = `cmd_${Date.now()}`;
    let createdAt = new Date();

    if (mongoose.connection.readyState === 1) {
      const command = await CommandWrite.create({
        machineId,
        method,
        status: 'pending',
        triggeredBy: req.user.email,
        params: {
          device_name: 'plc_device',
          write_list: formattedList,
        },
      });
      commandId = command._id;
      createdAt = command.createdAt;
    }

    const commandPayload = {
      commandId,
      machineId,
      write: {
        method,
        params: {
          device_name: 'plc_device',
          write_list: formattedList,
        },
      },
      createdAt,
    };

    // Broadcast command over Socket.IO to any listening gateway or clients
    broadcastModbusCommand(machineId, commandPayload);

    return res.status(201).json({
      message: 'Modbus command queued successfully',
      command: commandPayload,
    });
  } catch (error) {
    console.error('Dispatch write error:', error);
    return res.status(500).json({ error: 'Failed to dispatch Modbus write command' });
  }
};

// Get pending Modbus writes (for IoT Gateways polling for commands)
// GET /api/machines/:machineId/write/pending
const getPendingWrites = async (req, res) => {
  try {
    const { machineId } = req.params;

    const pendingCommands = await CommandWrite.find({
      machineId,
      status: 'pending',
    }).sort({ createdAt: 1 });

    // Mark commands as 'sent'
    if (pendingCommands.length > 0) {
      const ids = pendingCommands.map((c) => c._id);
      await CommandWrite.updateMany({ _id: { $in: ids } }, { status: 'sent', executedAt: new Date() });
    }

    return res.status(200).json({
      machineId,
      count: pendingCommands.length,
      commands: pendingCommands.map((c) => ({
        method: c.method,
        params: c.params,
        commandId: c._id,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch pending commands' });
  }
};

module.exports = {
  ingestTelemetry,
  getLogs,
  exportLogsCsv,
  dispatchModbusWrite,
  getPendingWrites,
};
