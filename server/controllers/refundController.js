const mongoose = require('mongoose');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Refund = require('../models/Refund');
const Settings = require('../models/Settings');
const RefundValidatorService = require('../utils/refundValidatorService');
const RefundRecommenderService = require('../utils/refundRecommenderService');

// Import RefundCounter for manual ID generation
const RefundCounter = mongoose.model('RefundCounter');

// @desc    Process full order refund
// @route   POST /api/refunds/full
// @access  Private (Admin, Manager)
exports.processFullRefund = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId, reason, reasonDescription, refundAmount, notes } = req.body;

        // Validate refund reason
        const reasonValidation = RefundValidatorService.validateRefundReason(reason, reasonDescription);
        if (!reasonValidation.valid) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid refund reason',
                    details: reasonValidation.errors,
                },
            });
        }

        // Find order
        const order = await Order.findById(orderId).populate('customer').session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Order not found',
                },
            });
        }

        // Validate refund request
        const validation = await RefundValidatorService.validateFullRefund(order, refundAmount);
        if (!validation.valid) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: {
                    code: 'BUSINESS_RULE_VIOLATION',
                    message: 'Refund validation failed',
                    details: validation.errors,
                },
            });
        }

        // Check if admin approval required
        if (RefundValidatorService.requiresAdminApproval(order) && req.user.role !== 'admin') {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin approval required for refunds on orders delivered more than 30 days ago',
                },
            });
        }

        // Find invoice
        const invoice = await Invoice.findOne({ order: order._id }).session(session);
        if (!invoice) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Invoice not found for this order',
                },
            });
        }

        // Create refund record
        console.log('Creating full refund record...');
        let refund;
        try {
            // Generate refundId manually to avoid validation issues
            const counter = await RefundCounter.findByIdAndUpdate(
                'refundId',
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            ).session(session);
            const refundId = `REF-${String(counter.seq).padStart(4, '0')}`;
            
            const refundData = {
                refundId,
                order: order._id,
                invoice: invoice._id,
                customer: order.customer._id,
                refundType: 'full',
                totalRefundAmount: refundAmount,
                fullOrderReason: reason,
                fullOrderReasonDescription: reasonDescription,
                processedBy: req.user._id,
                processedByName: req.user.name,
                ipAddress: req.ip,
                notes,
            };
            
            refund = new Refund(refundData);
            await refund.save({ session });
            console.log('Full refund created successfully:', refund.refundId);
        } catch (refundError) {
            console.log('Full refund creation failed:', refundError);
            throw refundError;
        }

        // Update order
        order.totalRefundAmount = (order.totalRefundAmount || 0) + refundAmount;
        order.hasRefund = true;
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            updatedBy: req.user._id,
            note: `Full refund processed: ${refundAmount} (Reason: ${reason})`,
        });
        await order.save({ session });

        // Update invoice
        invoice.refundLineItems.push({
            refund: refund._id,
            description: `Refund - ${reason}`,
            amount: -refundAmount,
            refundDate: new Date(),
        });
        invoice.totalRefundAmount = (invoice.totalRefundAmount || 0) + refundAmount;
        invoice.balanceDue = invoice.totalAmount - invoice.paidAmount - invoice.totalRefundAmount;

        // Update payment status
        if (invoice.totalRefundAmount >= invoice.totalAmount) {
            invoice.paymentStatus = 'refunded';
        } else if (invoice.balanceDue > 0) {
            invoice.paymentStatus = 'partial';
        }

        // Handle credit balance
        if (invoice.balanceDue < 0) {
            invoice.creditBalance = Math.abs(invoice.balanceDue);
            
            // Update customer credit balance
            const customer = await Customer.findById(order.customer._id).session(session);
            if (customer) {
                customer.creditBalance = (customer.creditBalance || 0) + invoice.creditBalance;
                await customer.save({ session });
            }
        }

        await invoice.save({ session });

        await session.commitTransaction();

        // Populate refund for response
        const populatedRefund = await Refund.findById(refund._id)
            .populate('order', 'orderId totalAmount')
            .populate('customer', 'customerId name phone')
            .populate('processedBy', 'name');

        res.status(201).json({
            success: true,
            data: {
                refund: populatedRefund,
                updatedInvoice: invoice,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

// @desc    Process partial item-level refund
// @route   POST /api/refunds/partial
// @access  Private (Admin, Manager)
exports.processPartialRefund = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId, items, notes } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Items array is required for partial refund',
                },
            });
        }

        // Validate refund reasons for all items
        for (const item of items) {
            const reasonValidation = RefundValidatorService.validateRefundReason(
                item.reason,
                item.reasonDescription
            );
            if (!reasonValidation.valid) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid refund reason for item ${item.itemId}`,
                        details: reasonValidation.errors,
                    },
                });
            }
        }

        // Find order
        const order = await Order.findById(orderId).populate('customer').session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Order not found',
                },
            });
        }

        // Validate refund request
        const validation = await RefundValidatorService.validatePartialRefund(order, items);
        if (!validation.valid) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: {
                    code: 'BUSINESS_RULE_VIOLATION',
                    message: 'Refund validation failed',
                    details: validation.errors,
                },
            });
        }

        // Check if admin approval required
        if (RefundValidatorService.requiresAdminApproval(order) && req.user.role !== 'admin') {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin approval required for refunds on orders delivered more than 30 days ago',
                },
            });
        }

        // Find invoice
        const invoice = await Invoice.findOne({ order: order._id }).session(session);
        if (!invoice) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Invoice not found for this order',
                },
            });
        }

        // Calculate total refund amount
        const totalRefundAmount = items.reduce((sum, item) => sum + item.refundAmount, 0);

        // Prepare refunded items array
        const refundedItems = items.map(item => {
            const orderItem = order.items.id(item.itemId);
            return {
                orderItemId: item.itemId,
                itemName: orderItem.itemName || orderItem.serviceName,
                itemType: orderItem.itemType,
                quantity: item.damagedQuantity || orderItem.quantity, // Add refunded quantity
                refundAmount: item.refundAmount,
                refundReason: item.reason,
                refundReasonDescription: item.reasonDescription,
            };
        });

        // Create refund record
        console.log('Creating refund record...');
        let refund;
        try {
            // Generate refundId manually to avoid validation issues
            const counter = await RefundCounter.findByIdAndUpdate(
                'refundId',
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            ).session(session);
            const refundId = `REF-${String(counter.seq).padStart(4, '0')}`;
            
            const refundData = {
                refundId,
                order: order._id,
                invoice: invoice._id,
                customer: order.customer._id,
                refundType: 'partial',
                totalRefundAmount,
                refundedItems,
                processedBy: req.user._id,
                processedByName: req.user.name,
                ipAddress: req.ip,
                notes,
            };
            
            refund = new Refund(refundData);
            await refund.save({ session });
            console.log('Refund created successfully:', refund.refundId);
        } catch (refundError) {
            console.log('Refund creation failed:', refundError);
            throw refundError;
        }

        // Update each refunded item in order
        for (const item of items) {
            const orderItem = order.items.id(item.itemId);
            if (orderItem) {
                orderItem.isRefunded = true;
                orderItem.refundAmount = (orderItem.refundAmount || 0) + item.refundAmount;
                orderItem.refundReason = item.reason;
                orderItem.refundReasonDescription = item.reasonDescription;
                orderItem.damagedQuantity = item.damagedQuantity; // Save the damaged/refunded quantity
            }
        }

        // Update order
        order.totalRefundAmount = (order.totalRefundAmount || 0) + totalRefundAmount;
        order.hasRefund = true;
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            updatedBy: req.user._id,
            note: `Partial refund processed: ${totalRefundAmount} for ${items.length} item(s)`,
        });
        await order.save({ session });

        // Update invoice
        invoice.refundLineItems.push({
            refund: refund._id,
            description: `Partial Refund - ${items.length} item(s)`,
            amount: -totalRefundAmount,
            refundDate: new Date(),
        });
        invoice.totalRefundAmount = (invoice.totalRefundAmount || 0) + totalRefundAmount;
        invoice.balanceDue = invoice.totalAmount - invoice.paidAmount - invoice.totalRefundAmount;

        // Update payment status
        if (invoice.totalRefundAmount >= invoice.totalAmount) {
            invoice.paymentStatus = 'refunded';
        } else if (invoice.balanceDue > 0) {
            invoice.paymentStatus = 'partial';
        }

        // Handle credit balance
        if (invoice.balanceDue < 0) {
            invoice.creditBalance = Math.abs(invoice.balanceDue);
            
            // Update customer credit balance
            const customer = await Customer.findById(order.customer._id).session(session);
            if (customer) {
                customer.creditBalance = (customer.creditBalance || 0) + invoice.creditBalance;
                await customer.save({ session });
            }
        }

        await invoice.save({ session });

        await session.commitTransaction();

        // Populate refund for response
        const populatedRefund = await Refund.findById(refund._id)
            .populate('order', 'orderId totalAmount')
            .populate('customer', 'customerId name phone')
            .populate('processedBy', 'name');

        res.status(201).json({
            success: true,
            data: {
                refund: populatedRefund,
                updatedInvoice: invoice,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

// @desc    Get all refunds with filters
// @route   GET /api/refunds
// @access  Private (Admin, Manager)
exports.getRefunds = async (req, res, next) => {
    try {
        const {
            startDate,
            endDate,
            reason,
            itemType,
            customerId,
            processedBy,
            page = 1,
            limit = 20,
        } = req.query;

        const filter = {};

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        if (reason) {
            filter.$or = [
                { fullOrderReason: reason },
                { 'refundedItems.refundReason': reason },
            ];
        }

        if (itemType) {
            filter['refundedItems.itemType'] = itemType;
        }

        if (customerId) filter.customer = customerId;
        if (processedBy) filter.processedBy = processedBy;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Refund.countDocuments(filter);
        const refunds = await Refund.find(filter)
            .populate('order', 'orderId totalAmount')
            .populate('customer', 'customerId name phone')
            .populate('invoice', 'invoiceId totalAmount')
            .populate('processedBy', 'name')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: refunds.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: refunds,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get refund by ID
// @route   GET /api/refunds/:id
// @access  Private
exports.getRefundById = async (req, res, next) => {
    try {
        const refund = await Refund.findById(req.params.id)
            .populate('order')
            .populate('customer')
            .populate('invoice')
            .populate('processedBy', 'name email');

        if (!refund) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Refund not found',
                },
            });
        }

        res.status(200).json({ success: true, data: refund });
    } catch (error) {
        next(error);
    }
};

// @desc    Get refunds for a specific order
// @route   GET /api/refunds/order/:orderId
// @access  Private
exports.getRefundsByOrder = async (req, res, next) => {
    try {
        const refunds = await Refund.find({ order: req.params.orderId })
            .populate('processedBy', 'name')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: refunds.length,
            data: refunds,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get refund recommendations
// @route   GET /api/refunds/recommendations
// @access  Private (Admin, Manager)
exports.getRefundRecommendations = async (req, res, next) => {
    try {
        const recommendations = await RefundRecommenderService.getPendingRecommendations();

        res.status(200).json({
            success: true,
            count: recommendations.length,
            data: recommendations,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get refund analytics
// @route   GET /api/refunds/reports/analytics
// @access  Private (Admin, Manager)
exports.getRefundAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const filter = {};

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Total refunds
        const totalRefunds = await Refund.countDocuments(filter);
        const totalRefundAmountAgg = await Refund.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$totalRefundAmount' } } },
        ]);
        const totalRefundAmount = totalRefundAmountAgg[0]?.total || 0;

        // Refund by reason - separate full and partial refunds
        const fullRefundsByReason = await Refund.aggregate([
            { $match: { ...filter, refundType: 'full' } },
            {
                $group: {
                    _id: '$fullOrderReason',
                    count: { $sum: 1 },
                    amount: { $sum: '$totalRefundAmount' },
                },
            },
        ]);

        const partialRefundsByReason = await Refund.aggregate([
            { $match: { ...filter, refundType: 'partial' } },
            { $unwind: '$refundedItems' },
            {
                $group: {
                    _id: '$refundedItems.refundReason',
                    count: { $sum: 1 },
                    amount: { $sum: '$refundedItems.refundAmount' },
                },
            },
        ]);

        // Combine and aggregate refund reasons
        const refundByReasonMap = new Map();
        
        [...fullRefundsByReason, ...partialRefundsByReason].forEach(item => {
            const reason = item._id || 'Unknown';
            if (refundByReasonMap.has(reason)) {
                const existing = refundByReasonMap.get(reason);
                existing.count += item.count;
                existing.amount += item.amount;
            } else {
                refundByReasonMap.set(reason, {
                    _id: reason,
                    count: item.count,
                    amount: item.amount,
                });
            }
        });

        const refundByReason = Array.from(refundByReasonMap.values());

        // Refund by item type
        const refundByItemType = await Refund.aggregate([
            { $match: { ...filter, refundType: 'partial' } },
            { $unwind: '$refundedItems' },
            {
                $group: {
                    _id: '$refundedItems.itemType',
                    count: { $sum: 1 },
                    amount: { $sum: '$refundedItems.refundAmount' },
                },
            },
        ]);

        // Calculate refund rate
        const totalOrdersAgg = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        const totalOrderAmount = totalOrdersAgg[0]?.total || 1;
        const refundRate = ((totalRefundAmount / totalOrderAmount) * 100).toFixed(2);

        // Top refunded items
        const topRefundedItems = await Refund.aggregate([
            { $match: { ...filter, refundType: 'partial' } },
            { $unwind: '$refundedItems' },
            {
                $group: {
                    _id: '$refundedItems.itemName',
                    frequency: { $sum: 1 },
                    totalAmount: { $sum: '$refundedItems.refundAmount' },
                },
            },
            { $sort: { frequency: -1, totalAmount: -1 } },
            { $limit: 10 },
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalRefunds,
                totalRefundAmount,
                refundRate: parseFloat(refundRate),
                refundByReason: refundByReason.filter(item => item._id), // Filter out null/undefined reasons
                refundByItemType: refundByItemType.filter(item => item._id), // Filter out null/undefined types
                topRefundedItems: topRefundedItems.filter(item => item._id), // Filter out null/undefined items
            },
        });
    } catch (error) {
        next(error);
    }
};
// @desc    Record damage details for items (without payment requirement)
// @route   POST /api/refunds/damage
// @access  Private (Admin, Manager)
exports.recordDamageDetails = async (req, res, next) => {
    console.log('=== DAMAGE RECORDING ENDPOINT CALLED ===');
    console.log('Request body:', req.body);
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId, items, notes } = req.body;
        console.log('Extracted data:', { orderId, items: items?.length, notes });

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.log('Validation failed: No items provided');
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Items array is required for damage recording',
                },
            });
        }

        // Validate damage details for all items
        for (const item of items) {
            if (!item.damageDetails || item.damageDetails.trim() === '') {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Damage details are required for item ${item.itemId}`,
                    },
                });
            }

            if (!item.damagedQuantity || item.damagedQuantity <= 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Damaged quantity must be greater than 0 for item ${item.itemId}`,
                    },
                });
            }

            // Validate refund reason
            const reasonValidation = RefundValidatorService.validateRefundReason(
                item.reason,
                item.reasonDescription
            );
            if (!reasonValidation.valid) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid damage reason for item ${item.itemId}`,
                        details: reasonValidation.errors,
                    },
                });
            }
        }

        // Find order
        const order = await Order.findById(orderId).populate('customer').session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Order not found',
                },
            });
        }

        // Check order status
        if (order.status === 'cancelled') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                error: {
                    code: 'BUSINESS_RULE_VIOLATION',
                    message: 'Cannot record damage for cancelled orders',
                },
            });
        }

        // Update order items with damage details
        for (const damageItem of items) {
            const orderItem = order.items.id(damageItem.itemId);
            
            if (!orderItem) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Item ${damageItem.itemId} not found in order`,
                    },
                });
            }

            // Check if damaged quantity doesn't exceed total quantity
            if (damageItem.damagedQuantity > orderItem.quantity) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Damaged quantity cannot exceed total quantity for item "${orderItem.itemName || orderItem.serviceName}"`,
                    },
                });
            }

            // Update item with damage details
            orderItem.damageDetails = damageItem.damageDetails;
            orderItem.damagedQuantity = damageItem.damagedQuantity;
            orderItem.damageReason = damageItem.reason;
            orderItem.damageReasonDescription = damageItem.reasonDescription;
            orderItem.damageRecordedBy = req.user._id;
            orderItem.damageRecordedAt = new Date();
            
            // Calculate potential refund amount (for future reference)
            const pricePerUnit = orderItem.subtotal / orderItem.quantity;
            orderItem.potentialRefundAmount = damageItem.damagedQuantity * pricePerUnit;
        }

        // Add damage recording entry to order status history
        order.statusHistory.push({
            status: 'damage_recorded',
            timestamp: new Date(),
            updatedBy: req.user._id,
            notes: notes || 'Damage details recorded',
        });

        // Save order
        await order.save({ session });

        // Commit transaction
        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: 'Damage details recorded successfully',
            data: {
                orderId: order._id,
                recordedItems: items.length,
                canProcessRefundLater: true,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};