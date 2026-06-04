/* =============================================
   Mahoraga Dashboard — Frontend Logic
   ============================================= */
let proxyMode = 'none'; // none | list | api | single
const API = {
  domains: '/api/domains',
  start: '/api/start',
  pause: '/api/pause',
  resume: '/api/resume',
  stop: '/api/stop',
  status: '/api/status',
  export: '/api/export',
};

// ---------- State ----------
let jobState = 'idle'; // idle | running | paused | completed | stopped
let allDomains = [];

// ---------- Socket.IO ----------
const socket = io();

socket.on('connect', () => {
  addLog('info', 'Connected to server via WebSockets.');
});

// ---------- DOM Refs ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  els.emailInput = $('#email-input');
  els.emailCount = $('#email-count');
  els.domainSearch = $('#domain-search');
  els.domainList = $('#domain-list');
  els.threadSize = $('#thread-size');
  els.rentryCustomId = $('#rentry-custom-id');
  els.btnStart = $('#btn-start');
  els.btnPause = $('#btn-pause');
  els.btnStop = $('#btn-stop');
  els.progressBar = $('#progress-bar-fill');
  els.progressPercent = $('#progress-percent');
  els.progressText = $('#progress-text');
  els.statTotal = $('#stat-total');
  els.statSuccess = $('#stat-success');
  els.statNotFound = $('#stat-not-found');
  els.statRateLimit = $('#stat-rate-limit');
  els.statErrors = $('#stat-errors');
  els.resultsBody = $('#results-body');
  els.resultsEmpty = $('#results-empty');
  els.logConsole = $('#log-console');
  els.statusDot = $('#status-dot');
  els.statusText = $('#status-text');
  els.ratePerMinute = $('#rate-per-minute');
  els.ratePerHour = $('#rate-per-hour');
  els.ratePerDay = $('#rate-per-day');
  els.ratePerWeek = $('#rate-per-week');

  initEventListeners();
  loadDomains();
  updateButtonStates();
  initProxyTabs();
  syncInitialStatus();
});

// ---------- Init ----------
function initEventListeners() {
  els.emailInput.addEventListener('input', updateEmailCount);
  els.domainSearch.addEventListener('input', filterDomains);
  els.btnStart.addEventListener('click', startJob);
  els.btnPause.addEventListener('click', togglePause);
  els.btnStop.addEventListener('click', stopJob);

  $('#btn-select-all').addEventListener('click', () => toggleAllDomains(true));
  $('#btn-deselect-all').addEventListener('click', () => toggleAllDomains(false));

  // Export buttons
  $$('.btn-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const format = btn.dataset.format;
      exportResults(type, format);
    });
  });

  // Proxy list line counter
  const proxyListInput = $('#proxy-list-input');
  if (proxyListInput) {
    proxyListInput.addEventListener('input', () => {
      const text = proxyListInput.value.trim();
      const count = text ? text.split('\n').filter(l => l.trim()).length : 0;
      $('#proxy-count').textContent = `${count} prox${count !== 1 ? 'ies' : 'y'}`;
    });
  }
}

function updateEmailCount() {
  const text = els.emailInput.value.trim();
  const count = text ? text.split('\n').filter(l => l.trim()).length : 0;
  els.emailCount.textContent = `${count} email${count !== 1 ? 's' : ''}`;
}

// ---------- Proxy Tabs ----------
function initProxyTabs() {
  $$('.proxy-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      $$('.proxy-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      proxyMode = tab.dataset.mode;

      // Show/hide panels
      $$('.proxy-panel').forEach(p => p.style.display = 'none');
      if (proxyMode !== 'none') {
        const panel = $(`#proxy-panel-${proxyMode}`);
        if (panel) panel.style.display = 'block';
      }
    });
  });
}

function getProxyConfig() {
  if (proxyMode === 'none') {
    return { mode: 'none' };
  } else if (proxyMode === 'list') {
    const text = ($('#proxy-list-input') || {}).value || '';
    const proxies = text.split('\n').map(l => l.trim()).filter(l => l);
    return { mode: 'list', proxies };
  } else if (proxyMode === 'api') {
    const url = ($('#proxy-api-input') || {}).value || '';
    return { mode: 'api', api_url: url };
  } else if (proxyMode === 'single') {
    const proxy = ($('#proxy-single-input') || {}).value || '';
    return { mode: 'single', proxy };
  }
  return { mode: 'none' };
}

// ---------- Domains ----------
async function loadDomains() {
  try {
    const res = await fetch(API.domains);
    const data = await res.json();
    allDomains = data.domains;
    renderDomains(data.grouped);
  } catch (e) {
    addLog('error', `Failed to load domains: ${e.message}`);
  }
}

const defaultSelectedDomains = [
  "gravatar", "insightly.com", "flot", "freelancer", "seoclerks", "duolingo",
  "laposte", "mail_ru", "flickr", "sporcle", "caringbridge", "spotify", "xvideos",
  "anydo", "devrant", "armurerieauxerre", "amazon", "dominosfr", "envato", "naturabuy",
  "fanpop", "parler", "plurk", "taringa", "tellonym", "wattpad", "archive", "docker",
  "office365", "bodybuilding", "teamtreehouse", "rambler", "zoho"
];

function renderDomains(grouped) {
  els.domainList.innerHTML = '';
  for (const [category, domains] of Object.entries(grouped)) {
    const catLabel = document.createElement('div');
    catLabel.className = 'domain-category';
    catLabel.textContent = category.replace(/_/g, ' ');
    els.domainList.appendChild(catLabel);

    for (const d of domains) {
      const isDefault = defaultSelectedDomains.includes(d.name) || defaultSelectedDomains.includes(d.domain);
      const checkedAttr = isDefault ? 'checked' : '';

      const item = document.createElement('label');
      item.className = 'domain-item';
      item.dataset.name = d.name;
      item.dataset.domain = d.domain;
      item.innerHTML = `
        <input type="checkbox" value="${d.name}" ${checkedAttr}>
        <span class="domain-name">${d.name}</span>
        <span class="domain-url">${d.domain}</span>
      `;
      els.domainList.appendChild(item);
    }
  }
}

function filterDomains() {
  const q = els.domainSearch.value.toLowerCase();
  $$('.domain-item').forEach(item => {
    const name = item.dataset.name.toLowerCase();
    const domain = item.dataset.domain.toLowerCase();
    const match = !q || name.includes(q) || domain.includes(q);
    item.classList.toggle('hidden', !match);
  });
  // Also hide categories with no visible children
  $$('.domain-category').forEach(cat => {
    let next = cat.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('domain-category')) {
      if (!next.classList.contains('hidden')) hasVisible = true;
      next = next.nextElementSibling;
    }
    cat.style.display = hasVisible ? '' : 'none';
  });
}

function toggleAllDomains(checked) {
  $$('.domain-item input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
  });
}

function getSelectedDomains() {
  const selected = [];
  $$('.domain-item input[type="checkbox"]:checked').forEach(cb => {
    selected.push(cb.value);
  });
  return selected;
}

// ---------- Job Control ----------
async function startJob() {
  const emailText = els.emailInput.value.trim();
  if (!emailText) {
    addLog('error', 'Please enter at least one email address.');
    return;
  }

  const emails = emailText.split('\n').map(l => l.trim()).filter(l => l);
  const domains = getSelectedDomains();
  if (domains.length === 0) {
    addLog('error', 'Please select at least one domain.');
    return;
  }

  const threadSize = parseInt(els.threadSize.value) || 5;
  const proxyConfig = getProxyConfig();
  const rentryCustomId = els.rentryCustomId ? els.rentryCustomId.value.trim() : '';

  // Validate proxy config
  if (proxyConfig.mode === 'list' && (!proxyConfig.proxies || proxyConfig.proxies.length === 0)) {
    addLog('error', 'Proxy List mode selected but no proxies provided.');
    return;
  }
  if (proxyConfig.mode === 'api' && !proxyConfig.api_url) {
    addLog('error', 'Proxy API mode selected but no URL provided.');
    return;
  }
  if (proxyConfig.mode === 'single' && !proxyConfig.proxy) {
    addLog('error', 'Single IP mode selected but no proxy provided.');
    return;
  }

  try {
    console.log("[DEBUG] Sending POST to /api/start...");
    console.log("[DEBUG] Payload:", { emails: emails.length, domains: domains.length, threadSize, proxyConfig, rentryCustomId });
    const res = await fetch(API.start, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, domains, thread_size: threadSize, proxy: proxyConfig, rentry_custom_id: rentryCustomId }),
    });
    console.log(`[DEBUG] /api/start response status: ${res.status} ${res.statusText}`);
    
    // Read raw text first so we can see what the server actually sent
    const rawText = await res.text();
    console.log(`[DEBUG] /api/start response body:`, rawText);
    
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      addLog('error', `Server returned invalid JSON: ${rawText}`);
      return;
    }
    
    if (data.error) {
      addLog('error', data.error);
      return;
    }
    // Reset UI
    resetMonitoring();
    setJobState('running');
    addLog('info', `Job started — ${emails.length} emails × ${domains.length} domains, batch size ${threadSize}`);
    if (data.version) {
      addLog('info', `[SERVER] Version: ${data.version}`);
    }
  } catch (e) {
    addLog('error', `Failed to start job: ${e.message}`);
  }
}

async function togglePause() {
  const endpoint = jobState === 'paused' ? API.resume : API.pause;
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'paused') {
      setJobState('paused');
      addLog('warn', 'Job paused.');
    } else if (data.status === 'running') {
      setJobState('running');
      addLog('info', 'Job resumed.');
    }
  } catch (e) {
    addLog('error', `Pause/Resume failed: ${e.message}`);
  }
}

async function stopJob() {
  try {
    await fetch(API.stop, { method: 'POST' });
    setJobState('stopped');
    addLog('warn', 'Job stopped by user.');
  } catch (e) {
    addLog('error', `Stop failed: ${e.message}`);
  }
}

// ---------- Sync Initial Status ----------
async function syncInitialStatus() {
  try {
    const res = await fetch(`${API.status}?log_offset=0&result_offset=0`);
    const data = await res.json();
    
    setJobState(data.state);
    updateProgress(data.progress);
    updateStats(data.stats);
    updateRates(data.rates);
    
    if (data.new_results && data.new_results.length > 0) {
      appendResults(data.new_results);
    }
    
    if (data.new_logs && data.new_logs.length > 0) {
      data.new_logs.forEach(log => addLogLine(log.level, log.message, log.time));
    }
    
    addLog('info', `Synced state from server: ${data.state}`);
  } catch (e) {
    addLog('error', `Failed to sync status from server: ${e.message}`);
  }
}

// ---------- WebSocket Listener ----------
socket.on('status_update', (data) => {
  // Update progress
  updateProgress(data.progress);

  // Update stats
  updateStats(data.stats);

  // Update rates
  updateRates(data.rates);

  // Append new results
  if (data.new_results && data.new_results.length > 0) {
    appendResults(data.new_results);
  }

  // Append new logs
  if (data.new_logs && data.new_logs.length > 0) {
    data.new_logs.forEach(log => addLogLine(log.level, log.message, log.time));
  }

  // Check if job is done
  if (data.state === 'completed') {
    if (jobState !== 'completed') {
      setJobState('completed');
      addLog('success', `Job completed! Processed ${data.stats.total} checks.`);
    }
  } else if (data.state === 'stopped') {
    if (jobState !== 'stopped') setJobState('stopped');
  } else if (data.state === 'paused') {
    if (jobState !== 'paused') setJobState('paused');
  } else if (data.state === 'running') {
    if (jobState !== 'running') setJobState('running');
  }
});

// ---------- UI Updates ----------
function updateProgress(progress) {
  if (!progress) return;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  els.progressBar.style.width = `${pct}%`;
  els.progressPercent.textContent = `${pct}%`;
  els.progressText.innerHTML = `<strong>${progress.done}</strong> / ${progress.total} emails processed`;

  if (jobState === 'running') {
    els.progressBar.classList.add('animate');
  } else {
    els.progressBar.classList.remove('animate');
  }
}

function updateStats(stats) {
  if (!stats) return;
  animateCounter(els.statTotal, stats.total);
  animateCounter(els.statSuccess, stats.exists);
  animateCounter(els.statNotFound, stats.not_found);
  animateCounter(els.statRateLimit, stats.rate_limit);
  animateCounter(els.statErrors, stats.errors);
}

function animateCounter(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current !== target) {
    el.textContent = target;
    el.style.transform = 'scale(1.15)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
  }
}

function formatRate(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}

function updateRates(rates) {
  if (!rates) return;
  animateRateCounter(els.ratePerMinute, rates.per_minute);
  animateRateCounter(els.ratePerHour, rates.per_hour);
  animateRateCounter(els.ratePerDay, rates.per_day);
  animateRateCounter(els.ratePerWeek, rates.per_week);
}

function animateRateCounter(el, target) {
  const formatted = formatRate(target);
  if (el.textContent !== formatted) {
    el.textContent = formatted;
    el.style.transform = 'scale(1.15)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
  }
}

function appendResults(results) {
  if (els.resultsEmpty) {
    els.resultsEmpty.style.display = 'none';
  }
  const fragment = document.createDocumentFragment();
  for (const r of results) {
    const tr = document.createElement('tr');
    tr.className = 'fade-in';

    let statusClass = 'not-found';
    let statusLabel = 'Not Found';
    if (r.exists) {
      statusClass = 'exists';
      statusLabel = 'Found';
    } else if (r.rateLimit) {
      statusClass = 'rate-limit';
      statusLabel = 'Rate Limit';
    } else if (r.error) {
      statusClass = 'error';
      statusLabel = 'Error';
    }

    let extras = '';
    if (r.emailrecovery) extras += r.emailrecovery;
    if (r.phoneNumber) extras += (extras ? ' / ' : '') + r.phoneNumber;

    tr.innerHTML = `
      <td class="email-cell">${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.domain)}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td>${escapeHtml(extras)}</td>
    `;
    fragment.appendChild(tr);
  }
  els.resultsBody.appendChild(fragment);

  // Limit DOM rows to prevent browser crash
  while (els.resultsBody.children.length > 10) {
    els.resultsBody.removeChild(els.resultsBody.firstChild);
  }

  // Auto-scroll results to bottom
  const wrapper = els.resultsBody.closest('.results-wrapper');
  if (wrapper) {
    wrapper.scrollTop = wrapper.scrollHeight;
  }
}

function resetMonitoring() {
  els.resultsBody.innerHTML = '';
  if (els.resultsEmpty) els.resultsEmpty.style.display = '';
  els.logConsole.innerHTML = '';
  els.progressBar.style.width = '0%';
  els.progressPercent.textContent = '0%';
  els.progressText.innerHTML = '<strong>0</strong> / 0 emails processed';
  els.statTotal.textContent = '0';
  els.statSuccess.textContent = '0';
  els.statNotFound.textContent = '0';
  els.statRateLimit.textContent = '0';
  els.statErrors.textContent = '0';
  els.ratePerMinute.textContent = '0';
  els.ratePerHour.textContent = '0';
  els.ratePerDay.textContent = '0';
  els.ratePerWeek.textContent = '0';
}

function setJobState(state) {
  jobState = state;
  updateButtonStates();
  updateHeaderStatus();
}

function updateButtonStates() {
  const isIdle = jobState === 'idle' || jobState === 'completed' || jobState === 'stopped';
  const isRunning = jobState === 'running';
  const isPaused = jobState === 'paused';

  els.btnStart.disabled = !isIdle;
  els.btnPause.disabled = !(isRunning || isPaused);
  els.btnStop.disabled = !(isRunning || isPaused);

  // Update pause button label
  if (isPaused) {
    els.btnPause.innerHTML = '▶ Resume';
  } else {
    els.btnPause.innerHTML = '⏸ Pause';
  }

  // Enable/disable export buttons based on whether there are results
  const hasResults = els.resultsBody.children.length > 0;
  $$('.btn-export').forEach(btn => {
    btn.disabled = !hasResults;
  });
}

function updateHeaderStatus() {
  els.statusDot.className = `status-dot ${jobState === 'completed' ? 'idle' : jobState}`;
  const labels = {
    idle: 'Idle',
    running: 'Running',
    paused: 'Paused',
    stopped: 'Stopped',
    completed: 'Completed',
  };
  els.statusText.textContent = labels[jobState] || 'Idle';
}

// ---------- Logging ----------
function addLog(level, message) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  addLogLine(level, message, now);
}

function addLogLine(level, message, time) {
  const line = document.createElement('div');
  line.className = `log-line ${level}`;
  line.innerHTML = `<span class="log-time">[${escapeHtml(time)}]</span>${escapeHtml(message)}`;
  els.logConsole.appendChild(line);

  // Limit log lines to prevent browser crash
  while (els.logConsole.children.length > 50) {
    els.logConsole.removeChild(els.logConsole.firstChild);
  }

  els.logConsole.scrollTop = els.logConsole.scrollHeight;
}

// ---------- Export ----------
async function exportResults(type, format) {
  try {
    const url = `${API.export}/${type}/${format}`;
    const res = await fetch(url);
    if (!res.ok) {
      addLog('error', `Export failed: ${res.statusText}`);
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mahoraga_${type}_results.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
    addLog('success', `Exported ${type} results as ${format.toUpperCase()}`);
  } catch (e) {
    addLog('error', `Export failed: ${e.message}`);
  }
}

// ---------- Helpers ----------
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
