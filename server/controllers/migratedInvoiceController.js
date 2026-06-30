const MigratedInvoice = require('../models/MigratedInvoice');

// @desc    Get all migrated invoices
// @route   GET /api/invoices/migrated
// @access  Private
exports.getMigratedInvoices = async (req, res, next) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const filter = {};
        
        if (search) {
            filter.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { contactName: { $regex: search, $options: 'i' } },
                { reference: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await MigratedInvoice.countDocuments(filter);
        const invoices = await MigratedInvoice.find(filter)
            .sort('-invoiceDate')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: invoices.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            data: invoices,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single migrated invoice
// @route   GET /api/invoices/migrated/:id
// @access  Private
exports.getMigratedInvoice = async (req, res, next) => {
    try {
        const invoice = await MigratedInvoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Migrated invoice not found' });
        }
        res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        next(error);
    }
};

// @desc    Import batch of migrated invoices
// @route   POST /api/invoices/migrated/import
// @access  Private
exports.importMigratedInvoices = async (req, res, next) => {
    try {
        const { invoices } = req.body;
        if (!invoices || !Array.isArray(invoices)) {
            return res.status(400).json({ success: false, message: 'Invalid payload. Expecting an array of invoices' });
        }

        let importedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const invData of invoices) {
            try {
                // Check if invoice number already exists
                const existing = await MigratedInvoice.findOne({ invoiceNumber: invData.invoiceNumber });
                if (existing) {
                    skippedCount++;
                    continue;
                }

                // Add creator
                if (req.user) {
                    invData.createdBy = req.user._id;
                }

                await MigratedInvoice.create(invData);
                importedCount++;
            } catch (err) {
                errors.push({ invoiceNumber: invData.invoiceNumber, error: err.message });
            }
        }

        res.status(200).json({
            success: true,
            importedCount,
            skippedCount,
            errors,
            message: `Successfully imported ${importedCount} invoices. Skipped ${skippedCount} duplicates.`,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Clear all migrated invoices
// @route   DELETE /api/invoices/migrated
// @access  Private
exports.clearMigratedInvoices = async (req, res, next) => {
    try {
        // Only allow admin or manager to clear migrated invoices
        if (!['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await MigratedInvoice.deleteMany({});
        res.status(200).json({ success: true, message: 'All migrated invoices have been cleared' });
    } catch (error) {
        next(error);
    }
};
