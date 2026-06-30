/**
 * Service Timer Service
 * Handles service time tracking and duration calculations for orders
 */

class ServiceTimerService {
    /**
     * Calculate service duration in hours
     * @param {Date} startTime - Service start timestamp
     * @param {Date} endTime - Service end timestamp
     * @returns {Number|null} Duration in hours with 2 decimal precision, or null if invalid
     */
    static calculateDuration(startTime, endTime) {
        if (!startTime || !endTime) return null;
        
        const durationMs = endTime - startTime;
        const durationHours = durationMs / (1000 * 60 * 60);
        return Math.round(durationHours * 100) / 100;
    }

    /**
     * Format duration for display
     * @param {Number} durationHours - Duration in hours
     * @returns {String} Formatted duration (e.g., "2.5 hours", "30 minutes", "In Progress")
     */
    static formatDuration(durationHours) {
        if (durationHours === null || durationHours === undefined) {
            return 'In Progress';
        }
        
        if (durationHours < 1) {
            const minutes = Math.round(durationHours * 60);
            return `${minutes} minutes`;
        }
        
        return `${durationHours.toFixed(2)} hours`;
    }

    /**
     * Update service time tracking on status change
     * @param {Object} order - Order document
     * @param {String} newStatus - New order status
     * @returns {Object} Updated time tracking fields
     */
    static updateServiceTime(order, newStatus) {
        const updates = {};
        
        // Record service start time when status changes to "washing"
        if (newStatus === 'washing' && !order.serviceStartTime) {
            updates.serviceStartTime = new Date();
        }
        
        // Record service end time and calculate duration when status changes to "packed"
        if (newStatus === 'packed' && !order.serviceEndTime) {
            updates.serviceEndTime = new Date();
            
            if (order.serviceStartTime) {
                updates.serviceDuration = this.calculateDuration(
                    order.serviceStartTime,
                    updates.serviceEndTime
                );
            }
        }
        
        return updates;
    }

    /**
     * Check if service duration exceeds expected threshold
     * @param {Number} actualDuration - Actual service duration in hours
     * @param {Number} expectedDuration - Expected service duration in hours
     * @returns {Boolean} True if service is delayed
     */
    static isDelayed(actualDuration, expectedDuration) {
        if (!actualDuration || !expectedDuration) return false;
        return actualDuration > (expectedDuration * 1.5);
    }

    /**
     * Calculate delay percentage
     * @param {Number} actualDuration - Actual service duration in hours
     * @param {Number} expectedDuration - Expected service duration in hours
     * @returns {Number} Delay percentage
     */
    static calculateDelayPercentage(actualDuration, expectedDuration) {
        if (!actualDuration || !expectedDuration) return 0;
        return Math.round(((actualDuration - expectedDuration) / expectedDuration) * 100);
    }
}

module.exports = ServiceTimerService;
