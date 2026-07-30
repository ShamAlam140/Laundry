const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');

// Generate JWT token with customer flag
const generateToken = (id) => {
    return jwt.sign({ id, isCustomer: true }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

// @desc    Register customer
// @route   POST /api/customer-auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, phone, email, address, password } = req.body;

        if (!name || !phone || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, phone, email, and password are required',
            });
        }

        // Check if customer with this phone already exists
        const existing = await Customer.findOne({ phone }).select('+password');
        if (existing && existing.password) {
            return res.status(400).json({
                success: false,
                message: 'An account with this phone number already exists',
            });
        }

        let customer;
        if (existing && !existing.password) {
            // Customer was created by staff but has no password — set password
            existing.password = password;
            if (email) existing.email = email;
            if (address) existing.address = address;
            await existing.save();
            customer = existing;
        } else {
            // Brand new customer
            customer = await Customer.create({
                name,
                phone,
                email,
                address,
                password,
                customerType: 'walk-in',
            });
        }

        const token = generateToken(customer._id);

        res.status(201).json({
            success: true,
            token,
            data: {
                _id: customer._id,
                customerId: customer.customerId,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                customerType: customer.customerType,
                isPremium: customer.isPremium,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login customer
// @route   POST /api/customer-auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide phone number and password',
            });
        }

        const customer = await Customer.findOne({ phone }).select('+password');

        if (!customer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!customer.password) {
            return res.status(401).json({
                success: false,
                message: 'No password set. Please register first.',
            });
        }

        const isMatch = await customer.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(customer._id);

        res.status(200).json({
            success: true,
            token,
            data: {
                _id: customer._id,
                customerId: customer.customerId,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                customerType: customer.customerType,
                isPremium: customer.isPremium,
                mustChangePassword: customer.mustChangePassword,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get logged-in customer profile
// @route   GET /api/customer-auth/me
// @access  Private (Customer)
exports.getMe = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: req.customer });
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer profile
// @route   PUT /api/customer-auth/profile
// @access  Private (Customer)
exports.updateProfile = async (req, res, next) => {
    try {
        const { name, email, address } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (address) updates.address = address;

        const customer = await Customer.findByIdAndUpdate(req.customer._id, updates, {
            returnDocument: 'after',
            runValidators: true,
        });

        res.status(200).json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
};

// @desc    Change password
// @route   PUT /api/customer-auth/change-password
// @access  Private (Customer)
exports.changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both old and new passwords',
            });
        }

        const customer = await Customer.findById(req.customer._id).select('+password');

        const isMatch = await customer.matchPassword(oldPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid old password' });
        }

        customer.password = newPassword;
        customer.mustChangePassword = false;
        await customer.save();

        const token = generateToken(customer._id);

        res.status(200).json({ success: true, token, message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Forgot password - reset to default
// @route   POST /api/customer-auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Please provide phone number' });
        }

        const customer = await Customer.findOne({ phone });
        if (!customer) {
            // We return success to prevent user enumeration
            return res.status(200).json({ success: true, message: 'If an account exists, its password has been reset to default.' });
        }

        customer.password = 'cus123';
        customer.mustChangePassword = true;
        await customer.save();

        res.status(200).json({ success: true, message: 'Your password has been successfully reset to the default password.' });
    } catch (error) {
        next(error);
    }
};
