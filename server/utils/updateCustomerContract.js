const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Customer = require('../models/Customer');
const Service = require('../models/Service');

// Change these configuration values for each customer update request
const config = {
    customerId: '',
    customerName: 'Bedspoke - South Brisbane',
    creditDays: 28,
    isPremium: true,
    rawItems: `
Bed Linen	COG Single Sheet	0	 	Both	YES	Specialty	1.71
Bed Linen	COG Pillow Protector	0	 	Both	YES	Specialty	2.75
Bed Linen	Tea Towel	0	 	Both	YES	Rental	0.55
Bed Linen	Single Sheet	0	 	Both	YES	Rental	1.71
Bed Linen	Queen Fitted sheet	0	 	Both	YES	Rental	2.05
Bed Linen	Pillow Case	0	 	Both	YES	Rental	0.55
Bed Linen	King Top Sheet	0	 	Both	YES	Rental	2.25
Bed Linen	King Sheet	0	 	Both	YES	Rental	2.15
Bed Linen	COG Blanket	0	 	Both	YES	Specialty	10
Bed Linen	COG Cushion	0	 	Both	YES	Specialty	5.5
Bed Linen	COG Queen Sheet	0	 	Both	YES	Specialty	1.38
Bed Linen	COG Pillow Case	0	 	Both	YES	Specialty	0.55
Bed Linen	COG Pillow	0	 	Both	YES	Specialty	5.5
Bed Linen	COG Mattress Topper	0	 	Both	YES	Specialty	10
Bed Linen	COG Mattress Protector	0	 	Both	YES	Specialty	10
Bed Linen	COG Fitted Sheet	0	 	Both	YES	Specialty	1.38
Bed Linen	COG Doona Cover	0	 	Both	YES	Specialty	3.85
Bed Linen	COG Doona	0	 	Both	YES	Specialty	20
Mats	Floor Rug	0	 	Both	YES	Rental	10
Misc	Linen Bags	0	 	Both	YES	Rental	0.00
Misc	Reject linen bags	0	 	Both	YES	Rental	0.00
Misc	Linen Trolley	0	 	Both	YES	Rental	0.00
Terry	Hand Towel	0	 	Both	YES	Rental	0.55
Terry	Face Washer	0	 	Both	YES	Rental	0.45
Terry	Bath Towel	0	 	Both	YES	Rental	1.1
Terry	Bath Mat	0	 	Both	YES	Rental	0.66
`
};

const run = async () => {
    try {
        await connectDB();
        console.log('🔌 Connected to Database.');

        // Find customer by customerId or customerName
        let customer = null;
        if (config.customerId) {
            customer = await Customer.findOne({ customerId: config.customerId });
        }
        if (!customer && config.customerName) {
            customer = await Customer.findOne({ name: { $regex: new RegExp(`^${config.customerName}$`, 'i') } });
        }

        if (!customer) {
            console.error(`❌ Customer with ID "${config.customerId}" or Name "${config.customerName}" not found.`);
            process.exit(1);
        }

        console.log(`👤 Customer Found: "${customer.name}" (${customer.customerId})`);

        // Update basic contract info
        customer.isPremium = config.isPremium;
        customer.creditDays = config.creditDays;
        await customer.save();
        console.log(`✅ Updated Basic Contract: Premium=${customer.isPremium}, Credit Days=${customer.creditDays}`);

        // Parse items
        const lines = config.rawItems.trim().split('\n');
        const parsedServices = [];

        for (const line of lines) {
            const cols = line.split('\t');
            if (cols.length < 7) continue;

            const category = cols[0].trim();
            const name = cols[1].trim();
            const weight = cols[2].trim();
            const type = cols[6].trim(); // Rental or Specialty
            
            // Handle optional pricing (if empty, default to 0.00)
            const priceVal = cols[7] ? cols[7].trim() : '';
            const price = parseFloat(priceVal) || 0;

            parsedServices.push({
                category,
                name,
                weight,
                pricePerUnit: price,
                serviceType: 'bulk-commercial', // Standard category type for contract items
                unit: category.toLowerCase() === 'terry' ? 'kg' : 'piece', // Default category units
                description: `Contract service type: ${type}`,
            });
        }

        console.log(`📝 Parsed ${parsedServices.length} custom service entries.`);

        // Sync custom services (deactivate old custom services, save new ones)
        // 1. Get all currently saved custom services for this customer
        const existingServices = await Service.find({ customer: customer._id, isCustomerSpecific: true });
        
        // 2. Map and save services
        const activeIds = [];
        for (const service of parsedServices) {
            const serviceData = {
                category: service.category,
                name: service.name,
                weight: service.weight,
                pricePerUnit: service.pricePerUnit,
                serviceType: service.serviceType,
                unit: service.unit,
                description: service.description,
                isCustomerSpecific: true,
                customer: customer._id,
                customerId: customer.customerId,
                customerPhone: customer.phone,
                isActive: true
            };

            // Look if existing service matches by name
            const match = existingServices.find(s => s.name.toLowerCase() === service.name.toLowerCase());
            let saved = null;
            if (match) {
                saved = await Service.findByIdAndUpdate(match._id, serviceData, { new: true });
            } else {
                saved = await Service.create(serviceData);
            }
            activeIds.push(saved._id);
        }

        // 3. Mark old custom services not present in rawItems as inactive
        const staleFilter = { customer: customer._id, isCustomerSpecific: true };
        if (activeIds.length > 0) {
            staleFilter._id = { $nin: activeIds };
        }
        const staleRes = await Service.updateMany(staleFilter, { isActive: false });
        console.log(`🧹 Deactivated ${staleRes.modifiedCount} outdated custom services.`);
        console.log(`🎉 Sync Completed successfully! Added/Updated ${activeIds.length} custom services.`);
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected database.');
    } catch (err) {
        console.error('❌ Error executing update script:', err);
        process.exit(1);
    }
};

run();
