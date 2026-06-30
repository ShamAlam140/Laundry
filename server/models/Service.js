const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
    {
        number: {
            type: String,
            trim: true,
            default: '',
        },
        linenGroup: {
            type: String,
            trim: true,
            default: '',
        },
        category: {
            type: String,
            trim: true,
            default: '',
        },
        colors: {
            type: String,
            trim: true,
            default: '',
        },
        sizes: {
            type: String,
            trim: true,
            default: '',
        },
        weight: {
            type: String,
            trim: true,
            default: '',
        },
        name: {
            type: String,
            required: [true, 'Service name is required'],
            trim: true,
        },
        serviceType: {
            type: String,
            enum: ['wash-fold', 'dry-cleaning', 'ironing', 'express', 'bulk-commercial'],
            required: [true, 'Service type is required'],
        },
        description: {
            type: String,
            trim: true,
        },
        pricePerUnit: {
            type: Number,
            required: [true, 'Price is required'],
            min: 0,
        },
        unit: {
            type: String,
            enum: ['piece', 'kg', 'bundle'],
            default: 'piece',
        },
        isExpress: {
            type: Boolean,
            default: false,
        },
        expressSurchargePercent: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isCustomerSpecific: {
            type: Boolean,
            default: false,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            default: null,
        },
        customerId: {
            type: String,
            trim: true,
            default: '',
        },
        customerPhone: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { timestamps: true }
);

serviceSchema.index({ isCustomerSpecific: 1, customer: 1 });
serviceSchema.index({ customerId: 1, customerPhone: 1 });

module.exports = mongoose.model('Service', serviceSchema);
