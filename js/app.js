// Trip planner — load content/trip-data.json over HTTP (GitHub Pages or a local static server).

let APP_VERSION;
let VERSIONS;
let DAYS_CQ, DAYS_XJ1, DAYS_XJ2;

function allItineraryDays() {
  return [...(DAYS_CQ || []), ...(DAYS_XJ1 || []), ...(DAYS_XJ2 || [])];
}
let STAYS, CHECKLIST, CL_META, COSTS, TIPS;
let TRIP_META = {};
let MAPS_DATA = {};
let PAGE_SEED = {};
let UI_EN = {};
let UI_ZH = {};
let DOM_DEFAULT_HTML = {};
let FLIGHTS = [];
let FLIGHTS_LIVE = null;
let flightUserExtras = [];
let flightHiddenIds = new Set();
let flightEdits = {};
let flightModalEditingId = null;
let _flightCardDotsObserver = null;
const FLIGHT_OVERLAY_KEY = 'tripleFlightOverlay';
const FLIGHT_BOARD_COLLAPSED_KEY = 'tripleFlightBoardCollapsed';
const CL_SORT_KEY = 'tripleClSort';
const LANG_KEY = 'tripleUiLang';
const BACKUP_FORMAT = 'triple-backup';
const BACKUP_VERSION = 1;
const ADD_TO_HOME_DISMISSED_KEY = 'tripAddToHomeDismissed';
/** All localStorage keys owned by the app that should round-trip in backup / restore. */
const TRIPLE_BACKUP_KEYS = [
  FLIGHT_OVERLAY_KEY,
  FLIGHT_BOARD_COLLAPSED_KEY,
  'checklistState',
  'tripHistory',
  'tripFreshSnapshot',
  'tripAppVersion',
  'tripAuthToken',
  'tripWelcomeSeen',
  'tripLastSeenVersion',
  ADD_TO_HOME_DISMISSED_KEY,
  CL_SORT_KEY,
  LANG_KEY,
];

let APP_LANG = 'en';

function loadLangPreference() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

APP_LANG = loadLangPreference();

function Tx(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (APP_LANG === 'zh') return v.zh != null ? String(v.zh) : String(v.en != null ? v.en : '');
    return v.en != null ? String(v.en) : String(v.zh != null ? v.zh : '');
  }
  return String(v);
}

function Ui(key) {
  const b = APP_LANG === 'zh' ? UI_ZH : UI_EN;
  const fb = UI_ENGLISH_FALLBACK_LOOKUP(key);
  return (b[key] != null ? b[key] : UI_EN[key]) || fb || key;
}

function UI_ENGLISH_FALLBACK_LOOKUP(key) {
  switch (key) {
    case 'flight.modal.titleAdd':
      return 'Add flight';
    case 'flight.modal.titleEdit':
      return 'Edit flight';
    case 'flight.err.depAp':
      return 'Enter both airport codes (3 letters) and a departure date & time. Use the suggestions list or type a valid IATA code.';
    case 'flight.modal.titleAdd':
      return 'Add flight';
    case 'flight.modal.titleEdit':
      return 'Edit flight';
    case 'flight.saveChanges':
      return 'Save changes';
    default:
      return '';
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Two inline spans toggled via refreshLangClasses — keeps markup out of gigantic index.html blobs. */
function lngMarkup(pair) {
  const o = typeof pair === 'object' && pair.en != null ? pair : { en: String(pair), zh: String(pair) };
  return (
    `<span class="trip-lng trip-lng--en"${APP_LANG === 'zh' ? ' hidden' : ''}>${escapeHtml(o.en)}</span>` +
    `<span class="trip-lng trip-lng--zh"${APP_LANG === 'zh' ? '' : ' hidden'}>${escapeHtml(o.zh)}</span>`
  );
}

function refreshLangClasses() {
  const zh = APP_LANG === 'zh';
  document.documentElement.lang = zh ? 'zh-Hans' : 'en';
  document.querySelectorAll('.trip-lng--en').forEach((el) => {
    el.hidden = zh;
  });
  document.querySelectorAll('.trip-lng--zh').forEach((el) => {
    el.hidden = !zh;
  });
}

function applyUiAnchors() {
  document.querySelectorAll('[data-ui]').forEach((el) => {
    const key = el.getAttribute('data-ui');
    const v = Ui(key);
    if (v == null) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = v;
    else if (/</.test(v)) el.innerHTML = v;
    else el.textContent = v;
  });
}

function refreshLangSidebarToggle() {
  const enBtn = document.getElementById('lang-btn-en');
  const zhBtn = document.getElementById('lang-btn-zh');
  if (enBtn) enBtn.classList.toggle('lang-btn--active', APP_LANG !== 'zh');
  if (zhBtn) zhBtn.classList.toggle('lang-btn--active', APP_LANG === 'zh');
}

function rerenderTripText() {
  renderDays(DAYS_CQ, 'days-cq');
  renderDays(DAYS_XJ1, 'days-xj1');
  renderDays(DAYS_XJ2, 'days-xj2');
  renderStays();
  renderCostTable();
  renderTips();
  renderChecklist();
  refreshFlightChromeI18n();
  renderTripCountdownBanner();
  updateCharts();
  renderFlights();
  updateFlightBoardToggleLabelOnly();
}

window.setTripLang = function setTripLang(lang) {
  APP_LANG = lang === 'zh' ? 'zh' : 'en';
  try {
    localStorage.setItem(LANG_KEY, APP_LANG);
  } catch (_) { /* ignore */ }
  refreshLangClasses();
  applyUiAnchors();
  refreshLangSidebarToggle();
  refreshPlannerChromeI18n();
  rerenderTripText();
};
const FLIGHT_PATCH_KEYS = [
  'airline',
  'airlineCode',
  'flightDigits',
  'flightNo',
  'depAirport',
  'arrAirport',
  'departureUtc',
  'arrivalUtc',
  'connectionKind',
  'connAirlineCode',
  'connFlightDigits',
  'connDepAirport',
  'connArrAirport',
  'connDepartureUtc',
  'connArrivalUtc',
];
const FLIGHT_CONN_ORDER = ['direct', 'same_pnr', 'self_transfer', 'overnight', 'open_jaw'];

function refreshFlightConnectionSelect() {
  const sel = document.getElementById('flight-f-connection');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = FLIGHT_CONN_ORDER.map(
    k => `<option value="${k}">${escapeHtml(Ui('flight.conn.' + k))}</option>`,
  ).join('');
  if (FLIGHT_CONN_ORDER.includes(cur)) sel.value = cur;
  else sel.value = 'direct';
  updateConnectionFormVisibility();
}

function refreshFlightModalI18n() {
  document.querySelectorAll('#flightAddModal .flight-modal-label[data-ui]').forEach(el => {
    const key = el.getAttribute('data-ui');
    el.textContent = Ui(key || '');
  });
  document.querySelectorAll('#flightAddModal .flight-modal-input[data-ui-ph]').forEach(el => {
    const key = el.getAttribute('data-ui-ph');
    el.placeholder = Ui(key || '');
  });
  const sub = document.getElementById('flight-modal-sub');
  if (sub && sub.hasAttribute('data-ui')) sub.textContent = Ui(sub.getAttribute('data-ui'));
  const connTitle = document.querySelector('#flight-conn-block .flight-conn-block-title');
  if (connTitle && connTitle.hasAttribute('data-ui')) connTitle.textContent = Ui(connTitle.getAttribute('data-ui'));
  const c1 = document.getElementById('flight-modal-cancel');
  if (c1 && c1.hasAttribute('data-ui')) c1.textContent = Ui(c1.getAttribute('data-ui'));
  const c2 = document.getElementById('flight-modal-submit');
  if (c2 && c2.hasAttribute('data-ui')) c2.textContent = Ui(c2.getAttribute('data-ui'));
}

function formatSidebarBadgeSub(tm) {
  const days =
    tm && tm.totalDays != null ? String(tm.totalDays) : String(allItineraryDays().length);
  const people = tm && tm.groupSize != null ? String(tm.groupSize) : '4';
  let s = Ui('badge.sub');
  return s.replace(/\{days\}/g, days).replace(/\{people\}/g, people);
}

function wireChromeAriaLabels() {
  const tripTools = Ui('menu.ariaTripTools');
  ['mobileTopCog', 'desktopTopCog'].forEach(id => {
    const el = document.getElementById(id);
    if (el && tripTools) el.setAttribute('aria-label', tripTools);
  });
  const pdfLbl = Ui('menu.ariaPdf');
  document.querySelectorAll('.sb-pdf-btn, .mobile-header-pdf').forEach(el => {
    if (pdfLbl) el.setAttribute('aria-label', pdfLbl);
  });
}

function refreshPlannerChromeI18n() {
  const tm = TRIP_META || {};
  const sym = tm.currencySymbol || '¥';

  document.querySelectorAll('[data-trip-badge]').forEach(el => {
    el.textContent = Ui('badge.private');
  });
  document.querySelectorAll('[data-trip-sb-sub]').forEach(el => {
    el.textContent = formatSidebarBadgeSub(tm);
  });

  const ppStat = document.querySelector('.stat-lbl[data-stat-key="pp"]');
  if (ppStat) {
    ppStat.textContent = (Ui('stat.pp') || '').replace(/\{cur\}/g, sym);
  }

  document.querySelectorAll('[data-ui-tools]').forEach(el => {
    const k = el.getAttribute('data-ui-tools');
    if (k) el.textContent = Ui(k);
  });

  refreshFlightChromeI18n();
  refreshFlightModalI18n();
  refreshFlightConnectionSelect();

  ['mobile-header-title-inner', 'auth-title-trip'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.hasAttribute('data-ui-html')) return;
    el.innerHTML = Ui(el.getAttribute('data-ui-html'));
  });

  syncEditToolbarButton();
  wireChromeAriaLabels();
}

/** Lock page scroll while any modal (or the auth gate) is visible. */
let modalScrollLockActive = false;
let modalScrollLockY = 0;

function modalBlockingOverlayCount() {
  let n = document.querySelectorAll('.modal-overlay.open').length;
  const auth = document.getElementById('auth-overlay');
  if (auth && !auth.classList.contains('hidden')) n += 1;
  return n;
}

/** Scrollable app column (not `window` — avoids elastic overscroll past fixed chrome). */
function getMainScrollEl() {
  return document.querySelector('main.main');
}

function syncModalScrollLock() {
  const mainEl = getMainScrollEl();
  const n = modalBlockingOverlayCount();
  if (n > 0) {
    if (!modalScrollLockActive) {
      modalScrollLockY = mainEl ? mainEl.scrollTop : window.scrollY || window.pageYOffset || 0;
      modalScrollLockActive = true;
      document.documentElement.classList.add('modal-scroll-lock');
      document.body.classList.add('modal-scroll-lock');
      if (mainEl) {
        mainEl.classList.add('modal-scroll-lock');
        const narrow = window.matchMedia('(max-width:768px)').matches;
        mainEl.style.setProperty('position', 'fixed');
        mainEl.style.setProperty('top', `-${modalScrollLockY}px`);
        if (narrow) {
          mainEl.style.setProperty('left', '0');
          mainEl.style.setProperty('right', '0');
          mainEl.style.setProperty('width', '100%');
        } else {
          mainEl.style.setProperty('left', 'var(--sidebar)');
          mainEl.style.setProperty('right', '0');
          mainEl.style.setProperty('width', 'auto');
        }
      } else {
        document.body.style.setProperty('position', 'fixed');
        document.body.style.setProperty('width', '100%');
        document.body.style.setProperty('top', `-${modalScrollLockY}px`);
      }
    }
  } else if (modalScrollLockActive) {
    modalScrollLockActive = false;
    document.documentElement.classList.remove('modal-scroll-lock');
    document.body.classList.remove('modal-scroll-lock');
    if (mainEl) {
      mainEl.classList.remove('modal-scroll-lock');
      mainEl.style.removeProperty('position');
      mainEl.style.removeProperty('top');
      mainEl.style.removeProperty('left');
      mainEl.style.removeProperty('right');
      mainEl.style.removeProperty('width');
      mainEl.scrollTop = modalScrollLockY;
    } else {
      document.body.style.removeProperty('position');
      document.body.style.removeProperty('width');
      document.body.style.removeProperty('top');
      window.scrollTo(0, modalScrollLockY);
    }
  }
}

function initModalScrollLockObservers() {
  const mo = new MutationObserver(() => syncModalScrollLock());
  document.querySelectorAll('.modal-overlay').forEach(el =>
    mo.observe(el, { attributes: true, attributeFilter: ['class'] })
  );
  const auth = document.getElementById('auth-overlay');
  if (auth) mo.observe(auth, { attributes: true, attributeFilter: ['class'] });
  syncModalScrollLock();
}
let _tripCountdownTick = null;
let TRIP_COUNTDOWN_META = null;

function contentUrl(path) {
  const base = document.baseURI || window.location.href;
  return new URL(path.replace(/^\//, ''), base).href;
}

async function loadTripData() {
  const res = await fetch(contentUrl('content/trip-data.json'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`trip-data.json HTTP ${res.status}`);
  const d = await res.json();
  APP_VERSION = d.appVersion;
  VERSIONS = d.versions;
  DAYS_CQ =
    Array.isArray(d.itinerary && d.itinerary.chongqing)
      ? d.itinerary.chongqing
      : Array.isArray(d.itinerary && d.itinerary.cq)
      ? d.itinerary.cq
      : [];
  const itin = d.itinerary || {};
  if (Array.isArray(itin.xinjiangNorth) || Array.isArray(itin.xinjiangSouth)) {
    DAYS_XJ1 = Array.isArray(itin.xinjiangNorth) ? itin.xinjiangNorth : [];
    DAYS_XJ2 = Array.isArray(itin.xinjiangSouth) ? itin.xinjiangSouth : [];
  } else {
    const legacyXj = Array.isArray(itin.xinjiang) ? itin.xinjiang : Array.isArray(itin.xj) ? itin.xj : [];
    DAYS_XJ1 = legacyXj;
    DAYS_XJ2 = [];
  }
  STAYS = d.stays || [];
  CHECKLIST = d.checklist || [];
  CL_META = d.clMeta || {};
  COSTS = d.costs || [];
  TIPS = d.tips || [];
  FLIGHTS = Array.isArray(d.flights) ? d.flights : [];
  UI_EN = d.ui && typeof d.ui.en === 'object' ? d.ui.en : {};
  UI_ZH = d.ui && typeof d.ui.zh === 'object' ? d.ui.zh : {};
  TRIP_META =
    d.tripMeta && typeof d.tripMeta === 'object'
      ? d.tripMeta
      : { currencySymbol: '¥', groupSize: 4, totalDays: 14, statDrivingKmApprox: '~', statBudgetApprox: '~¥' };
  MAPS_DATA = d.mapsData && typeof d.mapsData === 'object' ? d.mapsData : {};
  PAGE_SEED = d.pageSeed && typeof d.pageSeed === 'object' ? d.pageSeed : {};
  TRIP_COUNTDOWN_META = d.tripCountdown && typeof d.tripCountdown === 'object' ? d.tripCountdown : null;
}

/** IATA → { code, city, name, lat?, lng? }; loaded from content/airports.json */
const AIRPORT_BY_CODE = new Map();
let AIRPORT_SEARCH_ROWS = [];
let AIRLINE_SEARCH_ROWS = [];

async function loadAirports() {
  AIRPORT_BY_CODE.clear();
  AIRPORT_SEARCH_ROWS = [];
  try {
    const res = await fetch(contentUrl('content/airports.json'), { cache: 'no-store' });
    if (!res.ok) return;
    const d = await res.json();
    if (!d || !Array.isArray(d.a)) return;
    const rows = [];
    for (const row of d.a) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const code = String(row[0] || '').trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) continue;
      const city = String(row[1] || '').trim() || code;
      const name = String(row[2] || '').trim() || city;
      if (AIRPORT_BY_CODE.has(code)) continue;
      let lat = null;
      let lng = null;
      if (row.length >= 5 && typeof row[3] === 'number' && typeof row[4] === 'number') {
        lat = row[3];
        lng = row[4];
      }
      AIRPORT_BY_CODE.set(code, { code, city, name, lat, lng });
      rows.push({
        code,
        city,
        name,
        q: `${code} ${city} ${name}`.toLowerCase(),
      });
    }
    AIRPORT_SEARCH_ROWS = rows;
  } catch (e) {
    console.warn('[Triple] airports', e);
  }
}

function airportCityForCode(code) {
  if (code == null) return '';
  const u = String(code).trim().toUpperCase();
  if (!u) return '';
  const a = AIRPORT_BY_CODE.get(u);
  return a ? a.city : '';
}

function filterAirportSuggestions(query, limit = 12) {
  if (!AIRPORT_SEARCH_ROWS.length) return [];
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const row of AIRPORT_SEARCH_ROWS) {
    if (!row.q.includes(q)) continue;
    const lc = row.code.toLowerCase();
    const cy = row.city.toLowerCase();
    const ny = row.name.toLowerCase();
    let rank = 80;
    if (lc === q) rank = 0;
    else if (lc.startsWith(q)) rank = 1;
    else if (cy.startsWith(q)) rank = 2;
    else if (ny.startsWith(q)) rank = 3;
    else rank = 4 + row.q.indexOf(q);
    hits.push({ row, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.row.code.localeCompare(b.row.code));
  return hits.slice(0, limit).map(h => h.row);
}

function filterAirlineSuggestions(query, limit = 12) {
  if (!AIRLINE_SEARCH_ROWS.length) return [];
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const row of AIRLINE_SEARCH_ROWS) {
    if (!row.q.includes(q)) continue;
    const lc = row.c.toLowerCase();
    const nn = row.n.toLowerCase();
    let rank = 80;
    if (lc === q) rank = 0;
    else if (lc.startsWith(q)) rank = 1;
    else if (nn.startsWith(q)) rank = 2;
    else rank = 3 + row.q.indexOf(q);
    hits.push({ row, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.row.n.localeCompare(b.row.n));
  return hits.slice(0, limit).map(h => h.row);
}

function buildAirlineSearchIndex() {
  AIRLINE_SEARCH_ROWS = [];
  const list = Array.isArray(window.AIRLINE_OPTIONS) ? window.AIRLINE_OPTIONS : [];
  for (const entry of list) {
    const n = entry && String(entry.n || '').trim();
    const c = entry && String(entry.c || '').trim();
    if (!n || !c) continue;
    AIRLINE_SEARCH_ROWS.push({ n, c, q: `${n} ${c}`.toLowerCase() });
  }
}

function normalizeAirlineField(prefix) {
  const hid = document.getElementById(prefix + 'airline-code');
  const vis = document.getElementById(prefix + 'airline-search');
  if (!hid || !vis) return;
  if (hid.value && hid.value.trim()) return;
  const raw = vis.value.trim();
  if (!raw) return;
  const rows = filterAirlineSuggestions(raw, 6);
  if (rows.length === 1) {
    hid.value = rows[0].c;
    vis.value = `${rows[0].n} (${rows[0].c})`;
    return;
  }
  const up = raw.toUpperCase();
  const list = window.AIRLINE_OPTIONS || [];
  const byCode = list.find(a => a.c === up);
  if (byCode) {
    hid.value = byCode.c;
    vis.value = `${byCode.n} (${byCode.c})`;
    return;
  }
  const byName = list.find(a => a.n.toLowerCase() === raw.toLowerCase());
  if (byName) {
    hid.value = byName.c;
    vis.value = `${byName.n} (${byName.c})`;
  }
}

function flightCardCityTagline(m) {
  const c0 = airportCityForCode(m && m.depAirport);
  const c1 = airportCityForCode(m && m.arrAirport);
  const dCode = (m && m.depAirport && String(m.depAirport).trim()) || '';
  const aCode = (m && m.arrAirport && String(m.arrAirport).trim()) || '';
  const from = c0 || dCode;
  const to = c1 || aCode;
  if (!from && !to) return '';
  if (!from || !to) return '';
  if (from === to) return '';
  return `${from} to ${to}`;
}

function closeFlightAirlineList(input) {
  const wrap = input && input.closest && input.closest('.airline-ac-wrap');
  const list = wrap && wrap.querySelector('.airline-ac-list');
  if (!list) return;
  list.hidden = true;
  list.innerHTML = '';
  delete input.dataset.acIdx;
}

function renderFlightAirlineList(input) {
  const wrap = input.closest('.airline-ac-wrap');
  const list = wrap && wrap.querySelector('.airline-ac-list');
  if (!list) return;
  const rows = filterAirlineSuggestions(input.value, 12);
  if (!rows.length) {
    list.hidden = true;
    list.innerHTML = '';
    return;
  }
  list.innerHTML = rows
    .map(r => {
      const label = `${r.n} (${r.c})`;
      return `<li><button type="button" class="airport-ac-item" role="option" data-code="${flightEsc(r.c)}" data-label="${flightEsc(label)}"><span class="airport-ac-code">${flightEsc(r.c)}</span><span class="airport-ac-meta"><span class="airport-ac-city">${flightEsc(r.n)}</span></span></button></li>`;
    })
    .join('');
  list.hidden = false;
  delete input.dataset.acIdx;
}

function closeAllFlightModalTypeaheads() {
  document.querySelectorAll('#flightAddModal .airport-ac-input').forEach(el => closeFlightAirportList(el));
  document.querySelectorAll('#flightAddModal .airline-ac-input').forEach(el => closeFlightAirlineList(el));
}

function closeFlightAirportList(input) {
  const wrap = input && input.closest && input.closest('.airport-ac-wrap');
  const list = wrap && wrap.querySelector('.airport-ac-list');
  if (!list) return;
  list.hidden = true;
  list.innerHTML = '';
  delete input.dataset.acIdx;
}

function renderFlightAirportList(input) {
  const wrap = input.closest('.airport-ac-wrap');
  const list = wrap && wrap.querySelector('.airport-ac-list');
  if (!list) return;
  const rows = filterAirportSuggestions(input.value, 12);
  if (!rows.length) {
    list.hidden = true;
    list.innerHTML = '';
    return;
  }
  list.innerHTML = rows
    .map(
      r =>
        `<li><button type="button" class="airport-ac-item" role="option" data-code="${flightEsc(r.code)}"><span class="airport-ac-code">${flightEsc(r.code)}</span><span class="airport-ac-meta"><span class="airport-ac-city">${flightEsc(r.city)}</span><span class="airport-ac-name">${flightEsc(r.name)}</span></span></button></li>`
    )
    .join('');
  list.hidden = false;
  delete input.dataset.acIdx;
}

function highlightFlightTypeaheadItem(input, delta) {
  const wrap = input.closest('.airport-ac-wrap, .airline-ac-wrap');
  const list = wrap && wrap.querySelector('.airport-ac-list, .airline-ac-list');
  if (!list || list.hidden) return;
  const buttons = [...list.querySelectorAll('.airport-ac-item')];
  if (!buttons.length) return;
  let idx = parseInt(input.dataset.acIdx, 10);
  if (Number.isNaN(idx)) idx = -1;
  idx = Math.max(-1, Math.min(buttons.length - 1, idx + delta));
  input.dataset.acIdx = String(idx);
  buttons.forEach((b, i) => b.classList.toggle('airport-ac-item--sel', i === idx));
  if (idx >= 0) buttons[idx].scrollIntoView({ block: 'nearest' });
}

function initFlightModalTypeahead() {
  const modal = document.getElementById('flightAddModal');
  if (!modal || modal.dataset.acInit === '1') return;
  modal.dataset.acInit = '1';
  modal.addEventListener('input', e => {
    const t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains('airport-ac-input')) renderFlightAirportList(t);
    if (t.classList.contains('airline-ac-input')) {
      const hid = document.getElementById(t.id.replace(/search$/, 'code'));
      if (hid && t.value.trim() === '') hid.value = '';
      renderFlightAirlineList(t);
    }
  });
  modal.addEventListener('mousedown', e => {
    const btn = e.target.closest('.airport-ac-item');
    if (!btn || !modal.contains(btn)) return;
    const airlineWrap = btn.closest('.airline-ac-wrap');
    if (airlineWrap) {
      const vis = airlineWrap.querySelector('.airline-ac-input');
      const hid = airlineWrap.querySelector('input[type="hidden"][id$="airline-code"]');
      if (vis && hid && btn.dataset.code != null) {
        e.preventDefault();
        hid.value = btn.dataset.code;
        vis.value = btn.dataset.label || '';
        closeFlightAirlineList(vis);
      }
      return;
    }
    const wrap = btn.closest('.airport-ac-wrap');
    const input = wrap && wrap.querySelector('.airport-ac-input');
    if (!input || !btn.dataset.code) return;
    e.preventDefault();
    input.value = btn.dataset.code;
    closeFlightAirportList(input);
  });
  modal.addEventListener('keydown', e => {
    const t = e.target;
    if (!t || !t.classList) return;
    const isAirport = t.classList.contains('airport-ac-input');
    const isAirline = t.classList.contains('airline-ac-input');
    if (!isAirport && !isAirline) return;
    const wrap = t.closest('.airport-ac-wrap, .airline-ac-wrap');
    const list = wrap && wrap.querySelector('.airport-ac-list, .airline-ac-list');
    const open = list && !list.hidden && list.querySelector('.airport-ac-item');
    if (e.key === 'ArrowDown') {
      if (!open) return;
      e.preventDefault();
      highlightFlightTypeaheadItem(t, 1);
    } else if (e.key === 'ArrowUp') {
      if (!open) return;
      e.preventDefault();
      highlightFlightTypeaheadItem(t, -1);
    } else if (e.key === 'Enter') {
      if (!open) return;
      let idx = parseInt(t.dataset.acIdx, 10);
      const buttons = [...list.querySelectorAll('.airport-ac-item')];
      if (!Number.isFinite(idx) || idx < 0) idx = 0;
      const b = buttons[idx];
      if (b && b.dataset.code) {
        if (isAirline) {
          const airlineWrap = t.closest('.airline-ac-wrap');
          const hid = airlineWrap && airlineWrap.querySelector('input[type="hidden"][id$="airline-code"]');
          if (hid) hid.value = b.dataset.code;
          t.value = b.dataset.label || '';
          closeFlightAirlineList(t);
        } else {
          t.value = b.dataset.code;
          closeFlightAirportList(t);
        }
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      if (list && !list.hidden) {
        e.preventDefault();
        if (isAirline) closeFlightAirlineList(t);
        else closeFlightAirportList(t);
      }
    }
  });
  modal.addEventListener('focusout', e => {
    const t = e.target;
    if (!t.classList) return;
    if (t.classList.contains('airport-ac-input')) {
      const wrap = t.closest('.airport-ac-wrap');
      const rel = e.relatedTarget;
      setTimeout(() => {
        if (rel && wrap && wrap.contains(rel)) return;
        closeFlightAirportList(t);
      }, 150);
    }
    if (t.classList.contains('airline-ac-input')) {
      const wrap = t.closest('.airline-ac-wrap');
      const rel = e.relatedTarget;
      const prefix = t.id.replace(/airline-search$/, '');
      setTimeout(() => {
        if (rel && wrap && wrap.contains(rel)) return;
        closeFlightAirlineList(t);
        normalizeAirlineField(prefix);
      }, 150);
    }
  });
}

async function refreshFlightsFromNetwork() {
  FLIGHTS_LIVE = null;
  try {
    const res = await fetch(contentUrl('content/flights-live.json'), { cache: 'no-store' });
    if (res.ok) FLIGHTS_LIVE = await res.json();
  } catch (e) {
    console.warn('[Triple] flights-live', e);
  }
}

function flightEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function formatFlightCardTime(dt) {
  try {
    return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function mergeLiveIntoFlight(base) {
  const u = (FLIGHTS_LIVE && FLIGHTS_LIVE.updates && FLIGHTS_LIVE.updates[base.id]) || {};
  return {
    ...base,
    departureUtc: u.departureUtc || base.departureUtc,
    arrivalUtc: u.arrivalUtc !== undefined ? u.arrivalUtc : base.arrivalUtc,
    status: u.status !== undefined ? u.status : base.status,
    gate: u.gate !== undefined ? u.gate : base.gate,
    terminal: u.terminal !== undefined ? u.terminal : base.terminal,
    delayMinutes: u.delayMinutes !== undefined ? u.delayMinutes : base.delayMinutes,
    checkIn: u.checkIn !== undefined ? u.checkIn : base.checkIn,
    liveNote: u.note !== undefined ? u.note : base.liveNote,
  };
}

function pickFlightPatch(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const o = {};
  for (const k of FLIGHT_PATCH_KEYS) {
    if (obj[k] !== undefined) o[k] = obj[k];
  }
  return o;
}

function applyEditsToFlight(f) {
  if (!f || !f.id || f.id.startsWith('u-')) return { ...f };
  const p = flightEdits[f.id];
  if (!p || typeof p !== 'object') return { ...f };
  return { ...f, ...pickFlightPatch(p) };
}

function enrichFlightRow(f) {
  const withEdit = f.id && f.id.startsWith('u-') ? { ...f } : applyEditsToFlight(f);
  return mergeLiveIntoFlight(withEdit);
}

function getEnrichedFlightRowsSorted() {
  const base = (FLIGHTS || []).filter(f => !flightHiddenIds.has(f.id)).map(f => ({ ...f }));
  const user = flightUserExtras.map(f => ({ ...f }));
  return [...base, ...user]
    .filter(f => f.departureUtc)
    .sort((a, b) => new Date(a.departureUtc) - new Date(b.departureUtc))
    .map(enrichFlightRow);
}

function getTripEndDate() {
  const m = TRIP_COUNTDOWN_META;
  if (m && m.end && m.end.year && m.end.month && m.end.day) {
    return new Date(m.end.year, m.end.month - 1, m.end.day);
  }
  const rows = getEnrichedFlightRowsSorted();
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const raw = last.arrivalUtc || last.departureUtc;
  const d = new Date(raw);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function updateConnectionFormVisibility() {
  const connSel = document.getElementById('flight-f-connection');
  const block = document.getElementById('flight-conn-block');
  if (!connSel || !block) return;
  block.hidden = connSel.value === 'direct';
}

function airlineNameFromSelect(prefix, code) {
  void prefix;
  if (!code) return '—';
  const list = window.AIRLINE_OPTIONS || [];
  const row = list.find(a => a.c === code);
  if (row) return row.n;
  return code;
}

function readAirlineCode(prefix) {
  const hid = document.getElementById(prefix + 'airline-code');
  const vis = document.getElementById(prefix + 'airline-search');
  let c = (hid && hid.value && hid.value.trim()) || '';
  if (c) return c.replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (vis && vis.value) {
    const t = vis.value.trim().toUpperCase();
    const m = t.match(/\(([A-Z0-9]{2,3})\)/);
    if (m) return m[1].replace(/[^A-Z0-9]/g, '').slice(0, 3);
    const compact = t.replace(/[^A-Z0-9]/g, '');
    if (compact.length >= 2) return compact.slice(0, 3);
  }
  return '';
}

function setAirlineFieldsFromModel(prefix, m) {
  const hid = document.getElementById(prefix + 'airline-code');
  const vis = document.getElementById(prefix + 'airline-search');
  if (!hid || !vis) return;
  const { code, digits } = deriveIataAndDigits({
    airlineCode: m && m.airlineCode,
    flightDigits: m && m.flightDigits,
    flightNo: m && m.flightNo,
  });
  if (code) {
    hid.value = code;
    const row = (window.AIRLINE_OPTIONS || []).find(a => a.c === code);
    vis.value = row ? `${row.n} (${row.c})` : code;
  } else {
    hid.value = '';
    vis.value = '';
  }
  const digEl = document.getElementById(prefix + 'flight-digits');
  if (digEl) digEl.value = digits || '';
}

function deriveIataAndDigits(m) {
  let code = (m.airlineCode && String(m.airlineCode).trim().toUpperCase()) || '';
  let digits =
    m.flightDigits != null && String(m.flightDigits).trim() !== ''
      ? String(m.flightDigits).replace(/\s/g, '')
      : '';
  if (!code || !digits) {
    const fn = String(m.flightNo || '').trim();
    const rx = /^([A-Z0-9]{2,3})\s*(\d{1,4}[A-Z]?)$/i;
    const mm = fn.match(rx);
    if (mm) {
      if (!code) code = mm[1].toUpperCase();
      if (!digits) digits = mm[2];
    }
  }
  return { code, digits };
}

function flightPillText(m) {
  const { code, digits } = deriveIataAndDigits(m);
  if (code && digits) return `${code} ${digits}`;
  const fn = String(m.flightNo || '').replace(/\s+/g, '');
  if (fn && fn !== '—') return fn;
  return '';
}

function flightPillHtml(m) {
  const t = flightPillText(m);
  if (!t) return '';
  const long = t.length > 10;
  return `<span class="flight-pill${long ? ' flight-pill--long' : ''}">${flightEsc(t)}</span>`;
}

function connPillText(m) {
  const code = (m.connAirlineCode && String(m.connAirlineCode).trim().toUpperCase()) || '';
  const digits =
    m.connFlightDigits != null && String(m.connFlightDigits).trim() !== ''
      ? String(m.connFlightDigits).replace(/\s/g, '')
      : '';
  if (code && digits) return `${code} ${digits}`;
  return '';
}

function connPillHtml(m) {
  const t = connPillText(m);
  if (!t) return '';
  const long = t.length > 10;
  return `<span class="flight-pill flight-pill--conn${long ? ' flight-pill--long' : ''}">${flightEsc(t)}</span>`;
}

function dayOffsetDepArr(depDt, arrDt) {
  if (!depDt || !arrDt || Number.isNaN(depDt.getTime()) || Number.isNaN(arrDt.getTime())) return 0;
  const a = new Date(depDt.getFullYear(), depDt.getMonth(), depDt.getDate());
  const b = new Date(arrDt.getFullYear(), arrDt.getMonth(), arrDt.getDate());
  return Math.round((b - a) / 86400000);
}

function formatFlightHeaderDate(dt) {
  try {
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatFlightClockShort(dt) {
  try {
    return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatFlightLegDay(dt) {
  try {
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatConnectionDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '';
  const totalMin = Math.round(ms / 60000);
  if (totalMin <= 0) return '<1m connection time';
  const h = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (h > 0 && mm > 0) return `${h}h ${mm}m connection time`;
  if (h > 0) return `${h}h connection time`;
  return `${mm}m connection time`;
}

function flightCardLegPairHtml(depAp, arrAp, depIso, arrIso) {
  const depT = depIso ? new Date(depIso) : null;
  const arrT = arrIso ? new Date(arrIso) : null;
  const depOk = depT && !Number.isNaN(depT.getTime());
  const arrOk = arrT && !Number.isNaN(arrT.getTime());
  const depDay = depOk ? formatFlightLegDay(depT) : '';
  const depClock = depOk ? formatFlightClockShort(depT) : '';
  const arrDay = arrOk ? formatFlightLegDay(arrT) : '';
  const arrClock = arrOk ? formatFlightClockShort(arrT) : '';
  const arrPlus =
    depOk && arrOk && dayOffsetDepArr(depT, arrT) > 0
      ? `<sup class="flight-card-plus">+${dayOffsetDepArr(depT, arrT)}</sup>`
      : '';
  return `<div class="flight-card-leg">
        <span class="flight-card-ico flight-card-ico--dep" aria-hidden="true">↗</span>
        <span class="flight-card-ap">${flightEsc(depAp || '—')}</span>
        <span class="flight-card-leg-meta">
          <span class="flight-card-dt">${flightEsc(depDay || '—')}</span>
          <span class="flight-card-tm">${flightEsc(depClock || '—')}</span>
        </span>
      </div>
      <div class="flight-card-leg">
        <span class="flight-card-ico flight-card-ico--arr" aria-hidden="true">↘</span>
        <span class="flight-card-ap">${flightEsc(arrAp || '—')}</span>
        <span class="flight-card-leg-meta">
          <span class="flight-card-dt">${arrOk ? flightEsc(arrDay || '—') : '—'}</span>
          <span class="flight-card-tm">${arrClock ? flightEsc(arrClock) + arrPlus : '—'}</span>
        </span>
      </div>`;
}

function flightCardConnectionFollowHtml(m) {
  const k = m.connectionKind || 'direct';
  if (k === 'direct') return '';
  const chunks = [];
  const { arrIso } = effectiveDepArr(m);
  const leg1EndIso =
    arrIso ||
    (m.arrivalUtc && String(m.arrivalUtc).trim()
      ? String(m.arrivalUtc).trim()
      : '');
  if (leg1EndIso && m.connDepartureUtc) {
    const gapMsRaw = new Date(m.connDepartureUtc).getTime() - new Date(leg1EndIso).getTime();
    const gapFmt = formatConnectionDurationMs(Math.max(0, gapMsRaw));
    if (gapFmt) chunks.push(`<div class="flight-card-conn-gap">${flightEsc(gapFmt)}</div>`);
  }
  if (!m.connDepartureUtc && !m.connArrivalUtc) return chunks.join('');

  const hubAp =
    (m.connArrAirport && m.connArrAirport.trim()) ||
    (m.connDepAirport && m.connDepAirport.trim()) ||
    '';
  const leg2ArrAp = (m.arrAirport && m.arrAirport.trim()) || '';
  const leg2DepAp = hubAp || leg2ArrAp || '—';
  const connP = connPillHtml(m);
  if (connP) chunks.push(`<div class="flight-card-conn-pill">${connP}</div>`);
  chunks.push(
    flightCardLegPairHtml(leg2DepAp, leg2ArrAp || '—', m.connDepartureUtc || '', m.connArrivalUtc || '')
  );
  return chunks.join('');
}

function flightCardMainHtml(m) {
  const { depIso, arrIso } = effectiveDepArr(m);
  const depT = new Date(depIso);
  const arrT = arrIso ? new Date(arrIso) : null;
  const headerDate = formatFlightHeaderDate(depT);
  const pill = flightPillHtml(m);
  const pillFallback =
    !pill && m.flightNo && String(m.flightNo).trim() && String(m.flightNo).trim() !== '—'
      ? `<span class="flight-pill">${flightEsc(String(m.flightNo).trim())}</span>`
      : '';
  const route = `${flightEsc(m.depAirport || '—')} to ${flightEsc(m.arrAirport || '—')}`;
  const cityLine = flightCardCityTagline(m);
  const tagline = cityLine ? `<div class="flight-card-tagline">${flightEsc(cityLine)}</div>` : '';
  const hasConn = m.connectionKind && m.connectionKind !== 'direct';
  const hubAp =
    hasConn &&
    ((m.connArrAirport && m.connArrAirport.trim()) || (m.connDepAirport && m.connDepAirport.trim()))
      ? (m.connArrAirport && m.connArrAirport.trim()) || (m.connDepAirport && m.connDepAirport.trim())
      : '';
  const leg1ArrAp = hubAp || m.arrAirport || '—';
  const leg1Block = flightCardLegPairHtml(m.depAirport || '—', leg1ArrAp, depIso, arrIso || '');
  const connectionFollow = flightCardConnectionFollowHtml(m);

  return `<div class="flight-card-hd">
      <span class="flight-card-star" aria-hidden="true">★</span>
      <div class="flight-card-hd-mid">${pill || pillFallback || `<span class="flight-card-no-fallback">${flightEsc('Flight')}</span>`}</div>
      <span class="flight-card-when">${flightEsc(headerDate || '—')}</span>
    </div>
    ${tagline}
    <div class="flight-card-route">${route}</div>
    <div class="flight-card-times">
      ${leg1Block}
      ${connectionFollow}
    </div>
    ${flightCardRouteMapHtml(m)}`;
}

function flightRouteAirportCodes(m) {
  const norm = c => {
    const u = (c && String(c).trim().toUpperCase()) || '';
    return /^[A-Z]{3}$/.test(u) ? u : null;
  };
  const out = [];
  const add = c => {
    const x = norm(c);
    if (x && (out.length === 0 || out[out.length - 1] !== x)) out.push(x);
  };
  add(m.depAirport);
  if (m.connectionKind && m.connectionKind !== 'direct') {
    add(m.connArrAirport);
    add(m.connDepAirport);
  }
  add(m.arrAirport);
  return out;
}

function flightRouteLatLngPoints(m) {
  const codes = flightRouteAirportCodes(m);
  const pts = [];
  for (const c of codes) {
    const info = AIRPORT_BY_CODE.get(c);
    if (!info || info.lat == null || info.lng == null) continue;
    pts.push({ code: c, lat: info.lat, lng: info.lng });
  }
  const deduped = [];
  for (const p of pts) {
    const last = deduped[deduped.length - 1];
    if (!last || last.lat !== p.lat || last.lng !== p.lng) deduped.push(p);
  }
  return deduped;
}

function flightCardRouteMapHtml(m) {
  const pts = flightRouteLatLngPoints(m);
  if (pts.length < 2) return '';
  const enc = encodeURIComponent(JSON.stringify(pts));
  return `<div class="flight-card-map-host" aria-hidden="true"><div class="flight-card-map" data-route="${enc}"></div></div>`;
}


/** Esri World Imagery (XYZ). Leaflet raster tiles work without WebGL (reliable on iOS PWA). */
const TRIP_SATELLITE_TILE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function tripToRad(d) {
  return (d * Math.PI) / 180;
}
function tripToDeg(r) {
  return (r * 180) / Math.PI;
}

/** Great-circle interpolation between [lng,lat] points, t ∈ [0,1] */
function tripGreatCircleInterpolate(a, b, t) {
  const [lng1, lat1] = [tripToRad(a[0]), tripToRad(a[1])];
  const [lng2, lat2] = [tripToRad(b[0]), tripToRad(b[1])];
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinLat2 = Math.sin(lat2);
  const cosLat2 = Math.cos(lat2);
  const dLng = lng2 - lng1;
  const c = Math.acos(Math.min(1, Math.max(-1, sinLat1 * sinLat2 + cosLat1 * cosLat2 * Math.cos(dLng))));
  if (c < 1e-10) return [a[0], a[1]];
  const sinC = Math.sin(c);
  const A = Math.sin((1 - t) * c) / sinC;
  const B = Math.sin(t * c) / sinC;
  const x = A * cosLat1 * Math.cos(lng1) + B * cosLat2 * Math.cos(lng2);
  const y = A * cosLat1 * Math.sin(lng1) + B * cosLat2 * Math.sin(lng2);
  const z = A * sinLat1 + B * sinLat2;
  const lat = Math.asin(Math.min(1, Math.max(-1, z)));
  const lng = Math.atan2(y, x);
  return [tripToDeg(lng), tripToDeg(lat)];
}

/** Dense [lng,lat] vertices along great-circle legs */
function tripGreatCircleLine(coords, stepsPerLeg) {
  const n = stepsPerLeg || 28;
  if (!coords || coords.length < 2) return coords || [];
  const out = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    for (let s = 0; s < n; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / n;
      out.push(tripGreatCircleInterpolate(a, b, t));
    }
  }
  out.push(coords[coords.length - 1]);
  return out;
}

/** [lng,lat][] → [lat,lng][] for Leaflet */
function tripLineLngLatToLeaflet(lngLatRing) {
  return lngLatRing.map(c => [c[1], c[0]]);
}

const _flightCardMiniMaps = [];

function teardownFlightCardMiniMaps() {
  for (const map of _flightCardMiniMaps) {
    try {
      map.remove();
    } catch (_) {
      /* ignore */
    }
  }
  _flightCardMiniMaps.length = 0;
}

function refreshFlightCardMiniMapSizes() {
  requestAnimationFrame(() => {
    for (const map of _flightCardMiniMaps) {
      try {
        map.invalidateSize();
      } catch (_) {
        /* ignore */
      }
    }
  });
}

function initFlightCardMiniMaps() {
  teardownFlightCardMiniMaps();
  if (typeof L === 'undefined') return;

  const tileOpts = { maxZoom: 19, attribution: '© Esri', crossOrigin: true };

  document.querySelectorAll('.flight-card-map[data-route]').forEach(el => {
    let pts;
    try {
      pts = JSON.parse(decodeURIComponent(el.dataset.route));
    } catch {
      return;
    }
    if (!Array.isArray(pts) || pts.length < 2) return;

    const coordsLngLat = pts.map(p => [p.lng, p.lat]);
    const latlngs = tripLineLngLatToLeaflet(tripGreatCircleLine(coordsLngLat, 32));

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    });
    L.tileLayer(TRIP_SATELLITE_TILE_URL, tileOpts).addTo(map);
    L.polyline(latlngs, { color: '#22d3ee', weight: 10, opacity: 0.34, lineJoin: 'round' }).addTo(map);
    L.polyline(latlngs, { color: '#bae6fd', weight: 3, opacity: 0.96, lineJoin: 'round' }).addTo(map);
    pts.forEach((p, i) => {
      const isEnd = i === 0 || i === pts.length - 1;
      L.circleMarker([p.lat, p.lng], {
        radius: isEnd ? 5 : 4,
        color: '#ffffff',
        weight: 2,
        fillColor: isEnd ? '#0284c7' : '#38bdf8',
        fillOpacity: 1,
      }).addTo(map);
    });
    try {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [12, 12], maxZoom: 7 });
    } catch (_) {
      map.setView(latlngs[0], 4);
    }
    _flightCardMiniMaps.push(map);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => refreshFlightCardMiniMapSizes());
  });
}

function normalizeBodyScroll() {
  if (modalBlockingOverlayCount() > 0) return;
  const mainEl = getMainScrollEl();
  document.documentElement.classList.remove('modal-scroll-lock');
  document.body.classList.remove('modal-scroll-lock');
  if (mainEl) {
    mainEl.classList.remove('modal-scroll-lock');
    mainEl.style.removeProperty('position');
    mainEl.style.removeProperty('top');
    mainEl.style.removeProperty('left');
    mainEl.style.removeProperty('right');
    mainEl.style.removeProperty('width');
    mainEl.style.removeProperty('overflow');
  }
  document.body.style.overflow = '';
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('width');
  document.documentElement.style.overflow = '';
}

function calendarDiffDays(d0, d1) {
  const a = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const b = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  return Math.round((b - a) / 86400000);
}

function getNextFlightDepartureMs() {
  const now = Date.now();
  for (const f of getEnrichedFlightRowsSorted()) {
    const t = new Date(f.departureUtc).getTime();
    if (!Number.isNaN(t) && t > now) return t;
  }
  return null;
}

function isTripCalendarPast() {
  const end = getTripEndDate();
  if (!end) return false;
  return calendarDiffDays(end, new Date()) > 0;
}

function flightCountdownBannerLine() {
  const nextAt = getNextFlightDepartureMs();
  if (nextAt != null) {
    const ms = nextAt - Date.now();
    if (ms < 3600000) return APP_LANG === 'zh' ? '祝旅途愉快！' : 'Enjoy your trip!';
    if (ms < 86400000) {
      const h = Math.floor(ms / 3600000);
      return APP_LANG === 'zh' ? `距起飞还有约 ${h} 小时` : `${h} more hour${h === 1 ? '' : 's'} until your flight`;
    }
    const d = Math.floor(ms / 86400000);
    return APP_LANG === 'zh' ? `距起飞还有 ${d} 天` : `${d} more day${d === 1 ? '' : 's'} until your flight`;
  }
  if (isTripCalendarPast())
    return APP_LANG === 'zh' ? '把一路故事安全带回家。✈️' : 'Hope you brought the stories home. ✈️';
  return null;
}

function renderTripCountdownBanner() {
  const el = document.getElementById('trip-countdown-banner');
  if (!el) return;
  if (_tripCountdownTick) {
    clearInterval(_tripCountdownTick);
    _tripCountdownTick = null;
  }

  if (getEnrichedFlightRowsSorted().length === 0) {
    el.classList.remove('trip-countdown-banner--empty');
    el.classList.add('trip-countdown-banner--placeholder');
    el.innerHTML = `<div class="trip-cd-bar trip-cd-bar--dotted">${flightEsc(Ui('flight.addPromptFirst'))}</div>`;
    return;
  }

  el.classList.remove('trip-countdown-banner--placeholder');

  const write = () => {
    const line = flightCountdownBannerLine();
    if (line == null) {
      el.innerHTML = '';
      el.classList.add('trip-countdown-banner--empty');
      if (_tripCountdownTick) {
        clearInterval(_tripCountdownTick);
        _tripCountdownTick = null;
      }
      return;
    }
    el.classList.remove('trip-countdown-banner--empty');
    const wrapPast = getNextFlightDepartureMs() == null && isTripCalendarPast();
    const cls = wrapPast ? 'trip-cd-bar trip-cd-bar--past' : 'trip-cd-bar';
    el.innerHTML = `<div class="${cls}">${flightEsc(line)}</div>`;
  };
  write();
  if (getNextFlightDepartureMs() != null) {
    _tripCountdownTick = setInterval(write, 60 * 1000);
  }
}

function isoToDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function effectiveDepArr(f) {
  let dep = new Date(f.departureUtc).getTime();
  let arr = f.arrivalUtc ? new Date(f.arrivalUtc).getTime() : NaN;
  const dm = f.delayMinutes != null && f.delayMinutes > 0 ? f.delayMinutes * 60000 : 0;
  if (dm) {
    dep += dm;
    if (!Number.isNaN(arr)) arr += dm;
  }
  return {
    depIso: new Date(dep).toISOString(),
    arrIso: !Number.isNaN(arr) ? new Date(arr).toISOString() : '',
  };
}

function loadFlightOverlay() {
  try {
    const raw = localStorage.getItem(FLIGHT_OVERLAY_KEY);
    if (!raw) {
      flightUserExtras = [];
      flightHiddenIds = new Set();
      flightEdits = {};
      return;
    }
    const o = JSON.parse(raw);
    flightUserExtras = Array.isArray(o.extras) ? o.extras : [];
    flightHiddenIds = new Set(Array.isArray(o.hidden) ? o.hidden : []);
    flightEdits = o.edits && typeof o.edits === 'object' && !Array.isArray(o.edits) ? o.edits : {};
  } catch {
    flightUserExtras = [];
    flightHiddenIds = new Set();
    flightEdits = {};
  }
}

function persistFlightOverlay() {
  localStorage.setItem(
    FLIGHT_OVERLAY_KEY,
    JSON.stringify({
      extras: flightUserExtras,
      hidden: [...flightHiddenIds],
      edits: flightEdits,
    })
  );
}

function removeFlightCard(id) {
  if (id.startsWith('u-')) flightUserExtras = flightUserExtras.filter(f => f.id !== id);
  else {
    flightHiddenIds.add(id);
    delete flightEdits[id];
  }
  persistFlightOverlay();
  renderFlights();
}

function setupFlightCardDots() {
  const grid = document.getElementById('flight-cards-grid');
  const dotsEl = document.getElementById('flight-card-dots');
  if (!grid || !dotsEl) return;

  if (_flightCardDotsObserver) {
    _flightCardDotsObserver.disconnect();
    _flightCardDotsObserver = null;
  }
  dotsEl.replaceChildren();

  const cards = [...grid.querySelectorAll('.flight-card')];
  if (cards.length <= 1) {
    dotsEl.hidden = true;
    dotsEl.setAttribute('aria-hidden', 'true');
    return;
  }

  dotsEl.hidden = false;
  dotsEl.setAttribute('aria-hidden', 'false');
  for (let i = 0; i < cards.length; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'flight-card-dot' + (i === 0 ? ' is-active' : '');
    b.dataset.index = String(i);
    b.setAttribute('aria-label', `Go to flight ${i + 1}`);
    dotsEl.appendChild(b);
  }

  const dots = [...dotsEl.querySelectorAll('.flight-card-dot')];
  const setActive = idx => {
    dots.forEach((d, j) => d.classList.toggle('is-active', j === idx));
  };

  _flightCardDotsObserver = new IntersectionObserver(
    entries => {
      let best = null;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const r = e.intersectionRatio;
        if (!best || r > best.r) best = { r, t: e.target };
      }
      if (best) {
        const idx = cards.indexOf(best.t);
        if (idx >= 0) setActive(idx);
      }
    },
    { root: grid, threshold: [0.2, 0.4, 0.6, 0.8, 1] }
  );
  cards.forEach(c => _flightCardDotsObserver.observe(c));

  dotsEl.onclick = ev => {
    const btn = ev.target.closest('.flight-card-dot');
    if (!btn) return;
    const i = parseInt(btn.dataset.index, 10);
    const card = cards[i];
    if (!card) return;
    grid.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
    setTimeout(() => refreshFlightCardMiniMapSizes(), 400);
  };
}

function flightCardHtml(m) {
  const bits = [m.status, m.terminal && `Terminal ${m.terminal}`, m.gate && `Gate ${m.gate}`, m.checkIn].filter(Boolean);
  const statusLine = bits.join(' · ');
  const delayNote =
    m.delayMinutes != null && m.delayMinutes > 0
      ? `<div class="flight-delay">+${flightEsc(m.delayMinutes)}m delay (from live file)</div>`
      : '';

  return `<div class="flight-card flight-card--simple glass-card" data-flight-id="${flightEsc(m.id)}">
    <div class="flight-card-btns">
      <button type="button" class="flight-card-edit" title="Edit details" aria-label="Edit flight" onclick="openFlightEditModal('${flightEsc(
        m.id
      )}')">Edit</button>
      <button type="button" class="del-btn flight-card-remove" title="Remove from board" aria-label="Remove from board" onclick="removeFlightCard('${flightEsc(
        m.id
      )}')">×</button>
    </div>
    ${flightCardMainHtml(m)}
    ${delayNote}
    ${statusLine ? `<div class="flight-live-status">${flightEsc(statusLine)}</div>` : ''}
  </div>`;
}

function renderFlights() {
  const grid = document.getElementById('flight-cards-grid');
  if (!grid) return;

  const rows = getEnrichedFlightRowsSorted();

  grid.classList.toggle('flight-cards-scroller--empty', rows.length === 0);
  grid.innerHTML = rows.length
    ? rows.map(flightCardHtml).join('')
    : `<div class="flight-empty flight-empty--solo">${flightEsc(
        Ui('flight.gridEmpty') ||
          'No flights listed yet — add flights with the button below or restore a backup.',
      )}</div>`;

  setupFlightCardDots();
  renderTripCountdownBanner();
  requestAnimationFrame(() => initFlightCardMiniMaps());
}

function initFlightBoardSectionToggle() {
  const btn = document.getElementById('flight-board-toggle');
  const stack = document.getElementById('flight-board-stack');
  const wrap = document.getElementById('flight-board-section');
  const addBtn = document.getElementById('flight-add-btn');
  if (!btn || !stack || !wrap) return;

  /** Must match .22s opacity on #flight-board-stack / #flight-add-btn in app.css */
  const FLIGHT_BOARD_FADE_MS = 220;
  /** Slightly longer than --dur-spring (0.5s) max-height on #flight-board-stack */
  const FLIGHT_BOARD_SPACE_MS = 520;

  let fadeTimer = 0;
  let spaceTimer = 0;
  let animating = false;

  const clearTimers = () => {
    if (fadeTimer) clearTimeout(fadeTimer);
    if (spaceTimer) clearTimeout(spaceTimer);
    fadeTimer = 0;
    spaceTimer = 0;
  };

  const applyFromStorage = () => {
    const collapsed = localStorage.getItem(FLIGHT_BOARD_COLLAPSED_KEY) === '1';
    wrap.classList.toggle('flight-board-wrap--board-faded', collapsed);
    wrap.classList.toggle('flight-board-wrap--collapsed', collapsed);
    btn.textContent = collapsed ? Ui('flight.show') : Ui('flight.hide');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (collapsed) {
      stack.setAttribute('inert', '');
      if (addBtn) addBtn.setAttribute('inert', '');
      teardownFlightCardMiniMaps();
    } else {
      stack.removeAttribute('inert');
      if (addBtn) addBtn.removeAttribute('inert');
    }
  };

  applyFromStorage();

  btn.addEventListener('click', () => {
    if (animating) return;
    const collapsed = localStorage.getItem(FLIGHT_BOARD_COLLAPSED_KEY) === '1';
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!collapsed) {
      localStorage.setItem(FLIGHT_BOARD_COLLAPSED_KEY, '1');
      btn.textContent = Ui('flight.show');
      btn.setAttribute('aria-expanded', 'false');
      if (reduceMotion) {
        applyFromStorage();
        return;
      }
      animating = true;
      btn.disabled = true;
      clearTimers();
      wrap.classList.add('flight-board-wrap--board-faded');
      stack.setAttribute('inert', '');
      if (addBtn) addBtn.setAttribute('inert', '');
      fadeTimer = setTimeout(() => {
        wrap.classList.add('flight-board-wrap--collapsed');
        teardownFlightCardMiniMaps();
        animating = false;
        btn.disabled = false;
        fadeTimer = 0;
      }, FLIGHT_BOARD_FADE_MS);
    } else {
      localStorage.setItem(FLIGHT_BOARD_COLLAPSED_KEY, '0');
      btn.textContent = Ui('flight.hide');
      btn.setAttribute('aria-expanded', 'true');
      if (reduceMotion) {
        applyFromStorage();
        requestAnimationFrame(() => initFlightCardMiniMaps());
        return;
      }
      animating = true;
      btn.disabled = true;
      clearTimers();
      wrap.classList.remove('flight-board-wrap--collapsed');
      stack.setAttribute('inert', '');
      if (addBtn) addBtn.setAttribute('inert', '');
      spaceTimer = setTimeout(() => {
        wrap.classList.remove('flight-board-wrap--board-faded');
        stack.removeAttribute('inert');
        if (addBtn) addBtn.removeAttribute('inert');
        animating = false;
        btn.disabled = false;
        spaceTimer = 0;
        requestAnimationFrame(() => initFlightCardMiniMaps());
      }, FLIGHT_BOARD_SPACE_MS);
    }
  });
}

function openFlightAddModal() {
  const modal = document.getElementById('flightAddModal');
  if (!modal) {
    console.warn('[Triple] flightAddModal missing');
    return;
  }
  closeAllFlightModalTypeaheads();
  flightModalEditingId = null;
  const titleEl = document.getElementById('flight-modal-title');
  if (titleEl) titleEl.textContent = Ui('flight.modal.titleAdd');
  refreshFlightConnectionSelect();
  refreshFlightModalI18n();
  const ids = [
    'flight-f-airline-code',
    'flight-f-airline-search',
    'flight-f-flight-digits',
    'flight-f-dep-ap',
    'flight-f-arr-ap',
    'flight-f-dep',
    'flight-f-arr',
    'flight-f-conn-airline-code',
    'flight-f-conn-airline-search',
    'flight-f-conn-flight-digits',
    'flight-f-conn-dep-ap',
    'flight-f-conn-arr-ap',
    'flight-f-conn-departure',
    'flight-f-conn-arrival',
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }
  const conn = document.getElementById('flight-f-connection');
  if (conn) conn.value = 'direct';
  updateConnectionFormVisibility();
  modal.classList.add('open');
  setTimeout(() => document.getElementById('flight-f-dep-ap')?.focus(), 50);
}

function getFlightFormSource(id) {
  const u = flightUserExtras.find(f => f.id === id);
  if (u) return { ...u };
  const b = (FLIGHTS || []).find(f => f.id === id);
  if (!b) return null;
  return applyEditsToFlight(b);
}

function openFlightEditModal(id) {
  const modal = document.getElementById('flightAddModal');
  if (!modal) return;
  const src = getFlightFormSource(id);
  if (!src) return;
  closeAllFlightModalTypeaheads();
  flightModalEditingId = id;
  const titleEl = document.getElementById('flight-modal-title');
  if (titleEl) titleEl.textContent = Ui('flight.modal.titleEdit');
  refreshFlightConnectionSelect();
  const subEl = document.getElementById('flight-modal-sub');
  if (subEl && subEl.hasAttribute('data-ui-edit')) {
    subEl.textContent = Ui(subEl.getAttribute('data-ui-edit'));
  }
  const submitEl = document.getElementById('flight-modal-submit');
  if (submitEl) submitEl.textContent = Ui('flight.saveChanges');
  setAirlineFieldsFromModel('flight-f-', src);
  document.getElementById('flight-f-dep-ap').value = src.depAirport || '';
  document.getElementById('flight-f-arr-ap').value = src.arrAirport || '';
  document.getElementById('flight-f-dep').value = isoToDatetimeLocal(src.departureUtc);
  document.getElementById('flight-f-arr').value = src.arrivalUtc ? isoToDatetimeLocal(src.arrivalUtc) : '';
  const conn = document.getElementById('flight-f-connection');
  if (conn) conn.value = src.connectionKind && FLIGHT_CONN_ORDER.includes(src.connectionKind) ? src.connectionKind : 'direct';
  setAirlineFieldsFromModel('flight-f-conn-', {
    airlineCode: src.connAirlineCode,
    flightDigits: src.connFlightDigits,
    flightNo: src.connFlightNo,
  });
  document.getElementById('flight-f-conn-dep-ap').value = src.connDepAirport || '';
  document.getElementById('flight-f-conn-arr-ap').value = src.connArrAirport || '';
  const connDepEl = document.getElementById('flight-f-conn-departure');
  if (connDepEl) connDepEl.value = src.connDepartureUtc ? isoToDatetimeLocal(src.connDepartureUtc) : '';
  const connArrEl = document.getElementById('flight-f-conn-arrival');
  if (connArrEl) connArrEl.value = src.connArrivalUtc ? isoToDatetimeLocal(src.connArrivalUtc) : '';
  updateConnectionFormVisibility();
  modal.classList.add('open');
  setTimeout(() => document.getElementById('flight-f-dep-ap')?.focus(), 50);
}

function closeFlightAddModal() {
  flightModalEditingId = null;
  closeAllFlightModalTypeaheads();
  document.getElementById('flightAddModal')?.classList.remove('open');
  const titleEl = document.getElementById('flight-modal-title');
  if (titleEl) titleEl.textContent = Ui('flight.modal.titleAdd');
  const submitEl = document.getElementById('flight-modal-submit');
  if (submitEl) submitEl.textContent = Ui('flight.save');
}

function submitFlightAdd() {
  const depAp = document.getElementById('flight-f-dep-ap').value.trim().toUpperCase();
  const arrAp = document.getElementById('flight-f-arr-ap').value.trim().toUpperCase();
  const dep = document.getElementById('flight-f-dep').value;
  if (depAp.length < 3 || arrAp.length < 3 || !dep) {
    showAlert(
      Ui('flight.err.depAp') ||
        'Enter both airport codes (3 letters) and a departure date & time. Use the suggestions list or type a valid IATA code.',
      Ui('flight.modal.titleAdd') || 'Flight',
    );
    return;
  }
  const mainCode = readAirlineCode('flight-f-');
  const mainDigitsEl = document.getElementById('flight-f-flight-digits');
  const mainDigits = mainDigitsEl ? mainDigitsEl.value.trim().replace(/\s/g, '') : '';
  if (!mainCode || !mainDigits) {
    showAlert('Choose an airline (or enter an IATA code) and add the flight number digits.', 'Flight');
    return;
  }
  if (!/^\d{1,4}$/.test(mainDigits)) {
    showAlert('The main flight number must be 1–4 digits only.', 'Flight');
    return;
  }
  const depIso = new Date(dep).toISOString();
  let arrIso = null;
  const arrVal = document.getElementById('flight-f-arr').value;
  if (arrVal) arrIso = new Date(arrVal).toISOString();
  const connectionKind = document.getElementById('flight-f-connection')?.value || 'direct';
  const airlineName = airlineNameFromSelect('flight-f-', mainCode);
  const flightNo = `${mainCode}${mainDigits}`;

  const patch = {
    airline: airlineName,
    airlineCode: mainCode,
    flightDigits: mainDigits,
    flightNo,
    depAirport: depAp.slice(0, 4),
    arrAirport: arrAp.slice(0, 4),
    departureUtc: depIso,
    arrivalUtc: arrIso,
    connectionKind,
    ...(connectionKind === 'direct'
      ? {
          connAirlineCode: '',
          connFlightDigits: '',
          connDepAirport: '',
          connArrAirport: '',
          connDepartureUtc: null,
          connArrivalUtc: null,
        }
      : {
          connAirlineCode: readAirlineCode('flight-f-conn-'),
          connFlightDigits: document.getElementById('flight-f-conn-flight-digits')
            ? document.getElementById('flight-f-conn-flight-digits').value.trim().replace(/\s/g, '')
            : '',
          connDepAirport: document.getElementById('flight-f-conn-dep-ap').value.trim().toUpperCase().slice(0, 4),
          connArrAirport: document.getElementById('flight-f-conn-arr-ap').value.trim().toUpperCase().slice(0, 4),
          connDepartureUtc: (() => {
            const v = document.getElementById('flight-f-conn-departure')?.value;
            return v ? new Date(v).toISOString() : null;
          })(),
          connArrivalUtc: (() => {
            const v = document.getElementById('flight-f-conn-arrival')?.value;
            return v ? new Date(v).toISOString() : null;
          })(),
        }),
  };

  const connDig =
    connectionKind !== 'direct' && document.getElementById('flight-f-conn-flight-digits')
      ? document.getElementById('flight-f-conn-flight-digits').value.trim().replace(/\s/g, '')
      : '';
  if (connectionKind !== 'direct' && connDig && !/^\d{1,4}$/.test(connDig)) {
    showAlert('The connection flight number must be 1–4 digits only (or leave it blank).', 'Flight');
    return;
  }

  if (flightModalEditingId) {
    const eid = flightModalEditingId;
    const uIdx = flightUserExtras.findIndex(f => f.id === eid);
    if (uIdx >= 0) {
      flightUserExtras[uIdx] = { ...flightUserExtras[uIdx], ...pickFlightPatch(patch) };
    } else {
      flightEdits[eid] = { ...flightEdits[eid], ...pickFlightPatch(patch) };
    }
    flightModalEditingId = null;
  } else {
    flightUserExtras.push({
      id: 'u-' + Date.now(),
      ...pickFlightPatch(patch),
    });
  }
  persistFlightOverlay();
  renderFlights();
  closeFlightAddModal();
}

window.removeFlightCard = removeFlightCard;
window.openFlightAddModal = openFlightAddModal;
window.openFlightEditModal = openFlightEditModal;
window.closeFlightAddModal = closeFlightAddModal;
window.submitFlightAdd = submitFlightAdd;

/** Newest-first semver sort for the version history modal. */
function compareVersionDesc(a, b) {
  const pa = String(a.v).split('.').map(part => parseInt(part, 10) || 0);
  const pb = String(b.v).split('.').map(part => parseInt(part, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da;
  }
  return 0;
}

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let isEditing = false;
let pendingRollbackIndex = -1;
let pieChart = null, barChart = null;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('tripHistory') || '[]'); } catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem('tripHistory', JSON.stringify(h));
}

// ═══════════════════════════════════════
// CHECKLIST SORTING / GROUPING
// ═══════════════════════════════════════
let clSort = 'date';

function localizePlannerCategory(cat) {
  if (APP_LANG !== 'zh') return cat;
  const map = {
    Flights: '航班',
    Accommodation: '住宿',
    'Car Rental': '租车',
    'Ground transport': '包车 / 地面交通',
    'Ferries & Transfers': '渡轮 / 接驳',
    Activities: '体验活动',
    Insurance: '旅行保险',
    Essentials: '必备事项',
    Planner: '规划',
    Other: '其他',
  };
  return map[cat] || cat;
}

const CL_SORT_MODES = ['urgency', 'category', 'date', 'city', 'status'];

function loadClSortPreference() {
  try {
    const s = localStorage.getItem(CL_SORT_KEY);
    if (s && CL_SORT_MODES.includes(s)) clSort = s;
  } catch (_) { /* ignore */ }
}

function formatChecklistTripDate(iso) {
  if (!iso || typeof iso !== 'string') return Ui('checklist.date.unscheduled') || 'Unscheduled';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const da = parseInt(m[3], 10);
  const wdEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const wdZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dt = new Date(Date.UTC(y, mo - 1, da));
  const wd = dt.getUTCDay();
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (APP_LANG === 'zh') return `${mo}月${da}日 · ${wdZh[wd]}`;
  return `${wdEn[wd]} ${monthsEn[mo - 1]} ${da}`;
}

function syncClSortButtons() {
  document.querySelectorAll('.cl-sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === clSort));
}

function setClSort(s) {
  clSort = s;
  try {
    localStorage.setItem(CL_SORT_KEY, s);
  } catch (_) { /* ignore */ }
  syncClSortButtons();
  renderChecklist();
}

function checklistItemWord(n) {
  if (APP_LANG === 'zh') return n + ' 条';
  return n + ' item' + (n !== 1 ? 's' : '');
}

function getChecklistGroups() {
  if (!CHECKLIST || !Array.isArray(CHECKLIST)) return [];
  const metaFor = id => ({
    cat: 'Other',
    catIcon: '📌',
    catColor: '#86868b',
    tripCity: 'pre',
    ...(CL_META && CL_META[id] ? CL_META[id] : {}),
  });
  const state = loadChecklistState();
  const allItems = CHECKLIST.flatMap(g =>
    g.items.map(it => ({
      ...it,
      ...metaFor(it.id),
      urgencyId: g.id,
      urgencyLabel: g.label,
      urgencyColor: g.color,
      urgencySub: g.sub,
    })),
  );

  if (clSort === 'urgency') {
    return CHECKLIST.map(g => ({
      id: g.id,
      label: Tx(g.label),
      sub: Tx(g.sub),
      color: g.color,
      items: g.items.map(it => ({ ...it, ...metaFor(it.id) })),
    }));
  }
  if (clSort === 'category') {
    const catOrder = [
      'Flights',
      'Accommodation',
      'Car Rental',
      'Ground transport',
      'Ferries & Transfers',
      'Activities',
      'Insurance',
      'Essentials',
    ];
    const cats = [...new Set(allItems.map(it => it.cat))].sort(
      (a, b) =>
        (catOrder.indexOf(a) < 0 ? 99 : catOrder.indexOf(a)) -
        (catOrder.indexOf(b) < 0 ? 99 : catOrder.indexOf(b)),
    );
    return cats.map(cat => {
      const items = allItems.filter(it => it.cat === cat);
      const m = items[0];
      return {
        id: 'cat-' + cat.replace(/\s+/g, '-'),
        label: `${m.catIcon} ${escapeHtml(localizePlannerCategory(cat))}`,
        sub: checklistItemWord(items.length),
        color: m.catColor,
        items,
      };
    });
  }
  if (clSort === 'date') {
    const dated = allItems.filter(it => metaFor(it.id).tripDate);
    const undated = allItems.filter(it => !metaFor(it.id).tripDate);
    const dates = [...new Set(dated.map(it => metaFor(it.id).tripDate))].sort();
    const groups = dates.map(dateIso => {
      const items = dated.filter(it => metaFor(it.id).tripDate === dateIso);
      return {
        id: `date-${dateIso}`,
        label: formatChecklistTripDate(dateIso),
        sub: checklistItemWord(items.length),
        color: '#5856d6',
        items,
      };
    });
    if (undated.length) {
      groups.push({
        id: 'date-none',
        label: Ui('checklist.date.unscheduled') || 'Unscheduled',
        sub: checklistItemWord(undated.length),
        color: '#636366',
        items: undated,
      });
    }
    return groups;
  }
  if (clSort === 'city') {
    const cityOrder = { pre: 0, cq: 1, xj: 2 };
    const cities = [...new Set(allItems.map(it => metaFor(it.id).tripCity || 'pre'))].sort(
      (a, b) => (cityOrder[a] ?? 9) - (cityOrder[b] ?? 9),
    );
    return cities.map(city => {
      const items = allItems.filter(it => (metaFor(it.id).tripCity || 'pre') === city);
      const label =
        city === 'pre' ? Ui('checklist.city.pre') : city === 'cq' ? Ui('checklist.city.cq') : Ui('checklist.city.xj');
      const palette = city === 'pre' ? '#636366' : city === 'cq' ? '#0071e3' : '#ff9500';
      return {
        id: `city-${city}`,
        label,
        sub: checklistItemWord(items.length),
        color: palette,
        items,
      };
    });
  }
  if (clSort === 'status') {
    const todo = allItems.filter(it => !state[it.id]);
    const done = allItems.filter(it => state[it.id]);
    return [
      todo.length
        ? {
            id: 'todo',
            label: Ui('checklist.status.todo'),
            sub:
              Ui('checklist.status.todoSub') ||
              checklistItemWord(todo.length),
            color: '#ff9500',
            items: todo,
          }
        : null,
      done.length
        ? {
            id: 'done',
            label: Ui('checklist.status.done'),
            sub:
              Ui('checklist.status.doneSub') ||
              checklistItemWord(done.length),
            color: '#34c759',
            items: done,
          }
        : null,
    ].filter(Boolean);
  }
  return [];
}

// ═══════════════════════════════════════
// RENDER
// ═══════════════════════════════════════
function daySeqLabel(num) {
  const n = parseInt(String(num), 10);
  if (!Number.isFinite(n)) return '';
  return APP_LANG === 'zh' ? `第 ${n} 天` : `Day ${n}`;
}

/** Calendar-only label for the large day-card figure (not route text). */
function dayCalendarLabel(d) {
  if (!d || d.date == null) return '';
  if (d.route != null) return Tx(d.date);
  const t = Tx(d.date);
  const sep = t.includes(' · ') ? ' · ' : t.includes(' — ') ? ' — ' : null;
  if (sep) return t.split(sep)[0].trim();
  return t;
}

function dayRouteLine(d) {
  if (!d) return '';
  if (d.route != null) return Tx(d.route);
  const t = Tx(d.date);
  const sep = t.includes(' · ') ? ' · ' : t.includes(' — ') ? ' — ' : null;
  if (sep) return t.split(sep).slice(1).join(sep).trim();
  return '';
}

function dayMetaCombined(d) {
  const route = dayRouteLine(d);
  const meta = d.meta != null ? Tx(d.meta) : '';
  if (route && meta) return `${route} · ${meta}`;
  return route || meta;
}

function renderDays(days, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = days
    .map(d => {
      const tlHtml = d.timeline
        ? `<div class="day-timeline-wrap"><div class="day-timeline">${d.timeline
            .map(t => {
              const time = escapeHtml(Tx(t.time));
              const lab = escapeHtml(Tx(t.label));
              const ic = t.icon != null ? escapeHtml(String(t.icon)) : '';
              return `<div class="tl-stop"><div class="tl-stop-time">${time}</div><div class="tl-stop-dot"></div><div class="tl-stop-icon">${ic}</div><div class="tl-stop-label">${lab}</div></div>`;
            })
            .join('')}</div></div>`
        : '';
      const acts = (d.activities || [])
        .map((a, i) => {
          const costHtml = a.cost
            ? `<div class="act-cost" data-key="${d.id}-act${i}-cost" data-label="Day ${d.num} activity ${
                i + 1
              } cost">💰 ${escapeHtml(Tx(a.cost))}</div>`
            : '';
          return `<li class="act-item">
          <div class="act-icon">${escapeHtml(String(a.icon || ''))}</div>
          <div>
            <div class="act-name" data-key="${d.id}-act${i}-name" data-label="Day ${d.num} activity ${
              i + 1
            } name">${escapeHtml(Tx(a.name))}</div>
            <div class="act-desc" data-key="${d.id}-act${i}-desc" data-label="Day ${d.num} activity ${
              i + 1
            } description">${escapeHtml(Tx(a.desc))}</div>
            ${costHtml}
          </div>
        </li>`;
        })
        .join('');
      const desc = escapeHtml(Tx(d.desc));
      const title = escapeHtml(Tx(d.title));
      return `
    <div class="day-card" id="card-${d.id}" data-card-id="${d.id}">
      <button class="del-btn" onclick="deleteCard('card-${d.id}')">×</button>
      <div class="day-header" onclick="toggleDay('card-${d.id}')">
        <div class="day-num"><span class="day-weekday">${escapeHtml(Tx(d.day))}</span><span class="day-date">${escapeHtml(
          dayCalendarLabel(d),
        )}</span><span class="day-sequence">${escapeHtml(daySeqLabel(d.num))}</span></div>
        <div class="day-info">
          <div>
            <div class="day-title-text" data-key="${d.id}-title" data-label="Day ${d.num} title">${title}</div>
            <div class="day-meta"><span data-key="${d.id}-meta" data-label="Day ${d.num} route/distance">${escapeHtml(
              dayMetaCombined(d),
            )}</span></div>
          </div>
          <div class="day-toggle">⌄</div>
        </div>
      </div>
      <div class="day-content">
        <img class="day-img" src="${escapeHtml(d.img)}" alt="${escapeHtml(Tx(d.imgAlt))}" onerror="this.style.display='none'">
        ${tlHtml}
        <p style="font-size:14px;line-height:1.75;color:var(--text-sec);letter-spacing:0.01em;margin-top:14px" data-key="${
          d.id
        }-desc" data-label="Day ${d.num} description">${desc}</p>
        <ul class="act-list">
          ${acts}
        </ul>
      </div>
    </div>`;
    })
    .join('');
}

function renderStays() {
  const sy = TRIP_META.currencySymbol || '¥';
  document.getElementById('stay-list').innerHTML = STAYS.map(
    s => `
    <div class="stay-card" id="card-stay-${s.id}" data-card-id="stay-${s.id}">
      <button class="del-btn" onclick="deleteCard('card-stay-${s.id}')">×</button>
      <img class="stay-img" src="${s.img}" alt="${escapeHtml(Tx(s.name))}" onerror="this.style.display='none'">
      <div class="stay-body">
        <div class="stay-name" data-key="stay-${s.id}-name" data-label="${escapeHtml(Tx(s.name))} stay name">${escapeHtml(
          Tx(s.name),
        )}</div>
        <div class="stay-loc">📍 <span data-key="stay-${s.id}-loc" data-label="${escapeHtml(Tx(s.name))} location">${escapeHtml(
          Tx(s.loc),
        )}</span></div>
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-sec);margin-bottom:8px">${escapeHtml(
          Tx(s.nights),
        )}</div>
        <div style="font-size:13px;color:var(--text-sec);margin-bottom:12px">
          <strong>${escapeHtml(
            Ui('stay.bestAreas'),
          )}:</strong> <span data-key="stay-${s.id}-areas" data-label="${escapeHtml(Tx(s.name))} recommended areas">${(
      s.areas || []
    )
      .map(x => escapeHtml(Tx(x)))
      .join(' · ')}</span>
        </div>
        <div class="stay-pills">${(s.pills || []).map(p => `<div class="stay-pill">${escapeHtml(Tx(p))}</div>`).join('')}</div>
        <div class="stay-price-row">
          <div class="stay-price">${sy}<span data-key="stay-${s.id}-min" data-label="${
          s.id
        } min nightly price" data-cost-id="stay-${s.id}-min">${s.minPrice}</span>–<span data-key="stay-${
          s.id
        }-max" data-label="${s.id} max nightly price" data-cost-id="stay-${s.id}-max">${s.maxPrice}</span></div>
          <div class="stay-price-note" data-ui="stay.perNightWhole">${escapeHtml(
            Ui('stay.perNightWhole'),
          )}</div>
        </div>
        <p class="stay-tip" data-key="stay-${s.id}-tip" data-label="${escapeHtml(Tx(s.name))} tip">💡 ${escapeHtml(
          Tx(s.tip),
        )}</p>
      </div>
    </div>`,
  ).join('');
}

function costRowSlug(c, idx) {
  return c.catSlug != null ? String(c.catSlug) : `fallback-${idx}`;
}

function slugToCostCategoryLabel(slug) {
  const row = COSTS.find((c, i) => costRowSlug(c, i) === slug);
  return row ? Tx(row.cat) : slug;
}

function renderCostTable() {
  const tbody = document.getElementById('cost-table-body');
  const sym = TRIP_META.currencySymbol || '¥';
  let lastSlug = '';
  tbody.innerHTML = COSTS.map((c, i) => {
    const slug = costRowSlug(c, i);
    const span = COSTS.filter((x, j) => costRowSlug(x, j) === slug).length;
    const catCell = slug !== lastSlug ? `<td class="cost-cat" rowspan="${span}">${escapeHtml(Tx(c.cat))}</td>` : '';
    if (slug !== lastSlug) lastSlug = slug;
    return `<tr>
      ${catCell}
      <td data-key="cost-${i}-item" data-label="${escapeHtml(Tx(c.item))} cost item">${escapeHtml(Tx(c.item))}</td>
      <td class="cost-amt">${sym}<span data-key="cost-${i}-total" data-label="${escapeHtml(
        Tx(c.item),
      )} total cost" data-chart-update="1">${c.total.toLocaleString()}</span></td>
      <td class="cost-amt" style="color:var(--blue)">${sym}<span data-key="cost-${i}-pp" data-label="${escapeHtml(
        Tx(c.item),
      )} per person" data-chart-update="1">${c.pp}</span></td>
      <td style="font-size:12px;color:var(--text-sec)" data-key="cost-${i}-note" data-label="${escapeHtml(
        Tx(c.item),
      )} notes">${escapeHtml(Tx(c.note))}</td>
    </tr>`;
  }).join('');
}

function renderChecklist() {
  const state = loadChecklistState();
  const container = document.getElementById('checklist-container');
  if (!container) return;
  const groups = getChecklistGroups();
  container.innerHTML = groups.map(g => {
    const total = g.items.length;
    const done  = g.items.filter(it => state[it.id]).length;
    return `<div class="cl-group">
      <div class="cl-group-hdr" style="background:${g.color}">
        <div class="cl-group-hdr-text">
          <div class="cl-group-title">${g.label}</div>
          <div class="cl-group-sub">${g.sub}</div>
        </div>
        <div class="cl-group-badge">${done}/${total} ${Ui('checklist.slotBookedSuffix')}</div>
      </div>
      <div class="cl-items">
        ${g.items.map(it => {
          const checked = !!state[it.id];
          return `<div class="cl-item${checked?' done':''}" id="clitem-${it.id}">
            <label class="cl-row">
              <div class="cl-checkbox-wrap"><input type="checkbox" class="cl-check" data-id="${it.id}" onchange="toggleChecklistItem(this)" ${checked?'checked':''}></div>
              <div class="cl-icon">${it.icon}</div>
              <div class="cl-content">
                <div class="cl-title">${escapeHtml(Tx(it.title))}</div>
                <div class="cl-dates">${escapeHtml(Tx(it.dates))}</div>
                <div class="cl-detail">${escapeHtml(Tx(it.detail))}</div>
                <div class="cl-meta">
                  <span class="cl-est">💰 ${escapeHtml(Tx(it.est))}</span>
                  <span class="cl-where">🔗 ${escapeHtml(Tx(it.where))}</span>
                </div>
              </div>
            </label>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  updateChecklistProgress();
}

function toggleChecklistItem(cb) {
  const state = loadChecklistState();
  state[cb.dataset.id] = cb.checked;
  localStorage.setItem('checklistState', JSON.stringify(state));
  const mainEl = getMainScrollEl();
  const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;
  renderChecklist();
  if (mainEl) mainEl.scrollTop = scrollY;
  else window.scrollTo(0, scrollY);
}

function updateChecklistProgress() {
  const state = loadChecklistState();
  const allItems = CHECKLIST.flatMap(g => g.items);
  const total = allItems.length;
  const done  = allItems.filter(it => state[it.id]).length;
  const pct   = total ? Math.round((done/total)*100) : 0;
  const fill  = document.getElementById('cl-progress-fill');
  const label = document.getElementById('cl-progress-label');
  if (fill)  fill.style.width = pct + '%';
  if (label)
    label.textContent =
      APP_LANG === 'zh'
        ? `已勾选 ${done} / ${total}（${pct}%）`
        : `${done} of ${total} items booked (${pct}%)`;
}

function loadChecklistState() {
  try { return JSON.parse(localStorage.getItem('checklistState') || '{}'); } catch { return {}; }
}

function resetChecklist() {
  document.getElementById('checklistResetModal').classList.add('open');
}
function doResetChecklist() {
  localStorage.removeItem('checklistState');
  renderChecklist();
}

function showAlert(msg, title) {
  document.getElementById('alertModalTitle').textContent = title || 'Notice';
  document.getElementById('alertModalMsg').textContent = msg;
  document.getElementById('alertModal').classList.add('open');
}

function renderTips() {
  document.getElementById('tips-grid').innerHTML = TIPS.map((t, ti) => {
    const title = Tx(t.title);
    return `
    <div class="tip-card" id="card-tip-${ti}" data-card-id="tip-${ti}">
      <button class="del-btn" onclick="deleteCard('card-tip-${ti}')">×</button>
      <div class="tip-icon">${escapeHtml(String(t.icon || ''))}</div>
      <div class="tip-title" data-key="tip-${ti}-title" data-label="${escapeHtml(title)} tip card title">${escapeHtml(title)}</div>
      <ul class="tip-list">${t.items
        .map(
          (item, ii) =>
            `<li data-key="tip-${ti}-item${ii}" data-label="${escapeHtml(title)} tip ${ii + 1}">${escapeHtml(
              Tx(item),
            )}</li>`,
        )
        .join('')}</ul>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════
function getCostsByCategory() {
  const cats = {};
  COSTS.forEach((c, i) => {
    const slug = costRowSlug(c, i);
    const el = document.querySelector(`[data-key="cost-${i}-pp"]`);
    const val = el ? parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0 : Number(c.pp) || 0;
    cats[slug] = (cats[slug] || 0) + val;
  });
  return cats;
}

function getTotalPP() {
  const cats = getCostsByCategory();
  return Object.values(cats).reduce((a,b) => a+b, 0);
}

function initCharts() {
  const cats = getCostsByCategory();
  const sym = TRIP_META.currencySymbol || '¥';
  const labels = Object.keys(cats).map(slugToCostCategoryLabel);
  const values = Object.values(cats);
  const ppLbl = Ui('budget.chart.pp') || 'Per person';
  const colors = ['#0071e3', '#34c759', '#ff9500', '#ff3b30', '#bf5af2', '#30d158', '#ffd60a'];

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();

  const pie = document.getElementById('pieChart');
  const bar = document.getElementById('barChart');
  if (!pie || !bar) return;

  pieChart = new Chart(pie, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { family: '-apple-system,BlinkMacSystemFont,sans-serif', size: 12 },
            padding: 16,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${sym}${Number(ctx.parsed).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })} ${ppLbl}`,
          },
        },
      },
    },
  });

  barChart = new Chart(bar, {
    type: 'bar',
    data: { labels, datasets: [{ label: ppLbl, data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${sym}${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 0 })} · ${ppLbl}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => sym + v },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function updateCharts() {
  const cats = getCostsByCategory();
  const sym = TRIP_META.currencySymbol || '¥';
  const labels = Object.keys(cats).map(slugToCostCategoryLabel);
  const values = Object.values(cats);
  if (pieChart) {
    pieChart.data.labels = labels;
    pieChart.data.datasets[0].data = values;
    pieChart.update();
  }
  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = values;
    barChart.data.datasets[0].label = Ui('budget.chart.pp') || 'Per person';
    barChart.options.scales.y.ticks.callback = v => sym + v;
    barChart.update();
  }
  const total = getTotalPP();
  const gs = Number(TRIP_META.groupSize) > 0 ? Number(TRIP_META.groupSize) : 4;
  const totalEl = document.getElementById('total-pp');
  const groupEl = document.getElementById('total-group');
  if (totalEl) totalEl.textContent = '~' + sym + Math.round(total).toLocaleString();
  if (groupEl) groupEl.textContent = '~' + sym + Math.round(total * gs).toLocaleString();
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if(page) page.classList.add('active');
  if(btn) btn.classList.add('active');
  else {
    const btns = document.querySelectorAll('.nav-item');
    btns.forEach(b => { if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+id+"'")) b.classList.add('active'); });
  }
  const mainEl = getMainScrollEl();
  if (mainEl) mainEl.scrollTop = 0;
  else window.scrollTo(0, 0);
  closeMobileMenu();
  if(id === 'budget') setTimeout(initCharts, 100);
  if ((id === 'overview' || id === 'cq') && window._mapCQ)
    setTimeout(() => window._mapCQ.invalidateSize(), 50);
  if ((id === 'overview' || id === 'xj1' || id === 'xj2') && window._mapXJ)
    setTimeout(() => window._mapXJ.invalidateSize(), 50);
  normalizeBodyScroll();
}

function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  const isOpen = sidebar.classList.contains('drawer-open');
  if (isOpen) { closeMobileMenu(); } else {
    sidebar.classList.add('drawer-open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    getMainScrollEl()?.style.setProperty('overflow', 'hidden');
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (sidebar) sidebar.classList.remove('drawer-open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
  normalizeBodyScroll();
}

function toggleDay(cardId) {
  if(isEditing) return;
  document.getElementById(cardId).classList.toggle('open');
}

// ═══════════════════════════════════════
// EDIT MODE
// ═══════════════════════════════════════
function captureSnapshot() {
  const s = { _deletedCards: [] };
  document.querySelectorAll('[data-key]').forEach(el => {
    s[el.dataset.key] = el.innerHTML;
  });
  document.querySelectorAll('.card-hidden').forEach(el => {
    s._deletedCards.push(el.dataset.cardId);
  });
  return s;
}

function applySnapshot(s) {
  document.querySelectorAll('[data-key]').forEach(el => {
    if(s[el.dataset.key] !== undefined) el.innerHTML = s[el.dataset.key];
  });
  // restore deleted cards
  document.querySelectorAll('[data-card-id]').forEach(el => {
    el.classList.remove('card-hidden');
  });
  if(s._deletedCards) {
    s._deletedCards.forEach(id => {
      const el = document.querySelector(`[data-card-id="${id}"]`);
      if(el) el.classList.add('card-hidden');
    });
  }
  updateCharts();
}

function syncEditToolbarButton() {
  const b = document.getElementById('editBtn');
  if (!b) return;
  if (isEditing) {
    b.textContent = '✓';
    b.setAttribute('aria-label', Ui('tools.editDoneAria'));
    b.title = Ui('tools.editDoneTip');
  } else {
    b.textContent = Ui('tools.edit');
    b.setAttribute('aria-label', Ui('tools.editAria'));
    b.title = Ui('tools.editTip');
  }
}

function toggleEdit() {
  closeTopToolsMenu();
  if(!isEditing) {
    isEditing = true;
    document.body.classList.add('editing');
    document.querySelectorAll('[data-key]').forEach(el => {
      el.contentEditable = 'true';
    });
    document.getElementById('editBtn').classList.remove('tb-primary');
    document.getElementById('editBtn').classList.add('tb-export');
    syncEditToolbarButton();
    showToast(Ui('toast.editOn'));
  } else {
    isEditing = false;
    document.body.classList.remove('editing');
    document.querySelectorAll('[data-key]').forEach(el => {
      el.contentEditable = 'false';
    });
    document.getElementById('editBtn').classList.add('tb-primary');
    document.getElementById('editBtn').classList.remove('tb-export');
    syncEditToolbarButton();

    const snap = captureSnapshot();
    const history = loadHistory();
    history.push({ timestamp: new Date().toISOString(), snapshot: snap });
    saveHistory(history);
    updateCharts();
  }
}

function deleteCard(cardId) {
  const el = document.getElementById(cardId);
  if(el) el.classList.add('card-hidden');
}

// ═══════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', {day:'numeric',month:'short',year:'numeric'}) + ' ' +
         d.toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'});
}

function stripHTML(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent.trim();
}

function diffSnapshots(before, after) {
  const changes = [];
  const allKeys = new Set([...Object.keys(before||{}), ...Object.keys(after||{})]);
  allKeys.forEach(key => {
    if(key === '_deletedCards') return;
    const b = stripHTML(before?.[key] || '');
    const a = stripHTML(after?.[key] || '');
    if(b !== a) {
      const el = document.querySelector(`[data-key="${key}"]`);
      const label = el?.dataset.label || key;
      changes.push({label, from:b.substring(0,80), to:a.substring(0,80)});
    }
  });
  // check deleted cards diff
  const delBefore = (before?._deletedCards||[]).join(',');
  const delAfter = (after?._deletedCards||[]).join(',');
  if(delBefore !== delAfter) changes.push({label:'Removed cards',from:delBefore||'none',to:delAfter||'none'});
  return changes;
}

function openHistory() {
  closeTopToolsMenu();
  const history = loadHistory();
  const list = document.getElementById('historyList');
  if(!history.length) {
    list.innerHTML = '<div class="no-hist">No edit history yet. Click Edit to start making changes.</div>';
  } else {
    const current = captureSnapshot();
    list.innerHTML = [...history].reverse().map((h,ri) => {
      const i = history.length - 1 - ri;
      const isCurrent = i === history.length - 1;
      const next = history[i+1];
      const diffCount = diffSnapshots(h.snapshot, next ? next.snapshot : current).length;
      return `<div class="hist-item" onclick="openDiff(${i})">
        <div class="hist-time">${formatDate(h.timestamp)} ${isCurrent ? '<span class="hist-current">Latest</span>' : ''}</div>
        <div class="hist-desc">${diffCount} change${diffCount!==1?'s':''} saved in this version</div>
      </div>`;
    }).join('');
  }
  document.getElementById('historyModal').classList.add('open');
}

function closeHistory() { document.getElementById('historyModal').classList.remove('open'); }

function openDiff(index) {
  pendingRollbackIndex = index;
  const history = loadHistory();
  const thisSnap = history[index].snapshot;
  const current = captureSnapshot();
  const changes = diffSnapshots(thisSnap, current);
  document.getElementById('diffTitle').textContent = 'Changes since ' + formatDate(history[index].timestamp);
  const diffList = document.getElementById('diffList');
  if(!changes.length) {
    diffList.innerHTML = '<p style="font-size:14px;color:var(--text-sec)">No differences between this save and the current version.</p>';
  } else {
    diffList.innerHTML = changes.map(c => `
      <div class="diff-item">
        <div class="diff-key">${c.label}</div>
        <div class="diff-from">Was: ${c.from || '(empty)'}</div>
        <div class="diff-to">Now: ${c.to || '(empty)'}</div>
      </div>`).join('');
  }
  document.getElementById('diffModal').classList.add('open');
}

function closeDiff() { document.getElementById('diffModal').classList.remove('open'); pendingRollbackIndex = -1; }

function doRollback() {
  if(pendingRollbackIndex < 0) return;
  const history = loadHistory();
  const snap = history[pendingRollbackIndex].snapshot;
  applySnapshot(snap);
  // trim history to this point
  const newHistory = history.slice(0, pendingRollbackIndex + 1);
  saveHistory(newHistory);
  closeDiff();
  closeHistory();
}

function confirmRevert() {
  closeTopToolsMenu();
  document.getElementById('revertModal').classList.add('open');
}

function doRevertAll() {
  renderDays(DAYS_CQ, 'days-cq');
  renderDays(DAYS_XJ1, 'days-xj1');
  renderDays(DAYS_XJ2, 'days-xj2');
  renderStays();
  renderCostTable();
  renderTips();
  renderChecklist();
  Object.entries(DOM_DEFAULT_HTML).forEach(([key, html]) => {
    const el = document.querySelector(`[data-key="${key}"]`);
    if (el) el.innerHTML = html;
  });
  seedOverviewFromPageSeed();
  refreshLangClasses();
  saveHistory([]);
  flightUserExtras = [];
  flightHiddenIds = new Set();
  flightEdits = {};
  localStorage.removeItem(FLIGHT_OVERLAY_KEY);
  document.getElementById('revertModal').classList.remove('open');
  setTimeout(updateCharts, 100);
  renderFlights();
}

// ═══════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════
function exportPDF() {
  closeTopToolsMenu();
  document.getElementById('pdfModal').classList.add('open');
}

// ═══════════════════════════════════════
// BACKUP / RESTORE
// ═══════════════════════════════════════
function buildTripleBackupObject() {
  const entries = {};
  for (const key of TRIPLE_BACKUP_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) entries[key] = v;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tripContentVersion: APP_VERSION != null ? String(APP_VERSION) : null,
    entries,
  };
}

function parseTripleBackupJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. Choose a Triple backup exported from this app.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('This file is not a Triple backup.');
  }
  if (data.format !== BACKUP_FORMAT) {
    throw new Error('This file is not a Triple backup.');
  }
  const ver = Number(data.version);
  if (!Number.isFinite(ver) || ver < 1 || ver > BACKUP_VERSION) {
    throw new Error(
      ver > BACKUP_VERSION
        ? 'This backup was made with a newer version of the app. Update the app and try again.'
        : 'This backup file is not supported.'
    );
  }
  if (!data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) {
    throw new Error('The backup file is missing data or is damaged.');
  }
  for (const k of Object.keys(data.entries)) {
    if (!TRIPLE_BACKUP_KEYS.includes(k)) {
      throw new Error('This file is not a valid Triple backup (unexpected fields).');
    }
    const v = data.entries[k];
    if (typeof v !== 'string') {
      throw new Error('The backup file is damaged (invalid field types).');
    }
  }
  return data;
}

function applyTripleBackup(data) {
  for (const key of TRIPLE_BACKUP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data.entries, key)) {
      localStorage.setItem(key, data.entries[key]);
    } else {
      localStorage.removeItem(key);
    }
  }
}

function openBackupModal() {
  closeTopToolsMenu();
  document.getElementById('backupModal').classList.add('open');
}

function closeBackupModal() {
  document.getElementById('backupModal')?.classList.remove('open');
}

function doBackupDownload() {
  closeBackupModal();
  const payload = buildTripleBackupObject();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fname = `triple-trip-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  a.href = url;
  a.download = fname;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function startBackupRestore() {
  closeBackupModal();
  document.getElementById('backupFileInput')?.click();
}

/** Auth gate: same file picker + apply flow as in-app backup restore; after reload, checkAuth runs (backup may include tripAuthToken). */
function startBackupRestoreFromLogin() {
  document.getElementById('backupFileInput')?.click();
}

async function doExportPDF(isLandscape) {

  // ── Capture maps as images ────────────────────────────────
  async function captureMap(mapId, pageId, liveMap) {
    const pageEl = document.getElementById(pageId);
    const mapEl = document.getElementById(mapId);
    if (!mapEl || !pageEl) return null;
    const prev = pageEl.style.display;
    pageEl.style.display = 'block';
    try {
      if (liveMap && typeof liveMap.invalidateSize === 'function') {
        liveMap.invalidateSize();
        await new Promise(r => setTimeout(r, 450));
      }
      const canvas = await html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        scale: 1.5,
        backgroundColor: '#0a1628',
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      pageEl.style.display = prev;
      return dataUrl;
    } catch (e) {
      pageEl.style.display = prev;
      return null;
    }
  }

  const toast = document.createElement('div');
  toast.textContent = Ui('flight.captureMaps');
  Object.assign(toast.style, { position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    background:'#1d1d1f', color:'#fff', padding:'10px 22px', borderRadius:'20px',
    fontSize:'14px', fontFamily:'var(--font)', zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.3)' });
  document.body.appendChild(toast);

  try {
  const [mapCqUrl, mapXjUrl] = await Promise.all([
    captureMap('map-cq', 'page-overview', window._mapCQ),
    captureMap('map-xj', 'page-overview', window._mapXJ),
  ]);

  toast.textContent = Ui('flight.buildPdf');
  await new Promise(r => setTimeout(r, 50));

  function txt(key) {
    const el = document.querySelector(`[data-key="${key}"]`);
    return el ? el.innerText.trim() : '';
  }

  const allDays = allItineraryDays();
  const cqCount = DAYS_CQ.length;
  const xj1Count = DAYS_XJ1.length;
  const tmPdf = TRIP_META || {};
  const daysPdfStr = String(tmPdf.totalDays != null ? tmPdf.totalDays : allDays.length);
  const gsPdfStr = String(tmPdf.groupSize != null ? tmPdf.groupSize : 4);
  const drivePdfStr = escapeHtml(Tx(tmPdf.statDrivingKmApprox || ''));
  const budgetPdfStr = escapeHtml(Tx(tmPdf.statBudgetApprox || ''));
  const OvPdf = PAGE_SEED && PAGE_SEED.overview ? PAGE_SEED.overview : {};
  const heroSubPdfRaw = OvPdf.heroSub ? Tx(OvPdf.heroSub) : txt('hero-sub');

  function buildDayHtml(d) {
    const card = document.getElementById('card-' + d.id);
    if (card && card.classList.contains('card-hidden')) return '';
    const title = escapeHtml(txt(`${d.id}-title`) || Tx(d.title));
    const meta = escapeHtml(txt(`${d.id}-meta`) || dayMetaCombined(d));
    const desc = escapeHtml(txt(`${d.id}-desc`) || Tx(d.desc));

    const tlHtml = d.timeline
      ? `<div class="tl">${d.timeline.map(t =>
      `<div class="tl-item"><div class="tl-time">${escapeHtml(Tx(t.time))}</div><div class="tl-icon">${escapeHtml(String(t.icon || ''))}</div><div class="tl-lbl">${escapeHtml(Tx(t.label))}</div></div>`
    ).join('')}</div>` : '';

    const actsHtml = (d.activities || []).map((a, i) => {
      const name  = escapeHtml(txt(`${d.id}-act${i}-name`) || Tx(a.name));
      const adesc = escapeHtml(txt(`${d.id}-act${i}-desc`) || Tx(a.desc));
      const costRaw = txt(`${d.id}-act${i}-cost`) || (a.cost != null ? Tx(a.cost) : '');
      const cost  = escapeHtml(costRaw.replace(/^💰\s*/, ''));
      return `<div class="act">
        <span class="act-ico">${escapeHtml(String(a.icon || ''))}</span>
        <div>
          <div class="act-name">${name}</div>
          <div class="act-desc">${adesc}</div>
          ${cost ? `<div class="act-cost">💰 ${cost}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="day">
      <div class="day-hdr">
        <div class="day-num"><span>${escapeHtml(Tx(d.day))}</span><strong>${escapeHtml(dayCalendarLabel(d))}</strong><span>${escapeHtml(daySeqLabel(d.num))}</span></div>
        <div class="day-info"><div class="day-ttl">${title}</div><div class="day-meta">${meta}</div></div>
      </div>
      <div class="day-body">
        ${tlHtml}
        <p class="day-desc">${desc}</p>
        <div class="acts">${actsHtml}</div>
      </div>
    </div>`;
  }

  function buildStayHtml(s) {
    const card = document.getElementById('card-stay-' + s.id);
    if (card && card.classList.contains('card-hidden')) return '';
    const symStay = tmPdf.currencySymbol || '¥';
    const name  = escapeHtml(txt(`stay-${s.id}-name`) || Tx(s.name));
    const loc   = escapeHtml(txt(`stay-${s.id}-loc`) || Tx(s.loc));
    const areasRaw = txt(`stay-${s.id}-areas`);
    const areasJoin = areasRaw || (Array.isArray(s.areas) ? s.areas.map(x => Tx(x)).join(' · ') : '');
    const areas = escapeHtml(areasJoin);
    const min   = escapeHtml(txt(`stay-${s.id}-min`) || String(s.minPrice));
    const max   = escapeHtml(txt(`stay-${s.id}-max`) || String(s.maxPrice));
    const tip   = escapeHtml((txt(`stay-${s.id}-tip`) || Tx(s.tip)).replace(/^💡\s*/, ''));
    const nightsLbl = escapeHtml(Tx(s.nights));
    return `<div class="stay">
      <div class="stay-top"><span class="stay-name">${name}</span><span class="stay-nights">${nightsLbl}</span></div>
      <div class="stay-loc">📍 ${loc}</div>
      <div class="stay-price">${symStay}${min}–${max} <span class="stay-price-sub">${escapeHtml(Ui('stay.perNightWhole'))}</span></div>
      <div class="stay-areas">${escapeHtml(Ui('stay.bestAreas'))}: ${areas}</div>
      <div class="stay-tip">💡 ${tip}</div>
    </div>`;
  }

  function buildCostRowsPdf() {
    let lastSlug = '';
    const sym = tmPdf.currencySymbol || '¥';
    return COSTS.map((c, i) => {
      const slug = costRowSlug(c, i);
      const span = COSTS.filter((x, j) => costRowSlug(x, j) === slug).length;
      const catCell = slug !== lastSlug ? `<td class="cost-cat" rowspan="${span}">${escapeHtml(Tx(c.cat))}</td>` : '';
      if (slug !== lastSlug) lastSlug = slug;
      const itemTxt = txt(`cost-${i}-item`);
      const item  = escapeHtml(itemTxt || Tx(c.item));
      const totalTxt = txt(`cost-${i}-total`);
      const ppTxt = txt(`cost-${i}-pp`);
      const noteTxt = txt(`cost-${i}-note`);
      const totalSrc = totalTxt !== '' ? totalTxt : String(c.total ?? '');
      const ppSrc = ppTxt !== '' ? ppTxt : String(c.pp ?? '');
      const note  = escapeHtml(noteTxt || Tx(c.note));
      const totalNum = String(totalSrc).replace(/[^0-9.]/g, '');
      const totalFmt =
        totalNum && !Number.isNaN(Number(totalNum))
          ? sym + Number(totalNum).toLocaleString(undefined, { maximumFractionDigits: 0 })
          : sym + escapeHtml(totalSrc);
      const ppNum = String(ppSrc).replace(/[^0-9.]/g, '');
      const ppFmt =
        ppNum && !Number.isNaN(Number(ppNum))
          ? sym + Number(ppNum).toLocaleString(undefined, { maximumFractionDigits: 0 })
          : sym + escapeHtml(ppSrc);
      return `<tr>${catCell}<td>${item}</td><td class="cost-amt">${totalFmt}</td><td class="cost-pp">${ppFmt}</td><td class="cost-note">${note}</td></tr>`;
    }).join('');
  }

  function buildTipHtmlPdf(t, ti) {
    const card = document.getElementById('card-tip-' + ti);
    if (card && card.classList.contains('card-hidden')) return '';
    const title = escapeHtml(txt(`tip-${ti}-title`) || Tx(t.title));
    const items = (t.items || []).map((_, ii) =>
      `<li>${escapeHtml(txt(`tip-${ti}-item${ii}`) || Tx(t.items[ii]))}</li>`
    ).join('');
    return `<div class="tip-card"><div class="tip-ico">${escapeHtml(String(t.icon || ''))}</div><div class="tip-ttl">${title}</div><ul class="tip-list">${items}</ul></div>`;
  }

  const cqPdf = allDays.slice(0, cqCount).map(buildDayHtml).join('');
  const xjNorthPdf = allDays.slice(cqCount, cqCount + xj1Count).map(buildDayHtml).join('');
  const xjSouthPdf = allDays.slice(cqCount + xj1Count).map(buildDayHtml).join('');
  const staysHtml = STAYS.map(buildStayHtml).join('');
  const costRows  = buildCostRowsPdf();
  const tipsHtml  = TIPS.map(buildTipHtmlPdf).join('');

  const checklistState = loadChecklistState();
  const sortLabelsPdf = {
    urgency: Ui('checklist.sort.urgency'),
    category: Ui('checklist.sort.category'),
    city: Ui('checklist.sort.city'),
    date: Ui('checklist.sort.date'),
    status: Ui('checklist.sort.status'),
  };
  const pdfGroups = getChecklistGroups();
  const bookedPdf = Ui('checklist.slotBookedSuffix');
  const checklistHtml = pdfGroups.map(g => {
    const done  = g.items.filter(it => checklistState[it.id]).length;
    const total = g.items.length;
    return `<div class="cl-group-pdf">
      <div class="cl-group-pdf-hdr" style="background:${g.color}">
        <div><div class="cl-group-pdf-title">${escapeHtml(g.label)}</div><div class="cl-group-pdf-sub">${escapeHtml(g.sub)}</div></div>
        <div class="cl-group-pdf-badge">${done}/${total} ${escapeHtml(bookedPdf)}</div>
      </div>
      <div class="cl-items-pdf">
        ${g.items.map(it => {
          const checked = !!checklistState[it.id];
          return `<div class="cl-item-pdf">
            <div class="cl-box" style="${checked ? 'background:#34c759;border-color:#34c759' : ''}"></div>
            <div class="cl-ico-pdf">${escapeHtml(String(it.icon || ''))}</div>
            <div class="cl-body-pdf">
              <div class="cl-title-pdf"${checked ? ' style="text-decoration:line-through;color:#999"' : ''}>${escapeHtml(Tx(it.title))}</div>
              <div class="cl-dates-pdf">${escapeHtml(Tx(it.dates))}</div>
              <div class="cl-detail-pdf">${escapeHtml(Tx(it.detail))}</div>
              <div class="cl-meta-pdf"><strong>💰 ${escapeHtml(Tx(it.est))}</strong> &nbsp;·&nbsp; 🔗 ${escapeHtml(Tx(it.where))}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  const htmlLang = APP_LANG === 'zh' ? 'zh-Hans' : 'en';
  const heroSubPdf = escapeHtml(heroSubPdfRaw);
  const totalPP  = document.getElementById('total-pp')?.textContent    || budgetPdfStr;
  const totalGrp = document.getElementById('total-group')?.textContent || '';

  const pdfCssRaw = await fetch(contentUrl('styles/pdf-export.css')).then(r => {
    if (!r.ok) throw new Error(`pdf-export.css HTTP ${r.status}`);
    return r.text();
  });
  const pageRule = `@page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 14mm 14mm 16mm 14mm; }`;
  const CSS = pdfCssRaw.replace('/* __PDF_PAGE__ */', pageRule);

  const P = PAGE_SEED && PAGE_SEED.pdf ? PAGE_SEED.pdf : {};
  function pdfTx(key, fallback) {
    const raw = Object.prototype.hasOwnProperty.call(P, key) ? P[key] : fallback;
    return escapeHtml(Tx(raw));
  }

  const colCat = escapeHtml(Ui('pdf.thCategory'));
  const colItem = escapeHtml(Ui('pdf.thItem'));
  const colTot = escapeHtml(Ui('pdf.thGroup'));
  const colPp = escapeHtml(Ui('pdf.thPP'));
  const colNote = escapeHtml(Ui('pdf.thNotes'));
  const mapsFallback = `<p style="color:#888;font-size:9pt">${escapeHtml(Ui('pdf.mapsMissing'))}</p>`;

  const HTML = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pdfTx('docTitle', OvPdf.heroTitle || { en: 'Chongqing ↔ Xinjiang — itinerary', zh: '重庆 ↔ 新疆 — 行程' })}</title>
<style>${CSS}</style>
</head>
<body>

<div class="cover">
  <div>
    <div class="cover-label">${pdfTx('coverLabel')}</div>
    <div class="cover-title">${pdfTx('coverTitle', OvPdf.heroTitle || { en: 'Chongqing & Xinjiang', zh: '重庆与新疆' })}</div>
    <div class="cover-sub">${heroSubPdf}</div>
    <div class="stats">
      <div class="stat-box"><div class="stat-val">${escapeHtml(daysPdfStr)}</div><div class="stat-lbl">${escapeHtml(Ui('stat.daysTotal'))}</div></div>
      <div class="stat-box"><div class="stat-val">${escapeHtml(gsPdfStr)}</div><div class="stat-lbl">${escapeHtml(Ui('stat.travellers'))}</div></div>
      <div class="stat-box"><div class="stat-val">${drivePdfStr}</div><div class="stat-lbl">${escapeHtml(Ui('stat.drive'))}</div></div>
      <div class="stat-box"><div class="stat-val">${budgetPdfStr}</div><div class="stat-lbl">${escapeHtml(Ui('stat.pp').replace(/\{cur\}/g, tmPdf.currencySymbol || '¥'))}</div></div>
    </div>
  </div>
  <div class="cover-foot">${pdfTx('coverFoot')}</div>
</div>

<div class="sec">
  <div class="tag">${pdfTx('mapsTag')}</div>
  <h2>${pdfTx('mapsTitle')}</h2>
</div>
${(mapCqUrl || mapXjUrl) ? `
<div class="${isLandscape && mapCqUrl && mapXjUrl ? 'maps-grid' : ''}">
  ${mapCqUrl ? `<div class="map-section-pdf">
    <div class="map-label cq">🗺 ${pdfTx('mapCqLabel')}</div>
    <img class="map-img" src="${mapCqUrl}" alt="Map CQ">
    <div class="map-caption">${pdfTx('mapCqCaption')}</div>
  </div>` : ''}
  ${mapXjUrl ? `<div class="map-section-pdf">
    <div class="map-label xj">🗺 ${pdfTx('mapXjLabel')}</div>
    <img class="map-img" src="${mapXjUrl}" alt="Map XJ">
    <div class="map-caption">${pdfTx('mapXjCaption')}</div>
  </div>` : ''}
</div>` : mapsFallback}

<div class="sec">
  <div class="tag">${pdfTx('secCqTag')}</div>
  <h2>${pdfTx('secCqTitle')}</h2>
</div>
${cqPdf}

<div class="sec">
  <div class="tag">${pdfTx('secXjTag')}</div>
  <h2>${pdfTx('secXjTitle')}</h2>
</div>
${xjNorthPdf}
${xjSouthPdf ? `<div class="sec">
  <div class="tag">${pdfTx('secXjSouthTag')}</div>
  <h2>${pdfTx('secXjSouthTitle')}</h2>
</div>${xjSouthPdf}` : ''}

<div class="sec">
  <div class="tag">${pdfTx('staysTag')}</div>
  <h2>${pdfTx('staysTitle')}</h2>
</div>
${staysHtml}

<div class="sec">
  <div class="tag">${pdfTx('budgetTag')}</div>
  <h2>${pdfTx('budgetTitle')}</h2>
</div>
<div class="b-totals">
  <div class="b-total"><div class="b-val">${escapeHtml(totalPP)}</div><div class="b-lbl">${escapeHtml(Ui('pdf.budgetPpLbl'))}</div></div>
  <div class="b-total"><div class="b-val">${escapeHtml(totalGrp)}</div><div class="b-lbl">${escapeHtml(Ui('pdf.budgetGrpLbl'))}</div></div>
</div>
<table class="ctable">
  <thead><tr><th>${colCat}</th><th>${colItem}</th><th>${colTot}</th><th>${colPp}</th><th>${colNote}</th></tr></thead>
  <tbody>${costRows}</tbody>
</table>

<div class="sec">
  <div class="tag">${pdfTx('tipsTag')}</div>
  <h2>${pdfTx('tipsTitle')}</h2>
</div>
<div class="tips">${tipsHtml}</div>

<div class="sec">
  <div class="tag">${pdfTx('checklistTag')}</div>
  <h2>${pdfTx('checklistTitle')}</h2>
  <p style="font-size:9pt;color:#888;margin-top:4pt">${escapeHtml(pdfTx('checklistSorted'))}: ${escapeHtml(sortLabelsPdf[clSort] || sortLabelsPdf.urgency)}</p>
</div>
${checklistHtml}

</body>
</html>`;


  if (toast.parentNode) toast.parentNode.removeChild(toast);

  // Use a hidden iframe instead of window.open() — avoids Safari popup blocker
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;pointer-events:none';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(HTML);
  iframe.contentDocument.close();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 3000);
  }, 700);
  } catch (e) {
    console.error('doExportPDF', e);
    showAlert(
      `${Ui('pdf.alertFail') || 'PDF export failed'} (${e.message || 'unknown'})`,
      Ui('modal.pdfTitle') || 'PDF',
    );
  } finally {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }
}

// ═══════════════════════════════════════
// VERSION HISTORY
// ═══════════════════════════════════════
function openVersionModal() {
  closeTopToolsMenu();
  if (!VERSIONS || !Array.isArray(VERSIONS)) return;
  const list = document.getElementById('versionList');
  list.innerHTML = VERSIONS.slice().sort(compareVersionDesc).map(v => `
    <div class="ver-entry">
      <div class="ver-entry-hdr">
        <span class="ver-badge${v.latest?' latest':''}">v${v.v}</span>
        <div>
          <div class="ver-entry-title">${v.title}</div>
          <div class="ver-entry-date">${v.date}</div>
        </div>
      </div>
      <ul class="ver-changes">${v.changes.map(c=>`<li>${c}</li>`).join('')}</ul>
    </div>`).join('');
  document.getElementById('versionModal').classList.add('open');
}

// ═══════════════════════════════════════
// SMART MERGE
// ═══════════════════════════════════════
let _pendingConflicts = [];
let _pendingMergedSnap = {};
let _conflictChoices = {};

function loadFreshSnap() {
  try { return JSON.parse(localStorage.getItem('tripFreshSnapshot') || 'null'); } catch { return null; }
}

function checkVersionMerge() {
  const storedVer   = localStorage.getItem('tripAppVersion');
  const storedFresh = loadFreshSnap();
  const history     = loadHistory();

  // Capture the clean render (before any user edits applied)
  const freshSnap = captureSnapshot();

  // Always update the stored fresh snapshot and version for next load
  localStorage.setItem('tripFreshSnapshot', JSON.stringify(freshSnap));
  localStorage.setItem('tripAppVersion', APP_VERSION);

  // Update pill
  const pill = document.getElementById('ver-pill-label');
  if (pill) pill.textContent = 'v' + APP_VERSION;

  if (!history.length) return; // No user edits — nothing to merge

  const userSnap = history[history.length - 1].snapshot;

  if (!storedVer || storedVer === APP_VERSION) {
    // Same version — apply user edits normally
    applySnapshot(userSnap);
    return;
  }

  // ── Version changed: 3-way merge ────────────────────────────
  const mergedSnap = Object.assign({}, freshSnap);
  const conflicts  = [];
  const allKeys    = new Set([...Object.keys(freshSnap), ...Object.keys(userSnap)]);

  allKeys.forEach(key => {
    if (key === '_deletedCards') return;
    const devText  = stripHTML(freshSnap[key]  || '');
    const userText = stripHTML(userSnap[key]   || '');
    const baseText = storedFresh ? stripHTML(storedFresh[key] || '') : devText;

    const userChanged = userText !== baseText;
    const devChanged  = devText  !== baseText;

    if (userChanged && devChanged) {
      // Genuine conflict
      const el    = document.querySelector(`[data-key="${key}"]`);
      const label = el?.dataset.label || key;
      conflicts.push({ key, label,
        devVal:  freshSnap[key] || '',
        userVal: userSnap[key]  || '' });
      // Default to developer's version in merged snap
      mergedSnap[key] = freshSnap[key];
    } else if (userChanged) {
      // User edited, dev left alone — keep user version
      mergedSnap[key] = userSnap[key];
    }
    // else dev changed or nothing changed — keep fresh (already default)
  });

  // Merge deleted cards: honour any the user hid
  const userDel = userSnap._deletedCards || [];
  const devDel  = freshSnap._deletedCards || [];
  mergedSnap._deletedCards = [...new Set([...devDel, ...userDel])];

  applySnapshot(mergedSnap);

  // Persist the merged state as the latest history entry
  history.push({ timestamp: new Date().toISOString(), snapshot: mergedSnap,
    note: `Auto-merged from v${storedVer} → v${APP_VERSION}` });
  saveHistory(history);

  if (conflicts.length) {
    setTimeout(() => openConflictModal(conflicts, mergedSnap), 400);
  } else {
    // Count how many user edits survived
    const saved = [...allKeys].filter(k => {
      if (k === '_deletedCards') return false;
      const u = stripHTML(userSnap[k] || '');
      const b = storedFresh ? stripHTML(storedFresh[k] || '') : '';
      return u !== b;
    }).length;
    if (saved > 0) showMergeToast(saved);
  }
}

function showToast(msg, duration) {
  const t = document.createElement('div');
  t.innerHTML = msg;
  Object.assign(t.style, {
    position:'fixed',bottom:'80px',left:'50%',transform:'translateX(-50%)',
    background:'#1d1d1f',color:'#fff',padding:'11px 22px',borderRadius:'12px',
    fontSize:'13px',fontFamily:'var(--font)',zIndex:'9999',
    boxShadow:'0 4px 20px rgba(0,0,0,.3)',lineHeight:'1.55',
    maxWidth:'380px',textAlign:'center',transition:'opacity .5s',whiteSpace:'nowrap'
  });
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),500); }, duration||3500);
}

function showMergeToast(count) {
  showToast(`✅ Updated to <strong>v${APP_VERSION}</strong> — ${count} of your edit${count!==1?'s were':' was'} preserved automatically.`, 4000);
}

function openConflictModal(conflicts, mergedSnap) {
  _pendingConflicts  = conflicts;
  _pendingMergedSnap = Object.assign({}, mergedSnap);
  _conflictChoices   = {};
  conflicts.forEach(c => { _conflictChoices[c.key] = 'dev'; });

  document.getElementById('conflictBanner').innerHTML =
    `The app was updated to <strong>v${APP_VERSION}</strong>. ${conflicts.length} field${conflicts.length!==1?'s were':' was'} changed both by the update and by your edits. Review each conflict below — the update's version is selected by default.`;

  document.getElementById('conflictList').innerHTML = conflicts.map((c,i) => `
    <div class="conflict-item" id="cfi-${i}">
      <div class="conflict-item-hdr">⚠️ ${c.label}</div>
      <div class="conflict-vals">
        <div class="conflict-val">
          <div class="conflict-val-lbl">${escapeHtml(Ui('conflict.pickNew'))}</div>
          <div class="conflict-val-text" id="cfdev-${i}">${stripHTML(c.devVal)||'(empty)'}</div>
        </div>
        <div class="conflict-val">
          <div class="conflict-val-lbl">${escapeHtml(Ui('conflict.pickOld'))}</div>
          <div class="conflict-val-text" id="cfuser-${i}">${stripHTML(c.userVal)||'(empty)'}</div>
        </div>
      </div>
      <div class="conflict-choice">
        <button class="conf-btn chosen" id="cfbtn-dev-${i}"  onclick="chooseConflict(${i},'dev')">Use new version</button>
        <button class="conf-btn"        id="cfbtn-user-${i}" onclick="chooseConflict(${i},'user')">Keep my edit</button>
      </div>
    </div>`).join('');

  document.getElementById('conflictModal').classList.add('open');
}

function chooseConflict(i, choice) {
  const key = _pendingConflicts[i].key;
  _conflictChoices[key] = choice;
  document.getElementById('cfbtn-dev-'+i).classList.toggle('chosen',  choice==='dev');
  document.getElementById('cfbtn-user-'+i).classList.toggle('chosen', choice==='user');
  document.getElementById('cfdev-'+i).classList.toggle('selected',    choice==='dev');
  document.getElementById('cfuser-'+i).classList.toggle('selected',   choice==='user');
}

function resolveAllConflicts(choice) {
  _pendingConflicts.forEach((_,i) => chooseConflict(i, choice));
}

function saveConflictChoices() {
  const snap = Object.assign({}, _pendingMergedSnap);
  _pendingConflicts.forEach(c => {
    snap[c.key] = _conflictChoices[c.key] === 'user' ? c.userVal : c.devVal;
  });
  applySnapshot(snap);
  const history = loadHistory();
  if (history.length) {
    history[history.length-1].snapshot = snap;
    saveHistory(history);
  }
  document.getElementById('conflictModal').classList.remove('open');
  _pendingConflicts = []; _pendingMergedSnap = {}; _conflictChoices = {};
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
function init() {
  seedOverviewFromPageSeed();
  renderDays(DAYS_CQ, 'days-cq');
  renderDays(DAYS_XJ1, 'days-xj1');
  renderDays(DAYS_XJ2, 'days-xj2');
  renderStays();
  renderCostTable();
  renderTips();
  loadClSortPreference();
  syncClSortButtons();
  renderChecklist();

  loadFlightOverlay();
  refreshFlightChromeI18n();
  renderFlights();

  applyUiAnchors();
  refreshLangClasses();
  refreshLangSidebarToggle();
  refreshPlannerChromeI18n();

  checkVersionMerge(); // applies history + handles version-change merge
  captureDomDefaultsFromDom();
  setTimeout(initMaps, 200);
}

// ═══════════════════════════════════════
// MAPS
// ═══════════════════════════════════════

function captureDomDefaultsFromDom() {
  DOM_DEFAULT_HTML = {};
  document.querySelectorAll('[data-key]').forEach(el => {
    if (el.dataset.key) DOM_DEFAULT_HTML[el.dataset.key] = el.innerHTML;
  });
}

/** Apply JSON-driven overview copy (dual-language spans inside hero + key stats rows). */
function seedOverviewFromPageSeed() {
  const ov = PAGE_SEED && PAGE_SEED.overview;
  const tm = TRIP_META || {};
  const days = tm.totalDays != null ? String(tm.totalDays) : String(allItineraryDays().length);
  const people = tm.groupSize != null ? String(tm.groupSize) : '4';
  const drive = Tx(tm.statDrivingKmApprox || '');
  const bud = Tx(tm.statBudgetApprox || '');
  document.querySelectorAll('[data-trip-stat]').forEach(el => {
    const which = el.getAttribute('data-trip-stat');
    if (which === 'days') el.textContent = days;
    else if (which === 'people') el.textContent = people;
    else if (which === 'km') el.textContent = drive;
    else if (which === 'budget') el.textContent = bud;
  });
  const tagEl = document.getElementById('overview-hero-tag');
  const titleEl = document.getElementById('overview-hero-title');
  const subEl = document.getElementById('overview-hero-sub');
  if (!ov) return;
  if (tagEl && ov.heroTag) tagEl.innerHTML = lngMarkup(ov.heroTag);
  if (titleEl && ov.heroTitle) titleEl.innerHTML = lngMarkup(ov.heroTitle);
  if (subEl && ov.heroSub) subEl.innerHTML = lngMarkup(ov.heroSub);
  const jd = document.getElementById('overview-route-cq-caption');
  const xjd = document.getElementById('overview-route-xj-caption');
  if (jd && ov.routeChongqingCaption) jd.innerHTML = lngMarkup(ov.routeChongqingCaption);
  if (xjd && ov.routeXinjiangCaption) xjd.innerHTML = lngMarkup(ov.routeXinjiangCaption);
}

function refreshFlightChromeI18n() {
  document.querySelectorAll('.flight-board-sec-tag').forEach(el => {
    el.textContent = Ui('flight.schedule');
  });
  document.querySelectorAll('.flight-board-sec-title').forEach(el => {
    el.textContent = Ui('flight.yours');
  });
  const addBtn = document.getElementById('flight-add-btn');
  if (addBtn) addBtn.textContent = Ui('flight.add');
  updateFlightBoardToggleLabelOnly();
}

function updateFlightBoardToggleLabelOnly() {
  const btn = document.getElementById('flight-board-toggle');
  const wrap = document.getElementById('flight-board-section');
  if (!btn || !wrap) return;
  const collapsed = wrap.classList.contains('flight-board-wrap--collapsed');
  btn.textContent = collapsed ? Ui('flight.show') : Ui('flight.hide');
}

function tripBuildOneRegionalMap(sectionKey, elId) {
  try {
    const spec = MAPS_DATA[sectionKey];
    const el = document.getElementById(elId);
    if (!spec || !el || !Array.isArray(spec.stops) || spec.stops.length === 0) return null;

    const tileOpts = { maxZoom: 19, attribution: '© Esri', crossOrigin: true };
    const c = spec.center;
    let lat0;
    let lng0;
    if (Array.isArray(c) && c.length >= 2) {
      lat0 = c[0];
      lng0 = c[1];
    } else {
      lat0 = spec.stops[0].lat;
      lng0 = spec.stops[0].lng;
    }
    const zm = Number(spec.zoom) > 0 ? spec.zoom : 8;

    const map = L.map(elId, { zoomControl: true, scrollWheelZoom: false }).setView([lat0, lng0], zm);
    L.tileLayer(TRIP_SATELLITE_TILE_URL, tileOpts).addTo(map);

    const hueMain = sectionKey === 'cq' ? '#0284c7' : '#f97316';
    const hueLine = sectionKey === 'cq' ? '#7dd3fc' : '#fdba74';

    const mainSeq = spec.stops.filter(s => !s.daytrip);
    const mainLngLat = mainSeq.map(s => [s.lng, s.lat]);
    if (mainLngLat.length >= 2) {
      const path = tripLineLngLatToLeaflet(tripGreatCircleLine(mainLngLat, 28));
      L.polyline(path, { color: hueMain, weight: 11, opacity: 0.38, lineJoin: 'round' }).addTo(map);
      L.polyline(path, { color: hueLine, weight: 3.5, opacity: 0.92, lineJoin: 'round' }).addTo(map);
    }

    spec.stops.forEach(s => {
      const hue = sectionKey === 'cq' ? (s.daytrip ? '#22c55e' : hueMain) : s.daytrip ? '#22c55e' : '#ff9500';
      const sz = s.daytrip ? 24 : 28;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${hue};border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:${
          s.daytrip ? 10 : 11
        }px;font-weight:700;color:#fff;font-family:var(--font),system-ui,sans-serif">${s.num}</div>`,
        iconSize: [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
        popupAnchor: [0, -sz / 2],
      });
      L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(Tx(s.label))}</strong><br/>${escapeHtml(Tx(s.note))}`);
    });

    try {
      map.fitBounds(L.latLngBounds(spec.stops.map(st => [st.lat, st.lng])), {
        padding: [50, 50],
        maxZoom: sectionKey === 'cq' ? 11 : 8,
      });
    } catch (_) {
      map.setView([lat0, lng0], zm);
    }
    return map;
  } catch (e) {
    console.warn('tripBuildOneRegionalMap', sectionKey, e);
    return null;
  }
}

function initMaps() {
  try {
    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded; maps disabled');
      return;
    }
    window._mapCQ = tripBuildOneRegionalMap('cq', 'map-cq');
    window._mapXJ = tripBuildOneRegionalMap('xj', 'map-xj');

    requestAnimationFrame(() => {
      window._mapCQ && window._mapCQ.invalidateSize();
      window._mapXJ && window._mapXJ.invalidateSize();
    });
  } catch (e) {
    console.error('initMaps', e);
  }
}

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
const _AH = 'c3edd6e8d8e13da6055b9a49976fba14fa65141dc63bc1ab103d3a4518963424';
const _AS = 'CQXJ_planner_v1';
const _AK = 'tripAuthToken';

async function _hashInput(val) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val + _AS));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function checkAuth() {
  const stored = localStorage.getItem(_AK);
  if (stored === _AH) {
    document.documentElement.classList.add('auth-cached');
    document.getElementById('auth-overlay').classList.add('hidden');
    maybeShowOnboarding();
    return;
  }
  // Focus input after overlay is shown
  setTimeout(() => document.getElementById('auth-input')?.focus(), 50);
}

async function submitAuth() {
  const input = document.getElementById('auth-input');
  const btn   = document.getElementById('auth-btn');
  const err   = document.getElementById('auth-error');
  const val   = input.value.trim();
  if (!val) return;

  btn.disabled = true;
  btn.textContent = Ui('auth.checking');
  err.textContent = '';

  try {
    if (!globalThis.crypto?.subtle) {
      err.textContent = Ui('auth.secureHint');
      return;
    }
    const hash = await _hashInput(val);
    if (hash === _AH) {
      if (document.getElementById('auth-remember').checked) {
        localStorage.setItem(_AK, _AH);
        document.documentElement.classList.add('auth-cached');
      }
      document.getElementById('auth-overlay').classList.add('hidden');
      maybeShowOnboarding();
    } else {
      input.value = '';
      input.classList.add('error');
      err.textContent = Ui('auth.wrong');
      setTimeout(() => input.classList.remove('error'), 400);
      input.focus();
    }
  } catch (e) {
    console.error(e);
    err.textContent = Ui('auth.verifyFail');
  } finally {
    btn.disabled = false;
    btn.textContent = Ui('auth.unlock');
  }
}

/* Inline handlers resolve on `window`; async fns and some engines need explicit assignment. */
window.submitAuth = submitAuth;
window.doExportPDF = doExportPDF;
window.setClSort = setClSort;
window.doRevertAll = doRevertAll;
window.openBackupModal = openBackupModal;
window.closeBackupModal = closeBackupModal;
window.doBackupDownload = doBackupDownload;
window.startBackupRestore = startBackupRestore;
window.startBackupRestoreFromLogin = startBackupRestoreFromLogin;

function _safeBottomPx() {
  let n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom').trim());
  if (!Number.isFinite(n) || n < 0) n = 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:-9999px;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none;opacity:0;visibility:hidden';
  document.body.appendChild(probe);
  const probed = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return Math.max(n, probed);
}

/**
 * Bottom insets for `.main` scroll padding and the SW update pill. No floating edit bar —
 * padding grows only when the update strip is visible so content can scroll clear of it.
 */
function setupMainChromeInsets() {
  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      applyNow();
    });
  }

  function applyNow() {
    const safe = _safeBottomPx();
    const narrow = window.matchMedia && window.matchMedia('(max-width:768px)').matches;
    const basePad = (narrow ? 24 : 28) + safe;
    let pad = basePad;
    const swBar = document.getElementById('sw-update-bar');
    if (swBar && swBar.classList.contains('sw-update-bar--visible')) {
      const inner = swBar.querySelector('.sw-update-inner');
      const uh = inner ? Math.max(inner.offsetHeight, inner.getBoundingClientRect().height) : swBar.offsetHeight;
      if (uh > 4) pad += Math.ceil(uh + 12);
    }
    document.documentElement.style.setProperty('--main-scroll-pad-bottom', `${pad}px`);
    document.documentElement.style.setProperty('--sw-update-bottom', `${Math.ceil(12 + safe)}px`);
  }

  function observeSwBarIfPresent() {
    const swBar = document.getElementById('sw-update-bar');
    if (!swBar || swBar.dataset.chromeInsetsObserved) return;
    swBar.dataset.chromeInsetsObserved = '1';
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(schedule);
      ro.observe(swBar);
      const inner = swBar.querySelector('.sw-update-inner');
      if (inner) ro.observe(inner);
    }
  }

  new MutationObserver(() => {
    observeSwBarIfPresent();
    schedule();
  }).observe(document.body, { childList: true, subtree: false });

  schedule();
  setTimeout(schedule, 80);
  window.addEventListener('load', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  observeSwBarIfPresent();
}

function positionTopToolsMenu(trigger) {
  const menu = document.getElementById('topToolsMenu');
  if (!menu || !trigger) return;
  const rect = trigger.getBoundingClientRect();
  const estW = Math.min(320, window.innerWidth - 24);
  let left = rect.right - estW;
  left = Math.max(12, Math.min(left, window.innerWidth - estW - 12));
  menu.style.left = `${left}px`;
  menu.style.top = `${rect.bottom + 8}px`;
  menu.classList.add('open');
  requestAnimationFrame(() => {
    const mh = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    if (mh > spaceBelow && rect.top > mh + 8) {
      menu.style.top = `${Math.max(8, rect.top - mh - 8)}px`;
      const t = parseFloat(menu.style.top) || 0;
      if (t + mh > window.innerHeight - 8) {
        menu.style.top = `${Math.max(8, window.innerHeight - mh - 8)}px`;
      }
    }
  });
}

function closeTopToolsMenu() {
  const menu = document.getElementById('topToolsMenu');
  if (!menu) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  ['mobileTopCog', 'desktopTopCog'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-expanded', 'false');
  });
}

function toggleTopToolsMenu(ev) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const menu = document.getElementById('topToolsMenu');
  const trigger = ev && ev.currentTarget;
  if (!menu || !trigger) return;
  if (menu.classList.contains('open')) {
    closeTopToolsMenu();
    return;
  }
  positionTopToolsMenu(trigger);
  menu.setAttribute('aria-hidden', 'false');
  ['mobileTopCog', 'desktopTopCog'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-expanded', String(el === trigger));
  });
}

function initTopToolsMenu() {
  document.addEventListener(
    'click',
    (e) => {
      const menu = document.getElementById('topToolsMenu');
      if (!menu || !menu.classList.contains('open')) return;
      if (menu.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('#mobileTopCog, #desktopTopCog')) return;
      closeTopToolsMenu();
    },
    true
  );
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeTopToolsMenu();
  });
  window.addEventListener('resize', () => {
    if (document.getElementById('topToolsMenu')?.classList.contains('open')) closeTopToolsMenu();
  });
}

window.toggleTopToolsMenu = toggleTopToolsMenu;
window.closeTopToolsMenu = closeTopToolsMenu;

/** In-app PWA update: new worker waits until the user taps Update, then reloads once (localStorage is kept). */
function setupServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return;

  let sawController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!sawController) {
      sawController = true;
      return;
    }
    window.location.reload();
  });

  let updateBarShown = false;
  function showSwUpdateBar(onActivate) {
    if (updateBarShown) return;
    updateBarShown = true;
    const bar = document.createElement('div');
    bar.id = 'sw-update-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '<div class="sw-update-inner">' +
      '<span class="sw-update-msg">A new version is ready. Your saved trip data stays on this device.</span>' +
      '<button type="button" class="btn btn-blue sw-update-btn">Update</button>' +
      '</div>';
    bar.querySelector('.sw-update-btn').addEventListener('click', () => onActivate());
    document.body.appendChild(bar);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.classList.add('sw-update-bar--visible');
        window.dispatchEvent(new Event('resize'));
      });
    });
  }

  navigator.serviceWorker
    .register(contentUrl('sw.js'))
    .then((reg) => {
      const pingWaiting = () => {
        if (reg.waiting) {
          showSwUpdateBar(() => reg.waiting.postMessage({ type: 'SKIP_WAITING' }));
        }
      };

      reg.addEventListener('updatefound', () => {
        const inst = reg.installing;
        if (!inst) return;
        inst.addEventListener('statechange', () => {
          if (inst.state === 'installed' && navigator.serviceWorker.controller) {
            pingWaiting();
          }
        });
      });

      pingWaiting();

      const check = () => {
        reg.update();
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
    })
    .catch((err) => console.warn('[Triple] service worker registration failed', err));
}

window.addEventListener('DOMContentLoaded', () => {
  setupMainChromeInsets();
  initTopToolsMenu();
  initModalScrollLockObservers();
  setupServiceWorkerUpdates();
  buildAirlineSearchIndex();
  initFlightModalTypeahead();

  const flightAddBtnEarly = document.getElementById('flight-add-btn');
  if (flightAddBtnEarly) {
    flightAddBtnEarly.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFlightAddModal();
    });
  }

  document.getElementById('flight-f-connection')?.addEventListener('change', updateConnectionFormVisibility);

  initFlightBoardSectionToggle();

  const backupInput = document.getElementById('backupFileInput');
  if (backupInput) {
    backupInput.addEventListener('change', () => {
      const f = backupInput.files && backupInput.files[0];
      backupInput.value = '';
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = typeof reader.result === 'string' ? reader.result : '';
          const data = parseTripleBackupJSON(text);
          applyTripleBackup(data);
          window.location.reload();
        } catch (e) {
          console.error(e);
          showAlert(
            e.message || 'This file could not be restored. Export a new backup from the app and try again.',
            'Backup & restore'
          );
        }
      };
      reader.onerror = () => {
        showAlert('Could not read the chosen file.', 'Backup & restore');
      };
      reader.readAsText(f, 'utf-8');
    });
  }

  (function setupTouchTips() {
    const tip = document.createElement('div');
    tip.id = 'touch-tip';
    document.body.appendChild(tip);
    let hideTimer, _startX = 0, _startY = 0;

    document.addEventListener('touchstart', function(e) {
      _startX = e.touches[0].clientX;
      _startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      const dx = Math.abs(e.changedTouches[0].clientX - _startX);
      const dy = Math.abs(e.changedTouches[0].clientY - _startY);
      if (dx > 8 || dy > 8) return;

      const target = e.target.closest('[data-tip]');
      if (!target) { tip.classList.remove('tt-show'); return; }

      clearTimeout(hideTimer);
      tip.textContent = target.getAttribute('data-tip');

      const rect = target.getBoundingClientRect();
      const vw = window.innerWidth;
      let left = rect.left + rect.width / 2;
      left = Math.max(112, Math.min(vw - 112, left));
      tip.style.left = left + 'px';
      tip.style.top = Math.max(rect.top, 60) + 'px';
      tip.classList.add('tt-show');

      hideTimer = setTimeout(() => tip.classList.remove('tt-show'), 3000);
    }, { passive: true });
  })();

  (async () => {
    let dataLoaded = false;
    try {
      await loadTripData();
      await loadAirports();
      await refreshFlightsFromNetwork();
      dataLoaded = true;
    } catch (e) {
      console.error(e);
      alert('Could not load content/trip-data.json. If testing locally, use a static server (e.g. npx serve). On GitHub Pages, verify content/trip-data.json is published.');
    }
    if (dataLoaded) {
      try {
        applyUiAnchors();
        refreshLangClasses();
        refreshLangSidebarToggle();
      } catch (e) {
        console.error('applyUiAnchors (pre-auth)', e);
      }
    }
    try {
      checkAuth();
    } catch (e) {
      console.error('checkAuth', e);
    }
    if (dataLoaded) {
      try {
        init();
      } catch (e) {
        console.error('init', e);
      }
    }
  })();
});

// ═══════════════════════════════════════
// ONBOARDING & WHAT'S NEW
// ═══════════════════════════════════════
const ONBOARD_STEP_COUNT = 4;
let onboardStep = 0;
let onboardLangChosen = false;

function renderOnboardStep() {
  const pill = document.getElementById('onboardPill');
  if (pill) pill.textContent = `${onboardStep + 1} / ${ONBOARD_STEP_COUNT}`;

  document.querySelectorAll('.onboard-step').forEach(el => {
    const n = parseInt(el.getAttribute('data-onboard-step') || '0', 10);
    const active = n === onboardStep;
    el.classList.toggle('active', active);
    el.hidden = !active;
  });

  const back = document.getElementById('onboardBack');
  const next = document.getElementById('onboardNext');
  if (back) back.hidden = onboardStep === 0;
  if (next) {
    const finish = onboardStep === ONBOARD_STEP_COUNT - 1;
    next.textContent = Ui(finish ? 'onboard.finish' : 'onboard.next');
    next.disabled = onboardStep === 0 && !onboardLangChosen;
  }
  updateOnboardLangButtons();
  syncModalScrollLock();
}

function updateOnboardLangButtons() {
  document.querySelectorAll('[data-onboard-lang]').forEach(btn => {
    const l = btn.getAttribute('data-onboard-lang');
    btn.classList.toggle('onboard-lang-btn--active', onboardLangChosen && l === APP_LANG);
    btn.setAttribute('aria-pressed', onboardLangChosen && l === APP_LANG ? 'true' : 'false');
  });
}

function openOnboardingWizard(startStep = 0) {
  if (isAlreadyInstalledWebApp() && startStep === ONBOARD_STEP_COUNT - 1) {
    finishOnboarding();
    return;
  }
  onboardStep = Math.max(0, Math.min(startStep, ONBOARD_STEP_COUNT - 1));
  try {
    onboardLangChosen = !!localStorage.getItem(LANG_KEY);
  } catch (_) {
    onboardLangChosen = false;
  }
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  renderOnboardStep();
  modal.classList.add('open');
}

function pickOnboardLang(lang) {
  setTripLang(lang);
  onboardLangChosen = true;
  const next = document.getElementById('onboardNext');
  if (next) next.disabled = false;
  updateOnboardLangButtons();
}

function onboardNextClick() {
  if (onboardStep === 0 && !onboardLangChosen) return;
  if (onboardStep === ONBOARD_STEP_COUNT - 2 && isAlreadyInstalledWebApp()) {
    finishOnboarding();
    return;
  }
  if (onboardStep >= ONBOARD_STEP_COUNT - 1) {
    finishOnboarding();
    return;
  }
  onboardStep += 1;
  if (onboardStep === ONBOARD_STEP_COUNT - 1 && isAlreadyInstalledWebApp()) {
    finishOnboarding();
    return;
  }
  renderOnboardStep();
}

function onboardBackClick() {
  if (onboardStep <= 0) return;
  onboardStep -= 1;
  renderOnboardStep();
}

function finishOnboarding() {
  document.getElementById('onboardingModal')?.classList.remove('open');
  try {
    localStorage.setItem('tripWelcomeSeen', '1');
    localStorage.setItem(ADD_TO_HOME_DISMISSED_KEY, '1');
    if (APP_VERSION) localStorage.setItem('tripLastSeenVersion', APP_VERSION);
  } catch (_) {}
  syncModalScrollLock();
}

window.pickOnboardLang = pickOnboardLang;
window.onboardNextClick = onboardNextClick;
window.onboardBackClick = onboardBackClick;

function maybeShowOnboarding() {
  if (APP_VERSION == null || !VERSIONS || !Array.isArray(VERSIONS)) return;
  const welcomed = localStorage.getItem('tripWelcomeSeen');
  const lastSeen = localStorage.getItem('tripLastSeenVersion');

  if (!welcomed) {
    setTimeout(() => openOnboardingWizard(0), 600);
  } else if (lastSeen !== APP_VERSION) {
    localStorage.setItem('tripLastSeenVersion', APP_VERSION);
    setTimeout(() => openWhatsNewModal(), 600);
  }
}

function isAlreadyInstalledWebApp() {
  try {
    if (window.navigator.standalone === true) return true;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch (e) {}
  return false;
}

function otherOnboardingModalOpen() {
  return (
    document.getElementById('onboardingModal')?.classList.contains('open') ||
    document.getElementById('whatsNewModal')?.classList.contains('open') ||
    document.getElementById('conflictModal')?.classList.contains('open')
  );
}

/** @deprecated kept for any stale onclick handlers */
function dismissAddToHomeHint() {
  finishOnboarding();
}

window.dismissAddToHomeHint = dismissAddToHomeHint;

function openWhatsNewModal() {
  if (!VERSIONS || !Array.isArray(VERSIONS)) return;
  const latest = VERSIONS.find(v => v.latest);
  if (!latest) return;
  document.getElementById('whatsNewSub').textContent =
    `Updated to v${latest.v} — ${latest.title}. Here's what changed:`;
  document.getElementById('whatsNewList').innerHTML =
    `<ul class="wn-changes">${latest.changes.map(c => `<li>${c}</li>`).join('')}</ul>`;
  document.getElementById('whatsNewModal').classList.add('open');
}
