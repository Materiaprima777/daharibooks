'use strict';
const axios = require('axios');
const db    = require('../config/db');

function base() {
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

async function getToken() {
  const { data } = await axios.get(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
    auth: { username: process.env.MPESA_CONSUMER_KEY||'', password: process.env.MPESA_CONSUMER_SECRET||'' }
  });
  return data.access_token;
}

async function initiateStk(req, res) {
  try {
    const { phone, amount, orderId, orderRef } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required.' });

    const token     = await getToken();
    const shortcode = process.env.MPESA_SHORTCODE || '';
    const passkey   = process.env.MPESA_PASSKEY   || '';
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g,'').slice(0,14);
    const password  = Buffer.from(shortcode + passkey + timestamp).toString('base64');
    const sanitized = phone.replace(/\D/g,'').replace(/^0/,'254').replace(/^254254/,'254');
    const callbackURL = process.env.MPESA_CALLBACK_URL || `${process.env.SITE_URL}/api/payments/mpesa/callback`;

    const { data } = await axios.post(`${base()}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount), PartyA: sanitized, PartyB: shortcode,
      PhoneNumber: sanitized, CallBackURL: callbackURL,
      AccountReference: orderRef || 'DahariBooks',
      TransactionDesc: `Order ${orderRef||''}`
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (orderId) {
      await db.query(
        'INSERT INTO payment_transactions (order_id, provider, checkout_request_id, amount) VALUES (?,?,?,?)',
        [orderId, 'mpesa', data.CheckoutRequestID, amount]
      );
    }
    res.json({ success: true, checkoutRequestId: data.CheckoutRequestID, message: 'Enter PIN on your phone.' });
  } catch (err) {
    console.error('initiateStk:', err?.response?.data || err.message);
    res.status(500).json({ error: 'M-Pesa payment failed. Please try again.' });
  }
}

async function mpesaCallback(req, res) {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return res.status(200).json({ ResultCode: 0 });
    const { CheckoutRequestID, ResultCode, CallbackMetadata } = body;
    const status   = ResultCode === 0 ? 'paid' : 'failed';
    const meta     = CallbackMetadata?.Item || [];
    const mpesaRef = meta.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

    await db.query(
      'UPDATE payment_transactions SET status=?, mpesa_ref=?, raw_callback=? WHERE checkout_request_id=?',
      [status, mpesaRef||null, JSON.stringify(req.body), CheckoutRequestID]
    );
    if (status === 'paid') {
      const [rows] = await db.query('SELECT order_id FROM payment_transactions WHERE checkout_request_id=?', [CheckoutRequestID]);
      if (rows.length) await db.query("UPDATE orders SET payment_status='paid', payment_method='mpesa' WHERE id=?", [rows[0].order_id]);
    }
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('mpesaCallback:', err);
    res.status(200).json({ ResultCode: 0 });
  }
}

async function queryStk(req, res) {
  try {
    const { checkoutRequestId } = req.body;
    const token     = await getToken();
    const shortcode = process.env.MPESA_SHORTCODE || '';
    const passkey   = process.env.MPESA_PASSKEY   || '';
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g,'').slice(0,14);
    const password  = Buffer.from(shortcode + passkey + timestamp).toString('base64');
    const { data }  = await axios.post(`${base()}/mpesa/stkpushquery/v1/query`, {
      BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    }, { headers: { Authorization: `Bearer ${token}` } });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Query failed.' });
  }
}

module.exports = { initiateStk, mpesaCallback, queryStk };
