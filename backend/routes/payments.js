'use strict';
const express  = require('express');
const router   = express.Router();
const mpesa    = require('../controllers/mpesaController');
const pesapal  = require('../controllers/pesapalController');

router.post('/mpesa/stk',      mpesa.initiateStk);
router.post('/mpesa/callback', mpesa.mpesaCallback);
router.post('/mpesa/query',    mpesa.queryStk);

router.post('/pesapal/init',   pesapal.initPayment);
router.post('/pesapal/ipn',    pesapal.pesapalIpn);
router.get('/pesapal/status/:trackingId', pesapal.checkStatus);

module.exports = router;
