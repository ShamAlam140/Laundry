const mongoose = require('mongoose');
const Customer = require('../models/Customer');
require('dotenv').config();

// Customer data from the provided list
const customersData = [
    {
        name: "Amanda Bainbridge",
        phone: "0449675005",
        email: "Amanda.l.Bainbridge@gmail.com",
        address: "13 McDonald Road, Margate, QLD 4019",
        customerType: "walk-in"
    },
    {
        name: "Bedspoke - South Brisbane",
        phone: "",
        email: "billing@bedspoke.com.au",
        address: "54 Peel St, South Brisbane, Queensland 4101",
        customerType: "corporate"
    },
    {
        name: "Bedspoke - Sunshine Coast",
        phone: "",
        email: "billing@bedspoke.com.au",
        address: "121 Sugar Rd, Alexandra Headland, Queensland 4572",
        customerType: "corporate"
    },
    {
        name: "Bedspoke - Bundall",
        phone: "",
        email: "billing@bedspoke.com.au",
        address: "Bundall Road, Bundall, Queensland 4217",
        customerType: "corporate"
    },
    {
        name: "Bedspoke - Fortitude Valley",
        phone: "",
        email: "billing@bedspoke.com.au",
        address: "121 Brunswick St, Fortitude Valley, Queensland 4006",
        customerType: "corporate"
    },
    {
        name: "Camp Hill Hotel",
        phone: "",
        email: "camphillhoteladmin@alhgroup.com.au",
        address: "Camp Hill Hotel, Camp Hill, Queensland 4152",
        customerType: "corporate"
    },
    {
        name: "Castaways on Moreton",
        phone: "0448667011",
        email: "info@castawaysonmoreton.com.au",
        address: "28 Bullock Creek Rd, Meldale, Queensland 4510",
        customerType: "walk-in"
    },
    {
        name: "Chardons Corner Hotel",
        phone: "",
        email: "chardonscornerhotel@alhgroup.com.au",
        address: "688 Ipswich Rd, Annerley, Queensland 4103",
        customerType: "corporate"
    },
    {
        name: "Coastal Letting Co Pty Ltd New farm",
        phone: "0401826687",
        email: "stay@coastallettingco.com.au",
        address: "776 Brunswick St, New Farm, Queensland 4005",
        customerType: "walk-in"
    },
    {
        name: "Commercial Hotel Nerang",
        phone: "0755781200",
        email: "commercialhotelnerang@alhgroup.com.au",
        address: "Cnr Ferry &, Price St, Nerang, QLD 4211",
        customerType: "corporate"
    },
    {
        name: "Dolphins NRL Limited",
        phone: "",
        email: "accounts@dolphinsnrl.com.au",
        address: "PO Box 526, KIPPA-RING, QLD 4021",
        customerType: "corporate"
    },
    {
        name: "Fabian Delgado",
        phone: "",
        email: "fabiandj523@hotmail.com",
        address: "TEMP, TEMP, TEMP TEMP",
        customerType: "corporate"
    },
    {
        name: "Fairways Golf and Beach Resort",
        phone: "",
        email: "alanhudson006@outlook.com",
        address: "Fairways Golf & Beach Retreat, Woorim, Queensland 4507",
        customerType: "walk-in"
    },
    {
        name: "Harmony Wellness Spa Redcliffe QLD",
        phone: "",
        email: "info.harmonyws@gmail.com",
        address: "2/147 Sutton St, Redcliffe, Queensland 4020",
        customerType: "walk-in"
    },
    {
        name: "Hinterland Hotel",
        phone: "0755571699",
        email: "hinterlandhotelmotel@alhgroup.com.au",
        address: "Nerang River Plaza, Nerang, Queensland 4211",
        customerType: "corporate"
    },
    {
        name: "House Of Athena Australia",
        phone: "",
        email: "houseofathenaau@gmail.com",
        address: "Kennards Self Storage West End, West End, Queensland 4101",
        customerType: "walk-in"
    },
    {
        name: "Inside N out",
        phone: "",
        email: "john@insidenoutcleaning.com",
        address: "114 Montpelier Rd, Bowen Hills, Queensland 4006",
        customerType: "corporate"
    },
    {
        name: "Manly Hotel",
        phone: "",
        email: "manlyhotelaccommodation@alhgroup.com.au",
        address: "54 Cambridge Parade, Manly, Queensland 4179",
        customerType: "corporate"
    },
    {
        name: "Mermaid Waters Resort",
        phone: "",
        email: "Dee-Anne.britton@alhgroup.com.au",
        address: "97 Markeri St, Mermaid Waters, Queensland 4218",
        customerType: "corporate"
    },
    {
        name: "Palmbeach Hotel",
        phone: "",
        email: "palmbeachhotel@alhgroup.com.au",
        address: "1118 Gold Coast Hwy, Palm Beach, Queensland 4221",
        customerType: "walk-in"
    },
    {
        name: "Placid Waters Holiday Apartments",
        phone: "",
        email: "holiday@placidwaters.com.au",
        address: "Placid Waters Holiday Apartments, Bongaree, Queensland 4507",
        customerType: "walk-in"
    },
    {
        name: "Posta Cleaning",
        phone: "",
        email: "admin@postacleaning.com",
        address: "Bundall Road, Bundall, Queensland 4217",
        customerType: "walk-in"
    },
    {
        name: "Premium Realty",
        phone: "",
        email: "gayle@premiumre.com.au",
        address: "11/85 Welsby Parade, Bongaree, Queensland 4507",
        customerType: "corporate"
    },
    {
        name: "Prince of Wales Hotel",
        phone: "",
        email: "princeofwaleshoteladmin@alhgroup.com.au",
        address: "100 Buckland Rd, Nundah, Queensland 4012",
        customerType: "corporate"
    },
    {
        name: "Royal George Hotel",
        phone: "",
        email: "accounts@royalgeorgehotel.com.au",
        address: "119 Brunswick St, Fortitude Valley, Queensland 4006",
        customerType: "corporate"
    },
    {
        name: "Scarborough Beach Resort QLD",
        phone: "",
        email: "office@scarboroughbeachresort.com.au",
        address: "89 Landsborough Ave, Scarborough, Queensland 4020",
        customerType: "corporate"
    },
    {
        name: "Sebel Margate Beach",
        phone: "",
        email: "Kathryn.DEARING@accor.com",
        address: "1 McCulloch Ave, Margate, Queensland 4019",
        customerType: "corporate"
    },
    {
        name: "Sedgebrook on Leichhardt",
        phone: "",
        email: "jj88qld@gmail.com",
        address: "83 Leichhardt St, Spring Hill, Queensland 4000",
        customerType: "corporate"
    },
    {
        name: "Springwood Hotel",
        phone: "",
        email: "springwoodhoteladmin@alhgroup.com.au",
        address: "Springwood Road & Rochedale Road, Springwood, Queensland 4123",
        customerType: "corporate"
    },
    {
        name: "Sunnybank Hotel",
        phone: "",
        email: "sarah.frizzell@alhgroup.com.au",
        address: "275 McCullough St, Sunnybank, Queensland 4109",
        customerType: "corporate"
    },
    {
        name: "Tangalooma Island Resort",
        phone: "",
        email: "invoices@tangalooma.com",
        address: "220 Holt St, Pinkenba, Queensland 4008",
        customerType: "walk-in"
    },
    {
        name: "Tangalooma Island Resort F&B",
        phone: "",
        email: "invoices@tangalooma.com",
        address: "220 Holt St, Pinkenba, Queensland 4008",
        customerType: "walk-in"
    },
    {
        name: "The Brook by Nightcap Plus",
        phone: "",
        email: "brookhotelaccommodation@alhgroup.com.au",
        address: "167 Osborne Rd, Mitchelton, Queensland 4053",
        customerType: "corporate"
    }
];

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

// Register customers one by one
const registerCustomers = async () => {
    try {
        console.log('\n🚀 Starting customer registration...\n');
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (let i = 0; i < customersData.length; i++) {
            const customerData = { ...customersData[i] };
            
            // If phone is empty, assign a default unique number
            if (!customerData.phone || customerData.phone.trim() === '') {
                customerData.phone = `0000${String(i + 1).padStart(6, '0')}`;
                console.log(`📞 Assigned default phone: ${customerData.phone} for ${customerData.name}`);
            }
            
            try {
                // Check if customer already exists (by phone or email)
                const existingCustomer = await Customer.findOne({
                    $or: [
                        { phone: customerData.phone },
                        { email: customerData.email }
                    ]
                });

                if (existingCustomer) {
                    console.log(`⏭️  [${i + 1}/${customersData.length}] Skipped: ${customerData.name} (Already exists)`);
                    skipCount++;
                    continue;
                }

                // Create new customer
                const customer = await Customer.create(customerData);
                
                console.log(`✅ [${i + 1}/${customersData.length}] Registered: ${customer.name} (ID: ${customer.customerId})`);
                successCount++;
                
                // Small delay to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ [${i + 1}/${customersData.length}] Error registering ${customerData.name}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Registration Summary:');
        console.log(`   ✅ Successfully registered: ${successCount}`);
        console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📝 Total processed: ${customersData.length}\n`);

    } catch (error) {
        console.error('❌ Registration process error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run the script
const run = async () => {
    await connectDB();
    await registerCustomers();
};

run();
