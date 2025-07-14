const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/ecom/customerController');
const ecomAuthMiddleware = require('../../middleware/ecom/auth');

// Public endpoint for customer analytics (dashboard)
router.get('/analytics', customerController.getCustomerAnalytics);

// TEMPORARILY DISABLED AUTH FOR FRONTEND TESTING - ENABLE FOR PRODUCTION
// All other customer routes require authentication
// router.use(ecomAuthMiddleware);

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.addCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
