'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/productsController');
const { requireAdmin } = require('../middleware/auth');

// Public
router.get('/',    ctrl.getProducts);
router.get('/:id', ctrl.getProduct);

// Admin
const upload = require('../controllers/productsController').upload;
router.post('/',      requireAdmin, upload.single('image'), ctrl.createProduct);
router.put('/:id',    requireAdmin, upload.single('image'), ctrl.updateProduct);
router.delete('/:id', requireAdmin, ctrl.deleteProduct);

module.exports = router;
