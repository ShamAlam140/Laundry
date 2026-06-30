const express = require('express');
const router = express.Router();
const {
    getSettings,
    updateSettings,
    getServices,
    updateServicePricing,
    createService,
    deleteService,
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getSettings);

router.use(protect);

router.put('/', authorize('admin'), updateSettings);
router.get('/services', authorize('admin'), getServices);
router.post('/services', authorize('admin'), createService);
router.put('/services/:id', authorize('admin'), updateServicePricing);
router.delete('/services/:id', authorize('admin'), deleteService);

module.exports = router;
