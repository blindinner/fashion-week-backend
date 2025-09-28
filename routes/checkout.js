import express from 'express';
import dbPromise from '../config/database.js';
import { generateTicketPDF } from '../ticket-pdf.js';
import fs from 'fs';

const router = express.Router();

// POST /api/checkout/prepare
router.post('/prepare', async (req, res) => {
    const db = await dbPromise;
    const { selectedSeats, customerName, customerEmail, customerPhone } = req.body;
    if (!selectedSeats || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
        return res.status(400).json({ error: 'No seats selected.' });
    }
    // Validate seat availability
    const placeholders = selectedSeats.map(() => '?').join(',');
    const seats = await db.all(
        `SELECT * FROM seats WHERE id IN (${placeholders})`,
        selectedSeats
    );
    if (seats.length !== selectedSeats.length) {
        return res.status(400).json({ error: 'Some seats do not exist.' });
    }
    if (seats.some(seat => seat.status !== 'available')) {
        return res.status(409).json({ error: 'One or more seats are not available.' });
    }
    // Calculate total amount
    const totalAmount = seats.reduce((sum, seat) => sum + seat.price, 0);
    // Mark seats as pending
    const reservedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await Promise.all(
        seats.map(seat =>
            db.run(
                'UPDATE seats SET status = ?, reserved_until = ? WHERE id = ?',
                ['pending', reservedUntil, seat.id]
            )
        )
    );
    // Create reservation
    const result = await db.run(
        `INSERT INTO reservations (customer_name, customer_email, customer_phone, selected_seats, total_amount, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), ?)`,
        [customerName, customerEmail, customerPhone, JSON.stringify(selectedSeats), totalAmount, reservedUntil]
    );
    const reservationId = result.lastID;
    // Generate payment URL (Tranzila example, replace with real params)
    const supplierId = process.env.PAYMENT_SUPPLIER_ID || 'demo_supplier_123';
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const paymentUrl = `https://secure5.tranzila.com/cgi-bin/tranzila31u.cgi?supplier=${supplierId}&sum=${totalAmount}&email=${encodeURIComponent(customerEmail)}&success_url=${encodeURIComponent(baseUrl + '/api/checkout/payment/success')}&error_url=${encodeURIComponent(baseUrl + '/api/checkout/payment/error')}&user_name=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(customerPhone)}&reservation_id=${reservationId}`;
    res.json({ paymentUrl, reservationId });
});

// POST /api/payment/success
router.post('/payment/success', async (req, res) => {
    const db = await dbPromise;
    const { reservationId, tranzilaConfirmationCode } = req.body;
    if (!reservationId) {
        return res.status(400).json({ error: 'Missing reservationId' });
    }
    // Get reservation
    const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', reservationId);
    if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
    }
    if (reservation.status === 'paid') {
        return res.json({ message: 'Already paid' });
    }
    // Mark reservation as paid
    await db.run('UPDATE reservations SET status = ?, tranzila_confirmation_code = ? WHERE id = ?', ['paid', tranzilaConfirmationCode || null, reservationId]);
    // Mark seats as sold
    const seatIds = JSON.parse(reservation.selected_seats);
    await Promise.all(
        seatIds.map(id => db.run('UPDATE seats SET status = ?, reserved_until = NULL WHERE id = ?', ['sold', id]))
    );
    // Generate PDF ticket for the first seat (for testing)
    const seat = await db.get('SELECT * FROM seats WHERE id = ?', seatIds[0]);
    // Example event info (replace with real event lookup if needed)
    const eventInfo = {
        designer: seat.event_name || 'Event Name',
        date: seat.event_date || 'June 12, 2025',
        time: seat.event_time || '8:30 PM',
        venue: 'Tel Aviv Port',
    };
    const pdfBytes = await generateTicketPDF({
        designer: eventInfo.designer,
        date: eventInfo.date,
        time: eventInfo.time,
        section: seat.section || 'A',
        row: seat.row || '1',
        seat: seat.seat_number || seat.id,
        venue: eventInfo.venue,
        reservationId: reservationId,
    });
    // Save PDF to disk for testing
    fs.writeFileSync(`backend/ticket-${reservationId}.pdf`, pdfBytes);
    // (Stub) Send ticket email
    // TODO: Implement real email sending
    console.log(`Send ticket email to ${reservation.customer_email} for reservation ${reservationId}`);
    res.json({ message: 'Payment successful, seats marked as sold, ticket PDF generated (test only)' });
});

// POST /api/payment/error
router.post('/payment/error', async (req, res) => {
    const db = await dbPromise;
    const { reservationId } = req.body;
    if (!reservationId) {
        return res.status(400).json({ error: 'Missing reservationId' });
    }
    // Get reservation
    const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', reservationId);
    if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
    }
    if (reservation.status === 'failed' || reservation.status === 'expired') {
        return res.json({ message: 'Already marked as failed/expired' });
    }
    // Mark reservation as failed
    await db.run('UPDATE reservations SET status = ? WHERE id = ?', ['failed', reservationId]);
    // Release seats
    const seatIds = JSON.parse(reservation.selected_seats);
    await Promise.all(
        seatIds.map(id => db.run('UPDATE seats SET status = ?, reserved_until = NULL WHERE id = ?', ['available', id]))
    );
    res.json({ message: 'Payment failed, seats released' });
});

// GET /api/reservation/:id
router.get('/reservation/:id', async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', id);
    if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
    }
    // Parse seat IDs for response
    reservation.selected_seats = JSON.parse(reservation.selected_seats);
    res.json(reservation);
});

export default router; 