const Notification = require('../models/Notification');
const User = require('../models/User');

// Helper: create & broadcast notification to users by role
const createNotification = async ({ recipientRoles, type, title, message, relatedOrder, relatedCustomer, excludeUser }) => {
    try {
        const filter = { isActive: true };
        if (recipientRoles && recipientRoles.length) {
            filter.role = { $in: recipientRoles };
        }
        if (excludeUser) {
            filter._id = { $ne: excludeUser };
        }

        const users = await User.find(filter).select('_id');
        const notifications = users.map((u) => ({
            recipient: u._id,
            type,
            title,
            message,
            relatedOrder,
            relatedCustomer,
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
        return notifications.length;
    } catch (error) {
        console.error('Notification creation error:', error.message);
        return 0;
    }
};

// @desc    Get my notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const filter = { recipient: req.user._id };
        if (unreadOnly === 'true') filter.isRead = false;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(parseInt(limit))
                .populate('relatedOrder', 'orderId status')
                .populate('relatedCustomer', 'customerId name'),
            Notification.countDocuments(filter),
            Notification.countDocuments({ recipient: req.user._id, isRead: false }),
        ]);

        res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            unreadCount,
            data: notifications,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false,
        });
        res.status(200).json({ success: true, data: { count } });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { isRead: true, readAt: new Date() },
            { returnDocument: 'after' }
        );
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark all as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
};

module.exports = { createNotification, getNotifications, getUnreadCount, markAsRead, markAllAsRead };
