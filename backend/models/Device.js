const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    deviceId: {
        type: String,
        required: true,
        unique: true
    },
    model: {
        type: String,
        default: 'Unknown'
    },
    platform: {
        type: String,
        enum: ['android', 'ios'],
        default: 'android'
    },
    osVersion: {
        type: String,
        default: ''
    },
    appVersion: {
        type: String,
        default: '1.0.0'
    },
    token: {
        type: String,
        required: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    photoCount: {
        type: Number,
        default: 0
    },
    messageCount: {
        type: Number,
        default: 0
    },
    batteryLevel: {
        type: Number,
        default: -1
    }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
