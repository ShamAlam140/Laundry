const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
    },
    serviceName: {
        type: String,
        required: true,
    },
    serviceType: {
        type: String,
        required: true,
    },
    itemName: {
        type: String,
        default: '',
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: 1,
    },
    shippedQuantity: {
        type: Number,
        default: null,
    },
    unit: {
        type: String,
        enum: ['piece', 'kg', 'bundle'],
        default: 'piece',
    },
    pricePerUnit: {
        type: Number,
        required: true,
        min: 0,
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0,
    },
    
    // NEW FIELDS for item details
    itemType: {
        type: String,
        enum: ['Clothing', 'Linen', 'Accessories', 'Special_Items'],
        required: false, // Not required for backward compatibility
    },
    
    // NEW FIELDS for refund tracking
    isRefunded: {
        type: Boolean,
        default: false,
    },
    refundAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    refundReason: {
        type: String,
        enum: ['Damaged', 'Lost', 'Delayed_Service', 'Quality_Issue', 'Customer_Complaint', 'Other', null],
        default: null,
    },
    refundReasonDescription: {
        type: String,
        trim: true,
    },
    
    // NEW FIELDS for damage tracking (separate from refunds)
    damageDetails: {
        type: String,
        trim: true,
    },
    damagedQuantity: {
        type: Number,
        min: 0,
    },
    damageReason: {
        type: String,
        enum: ['Damaged', 'Lost', 'Delayed_Service', 'Quality_Issue', 'Customer_Complaint', 'Other', null],
        default: null,
    },
    damageReasonDescription: {
        type: String,
        trim: true,
    },
    damageRecordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    damageRecordedAt: {
        type: Date,
    },
    potentialRefundAmount: {
        type: Number,
        min: 0,
    },
});

const statusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    note: String,
    inventoryUsage: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory',
        },
        itemName: String,
        quantityUsed: Number,
        unit: String,
    }],
});

const orderCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const OrderCounter = mongoose.model('OrderCounter', orderCounterSchema);

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            unique: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Customer is required'],
        },
        items: [orderItemSchema],
        status: {
            type: String,
            enum: [
                'received',
                'washing',
                'packed',
                'cancelled',
            ],
            default: 'received',
        },
        statusHistory: [statusHistorySchema],
        specialInstructions: {
            type: String,
            trim: true,
        },
        deliveryDate: {
            type: Date,
        },
        subtotal: {
            type: Number,
            default: 0,
        },
        taxPercent: {
            type: Number,
            default: 0,
        },
        taxAmount: {
            type: Number,
            default: 0,
        },
        discountPercent: {
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
            default: 0,
        },
        assignedStaff: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        
        // NEW FIELDS for service time tracking
        serviceStartTime: {
            type: Date,
            default: null,
        },
        serviceEndTime: {
            type: Date,
            default: null,
        },
        serviceDuration: {
            type: Number, // in hours with 2 decimal precision
            default: null,
        },
        isDelayed: {
            type: Boolean,
            default: false,
        },
        
        // NEW FIELDS for refund tracking
        totalRefundAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        hasRefund: {
            type: Boolean,
            default: false,
        },
        isShipped: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Auto-generate Order ID (ORD-0001, ORD-0002, ...)
orderSchema.pre('save', async function () {
    if (this.isNew) {
        const counter = await OrderCounter.findByIdAndUpdate(
            'orderId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.orderId = `ORD-${String(counter.seq).padStart(4, '0')}`;

        // Add initial status to history
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            updatedBy: this.createdBy,
        });
    }
});

module.exports = mongoose.model('Order', orderSchema);
