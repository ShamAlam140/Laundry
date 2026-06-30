const mongoose = require('mongoose');

const migratedInvoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
        },
        contactName: { type: String, required: true },
        emailAddress: { type: String },
        poAddressLine1: { type: String },
        poAddressLine2: { type: String },
        poAddressLine3: { type: String },
        poAddressLine4: { type: String },
        poCity: { type: String },
        poRegion: { type: String },
        poPostalCode: { type: String },
        poCountry: { type: String },
        reference: { type: String },
        invoiceDate: { type: Date, required: true },
        dueDate: { type: Date, required: true },
        currency: { type: String, default: 'AUD' },
        brandingTheme: { type: String },
        lineItems: [
            {
                inventoryItemCode: { type: String },
                description: { type: String, required: true },
                quantity: { type: Number, required: true },
                unitAmount: { type: Number, required: true },
                discount: { type: Number, default: 0 },
                accountCode: { type: String, required: true },
                taxType: { type: String, required: true },
                trackingName1: { type: String },
                trackingOption1: { type: String },
                trackingName2: { type: String },
                trackingOption2: { type: String },
            }
        ],
        totalAmount: {
            type: Number,
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('MigratedInvoice', migratedInvoiceSchema);
