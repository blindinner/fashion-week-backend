import { Resend } from 'resend';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY || 're_Ffnghfdv_MfNrU4CVpVLQVEstHyrYVwtG');

export const sendTicketConfirmation = async (booking) => {
    try {
        // Format seat information with proper structure
        // Note: This will need to be updated once we have seat details from database
        const seatInfo = booking.seat_ids?.map((seatId, index) => {
            return `
                <div style="margin-bottom: 10px; padding: 8px; background-color: #f8f9fa; border-radius: 4px;">
                    <strong>Seat ${index + 1}:</strong><br/>
                    Area: ${booking.seat_details?.[index]?.area || 'A'}<br/>
                    Row: ${booking.seat_details?.[index]?.row_number || '1'}<br/>
                    Seat: ${booking.seat_details?.[index]?.seat_number || '1'}
                </div>
            `;
        }).join('') || 'No seats specified';

        // Format event details with standardized name and proper date/time format
        const eventDetails = booking.events ? {
            name: 'Israel Canada Fashion Week Tel Aviv 2025',
            designer: booking.events.designer || 'Featured Designer',
            date: booking.events.formatted_date || booking.events.date || 'TBD',
            time: booking.events.formatted_time || booking.events.time || 'TBD'
        } : {
            name: 'Israel Canada Fashion Week Tel Aviv 2025',
            designer: 'Featured Designer',
            date: 'TBD',
            time: 'TBD'
        };

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your Tel Aviv Fashion Week Tickets</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                    }
                    .container {
                        background-color: white;
                        border-radius: 8px;
                        padding: 40px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #000;
                    }
                    .logo {
                        max-width: 200px;
                        height: auto;
                        margin-bottom: 20px;
                    }
                    .header h1 {
                        color: #000;
                        font-size: 28px;
                        margin: 0;
                        font-weight: bold;
                    }
                    .success-icon {
                        font-size: 48px;
                        margin-bottom: 20px;
                    }
                    .booking-details {
                        background-color: #f8f9fa;
                        border-radius: 6px;
                        padding: 25px;
                        margin: 25px 0;
                    }
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 12px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e9ecef;
                    }
                    .detail-row:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    .detail-label {
                        font-weight: 600;
                        color: #495057;
                    }
                    .detail-value {
                        color: #000;
                        font-weight: 500;
                    }
                    .total-amount {
                        background-color: #000;
                        color: white;
                        padding: 15px;
                        border-radius: 6px;
                        text-align: center;
                        font-size: 18px;
                        font-weight: bold;
                        margin: 20px 0;
                    }
                    .booking-id {
                        background-color: #e9ecef;
                        padding: 10px;
                        border-radius: 4px;
                        font-family: monospace;
                        text-align: center;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e9ecef;
                        color: #6c757d;
                        font-size: 14px;
                    }
                    .contact-info {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://fashionweektelaviv.com/images/logo/2025/Final%20Logo.png" alt="Israel Canada Tel Aviv Fashion Week" class="logo">
                        <h1>מודים על קנייתך</h1>
                        <p style="text-align: right; direction: rtl; font-size: 18px; margin: 20px 0;">הרכישה הושלמה</p>
                        <p style="text-align: right; direction: rtl; font-size: 16px; margin: 15px 0;">בהגעך לאירוע, הראה אימייל זה בעמדת איסוף הכרטיסים.</p>
                        
                    </div>

                    <div class="booking-details">
                        <h2 style="margin-top: 0; color: #000; font-size: 20px;">פרטי הזמנה</h2>
                        
                        <div class="detail-row">
                            <span class="detail-label">${eventDetails.name}</span>
                            <span class="detail-value"></span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Designer:</span>
                            <span class="detail-value">${eventDetails.designer}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Date:</span>
                            <span class="detail-value">${eventDetails.date}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Time:</span>
                            <span class="detail-value">${eventDetails.time}</span>
                        </div>
                        
                        ${booking.events?.description ? `
                        <div class="detail-row">
                            <span class="detail-label">Event Details:</span>
                            <span class="detail-value">${booking.events.description}</span>
                        </div>
                        ` : ''}
                        
                        <div class="detail-row">
                            <span class="detail-label">Seats:</span>
                            <span class="detail-value">${booking.seat_ids?.length || 0} seat(s)</span>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <strong>Seat Details:</strong><br/>
                            ${seatInfo}
                        </div>
                        
                        <div class="booking-id">
                            Booking ID: #${booking.booking_number ? booking.booking_number.toString().padStart(5, '0') : '00000'}
                        </div>
                    </div>

                    <div class="footer">
                        <p><strong>Israel Canada Tel Aviv Fashion Week</strong></p>
                        <p>If you have any questions, please contact us at info@fashionweektelaviv.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'Israel Canada Tel Aviv Fashion Week <info@fashionweektelaviv.com>',
            to: [booking.user_email],
            subject: 'Your Tel Aviv Fashion Week Tickets - Confirmed!',
            html: emailHtml,
        });

        if (error) {
            console.error('Resend error:', error);
            return { success: false, error: error.message };
        }

        console.log('Email sent successfully:', data);
        return { success: true, data: data };

    } catch (error) {
        console.error('Email service error:', error);
        return { success: false, error: error.message };
    }
};
