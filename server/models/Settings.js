const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        _id: { type: String, default: 'global' },
        businessName: { type: String, default: 'CleanWave Laundry' },
        businessPhone: { type: String, default: '' },
        businessEmail: { type: String, default: '' },
        businessAddress: { type: String, default: '' },
        taxNumberLabel: { type: String, default: 'GST Number' },
        taxNumber: { type: String, default: '' },
        logo: { type: String, default: '' },
        currency: { type: String, default: '₹' },
        taxPercent: { type: Number, default: 5 },
        defaultDiscountPercent: { type: Number, default: 0 },
        defaultServiceCharge: { type: Number, default: 0 },
        invoicePrefix: { type: String, default: 'INV' },
        orderPrefix: { type: String, default: 'ORD' },
        invoiceFooter: { type: String, default: 'Thank you for choosing CleanWave Laundry!' },
        workingHours: { type: String, default: '08:00 AM - 08:00 PM' },
        workingDays: { type: String, default: 'Mon - Sat' },
        
        // NEW FIELDS for service duration thresholds
        serviceDurationThresholds: {
            type: Map,
            of: Number, // hours
            default: {
                'Wash & Fold': 24,
                'Dry Cleaning': 48,
                'Ironing': 12,
                'Wash & Iron': 24,
            },
        },
        refundRecommendationEnabled: {
            type: Boolean,
            default: true,
        },
        orderEmailMessage: {
            type: String,
            default: 'Thank you for choosing Peninsula Laundries! Your laundry order has been received and is now being processed. Below is your order summary:',
        },
        invoiceEmailMessage: {
            type: String,
            default: 'We are pleased to inform you that your invoice {invoiceId} has been approved. The invoice details are summarized below:',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
