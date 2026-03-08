const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, access denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

const deviceAuthMiddleware = (req, res, next) => {
    const token = req.header('X-Device-Token');

    if (!token) {
        return res.status(401).json({ message: 'No device token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.device = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid device token' });
    }
};

module.exports = { authMiddleware, deviceAuthMiddleware };
