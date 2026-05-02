'use strict';
const db      = require('../config/db');
const multer  = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

// ── CLOUDINARY CONFIG ─────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── MULTER — memory storage (no disk) ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Images only'));
  }
});
exports.upload = upload;

// ── UPLOAD BUFFER TO CLOUDINARY ───────────────────────────────
async function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'daharibooks', public_id: `book-${Date.now()}`, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

// ── GET ALL PRODUCTS (public) ─────────────────────────────────
async function getProducts(req, res) {
  try {
    const { cat, search, page = 1, limit = 200 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where  = ['p.is_active = 1'];
    const params = [];

    if (cat && cat !== 'all') {
      where.push('(p.categories LIKE ? OR p.categories LIKE ? OR p.categories LIKE ? OR p.categories = ?)');
      params.push(`${cat} %`, `% ${cat} %`, `% ${cat}`, cat);
    }
    if (search) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [products] = await db.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price, p.old_price, p.emoji, p.image_url, p.badge, p.categories, p.stock
       FROM products p ${w}
       ORDER BY p.sort_order ASC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ products });
  } catch (err) {
    console.error('getProducts:', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
}

// ── GET SINGLE PRODUCT ────────────────────────────────────────
async function getProduct(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

// ── CREATE PRODUCT (admin) ────────────────────────────────────
async function createProduct(req, res) {
  try {
    const { name, description = '', price, old_price = null, emoji = '📚', badge = '', categories, stock = 99, sort_order = 0 } = req.body;
    if (!name || !price || !categories) return res.status(400).json({ error: 'name, price and categories required.' });

    let image_url = req.body.image_url || null;
    if (req.file) {
      try {
        image_url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ error: 'Image upload failed. Check Cloudinary credentials.' });
      }
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') + '-' + Date.now();
    const [result] = await db.query(
      'INSERT INTO products (name, slug, description, price, old_price, emoji, image_url, badge, categories, stock, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [name, slug, description, parseFloat(price), old_price ? parseFloat(old_price) : null, emoji, image_url, badge, categories, parseInt(stock), parseInt(sort_order)]
    );
    res.status(201).json({ id: result.insertId, message: 'Product created.' });
  } catch (err) {
    console.error('createProduct:', err);
    res.status(500).json({ error: 'Failed to create product.' });
  }
}

// ── UPDATE PRODUCT (admin) ────────────────────────────────────
async function updateProduct(req, res) {
  try {
    const allowed = ['name','description','price','old_price','emoji','image_url','badge','categories','stock','sort_order','is_active'];
    const fields  = [];
    const values  = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (req.file) {
      try {
        const cloudUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        fields.push('image_url = ?');
        values.push(cloudUrl);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ error: 'Image upload failed. Check Cloudinary credentials.' });
      }
    }

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

    values.push(req.params.id);
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Product updated.' });
  } catch (err) {
    console.error('updateProduct:', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
}

// ── DELETE PRODUCT (admin — soft delete) ─────────────────────
async function deleteProduct(req, res) {
  try {
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

// ── ADMIN: GET ALL INCLUDING INACTIVE ────────────────────────
async function adminGetProducts(req, res) {
  try {
    const { search = '', cat = '' } = req.query;
    const where  = [];
    const params = [];
    if (search) { where.push('name LIKE ?'); params.push(`%${search}%`); }
    if (cat)    { where.push('(categories LIKE ? OR categories LIKE ? OR categories LIKE ? OR categories = ?)'); params.push(`${cat} %`, `% ${cat} %`, `% ${cat}`, cat); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [products] = await db.query(
      `SELECT * FROM products ${w} ORDER BY sort_order ASC, id DESC LIMIT 500`,
      params
    );
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
}

module.exports = { upload, getProducts, getProduct, createProduct, updateProduct, deleteProduct, adminGetProducts };
