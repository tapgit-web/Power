const mongoose = require('mongoose');

const telemetryLogSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      required: true,
    },
    values: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for fast queries: machineId + timestamp range
telemetryLogSchema.index({ machineId: 1, timestamp: -1 });

// TTL Index: Auto-delete logs older than 90 days to preserve free MongoDB Atlas quota
telemetryLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('TelemetryLog', telemetryLogSchema);
