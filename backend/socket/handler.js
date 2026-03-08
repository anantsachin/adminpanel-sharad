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
