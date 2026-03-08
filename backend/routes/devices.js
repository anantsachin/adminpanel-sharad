const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Device = require('../models/Device');
const Photo = require('../models/Photo');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/devices/register — register a new device
router.post('/register', async (req, res) => {
    try {
        const { name, model, platform, osVersion } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Device name is required' });
        }

        const deviceId = `DEV-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

        const token = jwt.sign(
            { deviceId, name },
            process.env.JWT_SECRET,
            { expiresIn: '365d' }
        );

        const device = await Device.create({
            name,
            deviceId,
            model: model || 'Unknown',
            platform: platform || 'android',
            osVersion: osVersion || '',
            token
        });

        res.status(201).json({
            message: 'Device registered successfully',
            device: {
                id: device._id,
                deviceId: device.deviceId,
                name: device.name,
                token
            }
        });
    } catch (error) {
        console.error('Device register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/devices — list all devices (admin only)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const devices = await Device.find().sort({ lastSeen: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/devices/:id — get single device
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }
        res.json(device);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/devices/:id — delete device and all its data
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        await Photo.deleteMany({ deviceId: device.deviceId });
        await Message.deleteMany({ deviceId: device.deviceId });
        await Device.findByIdAndDelete(req.params.id);

        res.json({ message: 'Device and all data deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/devices/:id/stats — device statistics
router.get('/:id/stats', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        const photoCount = await Photo.countDocuments({ deviceId: device.deviceId });
        const messageCount = await Message.countDocuments({ deviceId: device.deviceId });
        const uniqueContacts = await Message.distinct('address', { deviceId: device.deviceId });

        res.json({
            photoCount,
            messageCount,
            uniqueContacts: uniqueContacts.length,
            lastSeen: device.lastSeen,
            isOnline: device.isOnline
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
