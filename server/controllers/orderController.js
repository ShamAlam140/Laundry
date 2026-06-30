const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Inventory = require('../models/Inventory');
const Settings = require('../models/Settings');
const Service = require('../models/Service');
const { createNotification } = require('./notificationController');
const Notification = require('../models/Notification');
const ServiceTimerService = require('../utils/serviceTimerService');
const RefundRecommenderService = require('../utils/refundRecommenderService');

// @desc    Create order
// @route   POST /api/orders
// @access  Private (Cashier, Admin, Manager)
exports.createOrder = async (req, res, next) => {
    try {
        const {
            customer: customerId,
            items,
            specialInstructions,
            deliveryDate,
            taxPercent = 0,
            discountPercent = 0,
            serviceCharge = 0,
            applyCreditBalance = false,
        } = req.body;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one item is required' });
        }

        // Validate item types and item names
        const validItemTypes = ['Clothing', 'Linen', 'Accessories', 'Special_Items'];
        for (const item of items) {
            // Validate itemType if provided
            if (item.itemType && !validItemTypes.includes(item.itemType)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid item type "${item.itemType}". Must be one of: ${validItemTypes.join(', ')}`,
                });
            }

            // Validate quantity
            item.quantity = Number(item.quantity);
            if (!item.quantity || item.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Item quantity must be greater than zero',
                });
            }

            if (item.service && item.serviceType !== 'manual') {
                const service = await Service.findById(item.service);
                if (!service) {
                    return res.status(404).json({
                        success: false,
                        message: `Service not found: ${item.serviceName || item.service}`,
                    });
                }

                if (!service.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: `Service "${service.name}" is inactive`,
                    });
                }

                if (customer.isPremium && !service.isCustomerSpecific) {
                    return res.status(403).json({
                        success: false,
                        message: `Service "${service.name}" is not available for this premium customer`,
                    });
                }

                if (service.isCustomerSpecific) {
                    const belongsToCustomer =
                        String(service.customer || '') === String(customer._id) ||
                        service.customerId === customer.customerId ||
                        service.customerPhone === customer.phone;

                    if (!customer.isPremium || !belongsToCustomer) {
                        return res.status(403).json({
                            success: false,
                            message: `Service "${service.name}" is not available for this customer`,
                        });
                    }
                }

                item.serviceName = service.name;
                item.serviceType = service.serviceType;
                item.unit = service.unit;
                item.pricePerUnit = service.pricePerUnit;
                item.itemName = item.itemName || service.name;
            }

            // Validate pricePerUnit
            item.pricePerUnit = Number(item.pricePerUnit);
            if (Number.isNaN(item.pricePerUnit) || item.pricePerUnit < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Item price per unit must be greater than or equal to zero',
                });
            }

            item.subtotal = item.quantity * item.pricePerUnit;
        }

        // Calculate totals - exclude manual items from billing
        const billableItems = items.filter(item => item.serviceType !== 'manual');
        const subtotal = billableItems.reduce((sum, item) => sum + item.subtotal, 0);
        const taxAmount = (subtotal * taxPercent) / 100;
        const discountAmount = (subtotal * discountPercent) / 100;
        let totalAmount = subtotal + taxAmount - discountAmount + serviceCharge;

        // Apply credit balance if requested
        let creditApplied = 0;
        if (applyCreditBalance && customer.creditBalance > 0) {
            creditApplied = Math.min(customer.creditBalance, totalAmount);
            totalAmount -= creditApplied;
            
            // Deduct credit from customer
            customer.creditBalance -= creditApplied;
            await customer.save();
        }

        const order = await Order.create({
            customer: customerId,
            items,
            specialInstructions,
            deliveryDate,
            subtotal,
            taxPercent,
            taxAmount,
            discountPercent,
            discountAmount,
            serviceCharge,
            totalAmount: subtotal + taxAmount - discountAmount + serviceCharge, // Original total
            createdBy: req.user._id,
        });

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'customerId name phone customerType creditBalance')
            .populate('createdBy', 'name');

        // Notify admins/managers
        createNotification({
            recipientRoles: ['admin', 'manager'],
            type: 'order-created',
            title: 'New Order Created',
            message: `Order ${order.orderId} created for ${customer.name} — Total: ${order.totalAmount}${creditApplied > 0 ? ` (Credit Applied: ${creditApplied})` : ''}`,
            relatedOrder: order._id,
            relatedCustomer: customerId,
        });

        // Notify customer
        try {
            await Notification.create({
                recipient: customerId,
                recipientModel: 'Customer',
                type: 'order-created',
                title: 'Order Placed Successfully',
                message: `Your order ${order.orderId} has been created successfully. Total amount is $${order.totalAmount.toFixed(2)}.`,
                relatedOrder: order._id,
                relatedCustomer: customerId,
            });
        } catch (err) {
            console.error('Error creating customer order creation notification:', err);
        }

        res.status(201).json({
            success: true,
            data: populatedOrder,
            creditApplied,
            invoice: null,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res, next) => {
    try {
        const { search, status, isShipped, startDate, endDate, customer, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { orderId: { $regex: search, $options: 'i' } },
            ];
        }
        if (status) filter.status = status;
        if (isShipped !== undefined) {
            filter.isShipped = isShipped === 'true';
        }
        if (customer) filter.customer = customer;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter)
            .populate('customer', 'customerId name phone customerType')
            .populate('assignedStaff', 'name')
            .populate('createdBy', 'name')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: orders.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: orders,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer')
            .populate('assignedStaff', 'name')
            .populate('createdBy', 'name')
            .populate('statusHistory.updatedBy', 'name');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Get associated invoice
        const invoice = await Invoice.findOne({ order: order._id });

        // Group items by itemType
        const groupedItems = {};
        order.items.forEach(item => {
            const type = item.itemType || 'Uncategorized';
            if (!groupedItems[type]) {
                groupedItems[type] = [];
            }
            groupedItems[type].push(item);
        });

        res.status(200).json({
            success: true,
            data: {
                ...order.toObject(),
                invoice,
                groupedItems,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status, note, inventoryUsage } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Process inventory deduction if items are provided
        const processedUsage = [];
        if (inventoryUsage && inventoryUsage.length > 0) {
            for (const usage of inventoryUsage) {
                const item = await Inventory.findById(usage.item);
                if (!item) {
                    return res.status(404).json({
                        success: false,
                        message: `Inventory item not found: ${usage.itemName || usage.item}`,
                    });
                }
                if (item.quantity < usage.quantityUsed) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for "${item.itemName}". Available: ${item.quantity} ${item.unit}, Requested: ${usage.quantityUsed}`,
                    });
                }

                item.quantity -= usage.quantityUsed;
                await item.save();

                processedUsage.push({
                    item: item._id,
                    itemName: item.itemName,
                    quantityUsed: usage.quantityUsed,
                    unit: item.unit,
                });
            }
        }

        // Update service time tracking
        const timeUpdates = ServiceTimerService.updateServiceTime(order, status);
        Object.assign(order, timeUpdates);

        // Check for delays if service is completed
        if (status === 'packed' && order.serviceDuration) {
            const settings = await Settings.findById('global');
            if (settings) {
                const serviceType = order.items[0]?.serviceType;
                const expectedDuration = settings.serviceDurationThresholds?.get(serviceType);
                
                if (expectedDuration) {
                    order.isDelayed = RefundRecommenderService.shouldFlagAsDelayed(
                        order.serviceDuration,
                        expectedDuration
                    );
                }
            }
        }

        order.status = status;
        order.statusHistory.push({
            status,
            timestamp: new Date(),
            updatedBy: req.user._id,
            note,
            inventoryUsage: processedUsage,
        });

        await order.save();

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'customerId name phone')
            .populate('statusHistory.updatedBy', 'name');

        // Notify on all status changes
        const statusTitles = {
            washing: 'Order In Washing',
            packed: 'Order Packed & Ready',
            cancelled: 'Order Cancelled',
        };
        if (statusTitles[status]) {
            createNotification({
                recipientRoles: ['admin', 'manager', 'cashier'],
                type: `order-status-update`,
                title: statusTitles[status],
                message: `Order ${order.orderId} is now ${status}`,
                relatedOrder: order._id,
            });

            // Notify customer
            try {
                await Notification.create({
                    recipient: order.customer._id,
                    recipientModel: 'Customer',
                    type: 'order-status-update',
                    title: statusTitles[status],
                    message: `Dear customer, your order ${order.orderId} is now ${status}.`,
                    relatedOrder: order._id,
                    relatedCustomer: order.customer._id,
                });
            } catch (err) {
                console.error('Error creating customer order status update notification:', err);
            }
        }

        res.status(200).json({ success: true, data: populatedOrder });
    } catch (error) {
        next(error);
    }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
exports.updateOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if invoice is finalized
        const invoice = await Invoice.findOne({ order: order._id });
        if (invoice && invoice.isFinalized && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit order after invoice is finalized. Admin override required.',
            });
        }

        if (req.body.items) {
            order.items = req.body.items;
        }
        if (req.body.deliveryDate !== undefined) {
            order.deliveryDate = req.body.deliveryDate || undefined;
        }
        if (req.body.specialInstructions !== undefined) {
            order.specialInstructions = req.body.specialInstructions;
        }
        if (req.body.taxPercent !== undefined) {
            order.taxPercent = Number(req.body.taxPercent);
        }
        if (req.body.discountPercent !== undefined) {
            order.discountPercent = Number(req.body.discountPercent);
        }
        if (req.body.serviceCharge !== undefined) {
            order.serviceCharge = Number(req.body.serviceCharge);
        }

        // Recalculate totals
        for (const item of order.items) {
            item.quantity = Number(item.quantity || 1);
            item.pricePerUnit = Number(item.pricePerUnit || 0);
            item.subtotal = item.quantity * item.pricePerUnit;
        }
        const billableItems = order.items.filter(item => item.serviceType !== 'manual');
        order.subtotal = billableItems.reduce((sum, item) => sum + item.subtotal, 0);
        order.taxAmount = (order.subtotal * order.taxPercent) / 100;
        order.discountAmount = (order.subtotal * order.discountPercent) / 100;
        order.totalAmount = order.subtotal + order.taxAmount - order.discountAmount + order.serviceCharge;

        await order.save();

        // Sync with invoice
        if (invoice) {
            invoice.subtotal = order.subtotal;
            invoice.taxAmount = order.taxAmount;
            invoice.discountAmount = order.discountAmount;
            invoice.serviceCharge = order.serviceCharge;
            invoice.totalAmount = order.totalAmount;
            invoice.balanceDue = Math.max(0, order.totalAmount - (invoice.paidAmount || 0));
            invoice.paymentStatus = (invoice.paidAmount || 0) >= order.totalAmount ? 'paid' : ((invoice.paidAmount || 0) > 0 ? 'partial' : 'unpaid');
            await invoice.save();
        }

        const populated = await Order.findById(order._id)
            .populate('customer', 'customerId name phone')
            .populate('createdBy', 'name');

        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private
exports.cancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.status = 'cancelled';
        order.statusHistory.push({
            status: 'cancelled',
            timestamp: new Date(),
            updatedBy: req.user._id,
            note: req.body?.reason || 'Order cancelled',
        });
        await order.save();

        res.status(200).json({ success: true, message: 'Order cancelled', data: order });
    } catch (error) {
        next(error);
    }
};

// @desc    Get dashboard stats
// @route   GET /api/orders/stats/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [totalOrders, todayOrders, pendingOrders, completedOrders] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
            Order.countDocuments({ status: { $nin: ['packed', 'cancelled'] } }),
            Order.countDocuments({ status: 'packed' }),
        ]);

        // Today's revenue
        const todayRevenueAgg = await Order.aggregate([
            { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);

        // Total revenue
        const totalRevenueAgg = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);

        const totalCustomers = await Customer.countDocuments();

        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                todayOrders,
                pendingOrders,
                completedOrders,
                todayRevenue: todayRevenueAgg[0]?.total || 0,
                totalRevenue: totalRevenueAgg[0]?.total || 0,
                totalCustomers,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk import orders from CSV
// @route   POST /api/orders/bulk-import
// @access  Private (Admin, Manager)
exports.bulkImportOrders = async (req, res, next) => {
    try {
        const multer = require('multer');
        const csv = require('csv-parser');
        const fs = require('fs');

        // Configure multer for file upload
        const upload = multer({ dest: 'uploads/' });
        
        // Handle file upload
        upload.single('file')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: 'File upload failed' });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const results = [];
            const errors = [];
            let successCount = 0;

            // Parse CSV
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    // Group rows by customer phone
                    const ordersByCustomer = {};

                    for (const row of results) {
                        const customerPhone = row['Customer Phone']?.trim();
                        if (!customerPhone) {
                            errors.push({ row, error: 'Missing customer phone' });
                            continue;
                        }

                        if (!ordersByCustomer[customerPhone]) {
                            ordersByCustomer[customerPhone] = {
                                customerName: row['Customer Name']?.trim(),
                                services: [],
                                manualItems: [],
                                deliveryDate: row['Delivery Date']?.trim(),
                                discountPercent: parseFloat(row['Discount %']) || 0,
                                specialInstructions: row['Special Instructions']?.trim() || '',
                            };
                        }

                        // Add service if present
                        const serviceName = row['Service Name']?.trim();
                        const serviceQuantity = parseInt(row['Service Quantity']);
                        if (serviceName && serviceQuantity) {
                            ordersByCustomer[customerPhone].services.push({
                                serviceName,
                                quantity: serviceQuantity,
                            });
                        }

                        // Add manual item if present
                        const itemType = row['Item Type']?.trim();
                        const itemName = row['Item Name']?.trim();
                        const itemQuantity = parseInt(row['Item Quantity']);
                        const itemPrice = parseFloat(row['Item Price']);
                        if (itemName && itemQuantity && itemPrice !== undefined) {
                            ordersByCustomer[customerPhone].manualItems.push({
                                itemType: itemType || 'Clothing',
                                itemName,
                                quantity: itemQuantity,
                                pricePerUnit: itemPrice,
                            });
                        }
                    }

                    // Create orders
                    for (const [phone, orderData] of Object.entries(ordersByCustomer)) {
                        try {
                            // Find customer by phone
                            const customer = await Customer.findOne({ phone });
                            if (!customer) {
                                errors.push({ phone, error: 'Customer not found' });
                                continue;
                            }

                            // Build items array
                            const items = [];

                            // Add services
                            for (const serviceData of orderData.services) {
                                const serviceScope = customer.isPremium
                                    ? [{
                                        isCustomerSpecific: true,
                                        $or: [
                                            { customer: customer._id },
                                            { customerId: customer.customerId },
                                            { customerPhone: customer.phone },
                                        ],
                                    }]
                                    : [{ isCustomerSpecific: { $ne: true } }];

                                const service = await Service.findOne({
                                    name: serviceData.serviceName,
                                    isActive: true,
                                    $or: serviceScope,
                                });
                                if (!service) {
                                    errors.push({ phone, serviceName: serviceData.serviceName, error: 'Service not found' });
                                    continue;
                                }

                                items.push({
                                    service: service._id,
                                    serviceName: service.name,
                                    serviceType: service.serviceType,
                                    itemType: 'Clothing',
                                    itemName: service.name,
                                    quantity: serviceData.quantity,
                                    unit: service.unit,
                                    pricePerUnit: service.pricePerUnit,
                                    subtotal: service.pricePerUnit * serviceData.quantity,
                                });
                            }

                            // Add manual items
                            for (const manualItem of orderData.manualItems) {
                                items.push({
                                    service: null,
                                    serviceName: manualItem.itemName,
                                    serviceType: 'manual',
                                    itemType: manualItem.itemType,
                                    itemName: manualItem.itemName,
                                    quantity: manualItem.quantity,
                                    unit: 'piece',
                                    pricePerUnit: manualItem.pricePerUnit,
                                    subtotal: manualItem.pricePerUnit * manualItem.quantity,
                                });
                            }

                            if (items.length === 0) {
                                errors.push({ phone, error: 'No valid items found' });
                                continue;
                            }

                            // Filter billable items (exclude manual items)
                            const billableItems = items.filter(item => item.serviceType !== 'manual');
                            const subtotal = billableItems.reduce((sum, item) => sum + item.subtotal, 0);
                            const taxPercent = 5; // Default tax
                            const taxAmount = (subtotal * taxPercent) / 100;
                            const discountAmount = (subtotal * orderData.discountPercent) / 100;
                            const totalAmount = subtotal + taxAmount - discountAmount;

                            // Create order
                            const order = await Order.create({
                                customer: customer._id,
                                items,
                                subtotal,
                                taxPercent,
                                taxAmount,
                                discountPercent: orderData.discountPercent,
                                discountAmount,
                                totalAmount,
                                paidAmount: 0,
                                balanceDue: totalAmount,
                                status: 'received',
                                paymentStatus: 'unpaid',
                                specialInstructions: orderData.specialInstructions,
                                deliveryDate: orderData.deliveryDate || undefined,
                                createdBy: req.user._id,
                            });

                            successCount++;
                        } catch (error) {
                            errors.push({ phone, error: error.message });
                        }
                    }

                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);

                    res.status(200).json({
                        success: true,
                        data: {
                            successCount,
                            errorCount: errors.length,
                            errors,
                        },
                    });
                });
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Ship order and generate invoice
// @route   POST /api/orders/:id/ship
// @access  Private (Admin, Manager, Cashier)
exports.shipOrder = async (req, res, next) => {
    try {
        const { items } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.isShipped) {
            return res.status(400).json({ success: false, message: 'Order is already shipped/invoiced' });
        }

        // Update items shipped quantity
        if (items && Array.isArray(items)) {
            for (const shipItem of items) {
                const orderItem = order.items.id(shipItem.itemId);
                if (orderItem) {
                    orderItem.shippedQuantity = Number(shipItem.shippedQuantity);
                    orderItem.subtotal = orderItem.shippedQuantity * orderItem.pricePerUnit;
                }
            }
        } else {
            // Default shipped quantity to quantity if not provided
            for (const orderItem of order.items) {
                if (orderItem.shippedQuantity === null || orderItem.shippedQuantity === undefined) {
                    orderItem.shippedQuantity = orderItem.quantity;
                    orderItem.subtotal = orderItem.shippedQuantity * orderItem.pricePerUnit;
                }
            }
        }

        // Calculate new totals based on shipped quantities
        const billableItems = order.items.filter(item => item.serviceType !== 'manual');
        const subtotal = billableItems.reduce((sum, item) => sum + item.subtotal, 0);
        const taxAmount = (subtotal * order.taxPercent) / 100;
        const discountAmount = (subtotal * order.discountPercent) / 100;
        const totalAmount = subtotal + taxAmount - discountAmount + order.serviceCharge;

        order.subtotal = subtotal;
        order.taxAmount = taxAmount;
        order.discountAmount = discountAmount;
        order.totalAmount = totalAmount;
        order.isShipped = true;

        // Add history
        order.statusHistory.push({
            status: 'packed',
            timestamp: new Date(),
            updatedBy: req.user._id,
            note: 'Order shipped and invoice generated',
        });

        await order.save();

        const customer = await Customer.findById(order.customer);
        const creditDays = customer && customer.creditDays ? customer.creditDays : 0;
        
        const dueDate = new Date();
        if (creditDays > 0) {
            dueDate.setDate(dueDate.getDate() + creditDays);
        }
        const terms = creditDays > 0 ? `NET ${creditDays}` : 'Due on Receipt';

        // Create Invoice (always starts as Pending Approval)
        const invoice = await Invoice.create({
            order: order._id,
            customer: order.customer,
            subtotal: order.subtotal,
            taxAmount: order.taxAmount,
            discountAmount: order.discountAmount,
            serviceCharge: order.serviceCharge,
            totalAmount: order.totalAmount,
            paidAmount: 0,
            balanceDue: order.totalAmount,
            paymentStatus: 'unpaid',
            isApproved: false, // Start pending approval
            isGenerated: true,
            dueDate,
            terms,
            createdBy: req.user._id,
        });

        res.status(200).json({
            success: true,
            message: 'Order shipped and invoice generated successfully',
            data: {
                order,
                invoice,
            },
        });
    } catch (error) {
        next(error);
    }
};

