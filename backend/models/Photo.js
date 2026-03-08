const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        default: ''
    },
    mimetype: {
        type: String,
        default: 'image/jpeg'
    },
    size: {
        type: Number,
        default: 0
    },
    path: {
        type: String,
        required: true
    },
    source: {
        type: String,
        enum: ['camera', 'gallery', 'command'],
        default: 'command'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model('Photo', photoSchema);
