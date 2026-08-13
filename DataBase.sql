-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums for our State Machine
CREATE TYPE document_status AS ENUM ('draft', 'pending', 'in_progress', 'completed', 'rejected', 'voided');
CREATE TYPE step_status AS ENUM ('pending', 'completed', 'rejected');

-- 1. Users Table (The Initiators)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Documents Table (The Core Object)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    initiator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_file_path TEXT NOT NULL,
    signed_file_path TEXT, -- Null until the workflow is completed
    current_hash TEXT, -- Stores the latest cryptographic hash
    status document_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Workflow Steps Table (The Routing Engine)
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    signer_email VARCHAR(255) NOT NULL,
    signer_name VARCHAR(255) NOT NULL,
    step_order INTEGER NOT NULL, -- 1 for Level 1, 2 for Level 2, etc.
    status step_status DEFAULT 'pending',
    signature_ui_data JSONB, -- Example: {"page": 3, "x": 150, "y": 400, "width": 200, "height": 50}
    access_token UUID DEFAULT uuid_generate_v4(), -- Secure link token sent via email
    signed_at TIMESTAMP WITH TIME ZONE,
    signer_ip VARCHAR(45),
    step_hash TEXT, -- The cryptographic hash generated right after THIS step
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (document_id, step_order)
);

-- 4. Audit Logs Table (The Legal Trail)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL, -- e.g., 'DOCUMENT_UPLOADED', 'SIGNED_BY_LEVEL_1'
    actor_email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    resulting_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);