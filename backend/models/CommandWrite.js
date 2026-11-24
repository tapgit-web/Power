const mongoose = require('mongoose');

const commandWriteSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      default: 'do_mb_write',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'executed', 'failed'],
      default: 'pending',
      index: true,
    },
    triggeredBy: {
      type: String, // email of operator or admin
      default: 'system',
    },
    params: {
      device_name: {
        type: String,
        default: 'plc_device',
      },
      write_list: [
        {
          starting_reg_addr: { type: Number, required: true },
          data: { type: String, required: true },
          data_type: { type: Number, default: 0 },
          request_type: { type: Number, default: 5 }, // 5 = Modbus Write Single Coil
        },
      ],
    },
    executedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CommandWrite', commandWriteSchema);
