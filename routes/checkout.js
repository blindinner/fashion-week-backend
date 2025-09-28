import express from 'express';
import supabase from '../config/supabase.js';
import axios from 'axios';
import { sendTicketConfirmation } from '../services/emailService.js';

const router = express.Router();

// POST /api/checkout/growin/create
router.post('/growin/create', async (req, res) => {
    try {
        const {
            fullName,
            phone,
            email,
            sum,
            description,
            eventId,
            selectedSeats,
            stayTuned
        } = req.body;

        if (!fullName || !phone || !eventId || !selectedSeats) {
            return res.status(400).json({ error: 'Missing required fields: fullName, phone, eventId, selectedSeats' });
        }

        // First, validate seats and create booking
        const { data: seats, error: seatsError } = await supabase
            .from('seats')
            .select('*')
            .in('id', selectedSeats);

        if (seatsError) {
            console.error('Error fetching seats:', seatsError);
            return res.status(500).json({ error: 'Database error fetching seats' });
        }

        if (seats.length !== selectedSeats.length) {
            return res.status(400).json({ error: 'Some seats do not exist' });
        }

        if (seats.some(seat => seat.status !== 'available')) {
            return res.status(409).json({ error: 'One or more seats are not available' });
        }

        // Get event pricing for total calculation
        const { data: eventPricing, error: pricingError } = await supabase
            .from('event_pricing')
            .select('area,row_number,price')
            .eq('event_id', eventId)
            .in('area', [...new Set(seats.map(s => s.area))])
            .in('row_number', [...new Set(seats.map(s => s.row_number))]);

        if (pricingError) {
            console.error('Error fetching pricing:', pricingError);
            return res.status(500).json({ error: 'Database error fetching pricing' });
        }

        // Calculate total amount using pricing table
        const totalAmount = seats.reduce((sum, seat) => {
            const pricing = eventPricing.find(p =>
                p.area === seat.area && p.row_number === seat.row_number
            );
            return sum + (pricing ? parseFloat(pricing.price) : 0);
        }, 0);

        // Mark seats as reserved for 10 minutes
        const reservedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
            .from('seats')
            .update({
                status: 'reserved',
                reserved_until: reservedUntil
            })
            .in('id', selectedSeats);

        if (updateError) {
            console.error('Error updating seats:', updateError);
            return res.status(500).json({ error: 'Database error updating seats' });
        }

        // Extract seat details for database storage
        const seatAreas = [...new Set(seats.map(s => s.area))].join(',')
        const seatRows = [...new Set(seats.map(s => s.row_number))].join(',')
        const seatNumbers = [...new Set(seats.map(s => s.seat_number))].join(',')

        // Get designer name from event
        const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('designer')
            .eq('id', eventId)
            .single()

        const designerName = eventData?.designer || 'Unknown Designer'

        // Create booking
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                event_id: eventId,
                user_name: fullName,
                user_email: email || '',
                user_phone: phone,
                seat_ids: selectedSeats,
                total_amount: totalAmount,
                payment_status: 'pending',
                stay_tuned: stayTuned || false,
                designer_name: designerName,
                seat_areas: seatAreas,
                seat_rows: seatRows,
                seat_numbers: seatNumbers
            })
            .select()
            .single();

        if (bookingError) {
            console.error('Error creating booking:', bookingError);
            // Release seats if booking creation fails
            await supabase
                .from('seats')
                .update({ status: 'available', reserved_until: null })
                .in('id', selectedSeats);
            return res.status(500).json({ error: 'Database error creating booking' });
        }

        // Now create Grow payment
        const paymentData = {
            pageCode: process.env.GROWIN_PAGE_CODE || "076c48159335",
            userId: process.env.GROWIN_USER_ID || "2c731697f2abda19",
            cancelUrl: `${process.env.FRONTEND_URL || 'https://fashionweektelaviv.com'}/checkout/cancel?bookingId=${booking.id}`,
            successUrl: `${process.env.FRONTEND_URL || 'https://fashionweektelaviv.com'}/checkout/success?bookingId=${booking.id}`,
            // Add backend callback URLs for Grow to call
            notifyUrl: `${process.env.BACKEND_URL || 'https://fashion-week-backend-production.up.railway.app'}/api/checkout/payment/success?bookingId=${booking.id}`,
            errorCallbackUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/checkout/payment/error?bookingId=${booking.id}`,
            description: description || "Tel Aviv Fashion Week Ticket",
            // Always use server-calculated total amount to prevent client tampering
            sum: String(totalAmount.toFixed(2)),
            chargeType: 1,
            "transactionTypes[0]": 1,
            "pageField[fullName]": fullName,
            "pageField[phone]": phone
        };

        // Add email if provided
        if (email) {
            paymentData["pageField[email]"] = email;
        }

        console.log('Calling Grow API with data:', paymentData);

        // Build multipart/form-data body
        const formData = new FormData();
        formData.append('pageCode', paymentData.pageCode);
        formData.append('userId', paymentData.userId);
        formData.append('cancelUrl', paymentData.cancelUrl);
        formData.append('successUrl', paymentData.successUrl);
        formData.append('notifyUrl', paymentData.notifyUrl);
        formData.append('errorCallbackUrl', paymentData.errorCallbackUrl);
        formData.append('description', paymentData.description);
        formData.append('sum', paymentData.sum);
        formData.append('chargeType', String(paymentData.chargeType));
        formData.append('transactionTypes[]', '1');
        formData.append('pageField[fullName]', paymentData['pageField[fullName]']);
        formData.append('pageField[phone]', paymentData['pageField[phone]']);
        if (paymentData['pageField[email]']) {
            formData.append('pageField[email]', paymentData['pageField[email]']);
        }

        // Call Grow API (Production)
        const growResponse = await axios.post(
            'https://secure.meshulam.co.il/api/light/server/1.0/createPaymentProcess',
            formData,
            {
                headers: (typeof (formData).getHeaders === 'function') ? (formData).getHeaders() : {},
                timeout: 10000
            }
        );

        const data = growResponse.data;
        console.log('Grow API response:', data);

        if (data && data.status === 1 && data.data && data.data.authCode) {
            // Update booking with Grow transaction ID
            await supabase
                .from('bookings')
                .update({ growin_transaction_id: data.data.processId })
                .eq('id', booking.id);

            return res.json({
                success: true,
                status: 1,
                authCode: data.data.authCode,
                processId: data.data.processId,
                processToken: data.data.processToken,
                bookingId: booking.id,
                seatIds: selectedSeats,
                reservedUntil: reservedUntil
            });
        }

        return res.status(502).json({ error: data?.err || 'Failed to create Grow payment process' });
    } catch (err) {
        console.error('Supabase Growin create payment error:', err?.response?.data || err.message);
        if (err.response) {
            console.error('Grow API error response:', err.response.data);
        }
        return res.status(500).json({ error: 'Internal server error creating Grow payment process' });
    }
});

// POST /api/checkout/release-seats
router.post('/release-seats', async (req, res) => {
    try {
        const { seatIds } = req.body;

        if (!seatIds || !Array.isArray(seatIds)) {
            return res.status(400).json({ error: 'seatIds array is required' });
        }

        // Release seats immediately
        const { error: updateError } = await supabase
            .from('seats')
            .update({
                status: 'available',
                reserved_until: null
            })
            .in('id', seatIds)
            .eq('status', 'reserved');

        if (updateError) {
            console.error('Error releasing seats:', updateError);
            return res.status(500).json({ error: 'Database error releasing seats' });
        }

        res.json({
            success: true,
            message: 'Seats released successfully'
        });

    } catch (error) {
        console.error('Error releasing seats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/checkout/payment/success
router.post('/payment/success', async (req, res) => {
    try {
        console.log('Payment success endpoint called with:', {
            body: req.body,
            query: req.query,
            headers: req.headers
        });

        // Handle both JSON server notification format and legacy query parameters
        let bookingIdFromReq, transactionData, processId, growinConfirmationCode;

        // Check if this is a JSON server notification from Growin
        // Handle Growin's actual form data format
        if (req.body && req.body['data[status]'] === "1") {
            // Extract data from form format like data[asmachta], data[transactionId], etc.
            transactionData = {
                asmachta: req.body['data[asmachta]'],
                transactionId: req.body['data[transactionId]'],
                transactionToken: req.body['data[transactionToken]'],
                processId: req.body['data[processId]'],
                processToken: req.body['data[processToken]'],
                sum: req.body['data[sum]'],
                fullName: req.body['data[fullName]'],
                payerPhone: req.body['data[payerPhone]'],
                payerEmail: req.body['data[payerEmail]'],
                description: req.body['data[description]'],
                cardBrand: req.body['data[cardBrand]'],
                cardSuffix: req.body['data[cardSuffix]'],
                paymentDate: req.body['data[paymentDate]'],
                status: req.body['data[status]']
            };
            processId = transactionData.processId;
            growinConfirmationCode = transactionData.asmachta;
            console.log('Received Growin server notification (form data):', transactionData);
        } else if (req.body && req.body.data && req.body.status === "1") {
            // JSON format (if they ever send it)
            transactionData = req.body.data;
            processId = transactionData.processId;
            growinConfirmationCode = transactionData.asmachta;
            console.log('Received Growin server notification (JSON):', transactionData);
        } else {
            // Legacy format - Accept identifiers from body or query
            bookingIdFromReq = req.body.bookingId || req.query.bookingId;
            growinConfirmationCode = req.body.growinConfirmationCode || req.query.growinConfirmationCode || req.body.confirmation_number || req.query.confirmation_number || req.body.confirmationNumber || req.query.confirmationNumber;
            processId = req.body.processId || req.query.processId;
        }

        console.log('Extracted identifiers:', {
            bookingIdFromReq,
            growinConfirmationCode,
            processId,
            hasTransactionData: !!transactionData
        });

        let bookingId = bookingIdFromReq;
        let booking = null;

        // Try find booking by bookingId first (if provided)
        let bookingError = null;
        if (bookingId) {
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', bookingId)
                .single();
            if (error) {
                bookingError = error;
                // fall through to try processId
            } else {
                booking = data;
            }
        }

        // If no booking found yet and we have processId, find by growin_transaction_id
        if (!booking && processId) {
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('growin_transaction_id', processId)
                .single();
            if (error) {
                bookingError = error;
            } else if (data) {
                booking = data;
                bookingId = data.id;
            }
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found for provided identifiers' });
        }

        if (bookingError || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.payment_status === 'paid') {
            return res.json({ message: 'Already paid' });
        }

        // Store transaction data in clean columns instead of JSON
        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                // Don't mark as paid yet - wait for ApproveTransaction approval
                growin_transaction_id: processId || booking.growin_transaction_id,
                confirmation_number: growinConfirmationCode || booking.confirmation_number,
                user_email: transactionData?.payerEmail || booking.user_email,

                // Store clean transaction data instead of JSON
                transaction_id: transactionData?.transactionId || null,
                transaction_token: transactionData?.transactionToken || null,
                transaction_sum: transactionData?.sum ? parseFloat(transactionData.sum) : null,
                transaction_status: transactionData?.status || null,
                payer_email: transactionData?.payerEmail || null,
                payer_phone: transactionData?.payerPhone || null,
                card_brand: transactionData?.cardBrand || null,
                card_suffix: transactionData?.cardSuffix || null,
                payment_date: transactionData?.paymentDate || null,

                // Set approve transaction status to pending
                approve_transaction_status: transactionData ? 'pending' : null
            })
            .eq('id', bookingId);

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return res.status(500).json({ error: 'Database error updating booking' });
        }

        // Refresh booking data to get updated email and seat details
        const { data: updatedBooking, error: refreshError } = await supabase
            .from('bookings')
            .select(`
                *,
                events (
                    name,
                    designer,
                    date,
                    time,
                    formatted_date,
                    formatted_time
                )
            `)
            .eq('id', bookingId)
            .single();

        // Fetch seat details for email
        const { data: seatDetails, error: seatDetailsError } = await supabase
            .from('seats')
            .select('area, row_number, seat_number')
            .in('id', updatedBooking.seat_ids);

        if (!seatDetailsError && seatDetails) {
            updatedBooking.seat_details = seatDetails;
        }

        if (refreshError) {
            console.error('Error refreshing booking:', refreshError);
            return res.status(500).json({ error: 'Database error refreshing booking' });
        }

        // Update booking variable with refreshed data
        booking = updatedBooking;

        // Call ApproveTransaction if we have transaction data from server notification OR legacy format
        if (transactionData || (processId && growinConfirmationCode)) {
            try {
                console.log('Calling ApproveTransaction with data:', transactionData);

                const approveData = {
                    pageCode: process.env.GROWIN_PAGE_CODE || "076c48159335",
                    transactionId: parseInt(transactionData.transactionId),
                    transactionToken: transactionData.transactionToken,
                    transactionTypeId: parseInt(transactionData.transactionTypeId),
                    paymentType: parseInt(transactionData.paymentType),
                    sum: parseInt(transactionData.sum),
                    firstPaymentSum: parseInt(transactionData.firstPaymentSum),
                    periodicalPaymentSum: parseInt(transactionData.periodicalPaymentSum),
                    paymentsNum: parseInt(transactionData.paymentsNum),
                    allPaymentsNum: parseInt(transactionData.allPaymentsNum),
                    paymentDate: transactionData.paymentDate,
                    asmachta: parseInt(transactionData.asmachta),
                    description: transactionData.description,
                    fullName: transactionData.fullName,
                    payerPhone: parseInt(transactionData.payerPhone),
                    payerEmail: transactionData.payerEmail,
                    cardSuffix: parseInt(transactionData.cardSuffix),
                    cardType: transactionData.cardType,
                    cardTypeCode: parseInt(transactionData.cardTypeCode),
                    cardBrand: transactionData.cardBrand,
                    cardBrandCode: parseInt(transactionData.cardBrandCode),
                    cardExp: parseInt(transactionData.cardExp),
                    processId: parseInt(transactionData.processId),
                    processToken: transactionData.processToken
                };

                const approveFormData = new FormData();
                Object.keys(approveData).forEach(key => {
                    approveFormData.append(key, String(approveData[key]));
                });

                const approveResponse = await axios.post(
                    'https://secure.meshulam.co.il/api/light/server/1.0/approveTransaction',
                    approveFormData,
                    {
                        headers: (typeof (approveFormData).getHeaders === 'function') ? (approveFormData).getHeaders() : {},
                        timeout: 10000
                    }
                );

                console.log('ApproveTransaction response:', approveResponse.data);

                if (approveResponse.data && approveResponse.data.status === 1) {
                    console.log('Transaction approved successfully');
                    console.log('Setting total_amount to:', transactionData.sum, 'as', parseFloat(transactionData.sum));
                    console.log('Updating booking ID:', bookingId);

                    // Update booking with approval status and mark as paid
                    const { error: updateError, data: updateData } = await supabase
                        .from('bookings')
                        .update({
                            payment_status: 'paid',  // Now mark as paid after successful approval
                            approve_transaction_status: 'approved',
                            approve_transaction_response: JSON.stringify(approveResponse.data),
                            total_amount: parseFloat(transactionData.sum)
                        })
                        .eq('id', bookingId)
                        .select(); // Add select to see what was updated

                    if (updateError) {
                        console.error('Error updating total_amount:', updateError);
                    } else {
                        console.log('Successfully updated total_amount to:', parseFloat(transactionData.sum));
                        console.log('Updated booking data:', updateData);
                    }
                } else {
                    console.error('ApproveTransaction failed:', approveResponse.data);
                    // Update booking with failed status
                    await supabase
                        .from('bookings')
                        .update({
                            approve_transaction_status: 'failed',
                            approve_transaction_response: JSON.stringify(approveResponse.data)
                        })
                        .eq('id', bookingId);
                }

            } catch (approveError) {
                console.error('Error calling ApproveTransaction:', approveError?.response?.data || approveError.message);
                // Update booking with failed status
                await supabase
                    .from('bookings')
                    .update({
                        approve_transaction_status: 'failed',
                        approve_transaction_response: JSON.stringify({
                            error: approveError?.message || 'Unknown error',
                            response: approveError?.response?.data || null
                        })
                    })
                    .eq('id', bookingId);
                // Don't fail the whole process if ApproveTransaction fails
                // The transaction will still be processed according to Growin docs
            }
        }

        // Mark seats as sold
        const { error: updateSeatsError } = await supabase
            .from('seats')
            .update({
                status: 'sold',
                reserved_until: null
            })
            .in('id', booking.seat_ids);

        if (updateSeatsError) {
            console.error('Error updating seats:', updateSeatsError);
            return res.status(500).json({ error: 'Database error updating seats' });
        }

        // Send ticket confirmation email
        try {
            console.log(`Sending ticket email to ${booking.user_email} for booking ${bookingId}`);
            console.log('Booking data for email:', {
                user_email: booking.user_email,
                user_name: booking.user_name,
                total_amount: booking.total_amount,
                seat_ids: booking.seat_ids,
                events: booking.events
            });
            const emailResult = await sendTicketConfirmation(booking);

            if (emailResult.success) {
                console.log('Ticket email sent successfully');
            } else {
                console.error('Failed to send ticket email:', emailResult.error);
                // Don't fail the payment process if email fails
            }
        } catch (emailError) {
            console.error('Error sending ticket email:', emailError);
            // Don't fail the payment process if email fails
        }

        res.json({
            message: 'Payment successful',
            bookingId: bookingId
        });

    } catch (error) {
        console.error('Supabase payment success error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// POST /api/checkout/payment/error
router.post('/payment/error', async (req, res) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({ error: 'Missing bookingId' });
        }

        // Get booking
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (bookingError || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.payment_status === 'failed' || booking.payment_status === 'refunded') {
            return res.json({ message: 'Already marked as failed/refunded' });
        }

        // Mark booking as failed
        const { error: updateError } = await supabase
            .from('bookings')
            .update({ payment_status: 'failed' })
            .eq('id', bookingId);

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return res.status(500).json({ error: 'Database error updating booking' });
        }

        // Release seats
        const { error: seatsError } = await supabase
            .from('seats')
            .update({
                status: 'available',
                reserved_until: null
            })
            .in('id', booking.seat_ids);

        if (seatsError) {
            console.error('Error updating seats:', seatsError);
            return res.status(500).json({ error: 'Database error updating seats' });
        }

        res.json({ message: 'Payment failed, seats released' });

    } catch (error) {
        console.error('Supabase payment error handler error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/checkout/booking/:id
router.get('/booking/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: booking, error } = await supabase
            .from('bookings')
            .select(`
                *,
                events (
                    name,
                    title,
                    designer,
                    date,
                    time,
                    description
                )
            `)
            .eq('id', id)
            .single();

        if (error || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(booking);

    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
