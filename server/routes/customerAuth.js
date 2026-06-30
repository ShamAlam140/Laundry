const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile } = require('../controllers/customerAuthController');
const { protectCustomer } = require('../middleware/customerAuth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protectCustomer, getMe);
router.put('/profile', protectCustomer, updateProfile);

module.exports = router;
