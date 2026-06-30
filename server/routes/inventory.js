const express = require('express');
const router = express.Router();
const {
    getItems,
    getItem,
    createItem,
    updateItem,
    restockItem,
    deleteItem,
    getLowStockAlerts,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/alerts', getLowStockAlerts);
router.get('/', getItems);
router.get('/:id', getItem);
router.post('/', authorize('admin', 'manager'), createItem);
router.put('/:id', authorize('admin', 'manager'), updateItem);
router.patch('/:id/restock', authorize('admin', 'manager'), restockItem);
router.delete('/:id', authorize('admin'), deleteItem);

module.exports = router;
