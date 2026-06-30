const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Service = require('../models/Service');

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected for seeding');

        // Clear existing data
        await User.deleteMany({});
        await Service.deleteMany({});

        // Create admin user
        const admin = await User.create({
            name: 'Admin',
            username: 'admin',
            email: 'admin@clspbs.com',
            phone: '9999999999',
            password: 'admin123',
            role: 'admin',
        });
        console.log('✅ Admin user created (username: admin, password: admin123)');

        // Create manager
        await User.create({
            name: 'Manager',
            username: 'manager',
            email: 'manager@clspbs.com',
            phone: '8888888888',
            password: 'manager123',
            role: 'manager',
        });
        console.log('✅ Manager user created (username: manager, password: manager123)');

        // Create cashier
        await User.create({
            name: 'Cashier',
            username: 'cashier',
            email: 'cashier@clspbs.com',
            phone: '7777777777',
            password: 'cashier123',
            role: 'cashier',
        });
        console.log('✅ Cashier user created (username: cashier, password: cashier123)');

        // Create staff
        await User.create({
            name: 'Staff Member',
            username: 'staff',
            email: 'staff@clspbs.com',
            phone: '6666666666',
            password: 'staff123',
            role: 'staff',
        });
        console.log('✅ Staff user created (username: staff, password: staff123)');

        // Seed services
        const services = [
            { name: 'Wash & Fold - Regular', serviceType: 'wash-fold', pricePerUnit: 50, unit: 'kg', description: 'Standard wash and fold service' },
            { name: 'Wash & Fold - Premium', serviceType: 'wash-fold', pricePerUnit: 80, unit: 'kg', description: 'Premium wash with fabric softener' },
            { name: 'Dry Cleaning - Shirt', serviceType: 'dry-cleaning', pricePerUnit: 100, unit: 'piece', description: 'Professional dry cleaning for shirts' },
            { name: 'Dry Cleaning - Suit', serviceType: 'dry-cleaning', pricePerUnit: 300, unit: 'piece', description: 'Professional dry cleaning for suits' },
            { name: 'Dry Cleaning - Saree', serviceType: 'dry-cleaning', pricePerUnit: 200, unit: 'piece', description: 'Delicate dry cleaning for sarees' },
            { name: 'Ironing - Regular', serviceType: 'ironing', pricePerUnit: 20, unit: 'piece', description: 'Standard ironing per piece' },
            { name: 'Ironing - Heavy', serviceType: 'ironing', pricePerUnit: 40, unit: 'piece', description: 'Heavy fabrics ironing' },
            { name: 'Express Wash & Fold', serviceType: 'express', pricePerUnit: 100, unit: 'kg', isExpress: true, expressSurchargePercent: 50, description: 'Same day wash and fold' },
            { name: 'Express Dry Cleaning', serviceType: 'express', pricePerUnit: 200, unit: 'piece', isExpress: true, expressSurchargePercent: 50, description: 'Same day dry cleaning' },
            { name: 'Bulk Commercial', serviceType: 'bulk-commercial', pricePerUnit: 30, unit: 'kg', description: 'Bulk laundry for hotels/restaurants' },
        ];

        await Service.insertMany(services);
        console.log(`✅ ${services.length} services seeded`);

        console.log('\n🎉 Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error.message);
        process.exit(1);
    }
};

seedData();
