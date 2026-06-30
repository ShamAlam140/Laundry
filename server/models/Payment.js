const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        invoice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'card', 'mobile', 'bank-transfer', 'credit-account'],
            required: [true, 'Payment method is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be greater than 0'],
        },
        transactionRef: {
            type: String,
            trim: true,
        },
        note: {
            type: String,
            trim: true,
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
