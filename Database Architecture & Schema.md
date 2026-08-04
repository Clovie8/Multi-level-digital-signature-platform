# Database Architecture & Schema Documentation

**Database:** PostgreSQL
**Core Technologies:** `uuid-ossp` extension, `JSONB` for UI configurations, native `ENUM` state machines.

---

### Entity Relationship Diagram (ERD)

![ERD](https://github.com/Clovie8/Multi-level-digital-signature-platform/blob/main/ERD%20Diagram.png)

---

## 1. Global Configurations & Types

To enforce strict security and state management at the database level, the system relies on specific extensions and custom enumerated types (Enums).

* **`uuid-ossp` Extension:** Replaces sequential integer IDs (1, 2, 3) with mathematically random UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`). This prevents Insecure Direct Object Reference (IDOR) vulnerabilities where an attacker could guess a document's URL.
* **`document_status` (ENUM):** Restricts the `documents.status` column to: `'draft'`, `'pending'`, `'in_progress'`, `'completed'`, `'rejected'`, or `'voided'`.
* **`step_status` (ENUM):** Restricts individual routing actions in `workflow_steps.status` to: `'pending'`, `'completed'`, or `'rejected'`.

---

## 2. Table Definitions

### Table: `users`

**Purpose:** Manages the system's registered accounts (Initiators). It handles authentication credentials, account verification, and secure password reset flows.

| Column Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | `PRIMARY KEY` | Unique identifier generated automatically. |
| `name` | `VARCHAR(255)` | `NOT NULL` | The user's full display name. |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | Login email; enforced unique at the database level. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Bcrypt or Argon2 hashed password. |
| `is_verified` | `BOOLEAN` | `DEFAULT FALSE` | Tracks if the user clicked their email confirmation link. |
| `verification_token` | `VARCHAR(255)` | `NULL` | Temporary token sent via email for initial account setup. |
| `reset_password_token` | `VARCHAR(255)` | `NULL` | Temporary token for password recovery. |
| `reset_password_expires_at` | `TIMESTAMP` | `NULL` | Expiration time for the reset token (usually +15 mins). |
| `created_at` / `updated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Standard audit timestamps. |

### Table: `documents`

**Purpose:** The central entity of the system. Represents a single physical PDF file moving through an approval lifecycle.

| Column Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | `PRIMARY KEY` | Unique identifier for the document. |
| `initiator_id` | `UUID` | `FK, ON DELETE CASCADE` | Links to `users.id`. Who uploaded this document. |
| `file_name` | `VARCHAR(255)` | `NOT NULL` | Human-readable name (e.g., "Contract_Q3.pdf"). |
| `original_file_path` | `TEXT` | `NOT NULL` | Cloud/local storage path of the raw, unsigned upload. |
| `signed_file_path` | `TEXT` | `NULL` | Storage path of the fully signed and sealed file. |
| `current_hash` | `TEXT` | `NULL` | The SHA-256 cryptographic hash of the document's current state. |
| `status` | `document_status` | `DEFAULT 'draft'` | The global state of the file (Draft -> In Progress -> Completed). |
| `created_at` / `updated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Standard audit timestamps. |

### Table: `workflow_steps`

**Purpose:** The routing engine. This table defines exactly who needs to sign a document, the order they must sign it, and exactly where their signature goes on the page.

| Column Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | `PRIMARY KEY` | Unique identifier for this specific signature request. |
| `document_id` | `UUID` | `FK, ON DELETE CASCADE` | Links to `documents.id`. |
| `signer_email` | `VARCHAR(255)` | `NOT NULL` | Where the signature request email is sent. |
| `signer_name` | `VARCHAR(255)` | `NOT NULL` | The expected name of the person signing. |
| `step_order` | `INTEGER` | `NOT NULL` | Determines the sequential hierarchy (1, then 2, then 3). |
| `status` | `step_status` | `DEFAULT 'pending'` | The status of this specific individual's request. |
| `signature_ui_data` | `JSONB` | `NULL` | Stores dynamic X/Y coordinates for the frontend canvas (e.g., `{"page": 2, "x": 100, "y": 300}`). |
| `access_token` | `UUID` | `DEFAULT UUID_V4()` | The secret token appended to the email link for secure, passwordless access. |
| `signed_at` | `TIMESTAMP` | `NULL` | Exact time the user clicked "Finish". |
| `signer_ip` | `VARCHAR(45)` | `NULL` | The IPv4 or IPv6 address of the signer for the legal audit. |
| `step_hash` | `TEXT` | `NULL` | The cryptographic hash generated immediately after *this specific person* signed. |

*Note on Constraints:* A `UNIQUE (document_id, step_order)` constraint ensures no two signers can share the same sequential step on a single document, preventing routing collisions.

### Table: `audit_logs`

**Purpose:** The immutable legal trail. Any action taken on a document is appended here. This data is ultimately rendered onto the final page of the completed PDF certificate.

| Column Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `UUID` | `PRIMARY KEY` | Unique log identifier. |
| `document_id` | `UUID` | `FK, ON DELETE CASCADE` | Links to `documents.id`. |
| `action` | `VARCHAR(255)` | `NOT NULL` | Description of the event (e.g., `'DOCUMENT_UPLOADED'`, `'SIGNED_LEVEL_1'`). |
| `actor_email` | `VARCHAR(255)` | `NOT NULL` | The email of the person who performed the action. |
| `ip_address` | `VARCHAR(45)` | `NULL` | Network address from where the action originated. |
| `resulting_hash` | `TEXT` | `NULL` | The state of the document's cryptographic hash immediately following the action. |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | The unalterable timestamp of the event. |

---

## 3. SQL Code:

```
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

```
