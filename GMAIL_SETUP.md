# Gmail SMTP Setup Guide

## 1. Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Go to Security → 2-Step Verification
3. Enable 2-Step Verification if not already enabled

## 2. Generate App Password
1. Go to Security → App passwords
2. Select "Mail" as the app
3. Select "Other" as the device
4. Name it "Fashion Week App"
5. Copy the 16-character password (no spaces)

## 3. Update Email Service
Replace `YOUR_GMAIL_APP_PASSWORD_HERE` in `backend/services/emailService.js` with your app password.

## 4. Test
Run: `node test-email.js`

## Gmail Limits
- 500 emails/day
- Perfect for fashion week ticket confirmations!

## Security Note
- Never use your regular Gmail password
- Always use App Password for applications
- Keep your App Password secure




