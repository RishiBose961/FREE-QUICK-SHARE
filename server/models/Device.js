import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceName: {
      type: String,
      required: true,
      trim: true,
      default: 'Unknown Device',
    },
    permanentRoomCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    socketId: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    pairedDevices: [
      {
        deviceId: String,
        deviceName: String,
        permanentRoomCode: String,
        pairedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Device = mongoose.model('Device', deviceSchema);
