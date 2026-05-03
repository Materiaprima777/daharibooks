'use strict';
const express  = require('express');
const router   = express.Router();
const mpesa    = require('../controllers/mpesaController');
const pesapal  = require('../controllers/pesapalController');

// TEMP DEBUG - remove after fixing
router.get('/mpesa/debug', (req, res) => {
  const key = process.env.MPESA_CONSUMER_KEY || '';
  const sec = process.env.MPESA_CONSUMER_SECRET || '';
  res.json({
    env: process.env.MPESA_ENV || 'NOT SET',
    shortcode: process.env.MPESA_SHORTCODE || 'NOT SET',
    key_len: key.length,
    key_prefix: key.slice(0, 8),
    key_suffix: key.slice(-4),
    sec_len: sec.length,
    sec_prefix: sec.slice(0, 8),
    sec_suffix: sec.slice(-4),
    callback: process.env.MPESA_CALLBACK_URL || 'NOT SET',
    passkey_set: !!process.env.MPESA_PASSKEY,
    passkey_len: (process.env.MPESA_PASSKEY||'').length,
  });
});

router.post('/mpesa/stk',      mpesa.initiateStk);
router.post('/mpesa/callback', mpesa.mpesaCallback);
router.post('/mpesa/query',    mpesa.queryStk);

router.post('/pesapal/init',   pesapal.initPayment);
router.post('/pesapal/ipn',    pesapal.pesapalIpn);
router.get('/pesapal/status/:trackingId', pesapal.checkStatus);

module.exports = router;
