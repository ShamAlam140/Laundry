const Invoice = require('../models/Invoice');

/**
 * Refund Validator Service
 * Validates refund requests against business rules
 */

class RefundValidatorService {
    /**
     * Validate full refund request
     * @param {Object} order - Order document
     * @param {Number} refundAmount - Requested refund amount
     * @returns {Object} { valid: Boolean, errors: Array }
     */
    static async validateFullRefund(order, refundAmount) {
        const errors = [];
        
        // Check order status
        if (order.status === 'cancelled') {
            errors.push('Cannot refund cancelled orders');
        }
        
        // Check refund amount
        if (refundAmount > order.totalAmount) {
            errors.push(`Refund amount cannot exceed original order amount of ${order.totalAmount}`);
        }
        
        if (refundAmount <= 0) {
            errors.push('Refund amount must be greater than zero');
        }
        
        // Check total refunds
        const currentRefunds = order.totalRefundAmount || 0;
        if (currentRefunds + refundAmount > order.totalAmount) {
            errors.push(`Total refunds cannot exceed original order amount. Already refunded: ${currentRefunds}`);
        }
        
        // Check if invoice exists and has payments
        const invoice = await Invoice.findOne({ order: order._id });
        if (!invoice) {
            errors.push('Invoice not found for this order');
        } else if (invoice.paidAmount === 0) {
            errors.push('Cannot refund order with no payments');
        }
        
        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate partial refund request
     * @param {Object} order - Order document
     * @param {Array} refundItems - Array of { itemId, refundAmount }
     * @returns {Object} { valid: Boolean, errors: Array }
     */
    static async validatePartialRefund(order, refundItems) {
        const errors = [];
        
        // Check order status
        if (order.status === 'cancelled') {
            errors.push('Cannot refund cancelled orders');
        }
        
        // Validate refundItems is an array
        if (!Array.isArray(refundItems) || refundItems.length === 0) {
            errors.push('At least one item must be specified for partial refund');
            return { valid: false, errors };
        }
        
        // Validate each item
        for (const refundItem of refundItems) {
            const orderItem = order.items.id(refundItem.itemId);
            
            if (!orderItem) {
                errors.push(`Item ${refundItem.itemId} not found in order`);
                continue;
            }
            
            // Check if item is already fully refunded
            const currentItemRefund = orderItem.refundAmount || 0;
            if (orderItem.isRefunded && currentItemRefund >= orderItem.subtotal) {
                errors.push(`Item "${orderItem.itemName || orderItem.serviceName}" has already been fully refunded`);
                continue;
            }
            
            // Check if refund amount exceeds item subtotal
            const totalItemRefund = currentItemRefund + refundItem.refundAmount;
            if (totalItemRefund > orderItem.subtotal) {
                errors.push(`Refund amount for "${orderItem.itemName || orderItem.serviceName}" exceeds item subtotal of ${orderItem.subtotal}`);
            }
            
            // Check if refund amount is positive
            if (refundItem.refundAmount <= 0) {
                errors.push(`Refund amount for "${orderItem.itemName || orderItem.serviceName}" must be greater than zero`);
            }
        }
        
        // Check total refunds
        const totalRefundAmount = refundItems.reduce((sum, item) => sum + item.refundAmount, 0);
        const currentRefunds = order.totalRefundAmount || 0;
        if (currentRefunds + totalRefundAmount > order.totalAmount) {
            errors.push(`Total refunds cannot exceed original order amount. Already refunded: ${currentRefunds}`);
        }
        
        // Check if invoice exists and has payments
        const invoice = await Invoice.findOne({ order: order._id });
        if (!invoice) {
            errors.push('Invoice not found for this order');
        } else if (invoice.paidAmount === 0) {
            errors.push('Cannot refund order with no payments');
        }
        
        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Check if order requires admin approval for refund
     * @param {Object} order - Order document
     * @returns {Boolean} True if admin approval required
     */
    static requiresAdminApproval(order) {
        if (!order.serviceEndTime) return false;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return order.serviceEndTime < thirtyDaysAgo;
    }

    /**
     * Validate refund reason
     * @param {String} reason - Refund reason
     * @param {String} reasonDescription - Refund reason description (required for "Other")
     * @returns {Object} { valid: Boolean, errors: Array }
     */
    static validateRefundReason(reason, reasonDescription) {
        const errors = [];
        const validReasons = ['Damaged', 'Lost', 'Delayed_Service', 'Quality_Issue', 'Customer_Complaint', 'Other'];
        
        if (!reason) {
            errors.push('Refund reason is required');
        } else if (!validReasons.includes(reason)) {
            errors.push(`Invalid refund reason. Must be one of: ${validReasons.join(', ')}`);
        } else if (reason === 'Other' && (!reasonDescription || reasonDescription.trim() === '')) {
            errors.push('Reason description is required when reason is "Other"');
        }
        
        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

module.exports = RefundValidatorService;
