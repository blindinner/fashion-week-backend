import { sendTicketConfirmation } from './services/emailService.js';

// Test email sending with sample booking data
const testBooking = {
    id: 'test-123',
    user_email: 'benjamin.bassal@gmail.com', // Test email address
    user_name: 'John Doe',
    user_phone: '0501234567',
    seat_ids: ['seat-1', 'seat-2'],
    total_amount: 120,
    events: {
        name: 'Fashion Week Show',
        designer: 'Test Designer',
        date: '2024-01-15',
        time: '19:00'
    }
};

console.log('Testing Resend email service with info@fashionweektelaviv.com...');
sendTicketConfirmation(testBooking)
    .then(result => {
        console.log('Email test result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Email test error:', error);
        process.exit(1);
    });
