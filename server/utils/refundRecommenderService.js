const Order = require('../models/Order');
const Settings = require('../models/Settings');

/**
 * Refund Recommender Service
 * Generates refund recommendations based on service delays
 */

class RefundRecommenderService {
    /**
     * Check if order qualifies for refund recommendation
     * @param {Object} order - Order document
     * @param {Object} settings - Settings document
     * @returns {Object|null} Recommendation object or null
     */
    static async generateRecommendation(order, settings) {
        if (!settings.refundRecommendationEnabled) return null;
        if (!order.serviceDuration) return null;
        
        // Get expected duration threshold for service type
        const serviceType = order.items[0]?.serviceType;
        if (!serviceType) return null;
        
        const expectedDuration = settings.serviceDurationThresholds?.get(serviceType);
        if (!expectedDuration) return null;
        
        const delayPercentage = ((order.serviceDuration - expectedDuration) / expectedDuration) * 100;
        
        // Only recommend if delay exceeds 50%
        if (delayPercentage < 50) return null;
        
        // Calculate recommended refund amount
        let refundPercentage = 10; // 10% for 50-100% delay
        if (delayPercentage > 100) {
            refundPercentage = 20; // 20% for >100% delay
        }
        
        const recommendedAmount = Math.round((order.totalAmount * refundPercentage) / 100);
        
        return {
            orderId: order._id,
            orderNumber: order.orderId,
            customerName: order.customer?.name || 'Unknown',
            serviceDuration: order.serviceDuration,
            expectedDuration,
            delayPercentage: Math.round(delayPercentage),
            recommendedAmount,
            refundPercentage,
            reason: 'Delayed_Service',
        };
    }

    /**
     * Get all pending refund recommendations
     * @returns {Array} Array of recommendation objects
     */
    static async getPendingRecommendations() {
        const settings = await Settings.findById('global');
        if (!settings || !settings.refundRecommendationEnabled) return [];
        
        // Find packed/completed orders with service duration but no refund
        const orders = await Order.find({
            status: 'packed',
            serviceDuration: { $ne: null },
            hasRefund: false,
            isDelayed: true,
        }).populate('customer');
        
        const recommendations = [];
        for (const order of orders) {
            const recommendation = await this.generateRecommendation(order, settings);
            if (recommendation) {
                recommendations.push(recommendation);
            }
        }
        
        return recommendations;
    }

    /**
     * Check if order should be flagged as delayed
     * @param {Number} actualDuration - Actual service duration in hours
     * @param {Number} expectedDuration - Expected service duration in hours
     * @returns {Boolean} True if order should be flagged as delayed
     */
    static shouldFlagAsDelayed(actualDuration, expectedDuration) {
        if (!actualDuration || !expectedDuration) return false;
        return actualDuration > (expectedDuration * 1.5);
    }
}

module.exports = RefundRecommenderService;
