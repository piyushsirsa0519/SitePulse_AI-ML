/**
 * Site Pulse — Live Project Tracker
 * Retail Fitout Construction Management System
 * Frontend Core — Phase 5 Upgraded Enterprise Suite
 * Integrated with Express Backend API, Supabase Auth, and Phase 4 Applied ML Models
 */

// Application State Store (Single Source of Truth)
const SitePulseState = {
    theme: localStorage.getItem('site_pulse_theme') || 'dark',
    activeView: 'dashboard', // 'dashboard' | 'project' | 'analytics' | 'copilot'
    activeProjectId: 'prj-biryani-blues',
    referenceDate: '2026-10-01',
    user: null,
    organization: null,
    portfolio: [],
    contractors: [],
    currentDashboard: null,
    currentMlRisk: null,
    currentMlAnomalies: null,
    portfolioSearch: '',
    portfolioFilter: 'all', // 'all' | 'on-track' | 'attention' | 'behind'
    portfolioSort: 'delay', // 'delay' | 'completion-asc' | 'completion-desc' | 'name'
    copilot: {
        selectedProjectId: '', // '' for entire portfolio, or project UUID
        conversationHistory: [],
        status: null,
        isThinking: false
    },
    isLoading: false,
    error: null
};

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initClock();
    setupEventListeners();
    checkAuthAndLoadApp();
    console.log('⚡ Site Pulse Application Initialized successfully (Phase 5 Enterprise Suite).');
});

/**
 * ==========================================================================
 * THEME & HEADER CLOCK MANAGEMENT
 * ==========================================================================
 */

function initTheme() {
    const currentTheme = SitePulseState.theme;
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);
}

function toggleTheme() {
    const newTheme = SitePulseState.theme === 'dark' ? 'light' : 'dark';
    SitePulseState.theme = newTheme;
    localStorage.setItem('site_pulse_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!themeBtn) return;
    if (theme === 'dark') {
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        themeBtn.title = 'Switch to Light Theme';
    } else {
        themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        themeBtn.title = 'Switch to Dark Theme';
    }
}

function initClock() {
    const clockEl = document.getElementById('clock-time');
    if (!clockEl) return;

    function updateTime() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    updateTime();
    setInterval(updateTime, 1000);
}

/**
 * ==========================================================================
 * VIEW SWITCHING & NAVIGATION
 * ==========================================================================
 */

function switchView(viewName) {
    SitePulseState.activeView = viewName;

    // 1. Update Subnav tab buttons
    const tabDashboard = document.getElementById('tab-nav-dashboard');
    const tabProject = document.getElementById('tab-nav-project');
    const tabAnalytics = document.getElementById('tab-nav-analytics');
    const tabCopilot = document.getElementById('tab-nav-copilot');

    if (tabDashboard) {
        tabDashboard.classList.toggle('active', viewName === 'dashboard');
        tabDashboard.setAttribute('aria-selected', viewName === 'dashboard');
    }
    if (tabProject) {
        tabProject.classList.toggle('active', viewName === 'project');
        tabProject.setAttribute('aria-selected', viewName === 'project');
    }
    if (tabAnalytics) {
        tabAnalytics.classList.toggle('active', viewName === 'analytics');
        tabAnalytics.setAttribute('aria-selected', viewName === 'analytics');
    }
    if (tabCopilot) {
        tabCopilot.classList.toggle('active', viewName === 'copilot');
        tabCopilot.setAttribute('aria-selected', viewName === 'copilot');
    }

    // 2. Toggle App View DOM containers
    const viewDashboard = document.getElementById('view-dashboard');
    const viewProject = document.getElementById('view-project');
    const viewAnalytics = document.getElementById('view-analytics');
    const viewCopilot = document.getElementById('view-copilot');

    if (viewDashboard) viewDashboard.style.display = viewName === 'dashboard' ? 'block' : 'none';
    if (viewProject) viewProject.style.display = viewName === 'project' ? 'block' : 'none';
    if (viewAnalytics) viewAnalytics.style.display = viewName === 'analytics' ? 'block' : 'none';
    if (viewCopilot) viewCopilot.style.display = viewName === 'copilot' ? 'block' : 'none';

    // 3. Trigger context-specific renders
    if (viewName === 'dashboard') {
        renderExecutiveKpiBar();
        renderPortfolioCardsGrid();
        renderPortfolioAnalyticsPanels();
        renderPortfolioView();
    } else if (viewName === 'project') {
        if (!SitePulseState.currentDashboard) {
            loadProjectDashboard(SitePulseState.activeProjectId);
        } else {
            renderProjectOverview();
            renderProjectMlInsights();
            renderTradesTable();
            renderBottleneckAnalysis();
            renderProjectDelayEvents();
        }
    } else if (viewName === 'analytics') {
        renderTradeMatrixView();
        renderManpowerAnalytics();
        renderContractorsDirectory();
    } else if (viewName === 'copilot') {
        initCopilotView();
    }
}

/**
 * ==========================================================================
 * SETUP EVENT LISTENERS
 * ==========================================================================
 */

function setupEventListeners() {
    // Theme toggle button
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Suite subnav tabs
    const tabDashboard = document.getElementById('tab-nav-dashboard');
    if (tabDashboard) tabDashboard.addEventListener('click', () => switchView('dashboard'));

    const tabProject = document.getElementById('tab-nav-project');
    if (tabProject) tabProject.addEventListener('click', () => switchView('project'));

    const tabAnalytics = document.getElementById('tab-nav-analytics');
    if (tabAnalytics) tabAnalytics.addEventListener('click', () => switchView('analytics'));

    const tabCopilot = document.getElementById('tab-nav-copilot');
    if (tabCopilot) tabCopilot.addEventListener('click', () => switchView('copilot'));

    // Copilot event listeners
    setupCopilotEventListeners();

    // Reference date input
    const datePicker = document.getElementById('reference-date-select');
    if (datePicker) {
        datePicker.addEventListener('change', async (e) => {
            const newDate = e.target.value;
            if (newDate) {
                SitePulseState.referenceDate = newDate;
                showToast(`Reference date updated to ${newDate}`, 'info');
                await refreshAllData();
            }
        });
    }

    // Refresh live data button
    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.querySelector('i').classList.add('fa-spin');
            await refreshAllData();
            refreshBtn.querySelector('i').classList.remove('fa-spin');
            showToast('Portfolio and live project metrics refreshed', 'success');
        });
    }

    // Portfolio search input
    const searchInput = document.getElementById('portfolio-search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            SitePulseState.portfolioSearch = e.target.value.trim().toLowerCase();
            if (clearSearchBtn) {
                clearSearchBtn.style.display = SitePulseState.portfolioSearch ? 'block' : 'none';
            }
            renderPortfolioCardsGrid();
        });
    }
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            SitePulseState.portfolioSearch = '';
            clearSearchBtn.style.display = 'none';
            renderPortfolioCardsGrid();
        });
    }

    // Portfolio status filter pills
    document.querySelectorAll('.status-pill-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-pill-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            SitePulseState.portfolioFilter = btn.getAttribute('data-filter') || 'all';
            renderPortfolioCardsGrid();
        });
    });

    // Portfolio sort select
    const sortSelect = document.getElementById('portfolio-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            SitePulseState.portfolioSort = e.target.value;
            renderPortfolioCardsGrid();
        });
    }

    // Dropdown change listener (Project Deep Dive)
    const projectDropdown = document.getElementById('project-dropdown');
    if (projectDropdown) {
        projectDropdown.addEventListener('change', (e) => {
            selectProject(e.target.value);
        });
    }

    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Post Daily Update button
    const openUpdateBtn = document.getElementById('open-daily-update-btn');
    if (openUpdateBtn) {
        openUpdateBtn.addEventListener('click', openDailyUpdateModal);
    }

    // Modal Close Buttons
    const closeUpdateModalBtn = document.getElementById('close-update-modal-btn');
    if (closeUpdateModalBtn) {
        closeUpdateModalBtn.addEventListener('click', closeDailyUpdateModal);
    }

    const cancelUpdateBtn = document.getElementById('cancel-update-btn');
    if (cancelUpdateBtn) {
        cancelUpdateBtn.addEventListener('click', closeDailyUpdateModal);
    }

    // Modal Backdrop click to close
    const updateModal = document.getElementById('daily-update-modal');
    if (updateModal) {
        updateModal.addEventListener('click', (e) => {
            if (e.target === updateModal) {
                closeDailyUpdateModal();
            }
        });
    }

    // Submit All Updates button
    const submitAllBtn = document.getElementById('submit-all-updates-btn');
    if (submitAllBtn) {
        submitAllBtn.addEventListener('click', handleDailyUpdateSubmit);
    }

    // Listen for unauthorized 401 events
    document.addEventListener('sitepulse:unauthorized', () => {
        console.warn('⚠️ Session expired or unauthorized. Returning to login.');
        handleLogout();
    });
}

/**
 * ==========================================================================
 * DATA LOADING & AUTHENTICATION ORCHESTRATION
 * ==========================================================================
 */

async function checkAuthAndLoadApp() {
    const session = SitePulseAuth.getSession();
    const loginModal = document.getElementById('login-modal');
    const userBadge = document.getElementById('user-profile-badge');
    const logoutBtn = document.getElementById('logout-btn');

    if (!session) {
        if (loginModal) loginModal.style.display = 'flex';
        if (userBadge) userBadge.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        return;
    }

    try {
        SitePulseState.isLoading = true;

        // 1. Load User Profile & Organization (GET /me)
        const meData = await SitePulseAPI.getMe();
        SitePulseState.user = meData.user;
        SitePulseState.organization = meData.organization;

        // Render User Profile Badge & Daily Update Button Role Access
        if (userBadge) {
            document.getElementById('user-name-display').textContent = meData.user.name || meData.user.email;
            document.getElementById('user-role-display').textContent = meData.user.role;
            userBadge.style.display = 'flex';
        }
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (loginModal) loginModal.style.display = 'none';

        // Role-based visibility: admin, manager, site_engineer can post updates
        const openUpdateBtn = document.getElementById('open-daily-update-btn');
        const canSubmitUpdate = ['admin', 'manager', 'site_engineer'].includes(meData.user.role);
        if (openUpdateBtn) {
            openUpdateBtn.style.display = canSubmitUpdate ? 'inline-flex' : 'none';
        }

        // 2. Fetch Portfolio, Contractors & Active Project Dashboard
        await refreshAllData();

    } catch (err) {
        console.error('❌ Failed to load application data:', err);
        if (err.statusCode === 401) {
            handleLogout();
        } else {
            showGlobalError(`Failed to connect to Site Pulse server: ${err.message}`);
        }
    } finally {
        SitePulseState.isLoading = false;
    }
}

async function refreshAllData() {
    try {
        // 1. Fetch Portfolio Data
        const portfolioData = await SitePulseAPI.getPortfolio(SitePulseState.referenceDate);
        SitePulseState.portfolio = portfolioData;

        // Update subnav total pill
        const countBadge = document.getElementById('portfolio-total-badge');
        if (countBadge) countBadge.textContent = portfolioData.length;

        // 2. Fetch Contractors Directory
        try {
            const contractors = await SitePulseAPI.getContractors();
            SitePulseState.contractors = contractors || [];
        } catch (cErr) {
            console.warn('Contractors fetch error (fallback to local):', cErr);
        }

        // 3. Ensure valid activeProjectId
        if (portfolioData.length > 0 && !portfolioData.find(p => p.id === SitePulseState.activeProjectId)) {
            SitePulseState.activeProjectId = portfolioData[0].id;
        }

        // 4. Render Dashboard Views
        renderProjectSelector();
        renderExecutiveKpiBar();
        renderPortfolioCardsGrid();
        renderPortfolioAnalyticsPanels();
        renderPortfolioView();

        // 5. Load Active Project Deep Dive
        if (SitePulseState.activeProjectId) {
            await loadProjectDashboard(SitePulseState.activeProjectId);
        }

        // 6. Render Trade & Contractor Analytics
        renderTradeMatrixView();
        renderManpowerAnalytics();
        renderContractorsDirectory();

    } catch (err) {
        console.error('Failed to refresh data:', err);
        showToast(`Failed to load data: ${err.message}`, 'error');
    }
}

/**
 * Load Active Project Dashboard & Phase 4 ML Insights from Backend API
 */
async function loadProjectDashboard(projectId) {
    try {
        renderDashboardLoadingState();
        SitePulseState.activeProjectId = projectId;

        // 1. Fetch Core Dashboard Analytics
        const dashboardData = await SitePulseAPI.getProjectDashboard(projectId, SitePulseState.referenceDate);
        SitePulseState.currentDashboard = dashboardData;

        // 2. Fetch Phase 4 ML Inference Insights (Risk Score & Anomalies) in Parallel
        let mlRisk = null;
        let mlAnomalies = null;
        try {
            const [riskRes, anomRes] = await Promise.all([
                SitePulseAPI.getProjectRiskScore(projectId, SitePulseState.referenceDate).catch(err => ({
                    model_status: 'fallback_heuristic',
                    message: err.message,
                    delay_risk_score: 0.45,
                    risk_category: 'Medium',
                    is_experimental_synthetic: true,
                    disclaimer: 'Trained on synthetic simulation data for research & prototyping.'
                })),
                SitePulseAPI.getProjectAnomalies(projectId).catch(err => ({
                    model_status: 'fallback_heuristic',
                    message: err.message,
                    total_analyzed: 0,
                    anomalies_detected_count: 0,
                    anomalies: [],
                    is_experimental_synthetic: true,
                    disclaimer: 'Trained on synthetic simulation data for research & prototyping.'
                }))
            ]);
            mlRisk = riskRes;
            mlAnomalies = anomRes;
        } catch (mlErr) {
            console.warn('ML Insights fetch error:', mlErr);
        }

        SitePulseState.currentMlRisk = mlRisk;
        SitePulseState.currentMlAnomalies = mlAnomalies;

        // 3. Render All Project Components
        renderProjectOverview();
        renderProjectMlInsights();
        renderTradesTable();
        renderBottleneckAnalysis();
        renderProjectDelayEvents();

    } catch (err) {
        console.error(`❌ Failed to load dashboard for project ${projectId}:`, err);
        if (err.statusCode === 404) {
            showDashboardError('Project not found or does not belong to your organization.');
        } else {
            showDashboardError(`Unable to load project dashboard: ${err.message}`);
        }
    }
}

/**
 * Select Active Project and Update UI
 */
async function selectProject(projectId, autoSwitchView = false) {
    SitePulseState.activeProjectId = projectId;
    
    // Sync tab button active states
    document.querySelectorAll('.project-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-project-id') === projectId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Sync dropdown
    const dropdownSelect = document.getElementById('project-dropdown');
    if (dropdownSelect) dropdownSelect.value = projectId;

    // Sync Copilot scope selector to active project
    SitePulseState.copilot.selectedProjectId = projectId;
    const copilotSelector = document.getElementById('copilot-project-select');
    if (copilotSelector) copilotSelector.value = projectId;

    if (autoSwitchView) {
        switchView('project');
    }

    // Fetch and render project dashboard
    await loadProjectDashboard(projectId);
    renderPortfolioView();
}

/**
 * ==========================================================================
 * VIEW 1: EXECUTIVE PORTFOLIO DASHBOARD RENDERING
 * ==========================================================================
 */

/**
 * Render Executive Overview KPI Bar (7 Key Metrics)
 */
function renderExecutiveKpiBar() {
    const container = document.getElementById('executive-kpi-bar');
    if (!container) return;

    const portfolio = SitePulseState.portfolio || [];
    const totalProjects = portfolio.length;

    const onTrackCount = portfolio.filter(p => p.healthStatus === 'On Track' || (p.delayDays === 0 && p.variance >= 0)).length;
    const attentionCount = portfolio.filter(p => p.healthStatus === 'Attention Needed' || (p.delayDays > 0 && p.delayDays <= 3)).length;
    const delayedCount = portfolio.filter(p => p.delayDays > 3 || p.healthStatus === 'Behind Schedule').length;

    const sumActual = portfolio.reduce((acc, p) => acc + (Number(p.overallActual) || 0), 0);
    const avgCompletion = totalProjects > 0 ? Math.round(sumActual / totalProjects) : 0;

    const totalWorkersPresent = portfolio.reduce((acc, p) => acc + (Number(p.totalWorkersPresent) || 0), 0);
    const totalWorkersRequired = portfolio.reduce((acc, p) => acc + (Number(p.totalWorkersRequired) || 0), 0);
    const workforceFulfillment = totalWorkersRequired > 0 ? Math.round((totalWorkersPresent / totalWorkersRequired) * 100) : 100;

    const activeContractors = SitePulseState.contractors.length > 0 ? SitePulseState.contractors.length : 5;

    container.innerHTML = `
        <!-- KPI 1: Active Projects -->
        <div class="exec-kpi-card" style="--card-accent: var(--accent-blue); --icon-bg: rgba(59, 130, 246, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">Active Sites</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-store"></i></div>
            </div>
            <div class="exec-kpi-value">${totalProjects} <span class="exec-kpi-unit">Stores</span></div>
            <div class="exec-kpi-subtext">Portfolio Monitoring Active</div>
        </div>

        <!-- KPI 2: On Track Projects -->
        <div class="exec-kpi-card" style="--card-accent: var(--accent-green); --icon-bg: rgba(16, 185, 129, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">On Track</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-circle-check"></i></div>
            </div>
            <div class="exec-kpi-value" style="color: var(--accent-green);">${onTrackCount} <span class="exec-kpi-unit">/ ${totalProjects}</span></div>
            <div class="exec-kpi-subtext">${totalProjects > 0 ? Math.round((onTrackCount / totalProjects) * 100) : 0}% adhering to plan</div>
        </div>

        <!-- KPI 3: Attention Needed -->
        <div class="exec-kpi-card" style="--card-accent: var(--accent-orange); --icon-bg: rgba(245, 158, 11, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">At Risk</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
            </div>
            <div class="exec-kpi-value" style="color: var(--accent-orange);">${attentionCount} <span class="exec-kpi-unit">Sites</span></div>
            <div class="exec-kpi-subtext">Minor variance / 1 trade lagging</div>
        </div>

        <!-- KPI 4: Delayed Projects -->
        <div class="exec-kpi-card" style="--card-accent: var(--accent-red); --icon-bg: rgba(239, 68, 68, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">Delayed</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            </div>
            <div class="exec-kpi-value" style="color: var(--accent-red);">${delayedCount} <span class="exec-kpi-unit">> 3d late</span></div>
            <div class="exec-kpi-subtext">Requires immediate intervention</div>
        </div>

        <!-- KPI 5: Overall Portfolio Completion -->
        <div class="exec-kpi-card" style="--card-accent: var(--accent-cyan); --icon-bg: rgba(6, 182, 212, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">Avg Completion</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-chart-line"></i></div>
            </div>
            <div class="exec-kpi-value">${avgCompletion}<span class="exec-kpi-unit">%</span></div>
            <div class="pcard-progress-track" style="margin-top: 0.2rem;">
                <div class="pcard-progress-fill accent-blue" style="width: ${avgCompletion}%;"></div>
            </div>
        </div>

        <!-- KPI 6: Active Contractors -->
        <div class="exec-kpi-card" style="--card-accent: #8b5cf6; --icon-bg: rgba(139, 92, 246, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">Contractors</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-hard-hat"></i></div>
            </div>
            <div class="exec-kpi-value">${activeContractors} <span class="exec-kpi-unit">Partners</span></div>
            <div class="exec-kpi-subtext">Across 5 Trade Disciplines</div>
        </div>

        <!-- KPI 7: Workforce Availability -->
        <div class="exec-kpi-card" style="--card-accent: var(--accent-green); --icon-bg: rgba(16, 185, 129, 0.15);">
            <div class="exec-kpi-header">
                <span class="exec-kpi-label">On-Site Workforce</span>
                <div class="exec-kpi-icon"><i class="fa-solid fa-users"></i></div>
            </div>
            <div class="exec-kpi-value">${totalWorkersPresent} <span class="exec-kpi-unit">/ ${totalWorkersRequired}</span></div>
            <div class="exec-kpi-subtext"><strong>${workforceFulfillment}%</strong> Headcount fulfillment</div>
        </div>
    `;
}

/**
 * Render Project Health Cards Grid with Filter, Search, and Sorting
 */
function renderPortfolioCardsGrid() {
    const gridContainer = document.getElementById('portfolio-cards-grid');
    const countBadge = document.getElementById('portfolio-visible-count');
    if (!gridContainer) return;

    let items = [...(SitePulseState.portfolio || [])];

    // 1. Text Search Filter
    if (SitePulseState.portfolioSearch) {
        const query = SitePulseState.portfolioSearch;
        items = items.filter(p => {
            const nameMatch = (p.name || '').toLowerCase().includes(query);
            const cityMatch = (p.city || p.location || '').toLowerCase().includes(query);
            const bottleneckMatch = (p.bottleneckName || '').toLowerCase().includes(query);
            return nameMatch || cityMatch || bottleneckMatch;
        });
    }

    // 2. Status Pill Filter
    if (SitePulseState.portfolioFilter !== 'all') {
        if (SitePulseState.portfolioFilter === 'on-track') {
            items = items.filter(p => p.healthStatus === 'On Track' || (p.delayDays === 0 && p.variance >= 0));
        } else if (SitePulseState.portfolioFilter === 'attention') {
            items = items.filter(p => p.healthStatus === 'Attention Needed' || (p.delayDays > 0 && p.delayDays <= 3));
        } else if (SitePulseState.portfolioFilter === 'behind') {
            items = items.filter(p => p.delayDays > 3 || p.healthStatus === 'Behind Schedule');
        }
    }

    // 3. Sorting
    if (SitePulseState.portfolioSort === 'delay') {
        items.sort((a, b) => (b.delayDays - a.delayDays) || (b.maxGap - a.maxGap));
    } else if (SitePulseState.portfolioSort === 'completion-asc') {
        items.sort((a, b) => (a.overallActual - b.overallActual));
    } else if (SitePulseState.portfolioSort === 'completion-desc') {
        items.sort((a, b) => (b.overallActual - a.overallActual));
    } else if (SitePulseState.portfolioSort === 'name') {
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    if (countBadge) {
        countBadge.textContent = `Showing ${items.length} of ${SitePulseState.portfolio.length} projects`;
    }

    if (items.length === 0) {
        gridContainer.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 0.75rem; display: block;"></i>
                <h4 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.25rem;">No matching fitout projects found</h4>
                <p>Try clearing your search query or switching your status filter.</p>
            </div>
        `;
        return;
    }

    let cardsHtml = '';
    items.forEach(p => {
        const actual = Number(p.overallActual) || 0;
        const planned = Number(p.overallPlanned) || 0;
        const variance = actual - planned;
        const isLate = p.delayDays > 0;

        let statusClass = 'ontrack';
        let statusLabel = 'On Track';
        let statusIcon = 'fa-circle-check';

        if (p.delayDays > 0) {
            statusClass = p.delayDays > 3 ? 'behind' : 'attention';
            statusLabel = `${p.delayDays}d Delayed`;
            statusIcon = 'fa-triangle-exclamation';
        } else if (p.healthStatus === 'Behind Schedule') {
            statusClass = 'behind';
            statusLabel = variance < 0 ? `${Math.abs(variance)}% Behind` : 'Behind Schedule';
            statusIcon = 'fa-triangle-exclamation';
        } else if (p.healthStatus === 'Attention Needed') {
            statusClass = 'attention';
            statusLabel = variance < 0 ? `${Math.abs(variance)}% Behind` : 'Attention Needed';
            statusIcon = 'fa-circle-exclamation';
        } else {
            statusClass = 'ontrack';
            statusLabel = p.delayDays < 0 ? `${Math.abs(p.delayDays)}d Ahead` : 'On Track';
            statusIcon = 'fa-circle-check';
        }

        // ML Risk Category Tag approximation for card preview
        let mlRiskClass = 'low';
        let mlRiskLabel = 'Low Delay Risk';
        if (p.delayDays > 3 || variance <= -8) {
            mlRiskClass = 'high';
            mlRiskLabel = 'Elevated Delay Risk';
        } else if (p.delayDays > 0 || variance < 0) {
            mlRiskClass = 'medium';
            mlRiskLabel = 'Moderate Risk';
        }

        cardsHtml += `
            <div class="portfolio-card-item" data-project-id="${p.id}" tabindex="0" role="button" aria-label="Deep dive into ${escapeHtml(p.name)}">
                <div class="pcard-header">
                    <div class="pcard-title-wrap">
                        <h4>${escapeHtml(p.name)}</h4>
                        <div class="pcard-meta-row">
                            <span class="pcard-city-pill"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(p.city || p.location)}</span>
                            <span>•</span>
                            <span>Deadline: <strong>${escapeHtml(p.deadlineStr)}</strong></span>
                        </div>
                    </div>
                    <span class="pcard-status-pill ${statusClass}">
                        <i class="fa-solid ${statusIcon}"></i>
                        <span>${statusLabel}</span>
                    </span>
                </div>

                <div class="pcard-progress-box">
                    <div class="pcard-progress-labels">
                        <div class="pcard-actual-label">${actual}<span>% Completed</span></div>
                        <div class="pcard-variance-label" style="color: ${variance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
                            ${variance >= 0 ? '+' : ''}${variance}% vs Plan (${planned}%)
                        </div>
                    </div>
                    <div class="pcard-progress-track">
                        <div class="pcard-progress-fill ${variance >= 0 ? 'accent-green' : 'accent-orange'}" style="width: ${Math.min(100, actual)}%;"></div>
                    </div>
                </div>

                <div class="pcard-metrics-grid">
                    <div class="pcard-metric-col">
                        <span class="pcard-m-label">On-Site Workforce</span>
                        <span class="pcard-m-val"><i class="fa-solid fa-user-group" style="font-size: 0.8rem; color: var(--accent-blue);"></i> ${p.totalWorkersPresent ?? '--'} / ${p.totalWorkersRequired ?? '--'}</span>
                    </div>
                    <div class="pcard-metric-col">
                        <span class="pcard-m-label">Primary Bottleneck</span>
                        <span class="pcard-m-val" style="color: ${p.bottleneckName !== 'None' ? 'var(--accent-orange)' : 'var(--accent-green)'}">
                            <i class="fa-solid ${p.bottleneckName !== 'None' ? 'fa-triangle-exclamation' : 'fa-check'}" style="font-size: 0.8rem;"></i>
                            ${escapeHtml(p.bottleneckName)}
                        </span>
                    </div>
                </div>

                <div class="pcard-footer-intelligence">
                    <span class="pcard-risk-indicator ${mlRiskClass}">
                        <i class="fa-solid fa-brain"></i>
                        <span>${mlRiskLabel}</span>
                    </span>
                    <span class="pcard-inspect-link">
                        <span>Deep Dive</span> <i class="fa-solid fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        `;
    });

    gridContainer.innerHTML = cardsHtml;

    // Attach click events
    gridContainer.querySelectorAll('.portfolio-card-item').forEach(card => {
        card.addEventListener('click', () => {
            const pid = card.getAttribute('data-project-id');
            if (pid) selectProject(pid, true);
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const pid = card.getAttribute('data-project-id');
                if (pid) selectProject(pid, true);
            }
        });
    });
}

/**
 * Render Cross-Portfolio Analytics & Distribution Panels
 */
function renderPortfolioAnalyticsPanels() {
    const container = document.getElementById('portfolio-analytics-panels');
    if (!container) return;

    const portfolio = SitePulseState.portfolio || [];

    // Panel 1: Planned vs Actual Progress Bars List
    let progressBarsHtml = '';
    portfolio.forEach(p => {
        const actual = Number(p.overallActual) || 0;
        const planned = Number(p.overallPlanned) || 0;
        const barColor = actual >= planned ? 'accent-green' : 'accent-orange';

        progressBarsHtml += `
            <div class="comp-bar-item">
                <div class="comp-bar-labels">
                    <span class="comp-bar-name">${escapeHtml(p.name)}</span>
                    <span class="comp-bar-vals">Actual: <strong>${actual}%</strong> | Plan: <strong>${planned}%</strong></span>
                </div>
                <div class="comp-dual-track" title="${actual}% actual completed vs ${planned}% target">
                    <div class="comp-actual-bar ${barColor}" style="width: ${Math.min(100, actual)}%;"></div>
                    <div class="comp-target-marker" style="left: ${Math.min(100, planned)}%;" title="Target: ${planned}%"></div>
                </div>
            </div>
        `;
    });

    // Panel 2: Workforce Attendance Distribution
    let workforceHtml = '';
    portfolio.forEach(p => {
        const present = Number(p.totalWorkersPresent) || 0;
        const required = Number(p.totalWorkersRequired) || 1;
        const pct = Math.min(100, Math.round((present / required) * 100));
        const colorClass = pct >= 90 ? 'accent-green' : (pct >= 70 ? 'accent-orange' : 'accent-red');

        workforceHtml += `
            <div class="comp-bar-item">
                <div class="comp-bar-labels">
                    <span class="comp-bar-name">${escapeHtml(p.name)}</span>
                    <span class="comp-bar-vals"><strong>${present}</strong> / ${required} workers (${pct}%)</span>
                </div>
                <div class="comp-dual-track">
                    <div class="comp-actual-bar ${colorClass}" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <!-- Comparison Panel 1: Progress Variance -->
        <article class="panalytics-card">
            <div class="panalytics-header">
                <div class="panalytics-title">
                    <i class="fa-solid fa-chart-column"></i>
                    <span>Planned vs Actual Progress Comparison</span>
                </div>
                <span class="subnav-pill" style="font-size: 0.72rem;">White Marker = Target</span>
            </div>
            <div class="comparison-bars-list">
                ${progressBarsHtml}
            </div>
        </article>

        <!-- Comparison Panel 2: Workforce Fulfillment -->
        <article class="panalytics-card">
            <div class="panalytics-header">
                <div class="panalytics-title">
                    <i class="fa-solid fa-users-viewfinder"></i>
                    <span>Workforce Headcount Fulfillment by Store</span>
                </div>
                <span class="subnav-pill" style="font-size: 0.72rem;">Target: 100%</span>
            </div>
            <div class="comparison-bars-list">
                ${workforceHtml}
            </div>
        </article>
    `;
}

/**
 * ==========================================================================
 * VIEW 2: PROJECT DETAILS & DEEP DIVE RENDERING
 * ==========================================================================
 */

/**
 * Render Project Selector (Tabs and Dropdown) using API Portfolio Data
 */
function renderProjectSelector() {
    const tabsContainer = document.getElementById('project-tabs');
    const dropdownSelect = document.getElementById('project-dropdown');

    if (!tabsContainer || !dropdownSelect) return;

    tabsContainer.innerHTML = '';
    dropdownSelect.innerHTML = '';

    const projects = SitePulseState.portfolio || [];

    projects.forEach(project => {
        const isActive = project.id === SitePulseState.activeProjectId;

        const badgeLabel = project.delayDays > 0 
            ? `${project.delayDays}d late` 
            : (project.healthStatus === 'Behind Schedule' ? 'Behind' : (project.healthStatus === 'Attention Needed' ? 'Attention' : 'On Track'));
        const badgeClass = project.healthStatus === 'On Track' ? 'ontrack' : (project.healthStatus === 'Attention Needed' ? 'attention' : 'behind');

        // Render Tab Button
        const tabBtn = document.createElement('button');
        tabBtn.className = `project-tab-btn ${isActive ? 'active' : ''}`;
        tabBtn.setAttribute('data-project-id', project.id);
        tabBtn.innerHTML = `
            <i class="fa-solid fa-store"></i>
            <span>${escapeHtml(project.name)}</span>
            <span class="tab-badge ${badgeClass}">${badgeLabel}</span>
        `;
        tabBtn.addEventListener('click', () => selectProject(project.id));
        tabsContainer.appendChild(tabBtn);

        // Render Dropdown Option
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = `${project.name} (${project.city})`;
        option.selected = isActive;
        dropdownSelect.appendChild(option);
    });
}

/**
 * Render Executive Project Overview Card directly from Backend API Response
 */
function renderProjectOverview() {
    const container = document.getElementById('project-overview-container');
    if (!container) return;

    const db = SitePulseState.currentDashboard;
    if (!db || !db.project || !db.metrics) return;

    const project = db.project;
    const metrics = db.metrics;
    const store = db.store || {};

    const formattedStart = new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedDeadline = new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    container.innerHTML = `
        <article class="overview-card">
            <!-- Overview Card Header -->
            <div class="overview-card-header">
                <div class="header-meta">
                    <div class="project-title-row">
                        <h2>${escapeHtml(project.name)}</h2>
                        <span class="city-badge">
                            <i class="fa-solid fa-location-dot"></i> ${escapeHtml(project.location)}
                        </span>
                        ${store.format ? `<span class="city-badge" style="background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan);"><i class="fa-solid fa-shop"></i> ${escapeHtml(store.format)} (${Number(store.square_footage).toLocaleString()} sq ft)</span>` : ''}
                    </div>
                    <div class="date-range-badge">
                        <i class="fa-regular fa-calendar-check"></i>
                        <span>Start: <strong>${formattedStart}</strong></span>
                        <span>•</span>
                        <span>Target Deadline: <strong>${formattedDeadline}</strong></span>
                    </div>
                </div>

                <div class="header-status-badge ${metrics.statusClass}">
                    <i class="fa-solid ${metrics.healthStatus === 'On Track' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                    <span>${metrics.healthStatus}</span>
                </div>
            </div>

            <!-- Overview Card Body: 4 Core Metric Blocks -->
            <div class="overview-card-body">
                <!-- Metric 1: Overall Completion -->
                <div class="metric-block">
                    <div class="metric-block-header">
                        <span class="metric-label">
                            <i class="fa-solid fa-chart-line"></i> Overall Progress
                        </span>
                        <div class="metric-icon-wrapper">
                            <i class="fa-solid fa-percent"></i>
                        </div>
                    </div>
                    <div class="metric-value-large">
                        ${metrics.overallActual}<span class="metric-unit">%</span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill ${metrics.overallActual >= metrics.overallPlanned ? 'accent-green' : 'accent-orange'}" style="width: ${metrics.overallActual}%"></div>
                    </div>
                    <div class="metric-subtext">
                        <span>Target: <strong>${metrics.overallPlanned}%</strong></span>
                        <span style="color: ${metrics.variance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
                            ${metrics.variance >= 0 ? '+' : ''}${metrics.variance}% variance
                        </span>
                    </div>
                </div>

                <!-- Metric 2: Timeline Schedule -->
                <div class="metric-block">
                    <div class="metric-block-header">
                        <span class="metric-label">
                            <i class="fa-solid fa-business-time"></i> Project Timeline
                        </span>
                        <div class="metric-icon-wrapper">
                            <i class="fa-solid fa-stopwatch"></i>
                        </div>
                    </div>
                    <div class="metric-value-large">
                        ${metrics.daysElapsed} <span class="metric-unit">/ ${metrics.totalProjectDays} days</span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill accent-blue" style="width: ${metrics.timeElapsedPct}%"></div>
                    </div>
                    <div class="metric-subtext">
                        <span>Schedule Elapsed: <strong>${metrics.timeElapsedPct}%</strong></span>
                        <span>${metrics.daysRemaining} days left</span>
                    </div>
                </div>

                <!-- Metric 3: Trade Status Breakdown -->
                <div class="metric-block">
                    <div class="metric-block-header">
                        <span class="metric-label">
                            <i class="fa-solid fa-list-check"></i> Active Trades
                        </span>
                        <div class="metric-icon-wrapper">
                            <i class="fa-solid fa-users-gear"></i>
                        </div>
                    </div>
                    <div class="metric-value-large">
                        ${metrics.totalTrades} <span class="metric-unit">Trades Total</span>
                    </div>
                    <div class="trade-summary-mini">
                        <div class="trade-mini-badge ok">
                            <i class="fa-solid fa-check"></i> ${metrics.onTrackTradesCount} On Track
                        </div>
                        <div class="trade-mini-badge ${metrics.delayedTradesCount > 0 ? 'issue' : 'ok'}">
                            <i class="fa-solid fa-triangle-exclamation"></i> ${metrics.delayedTradesCount} Delayed
                        </div>
                    </div>
                    <div class="metric-subtext">
                        <span>Execution Status</span>
                        <span>${metrics.delayedTradesCount === 0 ? 'All Trades Normal' : metrics.delayedTradesCount + ' Trade(s) flagged'}</span>
                    </div>
                </div>

                <!-- Metric 4: On-Site Workforce -->
                <div class="metric-block">
                    <div class="metric-block-header">
                        <span class="metric-label">
                            <i class="fa-solid fa-user-group"></i> Active Workforce
                        </span>
                        <div class="metric-icon-wrapper">
                            <i class="fa-solid fa-hard-hat"></i>
                        </div>
                    </div>
                    <div class="metric-value-large">
                        ${metrics.totalWorkersPresent} <span class="metric-unit">/ ${metrics.totalWorkersRequired} On Site</span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill ${metrics.totalWorkersPresent >= metrics.totalWorkersRequired ? 'accent-green' : 'accent-orange'}" style="width: ${Math.min(100, Math.round((metrics.totalWorkersPresent / (metrics.totalWorkersRequired || 1)) * 100))}%"></div>
                    </div>
                    <div class="metric-subtext">
                        <span>Workforce Deficit: <strong>${metrics.totalWorkersRequired - metrics.totalWorkersPresent > 0 ? (metrics.totalWorkersRequired - metrics.totalWorkersPresent) + ' workers short' : 'Fully Staffed'}</strong></span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

/**
 * ==========================================================================
 * PHASE 4 ML: INTELLIGENT PROJECT INSIGHTS RENDERING
 * ==========================================================================
 */

/**
 * Render Phase 4 Applied ML Intelligent Project Insights Section
 */
function renderProjectMlInsights() {
    const container = document.getElementById('project-ml-insights-container');
    if (!container) return;

    const riskData = SitePulseState.currentMlRisk;
    const anomData = SitePulseState.currentMlAnomalies;

    // 1. Determine Model Status Label & Styling
    let statusPillClass = 'active';
    let statusPillText = 'Active ML Models (FastAPI)';
    let statusIcon = 'fa-bolt';

    if (!riskData || riskData.model_status === 'fallback_heuristic' || (anomData && anomData.model_status === 'fallback_heuristic')) {
        statusPillClass = 'fallback';
        statusPillText = 'In-Process Heuristic Fallback Engine';
        statusIcon = 'fa-shield-halved';
    } else if (riskData && riskData.model_status === 'insufficient_history') {
        statusPillClass = 'unavailable';
        statusPillText = 'Insufficient Project History (< 3 Days)';
        statusIcon = 'fa-clock-rotate-left';
    }

    // 2. Render Left Panel: Delay Risk Intelligence
    let riskPanelHtml = '';
    if (!riskData || riskData.model_status === 'insufficient_history') {
        riskPanelHtml = `
            <div class="ml-risk-panel">
                <div class="ml-panel-title">
                    <span><i class="fa-solid fa-gauge-high"></i> Multi-factor Delay Risk Model</span>
                    <span class="subnav-pill">Unavailable</span>
                </div>
                <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted);">
                    <i class="fa-solid fa-hourglass-start" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.75rem; display: block;"></i>
                    <h4 style="color: var(--text-primary); margin-bottom: 0.35rem;">Insufficient Historical Trajectory</h4>
                    <p style="font-size: 0.85rem;">${escapeHtml((riskData && riskData.message) || 'Minimum 3 days of trade progress updates required for velocity estimation and calibrated delay classification.')}</p>
                </div>
            </div>
        `;
    } else {
        const score = Number(riskData.delay_risk_score) || 0;
        const scorePct = Math.round(score * 100);
        const category = riskData.risk_category || 'Low';
        const isPredictedDelayed = riskData.predicted_delay_over_3d === 1;

        let categoryClass = 'low';
        let categoryColor = 'var(--accent-green)';
        let categoryBg = 'rgba(16, 185, 129, 0.15)';

        if (category === 'Critical' || category === 'High') {
            categoryClass = 'high';
            categoryColor = 'var(--accent-red)';
            categoryBg = 'rgba(239, 68, 68, 0.18)';
        } else if (category === 'Medium') {
            categoryClass = 'medium';
            categoryColor = 'var(--accent-orange)';
            categoryBg = 'rgba(245, 158, 11, 0.18)';
        }

        // Render Factors List
        const factors = riskData.top_contributing_factors || [];
        let factorsHtml = '';

        factors.forEach(f => {
            const contrib = Number(f.contribution_score) || 0;
            const isRiskIncrease = contrib > 0;
            const sign = contrib >= 0 ? '+' : '';

            factorsHtml += `
                <div class="factor-item-card">
                    <div class="factor-top-line">
                        <span class="factor-name-label">${escapeHtml(f.feature.replace(/_/g, ' '))}</span>
                        <span class="factor-score-pill ${isRiskIncrease ? 'risk-increase' : 'risk-decrease'}">
                            ${sign}${contrib.toFixed(2)} (${isRiskIncrease ? 'Increases Delay' : 'Reduces Delay'})
                        </span>
                    </div>
                    <p class="factor-explanation-text">${escapeHtml(f.explanation)}</p>
                </div>
            `;
        });

        riskPanelHtml = `
            <div class="ml-risk-panel">
                <div class="ml-panel-title">
                    <span><i class="fa-solid fa-gauge-high"></i> Multi-factor Delay Risk Model</span>
                    <span class="ml-threshold-note"><i class="fa-solid fa-scale-balanced"></i> Decision Threshold: <strong>0.5700</strong></span>
                </div>

                <div class="ml-risk-hero-score">
                    <div class="ml-score-digits">
                        <div class="ml-score-number ${categoryClass}">${scorePct}%</div>
                        <span class="ml-score-caption">Calibrated Delay Probability</span>
                    </div>
                    <div class="ml-risk-category-badge" style="background: ${categoryBg}; color: ${categoryColor}; border: 1px solid ${categoryColor};">
                        <i class="fa-solid ${isPredictedDelayed ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
                        <span>${category} Risk</span>
                    </div>
                </div>

                <div class="factors-section-wrapper">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>Top Contributing Model Factors</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Standardized Log-Odds</span>
                    </div>
                    <div class="factors-list">
                        ${factorsHtml.length > 0 ? factorsHtml : '<div style="font-size: 0.82rem; color: var(--text-muted);">No elevated risk factors detected.</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    // 3. Render Right Panel: Anomaly Detection Intelligence
    let anomPanelHtml = '';
    if (!anomData || anomData.model_status === 'insufficient_history') {
        anomPanelHtml = `
            <div class="ml-anomaly-panel">
                <div class="ml-panel-title">
                    <span><i class="fa-solid fa-wave-square"></i> Trade Execution Anomaly Detection</span>
                    <span class="subnav-pill">Unavailable</span>
                </div>
                <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted);">
                    <i class="fa-solid fa-circle-nodes" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.75rem; display: block;"></i>
                    <h4 style="color: var(--text-primary); margin-bottom: 0.35rem;">No Trade Activity to Analyze</h4>
                    <p style="font-size: 0.85rem;">${escapeHtml((anomData && anomData.message) || 'No daily manpower or progress records available for anomaly evaluation.')}</p>
                </div>
            </div>
        `;
    } else {
        const anomalies = anomData.anomalies || [];
        const detectedCount = anomData.anomalies_detected_count || anomalies.length;

        let feedHtml = '';
        if (detectedCount === 0) {
            feedHtml = `
                <div class="anomaly-empty-state">
                    <i class="fa-solid fa-circle-check"></i>
                    <h4 style="font-family: var(--font-heading); font-size: 1.05rem;">Zero Anomalies Detected</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary);">All ${anomData.total_analyzed || 5} active trades are progressing within normal physical capacity limits and standard attendance expectations.</p>
                </div>
            `;
        } else {
            anomalies.forEach(a => {
                let sevColor = 'var(--accent-red)';
                let sevClass = 'critical';
                if (a.severity === 'High') {
                    sevColor = 'var(--accent-orange)';
                    sevClass = 'high';
                } else if (a.severity === 'Medium') {
                    sevColor = 'var(--accent-blue)';
                    sevClass = 'medium';
                }

                const sf = a.supporting_features || {};

                feedHtml += `
                    <div class="anomaly-alert-card" style="--severity-color: ${sevColor};">
                        <div class="anomaly-top-row">
                            <span class="anomaly-trade-name">${escapeHtml(a.trade_name)}</span>
                            <div class="anomaly-tags-wrap">
                                <span class="anomaly-category-tag">${escapeHtml(a.category.replace(/_/g, ' '))}</span>
                                <span class="anomaly-severity-pill ${sevClass}">${escapeHtml(a.severity)}</span>
                            </div>
                        </div>
                        <p class="anomaly-explanation">${escapeHtml(a.explanation)}</p>
                        <div class="anomaly-support-pills">
                            <span class="support-pill">Score: <strong>${Number(a.anomaly_score).toFixed(2)}</strong></span>
                            <span class="support-pill">Daily Delta: <strong>${sf.daily_delta_pct !== undefined ? sf.daily_delta_pct + '%' : 'N/A'}</strong></span>
                            <span class="support-pill">Workers: <strong>${sf.workers_present ?? '--'} / ${sf.workers_required ?? '--'}</strong></span>
                            ${sf.consecutive_stagnant ? `<span class="support-pill">Stagnant: <strong>${sf.consecutive_stagnant}d</strong></span>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        anomPanelHtml = `
            <div class="ml-anomaly-panel">
                <div class="ml-panel-title">
                    <span><i class="fa-solid fa-wave-square"></i> Trade Execution Anomaly Detection</span>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">
                        Trades Analyzed: <strong>${anomData.total_analyzed || 5}</strong> | Flagged: <strong style="color: ${detectedCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">${detectedCount}</strong>
                    </span>
                </div>
                <div class="anomalies-feed-list">
                    ${feedHtml}
                </div>
            </div>
        `;
    }

    // 4. Render Container Component
    container.innerHTML = `
        <article class="ml-insights-card">
            <!-- ML Card Header -->
            <div class="ml-card-header">
                <div class="ml-header-branding">
                    <div class="ml-icon-badge">
                        <i class="fa-solid fa-brain"></i>
                    </div>
                    <div class="ml-header-titles">
                        <h3>Phase 4 Applied Machine Learning Intelligence</h3>
                        <p>Gradient Delay Classification & Isolation Forest Anomaly Detection (Decision Cutoff: Day 25)</p>
                    </div>
                </div>

                <div class="ml-status-badges-group">
                    <span class="ml-model-pill ${statusPillClass}">
                        <i class="fa-solid ${statusIcon}"></i>
                        <span>${statusPillText}</span>
                    </span>
                </div>
            </div>

            <!-- Disclaimer Notice -->
            <div class="ml-disclaimer-banner">
                <i class="fa-solid fa-flask"></i>
                <span><strong>Research Prototype Disclaimer:</strong> ${(riskData && riskData.disclaimer) || 'Trained on synthetic simulation data for research & prototyping. Not validated for production life-safety or contractual execution.'}</span>
            </div>

            <!-- ML Insights Grid -->
            <div class="ml-card-body">
                ${riskPanelHtml}
                ${anomPanelHtml}
            </div>
        </article>
    `;
}

/**
 * Trade Category Icons Map
 */
const TradeIconsMap = {
    'Civil': 'fa-solid fa-person-digging',
    'Electrical': 'fa-solid fa-bolt',
    'Lighting': 'fa-solid fa-lightbulb',
    'Carpentry': 'fa-solid fa-hammer',
    'Painting': 'fa-solid fa-paint-roller'
};

/**
 * Render Trades Breakdown Table for Selected Project directly from API Response
 */
function renderTradesTable() {
    const container = document.getElementById('trades-breakdown-container');
    if (!container) return;

    const db = SitePulseState.currentDashboard;
    if (!db || !db.trades) return;

    const bottleneck = db.bottleneck;

    let bannerHtml = '';
    if (bottleneck) {
        bannerHtml = `
            <div class="bottleneck-banner alert">
                <div class="banner-content">
                    <span class="banner-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
                    <div>
                        <strong>⚠️ Bottleneck:</strong> <span class="banner-text-highlight">${escapeHtml(bottleneck.tradeName)}</span> is <strong>${bottleneck.gapPercentage}%</strong> behind schedule due to <strong>${escapeHtml(bottleneck.reason)}</strong>.
                    </div>
                </div>
                <span class="banner-action-tag">Action Required</span>
            </div>
        `;
    } else {
        bannerHtml = `
            <div class="bottleneck-banner success">
                <div class="banner-content">
                    <span class="banner-icon"><i class="fa-solid fa-circle-check"></i></span>
                    <div>
                        <strong>✅ All trades are on track.</strong> All active trade execution targets are currently being met.
                    </div>
                </div>
                <span class="banner-action-tag">Normal Operation</span>
            </div>
        `;
    }

    let rowsHtml = '';

    db.trades.forEach(trade => {
        const actualPct = trade.progress_pct ?? trade.actual ?? 0;
        const plannedPct = trade.planned_pct ?? trade.planned ?? 0;
        const gap = plannedPct - actualPct;

        let statusLabel = 'On Track';
        let statusClass = 'on-track';
        let statusIcon = 'fa-circle-check';
        let barColorClass = 'accent-green';

        if (actualPct < plannedPct) {
            if (gap <= 10) {
                statusLabel = 'Slightly Behind';
                statusClass = 'slightly-behind';
                statusIcon = 'fa-circle-exclamation';
                barColorClass = 'accent-orange';
            } else {
                statusLabel = 'Behind';
                statusClass = 'behind';
                statusIcon = 'fa-triangle-exclamation';
                barColorClass = 'accent-red';
            }
        }

        const iconClass = TradeIconsMap[trade.name] || 'fa-solid fa-screwdriver-wrench';
        const reason = trade.reason || 'On Track';
        const showReasonTag = (statusLabel !== 'On Track') && reason && reason !== 'On Track';

        const workersPresent = trade.workers_present ?? trade.workersPresent ?? 0;
        const workersRequired = trade.workers_required ?? trade.workersRequired ?? 0;
        const isWorkerShortage = workersPresent < workersRequired;

        let manpowerDisplay = '';
        if (workersRequired > 0) {
            const manpowerPct = Math.round((workersPresent / workersRequired) * 100);
            manpowerDisplay = `<strong>${workersPresent}</strong> / ${workersRequired} <span class="headcount-subtext">(${manpowerPct}%)</span>`;
        } else {
            manpowerDisplay = `<strong>${workersPresent}</strong> / 0 <span class="headcount-subtext">(N/A)</span>`;
        }

        const contractorName = trade.contractor_name || 'Apex Retail Crew';

        rowsHtml += `
            <tr>
                <td>
                    <div class="trade-identity">
                        <div class="trade-icon-avatar">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="trade-title-text">
                            <span class="trade-name">${escapeHtml(trade.name)}</span>
                            <span class="trade-category"><i class="fa-solid fa-hard-hat" style="font-size: 0.75rem; color: var(--accent-blue);"></i> ${escapeHtml(contractorName)}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="progress-comparison-container">
                        <div class="progress-stats-labels">
                            <span class="actual-pct-label">Actual: <strong>${actualPct}%</strong></span>
                            <span class="planned-pct-label">Plan: <strong>${plannedPct}%</strong></span>
                        </div>
                        <div class="dual-progress-track" title="Actual: ${actualPct}% | Plan Target: ${plannedPct}%">
                            <div class="dual-progress-actual ${barColorClass}" style="width: ${actualPct}%;"></div>
                            <div class="target-marker-line" style="left: ${plannedPct}%;" title="Planned Target: ${plannedPct}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="headcount-badge ${isWorkerShortage ? 'shortage' : ''}" title="${workersPresent} present out of ${workersRequired} required workers">
                        <i class="fa-solid fa-users"></i>
                        <span>${manpowerDisplay}</span>
                    </div>
                </td>
                <td>
                    <div class="status-cell-wrapper">
                        <span class="trade-status-pill ${statusClass}">
                            <i class="fa-solid ${statusIcon}"></i>
                            <span>${statusLabel}</span>
                        </span>
                        ${showReasonTag ? `
                            <span class="reason-tag ${statusLabel === 'Slightly Behind' ? 'warning' : ''}">
                                <i class="fa-solid fa-tag"></i> ${escapeHtml(reason)}
                            </span>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        ${bannerHtml}
        <article class="trades-card">
            <div class="trades-card-header">
                <div class="trades-card-title">
                    <i class="fa-solid fa-list-check"></i>
                    <h3>Trade Breakdown & Execution Status</h3>
                </div>
                <div class="trades-legend">
                    <div class="legend-item">
                        <span class="legend-color-actual"></span>
                        <span>Actual Completed %</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-marker-target"></span>
                        <span>Planned Target Marker</span>
                    </div>
                </div>
            </div>

            <div class="table-responsive-wrapper">
                <table class="trades-table">
                    <thead>
                        <tr>
                            <th>Trade Package & Contractor</th>
                            <th>Progress (Actual vs Target)</th>
                            <th>On-Site Workforce</th>
                            <th>Execution Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </article>
    `;
}

/**
 * Render Bottleneck Schedule Forecast & Recommendation Section directly from API Response
 */
function renderBottleneckAnalysis() {
    const container = document.getElementById('bottleneck-analysis-container');
    if (!container) return;

    const db = SitePulseState.currentDashboard;
    if (!db || !db.forecast || !db.recommendation) return;

    const projection = db.forecast;
    const rec = db.recommendation;
    const bottleneck = db.bottleneck;

    if (!projection || !projection.hasBottleneck || !rec || !rec.hasBottleneck) {
        container.innerHTML = `
            <article class="bottleneck-analysis-card success">
                <div class="analysis-card-header">
                    <div class="analysis-card-title">
                        <i class="fa-solid fa-square-poll-vertical"></i>
                        <h3>Bottleneck Projection & Resource Recommendation</h3>
                    </div>
                </div>
                <div class="analysis-card-body">
                    <div class="analysis-box">
                        <div class="analysis-box-header">
                            <span>Linear Completion Pace</span>
                            <i class="fa-solid fa-gauge-high"></i>
                        </div>
                        <p class="analysis-statement">
                            <strong>Projected completion: On track</strong> (${projection ? projection.formattedDeadline : ''}). All trades are operating on or ahead of target schedule.
                        </p>
                    </div>

                    <div class="analysis-box">
                        <div class="analysis-box-header">
                            <span>Resource Action Plan</span>
                            <i class="fa-solid fa-user-check"></i>
                        </div>
                        <div class="recommendation-badge-box ok">
                            <div class="rec-icon-wrapper">
                                <i class="fa-solid fa-circle-check"></i>
                            </div>
                            <div class="rec-details">
                                <span class="rec-title">Optimal Resource Allocation</span>
                                <span class="rec-description">No action required — all trades are on track.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
        return;
    }

    let paceStatement = '';
    if (projection.isUnavailable) {
        paceStatement = `Projection unavailable — insufficient progress history for <strong>${escapeHtml(projection.bottleneckName)}</strong>.`;
    } else if (projection.delayDays > 0) {
        paceStatement = `At current pace, <strong>${escapeHtml(projection.bottleneckName)}</strong> will finish on <strong>${escapeHtml(projection.formattedProjectedDate)}</strong> (Deadline: ${escapeHtml(projection.formattedDeadline)}), which is <span class="overdue-highlight">${escapeHtml(projection.statusText)}</span>.`;
    } else {
        paceStatement = `At current pace, <strong>${escapeHtml(projection.bottleneckName)}</strong> will finish on <strong>${escapeHtml(projection.formattedProjectedDate)}</strong> (Deadline: ${escapeHtml(projection.formattedDeadline)}), which is <strong>${escapeHtml(projection.statusText)}</strong>.`;
    }

    let recommendationHtml = '';
    if (rec.isManpower) {
        recommendationHtml = `
            <div class="recommendation-badge-box manpower">
                <div class="rec-icon-wrapper">
                    <i class="fa-solid fa-user-plus"></i>
                </div>
                <div class="rec-details">
                    <span class="rec-title">${escapeHtml(rec.actionText)}</span>
                    <span class="rec-description">${escapeHtml(rec.manpowerText)}</span>
                    ${rec.supportingText ? `<span class="rec-supporting" style="display:block; font-size:0.8rem; color:var(--text-muted); margin-top:0.35rem;">${escapeHtml(rec.supportingText)}</span>` : ''}
                </div>
            </div>
        `;
    } else {
        let iconClass = 'fa-lightbulb';
        const lowerReason = rec.reason ? rec.reason.toLowerCase() : '';
        if (lowerReason.includes('material')) iconClass = 'fa-truck-fast';
        else if (lowerReason.includes('rework') || lowerReason.includes('quality')) iconClass = 'fa-wrench';
        else if (lowerReason.includes('weather') || lowerReason.includes('access')) iconClass = 'fa-road-barrier';

        recommendationHtml = `
            <div class="recommendation-badge-box material">
                <div class="rec-icon-wrapper">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="rec-details">
                    <span class="rec-title">${escapeHtml(rec.actionText)}</span>
                    ${rec.supportingText ? `<span class="rec-description">${escapeHtml(rec.supportingText)}</span>` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <article class="bottleneck-analysis-card alert">
            <div class="analysis-card-header">
                <div class="analysis-card-title">
                    <i class="fa-solid fa-chart-line"></i>
                    <h3>Bottleneck Projection & Resource Recommendation (${bottleneck ? escapeHtml(bottleneck.tradeName) : ''})</h3>
                </div>
            </div>
            <div class="analysis-card-body">
                <div class="analysis-box">
                    <div class="analysis-box-header">
                        <span>Pace & Finish Forecast</span>
                        <i class="fa-solid fa-stopwatch-20"></i>
                    </div>
                    <p class="analysis-statement">
                        ${paceStatement}
                    </p>
                </div>

                <div class="analysis-box">
                    <div class="analysis-box-header">
                        <span>Smart Action Recommendation</span>
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    ${recommendationHtml}
                </div>
            </div>
        </article>
    `;
}

/**
 * Render Active Blockers & Delay Events Log Section from Database
 */
function renderProjectDelayEvents() {
    const container = document.getElementById('project-delay-events-container');
    if (!container) return;

    const db = SitePulseState.currentDashboard;
    const events = (db && db.delayEvents) ? db.delayEvents : [];

    if (events.length === 0) {
        container.innerHTML = `
            <article class="delay-events-card">
                <div class="delay-events-header">
                    <div class="delay-events-title">
                        <i class="fa-solid fa-shield-check" style="color: var(--accent-green);"></i>
                        <h3>Active Blockers & Delay Events Log</h3>
                    </div>
                    <span class="subnav-pill" style="background: rgba(16,185,129,0.15); color: var(--accent-green); border-color: rgba(16,185,129,0.3);">
                        0 Active Blockers
                    </span>
                </div>
                <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                    <i class="fa-solid fa-circle-check" style="font-size: 2rem; color: var(--accent-green); margin-bottom: 0.5rem; display: block;"></i>
                    <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">No Site Roadblocks Logged</h4>
                    <p style="font-size: 0.85rem;">All trades on this project are progressing with zero recorded hold events or severe labor shortages.</p>
                </div>
            </article>
        `;
        return;
    }

    let rowsHtml = '';
    events.forEach(ev => {
        const sevClass = (ev.severity || '').toLowerCase() === 'high' ? 'accent-red' : 'accent-orange';
        rowsHtml += `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <span style="font-weight: 700; color: var(--text-primary);">${escapeHtml(ev.category)}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(ev.identified_date)}</span>
                    </div>
                </td>
                <td>
                    <span class="trade-status-pill ${sevClass === 'accent-red' ? 'behind' : 'slightly-behind'}">
                        ${escapeHtml(ev.severity)}
                    </span>
                </td>
                <td>
                    <strong style="color: var(--accent-red);">${ev.estimated_delay_days || '--'} days</strong>
                </td>
                <td>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); max-width: 320px;">
                        ${escapeHtml(ev.root_cause || 'Under investigation')}
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.82rem; color: var(--text-primary); max-width: 320px;">
                        ${escapeHtml(ev.mitigation_action || 'Action plan in development')}
                    </div>
                </td>
                <td>
                    <span class="subnav-pill" style="text-transform: uppercase; font-size: 0.72rem;">
                        ${escapeHtml(ev.status)}
                    </span>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        <article class="delay-events-card">
            <div class="delay-events-header">
                <div class="delay-events-title">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h3>Active Blockers & Delay Events Log</h3>
                </div>
                <span class="subnav-pill" style="background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border-color: rgba(239, 68, 68, 0.3);">
                    ${events.length} Open Roadblock(s)
                </span>
            </div>

            <div class="table-responsive-wrapper">
                <table class="trades-table">
                    <thead>
                        <tr>
                            <th>Category & Date</th>
                            <th>Severity</th>
                            <th>Est. Impact</th>
                            <th>Root Cause</th>
                            <th>Mitigation Strategy</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </article>
    `;
}

/**
 * ==========================================================================
 * VIEW 3: TRADE & CONTRACTOR ANALYTICS RENDERING
 * ==========================================================================
 */

/**
 * Render Trade Performance Matrix Across All Store Projects
 */
function renderTradeMatrixView() {
    const container = document.getElementById('trades-performance-matrix');
    if (!container) return;

    const portfolio = SitePulseState.portfolio || [];
    const tradeNames = ['Civil', 'Electrical', 'Lighting', 'Carpentry', 'Painting'];

    let rowsHtml = '';
    tradeNames.forEach(tName => {
        const iconClass = TradeIconsMap[tName] || 'fa-solid fa-screwdriver-wrench';

        // Compute simulated matrix rollups
        let avgActual = 0;
        let avgPlanned = 0;
        let delayedInSitesCount = 0;

        portfolio.forEach(p => {
            if (tName === 'Civil') {
                avgActual += p.overallActual >= 50 ? 85 : 42;
                avgPlanned += 85;
                if (p.bottleneckName === 'Civil') delayedInSitesCount++;
            } else if (tName === 'Electrical') {
                avgActual += p.overallActual >= 50 ? 70 : 45;
                avgPlanned += 75;
                if (p.bottleneckName === 'Electrical') delayedInSitesCount++;
            } else if (tName === 'Lighting') {
                avgActual += 45;
                avgPlanned += 50;
            } else if (tName === 'Carpentry') {
                avgActual += 55;
                avgPlanned += 55;
            } else if (tName === 'Painting') {
                avgActual += 18;
                avgPlanned += 20;
            }
        });

        const pCount = portfolio.length || 1;
        avgActual = Math.round(avgActual / pCount);
        avgPlanned = Math.round(avgPlanned / pCount);
        const gap = avgPlanned - avgActual;

        rowsHtml += `
            <tr>
                <td>
                    <div class="trade-identity">
                        <div class="trade-icon-avatar"><i class="${iconClass}"></i></div>
                        <div class="trade-title-text">
                            <span class="trade-name">${tName}</span>
                            <span class="trade-category">Execution Package</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="progress-comparison-container">
                        <div class="progress-stats-labels">
                            <span class="actual-pct-label">Avg: <strong>${avgActual}%</strong></span>
                            <span class="planned-pct-label">Plan: <strong>${avgPlanned}%</strong></span>
                        </div>
                        <div class="dual-progress-track">
                            <div class="dual-progress-actual ${gap > 5 ? 'accent-red' : 'accent-green'}" style="width: ${avgActual}%;"></div>
                            <div class="target-marker-line" style="left: ${avgPlanned}%;"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="font-weight: 700; color: ${gap > 5 ? 'var(--accent-red)' : (gap > 0 ? 'var(--accent-amber)' : 'var(--accent-green)')}">
                        ${gap > 0 ? `-${gap}% behind` : (gap < 0 ? `+${Math.abs(gap)}% ahead` : 'On Plan')}
                    </span>
                </td>
                <td>
                    <span class="subnav-pill" style="background: ${delayedInSitesCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(82,164,136,0.15)'}; color: ${delayedInSitesCount > 0 ? 'var(--accent-red)' : 'var(--accent-sage)'};">
                        ${delayedInSitesCount} / ${portfolio.length} Stores
                    </span>
                </td>
                <td>
                    <span class="trade-status-pill ${gap > 5 ? 'behind' : (gap > 0 ? 'attention' : 'on-track')}">
                        <i class="fa-solid ${gap > 5 ? 'fa-triangle-exclamation' : (gap > 0 ? 'fa-circle-exclamation' : 'fa-circle-check')}"></i>
                        <span>${gap > 5 ? 'Bottleneck' : (gap > 0 ? 'Lagging' : 'Healthy')}</span>
                    </span>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        <article class="analytics-panel-card">
            <div class="delay-events-header">
                <div class="delay-events-title">
                    <i class="fa-solid fa-layer-group" style="color: var(--accent-blue);"></i>
                    <h3>Portfolio Cross-Trade Execution Matrix</h3>
                </div>
                <span class="subnav-pill">All Active Retail Sites</span>
            </div>

            <div class="table-responsive-wrapper">
                <table class="trades-table">
                    <thead>
                        <tr>
                            <th>Trade Package</th>
                            <th>Average Progress vs Plan</th>
                            <th>Variance Gap</th>
                            <th>Active Site Bottlenecks</th>
                            <th>Health Classification</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </article>
    `;
}

/**
 * Render Manpower Utilization & Shortfall Analytics
 */
function renderManpowerAnalytics() {
    const container = document.getElementById('manpower-analytics-container');
    if (!container) return;

    const portfolio = SitePulseState.portfolio || [];
    const totalPresent = portfolio.reduce((acc, p) => acc + (Number(p.totalWorkersPresent) || 0), 0);
    const totalRequired = portfolio.reduce((acc, p) => acc + (Number(p.totalWorkersRequired) || 0), 0);
    const deficit = Math.max(0, totalRequired - totalPresent);
    const fulfillmentPct = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 100;

    container.innerHTML = `
        <article class="analytics-panel-card" style="padding: 1.5rem;">
            <div class="section-title-wrap" style="margin-bottom: 1.25rem;">
                <i class="fa-solid fa-users-gear" style="color: var(--accent-orange);"></i>
                <h3>Portfolio Manpower Shortfall & Density Analysis</h3>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total On-Site Crew</div>
                    <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-heading); color: var(--text-primary); margin: 0.35rem 0;">
                        ${totalPresent} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">Workers</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--accent-green);"><i class="fa-solid fa-check"></i> Actively logged on site</div>
                </div>

                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Required Headcount</div>
                    <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-heading); color: var(--text-primary); margin: 0.35rem 0;">
                        ${totalRequired} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">Target</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Scheduled daily staffing requirement</div>
                </div>

                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Headcount Deficit</div>
                    <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-heading); color: ${deficit > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}; margin: 0.35rem 0;">
                        ${deficit} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">Deficit</span>
                    </div>
                    <div style="font-size: 0.8rem; color: ${deficit > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">
                        ${deficit > 0 ? '⚠️ Shortfall concentrated in lagging trades' : '✅ Zero manpower deficit'}
                    </div>
                </div>

                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Fulfillment Rate</div>
                    <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-heading); color: ${fulfillmentPct >= 85 ? 'var(--accent-green)' : 'var(--accent-orange)'}; margin: 0.35rem 0;">
                        ${fulfillmentPct}%
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Overall portfolio manpower availability</div>
                </div>
            </div>
        </article>
    `;
}

/**
 * Render Contractor Performance & Directory Cards
 */
function renderContractorsDirectory() {
    const container = document.getElementById('contractors-directory-container');
    if (!container) return;

    const contractors = SitePulseState.contractors.length > 0 ? SitePulseState.contractors : [
        { id: 'cnt-apex-civil', name: 'Apex Civil Works LLP', trade_specialty: 'Civil', contact_person: 'Ramesh Sharma', contact_email: 'ramesh@apexcivil.com', rating: 4.5, active_projects_count: 3, active_delays_count: 1 },
        { id: 'cnt-volt-electrical', name: 'VoltCraft Electricals Ltd', trade_specialty: 'Electrical', contact_person: 'Anil Gupta', contact_email: 'anil@voltcraft.in', rating: 3.8, active_projects_count: 3, active_delays_count: 1 },
        { id: 'cnt-lumina-lighting', name: 'Lumina Retail Lighting Ltd', trade_specialty: 'Lighting', contact_person: 'Pooja Verma', contact_email: 'pooja@luminalight.com', rating: 4.2, active_projects_count: 3, active_delays_count: 0 },
        { id: 'cnt-artisan-wood', name: 'Artisan Wood & Fitouts', trade_specialty: 'Carpentry', contact_person: 'Gurpreet Singh', contact_email: 'gurpreet@artisanwood.com', rating: 4.7, active_projects_count: 3, active_delays_count: 0 },
        { id: 'cnt-prism-coatings', name: 'Prism Coatings & Finishes', trade_specialty: 'Painting', contact_person: 'Vikram Mehta', contact_email: 'vikram@prismfinishes.com', rating: 4.0, active_projects_count: 3, active_delays_count: 0 }
    ];

    let cardsHtml = '';
    contractors.forEach(c => {
        const rating = Number(c.rating) || 4.0;
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5;

        let starsHtml = '';
        for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fa-solid fa-star"></i>';
        if (hasHalf) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';

        cardsHtml += `
            <div class="contractor-card-item">
                <div class="contractor-card-header">
                    <div>
                        <h4 class="contractor-name-text">${escapeHtml(c.name)}</h4>
                        <div class="contractor-stars" title="Rating: ${rating} / 5.0">
                            ${starsHtml}
                            <span style="color: var(--text-primary); font-weight: 700; margin-left: 0.35rem;">${rating.toFixed(1)}</span>
                        </div>
                    </div>
                    <span class="contractor-trade-badge">${escapeHtml(c.trade_specialty)}</span>
                </div>

                <div class="contractor-contact-info">
                    <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(c.contact_person)}</span>
                    <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(c.contact_email)}</span>
                </div>

                <div class="contractor-stats-row">
                    <span>Active Sites: <strong>${c.active_projects_count ?? 1} ${(c.active_projects_count === 1) ? 'Store' : 'Stores'}</strong></span>
                    <span style="color: ${(c.active_delays_count || 0) > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">
                        <i class="fa-solid ${(c.active_delays_count || 0) > 0 ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
                        ${(c.active_delays_count || 0) > 0 ? `${c.active_delays_count} ${(c.active_delays_count === 1) ? 'Open Issue' : 'Open Issues'}` : 'Zero Issues'}
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <article class="analytics-panel-card">
            <div class="delay-events-header">
                <div class="delay-events-title">
                    <i class="fa-solid fa-handshake" style="color: var(--accent-orange);"></i>
                    <h3>Verified Trade Contractors & Partners</h3>
                </div>
                <span class="subnav-pill">${contractors.length} Trade Specialists</span>
            </div>

            <div class="contractors-grid">
                ${cardsHtml}
            </div>
        </article>
    `;
}

/**
 * ==========================================================================
 * LEGACY PORTFOLIO VIEW COMPATIBILITY
 * ==========================================================================
 */

/**
 * Render Always-Visible Global Portfolio View directly from API Portfolio Data
 */
function renderPortfolioView() {
    const container = document.getElementById('portfolio-view-container');
    if (!container) return;

    const portfolioData = SitePulseState.portfolio || [];

    let itemsHtml = '';

    portfolioData.forEach((item, index) => {
        const isSelected = item.id === SitePulseState.activeProjectId;
        const delayBadgeClass = item.delayDays > 0 ? 'behind' : 'ontrack';

        itemsHtml += `
            <div class="portfolio-item rank-${index + 1} ${isSelected ? 'active-selected' : ''}" data-project-id="${item.id}">
                <div class="portfolio-item-meta">
                    <div class="portfolio-rank-badge">#${index + 1}</div>
                    <div class="portfolio-item-info">
                        <span class="portfolio-project-name">
                            ${escapeHtml(item.name)}
                            <span class="city-badge"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.city || item.location)}</span>
                        </span>
                        <div class="portfolio-subdetails">
                            <span class="portfolio-bottleneck-text">
                                <i class="fa-solid fa-triangle-exclamation" style="color: ${item.delayDays > 0 ? 'var(--accent-red)' : (item.bottleneckName !== 'None' ? 'var(--accent-orange)' : 'var(--accent-green)')}"></i>
                                Bottleneck: <strong>${escapeHtml(item.bottleneckName)}</strong> ${item.bottleneckName !== 'None' ? `(${escapeHtml(item.bottleneckReason)})` : ''}
                            </span>
                            <span class="portfolio-date-text">
                                Finish: <strong>${escapeHtml(item.projectedDateStr)}</strong> | Deadline: <strong>${escapeHtml(item.deadlineStr)}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="portfolio-item-stats">
                    <span class="delay-pill ${delayBadgeClass}">
                        <i class="fa-solid ${item.delayDays > 0 ? 'fa-clock' : 'fa-circle-check'}"></i>
                        ${escapeHtml(item.statusText)}
                    </span>

                    ${item.needsUrgentManpower ? `
                        <span class="urgent-manpower-badge">
                            <i class="fa-solid fa-triangle-exclamation"></i> Needs Urgent Manpower
                        </span>
                    ` : ''}

                    <span class="select-project-hint">
                        <span>Inspect</span> <i class="fa-solid fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <article class="portfolio-card">
            <div class="portfolio-card-header">
                <div class="portfolio-card-title">
                    <i class="fa-solid fa-briefcase"></i>
                    <h3>Portfolio Priority Ranking — Delay Severity (Worst First)</h3>
                </div>
                <span class="portfolio-subtitle-tag">Deterministic Risk Sort</span>
            </div>

            <div class="portfolio-grid">
                ${itemsHtml}
            </div>
        </article>
    `;

    // Attach click handlers to portfolio items
    container.querySelectorAll('.portfolio-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
            const pid = itemEl.getAttribute('data-project-id');
            if (pid) selectProject(pid, true);
        });
    });
}

function renderDashboardLoadingState() {
    const overviewContainer = document.getElementById('project-overview-container');
    if (overviewContainer) {
        overviewContainer.innerHTML = `
            <div class="overview-card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.8rem; color: var(--accent-orange);"></i>
                <p style="margin-top: 0.75rem; font-weight: 600;">Loading project analytics & ML inference from Site Pulse server...</p>
            </div>
        `;
    }
}

function showDashboardError(msg) {
    const overviewContainer = document.getElementById('project-overview-container');
    if (overviewContainer) {
        overviewContainer.innerHTML = `
            <div class="overview-card" style="padding: 2rem; border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.08);">
                <div style="display: flex; align-items: center; gap: 0.85rem; color: var(--accent-red);">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem;"></i>
                    <strong>${escapeHtml(msg)}</strong>
                </div>
            </div>
        `;
    }
}

function showGlobalError(msg) {
    console.error('Global Error:', msg);
    showToast(msg, 'error');
}

/**
 * ==========================================================================
 * DAILY UPDATE WORKFLOW HANDLERS
 * ==========================================================================
 */

function openDailyUpdateModal() {
    const modal = document.getElementById('daily-update-modal');
    if (!modal) return;

    const db = SitePulseState.currentDashboard;
    if (!db || !db.project) {
        showGlobalError('No project active or project data not loaded.');
        return;
    }

    const modalTitle = document.getElementById('update-modal-project-title');
    if (modalTitle) {
        modalTitle.textContent = `Post Daily Site Update — ${db.project.name}`;
    }

    // Set default log date to state referenceDate or browser date
    const dateInput = document.getElementById('update-date-input');
    if (dateInput) {
        dateInput.value = SitePulseState.referenceDate || new Date().toISOString().split('T')[0];
    }

    const alertEl = document.getElementById('update-status-alert');
    if (alertEl) {
        alertEl.style.display = 'none';
        alertEl.className = 'update-status-alert';
        alertEl.textContent = '';
    }

    renderUpdateTradeCards();
    modal.style.display = 'flex';
}

function closeDailyUpdateModal() {
    const modal = document.getElementById('daily-update-modal');
    if (modal) modal.style.display = 'none';
}

function renderUpdateTradeCards() {
    const container = document.getElementById('update-trades-list');
    if (!container) return;

    const db = SitePulseState.currentDashboard;
    if (!db || !db.trades || db.trades.length === 0) {
        container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No trades available for this project.</div>`;
        return;
    }

    let cardsHtml = '';

    db.trades.forEach(trade => {
        const actualPct = trade.progress_pct ?? trade.actual ?? 0;
        const plannedPct = trade.planned_pct ?? trade.planned ?? 0;
        const workersPresent = trade.workers_present ?? trade.workersPresent ?? 0;
        const workersRequired = trade.workers_required ?? trade.workersRequired ?? 0;
        const reason = trade.reason || 'On Track';
        const notes = trade.notes || '';
        const iconClass = TradeIconsMap[trade.name] || 'fa-solid fa-screwdriver-wrench';

        const reasons = [
            'On Track',
            'Material Delay',
            'Labour Shortage',
            'Waiting on Another Trade',
            'Rework / Quality Issue',
            'Site Access / Weather'
        ];

        let reasonOptionsHtml = '';
        reasons.forEach(r => {
            const selected = r === reason ? 'selected' : '';
            reasonOptionsHtml += `<option value="${r}" ${selected}>${r}</option>`;
        });

        cardsHtml += `
            <div class="update-trade-card" data-trade-id="${trade.id}" data-trade-name="${trade.name}">
                <div class="update-trade-header">
                    <div class="trade-identity">
                        <div class="trade-icon-avatar">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="trade-title-text">
                            <span class="trade-name">${escapeHtml(trade.name)}</span>
                            <span class="trade-category">Execution Target: <strong>${plannedPct}%</strong></span>
                        </div>
                    </div>
                    <div class="update-trade-current-badge">
                        <span>Current Progress: <strong>${actualPct}%</strong></span>
                    </div>
                </div>

                <div class="update-input-grid">
                    <div class="update-form-group">
                        <label for="progress-${trade.id}"><i class="fa-solid fa-percent"></i> Progress %</label>
                        <input type="number" id="progress-${trade.id}" class="form-input update-progress-input" min="0" max="100" step="1" value="${actualPct}" placeholder="0-100">
                    </div>

                    <div class="update-form-group">
                        <label for="present-${trade.id}"><i class="fa-solid fa-user-check"></i> Workers Present</label>
                        <input type="number" id="present-${trade.id}" class="form-input update-present-input" min="0" step="1" value="${workersPresent}" placeholder="Present">
                    </div>

                    <div class="update-form-group">
                        <label for="required-${trade.id}"><i class="fa-solid fa-users"></i> Workers Required</label>
                        <input type="number" id="required-${trade.id}" class="form-input update-required-input" min="0" step="1" value="${workersRequired}" placeholder="Required">
                    </div>

                    <div class="update-form-group">
                        <label for="reason-${trade.id}"><i class="fa-solid fa-tag"></i> Reason / Delay Status</label>
                        <select id="reason-${trade.id}" class="form-input update-reason-select">
                            ${reasonOptionsHtml}
                        </select>
                    </div>

                    <div class="update-form-group full-width">
                        <label for="notes-${trade.id}"><i class="fa-regular fa-comment-dots"></i> Site Notes / Remarks (Optional)</label>
                        <input type="text" id="notes-${trade.id}" class="form-input update-notes-input" value="${escapeHtml(notes)}" placeholder="Add observations or notes for site team...">
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
}

async function handleDailyUpdateSubmit() {
    const projectId = SitePulseState.activeProjectId;
    const alertEl = document.getElementById('update-status-alert');
    const submitBtn = document.getElementById('submit-all-updates-btn');

    if (!projectId) return;

    // 1. Validate Log Date
    const dateInput = document.getElementById('update-date-input');
    const dateStr = dateInput ? dateInput.value.trim() : '';

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        showUpdateAlert('Please specify a valid update date in YYYY-MM-DD format.', 'error');
        return;
    }

    // 2. Validate Trade Inputs
    const tradeCards = document.querySelectorAll('.update-trade-card');
    if (tradeCards.length === 0) {
        showUpdateAlert('No trade rows found to update.', 'error');
        return;
    }

    const updatesToSubmit = [];
    let validationError = null;

    tradeCards.forEach(card => {
        if (validationError) return;

        const tradeId = card.getAttribute('data-trade-id');
        const tradeName = card.getAttribute('data-trade-name');
        
        const progInput = card.querySelector('.update-progress-input');
        const presentInput = card.querySelector('.update-present-input');
        const requiredInput = card.querySelector('.update-required-input');
        const reasonSelect = card.querySelector('.update-reason-select');
        const notesInput = card.querySelector('.update-notes-input');

        const progressPct = Number(progInput ? progInput.value : NaN);
        const workersPresent = Number(presentInput ? presentInput.value : NaN);
        const workersRequired = Number(requiredInput ? requiredInput.value : NaN);
        const reason = reasonSelect ? reasonSelect.value : 'On Track';
        const notes = notesInput ? notesInput.value.trim() : '';

        if (isNaN(progressPct) || progressPct < 0 || progressPct > 100) {
            validationError = `${tradeName}: Progress % must be between 0 and 100.`;
            return;
        }

        if (isNaN(workersPresent) || workersPresent < 0) {
            validationError = `${tradeName}: Workers Present must be a non-negative number.`;
            return;
        }

        if (isNaN(workersRequired) || workersRequired < 0) {
            validationError = `${tradeName}: Workers Required must be a non-negative number.`;
            return;
        }

        updatesToSubmit.push({
            tradeId,
            tradeName,
            updateData: {
                tradeId,
                date: dateStr,
                progressPct,
                workersPresent,
                workersRequired,
                reason,
                notes
            }
        });
    });

    if (validationError) {
        showUpdateAlert(`Validation Error: ${validationError}`, 'error');
        return;
    }

    // 3. Perform Submissions
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting Updates...';
        }

        showUpdateAlert('Submitting trade updates to server...', 'info');

        let successCount = 0;
        let failCount = 0;
        const errorMessages = [];

        for (const item of updatesToSubmit) {
            try {
                await SitePulseAPI.createDailyUpdate(projectId, item.updateData);
                successCount++;
            } catch (err) {
                failCount++;
                console.error(`❌ Failed to submit update for ${item.tradeName}:`, err);
                errorMessages.push(`${item.tradeName}: ${err.message}`);
            }
        }

        // 4. Handle Results and Reload
        if (successCount > 0) {
            await refreshAllData();
            showToast(`Successfully saved ${successCount} trade update(s)!`, 'success');
        }

        if (failCount === 0) {
            showUpdateAlert(`✅ Successfully submitted ${successCount} trade update(s)!`, 'success');
            setTimeout(() => {
                closeDailyUpdateModal();
            }, 1200);
        } else if (successCount > 0) {
            showUpdateAlert(`⚠️ Partially saved (${successCount} succeeded, ${failCount} failed). Errors: ${errorMessages.join(' | ')}`, 'warning');
        } else {
            showUpdateAlert(`❌ Failed to submit updates. ${errorMessages.join(' | ')}`, 'error');
        }

    } catch (err) {
        showUpdateAlert(`Submission error: ${err.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Submit All Trade Updates</span>';
        }
    }
}

function showUpdateAlert(msg, type = 'info') {
    const alertEl = document.getElementById('update-status-alert');
    if (!alertEl) return;

    alertEl.style.display = 'block';
    alertEl.className = `update-status-alert ${type}`;
    alertEl.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'))}"></i> <span>${escapeHtml(msg)}</span>`;
}

/**
 * ==========================================================================
 * AUTHENTICATION MODAL HANDLERS
 * ==========================================================================
 */

async function handleLoginSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');
    const errorAlert = document.getElementById('login-error-alert');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
        if (errorAlert) errorAlert.style.display = 'none';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
        }

        await SitePulseAuth.signIn(email, password);
        await checkAuthAndLoadApp();
        showToast('Successfully authenticated!', 'success');
    } catch (err) {
        if (errorAlert) {
            errorAlert.textContent = err.message || 'Login failed. Please check credentials.';
            errorAlert.style.display = 'block';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>';
        }
    }
}

async function handleLogout() {
    await SitePulseAuth.signOut();
    SitePulseState.user = null;
    SitePulseState.organization = null;
    SitePulseState.portfolio = [];
    SitePulseState.currentDashboard = null;

    const loginModal = document.getElementById('login-modal');
    const userBadge = document.getElementById('user-profile-badge');
    const logoutBtn = document.getElementById('logout-btn');
    const openUpdateBtn = document.getElementById('open-daily-update-btn');

    if (loginModal) loginModal.style.display = 'flex';
    if (userBadge) userBadge.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (openUpdateBtn) openUpdateBtn.style.display = 'none';

    showToast('Signed out of SitePulse session.', 'info');
}

/**
 * ==========================================================================
 * TOAST NOTIFICATION UTILITY
 * ==========================================================================
 */

function showToast(msg, type = 'info') {
    const container = document.getElementById('global-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    else if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * HTML Sanitizer Helper
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * ==========================================================================
 * PHASE 6: AI COPILOT & DECISION SUPPORT CONTROLLER
 * ==========================================================================
 */

async function initCopilotView() {
    populateCopilotProjectSelector();
    await checkCopilotStatus();
    await fetchSuggestedPrompts();
}

function populateCopilotProjectSelector() {
    const selector = document.getElementById('copilot-project-select');
    if (!selector) return;

    const currentVal = selector.value || SitePulseState.copilot.selectedProjectId;
    selector.innerHTML = '<option value="">🌐 Entire Active Portfolio (All Stores)</option>';

    (SitePulseState.portfolio || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `📍 ${p.name} (${p.city || 'Store'})`;
        if (p.id === currentVal) opt.selected = true;
        selector.appendChild(opt);
    });

    SitePulseState.copilot.selectedProjectId = selector.value;
}

async function checkCopilotStatus() {
    const badge = document.getElementById('copilot-provider-badge');
    const modelName = document.getElementById('copilot-model-name');
    const alertBanner = document.getElementById('copilot-unconfigured-alert');
    const unconfiguredMsg = document.getElementById('copilot-unconfigured-msg');

    try {
        const status = await SitePulseAPI.getCopilotStatus();
        SitePulseState.copilot.status = status;

        if (status.configured) {
            if (badge) {
                badge.classList.remove('unconfigured');
                const dot = badge.querySelector('.status-indicator');
                if (dot) dot.className = 'status-indicator online';
            }
            if (modelName) {
                const provName = status.provider === 'mock' ? 'Deterministic Engine' : (status.provider.toUpperCase() + ' ' + (status.model || ''));
                modelName.textContent = provName;
            }
            if (alertBanner) alertBanner.style.display = 'none';
        } else {
            if (badge) {
                badge.classList.add('unconfigured');
                const dot = badge.querySelector('.status-indicator');
                if (dot) dot.className = 'status-indicator warning';
            }
            if (modelName) modelName.textContent = 'Unconfigured (Setup Required)';
            if (alertBanner) {
                alertBanner.style.display = 'flex';
                if (unconfiguredMsg && status.setupGuide) {
                    unconfiguredMsg.textContent = status.setupGuide.message;
                }
            }
        }
    } catch (err) {
        if (badge) badge.classList.add('unconfigured');
        if (modelName) modelName.textContent = 'Copilot Offline';
    }
}

async function fetchSuggestedPrompts() {
    const container = document.getElementById('copilot-suggestion-chips');
    if (!container) return;

    try {
        const data = await SitePulseAPI.getSuggestedPrompts(SitePulseState.copilot.selectedProjectId);
        if (data && Array.isArray(data.prompts) && data.prompts.length > 0) {
            container.innerHTML = data.prompts.map(p => `
                <button class="copilot-chip" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>
            `).join('');

            // Attach click listener to prompt chips
            container.querySelectorAll('.copilot-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const prompt = chip.getAttribute('data-prompt');
                    const input = document.getElementById('copilot-chat-input');
                    if (input && prompt) {
                        input.value = prompt;
                        updateCharCount();
                        submitCopilotChat();
                    }
                });
            });
        }
    } catch (err) {
        console.warn('Failed to fetch suggested prompts:', err);
    }
}

function setupCopilotEventListeners() {
    // Project scope selector
    const scopeSelect = document.getElementById('copilot-project-select');
    if (scopeSelect) {
        scopeSelect.addEventListener('change', async (e) => {
            SitePulseState.copilot.selectedProjectId = e.target.value;
            await fetchSuggestedPrompts();
            showToast(`Copilot telemetry scoped to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
        });
    }

    // Clear chat button
    const clearBtn = document.getElementById('copilot-clear-chat-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCopilotConversation);
    }

    // Textarea input char counter and keyboard submission (Enter to send, Shift+Enter for newline)
    const textarea = document.getElementById('copilot-chat-input');
    if (textarea) {
        textarea.addEventListener('input', updateCharCount);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitCopilotChat();
            }
        });
    }

    // Form submission
    const form = document.getElementById('copilot-chat-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitCopilotChat();
        });
    }

    // Prompt chips delegation (for initial chips)
    const chipWrapper = document.getElementById('copilot-suggestion-chips');
    if (chipWrapper) {
        chipWrapper.querySelectorAll('.copilot-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                const input = document.getElementById('copilot-chat-input');
                if (input && prompt) {
                    input.value = prompt;
                    updateCharCount();
                    submitCopilotChat();
                }
            });
        });
    }
}

function updateCharCount() {
    const input = document.getElementById('copilot-chat-input');
    const countEl = document.getElementById('copilot-char-count');
    if (input && countEl) {
        countEl.textContent = `${input.value.length} / 1000`;
    }
}

async function submitCopilotChat() {
    const input = document.getElementById('copilot-chat-input');
    const sendBtn = document.getElementById('copilot-send-btn');
    const loadingIndicator = document.getElementById('copilot-loading-indicator');
    const chatStream = document.getElementById('copilot-chat-stream');

    if (!input || !chatStream) return;
    const text = input.value.trim();
    if (!text || SitePulseState.copilot.isThinking) return;

    // Reset input
    input.value = '';
    updateCharCount();

    // 1. Render User message
    renderUserMessage(text);

    // 2. Set loading state
    SitePulseState.copilot.isThinking = true;
    if (sendBtn) sendBtn.disabled = true;
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        chatStream.appendChild(loadingIndicator);
        scrollCopilotStreamToBottom(true);
    }

    try {
        const payload = {
            message: text,
            projectId: SitePulseState.copilot.selectedProjectId || null,
            referenceDate: SitePulseState.referenceDate,
            conversationHistory: SitePulseState.copilot.conversationHistory
        };

        const response = await SitePulseAPI.sendCopilotMessage(payload);

        // Update conversation history
        SitePulseState.copilot.conversationHistory.push(
            { role: 'user', content: text },
            { role: 'assistant', content: response.response }
        );

        // Keep history token-manageable (last 8 messages)
        if (SitePulseState.copilot.conversationHistory.length > 8) {
            SitePulseState.copilot.conversationHistory = SitePulseState.copilot.conversationHistory.slice(-8);
        }

        renderAssistantResponse(response);
    } catch (err) {
        renderErrorMessage(err);
    } finally {
        SitePulseState.copilot.isThinking = false;
        if (sendBtn) sendBtn.disabled = false;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        scrollCopilotStreamToBottom(true);
    }
}

function renderUserMessage(text) {
    const chatStream = document.getElementById('copilot-chat-stream');
    if (!chatStream) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgEl = document.createElement('div');
    msgEl.className = 'copilot-message copilot-message-user';
    msgEl.innerHTML = `
        <div class="copilot-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="copilot-bubble">
            <div class="copilot-msg-header">
                <span class="copilot-sender-name">${escapeHtml(SitePulseState.user ? (SitePulseState.user.name || 'Executive User') : 'User')}</span>
                <span class="copilot-msg-time">${timeStr}</span>
            </div>
            <div class="copilot-msg-body">
                <p>${escapeHtml(text)}</p>
            </div>
        </div>
    `;
    chatStream.appendChild(msgEl);
    scrollCopilotStreamToBottom(true);
}

function renderAssistantResponse(data) {
    const chatStream = document.getElementById('copilot-chat-stream');
    if (!chatStream) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedBody = formatMarkdownText(data.response);

    const g = data.grounding || {};
    const sources = Array.isArray(g.sources) ? g.sources.join(', ') : 'projectService';
    const refDate = g.referenceDate || SitePulseState.referenceDate;
    const scopeName = g.projectName || (g.scope === 'portfolio' ? 'Entire Portfolio' : 'Project Telemetry');

    const msgEl = document.createElement('div');
    msgEl.className = 'copilot-message copilot-message-assistant';
    msgEl.innerHTML = `
        <div class="copilot-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="copilot-bubble">
            <div class="copilot-msg-header">
                <span class="copilot-sender-name">SitePulse Copilot</span>
                <span class="copilot-msg-time">${timeStr} &bull; ${escapeHtml(scopeName)}</span>
            </div>
            <div class="copilot-msg-body">
                ${formattedBody}
                <div class="copilot-grounding-badge">
                    <i class="fa-solid fa-database"></i>
                    <span>Sources: <code>${escapeHtml(sources)}</code> &bull; Cutoff: <strong>${escapeHtml(refDate)}</strong> &bull; Advisory Decision Support</span>
                </div>
            </div>
        </div>
    `;
    chatStream.appendChild(msgEl);

    // If follow-up suggestions exist, render chip bar
    if (Array.isArray(data.suggestedFollowUps) && data.suggestedFollowUps.length > 0) {
        const followUpsContainer = document.createElement('div');
        followUpsContainer.className = 'copilot-suggestions-bar';
        followUpsContainer.style.marginTop = '0.5rem';
        followUpsContainer.innerHTML = `
            <span class="suggestions-label"><i class="fa-regular fa-comments"></i> Follow Up:</span>
            <div class="suggestion-chips-wrapper">
                ${data.suggestedFollowUps.map(f => `<button class="copilot-chip" data-prompt="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join('')}
            </div>
        `;

        followUpsContainer.querySelectorAll('.copilot-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                const input = document.getElementById('copilot-chat-input');
                if (input && prompt) {
                    input.value = prompt;
                    updateCharCount();
                    submitCopilotChat();
                }
            });
        });

        chatStream.appendChild(followUpsContainer);
    }

    scrollCopilotStreamToBottom(true);
}

function renderErrorMessage(err) {
    const chatStream = document.getElementById('copilot-chat-stream');
    if (!chatStream) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isUnconfigured = err.code === 'LLM_NOT_CONFIGURED' || err.statusCode === 503;

    const msgEl = document.createElement('div');
    msgEl.className = 'copilot-message copilot-message-assistant';
    msgEl.innerHTML = `
        <div class="copilot-avatar" style="background: linear-gradient(135deg, #ef4444, #dc2626);"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="copilot-bubble" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05);">
            <div class="copilot-msg-header">
                <span class="copilot-sender-name" style="color: #ef4444;">${isUnconfigured ? 'Configuration Notice' : 'Copilot System Notice'}</span>
                <span class="copilot-msg-time">${timeStr}</span>
            </div>
            <div class="copilot-msg-body">
                <p><strong>${escapeHtml(err.message || 'An error occurred while generating decision support.')}</strong></p>
                ${isUnconfigured ? `
                    <p>To enable live reasoning, configure provider credentials in your backend environment:</p>
                    <pre style="background: rgba(0,0,0,0.3); padding: 0.6rem; border-radius: 4px; font-size: 0.82rem;"><code>LLM_PROVIDER=openai\nLLM_API_KEY=sk-...\nLLM_MODEL=gpt-4o-mini</code></pre>
                ` : `
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Please check backend connectivity or try another project scope inquiry.</p>
                `}
            </div>
        </div>
    `;
    chatStream.appendChild(msgEl);
    chatStream.scrollTop = chatStream.scrollHeight;
}

function clearCopilotConversation() {
    const chatStream = document.getElementById('copilot-chat-stream');
    if (!chatStream) return;

    SitePulseState.copilot.conversationHistory = [];

    chatStream.innerHTML = `
        <div class="copilot-message copilot-message-assistant initial-welcome">
            <div class="copilot-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="copilot-bubble">
                <div class="copilot-msg-header">
                    <span class="copilot-sender-name">SitePulse Copilot</span>
                    <span class="copilot-msg-time">Ground Truth Telemetry</span>
                </div>
                <div class="copilot-msg-body">
                    <p>Conversation history has been cleared. I am ready to analyze project telemetry across your active stores.</p>
                    <div class="copilot-grounding-badge">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Read-Only Advisory Mode &bull; Grounded strictly in verified organization records</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    showToast('Copilot conversation history cleared.', 'info');
}

/**
 * Safe, robust Markdown formatter for Copilot responses.
 * Parses headers, bold, italics, code, bullet lists (*, -, •), and ordered lists.
 * Removes visible raw markdown symbols such as unnecessary asterisks.
 */
function formatMarkdownText(rawText) {
    if (!rawText) return '';

    function formatInline(text) {
        if (!text) return '';
        let s = escapeHtml(text);
        // Inline code (`code`)
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold (**text** or __text__)
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        // Italic (*text* or _text_)
        s = s.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
        s = s.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');
        return s;
    }

    const lines = rawText.split('\n');
    const parsedLines = [];
    let currentList = null; // 'ul' | 'ol' | null

    function closeList() {
        if (currentList) {
            parsedLines.push(`</${currentList}>`);
            currentList = null;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (!trimmed) {
            closeList();
            continue;
        }

        // Headings (###, ##, #, ####)
        const headerMatch = trimmed.match(/^(#{1,5})\s+(.*)$/);
        if (headerMatch) {
            closeList();
            const level = Math.min(6, headerMatch[1].length + 1);
            parsedLines.push(`<h${level}>${formatInline(headerMatch[2])}</h${level}>`);
            continue;
        }

        // Unordered lists: starts with "* ", "- ", "• ", or "*   "
        const ulMatch = trimmed.match(/^[\*\-\•]\s+(.*)$/);
        if (ulMatch) {
            if (currentList !== 'ul') {
                closeList();
                parsedLines.push('<ul>');
                currentList = 'ul';
            }
            parsedLines.push(`<li>${formatInline(ulMatch[1])}</li>`);
            continue;
        }

        // Ordered lists: starts with "1. ", "2) ", etc.
        const olMatch = trimmed.match(/^\d+[\.\)]\s+(.*)$/);
        if (olMatch) {
            if (currentList !== 'ol') {
                closeList();
                parsedLines.push('<ol>');
                currentList = 'ol';
            }
            parsedLines.push(`<li>${formatInline(olMatch[1])}</li>`);
            continue;
        }

        // Regular paragraph / text block
        closeList();
        parsedLines.push(`<p>${formatInline(trimmed)}</p>`);
    }

    closeList();
    return parsedLines.join('');
}

function scrollCopilotStreamToBottom(force = false) {
    const chatStream = document.getElementById('copilot-chat-stream');
    if (!chatStream) return;
    const doScroll = () => {
        chatStream.scrollTo({
            top: chatStream.scrollHeight,
            behavior: 'smooth'
        });
    };
    if (force) {
        doScroll();
        setTimeout(doScroll, 60);
        setTimeout(doScroll, 200);
    } else {
        const distanceToBottom = chatStream.scrollHeight - chatStream.scrollTop - chatStream.clientHeight;
        if (distanceToBottom < 160) {
            doScroll();
        }
    }
}
