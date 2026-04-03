// --- Constants ---
const API_BASE = 'https://api.vaktija.ba/vaktija/v1';
const PRAYER_NAMES = ['Zora', 'Izlazak sunca', 'Podne', 'Ikindija', 'Akšam', 'Jacija'];
const TIME_IDS = ['time-zora', 'time-izlazak', 'time-podne', 'time-ikindija', 'time-aksam', 'time-jacija'];
const DEFAULT_LOCATION_ID = 77; // Sarajevo
const STORAGE_KEY = 'vaktija_location_id';

// --- State ---
let vakatTimes = [];
let locationId = parseInt(localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCATION_ID, 10);
let clockInterval = null;
let currentDate = '';

// --- DOM Elements ---
const locationNameEl = document.getElementById('location-name');
const currentDateEl = document.getElementById('current-date');
const currentClockEl = document.getElementById('current-clock');
const nextPrayerInfoEl = document.getElementById('next-prayer-info');
const prayerEls = document.querySelectorAll('.prayer');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const citySelect = document.getElementById('city-select');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// --- API Calls ---
async function fetchLocations() {
    try {
        const res = await fetch(`${API_BASE}/lokacije`);
        const locations = await res.json();
        return locations; // Array of city name strings
    } catch (e) {
        console.error('Could not fetch locations:', e);
        return [];
    }
}

async function fetchPrayerTimes(id) {
    try {
        const res = await fetch(`${API_BASE}/${id}`);
        if (!res.ok) throw new Error('Network response was not ok');
        return await res.json();
    } catch (e) {
        console.error('Could not fetch prayer times:', e);
        return null;
    }
}

// --- UI Rendering ---
function renderPrayerTimes(data) {
    if (!data) return;

    locationNameEl.textContent = data.lokacija;
    currentDateEl.textContent = data.datum[1];
    vakatTimes = data.vakat;
    currentDate = data.datum[1];

    data.vakat.forEach((time, i) => {
        document.getElementById(TIME_IDS[i]).textContent = time;
    });

    updateActivePrayer();
}

function getNextPrayerIndex() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < vakatTimes.length; i++) {
        const [h, m] = vakatTimes[i].split(':').map(Number);
        const prayerMinutes = h * 60 + m;
        if (nowMinutes < prayerMinutes) {
            return i;
        }
    }
    // Past all prayers today — next is Zora tomorrow
    return 0;
}

function getTimeUntil(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    if (target <= now) {
        // It's tomorrow
        target.setDate(target.getDate() + 1);
    }

    const diff = target - now;
    const totalMins = Math.floor(diff / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function updateActivePrayer() {
    if (vakatTimes.length === 0) return;

    const nextIdx = getNextPrayerIndex();

    prayerEls.forEach((el, i) => {
        el.classList.toggle('active', i === nextIdx);
    });

    const nextName = PRAYER_NAMES[nextIdx];
    const nextTime = vakatTimes[nextIdx];
    const timeUntil = getTimeUntil(nextTime);

    nextPrayerInfoEl.textContent = `${nextName} za ${timeUntil} (${nextTime})`;
}

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    currentClockEl.textContent = `${h}:${m}:${s}`;
    updateActivePrayer();

    // Refresh data at midnight
    const isNewDay = now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 2;
    if (isNewDay) {
        loadData(locationId);
    }
}

// --- Settings Modal ---
async function populateCityDropdown() {
    const locations = await fetchLocations();

    if (locations.length === 0) {
        citySelect.innerHTML = '<option>Greška pri učitavanju</option>';
        return;
    }

    citySelect.innerHTML = '';
    locations.forEach((city, i) => {
        const option = document.createElement('option');
        // API uses 0-based location IDs
        option.value = i;
        option.textContent = city;
        if (i === locationId) option.selected = true;
        citySelect.appendChild(option);
    });
}

settingsBtn.addEventListener('click', () => {
    populateCityDropdown();
    settingsModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.add('hidden');
    }
});

saveSettingsBtn.addEventListener('click', () => {
    const newId = parseInt(citySelect.value, 10);
    locationId = newId;
    localStorage.setItem(STORAGE_KEY, newId);
    settingsModal.classList.add('hidden');
    // Clear stale times immediately so the UI doesn't show the old city
    vakatTimes = [];
    TIME_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '--:--';
    });
    nextPrayerInfoEl.textContent = '';
    loadData(newId);
});

// --- Bootstrap ---
async function loadData(id) {
    locationNameEl.textContent = 'Učitavanje...';
    const data = await fetchPrayerTimes(id);
    renderPrayerTimes(data);
}

function init() {
    loadData(locationId);

    if (clockInterval) clearInterval(clockInterval);
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

// Service Worker registered in index.html <head> for early detection.

init();
