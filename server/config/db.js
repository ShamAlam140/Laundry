const mongoose = require('mongoose');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000; // 3 seconds between retries

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const connectDB = async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🔄 MongoDB connection attempt ${attempt}/${MAX_RETRIES}...`);
            const conn = await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                family: 4 // Force IPv4 to avoid IPv6 routing issues on mobile networks
            });
            console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
            
            // Migrate existing unapproved invoices to set isGenerated: true
            try {
                const Invoice = require('../models/Invoice');
                const result = await Invoice.updateMany(
                    { isApproved: false, isGenerated: { $exists: false } },
                    { $set: { isGenerated: true } }
                );
                if (result.modifiedCount > 0) {
                    console.log(`📊 Migrated ${result.modifiedCount} existing unapproved invoices to isGenerated: true`);
                }
            } catch (err) {
                console.error('⚠️ Error migrating existing invoices:', err.message);
            }

            return; // Success — exit the retry loop
        } catch (error) {
            console.error(`❌ MongoDB Connection Error (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
            
            if (attempt < MAX_RETRIES) {
                console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
                // Disconnect any partial connection before retrying
                try { await mongoose.disconnect(); } catch (_) {}
                await sleep(RETRY_DELAY_MS);
            } else {
                console.error('💀 All MongoDB connection attempts failed. Exiting.');
                process.exit(1);
            }
        }
    }
};

module.exports = connectDB;
