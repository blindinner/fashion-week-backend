import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPromise = open({
    filename: path.resolve( 'tickets.db'),
    driver: sqlite3.Database
});

export async function initDb() {
    const db = await dbPromise;
    // Create seats table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      seat_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      price REAL NOT NULL,
      reserved_until DATETIME
    );
  `);
    // Create reservations table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      selected_seats TEXT,
      total_amount REAL,
      status TEXT,
      tranzila_confirmation_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );
  `);
    // Seed seats if empty
    const { count } = await db.get('SELECT COUNT(*) as count FROM seats');
    if (count === 0) {
        // Section A and B, 25 rows, 8 seats per row
        for (const section of ['A', 'B']) {
            for (let row = 1; row <= 25; row++) {
                let price = 100;
                if (row >= 1 && row <= 3) price = 150;
                // You can adjust pricing logic here
                for (let seat = 1; seat <= 8; seat++) {
                    await db.run(
                        'INSERT INTO seats (section, row_number, seat_number, status, price) VALUES (?, ?, ?, ?, ?)',
                        [section, row, seat, Math.random() < 0.05 ? 'sold' : 'available', price]
                    );
                }
            }
        }
    }
    return db;
}

export default dbPromise; 