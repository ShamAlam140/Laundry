const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({ _id: String, seq: Number });
const DeliveryCounter = mongoose.model('DeliveryCounter', counterSchema);

const deliverySchema = new mongoose.Schema(
    {
        deliveryId: { type: String, unique: true },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        type: {
            type: String,
            enum: ['pickup', 'delivery'],
            required: true,
        },
        scheduledDate: {
            type: Date,
            required: [true, 'Scheduled date is required'],
        },
        scheduledTime: {
            type: String, // e.g. "10:00 AM - 12:00 PM"
        },
        assignedStaff: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        address: { type: String },
        status: {
            type: String,
            enum: ['scheduled', 'in-transit', 'completed', 'cancelled'],
            default: 'scheduled',
        },
        completedAt: { type: Date },
        notes: { type: String },
        // OTP confirmation (FR-22a)
        deliveryOtp: { type: String }, // 4-digit OTP
        otpVerified: { type: Boolean, default: false },
        otpGeneratedAt: { type: Date },
        // Signature capture (FR-22b)
        signature: { type: String }, // base64 data URL
        confirmedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

deliverySchema.pre('save', async function () {
    if (!this.deliveryId) {
        const counter = await DeliveryCounter.findByIdAndUpdate(
            'deliveryId',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.deliveryId = `DEL-${String(counter.seq).padStart(4, '0')}`;
    }
});

deliverySchema.index({ scheduledDate: 1, status: 1 });
deliverySchema.index({ assignedStaff: 1, scheduledDate: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
