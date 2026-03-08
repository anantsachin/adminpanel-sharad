require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const setupSocket = require('./socket/handler');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Make io accessible in routes
app.set('io', io);

// Setup socket handlers
setupSocket(io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/commands', require('./routes/commands'));

// Dashboard stats endpoint
app.get('/api/dashboard', async (req, res) => {
    try {
        const Device = require('./models/Device');
        const Photo = require('./models/Photo');
        const Message = require('./models/Message');

        const totalDevices = await Device.countDocuments();
        const onlineDevices = await Device.countDocuments({ isOnline: true });
        const totalPhotos = await Photo.countDocuments();
        const totalMessages = await Message.countDocuments();

        const recentPhotos = await Photo.find()
            .populate('device', 'name deviceId')
            .sort({ createdAt: -1 })
            .limit(6);

        const recentDevices = await Device.find()
            .sort({ lastSeen: -1 })
            .limit(10);

        res.json({
            totalDevices,
            onlineDevices,
            totalPhotos,
            totalMessages,
            recentPhotos,
            recentDevices
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   Device Manager Server                      ║
║   Running on http://localhost:${PORT}          ║
║   Socket.IO enabled                          ║
╚══════════════════════════════════════════════╝
  `);
});
