const Delivery = require('../models/Delivery');
const Order = require('../models/Order');

// Generate 4-digit OTP
const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));

// @desc    Create delivery/pickup
// @route   POST /api/deliveries
// @access  Private (Admin, Manager, Cashier)
exports.createDelivery = async (req, res, next) => {
    try {
        const { order: orderId, type, scheduledDate, scheduledTime, assignedStaff, address, notes } = req.body;

        const order = await Order.findById(orderId).populate('customer', '_id name address');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Generate 4-digit OTP for delivery confirmation
        const deliveryOtp = generateOtp();

        const delivery = await Delivery.create({
            order: orderId,
            customer: order.customer._id,
            type,
            scheduledDate,
            scheduledTime,
            assignedStaff,
            address: address || order.customer.address || '',
            notes,
            deliveryOtp,
            otpGeneratedAt: new Date(),
            createdBy: req.user._id,
        });

        const populated = await Delivery.findById(delivery._id)
            .populate('order', 'orderId status totalAmount')
            .populate('customer', 'customerId name phone address')
            .populate('assignedStaff', 'name')
            .populate('createdBy', 'name');

        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all deliveries
// @route   GET /api/deliveries
// @access  Private
exports.getDeliveries = async (req, res, next) => {
    try {
        const { status, type, date, staff, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (type) filter.type = type;
        if (staff) filter.assignedStaff = staff;

        if (date) {
            const d = new Date(date);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            filter.scheduledDate = { $gte: d, $lt: next };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [deliveries, total] = await Promise.all([
            Delivery.find(filter)
                .populate('order', 'orderId status totalAmount')
                .populate('customer', 'customerId name phone address')
                .populate('assignedStaff', 'name')
                .sort('scheduledDate')
                .skip(skip)
                .limit(parseInt(limit)),
            Delivery.countDocuments(filter),
        ]);

        res.status(200).json({ success: true, count: deliveries.length, total, data: deliveries });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single delivery
// @route   GET /api/deliveries/:id
// @access  Private
exports.getDelivery = async (req, res, next) => {
    try {
        const delivery = await Delivery.findById(req.params.id)
            .populate('order', 'orderId status totalAmount items')
            .populate('customer', 'customerId name phone address')
            .populate('assignedStaff', 'name')
            .populate('createdBy', 'name')
            .populate('confirmedBy', 'name');

        if (!delivery) {
            return res.status(404).json({ success: false, message: 'Delivery not found' });
        }
        res.status(200).json({ success: true, data: delivery });
    } catch (error) {
        next(error);
    }
};

// @desc    Update delivery status (not for completion — use confirmDelivery for that)
// @route   PATCH /api/deliveries/:id/status
// @access  Private
exports.updateDeliveryStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            return res.status(404).json({ success: false, message: 'Delivery not found' });
        }

        // For completion, require OTP confirmation
        if (status === 'completed' && !delivery.otpVerified) {
            return res.status(400).json({
                success: false,
                message: 'OTP verification required to complete delivery. Use the confirm endpoint.',
            });
        }

        delivery.status = status;
        if (status === 'completed') {
            delivery.completedAt = new Date();
        }
        await delivery.save();

        const populated = await Delivery.findById(delivery._id)
            .populate('order', 'orderId status')
            .populate('customer', 'customerId name phone')
            .populate('assignedStaff', 'name');

        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Confirm delivery with OTP + optional signature
// @route   POST /api/deliveries/:id/confirm
// @access  Private
exports.confirmDelivery = async (req, res, next) => {
    try {
        const { otp, signature } = req.body;
        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            return res.status(404).json({ success: false, message: 'Delivery not found' });
        }

        if (delivery.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Delivery already completed' });
        }

        // Verify OTP
        if (!otp || otp !== delivery.deliveryOtp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP code' });
        }

        // Check OTP expiry (30 minutes)
        const otpAge = Date.now() - new Date(delivery.otpGeneratedAt).getTime();
        if (otpAge > 30 * 60 * 1000) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please regenerate.' });
        }

        // Update delivery
        delivery.otpVerified = true;
        delivery.status = 'completed';
        delivery.completedAt = new Date();
        delivery.confirmedBy = req.user._id;

        if (signature) {
            delivery.signature = signature;
        }

        await delivery.save();

        const populated = await Delivery.findById(delivery._id)
            .populate('order', 'orderId status')
            .populate('customer', 'customerId name phone')
            .populate('assignedStaff', 'name')
            .populate('confirmedBy', 'name');

        res.status(200).json({
            success: true,
            message: 'Delivery confirmed successfully',
            data: populated,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Regenerate OTP for delivery
// @route   POST /api/deliveries/:id/regenerate-otp
// @access  Private
exports.regenerateOtp = async (req, res, next) => {
    try {
        const delivery = await Delivery.findById(req.params.id);

        if (!delivery) {
            return res.status(404).json({ success: false, message: 'Delivery not found' });
        }

        if (delivery.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Delivery already completed' });
        }

        delivery.deliveryOtp = generateOtp();
        delivery.otpGeneratedAt = new Date();
        delivery.otpVerified = false;
        await delivery.save();

        res.status(200).json({
            success: true,
            message: 'New OTP generated',
            data: { deliveryOtp: delivery.deliveryOtp },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Assign staff
// @route   PATCH /api/deliveries/:id/assign
// @access  Private (Admin, Manager)
exports.assignStaff = async (req, res, next) => {
    try {
        const { staffId } = req.body;
        const delivery = await Delivery.findByIdAndUpdate(
            req.params.id,
            { assignedStaff: staffId },
            { returnDocument: 'after' }
        )
            .populate('order', 'orderId status')
            .populate('customer', 'customerId name phone')
            .populate('assignedStaff', 'name');

        if (!delivery) {
            return res.status(404).json({ success: false, message: 'Delivery not found' });
        }

        res.status(200).json({ success: true, data: delivery });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete delivery
// @route   DELETE /api/deliveries/:id
// @access  Private (Admin)
exports.deleteDelivery = async (req, res, next) => {
    try {
        const delivery = await Delivery.findByIdAndDelete(req.params.id);
        if (!delivery) {
            return res.status(404).json({ success: false, message: 'Delivery not found' });
        }
        res.status(200).json({ success: true, message: 'Delivery deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get today's schedule summary
// @route   GET /api/deliveries/today
// @access  Private
exports.getTodaySchedule = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const deliveries = await Delivery.find({
            scheduledDate: { $gte: today, $lt: tomorrow },
        })
            .populate('order', 'orderId status totalAmount')
            .populate('customer', 'customerId name phone address')
            .populate('assignedStaff', 'name')
            .sort('scheduledTime');

        const summary = {
            total: deliveries.length,
            pickups: deliveries.filter((d) => d.type === 'pickup').length,
            deliveriesCount: deliveries.filter((d) => d.type === 'delivery').length,
            completed: deliveries.filter((d) => d.status === 'completed').length,
            pending: deliveries.filter((d) => d.status === 'scheduled').length,
        };

        res.status(200).json({ success: true, data: deliveries, summary });
    } catch (error) {
        next(error);
    }
};

