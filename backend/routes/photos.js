const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Photo = require('../models/Photo');
const Device = require('../models/Device');
const { authMiddleware, deviceAuthMiddleware } = require('../middleware/auth');
const router = express.Router();

// Multer config for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'photos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|bmp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype);
        if (extOk && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// POST /api/photos/upload — device uploads a photo
router.post('/upload', deviceAuthMiddleware, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No photo uploaded' });
        }

        const device = await Device.findOne({ deviceId: req.device.deviceId });
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        const photo = await Photo.create({
            device: device._id,
            deviceId: device.deviceId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: `/uploads/photos/${req.file.filename}`,
            source: req.body.source || 'command',
            metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
        });

        // Update device photo count
        await Device.findByIdAndUpdate(device._id, {
            $inc: { photoCount: 1 },
            lastSeen: Date.now()
        });

        // Emit to admin via socket
        if (req.app.get('io')) {
            req.app.get('io').to('admins').emit('data:photo-uploaded', {
                deviceId: device.deviceId,
                deviceName: device.name,
                photo
            });
        }

        res.status(201).json({ message: 'Photo uploaded', photo });
    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/photos — get all photos (admin, with pagination & filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { deviceId, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (deviceId) filter.deviceId = deviceId;

        const photos = await Photo.find(filter)
            .populate('device', 'name deviceId')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Photo.countDocuments(filter);

        res.json({
            photos,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/photos/:id — get single photo
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id).populate('device', 'name deviceId');
        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }
        res.json(photo);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/photos/:id — delete a photo
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }

        // Delete file from disk
        const filePath = path.join(__dirname, '..', photo.path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Photo.findByIdAndDelete(req.params.id);

        // Update device photo count
        await Device.findOneAndUpdate(
            { deviceId: photo.deviceId },
            { $inc: { photoCount: -1 } }
        );

        res.json({ message: 'Photo deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
