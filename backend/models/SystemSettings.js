const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: 'global_config',
    },
    globalLoggingEnabled: {
      type: Boolean,
      default: false, // Master switch: turned OFF by default until Admin enables it
    },
    retentionDays: {
      type: Number,
      default: 90,
    },
    defaultLoggingIntervalSec: {
      type: Number,
      default: 60,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
