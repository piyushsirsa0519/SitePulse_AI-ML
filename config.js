/**
 * Site Pulse — Frontend Environment & API Configuration
 */

const isLocalhost = 
    typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname === '::1' || 
     window.location.protocol === 'file:' || 
     !window.location.hostname);

window.SITE_PULSE_CONFIG = {
    // API Base URL (Points to Express backend)
    // On localhost, points to http://localhost:3000.
    // In production on Render, explicitly empty string ('') for pure same-origin relative requests.
    API_BASE_URL: isLocalhost ? 'http://localhost:3000' : '',

    // Supabase Public Configuration (Anon Key only — NEVER include Service Role Key)
    SUPABASE_URL: window.__SUPABASE_URL__ || 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: window.__SUPABASE_ANON_KEY__ || 'your-supabase-anon-key'
};
