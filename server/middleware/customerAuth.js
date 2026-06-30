const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

// Protect customer routes - verify JWT token (customer-specific)
const protectCustomer = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if it's a customer token (has customerId flag)
        if (!decoded.isCustomer) {
            return res.status(401).json({ success: false, message: 'Not a customer token' });
        }

        req.customer = await Customer.findById(decoded.id);
        if (!req.customer) {
            return res.status(401).json({ success: false, message: 'Customer not found' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
    }
};

module.exports = { protectCustomer };
