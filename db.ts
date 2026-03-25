import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

export async function initDb() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // Create Tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'student'
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            image_url TEXT
        );

        CREATE TABLE IF NOT EXISTS time_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            display_time TEXT NOT NULL,
            max_orders INTEGER DEFAULT 10,
            current_orders INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_code TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL,
            slot_id INTEGER NOT NULL,
            status TEXT DEFAULT 'in_attesa',
            total_price REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (slot_id) REFERENCES time_slots(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price_at_order REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // Seed initial data if empty
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
        const adminPassword = await bcrypt.hash('admin123', 10);
        await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', ['admin@lscgalilei.it', adminPassword, 'admin']);
        
        // Products
        await db.run('INSERT INTO products (name, price, category) VALUES (?, ?, ?)', ['Panino Cotto e Formaggio', 3.50, 'Panini']);
        await db.run('INSERT INTO products (name, price, category) VALUES (?, ?, ?)', ['Pizzetta Margherita', 2.50, 'Pizze']);
        await db.run('INSERT INTO products (name, price, category) VALUES (?, ?, ?)', ['Acqua Naturale 500ml', 1.00, 'Bevande']);
        await db.run('INSERT INTO products (name, price, category) VALUES (?, ?, ?)', ['Coca Cola 33cl', 1.50, 'Bevande']);
        await db.run('INSERT INTO products (name, price, category) VALUES (?, ?, ?)', ['Cornetto Crema', 1.20, 'Dolci']);

        // Time Slots
        await db.run('INSERT INTO time_slots (display_time, max_orders) VALUES (?, ?)', ['10:55 - 11:00', 15]);
        await db.run('INSERT INTO time_slots (display_time, max_orders) VALUES (?, ?)', ['11:00 - 11:05', 15]);
        await db.run('INSERT INTO time_slots (display_time, max_orders) VALUES (?, ?)', ['11:05 - 11:10', 10]);
    }

    return db;
}
