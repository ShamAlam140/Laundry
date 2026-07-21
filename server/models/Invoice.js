const mongoose = require('mongoose');

const invoiceCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const InvoiceCounter = mongoose.model('InvoiceCounter', invoiceCounterSchema);

const invoiceSchema = new mongoose.Schema(
    {
        invoiceId: {
            type: String,
            unique: true,
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: false, // Changed to false to allow linkedOrders
        },
        linkedOrders: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
        }],
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        subtotal: {
            type: Number,
            required: true,
        },
        taxAmount: {
            type: Number,
            default: 0,
        },
        discountAmount: {
            type: Number,
            default: 0,
        },
        serviceCharge: {
            type: Number,
            default: 0,
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        paidAmount: {
            type: Number,
            default: 0,
        },
        balanceDue: {
            type: Number,
            default: 0,
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'partial', 'paid', 'refunded'],
            default: 'unpaid',
        },
        isFinalized: {
            type: Boolean,
            default: false,
        },
        isApproved: {
            type: Boolean,
            default: false,
        },
        isGenerated: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        cycleReadyDate: {
            type: Date,
            default: null,
        },
        isCycleInvoice: {
            type: Boolean,
            default: false,
        },
        
        // NEW FIELDS for refund tracking
        refundLineItems: [{
            refund: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Refund',
            },
            description: String,
            amount: Number, // negative value
            refundDate: Date,
        }],
        totalRefundAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        creditBalance: {
            type: Number,
            default: 0,
        },
        dueDate: {
            type: Date,
        },
        terms: {
            type: String,
        },
    },
    { timestamps: true }
);

// Auto-generate Invoice ID (INV-0001, INV-0002, ...)
invoiceSchema.pre('save', async function () {
    if (this.isNew) {
        const counter = await InvoiceCounter.findByIdAndUpdate(
            'invoiceId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.invoiceId = `INV-${String(counter.seq).padStart(4, '0')}`;
        this.balanceDue = this.totalAmount - this.paidAmount;
    }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
