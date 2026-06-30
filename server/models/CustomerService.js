const mongoose = require('mongoose');

const customerServiceSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Customer is required'],
        },
        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service',
            required: [true, 'Service is required'],
        },
        customPrice: {
            type: Number,
            required: [true, 'Custom price is required'],
            min: [0, 'Price cannot be negative'],
        },
        customName: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent duplicate service assignment to the same customer
customerServiceSchema.index({ customer: 1, service: 1 }, { unique: true });

module.exports = mongoose.model('CustomerService', customerServiceSchema);
