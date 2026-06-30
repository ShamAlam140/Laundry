const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
    {
        itemName: {
            type: String,
            required: [true, 'Item name is required'],
            trim: true,
        },
        category: {
            type: String,
            enum: ['detergent', 'softener', 'packaging', 'chemical', 'other'],
            default: 'other',
        },
        quantity: {
            type: Number,
            required: true,
            min: 0,
        },
        unit: {
            type: String,
            enum: ['liters', 'kg', 'pieces', 'packs'],
            default: 'pieces',
        },
        threshold: {
            type: Number,
            default: 10,
        },
        lastRestocked: {
            type: Date,
        },
        isLowStock: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Check low stock on save
inventorySchema.pre('save', function () {
    this.isLowStock = this.quantity <= this.threshold;
});

module.exports = mongoose.model('Inventory', inventorySchema);
