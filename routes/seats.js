import express from 'express';
import dbPromise from '../config/database.js';

const router = express.Router();

// GET /api/seats
router.get('/', async (req, res) => {
  const db = await dbPromise;
  const seats = await db.all('SELECT * FROM seats ORDER BY section, row_number, seat_number');
  res.json(seats);
});

export default router; 