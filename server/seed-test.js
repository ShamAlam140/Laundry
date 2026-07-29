const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const Order = require('./models/Order');
        const Invoice = require('./models/Invoice');
        
        // Target invoice and customer
        const invoiceId = '6a69971c6ec1cdf4d404a0cb'; // Invoice we just saw
        const customerId = '6a57288c2dcd2c87a155d96f';

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) throw new Error('Invoice not found');

        const dates = [
            new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
        ];

        let totalToAdd = 0;
        let taxToAdd = 0;

        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            const orderTotal = 150 + i * 50; // Random totals: 150, 200, 250
            const tax = orderTotal * 0.1;
            
            const newOrder = await Order.create({
                orderId: `TEST-ORD-00${i + 1}`,
                customer: customerId,
                status: 'shipped',
                subtotal: orderTotal,
                taxAmount: tax,
                totalAmount: orderTotal + tax,
                balanceDue: orderTotal + tax,
                createdAt: date,
                updatedAt: date
            });

            invoice.linkedOrders.push(newOrder._id);
            totalToAdd += orderTotal + tax;
            taxToAdd += tax;
        }

        invoice.subtotal += (totalToAdd - taxToAdd);
        invoice.taxAmount += taxToAdd;
        invoice.totalAmount += totalToAdd;
        invoice.balanceDue += totalToAdd;
        
        await invoice.save();
        console.log('Successfully added dummy past orders to invoice');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
