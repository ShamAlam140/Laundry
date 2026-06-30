const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

// @desc    Sales report
// @route   GET /api/reports/sales
// @access  Private (Admin, Manager)
exports.getSalesReport = async (req, res, next) => {
    try {
        const { period = 'daily', startDate, endDate } = req.query;

        const matchStage = { status: { $ne: 'cancelled' } };
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
        }

        let dateFormat;
        switch (period) {
            case 'monthly': dateFormat = '%Y-%m'; break;
            case 'yearly': dateFormat = '%Y'; break;
            default: dateFormat = '%Y-%m-%d';
        }

        // Revenue over time
        const revenueOverTime = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Service-wise revenue
        const serviceRevenue = await Order.aggregate([
            { $match: matchStage },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.serviceType',
                    revenue: { $sum: '$items.subtotal' },
                    quantity: { $sum: '$items.quantity' },
                },
            },
            { $sort: { revenue: -1 } },
        ]);

        // Total summary
        const summary = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalOrders: { $sum: 1 },
                    avgOrderValue: { $avg: '$totalAmount' },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                revenueOverTime,
                serviceRevenue,
                summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Orders report
// @route   GET /api/reports/orders
// @access  Private (Admin, Manager)
exports.getOrdersReport = async (req, res, next) => {
    try {
        // Status distribution
        const statusDistribution = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
        ]);

        // Delayed orders (past delivery date, not packed)
        const delayedOrders = await Order.find({
            deliveryDate: { $lt: new Date() },
            status: { $nin: ['packed', 'cancelled'] },
        })
            .populate('customer', 'customerId name phone')
            .sort('-deliveryDate')
            .limit(20);

        // Orders per day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const ordersPerDay = await Order.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.status(200).json({
            success: true,
            data: { statusDistribution, delayedOrders, ordersPerDay },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Customer report
// @route   GET /api/reports/customers
// @access  Private (Admin, Manager)
exports.getCustomerReport = async (req, res, next) => {
    try {
        // Top customers by order count
        const topCustomers = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: '$customer',
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$totalAmount' },
                },
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            {
                $project: {
                    _id: 0,
                    customerId: '$customer.customerId',
                    name: '$customer.name',
                    phone: '$customer.phone',
                    customerType: '$customer.customerType',
                    totalOrders: 1,
                    totalSpent: 1,
                },
            },
        ]);

        // Customer type distribution
        const typeDistribution = await Customer.aggregate([
            {
                $group: {
                    _id: '$customerType',
                    count: { $sum: 1 },
                },
            },
        ]);

        // Outstanding balances
        const outstandingBalances = await Invoice.aggregate([
            { $match: { paymentStatus: { $ne: 'paid' } } },
            {
                $group: {
                    _id: '$customer',
                    totalDue: { $sum: '$balanceDue' },
                    invoiceCount: { $sum: 1 },
                },
            },
            { $sort: { totalDue: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            {
                $project: {
                    _id: 0,
                    customerId: '$customer.customerId',
                    name: '$customer.name',
                    totalDue: 1,
                    invoiceCount: 1,
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: { topCustomers, typeDistribution, outstandingBalances },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Staff performance report
// @route   GET /api/reports/staff
// @access  Private (Admin, Manager)
exports.getStaffReport = async (req, res, next) => {
    try {
        // Orders processed per staff
        const staffPerformance = await Order.aggregate([
            { $unwind: '$statusHistory' },
            {
                $group: {
                    _id: '$statusHistory.updatedBy',
                    actionsCount: { $sum: 1 },
                    uniqueOrders: { $addToSet: '$_id' },
                },
            },
            {
                $project: {
                    actionsCount: 1,
                    ordersProcessed: { $size: '$uniqueOrders' },
                },
            },
            { $sort: { ordersProcessed: -1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 0,
                    name: '$user.name',
                    role: '$user.role',
                    ordersProcessed: 1,
                    actionsCount: 1,
                },
            },
        ]);

        // Orders created per user
        const ordersCreated = await Order.aggregate([
            {
                $group: {
                    _id: '$createdBy',
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' },
                },
            },
            { $sort: { count: -1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 0,
                    name: '$user.name',
                    role: '$user.role',
                    ordersCreated: '$count',
                    revenue: 1,
                },
            },
        ]);

        // Average processing time per staff (time from their first action to order packed)
        const avgProcessingTime = await Order.aggregate([
            { $match: { status: 'packed' } },
            { $unwind: '$statusHistory' },
            {
                $group: {
                    _id: {
                        order: '$_id',
                        staff: '$statusHistory.updatedBy',
                    },
                    firstAction: { $min: '$statusHistory.timestamp' },
                    lastAction: { $max: '$statusHistory.timestamp' },
                    orderCreated: { $first: '$createdAt' },
                },
            },
            {
                $project: {
                    staff: '$_id.staff',
                    processingTimeMs: { $subtract: ['$lastAction', '$firstAction'] },
                },
            },
            {
                $group: {
                    _id: '$staff',
                    avgProcessingTimeMs: { $avg: '$processingTimeMs' },
                    ordersHandled: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 0,
                    name: '$user.name',
                    role: '$user.role',
                    ordersHandled: 1,
                    avgProcessingTimeHours: {
                        $round: [{ $divide: ['$avgProcessingTimeMs', 3600000] }, 1],
                    },
                },
            },
            { $sort: { avgProcessingTimeHours: 1 } },
        ]);

        // Overall average turnaround time (received → packed)
        const overallTurnaround = await Order.aggregate([
            { $match: { status: 'packed' } },
            {
                $project: {
                    turnaroundMs: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            {
                $group: {
                    _id: null,
                    avgTurnaroundMs: { $avg: '$turnaroundMs' },
                    totalDelivered: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    avgTurnaroundHours: {
                        $round: [{ $divide: ['$avgTurnaroundMs', 3600000] }, 1],
                    },
                    totalDelivered: 1,
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                staffPerformance,
                ordersCreated,
                avgProcessingTime,
                overallTurnaround: overallTurnaround[0] || { avgTurnaroundHours: 0, totalDelivered: 0 },
            },
        });
    } catch (error) {
        next(error);
    }
};

