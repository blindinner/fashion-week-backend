-- Add sequential booking number column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number SERIAL;

-- Create a sequence starting from 1 and format to 5 digits
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1;

-- Set the default value for booking_number to use the sequence
ALTER TABLE bookings ALTER COLUMN booking_number SET DEFAULT nextval('booking_number_seq');

-- Update existing bookings to have sequential numbers (if any exist)
UPDATE bookings 
SET booking_number = nextval('booking_number_seq') 
WHERE booking_number IS NULL;

-- Create a function to format booking number as 5-digit string
CREATE OR REPLACE FUNCTION format_booking_number(booking_num INTEGER)
RETURNS TEXT AS $$
BEGIN
    RETURN LPAD(booking_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;




