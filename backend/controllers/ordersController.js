'use strict';
const db = require('../config/db');

async function generateOrderRef() {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const [[{ count }]] = await db.query("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()");
  return `DB-${date}-${String(parseInt(count)+1).padStart(4,'0')}`;
}

// ── PLACE ORDER (public) ──────────────────────────────────────
async function createOrder(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_name, customer_phone, customer_email = null, delivery_address, items, notes = null, payment_method = null } = req.body;
    if (!customer_name || !customer_phone || !delivery_address) return res.status(400).json({ error: 'Name, phone and address required.' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No items in order.' });

    const total    = items.reduce((s, i) => s + parseFloat(i.price) * parseInt(i.qty), 0);
    const orderRef = await generateOrderRef();
    const ip       = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const [r] = await conn.query(
      'INSERT INTO orders (order_ref, customer_name, customer_phone, customer_email, delivery_address, subtotal, total, payment_method, notes, ip_address) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [orderRef, customer_name.trim(), customer_phone.trim(), customer_email, delivery_address.trim(), total, total, payment_method || 'unknown', notes, ip]
    );
    const orderId = r.insertId;

    for (const item of items) {
      const [[product]] = await conn.query('SELECT id FROM products WHERE name = ? LIMIT 1', [item.name]);
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_name, price, qty, emoji) VALUES (?,?,?,?,?,?)',
        [orderId, product?.id || null, item.name, parseFloat(item.price), parseInt(item.qty), item.emoji || '📚']
      );
    }
    await conn.commit();

    const lines    = items.map(i => `• ${i.name} x${i.qty} = KES ${(parseFloat(i.price)*parseInt(i.qty)).toLocaleString()}`).join('\n');
    const waText   = encodeURIComponent(`*New Order – ${orderRef}*\n👤 ${customer_name}\n📱 ${customer_phone}\n📍 ${delivery_address}\n\n${lines}\n\n*Total: KES ${total.toLocaleString()}*`);
    const whatsappUrl = `https://wa.me/${process.env.WHATSAPP_NUMBER || '254718340377'}?text=${waText}`;

    res.status(201).json({ success: true, orderId, orderRef, total, whatsappUrl });
  } catch (err) {
    await conn.rollback();
    console.error('createOrder:', err);
    res.status(500).json({ error: 'Failed to place order.' });
  } finally {
    conn.release();
  }
}

// ── TRACK ORDER (public) ──────────────────────────────────────
async function trackOrder(req, res) {
  try {
    const [orders] = await db.query(
      'SELECT id, order_ref, customer_name, customer_phone, delivery_address, total, payment_status, order_status, created_at FROM orders WHERE order_ref = ?',
      [req.params.ref.toUpperCase()]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });
    const [items] = await db.query('SELECT product_name, price, qty, emoji FROM order_items WHERE order_id = ?', [orders[0].id]);
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

// ── ADMIN: GET ORDERS ─────────────────────────────────────────
async function adminGetOrders(req, res) {
  try {
    const { status, pay_status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page)-1) * parseInt(limit);
    const where  = [];
    const params = [];
    if (status)     { where.push('order_status = ?');   params.push(status); }
    if (pay_status) { where.push('payment_status = ?'); params.push(pay_status); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [orders] = await db.query(
      `SELECT id, order_ref, customer_name, customer_phone, delivery_address, total, payment_method, payment_status, order_status, created_at FROM orders ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM orders ${w}`, params);
    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

// ── ADMIN: GET SINGLE ORDER ───────────────────────────────────
async function adminGetOrder(req, res) {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Not found.' });
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

// ── ADMIN: UPDATE ORDER ───────────────────────────────────────
async function adminUpdateOrder(req, res) {
  try {
    const allowed = {};
    for (const k of ['order_status','payment_status','payment_method','notes']) {
      if (req.body[k] !== undefined) allowed[k] = req.body[k];
    }
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'Nothing to update.' });
    const fields = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE orders SET ${fields} WHERE id = ?`, [...Object.values(allowed), req.params.id]);
    res.json({ message: 'Updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

// ── ADMIN: DASHBOARD STATS ────────────────────────────────────
async function adminDashboard(req, res) {
  try {
    const [[t]] = await db.query(`
      SELECT COUNT(*) AS total_orders,
        SUM(CASE WHEN order_status='new' THEN 1 ELSE 0 END) AS new_orders,
        SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) AS paid_orders,
        COALESCE(SUM(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) AS revenue
      FROM orders`);
    const [[p]] = await db.query("SELECT COUNT(*) AS count FROM products WHERE is_active=1");
    const [recent] = await db.query('SELECT order_ref, customer_name, customer_phone, total, order_status, created_at FROM orders ORDER BY created_at DESC LIMIT 10');
    res.json({
      stats: { total_orders: t.total_orders, new_orders: t.new_orders||0, paid_orders: t.paid_orders||0, revenue: parseFloat(t.revenue||0).toFixed(2), total_products: p.count },
      recent_orders: recent
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

module.exports = { createOrder, trackOrder, adminGetOrders, adminGetOrder, adminUpdateOrder, adminDashboard };
