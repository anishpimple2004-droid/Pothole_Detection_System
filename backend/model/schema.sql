CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT,
    phone VARCHAR(20)
);

CREATE TABLE admins (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT
);

CREATE TABLE contractors (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT,
    company VARCHAR(100),
    is_approved BOOLEAN DEFAULT FALSE
);

CREATE TABLE complaints (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    description TEXT,
    location TEXT,
    latitude TEXT,
    longitude TEXT,
    image_url TEXT,
    severity TEXT,
    status TEXT,
    created_at TIMESTAMP,
    fixed_image_url TEXT
);

CREATE TABLE complaint_assignments (
    complaint_id UUID REFERENCES complaints(id),
    contractor_id UUID REFERENCES contractors(id),
    assigned_date TIMESTAMP,
    deadline TIMESTAMP,
    completion_date TIMESTAMP,
    PRIMARY KEY (complaint_id, contractor_id)
);
