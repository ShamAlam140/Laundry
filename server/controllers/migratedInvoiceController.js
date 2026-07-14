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
        
        // Calculate total amount sum
        const totalAmountAggregate = await MigratedInvoice.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalAmountSum = totalAmountAggregate[0]?.total || 0;

        const invoices = await MigratedInvoice.find(filter)
            .sort({ invoiceDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: invoices.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            totalAmountSum,
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

        const invoiceNumbers = invoices.map(inv => String(inv.invoiceNumber).trim());
        
        // Find existing invoices in bulk
        const existingInvoices = await MigratedInvoice.find({ 
            invoiceNumber: { $in: invoiceNumbers } 
        }).select('invoiceNumber');
        
        const existingNumbersSet = new Set(existingInvoices.map(inv => String(inv.invoiceNumber).trim()));

        const toInsert = [];
        let skippedCount = 0;

        for (const invData of invoices) {
            const num = String(invData.invoiceNumber).trim();
            if (existingNumbersSet.has(num)) {
                skippedCount++;
            } else {
                if (req.user) {
                    invData.createdBy = req.user._id;
                }
                toInsert.push(invData);
            }
        }

        let importedCount = 0;
        const errors = [];

        if (toInsert.length > 0) {
            try {
                const result = await MigratedInvoice.insertMany(toInsert, { ordered: false });
                importedCount = result.length;
            } catch (err) {
                if (err.insertedDocs) {
                    importedCount = err.insertedDocs.length;
                } else if (err.result && err.result.nInserted) {
                    importedCount = err.result.nInserted;
                }
                if (err.writeErrors) {
                    err.writeErrors.forEach(we => {
                        errors.push({ 
                            invoiceNumber: toInsert[we.index]?.invoiceNumber, 
                            error: we.errmsg || 'Duplicate key or validation error' 
                        });
                    });
                } else {
                    errors.push({ error: err.message });
                }
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
