-- Migration: Enable Guest Bookings
-- Run this in your Supabase SQL Editor

-- 1. Make client_id optional
ALTER TABLE bookings 
ALTER COLUMN client_id DROP NOT NULL;

-- 2. Add Guest columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 3. Update RLS (Row Level Security) if enabled
-- (Assuming RLS is currently off or permissive for this MVP)
-- If RLS is on, you need:
-- CREATE POLICY "Allow public insert" ON bookings FOR INSERT WITH CHECK (true);
