const express = require('express');
const Device = require('../models/Device');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/commands/:deviceId — send command to device
router.post('/:deviceId', authMiddleware, async (req, res) => {
    try {
        const { command, params } = req.body;
        const { deviceId } = req.params;

        const device = await Device.findOne({ deviceId });
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        if (!device.isOnline) {
            return res.status(400).json({ message: 'Device is offline. Command will be queued.' });
        }

        const validCommands = ['capture-photo', 'sync-messages', 'get-info', 'ping', 'send-sms'];
        if (!validCommands.includes(command)) {
            return res.status(400).json({ message: `Invalid command. Valid: ${validCommands.join(', ')}` });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`device:${deviceId}`).emit(`command:${command}`, {
                command,
                params: params || {},
                timestamp: Date.now()
            });
        }

        res.json({ message: `Command '${command}' sent to ${device.name}`, deviceId });
    } catch (error) {
        console.error('Command error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
