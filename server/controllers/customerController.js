const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Service = require('../models/Service');

const serviceTypes = ['wash-fold', 'dry-cleaning', 'ironing', 'express', 'bulk-commercial'];
const serviceUnits = ['piece', 'kg', 'bundle'];

const normalizeCustomServices = (services = []) => {
    if (!Array.isArray(services)) return [];

    return services
        .filter((service) => service && service.name && service.name.trim())
        .map((service) => ({
            _id: service._id,
            number: service.number ? String(service.number).trim() : '',
            linenGroup: service.linenGroup ? String(service.linenGroup).trim() : '',
            category: service.category ? String(service.category).trim() : '',
            name: service.name.trim(),
            serviceType: serviceTypes.includes(service.serviceType) ? service.serviceType : 'wash-fold',
            description: service.description ? service.description.trim() : '',
            colors: service.colors ? String(service.colors).trim() : '',
            sizes: service.sizes ? String(service.sizes).trim() : '',
            weight: service.weight ? String(service.weight).trim() : '',
            pricePerUnit: Math.max(0, Number(service.pricePerUnit) || 0),
            unit: serviceUnits.includes(service.unit) ? service.unit : 'piece',
            isExpress: Boolean(service.isExpress),
            expressSurchargePercent: Math.max(0, Number(service.expressSurchargePercent) || 0),
            isActive: service.isActive !== false,
        }));
};

const syncCustomerServices = async (customer, services = []) => {
    if (!customer.isPremium) {
        await Service.updateMany(
            { customer: customer._id, isCustomerSpecific: true },
            { isActive: false, customerId: customer.customerId, customerPhone: customer.phone }
        );
        return [];
    }

    const normalizedServices = normalizeCustomServices(services);
    const activeServiceIds = [];
    const savedServices = [];

    for (const service of normalizedServices) {
        const serviceData = {
            number: service.number,
            linenGroup: service.linenGroup,
            category: service.category,
            name: service.name,
            serviceType: service.serviceType,
            description: service.description,
            colors: service.colors,
            sizes: service.sizes,
            weight: service.weight,
            pricePerUnit: service.pricePerUnit,
            unit: service.unit,
            isExpress: service.isExpress,
            expressSurchargePercent: service.expressSurchargePercent,
            isActive: service.isActive,
            isCustomerSpecific: true,
            customer: customer._id,
            customerId: customer.customerId,
            customerPhone: customer.phone,
        };

        let savedService = null;
        if (service._id) {
            savedService = await Service.findOneAndUpdate(
                { _id: service._id, customer: customer._id, isCustomerSpecific: true },
                serviceData,
                { returnDocument: 'after', runValidators: true }
            );
        }

        if (!savedService) {
            savedService = await Service.create(serviceData);
        }

        activeServiceIds.push(savedService._id);
        savedServices.push(savedService);
    }

    const staleFilter = { customer: customer._id, isCustomerSpecific: true };
    if (activeServiceIds.length > 0) {
        staleFilter._id = { $nin: activeServiceIds };
    }

    await Service.updateMany(staleFilter, {
        isActive: false,
        customerId: customer.customerId,
        customerPhone: customer.phone,
    });

    return savedServices;
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res, next) => {
    try {
        const { search, customerType, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { customerId: { $regex: search, $options: 'i' } },
            ];
        }
        if (customerType) filter.customerType = customerType;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Customer.countDocuments(filter);
        const customers = await Customer.find(filter)
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: customers.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: customers,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single customer with order history
// @route   GET /api/customers/:id
// @access  Private
exports.getCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const customServices = await Service.find({
            customer: customer._id,
            isCustomerSpecific: true,
        }).sort('serviceType name');

        // Get order history
        const orders = await Order.find({ customer: req.params.id })
            .sort('-createdAt')
            .limit(20)
            .populate('createdBy', 'name');

        res.status(200).json({
            success: true,
            data: { ...customer.toObject(), orders, customServices },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res, next) => {
    try {
        const { name, phone, email, address, customerType, isPremium = false, customServices = [], notificationFrequency = 'none' } = req.body;
        const customer = await Customer.create({ name, phone, email, address, customerType, isPremium, notificationFrequency });
        const savedServices = await syncCustomerServices(customer, customServices);

        res.status(201).json({
            success: true,
            data: { ...customer.toObject(), customServices: savedServices },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res, next) => {
    try {
        const { name, phone, email, address, customerType, isPremium, customServices, notificationFrequency } = req.body;
        const updates = { name, phone, email, address, customerType };
        if (isPremium !== undefined) updates.isPremium = isPremium;
        if (notificationFrequency !== undefined) updates.notificationFrequency = notificationFrequency;

        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            updates,
            { returnDocument: 'after', runValidators: true }
        );
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        let savedServices = [];
        if (customServices !== undefined || customer.isPremium === false) {
            savedServices = await syncCustomerServices(customer, customServices);
        } else {
            await Service.updateMany(
                { customer: customer._id, isCustomerSpecific: true },
                { customerId: customer.customerId, customerPhone: customer.phone }
            );
            savedServices = await Service.find({
                customer: customer._id,
                isCustomerSpecific: true,
            }).sort('serviceType name');
        }

        res.status(200).json({
            success: true,
            data: { ...customer.toObject(), customServices: savedServices },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private/Admin
exports.deleteCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.status(200).json({ success: true, message: 'Customer deleted' });
    } catch (error) {
        next(error);
    }
};
