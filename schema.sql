-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE DES SERVICES (Plomberie, Électricité, etc.)
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT, -- Nom de l'icône SVG ou classe
  base_price DECIMAL NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLE DES PROFILS (Clients et Maallems)
-- Note: References auth.users from Supabase Auth
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('client', 'maallem')),
  phone TEXT,
  city TEXT DEFAULT 'Casablanca',
  avatar_url TEXT,
  rating DECIMAL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE DES RÉSERVATIONS (Bookings)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES profiles(id),
  maallem_id UUID REFERENCES profiles(id),
  service_id UUID REFERENCES services(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  is_emergency BOOLEAN DEFAULT false,
  total_price DECIMAL,
  booking_date TIMESTAMPTZ DEFAULT NOW(),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INSERTION DES SERVICES DE BASE
INSERT INTO services (name, icon, base_price, description) VALUES
('Plomberie', 'water-drop', 150, 'Réparation de fuites et sanitaires'),
('Électricité', 'lightning', 200, 'Pannes et installations électriques'),
('Serrurerie', 'key', 250, 'Ouverture de porte et changement de serrure'),
('Peinture', 'paint-roll', 180, 'Peinture intérieure et extérieure');
