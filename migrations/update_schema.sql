-- Migration to clean up data storage and add new columns

-- 1. Update events table to store standardized event name and formatted date
ALTER TABLE events ADD COLUMN IF NOT EXISTS formatted_date TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS formatted_time TEXT;

-- 2. Update bookings table to store clean transaction data instead of JSON
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_token TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_sum DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payer_email TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payer_phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS card_brand TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS card_suffix TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_date TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_number TEXT;

-- 3. Update all existing events to use standardized name and format dates
UPDATE events SET 
    name = 'Israel Canada Fashion Week Tel Aviv 2025',
    formatted_date = TO_CHAR(date, 'DD.MM.YYYY'),
    formatted_time = TO_CHAR(time, 'HH24:MI')
WHERE name != 'Israel Canada Fashion Week Tel Aviv 2025';

-- 4. Create a function to format dates consistently
CREATE OR REPLACE FUNCTION format_event_date(input_date DATE)
RETURNS TEXT AS $$
BEGIN
    RETURN TO_CHAR(input_date, 'DD.MM.YYYY');
END;
$$ LANGUAGE plpgsql;

-- 5. Create a function to format time consistently  
CREATE OR REPLACE FUNCTION format_event_time(input_time TIME)
RETURNS TEXT AS $$
BEGIN
    RETURN TO_CHAR(input_time, 'HH24:MI');
END;
$$ LANGUAGE plpgsql;



