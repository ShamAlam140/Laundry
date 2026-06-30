const Service = require('../models/Service');
const Customer = require('../models/Customer');

const resolveCustomer = async ({ customer, customerId, phone }) => {
    const lookup = customer || customerId || phone;
    if (!lookup) return null;

    const filters = [
        { customerId: lookup },
        { phone: lookup },
    ];

    if (/^[0-9a-fA-F]{24}$/.test(lookup)) {
        filters.unshift({ _id: lookup });
    }

    return Customer.findOne({ $or: filters });
};

// @desc    Get all services
// @route   GET /api/services
// @access  Private
exports.getServices = async (req, res, next) => {
    try {
        const { serviceType, isActive, customer, customerId, phone } = req.query;
        const filter = {};
        if (serviceType) filter.serviceType = serviceType;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const resolvedCustomer = await resolveCustomer({ customer, customerId, phone });

        if (resolvedCustomer?.isPremium) {
            filter.isCustomerSpecific = true;
            filter.$or = [
                { customer: resolvedCustomer._id },
                { customerId: resolvedCustomer.customerId },
                { customerPhone: resolvedCustomer.phone },
            ];
        } else {
            filter.isCustomerSpecific = { $ne: true };
        }

        const services = await Service.find(filter).sort('serviceType name');
        res.status(200).json({ success: true, count: services.length, data: services });
    } catch (error) {
        next(error);
    }
};

// @desc    Create service
// @route   POST /api/services
// @access  Private/Admin
exports.createService = async (req, res, next) => {
    try {
        if (Array.isArray(req.body)) {
            const services = await Service.insertMany(req.body);
            return res.status(201).json({ success: true, data: services });
        }
        const service = await Service.create(req.body);
        res.status(201).json({ success: true, data: service });
    } catch (error) {
        next(error);
    }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private/Admin
exports.updateService = async (req, res, next) => {
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

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private/Admin
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
