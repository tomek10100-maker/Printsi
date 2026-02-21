-- 1. Create Users Table
-- Stores authentication, shipping info, and wallet balance
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Never store plain text passwords
    role VARCHAR(20) DEFAULT 'user', -- e.g., 'admin', 'user', 'seller'
    balance DECIMAL(10, 2) DEFAULT 0.00, -- User's money wallet
    
    -- Shipping Details (stored simply to save space, assuming one main address)
    shipping_name VARCHAR(100),
    shipping_street VARCHAR(150),
    shipping_city VARCHAR(100),
    shipping_zip VARCHAR(20),
    shipping_country VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Offer Types Enum (Optional but good for data integrity)
-- We define 3 distinct types as requested
-- 'digital_model' = Plik 3D (do pobrania)
-- 'print_service' = Plik 3D do wydruku (zlecenie/usługa)
-- 'physical_item' = Gotowy przedmiot
CREATE TYPE offer_category AS ENUM ('digital_model', 'print_service', 'physical_item');

-- 3. Create Offers Table
-- This creates a unified marketplace structure
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Link to the seller
    
    -- Core info (Shared by all types)
    category offer_category NOT NULL, -- Defines which section of the marketplace it appears in
    title VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    location VARCHAR(100), -- e.g., 'Kraków' (Important for shipping/local pickup)
    preview_image_url VARCHAR(255), -- Path to the thumbnail image
    
    -- Specifics (Filled based on category, NULL otherwise to save space)
    -- For Digital & Print Service:
    source_file_url VARCHAR(255), -- The .STL or .OBJ file path
    
    -- For Print Service & Physical Item:
    material VARCHAR(50), -- e.g., 'PLA', 'ABS', 'Resin'
    color VARCHAR(30),    -- e.g., 'Red', 'Black'
    
    -- For Physical Item only:
    weight_grams INTEGER, -- Used for shipping calculation
    
    is_active BOOLEAN DEFAULT TRUE, -- To hide offer without deleting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Indexes (Crucial for performance/speed)
-- Helps frontend filter by category and location instantly
CREATE INDEX idx_offers_category ON offers(category);
CREATE INDEX idx_offers_location ON offers(location);