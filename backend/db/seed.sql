-- ============================================================================
-- Site Pulse — Seed Data SQL (Phase 2 Modernized)
-- Seeds the 3 prototype projects, physical stores, contractors, assignments,
-- current trade states, granular manpower logs, and active delay events.
-- ============================================================================

-- NOTE ON DATA INTEGRITY & MOCK LIMITATION:
-- The prototype dataset contains the canonical baseline state of progress for each trade.
-- As of 2026-10-01, it maintains full backward compatibility with baseline test suites.

-- 1. Insert Default Organization
INSERT INTO organizations (id, name)
VALUES ('org-apex-retail', 'Apex Retail Fitouts')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Default Users (with deterministic Supabase Auth test UUIDs)
INSERT INTO users (id, supabase_auth_id, organization_id, email, full_name, role)
VALUES 
    ('usr-admin-01',    '11111111-1111-1111-1111-111111111111', 'org-apex-retail', 'executive@apexfitouts.com', 'Executive Fitout Manager', 'admin'),
    ('usr-engineer-01', '22222222-2222-2222-2222-222222222222', 'org-apex-retail', 'engineer@apexfitouts.com',  'Site Engineer',            'site_engineer'),
    ('usr-viewer-01',   '33333333-3333-3333-3333-333333333333', 'org-apex-retail', 'viewer@apexfitouts.com',    'Client Viewer',            'viewer')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Physical Stores
INSERT INTO stores (id, organization_id, store_code, name, brand, city, location_address, format, square_footage, status)
VALUES
    ('str-bb-cyberhub',  'org-apex-retail', 'STR-BB-01', 'Biryani Blues - Cyber Hub', 'Biryani Blues', 'Gurugram',  'DLF Cyber Hub, DLF Phase 2, Gurugram', 'Food Court',  1850.00, 'fitout_in_progress'),
    ('str-cp-connaught', 'org-apex-retail', 'STR-CP-01', 'Cafe Chai Point - CP',      'Cafe Chai Point', 'Delhi',     'Inner Circle, Connaught Place, New Delhi', 'High Street', 2200.00, 'fitout_in_progress'),
    ('str-pt-banjara',   'org-apex-retail', 'STR-PT-01', 'P.TAL Homeware - Banjara',  'P.TAL Homeware',  'Hyderabad', 'Road No. 12, Banjara Hills, Hyderabad', 'High Street', 3400.00, 'fitout_in_progress')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Projects (linked to stores)
INSERT INTO projects (id, organization_id, store_id, name, location, start_date, deadline, status)
VALUES 
    ('prj-biryani-blues', 'org-apex-retail', 'str-bb-cyberhub',  'Biryani Blues - Gurugram', 'Gurugram',  '2026-09-01', '2026-10-25', 'active'),
    ('prj-chai-point',     'org-apex-retail', 'str-cp-connaught', 'Cafe Chai Point - Delhi',     'Delhi',     '2026-09-05', '2026-10-30', 'active'),
    ('prj-ptal-homeware',  'org-apex-retail', 'str-pt-banjara',   'P.TAL Homeware - Hyderabad', 'Hyderabad', '2026-09-10', '2026-11-15', 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Contractors
INSERT INTO contractors (id, organization_id, name, trade_specialty, contact_person, contact_email, rating, is_active)
VALUES
    ('cnt-apex-civil',      'org-apex-retail', 'Apex Civil Works LLP',         'Civil',      'Ramesh Sharma',  'ramesh@apexcivil.com',     4.5, true),
    ('cnt-volt-electrical', 'org-apex-retail', 'VoltCraft Electricals Ltd',    'Electrical', 'Anil Gupta',     'anil@voltcraft.in',        3.8, true),
    ('cnt-lumina-lighting', 'org-apex-retail', 'Lumina Retail Lighting Ltd',   'Lighting',   'Pooja Verma',    'pooja@luminalight.com',    4.2, true),
    ('cnt-artisan-wood',    'org-apex-retail', 'Artisan Wood & Fitouts',       'Carpentry',  'Gurpreet Singh', 'gurpreet@artisanwood.com', 4.7, true),
    ('cnt-prism-coatings',  'org-apex-retail', 'Prism Coatings & Finishes',    'Painting',   'Vikram Mehta',   'vikram@prismfinishes.com', 4.0, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Trades for Biryani Blues (prj-biryani-blues)
INSERT INTO trades (id, project_id, name, planned_pct, default_workers_required)
VALUES
    ('trd-bb-civil',      'prj-biryani-blues', 'Civil',      90.00, 12),
    ('trd-bb-electrical', 'prj-biryani-blues', 'Electrical', 75.00, 8),
    ('trd-bb-lighting',   'prj-biryani-blues', 'Lighting',   60.00, 6),
    ('trd-bb-carpentry',  'prj-biryani-blues', 'Carpentry',  40.00, 10),
    ('trd-bb-painting',   'prj-biryani-blues', 'Painting',   20.00, 5)
ON CONFLICT (id) DO NOTHING;

-- Snapshot Daily Update for Biryani Blues (Date: 2026-10-01)
INSERT INTO daily_updates (id, trade_id, date, progress_pct, workers_present, workers_required, reason, created_by)
VALUES
    ('upd-bb-civil-01',      'trd-bb-civil',      '2026-10-01', 92.00, 12, 12, 'On Track', 'usr-admin-01'),
    ('upd-bb-electrical-01', 'trd-bb-electrical', '2026-10-01', 75.00, 8,  8,  'On Track', 'usr-admin-01'),
    ('upd-bb-lighting-01',   'trd-bb-lighting',   '2026-10-01', 65.00, 6,  6,  'On Track', 'usr-admin-01'),
    ('upd-bb-carpentry-01',  'trd-bb-carpentry',  '2026-10-01', 42.00, 10, 10, 'On Track', 'usr-admin-01'),
    ('upd-bb-painting-01',   'trd-bb-painting',   '2026-10-01', 22.00, 5,  5,  'On Track', 'usr-admin-01')
ON CONFLICT (id) DO NOTHING;

-- 7. Insert Trades for Cafe Chai Point (prj-chai-point)
INSERT INTO trades (id, project_id, name, planned_pct, default_workers_required)
VALUES
    ('trd-cp-civil',      'prj-chai-point', 'Civil',      95.00, 10),
    ('trd-cp-electrical', 'prj-chai-point', 'Electrical', 80.00, 9),
    ('trd-cp-lighting',   'prj-chai-point', 'Lighting',   50.00, 6),
    ('trd-cp-carpentry',  'prj-chai-point', 'Carpentry',  60.00, 8),
    ('trd-cp-painting',   'prj-chai-point', 'Painting',   15.00, 4)
ON CONFLICT (id) DO NOTHING;

-- Snapshot Daily Update for Cafe Chai Point (Date: 2026-10-01)
INSERT INTO daily_updates (id, trade_id, date, progress_pct, workers_present, workers_required, reason, created_by)
VALUES
    ('upd-cp-civil-01',      'trd-cp-civil',      '2026-10-01', 95.00, 10, 10, 'On Track',                 'usr-admin-01'),
    ('upd-cp-electrical-01', 'trd-cp-electrical', '2026-10-01', 52.00, 4,  9,  'Material Delay',           'usr-admin-01'),
    ('upd-cp-lighting-01',   'trd-cp-lighting',   '2026-10-01', 35.00, 3,  6,  'Waiting on Another Trade', 'usr-admin-01'),
    ('upd-cp-carpentry-01',  'trd-cp-carpentry',  '2026-10-01', 64.00, 8,  8,  'On Track',                 'usr-admin-01'),
    ('upd-cp-painting-01',   'trd-cp-painting',   '2026-10-01', 15.00, 4,  4,  'On Track',                 'usr-admin-01')
ON CONFLICT (id) DO NOTHING;

-- 8. Insert Trades for P.TAL Homeware (prj-ptal-homeware)
INSERT INTO trades (id, project_id, name, planned_pct, default_workers_required)
VALUES
    ('trd-pt-civil',      'prj-ptal-homeware', 'Civil',      70.00, 14),
    ('trd-pt-electrical', 'prj-ptal-homeware', 'Electrical', 45.00, 6),
    ('trd-pt-lighting',   'prj-ptal-homeware', 'Lighting',   25.00, 4),
    ('trd-pt-carpentry',  'prj-ptal-homeware', 'Carpentry',  55.00, 8),
    ('trd-pt-painting',   'prj-ptal-homeware', 'Painting',   10.00, 3)
ON CONFLICT (id) DO NOTHING;

-- Snapshot Daily Update for P.TAL Homeware (Date: 2026-10-01)
INSERT INTO daily_updates (id, trade_id, date, progress_pct, workers_present, workers_required, reason, created_by)
VALUES
    ('upd-pt-civil-01',      'trd-pt-civil',      '2026-10-01', 42.00, 5,  14, 'Labour Shortage',          'usr-admin-01'),
    ('upd-pt-electrical-01', 'trd-pt-electrical', '2026-10-01', 45.00, 6,  6,  'On Track',                 'usr-admin-01'),
    ('upd-pt-lighting-01',   'trd-pt-lighting',   '2026-10-01', 20.00, 2,  4,  'Waiting on Another Trade', 'usr-admin-01'),
    ('upd-pt-carpentry-01',  'trd-pt-carpentry',  '2026-10-01', 64.00, 9,  8,  'On Track',                 'usr-admin-01'),
    ('upd-pt-painting-01',   'trd-pt-painting',   '2026-10-01', 10.00, 3,  3,  'On Track',                 'usr-admin-01')
ON CONFLICT (id) DO NOTHING;

-- 9. Insert Contractor Assignments
INSERT INTO contractor_assignments (id, project_id, trade_id, contractor_id, assigned_date, contract_value, status)
VALUES
    ('ca-bb-01', 'prj-biryani-blues', 'trd-bb-civil',      'cnt-apex-civil',      '2026-09-01', 450000.00, 'active'),
    ('ca-bb-02', 'prj-biryani-blues', 'trd-bb-electrical', 'cnt-volt-electrical', '2026-09-03', 320000.00, 'active'),
    ('ca-bb-03', 'prj-biryani-blues', 'trd-bb-lighting',   'cnt-lumina-lighting', '2026-09-05', 180000.00, 'active'),
    ('ca-bb-04', 'prj-biryani-blues', 'trd-bb-carpentry',  'cnt-artisan-wood',    '2026-09-10', 500000.00, 'active'),
    ('ca-bb-05', 'prj-biryani-blues', 'trd-bb-painting',   'cnt-prism-coatings',  '2026-09-15', 150000.00, 'active'),
    ('ca-cp-01', 'prj-chai-point',     'trd-cp-civil',      'cnt-apex-civil',      '2026-09-05', 380000.00, 'active'),
    ('ca-cp-02', 'prj-chai-point',     'trd-cp-electrical', 'cnt-volt-electrical', '2026-09-07', 300000.00, 'active'),
    ('ca-cp-03', 'prj-chai-point',     'trd-cp-lighting',   'cnt-lumina-lighting', '2026-09-10', 170000.00, 'active'),
    ('ca-cp-04', 'prj-chai-point',     'trd-cp-carpentry',  'cnt-artisan-wood',    '2026-09-12', 420000.00, 'active'),
    ('ca-cp-05', 'prj-chai-point',     'trd-cp-painting',   'cnt-prism-coatings',  '2026-09-18', 140000.00, 'active'),
    ('ca-pt-01', 'prj-ptal-homeware',  'trd-pt-civil',      'cnt-apex-civil',      '2026-09-10', 600000.00, 'active'),
    ('ca-pt-02', 'prj-ptal-homeware',  'trd-pt-electrical', 'cnt-volt-electrical', '2026-09-12', 350000.00, 'active'),
    ('ca-pt-03', 'prj-ptal-homeware',  'trd-pt-lighting',   'cnt-lumina-lighting', '2026-09-15', 200000.00, 'active'),
    ('ca-pt-04', 'prj-ptal-homeware',  'trd-pt-carpentry',  'cnt-artisan-wood',    '2026-09-18', 550000.00, 'active'),
    ('ca-pt-05', 'prj-ptal-homeware',  'trd-pt-painting',   'cnt-prism-coatings',  '2026-09-22', 160000.00, 'active')
ON CONFLICT (id) DO NOTHING;

-- 10. Insert Manpower Log
INSERT INTO manpower_log (id, trade_id, contractor_id, date, shift, workers_present, workers_required, supervisor_name, overtime_hours, notes)
VALUES
    ('mpl-cp-elec-01', 'trd-cp-electrical', 'cnt-volt-electrical', '2026-10-01', 'day', 4, 9,  'Anil Gupta',     0.0, 'Material constraint holding crew'),
    ('mpl-pt-civ-01',  'trd-pt-civil',      'cnt-apex-civil',      '2026-10-01', 'day', 5, 14, 'Ramesh Sharma', 2.0, 'Labor shortage due to festival holidays')
ON CONFLICT (id) DO NOTHING;

-- 11. Insert Delay Events
INSERT INTO delay_events (id, project_id, trade_id, contractor_id, category, severity, identified_date, estimated_delay_days, actual_delay_days, status, root_cause, mitigation_action, logged_by)
VALUES
    ('del-cp-elec-01', 'prj-chai-point',    'trd-cp-electrical', 'cnt-volt-electrical', 'Material Delay',  'high', '2026-09-26', 7,  5, 'open',       'Switchgear distribution board delivery delayed by manufacturer', 'Expediting replacement order via regional distributor', 'usr-admin-01'),
    ('del-pt-civ-01',  'prj-ptal-homeware', 'trd-pt-civil',      'cnt-apex-civil',      'Labour Shortage', 'high', '2026-09-28', 10, 4, 'mitigating', 'Tile and civil masonry workforce mobilized below required quota', 'Subcontractor requested to mobilize 6 reserve workers',  'usr-admin-01')
ON CONFLICT (id) DO NOTHING;
