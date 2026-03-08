const jwt = require('jsonwebtoken');
const Device = require('../models/Device');

const setupSocket = (io) => {
    // Middleware for authentication
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            const role = socket.handshake.auth.role;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            socket.role = role || 'device';
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const { role } = socket;

        if (role === 'admin') {
            // Admin connected
            socket.join('admins');
            console.log(`🔵 Admin connected: ${socket.user.email}`);

            socket.on('disconnect', () => {
                console.log(`🔴 Admin disconnected: ${socket.user.email}`);
            });
        } else {
            // Device connected
            const deviceId = socket.user.deviceId;
            socket.join(`device:${deviceId}`);
            console.log(`📱 Device connected: ${deviceId}`);

            // Mark device online
            await Device.findOneAndUpdate(
                { deviceId },
                { isOnline: true, lastSeen: Date.now() }
            );

            // Notify admins
            io.to('admins').emit('device:online', { deviceId });

            // Handle device info update
            socket.on('device:info', async (data) => {
                await Device.findOneAndUpdate({ deviceId }, {
                    batteryLevel: data.batteryLevel,
                    model: data.model,
                    osVersion: data.osVersion,
                    lastSeen: Date.now()
                });
                io.to('admins').emit('device:info-updated', { deviceId, ...data });
            });

            // Handle device heartbeat
            socket.on('device:heartbeat', async () => {
                await Device.findOneAndUpdate({ deviceId }, { lastSeen: Date.now() });
            });

            // Handle SMS sent confirmation
            socket.on('device:sms-sent', async (data) => {
                console.log(`📤 SMS sent from device ${deviceId} to ${data.to}`);
                try {
                    const device = await Device.findOne({ deviceId });
                    if (device) {
                        const Message = require('../models/Message');
                        await Message.create({
                            device: device._id,
                            deviceId: device.deviceId,
                            address: data.to,
                            contactName: data.contactName || '',
                            body: data.message,
                            type: 'sent',
                            read: true,
                            messageDate: new Date()
                        });
                        const totalMessages = await Message.countDocuments({ deviceId });
                        await Device.findByIdAndUpdate(device._id, { messageCount: totalMessages });
                    }
                } catch (err) {
                    console.error('Error saving sent SMS:', err.message);
                }
                io.to('admins').emit('data:sms-sent', {
                    deviceId,
                    to: data.to,
                    message: data.message,
                    timestamp: Date.now()
                });
            });

            // Handle incoming SMS forwarded from device
            socket.on('device:sms-received', async (data) => {
                console.log(`📥 SMS received on device ${deviceId} from ${data.from}`);
                try {
                    const device = await Device.findOne({ deviceId });
                    if (device) {
                        const Message = require('../models/Message');
                        await Message.create({
                            device: device._id,
                            deviceId: device.deviceId,
                            address: data.from,
                            contactName: data.contactName || '',
                            body: data.body,
                            type: 'inbox',
                            read: false,
                            messageDate: new Date(data.date || Date.now())
                        });
                        const totalMessages = await Message.countDocuments({ deviceId });
                        await Device.findByIdAndUpdate(device._id, { messageCount: totalMessages });
                    }
                } catch (err) {
                    console.error('Error saving received SMS:', err.message);
                }
                io.to('admins').emit('data:sms-received', {
                    deviceId,
                    from: data.from,
                    contactName: data.contactName || '',
                    body: data.body,
                    timestamp: Date.now()
                });
            });

            // Handle SMS send failure
            socket.on('device:sms-failed', (data) => {
                console.log(`❌ SMS send failed on device ${deviceId}: ${data.error}`);
                io.to('admins').emit('data:sms-failed', {
                    deviceId,
                    to: data.to,
                    error: data.error,
                    timestamp: Date.now()
                });
            });

            // Handle disconnect
            socket.on('disconnect', async () => {
                console.log(`📱 Device disconnected: ${deviceId}`);
                await Device.findOneAndUpdate(
                    { deviceId },
                    { isOnline: false, lastSeen: Date.now() }
                );
                io.to('admins').emit('device:offline', { deviceId });
            });
        }
    });
};

module.exports = setupSocket;
