const Settings = require('../models/Settings');
const Service = require('../models/Service');

// @desc    Get settings
// @route   GET /api/settings
// @access  Private
exports.getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private (Admin)
exports.updateSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global', ...req.body });
        } else {
            Object.assign(settings, req.body);
            await settings.save();
        }
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all services (for pricing management)
// @route   GET /api/settings/services
// @access  Private (Admin)
exports.getServices = async (req, res, next) => {
    try {
        const services = await Service.find({}).sort('isCustomerSpecific serviceType name');
        res.status(200).json({ success: true, data: services });
    } catch (error) {
        next(error);
    }
};

// @desc    Update service pricing
// @route   PUT /api/settings/services/:id
// @access  Private (Admin)
exports.updateServicePricing = async (req, res, next) => {
    try {
        const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
            runValidators: true,
        });
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        res.status(200).json({ success: true, data: service });
    } catch (error) {
        next(error);
    }
};

// @desc    Create service
// @route   POST /api/settings/services
// @access  Private (Admin)
exports.createService = async (req, res, next) => {
    try {
        if (Array.isArray(req.body)) {
            const mapped = req.body.map(item => ({
                ...item,
                isCustomerSpecific: false,
                customer: null,
                customerId: '',
                customerPhone: '',
            }));
            const services = await Service.insertMany(mapped);
            return res.status(201).json({ success: true, data: services });
        }
        const service = await Service.create({
            ...req.body,
            isCustomerSpecific: false,
            customer: null,
            customerId: '',
            customerPhone: '',
        });
        res.status(201).json({ success: true, data: service });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete service
// @route   DELETE /api/settings/services/:id
// @access  Private (Admin)
exports.deleteService = async (req, res, next) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        res.status(200).json({ success: true, message: 'Service deleted' });
    } catch (error) {
        next(error);
    }
};
