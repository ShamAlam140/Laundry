const express = require('express');
const router = express.Router();
const {
    getMyOrders,
    getMyOrder,
    getMyInvoices,
    getMyInvoice,
    getFilteredInvoices,
    getSummary,
    getServices,
    createMyOrder,
    getMyNotifications,
    markMyNotificationAsRead,
    markAllMyNotificationsAsRead,
} = require('../controllers/customerPortalController');
const { protectCustomer } = require('../middleware/customerAuth');

router.use(protectCustomer);

router.get('/summary', getSummary);
router.get('/services', getServices);
router.get('/orders', getMyOrders);
router.get('/orders/:id', getMyOrder);
router.post('/orders', createMyOrder);
router.get('/invoices', getMyInvoices);
router.get('/invoices/filtered', getFilteredInvoices);
router.get('/invoices/:id', getMyInvoice);

// Customer Notification Routes
router.get('/notifications', getMyNotifications);
router.patch('/notifications/read-all', markAllMyNotificationsAsRead);
router.patch('/notifications/:id/read', markMyNotificationAsRead);

module.exports = router;
