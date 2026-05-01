'use strict';
const mysql = require('mysql2/promise');

let poolConfig;

// Railway provides MYSQL_URL automatically when you add a MySQL plugin
if (process.env.MYSQL_URL) {
  poolConfig = {
    uri: process.env.MYSQL_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
} else {
  poolConfig = {
    host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306'),
    user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME     || process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

const pool = mysql.createPool(poolConfig);

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected');
    conn.release();
  })
  .catch(err => console.error('❌ MySQL error:', err.message));

module.exports = pool;
