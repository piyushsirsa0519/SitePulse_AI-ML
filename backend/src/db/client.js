/**
 * Site Pulse — Database Client Module
 * Manages PostgreSQL connection via `pg` pool or fallback in-memory store.
 * Phase 2 Modernized: Supports stores, contractors, contractor_assignments,
 * manpower_log, and delay_events.
 * Enforces fail-fast startup behavior in production if DATABASE_URL is missing.
 */

const { Pool } = require('pg');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const databaseUrl = isProduction ? process.env.DATABASE_URL : (isTest ? (process.env.TEST_DATABASE_URL || null) : process.env.DATABASE_URL);

// Production Database Fail-Fast Check
if (isProduction && !databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required in production mode');
}

let pool = null;

if (databaseUrl) {
    pool = new Pool({
        connectionString: databaseUrl,
        ssl: isProduction ? { rejectUnauthorized: false } : false
    });

    // Guard against idle client crashes
    pool.on('error', (err) => {
        console.error('⚠️ Unexpected error on idle PostgreSQL client:', err.message);
    });
}

// In-memory fallback mock repository matching canonical modernized schema (development/test mode only)
const inMemoryStore = {
    organizations: [
        { id: 'org-apex-retail', name: 'Apex Retail Fitouts' },
        { id: 'org-other-corp',  name: 'Other Retail Corp' }
    ],
    users: [
        { id: 'usr-admin-01',    supabase_auth_id: '11111111-1111-1111-1111-111111111111', organization_id: 'org-apex-retail', email: 'executive@apexfitouts.com', full_name: 'Executive Fitout Manager', role: 'admin' },
        { id: 'usr-engineer-01', supabase_auth_id: '22222222-2222-2222-2222-222222222222', organization_id: 'org-apex-retail', email: 'engineer@apexfitouts.com',  full_name: 'Site Engineer',            role: 'site_engineer' },
        { id: 'usr-viewer-01',   supabase_auth_id: '33333333-3333-3333-3333-333333333333', organization_id: 'org-apex-retail', email: 'viewer@apexfitouts.com',    full_name: 'Client Viewer',            role: 'viewer' },
        { id: 'usr-other-org-01', supabase_auth_id: '44444444-4444-4444-4444-444444444444', organization_id: 'org-other-corp',  email: 'other@othercorp.com',      full_name: 'Other Org User',           role: 'admin' }
    ],
    stores: [
        { id: 'str-bb-cyberhub', organization_id: 'org-apex-retail', store_code: 'STR-BB-01', name: 'Biryani Blues - Cyber Hub', brand: 'Biryani Blues', city: 'Gurugram', location_address: 'DLF Cyber Hub, DLF Phase 2, Gurugram', format: 'Food Court', square_footage: 1850.00, status: 'fitout_in_progress' },
        { id: 'str-cp-connaught', organization_id: 'org-apex-retail', store_code: 'STR-CP-01', name: 'Cafe Chai Point - CP', brand: 'Cafe Chai Point', city: 'Delhi', location_address: 'Inner Circle, Connaught Place, New Delhi', format: 'High Street', square_footage: 2200.00, status: 'fitout_in_progress' },
        { id: 'str-pt-banjara',  organization_id: 'org-apex-retail', store_code: 'STR-PT-01', name: 'P.TAL Homeware - Banjara', brand: 'P.TAL Homeware', city: 'Hyderabad', location_address: 'Road No. 12, Banjara Hills, Hyderabad', format: 'High Street', square_footage: 3400.00, status: 'fitout_in_progress' }
    ],
    projects: [
        { id: 'prj-biryani-blues', organization_id: 'org-apex-retail', store_id: 'str-bb-cyberhub', name: 'Biryani Blues - Gurugram', location: 'Gurugram', start_date: '2026-09-01', deadline: '2026-10-25', status: 'active' },
        { id: 'prj-chai-point',     organization_id: 'org-apex-retail', store_id: 'str-cp-connaught', name: 'Cafe Chai Point - Delhi',     location: 'Delhi',    start_date: '2026-09-05', deadline: '2026-10-30', status: 'active' },
        { id: 'prj-ptal-homeware',  organization_id: 'org-apex-retail', store_id: 'str-pt-banjara',  name: 'P.TAL Homeware - Hyderabad', location: 'Hyderabad', start_date: '2026-09-10', deadline: '2026-11-15', status: 'active' },
        { id: 'prj-other-org',      organization_id: 'org-other-corp',  store_id: null,               name: 'Secret Site - Mumbai',       location: 'Mumbai',   start_date: '2026-09-01', deadline: '2026-10-25', status: 'active' }
    ],
    contractors: [
        { id: 'cnt-apex-civil',      organization_id: 'org-apex-retail', name: 'Apex Civil Works LLP',         trade_specialty: 'Civil',      contact_person: 'Ramesh Sharma',  contact_email: 'ramesh@apexcivil.com',     rating: 4.5, is_active: true },
        { id: 'cnt-volt-electrical', organization_id: 'org-apex-retail', name: 'VoltCraft Electricals Ltd',    trade_specialty: 'Electrical', contact_person: 'Anil Gupta',     contact_email: 'anil@voltcraft.in',        rating: 3.8, is_active: true },
        { id: 'cnt-lumina-lighting', organization_id: 'org-apex-retail', name: 'Lumina Retail Lighting Ltd',   trade_specialty: 'Lighting',   contact_person: 'Pooja Verma',    contact_email: 'pooja@luminalight.com',    rating: 4.2, is_active: true },
        { id: 'cnt-artisan-wood',    organization_id: 'org-apex-retail', name: 'Artisan Wood & Fitouts',       trade_specialty: 'Carpentry',  contact_person: 'Gurpreet Singh', contact_email: 'gurpreet@artisanwood.com', rating: 4.7, is_active: true },
        { id: 'cnt-prism-coatings',  organization_id: 'org-apex-retail', name: 'Prism Coatings & Finishes',    trade_specialty: 'Painting',   contact_person: 'Vikram Mehta',   contact_email: 'vikram@prismfinishes.com', rating: 4.0, is_active: true }
    ],
    contractor_assignments: [
        // Biryani Blues assignments
        { id: 'ca-bb-01', project_id: 'prj-biryani-blues', trade_id: 'trd-bb-civil',      contractor_id: 'cnt-apex-civil',      assigned_date: '2026-09-01', contract_value: 450000, status: 'active' },
        { id: 'ca-bb-02', project_id: 'prj-biryani-blues', trade_id: 'trd-bb-electrical', contractor_id: 'cnt-volt-electrical', assigned_date: '2026-09-03', contract_value: 320000, status: 'active' },
        { id: 'ca-bb-03', project_id: 'prj-biryani-blues', trade_id: 'trd-bb-lighting',   contractor_id: 'cnt-lumina-lighting', assigned_date: '2026-09-05', contract_value: 180000, status: 'active' },
        { id: 'ca-bb-04', project_id: 'prj-biryani-blues', trade_id: 'trd-bb-carpentry',  contractor_id: 'cnt-artisan-wood',    assigned_date: '2026-09-10', contract_value: 500000, status: 'active' },
        { id: 'ca-bb-05', project_id: 'prj-biryani-blues', trade_id: 'trd-bb-painting',   contractor_id: 'cnt-prism-coatings',  assigned_date: '2026-09-15', contract_value: 150000, status: 'active' },
        // Chai Point assignments
        { id: 'ca-cp-01', project_id: 'prj-chai-point',     trade_id: 'trd-cp-civil',      contractor_id: 'cnt-apex-civil',      assigned_date: '2026-09-05', contract_value: 380000, status: 'active' },
        { id: 'ca-cp-02', project_id: 'prj-chai-point',     trade_id: 'trd-cp-electrical', contractor_id: 'cnt-volt-electrical', assigned_date: '2026-09-07', contract_value: 300000, status: 'active' },
        { id: 'ca-cp-03', project_id: 'prj-chai-point',     trade_id: 'trd-cp-lighting',   contractor_id: 'cnt-lumina-lighting', assigned_date: '2026-09-10', contract_value: 170000, status: 'active' },
        { id: 'ca-cp-04', project_id: 'prj-chai-point',     trade_id: 'trd-cp-carpentry',  contractor_id: 'cnt-artisan-wood',    assigned_date: '2026-09-12', contract_value: 420000, status: 'active' },
        { id: 'ca-cp-05', project_id: 'prj-chai-point',     trade_id: 'trd-cp-painting',   contractor_id: 'cnt-prism-coatings',  assigned_date: '2026-09-18', contract_value: 140000, status: 'active' },
        // P.TAL assignments
        { id: 'ca-pt-01', project_id: 'prj-ptal-homeware',  trade_id: 'trd-pt-civil',      contractor_id: 'cnt-apex-civil',      assigned_date: '2026-09-10', contract_value: 600000, status: 'active' },
        { id: 'ca-pt-02', project_id: 'prj-ptal-homeware',  trade_id: 'trd-pt-electrical', contractor_id: 'cnt-volt-electrical', assigned_date: '2026-09-12', contract_value: 350000, status: 'active' },
        { id: 'ca-pt-03', project_id: 'prj-ptal-homeware',  trade_id: 'trd-pt-lighting',   contractor_id: 'cnt-lumina-lighting', assigned_date: '2026-09-15', contract_value: 200000, status: 'active' },
        { id: 'ca-pt-04', project_id: 'prj-ptal-homeware',  trade_id: 'trd-pt-carpentry',  contractor_id: 'cnt-artisan-wood',    assigned_date: '2026-09-18', contract_value: 550000, status: 'active' },
        { id: 'ca-pt-05', project_id: 'prj-ptal-homeware',  trade_id: 'trd-pt-painting',   contractor_id: 'cnt-prism-coatings',  assigned_date: '2026-09-22', contract_value: 160000, status: 'active' }
    ],
    trades: [
        // Biryani Blues
        { id: 'trd-bb-civil',      project_id: 'prj-biryani-blues', name: 'Civil',      planned_pct: 90, default_workers_required: 12 },
        { id: 'trd-bb-electrical', project_id: 'prj-biryani-blues', name: 'Electrical', planned_pct: 75, default_workers_required: 8 },
        { id: 'trd-bb-lighting',   project_id: 'prj-biryani-blues', name: 'Lighting',   planned_pct: 60, default_workers_required: 6 },
        { id: 'trd-bb-carpentry',  project_id: 'prj-biryani-blues', name: 'Carpentry',  planned_pct: 40, default_workers_required: 10 },
        { id: 'trd-bb-painting',   project_id: 'prj-biryani-blues', name: 'Painting',   planned_pct: 20, default_workers_required: 5 },

        // Cafe Chai Point
        { id: 'trd-cp-civil',      project_id: 'prj-chai-point', name: 'Civil',      planned_pct: 95, default_workers_required: 10 },
        { id: 'trd-cp-electrical', project_id: 'prj-chai-point', name: 'Electrical', planned_pct: 80, default_workers_required: 9 },
        { id: 'trd-cp-lighting',   project_id: 'prj-chai-point', name: 'Lighting',   planned_pct: 50, default_workers_required: 6 },
        { id: 'trd-cp-carpentry',  project_id: 'prj-chai-point', name: 'Carpentry',  planned_pct: 60, default_workers_required: 8 },
        { id: 'trd-cp-painting',   project_id: 'prj-chai-point', name: 'Painting',   planned_pct: 15, default_workers_required: 4 },

        // P.TAL Homeware
        { id: 'trd-pt-civil',      project_id: 'prj-ptal-homeware', name: 'Civil',      planned_pct: 70, default_workers_required: 14 },
        { id: 'trd-pt-electrical', project_id: 'prj-ptal-homeware', name: 'Electrical', planned_pct: 45, default_workers_required: 6 },
        { id: 'trd-pt-lighting',   project_id: 'prj-ptal-homeware', name: 'Lighting',   planned_pct: 25, default_workers_required: 4 },
        { id: 'trd-pt-carpentry',  project_id: 'prj-ptal-homeware', name: 'Carpentry',  planned_pct: 55, default_workers_required: 8 },
        { id: 'trd-pt-painting',   project_id: 'prj-ptal-homeware', name: 'Painting',   planned_pct: 10, default_workers_required: 3 }
    ],
    daily_updates: [
        // Biryani Blues updates
        { id: 'upd-bb-civil-01',      trade_id: 'trd-bb-civil',      date: '2026-10-01', progress_pct: 92, workers_present: 12, workers_required: 12, reason: 'On Track', created_by: 'usr-admin-01' },
        { id: 'upd-bb-electrical-01', trade_id: 'trd-bb-electrical', date: '2026-10-01', progress_pct: 75, workers_present: 8,  workers_required: 8,  reason: 'On Track', created_by: 'usr-admin-01' },
        { id: 'upd-bb-lighting-01',   trade_id: 'trd-bb-lighting',   date: '2026-10-01', progress_pct: 65, workers_present: 6,  workers_required: 6,  reason: 'On Track', created_by: 'usr-admin-01' },
        { id: 'upd-bb-carpentry-01',  trade_id: 'trd-bb-carpentry',  date: '2026-10-01', progress_pct: 42, workers_present: 10, workers_required: 10, reason: 'On Track', created_by: 'usr-admin-01' },
        { id: 'upd-bb-painting-01',   trade_id: 'trd-bb-painting',   date: '2026-10-01', progress_pct: 22, workers_present: 5,  workers_required: 5,  reason: 'On Track', created_by: 'usr-admin-01' },

        // Cafe Chai Point updates
        { id: 'upd-cp-civil-01',      trade_id: 'trd-cp-civil',      date: '2026-10-01', progress_pct: 95, workers_present: 10, workers_required: 10, reason: 'On Track',                 created_by: 'usr-admin-01' },
        { id: 'upd-cp-electrical-01', trade_id: 'trd-cp-electrical', date: '2026-10-01', progress_pct: 52, workers_present: 4,  workers_required: 9,  reason: 'Material Delay',           created_by: 'usr-admin-01' },
        { id: 'upd-cp-lighting-01',   trade_id: 'trd-cp-lighting',   date: '2026-10-01', progress_pct: 35, workers_present: 3,  workers_required: 6,  reason: 'Waiting on Another Trade', created_by: 'usr-admin-01' },
        { id: 'upd-cp-carpentry-01',  trade_id: 'trd-cp-carpentry',  date: '2026-10-01', progress_pct: 64, workers_present: 8,  workers_required: 8,  reason: 'On Track',                 created_by: 'usr-admin-01' },
        { id: 'upd-cp-painting-01',   trade_id: 'trd-cp-painting',   date: '2026-10-01', progress_pct: 15, workers_present: 4,  workers_required: 4,  reason: 'On Track',                 created_by: 'usr-admin-01' },

        // P.TAL Homeware updates
        { id: 'upd-pt-civil-01',      trade_id: 'trd-pt-civil',      date: '2026-10-01', progress_pct: 42, workers_present: 5,  workers_required: 14, reason: 'Labour Shortage',          created_by: 'usr-admin-01' },
        { id: 'upd-pt-electrical-01', trade_id: 'trd-pt-electrical', date: '2026-10-01', progress_pct: 45, workers_present: 6,  workers_required: 6,  reason: 'On Track',                 created_by: 'usr-admin-01' },
        { id: 'upd-pt-lighting-01',   trade_id: 'trd-pt-lighting',   date: '2026-10-01', progress_pct: 20, workers_present: 2,  workers_required: 4,  reason: 'Waiting on Another Trade', created_by: 'usr-admin-01' },
        { id: 'upd-pt-carpentry-01',  trade_id: 'trd-pt-carpentry',  date: '2026-10-01', progress_pct: 64, workers_present: 9,  workers_required: 8,  reason: 'On Track',                 created_by: 'usr-admin-01' },
        { id: 'upd-pt-painting-01',   trade_id: 'trd-pt-painting',   date: '2026-10-01', progress_pct: 10, workers_present: 3,  workers_required: 3,  reason: 'On Track',                 created_by: 'usr-admin-01' }
    ],
    manpower_log: [
        { id: 'mpl-cp-elec-01', trade_id: 'trd-cp-electrical', contractor_id: 'cnt-volt-electrical', date: '2026-10-01', shift: 'day', workers_present: 4, workers_required: 9, supervisor_name: 'Anil Gupta', overtime_hours: 0, notes: 'Awaiting switchgear' },
        { id: 'mpl-pt-civ-01',  trade_id: 'trd-pt-civil',      contractor_id: 'cnt-apex-civil',      date: '2026-10-01', shift: 'day', workers_present: 5, workers_required: 14, supervisor_name: 'Ramesh Sharma', overtime_hours: 2, notes: 'Labor shortage due to festival' }
    ],
    delay_events: [
        { id: 'del-cp-elec-01', project_id: 'prj-chai-point',    trade_id: 'trd-cp-electrical', contractor_id: 'cnt-volt-electrical', category: 'Material Delay',  severity: 'high',   identified_date: '2026-09-26', resolved_date: null, estimated_delay_days: 7, actual_delay_days: 5, status: 'open',       root_cause: 'Switchgear component delivery delayed by vendor', mitigation_action: 'Expedite shipment via alternate air freight' },
        { id: 'del-pt-civ-01',  project_id: 'prj-ptal-homeware', trade_id: 'trd-pt-civil',      contractor_id: 'cnt-apex-civil',      category: 'Labour Shortage', severity: 'high',   identified_date: '2026-09-28', resolved_date: null, estimated_delay_days: 10, actual_delay_days: 4, status: 'mitigating', root_cause: 'Mason workforce shortfall on site',             mitigation_action: 'Contractor requested to mobilize 6 reserve workers' }
    ]
};

/**
 * Execute SQL query against Postgres pool if configured, or fall back to in-memory store.
 */
async function query(text, params = []) {
    if (pool) {
        return pool.query(text, params);
    }
    
    const sql = text.trim();

    // 1. Users queries
    if (sql.includes('FROM users WHERE supabase_auth_id =')) {
        const authId = params[0];
        const user = inMemoryStore.users.find(u => u.supabase_auth_id === authId);
        return { rows: user ? [user] : [] };
    }

    if (sql.includes('FROM users WHERE email =')) {
        const email = params[0];
        const user = inMemoryStore.users.find(u => u.email === email);
        return { rows: user ? [user] : [] };
    }

    if (sql.includes('FROM users WHERE id =')) {
        const id = params[0];
        const user = inMemoryStore.users.find(u => u.id === id);
        return { rows: user ? [user] : [] };
    }

    // 2. Organizations queries
    if (sql.includes('FROM organizations WHERE id =')) {
        const id = params[0];
        const org = inMemoryStore.organizations.find(o => o.id === id);
        return { rows: org ? [org] : [] };
    }

    // 3. Projects queries
    if (sql.includes('FROM projects') && sql.includes('organization_id =')) {
        const orgId = params[0];
        let results = inMemoryStore.projects.filter(p => p.organization_id === orgId);
        if (params[1]) {
            results = results.filter(p => p.id === params[1]);
        }
        return { rows: results };
    }

    // 4. Stores queries
    if (sql.includes('FROM stores') && sql.includes('organization_id =')) {
        const orgId = params[0];
        let results = inMemoryStore.stores.filter(s => s.organization_id === orgId);
        if (params[1]) {
            results = results.filter(s => s.id === params[1]);
        }
        return { rows: results };
    }

    // 5. Contractors queries
    if (sql.includes('FROM contractors') && sql.includes('organization_id =')) {
        const orgId = params[0];
        let results = inMemoryStore.contractors.filter(c => c.organization_id === orgId);
        if (params[1]) {
            results = results.filter(c => c.id === params[1]);
        }
        return { rows: results };
    }

    // 6. Delay Events queries
    if (sql.includes('FROM delay_events') && sql.includes('project_id =')) {
        const projId = params[0];
        let results = inMemoryStore.delay_events.filter(d => d.project_id === projId);
        return { rows: results };
    }

    // 7. Manpower Log queries
    if (sql.includes('FROM manpower_log') && sql.includes('trade_id =')) {
        const tradeId = params[0];
        let results = inMemoryStore.manpower_log.filter(m => m.trade_id === tradeId);
        return { rows: results };
    }

    return { rows: [] };
}

/**
 * Health check helper for database connection.
 */
async function checkHealth() {
    if (pool) {
        try {
            const start = Date.now();
            await pool.query('SELECT 1');
            const latencyMs = Date.now() - start;
            return {
                mode: 'postgresql',
                status: 'healthy',
                latency_ms: latencyMs
            };
        } catch (err) {
            return {
                mode: 'postgresql',
                status: 'degraded',
                error: err.message
            };
        }
    }

    return {
        mode: 'in_memory',
        status: 'healthy',
        active_projects: inMemoryStore.projects.length,
        active_contractors: inMemoryStore.contractors.length
    };
}

module.exports = {
    pool,
    query,
    store: inMemoryStore,
    checkHealth
};
