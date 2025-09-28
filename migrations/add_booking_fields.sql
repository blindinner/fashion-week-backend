-- Add missing booking fields that were added to the code but not to the database

-- Add stay_tuned field for email/phone preferences
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stay_tuned BOOLEAN DEFAULT false;

-- Add designer_name field to store the designer name
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS designer_name TEXT;

-- Add seat details fields for better tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat_areas TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat_rows TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat_numbers TEXT;
