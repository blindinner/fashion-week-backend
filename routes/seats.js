import express from 'express';
import supabase from '../config/supabase.js';

const router = express.Router();

// GET /api/seats/areas?eventId=xxx - Get area summaries
router.get('/areas', async (req, res) => {
    try {
        const { eventId } = req.query;

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        // Get area summaries with availability counts
        const { data: areaData, error: areaError } = await supabase
            .from('seats')
            .select('area, row_number, seat_number, status')
            .eq('event_id', eventId)
            .order('area')
            .order('row_number')
            .order('seat_number');

        if (areaError) {
            console.error('Error fetching area data:', areaError);
            return res.status(500).json({ error: 'Failed to fetch area data' });
        }

        // Process data into area summaries
        const areas = {
            A: { 1: { available: 0, total: 0 }, 2: { available: 0, total: 0 }, 3: { available: 0, total: 0 } },
            B: { 1: { available: 0, total: 0 }, 2: { available: 0, total: 0 }, 3: { available: 0, total: 0 } }
        };

        // Group seats by area and area group (1: seats 1-20, 2: seats 21-44, 3: seats 45-64)
        areaData.forEach(seat => {
            let areaGroup;
            if (seat.seat_number >= 1 && seat.seat_number <= 20) {
                areaGroup = 1;
            } else if (seat.seat_number >= 21 && seat.seat_number <= 44) {
                areaGroup = 2;
            } else if (seat.seat_number >= 45 && seat.seat_number <= 64) {
                areaGroup = 3;
            }

            if (areaGroup && areas[seat.area] && areas[seat.area][areaGroup]) {
                areas[seat.area][areaGroup].total++;
                if (seat.status === 'available') {
                    areas[seat.area][areaGroup].available++;
                }
            }
        });

        res.json({ areas });
    } catch (error) {
        console.error('Error in areas endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/seats?eventId=xxx&areaGroup=1|2|3
router.get('/', async (req, res) => {
    try {
        const { eventId, areaGroup } = req.query;

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        // First, get the event pricing
        const { data: eventPricing, error: pricingError } = await supabase
            .from('event_pricing')
            .select('area, row_number, price')
            .eq('event_id', eventId);

        if (pricingError) {
            console.error('Error fetching event pricing:', pricingError);
            return res.status(500).json({ error: 'Failed to fetch pricing' });
        }

        // Then, get seats for this event (optionally filter by areaGroup -> seat_number ranges)
        let query = supabase
            .from('seats')
            .select('*')
            .eq('event_id', eventId);

        // Apply seat_number range based on areaGroup if provided
        if (areaGroup === '1') {
            query = query.gte('seat_number', 1).lte('seat_number', 20);
        } else if (areaGroup === '2') {
            query = query.gte('seat_number', 21).lte('seat_number', 44);
        } else if (areaGroup === '3') {
            query = query.gte('seat_number', 45).lte('seat_number', 64);
        }

        query = query.order('area').order('row_number').order('seat_number');

        const { data: seats, error: seatsError } = await query;

        if (seatsError) {
            console.error('Error fetching seats:', seatsError);
            return res.status(500).json({ error: 'Failed to fetch seats' });
        }

        // Combine seats with pricing information
        const seatsWithPricing = seats.map(seat => {
            const pricing = eventPricing.find(p =>
                p.area === seat.area && p.row_number === seat.row_number
            );
            return {
                ...seat,
                price: pricing ? parseFloat(pricing.price) : 0
            }
        });

        res.json(seatsWithPricing);

    } catch (error) {
        console.error('Supabase seats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/seats/check/:seatId
router.get('/check/:seatId', async (req, res) => {
    try {
        const { seatId } = req.params;

        const { data: seat, error } = await supabase
            .from('seats')
            .select(`
                *,
                bookings (
                    id,
                    user_email,
                    total_amount,
                    created_at
                )
            `)
            .eq('id', seatId)
            .single();

        if (error || !seat) {
            return res.status(404).json({ error: 'Seat not found' });
        }

        res.json({
            seatId: seat.id,
            seatNumber: seat.seat_number,
            area: seat.area,
            status: seat.status,
            isAvailable: seat.status === 'available',
            booking: seat.status === 'booked' ? seat.bookings : null
        });

    } catch (error) {
        console.error('Check seat availability error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/seats/events - List all events
router.get('/events', async (req, res) => {
    try {
        const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .order('date');

        if (error) {
            console.error('Error fetching events:', error);
            return res.status(500).json({ error: 'Failed to fetch events' });
        }

        res.json(events);

    } catch (error) {
        console.error('Supabase events error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
