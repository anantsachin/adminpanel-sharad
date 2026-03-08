const express = require('express');
const Message = require('../models/Message');
const Device = require('../models/Device');
const { authMiddleware, deviceAuthMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/messages/sync — device syncs messages
router.post('/sync', deviceAuthMiddleware, async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ message: 'Messages array is required' });
        }

        const device = await Device.findOne({ deviceId: req.device.deviceId });
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        let synced = 0;
        let skipped = 0;

        for (const msg of messages) {
            try {
                await Message.create({
                    device: device._id,
                    deviceId: device.deviceId,
                    address: msg.address || 'Unknown',
                    contactName: msg.contactName || '',
                    body: msg.body || '',
                    type: msg.type || 'inbox',
                    read: msg.read || false,
                    messageDate: new Date(msg.date || Date.now())
                });
                synced++;
            } catch (err) {
                // Duplicate — skip
                if (err.code === 11000) {
                    skipped++;
                } else {
                    console.error('Message sync error:', err.message);
                }
            }
        }

        // Update device message count
        const totalMessages = await Message.countDocuments({ deviceId: device.deviceId });
        await Device.findByIdAndUpdate(device._id, {
            messageCount: totalMessages,
            lastSeen: Date.now()
        });

        // Emit to admin
        if (req.app.get('io')) {
            req.app.get('io').to('admins').emit('data:messages-synced', {
                deviceId: device.deviceId,
                deviceName: device.name,
                synced,
                skipped,
                total: totalMessages
            });
        }

        res.json({ message: 'Messages synced', synced, skipped, total: totalMessages });
    } catch (error) {
        console.error('Message sync error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/messages/send — admin sends SMS through a device
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { deviceId, to, message } = req.body;

        if (!deviceId || !to || !message) {
            return res.status(400).json({ message: 'deviceId, to, and message are required' });
        }

        const device = await Device.findOne({ deviceId });
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        if (!device.isOnline) {
            return res.status(400).json({ message: 'Device is offline. Cannot send SMS.' });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`device:${deviceId}`).emit('command:send-sms', {
                command: 'send-sms',
                params: { to, message },
                timestamp: Date.now()
            });
        }

        res.json({ message: `SMS command sent to ${device.name}`, deviceId, to });
    } catch (error) {
        console.error('Send SMS error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/messages — get messages (admin, with pagination & filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { deviceId, address, type, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (address) filter.address = address;
        if (type) filter.type = type;
        if (search) {
            filter.$or = [
                { body: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
                { contactName: { $regex: search, $options: 'i' } }
            ];
        }

        const messages = await Message.find(filter)
            .populate('device', 'name deviceId')
            .sort({ messageDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Message.countDocuments(filter);

        res.json({
            messages,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/messages/conversations/:deviceId — get conversations grouped by contact
router.get('/conversations/:deviceId', authMiddleware, async (req, res) => {
    try {
        const conversations = await Message.aggregate([
            { $match: { deviceId: req.params.deviceId } },
            { $sort: { messageDate: -1 } },
            {
                $group: {
                    _id: '$address',
                    contactName: { $first: '$contactName' },
                    lastMessage: { $first: '$body' },
                    lastDate: { $first: '$messageDate' },
                    messageCount: { $sum: 1 },
                    unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } }
                }
            },
            { $sort: { lastDate: -1 } }
        ]);

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/messages/thread — get message thread between device and a contact
router.get('/thread', authMiddleware, async (req, res) => {
    try {
        const { deviceId, address, page = 1, limit = 100 } = req.query;

        if (!deviceId || !address) {
            return res.status(400).json({ message: 'deviceId and address are required' });
        }

        const messages = await Message.find({ deviceId, address })
            .sort({ messageDate: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Message.countDocuments({ deviceId, address });

        res.json({ messages, total });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/messages/:id — delete a message
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const message = await Message.findByIdAndDelete(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        await Device.findOneAndUpdate(
            { deviceId: message.deviceId },
            { $inc: { messageCount: -1 } }
        );

        res.json({ message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
