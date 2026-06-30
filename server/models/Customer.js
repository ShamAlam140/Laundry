const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

const customerSchema = new mongoose.Schema(
    {
        customerId: {
            type: String,
            unique: true,
        },
        name: {
            type: String,
            required: [true, 'Customer name is required'],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        address: {
            type: String,
            trim: true,
        },
        customerType: {
            type: String,
            enum: ['walk-in', 'corporate'],
            default: 'walk-in',
        },
        isPremium: {
            type: Boolean,
            default: false,
        },
        outstandingBalance: {
            type: Number,
            default: 0,
        },
        password: {
            type: String,
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        
        // NEW FIELD for credit balance from refunds
        creditBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        notificationFrequency: {
            type: String,
            enum: ['none', '1_day', '3_days', '5_days', '1_week', '15_days', '1_month'],
            default: 'none',
        },
        lastNotificationSentAt: {
            type: Date,
        },
        creditDays: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Hash password before save
customerSchema.pre('save', async function () {
    // Auto-generate Customer ID
    if (this.isNew && !this.customerId) {
        const counter = await Counter.findByIdAndUpdate(
            'customerId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.customerId = `CUST-${String(counter.seq).padStart(4, '0')}`;
    }

    // Hash password if modified
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

// Compare password method
customerSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Customer', customerSchema);
