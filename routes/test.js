import express from 'express';
import supabase from '../config/supabase.js';

const router = express.Router();

// GET /api/test/supabase-connection
router.get('/supabase-connection', async (req, res) => {
    try {
        console.log('=== TESTING SUPABASE CONNECTION ===');

        // Test basic connection
        const { data, error } = await supabase
            .from('events')
            .select('id, name')
            .limit(1);

        if (error) {
            console.error('Supabase connection error:', error);
            return res.status(500).json({
                success: false,
                error: 'Supabase connection failed',
                details: error.message,
                code: error.code,
                hint: error.hint
            });
        }

        console.log('Supabase connection successful');
        return res.json({
            success: true,
            message: 'Supabase connection successful',
            data: data,
            environment: {
                SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
                NODE_ENV: process.env.NODE_ENV || 'development'
            }
        });

    } catch (error) {
        console.error('Test endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: 'Test endpoint failed',
            details: error.message
        });
    }
});

// POST /api/test/fix-booking-event-ids
router.post('/fix-booking-event-ids', async (req, res) => {
    try {
        console.log('🔍 Fixing booking event IDs...');

        // Get the correct event ID
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('id, name')
            .limit(1);

        if (eventsError || !events.length) {
            return res.status(500).json({ error: 'No events found' });
        }

        const correctEventId = events[0].id;
        console.log('🎯 Correct event ID:', correctEventId);

        // Update all bookings to use the correct event ID
        const { data: updatedBookings, error: updateError } = await supabase
            .from('bookings')
            .update({ event_id: correctEventId })
            .neq('event_id', correctEventId)
            .select('id, event_id, user_name');

        if (updateError) {
            console.error('❌ Error updating bookings:', updateError);
            return res.status(500).json({ error: 'Failed to update bookings' });
        }

        console.log(`✅ Updated ${updatedBookings?.length || 0} bookings`);

        res.json({
            success: true,
            message: `Updated ${updatedBookings?.length || 0} bookings`,
            correctEventId,
            updatedBookings: updatedBookings?.length || 0
        });

    } catch (error) {
        console.error('❌ Fix booking event IDs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/test/environment
router.get('/environment', (req, res) => {
    const envVars = {
        SUPABASE_URL: process.env.SUPABASE_URL || 'NOT SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (hidden)' : 'NOT SET',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET (hidden)' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '4000',
        FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
        BACKEND_URL: process.env.BACKEND_URL || 'NOT SET'
    };

    res.json({
        success: true,
        environment: envVars,
        allSupabaseVars: Object.keys(process.env).filter(key => key.startsWith('SUPABASE'))
    });
});

export default router;


