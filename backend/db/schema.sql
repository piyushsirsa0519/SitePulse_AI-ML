-- ============================================================================
-- Site Pulse — PostgreSQL Canonical Database Schema
-- Executive Retail Fitout Construction Management Platform (Phase 2 Modernized)
-- ============================================================================

-- Enable UUID extension if supported
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations Table (Multi-tenant Root)
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Application Identity & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    supabase_auth_id UUID UNIQUE, -- Immutable Supabase Auth Identity Mapping
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'project_manager',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);

-- 3. Stores Table (Physical Commercial Store Real Estate Master)
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    store_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    location_address TEXT NOT NULL,
    format VARCHAR(50) NOT NULL DEFAULT 'High Street',
    target_launch_date DATE,
    square_footage NUMERIC(8,2) CHECK (square_footage > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'fitout_in_progress',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_store_code UNIQUE (organization_id, store_code)
);

CREATE INDEX IF NOT EXISTS idx_stores_org_id ON stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_brand ON stores(brand);

-- 4. Projects Table (Store Fitout Execution Cycles)
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    store_id VARCHAR(64) REFERENCES stores(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_project_dates CHECK (deadline >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_store_id ON projects(store_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 5. Contractors Table (Subcontractor Vendor Directory)
CREATE TABLE IF NOT EXISTS contractors (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trade_specialty VARCHAR(100) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    rating NUMERIC(3,2) DEFAULT 4.00 CHECK (rating BETWEEN 1.00 AND 5.00),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_contractor_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contractors_org_id ON contractors(organization_id);
CREATE INDEX IF NOT EXISTS idx_contractors_trade ON contractors(trade_specialty);

-- 6. Trades Table (Fitout Work Packages per Project)
CREATE TABLE IF NOT EXISTS trades (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    planned_start DATE,
    planned_end DATE,
    planned_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (planned_pct BETWEEN 0 AND 100),
    default_workers_required INTEGER NOT NULL DEFAULT 0 CHECK (default_workers_required >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_trade_name UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_trades_project_id ON trades(project_id);

-- 7. Contractor Assignments Table (Mapping Contractors to Specific Trades per Project)
CREATE TABLE IF NOT EXISTS contractor_assignments (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    trade_id VARCHAR(64) NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    contractor_id VARCHAR(64) NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    contract_value NUMERIC(12,2) DEFAULT 0.00 CHECK (contract_value >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_trade_contractor UNIQUE (project_id, trade_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_contractor_assignments_proj ON contractor_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_contractor_assignments_trade ON contractor_assignments(trade_id);
CREATE INDEX IF NOT EXISTS idx_contractor_assignments_contractor ON contractor_assignments(contractor_id);

-- 8. Daily Updates Table (Canonical Progress History Log per Trade)
CREATE TABLE IF NOT EXISTS daily_updates (
    id VARCHAR(64) PRIMARY KEY,
    trade_id VARCHAR(64) NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    progress_pct NUMERIC(5,2) NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
    workers_present INTEGER NOT NULL CHECK (workers_present >= 0),
    workers_required INTEGER NOT NULL CHECK (workers_required >= 0),
    reason VARCHAR(255) NOT NULL DEFAULT 'On Track',
    notes TEXT,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_trade_date UNIQUE (trade_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_updates_trade_id ON daily_updates(trade_id);
CREATE INDEX IF NOT EXISTS idx_daily_updates_date ON daily_updates(date);
CREATE INDEX IF NOT EXISTS idx_daily_updates_trade_date ON daily_updates(trade_id, date DESC);

-- 9. Manpower Log Table (Contractor-level workforce headcount per trade/shift)
CREATE TABLE IF NOT EXISTS manpower_log (
    id VARCHAR(64) PRIMARY KEY,
    trade_id VARCHAR(64) NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    contractor_id VARCHAR(64) REFERENCES contractors(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL DEFAULT 'day',
    workers_present INTEGER NOT NULL CHECK (workers_present >= 0),
    workers_required INTEGER NOT NULL CHECK (workers_required >= 0),
    supervisor_name VARCHAR(255),
    overtime_hours NUMERIC(4,1) NOT NULL DEFAULT 0.0 CHECK (overtime_hours >= 0),
    notes TEXT,
    logged_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_trade_contractor_date_shift UNIQUE (trade_id, contractor_id, date, shift)
);

CREATE INDEX IF NOT EXISTS idx_manpower_log_trade_date ON manpower_log(trade_id, date);
CREATE INDEX IF NOT EXISTS idx_manpower_log_contractor ON manpower_log(contractor_id);
CREATE INDEX IF NOT EXISTS idx_manpower_log_date ON manpower_log(date);

-- 10. Delay Events Table (Structured Incident and Delay Logging)
CREATE TABLE IF NOT EXISTS delay_events (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    trade_id VARCHAR(64) REFERENCES trades(id) ON DELETE CASCADE,
    contractor_id VARCHAR(64) REFERENCES contractors(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    identified_date DATE NOT NULL,
    resolved_date DATE,
    estimated_delay_days INTEGER NOT NULL DEFAULT 1 CHECK (estimated_delay_days >= 0),
    actual_delay_days INTEGER DEFAULT 0 CHECK (actual_delay_days >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'resolved', 'escalated')),
    root_cause TEXT NOT NULL,
    mitigation_action TEXT,
    logged_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_delay_event_dates CHECK (resolved_date IS NULL OR resolved_date >= identified_date)
);

CREATE INDEX IF NOT EXISTS idx_delay_events_proj_status ON delay_events(project_id, status);
CREATE INDEX IF NOT EXISTS idx_delay_events_trade ON delay_events(trade_id);
CREATE INDEX IF NOT EXISTS idx_delay_events_category ON delay_events(category);
CREATE INDEX IF NOT EXISTS idx_delay_events_identified_date ON delay_events(identified_date);
