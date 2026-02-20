// Admin Seat Manager — Core Logic
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || '1234';
const gasUrl = import.meta.env.VITE_GAS_ADMIN_URL;

// ===== State =====
let allGuests = [];
let offlineQueue = JSON.parse(localStorage.getItem('adminOfflineQueue') || '[]');
let dragSrcEl = null; // guest card being dragged

// ===== DOM =====
const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('login-btn');
const pwdInput = document.getElementById('admin-password');
const loginError = document.getElementById('login-error');
const loader = document.getElementById('initial-loader');
const guestListContainer = document.getElementById('guest-list-container');
const floorplanWrapper = document.getElementById('floorplan-wrapper');
const searchInput = document.getElementById('search-guest');
const unassignedCount = document.getElementById('unassigned-count');
const syncStatus = document.getElementById('sync-status');
const tooltip = document.getElementById('seat-tooltip');
const ttName = document.getElementById('tt-name');
const ttNote = document.getElementById('tt-note');

// Settings panel DOM
const settingsPanel = document.getElementById('settings-panel');
const inputSeats = document.getElementById('input-seats');
const inputTables = document.getElementById('input-tables');
const inputShape = document.getElementById('input-shape');
const dragModeToggle = document.getElementById('drag-mode-toggle');
const dragBanner = document.getElementById('drag-banner');

// ==========================================================
//  Tables Config — dynamic, saved to localStorage
// ==========================================================
const DEFAULT_SEATS = 6;
const DEFAULT_TABLE_COUNT = 25;

// Default grid positions for N tables (percentage of floorplan)
function computeDefaultPositions(count) {
    const positions = {};
    // Arrange in 6 columns, fill top to bottom
    const cols = [16, 27, 38, 49, 59, 70];
    const yStart = 22, yEnd = 82;
    const maxPerCol = Math.ceil(count / cols.length);
    const yStep = maxPerCol > 1 ? (yEnd - yStart) / (maxPerCol - 1) : 0;

    let idx = 0;
    for (let c = 0; c < cols.length && idx < count; c++) {
        const rowsInCol = Math.min(maxPerCol, count - idx);
        for (let r = 0; r < rowsInCol; r++) {
            positions[String(idx + 1)] = {
                x: cols[c],
                y: yStart + r * yStep
            };
            idx++;
        }
    }
    return positions;
}

// Load persisted settings
let seatsPerTable = parseInt(localStorage.getItem('adminSeatsPerTable')) || DEFAULT_SEATS;
let tableCount = parseInt(localStorage.getItem('adminTableCount')) || DEFAULT_TABLE_COUNT;
let savedPositions = JSON.parse(localStorage.getItem('adminTablePositions') || '{}');
let tableShape = localStorage.getItem('adminTableShape') || 'long'; // 'long' or 'round'

// Set initial input values
inputSeats.value = seatsPerTable;
inputTables.value = tableCount;
inputShape.value = tableShape;

const DEFAULT_MAIN_POS = { x: 44, y: 10 };

function generateTablesConfig() {
    const defaults = computeDefaultPositions(tableCount);
    const config = [];

    // Main table (horizontal)
    const mp = savedPositions['M'] || DEFAULT_MAIN_POS;
    config.push({ id: 'M', name: 'Main', size: seatsPerTable, x: mp.x, y: mp.y, orientation: 'horizontal' });

    // Numbered tables (vertical)
    for (let i = 1; i <= tableCount; i++) {
        const saved = savedPositions[String(i)];
        const def = defaults[String(i)] || { x: 15 + (i % 6) * 12, y: 20 + Math.floor(i / 6) * 15 };
        config.push({
            id: String(i),
            name: String(i),
            size: seatsPerTable,
            x: saved ? saved.x : def.x,
            y: saved ? saved.y : def.y,
            orientation: tableShape === 'round' ? 'round' : 'vertical'
        });
    }
    return config;
}

let TABLES_CONFIG = generateTablesConfig();

// ===== Authentication =====
function checkAuth() {
    if (sessionStorage.getItem('adminAuth') === 'true') {
        loginOverlay.classList.add('hidden');
        initApp();
    } else {
        loader.style.display = 'none';
        pwdInput.focus();
    }
}

loginBtn.addEventListener('click', () => {
    if (pwdInput.value === adminPassword) {
        sessionStorage.setItem('adminAuth', 'true');
        loginOverlay.classList.add('hidden');
        loginError.style.display = 'none';
        loader.style.display = 'flex';
        initApp();
    } else {
        loginError.style.display = 'block';
        pwdInput.select();
    }
});
pwdInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });

// ===== API =====
async function gasRequest(action, data = null) {
    if (!gasUrl || gasUrl.includes('your_script_id')) {
        console.warn("GAS URL not configured — mock mode.");
        await new Promise(r => setTimeout(r, 300));
        return { success: true, data: mockData(action) };
    }
    try {
        let url = gasUrl, options = { method: 'GET' };
        if (data) {
            options = { method: 'POST', body: JSON.stringify({ action, ...data }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
        } else { url += `?action=${action}`; }
        const res = await fetch(url, options);
        return await res.json();
    } catch (err) {
        console.error("GAS Error:", err);
        return { success: false, error: err.message };
    }
}

function mockData(action) {
    if (action === 'get_temp') return [];
    if (action === 'get_confirm') return [
        { Name: '王大明', Table: '', Seat: '', Note: '素食' },
        { Name: '李小美', Table: 'M', Seat: '1', Note: '' },
        { Name: '張志強', Table: 'M', Seat: '2', Note: '海鮮過敏' },
        { Name: '陳怡君', Table: '1', Seat: '1', Note: '' },
        { Name: '林志豪', Table: '1', Seat: '3', Note: '' },
        { Name: '黃雅婷', Table: '', Seat: '', Note: '不喝酒' },
        { Name: '劉家豪', Table: '', Seat: '', Note: '' },
        { Name: '吳佳穎', Table: '2', Seat: '1', Note: '' },
    ];
    return [];
}

// Normalize guest data from GAS — Sheets may return numbers for Table/Seat
function normalizeGuests(data) {
    return data.map(g => ({
        ...g,
        Table: g.Table != null ? String(g.Table).trim() : '',
        Seat: g.Seat != null ? String(g.Seat).trim() : '',
        Name: String(g.Name || '').trim(),
        Note: g.Note != null ? String(g.Note) : ''
    }));
}

// ===== Initialization =====
async function initApp() {
    processQueue();
    try {
        setSyncStatus('syncing', '正在讀取... ⏳');
        const tempRes = await gasRequest('get_temp');
        console.log('[Admin] get_temp response:', tempRes);

        if (tempRes.success && tempRes.data && tempRes.data.length > 0) {
            allGuests = normalizeGuests(tempRes.data);
            console.log('[Admin] Loaded from temp:', allGuests.length, 'guests,',
                allGuests.filter(g => g.Table).length, 'assigned');
            renderAll();
            setSyncStatus('saved', '✅ 已同步至草稿');
        } else {
            const confRes = await gasRequest('get_confirm');
            console.log('[Admin] get_confirm response:', confRes);
            if (confRes.success && confRes.data && confRes.data.length > 0) {
                window._pendingConfirmData = normalizeGuests(confRes.data);
                openModal('sync-modal');
            } else {
                showToast("未找到任何賓客資料", "error");
            }
            hideLoader();
        }
    } catch (e) {
        console.error('[Admin] initApp error:', e);
        setSyncStatus('offline', '❌ 讀取失敗');
        showToast("伺服器連線失敗", "error");
        hideLoader();
    }
}

window.initEmptyTemp = () => { allGuests = []; renderAll(); closeModal('sync-modal'); };

document.getElementById('confirm-sync-btn').addEventListener('click', async () => {
    setSyncStatus('syncing', '正在載入... ⏳');
    closeModal('sync-modal');
    allGuests = window._pendingConfirmData || [];
    renderAll();
    const res = await gasRequest('sync_confirm_to_temp', { dummy: true });
    if (res.success) { setSyncStatus('saved', '✅ 已同步至草稿'); showToast('載入成功', 'success'); }
    else { setSyncStatus('offline', '❌ 同步失敗'); }
});

// ===== Rendering =====
function renderAll() { renderTables(); renderWaitlist(); hideLoader(); }

function hideLoader() {
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);
}

function renderWaitlist(filterStr = '') {
    guestListContainer.innerHTML = '';
    const unassigned = allGuests.filter(g => !g.Table || !g.Seat);
    const filtered = unassigned.filter(g => g.Name.toLowerCase().includes(filterStr.toLowerCase()));
    unassignedCount.textContent = unassigned.length;
    filtered.forEach(guest => guestListContainer.appendChild(createGuestCard(guest)));
}

function renderTables() {
    floorplanWrapper.innerHTML = '';
    TABLES_CONFIG.forEach(table => {
        const overlay = document.createElement('div');
        overlay.className = 'table-overlay';
        overlay.id = `table-${table.id}`;
        overlay.style.left = `${table.x}%`;
        overlay.style.top = `${table.y}%`;

        const assignedCount = allGuests.filter(g => String(g.Table) === String(table.id)).length;

        // Label
        const label = document.createElement('div');
        label.className = 'table-label';
        label.textContent = table.id === 'M'
            ? `主桌 ${assignedCount}/${table.size}`
            : `${table.name} (${assignedCount}/${table.size})`;
        overlay.appendChild(label);

        // Seats
        const seatsDiv = document.createElement('div');
        seatsDiv.className = `table-seats ${table.orientation}`;

        if (table.orientation === 'round') {
            // Round table: seats arranged in a circle
            const radius = 20 + table.size * 2; // scale radius with seat count
            const containerSize = (radius + 12) * 2; // seat_half_size = 12
            seatsDiv.style.width = containerSize + 'px';
            seatsDiv.style.height = containerSize + 'px';

            // Center dot
            const center = document.createElement('div');
            center.className = 'round-center';
            seatsDiv.appendChild(center);

            for (let i = 0; i < table.size; i++) {
                const angle = (2 * Math.PI / table.size) * i - Math.PI / 2; // start from top
                const cx = containerSize / 2 + radius * Math.cos(angle) - 12;
                const cy = containerSize / 2 + radius * Math.sin(angle) - 12;
                const seat = createSeatSlot(table, i + 1);
                seat.style.left = cx + 'px';
                seat.style.top = cy + 'px';
                seatsDiv.appendChild(seat);
            }
        } else if (table.orientation === 'vertical') {
            const leftCol = document.createElement('div'); leftCol.className = 'seat-col';
            const rightCol = document.createElement('div'); rightCol.className = 'seat-col';
            for (let i = 1; i <= table.size; i++) {
                const seat = createSeatSlot(table, i);
                if (i <= Math.ceil(table.size / 2)) leftCol.appendChild(seat);
                else rightCol.appendChild(seat);
            }
            seatsDiv.appendChild(leftCol);
            seatsDiv.appendChild(rightCol);
        } else {
            // horizontal (main table)
            const topRow = document.createElement('div'); topRow.className = 'seat-row';
            const bottomRow = document.createElement('div'); bottomRow.className = 'seat-row';
            for (let i = 1; i <= table.size; i++) {
                const seat = createSeatSlot(table, i);
                if (i <= Math.ceil(table.size / 2)) topRow.appendChild(seat);
                else bottomRow.appendChild(seat);
            }
            seatsDiv.appendChild(topRow);
            seatsDiv.appendChild(bottomRow);
        }

        overlay.appendChild(seatsDiv);
        floorplanWrapper.appendChild(overlay);
    });
}

function createSeatSlot(table, seatNum) {
    const el = document.createElement('div');
    el.className = 'seat-slot';
    el.dataset.table = table.id;
    el.dataset.seat = seatNum;
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDropToSeat);

    const guest = allGuests.find(g => String(g.Table) === String(table.id) && String(g.Seat) === String(seatNum));
    if (guest) el.appendChild(createGuestCard(guest, true));
    return el;
}

function createGuestCard(guest, isSeat = false) {
    const el = document.createElement('div');
    el.className = 'guest-card';
    el.draggable = true;
    el.dataset.name = guest.Name;
    el.dataset.origTable = guest.Table || '';
    el.dataset.origSeat = guest.Seat || '';
    el.innerHTML = `<div class="guest-name">${guest.Name}</div><div class="guest-note">${guest.Note || ''}</div>`;
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    if (isSeat) {
        el.addEventListener('mouseenter', (e) => showTooltip(e, guest));
        el.addEventListener('mouseleave', hideTooltip);
        el.addEventListener('mousemove', moveTooltip);
    }
    return el;
}

// ===== Guest Drag & Drop =====
function handleDragStart(e) {
    if (isDragMode) { e.preventDefault(); return; } // block during table drag mode
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('name', this.dataset.name);
    setTimeout(() => this.classList.add('dragging'), 0);
}
function handleDragEnd() { this.classList.remove('dragging'); document.querySelectorAll('.seat-slot.drag-over').forEach(el => el.classList.remove('drag-over')); }

window.handleDragOver = function (e) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (e.currentTarget.classList.contains('seat-slot')) e.currentTarget.classList.add('drag-over');
    return false;
};
function handleDragLeave() { this.classList.remove('drag-over'); }

function handleDropToSeat(e) {
    e.stopPropagation(); this.classList.remove('drag-over');
    const guestName = dragSrcEl.dataset.name;
    const targetTable = this.dataset.table, targetSeat = this.dataset.seat;
    const sourceTable = dragSrcEl.dataset.origTable, sourceSeat = dragSrcEl.dataset.origSeat;
    if (sourceTable === targetTable && sourceSeat === targetSeat) return;

    const existingIdx = allGuests.findIndex(g => g.Table === targetTable && String(g.Seat) === String(targetSeat));
    const movingIdx = allGuests.findIndex(g => g.Name === guestName);
    if (existingIdx > -1) { allGuests[existingIdx].Table = sourceTable; allGuests[existingIdx].Seat = sourceSeat; queueSave(allGuests[existingIdx]); }
    if (movingIdx > -1) { allGuests[movingIdx].Table = targetTable; allGuests[movingIdx].Seat = targetSeat; queueSave(allGuests[movingIdx]); }

    renderTables(); renderWaitlist(searchInput.value);
}

window.handleDropToWaitlist = function (e) {
    e.preventDefault(); e.stopPropagation();
    const guestName = dragSrcEl.dataset.name;
    const idx = allGuests.findIndex(g => g.Name === guestName);
    if (idx > -1 && allGuests[idx].Table) {
        allGuests[idx].Table = ''; allGuests[idx].Seat = '';
        queueSave(allGuests[idx]); renderTables(); renderWaitlist(searchInput.value);
    }
};

// ===== Save Queue =====
function queueSave(guest) {
    offlineQueue.push({ Name: guest.Name, Table: guest.Table, Seat: guest.Seat });
    localStorage.setItem('adminOfflineQueue', JSON.stringify(offlineQueue));
    processQueueThrottled();
}
let syncTimeout;
function processQueueThrottled() { setSyncStatus('syncing', '正在同步... ⏳'); clearTimeout(syncTimeout); syncTimeout = setTimeout(() => processQueue(), 1000); }

async function processQueue() {
    if (!navigator.onLine) { setSyncStatus('offline', '❌ 離線（已暫存）'); return; }
    if (offlineQueue.length === 0) { setSyncStatus('saved', '✅ 已同步至草稿'); return; }
    const item = offlineQueue[0];
    const res = await gasRequest('update_temp_row', item);
    if (res.success) { offlineQueue.shift(); localStorage.setItem('adminOfflineQueue', JSON.stringify(offlineQueue)); processQueue(); }
    else { setSyncStatus('offline', '❌ 儲存失敗'); }
}
window.addEventListener('online', processQueue);
window.addEventListener('offline', () => setSyncStatus('offline', '❌ 離線（已暫存）'));

function setSyncStatus(state, text) { syncStatus.className = `status-badge status-${state}`; syncStatus.textContent = text; }

// ===== Utilities =====
searchInput.addEventListener('input', (e) => renderWaitlist(e.target.value));

function showTooltip(e, guest) { ttName.textContent = guest.Name; ttNote.textContent = guest.Note || '無備註'; tooltip.classList.add('show'); moveTooltip(e); }
function hideTooltip() { tooltip.classList.remove('show'); }
function moveTooltip(e) { tooltip.style.left = e.pageX + 'px'; tooltip.style.top = (e.pageY - 10) + 'px'; }

window.openModal = function (id) { document.getElementById(id).classList.add('active'); };
window.closeModal = function (id) { document.getElementById(id).classList.remove('active'); };

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== Toolbar Actions =====
document.getElementById('btn-publish').addEventListener('click', () => openModal('publish-modal'));
document.getElementById('btn-reset').addEventListener('click', () => openModal('reset-modal'));

document.getElementById('confirm-publish-btn').addEventListener('click', async () => {
    closeModal('publish-modal'); setSyncStatus('syncing', '正在發佈...');
    const res = await gasRequest('publish_to_confirm', { dummy: true });
    if (res.success) { showToast("發佈成功！"); setSyncStatus('saved', '✅ 已同步'); }
    else { showToast("發佈失敗", "error"); setSyncStatus('offline', '❌ 發佈失敗'); }
});

document.getElementById('confirm-reset-btn').addEventListener('click', async () => {
    closeModal('reset-modal'); setSyncStatus('syncing', '正在重置...');
    allGuests.forEach(g => { g.Table = ''; g.Seat = ''; });
    searchInput.value = ''; renderAll();
    const res = await gasRequest('clear_temp', { dummy: true });
    if (res.success) { showToast('草稿區已清空'); setSyncStatus('saved', '✅ 已同步至草稿'); offlineQueue = []; localStorage.removeItem('adminOfflineQueue'); }
    else { showToast('重置失敗', 'error'); setSyncStatus('offline', '❌ 同步失敗'); }
});

// ==========================================================
//  Settings Panel
// ==========================================================
document.getElementById('btn-settings').addEventListener('click', () => settingsPanel.classList.toggle('open'));
document.getElementById('settings-close').addEventListener('click', () => settingsPanel.classList.remove('open'));

// Apply table count + seats-per-table
document.getElementById('btn-apply-config').addEventListener('click', () => {
    const newSeats = parseInt(inputSeats.value) || DEFAULT_SEATS;
    const newCount = parseInt(inputTables.value) || DEFAULT_TABLE_COUNT;
    const newShape = inputShape.value;

    seatsPerTable = Math.max(2, Math.min(12, newSeats));
    tableCount = Math.max(1, Math.min(50, newCount));
    tableShape = newShape;

    localStorage.setItem('adminSeatsPerTable', seatsPerTable);
    localStorage.setItem('adminTableCount', tableCount);
    localStorage.setItem('adminTableShape', tableShape);

    inputSeats.value = seatsPerTable;
    inputTables.value = tableCount;

    TABLES_CONFIG = generateTablesConfig();
    renderTables();
    const shapeLabel = tableShape === 'round' ? '圓桌' : '長桌';
    showToast(`已套用：${tableCount} ${shapeLabel} × ${seatsPerTable} 座`, 'success');
});

// Reset positions to defaults
document.getElementById('btn-reset-positions').addEventListener('click', () => {
    savedPositions = {};
    localStorage.removeItem('adminTablePositions');
    TABLES_CONFIG = generateTablesConfig();
    renderTables();
    showToast('座標已重置為預設', 'success');
});

// ==========================================================
//  Drag Mode — reposition tables on floorplan
// ==========================================================
let isDragMode = false;
let tableDragTarget = null;
let tableDragOffset = { x: 0, y: 0 };

dragModeToggle.addEventListener('change', () => {
    isDragMode = dragModeToggle.checked;
    floorplanWrapper.classList.toggle('drag-mode', isDragMode);
    dragBanner.classList.toggle('active', isDragMode);
});

// Mousedown on a table-overlay → start dragging
floorplanWrapper.addEventListener('mousedown', (e) => {
    if (!isDragMode) return;
    const overlay = e.target.closest('.table-overlay');
    if (!overlay) return;

    e.preventDefault();
    tableDragTarget = overlay;
    tableDragTarget.style.zIndex = '999';

    const wrapRect = floorplanWrapper.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    // offset from mouse to center of overlay
    const centerX = overlayRect.left + overlayRect.width / 2;
    const centerY = overlayRect.top + overlayRect.height / 2;
    tableDragOffset.x = e.clientX - centerX;
    tableDragOffset.y = e.clientY - centerY;
});

document.addEventListener('mousemove', (e) => {
    if (!tableDragTarget) return;
    e.preventDefault();

    const rect = floorplanWrapper.getBoundingClientRect();
    // new center position in pixels (relative to wrapper)
    const cx = e.clientX - tableDragOffset.x - rect.left;
    const cy = e.clientY - tableDragOffset.y - rect.top;

    // convert to percentage, clamp 0–100
    const px = Math.max(0, Math.min(100, (cx / rect.width) * 100));
    const py = Math.max(0, Math.min(100, (cy / rect.height) * 100));

    tableDragTarget.style.left = px.toFixed(1) + '%';
    tableDragTarget.style.top = py.toFixed(1) + '%';
});

document.addEventListener('mouseup', () => {
    if (!tableDragTarget) return;

    const tableId = tableDragTarget.id.replace('table-', '');
    const newX = parseFloat(tableDragTarget.style.left);
    const newY = parseFloat(tableDragTarget.style.top);

    // Persist position
    savedPositions[tableId] = { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
    localStorage.setItem('adminTablePositions', JSON.stringify(savedPositions));

    // Update config
    const cfg = TABLES_CONFIG.find(t => t.id === tableId);
    if (cfg) { cfg.x = savedPositions[tableId].x; cfg.y = savedPositions[tableId].y; }

    tableDragTarget.style.zIndex = '';
    tableDragTarget = null;
});

// ===== Boot =====
document.addEventListener('DOMContentLoaded', checkAuth);
