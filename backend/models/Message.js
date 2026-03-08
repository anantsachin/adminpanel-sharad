const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    contactName: {
        type: String,
        default: ''
    },
    body: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['inbox', 'sent', 'draft'],
        default: 'inbox'
    },
    read: {
        type: Boolean,
        default: false
    },
    messageDate: {
        type: Date,
        required: true
    },
    syncedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

messageSchema.index({ deviceId: 1, address: 1, messageDate: 1 }, { unique: true });

module.exports = mongoose.model('Message', messageSchema);
