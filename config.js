/**
 * Site Pulse — Frontend Environment & API Configuration
 */

const isFileOrEmpty = 
    typeof window === 'undefined' ||
    !window.location.hostname || 
    window.location.protocol === 'file:' || 
    window.location.origin === 'null';

const isLocalDev = 
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname === '::1');

let apiBaseUrl = 'http://localhost:3000';
if (!isFileOrEmpty && window.location.origin) {
    if (isLocalDev && window.location.port !== '3000' && window.location.port !== '') {
        apiBaseUrl = 'http://localhost:3000';
    } else {
        apiBaseUrl = window.location.origin;
    }
}

window.SITE_PULSE_CONFIG = {
    // API Base URL (Points to Express backend)
    // In production on Render: uses same-origin (e.g. https://sitepulse-backend-898s.onrender.com).
    // On localhost: defaults to http://localhost:3000.
    API_BASE_URL: apiBaseUrl,

    // Supabase Public Configuration (Anon Key only — NEVER include Service Role Key)
    SUPABASE_URL: window.__SUPABASE_URL__ || 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: window.__SUPABASE_ANON_KEY__ || 'your-supabase-anon-key'
};
