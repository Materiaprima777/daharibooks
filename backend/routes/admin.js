'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

router.post('/login',           ctrl.login);
router.post('/logout',          requireAdmin, ctrl.logout);
router.get('/me',               requireAdmin, ctrl.me);
router.post('/change-password', requireAdmin, ctrl.changePassword);

module.exports = router;
