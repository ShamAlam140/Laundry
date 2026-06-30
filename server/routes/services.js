const express = require('express');
const router = express.Router();
const {
    getServices,
    createService,
    updateService,
    deleteService,
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getServices).post(authorize('admin'), createService);
router
    .route('/:id')
    .put(authorize('admin'), updateService)
    .delete(authorize('admin'), deleteService);

module.exports = router;
