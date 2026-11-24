const Machine = require('../models/Machine');
const SystemSettings = require('../models/SystemSettings');
const { ROLES } = require('../config/constants');
const { canAccessMachine } = require('../middleware/auth');

// List machines accessible to the current user
// GET /api/machines
const listMachines = async (req, res) => {
  try {
    let query = { isActive: true };

    // Standard users only see assigned machines
    if (req.user.role !== ROLES.ADMIN && !req.user.allMachines) {
      query.machineId = { $in: req.user.assignedMachines || [] };
    }

    const machines = await Machine.find(query).sort({ machineId: 1 });
    return res.status(200).json({ machines });
  } catch (error) {
    console.error('List machines error:', error);
    return res.status(500).json({ error: 'Failed to retrieve machines' });
  }
};

// Get single machine configuration and latest snapshot
// GET /api/machines/:machineId
const getMachine = async (req, res) => {
  try {
    const { machineId } = req.params;

    if (!canAccessMachine(req.user, machineId)) {
      return res.status(403).json({ error: 'Access denied to this machine' });
    }

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    return res.status(200).json({ machine });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch machine' });
  }
};

// Add / Create a new machine (Admin only)
// POST /api/machines
const createMachine = async (req, res) => {
  try {
    const { machineId, displayName, category, deviceId } = req.body;

    if (!machineId) {
      return res.status(400).json({ error: 'machineId is required (e.g., SAFC_M33)' });
    }

    const cleanId = String(machineId).trim();
    const existing = await Machine.findById(cleanId);
    if (existing) {
      return res.status(409).json({ error: `Machine "${cleanId}" already exists` });
    }

    const newMachine = await Machine.create({
      _id: cleanId,
      machineId: cleanId,
      displayName: displayName?.trim() || cleanId,
      category: category?.trim() || 'general',
      deviceId: deviceId?.trim() || '',
      isLoggingEnabled: false,
      loggingIntervalSec: 60,
    });

    return res.status(201).json({
      message: 'Machine created successfully',
      machine: newMachine,
    });
  } catch (error) {
    console.error('Create machine error:', error);
    return res.status(500).json({ error: 'Failed to create machine' });
  }
};

// Update machine details (Admin only)
// PUT /api/machines/:machineId
const updateMachine = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { displayName, category, deviceId } = req.body;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    if (displayName) machine.displayName = displayName.trim();
    if (category) machine.category = category.trim();
    if (deviceId !== undefined) machine.deviceId = deviceId.trim();

    await machine.save();

    return res.status(200).json({
      message: 'Machine updated successfully',
      machine,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update machine' });
  }
};

// Delete a machine (Admin only)
// DELETE /api/machines/:machineId
const deleteMachine = async (req, res) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    await Machine.findByIdAndDelete(machineId);

    return res.status(200).json({ message: `Machine "${machineId}" deleted successfully` });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete machine' });
  }
};

// Update register display names / custom labels
// Allowed for: Admin OR user_editor (if machine is assigned to them)
// PUT /api/machines/:machineId/labels
const updateCustomLabels = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { customLabels } = req.body;

    if (!canAccessMachine(req.user, machineId)) {
      return res.status(403).json({ error: 'Permission denied: Cannot edit labels for this machine' });
    }

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    if (customLabels && typeof customLabels === 'object') {
      machine.customLabels = customLabels;
      await machine.save();
    }

    return res.status(200).json({
      message: 'Custom register labels updated successfully',
      customLabels: machine.customLabels,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update custom labels' });
  }
};

// Toggle data logging for a specific machine (Admin only)
// PUT /api/machines/:machineId/logging
const toggleMachineLogging = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { isLoggingEnabled, loggingIntervalSec } = req.body;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    if (typeof isLoggingEnabled === 'boolean') {
      machine.isLoggingEnabled = isLoggingEnabled;
    }

    if (typeof loggingIntervalSec === 'number' && loggingIntervalSec >= 5) {
      machine.loggingIntervalSec = loggingIntervalSec;
    }

    await machine.save();

    return res.status(200).json({
      message: `Logging for ${machineId} is now ${machine.isLoggingEnabled ? 'ENABLED' : 'DISABLED'}`,
      isLoggingEnabled: machine.isLoggingEnabled,
      loggingIntervalSec: machine.loggingIntervalSec,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update machine logging status' });
  }
};

// Get / Toggle Global Plant-wide Logging Settings (Admin only)
// GET & PUT /api/settings/logging
const getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findById('global_config');
    if (!settings) {
      settings = await SystemSettings.create({ _id: 'global_config' });
    }
    return res.status(200).json({ settings });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch system settings' });
  }
};

const updateSystemSettings = async (req, res) => {
  try {
    const { globalLoggingEnabled, retentionDays, defaultLoggingIntervalSec } = req.body;

    let settings = await SystemSettings.findById('global_config');
    if (!settings) {
      settings = new SystemSettings({ _id: 'global_config' });
    }

    if (typeof globalLoggingEnabled === 'boolean') {
      settings.globalLoggingEnabled = globalLoggingEnabled;
    }
    if (typeof retentionDays === 'number') {
      settings.retentionDays = retentionDays;
    }
    if (typeof defaultLoggingIntervalSec === 'number') {
      settings.defaultLoggingIntervalSec = defaultLoggingIntervalSec;
    }

    await settings.save();

    return res.status(200).json({
      message: 'Global settings updated successfully',
      settings,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update system settings' });
  }
};

module.exports = {
  listMachines,
  getMachine,
  createMachine,
  updateMachine,
  deleteMachine,
  updateCustomLabels,
  toggleMachineLogging,
  getSystemSettings,
  updateSystemSettings,
};
