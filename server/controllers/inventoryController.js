const Inventory = require('../models/Inventory');
const { createNotification } = require('./notificationController');

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private
exports.getItems = async (req, res, next) => {
    try {
        const { search, category, lowStock, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (search) {
            filter.itemName = { $regex: search, $options: 'i' };
        }
        if (category) filter.category = category;
        if (lowStock === 'true') filter.isLowStock = true;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [items, total, lowStockCount] = await Promise.all([
            Inventory.find(filter).sort('itemName').skip(skip).limit(parseInt(limit)),
            Inventory.countDocuments(filter),
            Inventory.countDocuments({ isLowStock: true }),
        ]);

        res.status(200).json({
            success: true,
            count: items.length,
            total,
            lowStockCount,
            data: items,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single item
// @route   GET /api/inventory/:id
// @access  Private
exports.getItem = async (req, res, next) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        res.status(200).json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};

// @desc    Create inventory item
// @route   POST /api/inventory
// @access  Private (Admin, Manager)
exports.createItem = async (req, res, next) => {
    try {
        const item = await Inventory.create(req.body);
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private (Admin, Manager)
exports.updateItem = async (req, res, next) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        Object.assign(item, req.body);
        await item.save();

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};

// @desc    Restock item
// @route   PATCH /api/inventory/:id/restock
// @access  Private (Admin, Manager)
exports.restockItem = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
        }

        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        item.quantity += quantity;
        item.lastRestocked = new Date();
        await item.save();

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private (Admin)
exports.deleteItem = async (req, res, next) => {
    try {
        const item = await Inventory.findByIdAndDelete(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        res.status(200).json({ success: true, message: 'Item deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get low stock alerts
// @route   GET /api/inventory/alerts
// @access  Private
exports.getLowStockAlerts = async (req, res, next) => {
    try {
        const items = await Inventory.find({ isLowStock: true }).sort('quantity');
        res.status(200).json({ success: true, count: items.length, data: items });
    } catch (error) {
        next(error);
    }
};
