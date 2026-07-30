const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, forgotPassword } = require('../controllers/customerAuthController');
const { protectCustomer } = require('../middleware/customerAuth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

router.get('/me', protectCustomer, getMe);
router.put('/profile', protectCustomer, updateProfile);
router.put('/change-password', protectCustomer, changePassword);

module.exports = router;
