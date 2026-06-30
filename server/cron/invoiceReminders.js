const cron = require('node-cron');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Notification = require('../models/Notification');

// Map interval names to milliseconds
const INTERVALS = {
    '1_day': 24 * 60 * 60 * 1000,
    '3_days': 3 * 24 * 60 * 60 * 1000,
    '5_days': 5 * 24 * 60 * 60 * 1000,
    '1_week': 7 * 24 * 60 * 60 * 1000,
    '15_days': 15 * 24 * 60 * 60 * 1000,
    '1_month': 30 * 24 * 60 * 60 * 1000
};

const sendInvoiceReminders = async () => {
    try {
        console.log('[CRON] Starting invoice reminders check...');
        
        // Find customers with active notification frequencies
        const customers = await Customer.find({
            notificationFrequency: { $ne: 'none' }
        });

        for (const customer of customers) {
            const intervalMs = INTERVALS[customer.notificationFrequency];
            if (!intervalMs) continue;

            const now = new Date();
            const lastSent = customer.lastNotificationSentAt;

            // Check if interval has elapsed since last notification
            if (lastSent && (now.getTime() - new Date(lastSent).getTime() < intervalMs)) {
                // Interval has not passed yet
                continue;
            }

            // Find unpaid/partially paid invoices for this customer that are approved
            const unpaidInvoices = await Invoice.find({
                customer: customer._id,
                paymentStatus: { $in: ['unpaid', 'partial'] },
                isApproved: true
            });

            if (unpaidInvoices.length === 0) {
                continue;
            }

            // Calculate total balance due
            const totalBalanceDue = unpaidInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

            if (totalBalanceDue <= 0) {
                continue;
            }

            // Create notification for customer portal/APK
            await Notification.create({
                recipient: customer._id,
                recipientModel: 'Customer',
                type: 'invoice-reminder',
                title: 'Outstanding Invoice Reminder',
                message: `Dear ${customer.name}, you have ${unpaidInvoices.length} outstanding invoice(s) with a total balance due of $${totalBalanceDue.toFixed(2)}. Please review and make a payment.`,
                relatedCustomer: customer._id
            });

            // Update customer last notification date
            customer.lastNotificationSentAt = now;
            await customer.save();

            console.log(`[CRON] Sent reminder to customer: ${customer.name} (ID: ${customer.customerId})`);
        }

        console.log('[CRON] Invoice reminders check complete.');
    } catch (error) {
        console.error('[CRON ERROR] Failed to send invoice reminders:', error);
    }
};

// Initialize cron scheduler
const initCron = () => {
    // Schedule check to run every hour (at the start of the hour)
    cron.schedule('0 * * * *', sendInvoiceReminders);
    
    // Also run immediately on server startup to handle any pending reminders
    sendInvoiceReminders();
};

module.exports = { initCron, sendInvoiceReminders };
