'use strict';
const axios = require('axios');
const db    = require('../config/db');

function base() {
  return process.env.PESAPAL_ENV === 'production'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';
}

async function getToken() {
  const { data } = await axios.post(`${base()}/api/Auth/RequestToken`, {
    consumer_key:    process.env.PESAPAL_CONSUMER_KEY    || '',
    consumer_secret: process.env.PESAPAL_CONSUMER_SECRET || ''
  }, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
  return data.token;
}

async function initPayment(req, res) {
  try {
    const { amount, phone, email, name, orderRef, orderId } = req.body;
    if (!amount || !name) return res.status(400).json({ error: 'amount and name required.' });

    const token = await getToken();
    const ipnUrl = process.env.PESAPAL_IPN_URL || `${process.env.SITE_URL}/api/payments/pesapal/ipn`;
    const ipnRes = await axios.post(`${base()}/api/IPNRegistration`,
      { url: ipnUrl, ipn_notification_type: 'POST' },
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' } }
    );

    const { data } = await axios.post(`${base()}/api/Transactions/SubmitOrderRequest`, {
      id: orderRef || `DB-${Date.now()}`, currency: 'KES', amount: parseFloat(amount),
      description: `Dahari Books order ${orderRef||''}`,
      callback_url: `${process.env.SITE_URL}/payment-complete.html`,
      notification_id: ipnRes.data.ipn_id,
      billing_address: {
        email_address: email || '',
        phone_number:  phone || '',
        first_name:    name.split(' ')[0],
        last_name:     name.split(' ').slice(1).join(' ') || ''
      }
    }, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' } });

    if (orderId) {
      await db.query(
        'INSERT INTO payment_transactions (order_id, provider, pesapal_tracking_id, amount) VALUES (?,?,?,?)',
        [orderId, 'pesapal', data.order_tracking_id, amount]
      );
    }
    res.json({ success: true, redirectUrl: data.redirect_url, trackingId: data.order_tracking_id });
  } catch (err) {
    console.error('pesapal initPayment:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Pesapal payment failed.' });
  }
}

async function pesapalIpn(req, res) {
  try {
    const { OrderTrackingId, OrderMerchantReference } = req.body;
    if (!OrderTrackingId) return res.status(200).json({ status: 200 });
    const token  = await getToken();
    const { data } = await axios.get(
      `${base()}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    const paid = data.payment_status_description === 'Completed';
    await db.query('UPDATE payment_transactions SET status=?, raw_callback=? WHERE pesapal_tracking_id=?',
      [paid?'paid':'pending', JSON.stringify(data), OrderTrackingId]);
    if (paid) {
      const [rows] = await db.query('SELECT order_id FROM payment_transactions WHERE pesapal_tracking_id=?', [OrderTrackingId]);
      if (rows.length) await db.query("UPDATE orders SET payment_status='paid', payment_method='visa' WHERE id=?", [rows[0].order_id]);
    }
    res.status(200).json({ orderNotificationType: 'IPNCHANGE', orderTrackingId: OrderTrackingId, orderMerchantReference: OrderMerchantReference, status: 200 });
  } catch (err) {
    console.error('pesapalIpn:', err);
    res.status(200).json({ status: 200 });
  }
}

async function checkStatus(req, res) {
  try {
    const token  = await getToken();
    const { data } = await axios.get(
      `${base()}/api/Transactions/GetTransactionStatus?orderTrackingId=${req.params.trackingId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Status check failed.' });
  }
}

module.exports = { initPayment, pesapalIpn, checkStatus };
