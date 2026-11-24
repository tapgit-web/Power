const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema(
  {
    _id: {
      type: String, // String ID matching machineId (e.g. "SAFC_M33", "MC_001")
      required: true,
    },
    machineId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'general',
      trim: true,
    },
    deviceId: {
      type: String, // e.g. "plc_device_2CD555577610CB5489A3789152DC0924"
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isLoggingEnabled: {
      type: Boolean,
      default: false, // Admin condition: only logs when enabled!
    },
    loggingIntervalSec: {
      type: Number,
      default: 60, // Minimum seconds between saved log records
    },
    lastLoggedAt: {
      type: Date,
      default: null,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    customLabels: {
      type: Map,
      of: String, // e.g. { "bottle_count": "Main Bottle Counter", "chiller": "Inlet Temp" }
      default: {},
    },
    latestValues: {
      type: mongoose.Schema.Types.Mixed, // Latest snapshot in database
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Machine', machineSchema);
