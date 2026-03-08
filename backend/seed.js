require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Device = require('./models/Device');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create admin
        const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
        if (!existingAdmin) {
            await Admin.create({
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD
            });
            console.log(`✅ Admin created: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
        } else {
            console.log('ℹ️  Admin already exists');
        }

        // Create sample devices for testing
        const sampleDevices = [
            { name: 'Samsung Galaxy S24', model: 'SM-S926B', platform: 'android', osVersion: '14' },
            { name: 'Pixel 8 Pro', model: 'Pixel 8 Pro', platform: 'android', osVersion: '14' },
            { name: 'OnePlus 12', model: 'CPH2583', platform: 'android', osVersion: '14' }
        ];

        for (const dev of sampleDevices) {
            const deviceId = `DEV-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
            const existing = await Device.findOne({ name: dev.name });
            if (!existing) {
                const token = jwt.sign({ deviceId, name: dev.name }, process.env.JWT_SECRET, { expiresIn: '365d' });
                await Device.create({ ...dev, deviceId, token });
                console.log(`✅ Device created: ${dev.name} (${deviceId})`);
            } else {
                console.log(`ℹ️  Device already exists: ${dev.name}`);
            }
        }

        console.log('\n🎉 Seed complete!');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
}

seed();
