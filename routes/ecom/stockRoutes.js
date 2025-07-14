const express = require('express');
const router = express.Router();
const stockController = require('../../controllers/ecom/stockController');
const ecomAuthMiddleware = require('../../middleware/ecom/auth');

// Stock status endpoint (no auth required for reading stock levels)
router.get('/status', stockController.getStockStatus);

// All other stock routes require authentication
router.use(ecomAuthMiddleware);

router.get('/', stockController.getAllStock);
router.get('/low-stock', stockController.getLowStock);
router.post('/', stockController.addStock);
router.put('/:id', stockController.updateStock);

// New enhanced endpoints
router.put('/bulk-update', stockController.bulkUpdateStock);
router.put('/settings', stockController.updateStockSettings);

module.exports = router;
