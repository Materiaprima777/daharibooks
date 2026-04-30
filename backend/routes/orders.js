'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ordersController');
const { requireAdmin } = require('../middleware/auth');

router.post('/',               ctrl.createOrder);
router.get('/track/:ref',      ctrl.trackOrder);
router.get('/admin/dashboard', requireAdmin, ctrl.adminDashboard);
router.get('/admin',           requireAdmin, ctrl.adminGetOrders);
router.get('/admin/:id',       requireAdmin, ctrl.adminGetOrder);
router.patch('/admin/:id',     requireAdmin, ctrl.adminUpdateOrder);

module.exports = router;
