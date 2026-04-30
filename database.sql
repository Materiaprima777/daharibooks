-- Dahari Books Database Schema v2
-- Run this in Railway MySQL Query tab

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  full_name     VARCHAR(100) DEFAULT NULL,
  last_login    TIMESTAMP    DEFAULT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(220) NOT NULL UNIQUE,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  old_price   DECIMAL(10,2) DEFAULT NULL,
  emoji       VARCHAR(10)   DEFAULT '📚',
  image_url   VARCHAR(500)  DEFAULT NULL,
  badge       ENUM('','new','hot','sale','popular') DEFAULT '',
  categories  VARCHAR(300)  NOT NULL,
  stock       SMALLINT      DEFAULT 99,
  is_active   TINYINT(1)    DEFAULT 1,
  sort_order  SMALLINT      DEFAULT 0,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active),
  INDEX idx_cats   (categories(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_ref        VARCHAR(20)  NOT NULL UNIQUE,
  customer_name    VARCHAR(150) NOT NULL,
  customer_phone   VARCHAR(20)  NOT NULL,
  customer_email   VARCHAR(150) DEFAULT NULL,
  delivery_address TEXT         NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method   ENUM('mpesa','visa','cash','pending') DEFAULT 'pending',
  payment_status   ENUM('pending','paid','failed') DEFAULT 'pending',
  order_status     ENUM('new','confirmed','packed','dispatched','delivered','cancelled') DEFAULT 'new',
  notes            TEXT,
  ip_address       VARCHAR(45)  DEFAULT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (order_status),
  INDEX idx_phone  (customer_phone),
  INDEX idx_date   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED DEFAULT NULL,
  product_name VARCHAR(200) NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  qty          SMALLINT     NOT NULL DEFAULT 1,
  emoji        VARCHAR(10)  DEFAULT '📚',
  subtotal     DECIMAL(10,2) GENERATED ALWAYS AS (price * qty) STORED,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id            INT UNSIGNED DEFAULT NULL,
  provider            ENUM('mpesa','pesapal') NOT NULL,
  checkout_request_id VARCHAR(100) DEFAULT NULL,
  pesapal_tracking_id VARCHAR(100) DEFAULT NULL,
  mpesa_ref           VARCHAR(50)  DEFAULT NULL,
  amount              DECIMAL(10,2) DEFAULT NULL,
  status              ENUM('pending','paid','failed') DEFAULT 'pending',
  raw_callback        TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed products
INSERT INTO products (name, slug, price, old_price, emoji, image_url, badge, categories, stock) VALUES
('Chess Board','chess-board',1000.00,NULL,'♟️',NULL,'hot','board-games age-8-12',20),
('Snake & Ladders','snake-ladders',850.00,NULL,'🎲',NULL,'','board-games age-8-12',25),
('Scrabble','scrabble',1500.00,NULL,'🔤',NULL,'hot','board-games age-8-12',15),
('Modelling Clay','modelling-clay',230.00,NULL,'🎨',NULL,'','stationery',50),
('Colour Pencils','colour-pencils',230.00,NULL,'✏️',NULL,'','stationery',60),
('Notebook','notebook',150.00,NULL,'📔',NULL,'','stationery',80),
('Numbers Board Book','numbers-board-book',900.00,NULL,'🔢',NULL,'new','board-books',30),
("It's Time to Wash",'its-time-to-wash',500.00,NULL,'🛁',NULL,'','board-books',25),
('Animals Board Books','animals-board-books',550.00,NULL,'🐻',NULL,'','board-books',30),
('Ziara ya Kijijini','ziara-ya-kijijini',450.00,NULL,'🌍',NULL,'','story-books age-8-12',20),
('Usiku wa Hofu','usiku-wa-hofu',450.00,NULL,'👻',NULL,'','story-books age-8-12',20),
("Papa's Fingers",'papas-fingers',950.00,1000.00,'👨‍👧',NULL,'sale','fathers-day',10),
('Nipo Nyumbani','nipo-nyumbani',600.00,NULL,'🏠',NULL,'','fathers-day',15),
('Jesus Calling for Kids','jesus-calling-kids',1200.00,NULL,'🙏',NULL,'','devotional',12),
('The Very First Christmas','very-first-christmas',800.00,NULL,'🎄',NULL,'new','devotional christmas',10),
('Mama Watoto','mama-watoto',700.00,NULL,'🇰🇪',NULL,'new','kenyan-authors',15),
('Animals of the Savannah','animals-savannah',850.00,NULL,'🦁',NULL,'','animal-books kenyan-authors age-8-12',18),
('Diary of a Wimpy Kid','diary-wimpy-kid',1100.00,NULL,'📓',NULL,'','teen age-8-12',20),
('Rainbow Fish','rainbow-fish',650.00,NULL,'🌈',NULL,'hot','age-4-9',22),
('I Love My Daddy','i-love-my-daddy',850.00,NULL,'📚','https://daharibooks.neocities.org/IMG20250422115342.jpg','','age-4-9',18),
('Little Miss Books','little-miss-books',750.00,NULL,'📚','https://daharibooks.neocities.org/IMG20250423105204.jpg','','age-4-9',20),
('Picture Book Collection','picture-book-collection',800.00,NULL,'📚','https://daharibooks.neocities.org/IMG20250423105235.jpg','','age-4-9',16),
('Illustrated Story Book','illustrated-story-book',900.00,NULL,'📚','https://daharibooks.neocities.org/IMG_20250423_105435.jpg','hot','age-4-9',14),
("First Children's Encyclopedia",'first-childrens-encyclopedia',1300.00,NULL,'📘','https://daharibooks.neocities.org/IMG20260108095407.jpg','hot','dictionary age-8-12',10),
('The Forever Tree','the-forever-tree',900.00,NULL,'🔊','https://daharibooks.neocities.org/IMG20260106123218.jpg','','phonic-books',15),
('My First Words Luo','my-first-words-luo',850.00,NULL,'🔊','https://daharibooks.neocities.org/IMG20251217165450.jpg','new','phonic-books',20)
ON DUPLICATE KEY UPDATE price=VALUES(price);

-- Default admin (password: admin123 — CHANGE THIS!)
INSERT INTO admin_users (username, password_hash, full_name)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMnuPVKX5ePXDCDIIJjuLHOuGe', 'Dahari Admin')
ON DUPLICATE KEY UPDATE username=username;
