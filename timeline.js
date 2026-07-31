(() => {
  'use strict';

  const DEFAULT_SHEET_STORAGE_KEY = 'chrona-default-sheet-url';
  const DEFAULT_EVENT_GID = 681184261;
  const DEFAULT_CATEGORY_GID = 1068523108;
  const DEFAULT_AXIS_Y_RATIO = 0.47;
  const MIN_VISIBLE_YEARS = 0.08;
  const MAX_VISIBLE_YEARS = 12000;

  const DETAILS_ENABLED = true;

  const canvas = document.getElementById('timelineCanvas');
  const ctx = canvas.getContext('2d');
  const viewport = document.getElementById('timelineViewport');
  const labelLayer = document.getElementById('labelLayer');
  const leaderCanvas = document.getElementById('leaderCanvas');
  const leaderCtx = leaderCanvas.getContext('2d');
  const tooltip = document.getElementById('tooltip');
  const statusEl = document.getElementById('status');
  const quickFiltersEl = document.getElementById('categoryQuickFilters');
  const aboveSetsButton = document.getElementById('aboveSetsButton');
  const aboveSetsSummary = document.getElementById('aboveSetsSummary');
  const aboveSetsMenu = document.getElementById('aboveSetsMenu');
  const aboveSetsCount = document.getElementById('aboveSetsCount');
  const aboveSetsSearch = document.getElementById('aboveSetsSearch');
  const aboveSetsList = document.getElementById('aboveSetsList');
  const sheetUrlInput = document.getElementById('sheetUrl');
  const filterTemplate = document.getElementById('filterTemplate');
  const zoomDial = document.getElementById('zoomDial');
  const zoomRail = document.querySelector('.zoom-rail');
  const themeButtons = [...document.querySelectorAll('.theme-option')];
  const visualThemeButtons = [...document.querySelectorAll('[data-visual-theme-value]')];
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsBackdrop = document.getElementById('settingsBackdrop');
  const settingsClose = document.getElementById('settingsClose');
  const defaultSheetUrlInput = document.getElementById('defaultSheetUrl');
  const useCurrentSheetUrlButton = document.getElementById('useCurrentSheetUrl');
  const saveDefaultSheetUrlButton = document.getElementById('saveDefaultSheetUrl');
  const clearDefaultSheetUrlButton = document.getElementById('clearDefaultSheetUrl');
  const defaultSheetStatus = document.getElementById('defaultSheetStatus');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const searchInput = document.getElementById('timelineSearch');
  const searchToggle = document.getElementById('searchToggle');
  const sheetControl = document.getElementById('sheetControl');
  const sheetToggle = document.getElementById('sheetToggle');
  const reloadButton = document.getElementById('reloadData');
  const searchControl = document.querySelector('.search-control');
  const searchResults = document.getElementById('searchResults');
  const searchPrevious = document.getElementById('searchPrevious');
  const searchNext = document.getElementById('searchNext');
  const searchResultCount = document.getElementById('searchResultCount');
  const detailPanel = document.getElementById('detailPanel');
  const detailContent = document.getElementById('detailContent');
  const detailClose = document.getElementById('detailClose');
  const overviewCanvas = document.getElementById('overviewCanvas');
  const overviewCtx = overviewCanvas.getContext('2d');
  const overviewWindow = document.getElementById('overviewWindow');
  const overviewTrack = document.querySelector('.overview-track');
  const laneCaptionTop = document.getElementById('laneCaptionTop');
  const laneCaptionBottom = document.getElementById('laneCaptionBottom');
  const yearCursor = document.getElementById('yearCursor');
  const yearCursorLabel = document.getElementById('yearCursorLabel');

  const state = {
    events: [],
    categories: new Map(),
    enabledCategories: new Set(),
    aboveGroups: new Set(),
    minTime: 1700,
    maxTime: 2026,
    viewStart: 1700,
    viewEnd: 2026,
    dpr: Math.max(1, window.devicePixelRatio || 1),
    pointerMap: new Map(),
    dragStartX: null,
    dragStartY: null,
    dragAxisRatio: null,
    movedDuringDrag: false,
    dragViewStart: null,
    dragViewEnd: null,
    pinchStartDistance: null,
    pinchStartSpan: null,
    pinchAnchorTime: null,
    pinchAnchorRatio: null,
    hoveredEvent: null,
    tooltipPinned: false,
    zoomDialRaf: null,
    pendingZoomRatio: null,
    eventYearZones: [],
    eventLabelZones: [],
    pendingEventYears: [],
    pendingLeaders: [],
    renderQueued: false,
    hitTargets: [],
    selectedEvent: null,
    focusedEvent: null,
    searchQuery: '',
    searchMatches: [],
    searchMatchIndex: -1,
    detailRestoreView: null,
    detailAnchor: null,
    cursorX: null,
    cursorYear: null,
    viewAnimationRaf: null,
    zoomDialActive: false,
    axisYRatio: Math.max(0.22, Math.min(0.76, Number(localStorage.getItem('chrona-axis-y-ratio')) || DEFAULT_AXIS_Y_RATIO)),
    tooltipToken: 0,
    overviewDragging: false,
    overviewDragMode: null,
    overviewDragOffsetRatio: 0,
    overviewDragStartRatio: 0,
    overviewDragStartViewStart: 0,
    overviewDragStartViewEnd: 0
  };

  try {
    const savedAboveGroups = JSON.parse(localStorage.getItem('chrona-above-groups') || '[]');
    if (Array.isArray(savedAboveGroups)) state.aboveGroups = new Set(savedAboveGroups.map(String));
  } catch (_) {
    localStorage.removeItem('chrona-above-groups');
  }

  const importanceRank = { Major: 3, Medium: 2, Minor: 1 };
  const loadedTimelineThumbnails = new Set();
  const failedTimelineThumbnails = new Set();

  const savedDefaultSheetUrl = localStorage.getItem(DEFAULT_SHEET_STORAGE_KEY) || '';
  sheetUrlInput.value = savedDefaultSheetUrl;
  defaultSheetUrlInput.value = savedDefaultSheetUrl;

  const savedTheme = localStorage.getItem('timeline-theme') || 'auto';
  const savedVisualTheme = localStorage.getItem('chrona-visual-theme') || 'gradient';
  applyTheme(savedTheme);
  applyVisualTheme(savedVisualTheme);
  themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeValue)));
  visualThemeButtons.forEach(button => button.addEventListener('click', () => applyVisualTheme(button.dataset.visualThemeValue)));
  settingsToggle.addEventListener('click', () => toggleSettings());
  settingsClose.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', closeSettings);
  useCurrentSheetUrlButton.addEventListener('click', () => {
    defaultSheetUrlInput.value = sheetUrlInput.value.trim();
    defaultSheetStatus.textContent = defaultSheetUrlInput.value ? 'Banner URL copied. Select Save default to keep it.' : 'The banner URL is empty.';
  });
  saveDefaultSheetUrlButton.addEventListener('click', () => {
    const value = defaultSheetUrlInput.value.trim();
    if (!value) {
      defaultSheetStatus.textContent = 'Enter a Google Sheet URL first.';
      defaultSheetUrlInput.focus();
      return;
    }
    try {
      parseSheetSource(value);
      localStorage.setItem(DEFAULT_SHEET_STORAGE_KEY, value);
      defaultSheetUrlInput.value = value;
      sheetUrlInput.value = value;
      defaultSheetStatus.textContent = 'Default saved and copied to the banner. Select Reload to load it.';
    } catch (error) {
      defaultSheetStatus.textContent = error.message;
      defaultSheetUrlInput.focus();
    }
  });
  clearDefaultSheetUrlButton.addEventListener('click', () => {
    localStorage.removeItem(DEFAULT_SHEET_STORAGE_KEY);
    defaultSheetUrlInput.value = '';
    defaultSheetStatus.textContent = 'Saved default cleared. The current banner URL was not changed.';
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeSettings(); closeAboveSetsMenu(); } });
  systemTheme.addEventListener?.('change', () => {
    if ((localStorage.getItem('timeline-theme') || 'auto') === 'auto') {
      applyTheme('auto', false);
    }
  });

  reloadButton.addEventListener('click', () => {
    loadTimeline();
    closeSheetControl();
  });
  document.getElementById('zoomIn').addEventListener('click', () => zoomAt(0.5, 0.7));
  document.getElementById('zoomOut').addEventListener('click', () => zoomAt(0.5, 1.4));
  document.getElementById('zoomReset').addEventListener('click', resetView);
  zoomDial.addEventListener('pointerdown', event => {
    state.zoomDialActive = true;
    viewport.classList.add('is-dial-zooming');
    zoomDial.setPointerCapture?.(event.pointerId);
    updateZoomDialFromPointer(event);
  });
  zoomDial.addEventListener('pointermove', event => {
    if (state.zoomDialActive) updateZoomDialFromPointer(event);
  });
  zoomDial.addEventListener('input', onZoomDialInput);
  const endDialZoom = () => { state.zoomDialActive = false; viewport.classList.remove('is-dial-zooming'); syncZoomDial(); };
  zoomDial.addEventListener('pointerup', endDialZoom);
  zoomDial.addEventListener('pointercancel', endDialZoom);
  zoomDial.addEventListener('change', endDialZoom);

  const hideYearCursor = () => {
    if (state.cursorX == null && yearCursor.hidden) return;
    state.cursorX = null;
    state.cursorYear = null;
    yearCursor.hidden = true;
    scheduleRender();
  };
  zoomRail?.addEventListener('pointerenter', hideYearCursor);
  zoomRail?.addEventListener('pointermove', hideYearCursor);
  zoomRail?.addEventListener('pointerdown', event => {
    hideYearCursor();
    event.stopPropagation();
  });
  zoomRail?.addEventListener('click', event => event.stopPropagation());
  zoomRail?.addEventListener('dblclick', event => event.stopPropagation());
  function positionAboveSetsMenu() {
    if (!aboveSetsMenu || aboveSetsMenu.hidden || !aboveSetsButton) return;
    const buttonRect = aboveSetsButton.getBoundingClientRect();
    const menuWidth = Math.min(360, Math.max(260, window.innerWidth - 24));
    const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, buttonRect.left));
    aboveSetsMenu.style.width = `${menuWidth}px`;
    aboveSetsMenu.style.left = `${left}px`;
    aboveSetsMenu.style.right = 'auto';
    aboveSetsMenu.style.top = `${buttonRect.bottom + 8}px`;
  }

  aboveSetsButton?.addEventListener('click', event => {
    event.stopPropagation();
    const willOpen = aboveSetsMenu.hidden;
    aboveSetsMenu.hidden = !willOpen;
    aboveSetsButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      aboveSetsSearch.value = '';
      filterAboveSetsMenu('');
      positionAboveSetsMenu();
      requestAnimationFrame(() => aboveSetsSearch.focus());
    }
  });
  window.addEventListener('resize', positionAboveSetsMenu);
  window.addEventListener('scroll', positionAboveSetsMenu, true);
  aboveSetsMenu?.addEventListener('pointerdown', event => event.stopPropagation());
  aboveSetsMenu?.addEventListener('click', event => event.stopPropagation());
  aboveSetsSearch?.addEventListener('input', () => filterAboveSetsMenu(aboveSetsSearch.value));
  document.addEventListener('pointerdown', event => {
    if (!aboveSetsMenu?.hidden && !aboveSetsMenu.contains(event.target) && event.target !== aboveSetsButton) {
      closeAboveSetsMenu();
    }
  });

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown);
  detailPanel.addEventListener('pointerdown', event => event.stopPropagation());
  detailPanel.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('pointerdown', event => {
    if (!detailPanel.hidden && !detailPanel.contains(event.target)) closeDetails();
  }, true);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('pointerup', onGlobalPointerEnd);
  window.addEventListener('pointercancel', onGlobalPointerEnd);
  viewport.addEventListener('pointerleave', onPointerLeave);
  // Hover is intentionally inert. Event details open only on click.
  tooltip.hidden = true;
  window.addEventListener('resize', () => {
    scheduleRender();
    if (!detailPanel.hidden && state.detailAnchor) {
      positionDetailPanel(
        state.detailAnchor.clientX,
        state.detailAnchor.clientY
      );
    }
  });
  detailClose.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); closeDetails(); });
  detailClose.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeDetails(); });
  function closeSheetControl() {
    sheetControl.classList.remove('is-open');
    sheetToggle.setAttribute('aria-expanded', 'false');
    sheetToggle.setAttribute('aria-label', 'Open Sheet URL');
  }
  sheetToggle.addEventListener('click', () => {
    const opening = !sheetControl.classList.contains('is-open');
    sheetControl.classList.toggle('is-open', opening);
    sheetToggle.setAttribute('aria-expanded', String(opening));
    sheetToggle.setAttribute('aria-label', opening ? 'Close Sheet URL' : 'Open Sheet URL');
    if (opening) requestAnimationFrame(() => sheetUrlInput.focus());
  });

  searchToggle.addEventListener('click', () => {
    const opening = !searchControl.classList.contains('is-open');
    searchControl.classList.toggle('is-open', opening);
    searchToggle.setAttribute('aria-expanded', String(opening));
    searchToggle.setAttribute('aria-label', opening ? 'Close search' : 'Open search');
    if (opening) requestAnimationFrame(() => searchInput.focus());
  });
  searchInput.addEventListener('blur', () => {
    if (!searchInput.value.trim()) {
      searchControl.classList.remove('is-open');
      searchToggle.setAttribute('aria-expanded', 'false');
      searchToggle.setAttribute('aria-label', 'Open search');
    }
  });
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      moveToSearchResult(event.shiftKey ? -1 : 1);
    }
  });
  searchPrevious.addEventListener('click', event => {
    event.stopPropagation();
    moveToSearchResult(-1);
  });
  searchNext.addEventListener('click', event => {
    event.stopPropagation();
    moveToSearchResult(1);
  });
  viewport.addEventListener('click', onViewportClick);
  viewport.addEventListener('keydown', onTimelineKeyDown);
  const overviewNavigator = document.getElementById('overviewNavigator');
  overviewNavigator.addEventListener('pointerdown', onOverviewPointerDown);
  overviewNavigator.addEventListener('pointermove', onOverviewPointerMove);
  overviewNavigator.addEventListener('pointerup', onOverviewPointerUp);
  overviewNavigator.addEventListener('pointercancel', onOverviewPointerUp);
  overviewNavigator.addEventListener('dblclick', showFullExtent);
  overviewNavigator.addEventListener('wheel', onOverviewWheel, { passive: false });

  function applyTheme(mode, persist = true) {
    const normalized = ['light', 'dark', 'auto'].includes(mode) ? mode : 'auto';
    const resolved = normalized === 'auto' ? (systemTheme.matches ? 'dark' : 'light') : normalized;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = normalized;
    themeButtons.forEach(button => button.classList.toggle('is-active', button.dataset.themeValue === normalized));
    if (persist) localStorage.setItem('timeline-theme', normalized);
    scheduleRender();
  }


  function applyVisualTheme(mode, persist = true) {
    const normalized = ['gradient', 'flat', 'metro'].includes(mode) ? mode : 'gradient';
    document.documentElement.dataset.visualTheme = normalized;
    visualThemeButtons.forEach(button => {
      const active = button.dataset.visualThemeValue === normalized;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', String(active));
    });
    if (persist) localStorage.setItem('chrona-visual-theme', normalized);
    scheduleRender();
  }

  function toggleSettings(forceOpen) {
    const opening = typeof forceOpen === 'boolean' ? forceOpen : settingsPanel.hidden;
    settingsPanel.hidden = !opening;
    settingsBackdrop.hidden = !opening;
    settingsToggle.classList.toggle('is-active', opening);
    settingsToggle.setAttribute('aria-expanded', String(opening));
    settingsToggle.setAttribute('aria-label', opening ? 'Close settings' : 'Open settings');
    if (opening) requestAnimationFrame(() => settingsClose.focus());
  }

  function closeSettings() {
    if (settingsPanel.hidden) return;
    toggleSettings(false);
    settingsToggle.focus();
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function mixHex(colorA, colorB, weightA = .5) {
    const a = normalizeHex(colorA).slice(1);
    const b = normalizeHex(colorB).slice(1);
    const ca = [0, 2, 4].map(i => parseInt(a.slice(i, i + 2), 16));
    const cb = [0, 2, 4].map(i => parseInt(b.slice(i, i + 2), 16));
    const w = Math.max(0, Math.min(1, weightA));
    return `#${ca.map((v, i) => Math.round(v * w + cb[i] * (1 - w)).toString(16).padStart(2, '0')).join('')}`;
  }

  function colorWithAlpha(hex, alpha) {
    const normalized = normalizeHex(hex, '#64748B').replace('#', '');
    const value = normalized.length === 3 ? normalized.split('').map(ch => ch + ch).join('') : normalized;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function normalizeMediaUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
    if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;
    return url;
  }

  function looksLikeImage(url) {
    return /\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(url) || /drive\.google\.com\/uc\?export=view/i.test(url);
  }

  function mediaDestinationUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname === 'upload.wikimedia.org') {
        const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        if (filename) return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename).replace(/%20/g, '_')}`;
      }
      return parsed.href;
    } catch (_) {
      return url;
    }
  }

  function parseSheetSource(url) {
    const value = String(url || '').trim();
    const published = value.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
    if (published) return { type: 'published', id: published[1] };
    const regular = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (regular) return { type: 'regular', id: regular[1] };
    throw new Error('The Google Sheet URL is not valid.');
  }

  function withCacheBust(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cb=${Date.now()}`;
  }

  async function fetchCsvUrl(url, sheetName) {
    const response = await fetch(withCacheBust(url), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText || ''}`.trim());
    const text = await response.text();
    if (!text.trim()) throw new Error('empty response');
    if (/^\s*</.test(text) && /<html|<!doctype/i.test(text)) throw new Error('received an HTML page instead of CSV');
    return text;
  }

  function csvCandidates(source, sheetName, gid) {
    const candidates = [];
    const add = (label, url) => {
      if (!url || candidates.some(item => item.url === url)) return;
      candidates.push({ label, url });
    };

    if (source.type === 'regular') {
      add('shared sheet export', `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=${gid}`);
      add('shared sheet query', `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
    } else {
      add('published sheet', `https://docs.google.com/spreadsheets/d/e/${source.id}/pub?gid=${gid}&single=true&output=csv`);
    }
    return candidates;
  }

  async function fetchCsvCompatible(source, sheetName, gid) {
    const failures = [];
    for (const candidate of csvCandidates(source, sheetName, gid)) {
      try {
        return { text: await fetchCsvUrl(candidate.url, sheetName), sourceLabel: candidate.label };
      } catch (error) {
        failures.push(`${candidate.label}: ${error.message}`);
      }
    }
    throw new Error(`Could not read the “${sheetName}” tab. ${failures.join(' | ')}`);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(v => v !== ''));
  }

  function rowsToObjects(rows) {
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
  }

  function parseNumber(value) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeElementType(value) {
    const normalized = String(value || 'event').trim().toLowerCase();
    if (normalized === 'title') return 'Title';
    if (normalized === 'period' || normalized === 'era') return 'Period';
    return 'Event';
  }

  function generateEventId(group, year, headline, index = 0) {
    const slug = value => String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42);
    const groupCode = slug(group).split('-').filter(Boolean).map(part => part[0]).join('').slice(0, 8) || 'GROUP';
    const yearCode = slug(year || 'UNDATED') || 'UNDATED';
    const headlineCode = slug(headline || 'EVENT') || 'EVENT';
    return `${groupCode}-${yearCode}-${headlineCode}${index ? `-${index + 2}` : ''}`;
  }

  function toTimelineTime(year, month, day, time) {
    const y = parseNumber(year);
    if (y == null) return null;
    const m = Math.min(12, Math.max(1, parseNumber(month) || 1));
    const d = Math.min(31, Math.max(1, parseNumber(day) || 1));
    let fraction = (m - 1) / 12 + (d - 1) / 365.2425;
    if (time) {
      const tm = String(time).match(/^(\d{1,2})(?::(\d{2}))?/);
      if (tm) fraction += ((Number(tm[1]) || 0) + (Number(tm[2]) || 0) / 60) / (24 * 365.2425);
    }
    return y + fraction;
  }

  function formatYear(value) {
    const year = Math.round(value);
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year}`;
  }

  function normalizeHex(value, fallback = '#64748B') {
    return /^#[0-9A-F]{6}$/i.test(value || '') ? value : fallback;
  }

  const EMBEDDED_CATEGORIES = [
    { Group: 'United States', Color: '#2563EB', 'Default Visible': 'TRUE', 'Default Position': 'Above' },
    { Group: 'China', Color: '#DC2626', 'Default Visible': 'TRUE', 'Default Position': 'Below' },
    { Group: 'Ancient Rome', Color: '#7C3AED', 'Default Visible': 'TRUE', 'Default Position': 'Below' },
    { Group: 'Britain', Color: '#D97706', 'Default Visible': 'TRUE', 'Default Position': 'Below' },
    { Group: 'Germany', Color: '#475569', 'Default Visible': 'TRUE', 'Default Position': 'Below' }
  ];

  const EMBEDDED_EVENTS = [
    { Year:'1776', Month:'7', Day:'4', 'Display Date':'July 4, 1776', Headline:'U.S. Declaration of Independence', Text:'The thirteen colonies declared independence from Great Britain.', Media:'https://upload.wikimedia.org/wikipedia/commons/1/15/Declaration_independence.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Declaration of Independence', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1776-DECLARATION' },
    { Year:'1787', Month:'9', Day:'17', 'Display Date':'September 17, 1787', Headline:'U.S. Constitution Signed', Text:'Delegates signed the Constitution in Philadelphia.', Media:'https://upload.wikimedia.org/wikipedia/commons/4/4d/Scene_at_the_Signing_of_the_Constitution_of_the_United_States.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Signing of the U.S. Constitution', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1787-CONSTITUTION' },
    { Year:'1839', 'End Year':'1842', 'Display Date':'1839–1842', Headline:'First Opium War', Text:'Conflict between Qing China and Britain led to the Treaty of Nanking.', Media:'https://upload.wikimedia.org/wikipedia/commons/0/0e/Destroying_Chinese_war_junks%2C_by_E._Duncan_%281843%29.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Naval battle during the First Opium War', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1839-OPIUM-WAR-1' },
    { Year:'1861', Month:'4', Day:'12', 'End Year':'1865', 'End Month':'4', 'End Day':'9', 'Display Date':'1861–1865', Headline:'American Civil War', Text:'War between the Union and the Confederacy transformed the United States and ended legal slavery.', Media:'https://upload.wikimedia.org/wikipedia/commons/9/9a/Fall_of_Richmond_Va_on_the_night_of_April_2nd_1865.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Richmond during the Civil War', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1861-CIVIL-WAR' },
    { Year:'1911', Month:'10', Day:'10', 'End Year':'1912', 'End Month':'2', 'End Day':'12', 'Display Date':'1911–1912', Headline:'Xinhai Revolution', Text:'The revolution ended imperial rule and led to the establishment of the Republic of China.', Media:'https://upload.wikimedia.org/wikipedia/commons/8/8f/Wuchang_Uprising.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Wuchang Uprising', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1911-XINHAI' },
    { Year:'1929', Month:'10', Day:'24', 'Display Date':'October 1929', Headline:'Wall Street Crash', Text:'The stock-market collapse became a defining event of the Great Depression.', Media:'https://upload.wikimedia.org/wikipedia/commons/4/4c/Crowd_outside_nyse.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Crowd outside the New York Stock Exchange', Group:'United States', Type:'Event', Position:'Above', Importance:'Medium', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1929-WALL-STREET' },
    { Year:'1937', Month:'7', Day:'7', 'End Year':'1945', 'End Month':'9', 'End Day':'2', 'Display Date':'1937–1945', Headline:'Second Sino-Japanese War', Text:'Full-scale war between China and Japan became part of the wider Second World War.', Media:'https://upload.wikimedia.org/wikipedia/commons/4/46/Chinese_soldiers_in_house_to_house_fighting_in_Tai%27er_zhuang.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Chinese soldiers during the war', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1937-SINO-JAPANESE-WAR' },
    { Year:'1949', Month:'10', Day:'1', 'Display Date':'October 1, 1949', Headline:'People’s Republic of China Founded', Text:'Mao Zedong proclaimed the People’s Republic of China in Beijing.', Media:'https://upload.wikimedia.org/wikipedia/commons/5/51/Mao_Zedong_proclaiming_the_establishment_of_the_PRC_in_1949.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Proclamation ceremony in Beijing', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1949-PRC' },
    { Year:'1969', Month:'7', Day:'20', 'Display Date':'July 20, 1969', Headline:'Apollo 11 Moon Landing', Text:'Neil Armstrong and Buzz Aldrin became the first people to walk on the Moon.', Media:'https://upload.wikimedia.org/wikipedia/commons/9/98/Aldrin_Apollo_11_original.jpg', 'Media Credit':'NASA / Wikimedia Commons', 'Media Caption':'Buzz Aldrin on the Moon', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1969-APOLLO-11' },
    { Year:'1978', Month:'12', Day:'18', 'Display Date':'December 1978', Headline:'China Begins Reform and Opening', Text:'The Third Plenum marked the beginning of major economic reform under Deng Xiaoping.', Media:'https://upload.wikimedia.org/wikipedia/commons/5/5c/Deng_Xiaoping_1979.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Deng Xiaoping', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1978-REFORM' },
    { Year:'-27', 'End Year':'476', 'Display Date':'27 BCE–476 CE', Headline:'Roman Empire (Western)', Text:'Reference period spanning the Roman imperial era in the West.', Group:'Ancient Rome', Type:'Period', Position:'Below', Importance:'Major', Color:'#7C3AED', Visible:'TRUE', 'Event ID':'ROME-0027BCE-0476' },
    { Year:'1707', 'End Year':'1997', 'Display Date':'1707–1997', Headline:'British Empire (broad reference period)', Text:'A simplified reference span for Britain’s imperial period.', Group:'Britain', Type:'Period', Position:'Below', Importance:'Major', Color:'#D97706', Visible:'TRUE', 'Event ID':'GB-1707-1997-EMPIRE' },
    { Year:'1933', 'End Year':'1945', 'Display Date':'1933–1945', Headline:'Nazi Regime', Text:'Period during which Adolf Hitler and the Nazi Party ruled Germany.', Group:'Germany', Type:'Period', Position:'Below', Importance:'Major', Color:'#475569', Visible:'TRUE', 'Event ID':'DE-1933-1945-NAZI' },
    { Year:'1644', 'End Year':'1912', 'Display Date':'1644–1912', Headline:'Qing Dynasty', Text:'China’s final imperial dynasty, used here as a long-duration reference block.', Group:'China', Type:'Period', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1644-1912-QING' }
  ];

  function applyRows(rawEvents, rawCategories, sourceLabel) {
    state.categories.clear();
    rawCategories.forEach(row => {
      const name = (row.Group || row.Category || '').trim();
      if (!name) return;
      state.categories.set(name, {
        name,
        color: normalizeHex(row.Color),
        visible: String(row['Default Visible']).toUpperCase() !== 'FALSE',
        position: row['Default Position'] || 'Below'
      });
    });

    state.events = rawEvents.map((row, index) => {
      const start = toTimelineTime(row.Year, row.Month, row.Day, row.Time);
      const end = toTimelineTime(row['End Year'], row['End Month'], row['End Day'], row['End Time']);
      const categoryName = (row.Group || row.Category || 'Uncategorized').trim();
      const category = state.categories.get(categoryName) || { color: '#64748B', position: 'Below', visible: true };
      return {
        id: row['Event ID'] || generateEventId(categoryName, row.Year, row.Headline, index),
        headline: row.Headline || '(Untitled)',
        text: row.Text || '',
        displayDate: row['Display Date'] || '',
        start,
        end,
        category: categoryName,
        elementType: normalizeElementType(row.Type || row['Element Type'] || 'event'),
        position: row.Position || category.position || 'Below',
        importance: row.Importance || 'Medium',
        color: normalizeHex(row.Color, category.color),
        visible: String(row.Visible).toUpperCase() !== 'FALSE' && start != null,
        media: normalizeMediaUrl(row.Media || row['Media URL'] || row.media || row.mediaUrl || ''),
        mediaCaption: row['Media Caption'] || row.MediaCaption || row.mediaCaption || '',
        mediaCredit: row['Media Credit'] || row.MediaCredit || row.mediaCredit || '',
        thumbnail: normalizeMediaUrl(row['Media Thumbnail'] || row.Thumbnail || row['Thumbnail URL'] || row.mediaThumbnail || row.thumbnail || '')
      };
    }).filter(e => e.visible && e.elementType !== 'Title');

    if (!state.events.length) throw new Error('No visible timeline records were found.');
    state.enabledCategories = new Set(
      [...new Set(state.events.map(e => e.category))].filter(name => state.categories.get(name)?.visible !== false)
    );
    const groupNames = categoryNames();
    const configuredAbove = groupNames.filter(name => String(state.categories.get(name)?.position || '').toLowerCase() === 'above');
    state.aboveGroups = new Set([...state.aboveGroups].filter(name => groupNames.includes(name)));
    if (!state.aboveGroups.size) {
      const eventAbove = groupNames.filter(name => state.events.some(event => event.category === name && String(event.position).toLowerCase() === 'above'));
      state.aboveGroups = new Set(configuredAbove.length ? configuredAbove : eventAbove.slice(0, 1));
    }
    buildFilters();
    buildAboveSetsMenu();
    const times = state.events.flatMap(e => [e.start, e.end]).filter(v => v != null);
    state.minTime = Math.min(...times);
    state.maxTime = Math.max(...times);
    resetView();
    statusEl.textContent = `${state.events.length} timeline records loaded — ${sourceLabel}.`;
  }

  async function loadTimeline() {
    statusEl.classList.remove('status-warning');
    statusEl.textContent = 'Loading timeline data…';
    const requestedUrl = sheetUrlInput.value.trim();
    if (!requestedUrl) {
      applyRows(EMBEDDED_EVENTS, EMBEDDED_CATEGORIES, 'embedded offline snapshot');
      statusEl.textContent = `${state.events.length} timeline records loaded — enter a Google Sheet URL in the banner or save a browser default in Settings.`;
      return;
    }
    try {
      const source = parseSheetSource(sheetUrlInput.value.trim());
      const eventResult = await fetchCsvCompatible(source, 'TimelineJS Data', DEFAULT_EVENT_GID);
      let categoryResult = null;
      try {
        try {
          categoryResult = await fetchCsvCompatible(source, 'Groups', DEFAULT_CATEGORY_GID);
        } catch (groupsError) {
          categoryResult = await fetchCsvCompatible(source, 'Categories', DEFAULT_CATEGORY_GID);
        }
      } catch (categoryError) {
        console.warn('Groups tab unavailable; deriving groups from events.', categoryError);
      }
      const categoryRows = categoryResult ? rowsToObjects(parseCsv(categoryResult.text)) : [];
      const sourceLabels = [...new Set([eventResult.sourceLabel, categoryResult?.sourceLabel].filter(Boolean))];
      applyRows(rowsToObjects(parseCsv(eventResult.text)), categoryRows, `live Google Sheet via ${sourceLabels.join(' + ')}`);
    } catch (error) {
      console.warn('Live sheet unavailable; using embedded snapshot.', error);
      applyRows(EMBEDDED_EVENTS, EMBEDDED_CATEGORIES, 'embedded offline snapshot');
      statusEl.classList.add('status-warning');
      statusEl.textContent = `Live sheet could not be loaded; showing outdated offline data. ${error.message}`;
    }
  }

  function categoryNames() {
    return [...new Set(state.events.map(event => event.category))].sort((a, b) => a.localeCompare(b));
  }

  function categoryColor(name) {
    return state.categories.get(name)?.color || state.events.find(event => event.category === name)?.color || '#64748B';
  }

  function updateCategorySelection(name, enabled) {
    if (enabled) state.enabledCategories.add(name);
    else state.enabledCategories.delete(name);
    buildFilters();
    scheduleRender();
  }

  function buildFilters() {
    if (!quickFiltersEl) return;
    quickFiltersEl.replaceChildren();
    categoryNames().forEach(name => {
      const color = categoryColor(name);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-quick-chip';
      button.classList.toggle('is-active', state.enabledCategories.has(name));
      button.style.setProperty('--chip-color', color);
      button.style.setProperty('--chip-color-deep', `color-mix(in srgb, ${color} 78%, #08111f)`);
      button.style.setProperty('--chip-color-light', `color-mix(in srgb, ${color} 58%, white)`);
      button.setAttribute('aria-pressed', String(state.enabledCategories.has(name)));
      button.setAttribute('title', `${state.enabledCategories.has(name) ? 'Hide' : 'Show'} ${name}`);
      button.innerHTML = '<span class="category-quick-name"></span>';
      button.querySelector('.category-quick-name').textContent = name;
      button.addEventListener('click', () => updateCategorySelection(name, !state.enabledCategories.has(name)));
      quickFiltersEl.appendChild(button);
    });
  }

  function updateAboveGroup(name, above) {
    if (above) state.aboveGroups.add(name);
    else state.aboveGroups.delete(name);
    localStorage.setItem('chrona-above-groups', JSON.stringify([...state.aboveGroups]));
    buildAboveSetsMenu();
    scheduleRender();
  }

  function buildAboveSetsMenu() {
    if (!aboveSetsList) return;
    aboveSetsList.replaceChildren();
    const names = categoryNames();
    names.forEach(name => {
      const node = filterTemplate.content.firstElementChild.cloneNode(true);
      const input = node.querySelector('input');
      const label = node.querySelector('.filter-name');
      const color = categoryColor(name);
      input.checked = state.aboveGroups.has(name);
      node.dataset.categoryName = name.toLocaleLowerCase();
      node.style.setProperty('--chip-color', color);
      node.style.setProperty('--chip-color-deep', `color-mix(in srgb, ${color} 78%, #08111f)`);
      node.style.setProperty('--chip-color-light', `color-mix(in srgb, ${color} 58%, white)`);
      label.textContent = name;
      input.addEventListener('change', () => updateAboveGroup(name, input.checked));
      aboveSetsList.appendChild(node);
    });
    const selected = names.filter(name => state.aboveGroups.has(name));
    aboveSetsSummary.textContent = selected.length ? selected.join(', ') : 'None';
    aboveSetsCount.textContent = `${selected.length}/${names.length}`;
    filterAboveSetsMenu(aboveSetsSearch?.value || '');
  }

  function filterAboveSetsMenu(query) {
    const normalized = String(query || '').trim().toLocaleLowerCase();
    aboveSetsList?.querySelectorAll('.filter-chip').forEach(node => {
      node.hidden = Boolean(normalized) && !node.dataset.categoryName.includes(normalized);
    });
  }

  function closeAboveSetsMenu() {
    if (!aboveSetsMenu || aboveSetsMenu.hidden) return;
    aboveSetsMenu.hidden = true;
    aboveSetsButton?.setAttribute('aria-expanded', 'false');
  }


  function navigationBounds() {
    const dataSpan = Math.max(0.0001, state.maxTime - state.minTime);
    const visibleSpan = Math.max(
      MIN_VISIBLE_YEARS,
      state.viewEnd - state.viewStart
    );
    const leftMargin = Math.max(
      0.25,
      Math.min(20, dataSpan * 0.03)
    );
    // Reserve enough timeline distance after the final anchor for the longest
    // event label to clear the right edge and the zoom rail completely. The
    // margin scales with the current zoom so it remains a consistent amount of
    // screen space rather than collapsing to only a few years.
    const viewportWidth = Math.max(
      1,
      viewport.clientWidth || window.innerWidth || 1
    );
    const yearsPerPixel = visibleSpan / viewportWidth;
    const trailingPixels = Math.min(620, Math.max(440, viewportWidth * 0.52));
    const pixelClearance = yearsPerPixel * trailingPixels;
    const dataClearance = dataSpan * 0.01;

    const rightMargin = Math.max(pixelClearance, dataClearance);


    return {
      min: state.minTime - leftMargin,
      max: state.maxTime + rightMargin
    };
  }

  function clampView(start = state.viewStart, end = state.viewEnd) {
    const bounds = navigationBounds();
    const fullSpan = Math.max(MIN_VISIBLE_YEARS, bounds.max - bounds.min);
    let span = Math.max(MIN_VISIBLE_YEARS, end - start);

    // Once the requested viewport is wider than all available data, center the
    // complete data extent and prevent horizontal movement into empty time.
    if (span >= fullSpan) {
      state.viewStart = bounds.min;
      state.viewEnd = bounds.max;
      return;
    }

    if (start < bounds.min) {
      end += bounds.min - start;
      start = bounds.min;
    }
    if (end > bounds.max) {
      start -= end - bounds.max;
      end = bounds.max;
    }
    state.viewStart = Math.max(bounds.min, start);
    state.viewEnd = Math.min(bounds.max, end);
  }

  function resetView() {
    // Reset can be invoked immediately after a drag or captured pointer sequence.
    // Clear all interaction state after reset.
    clearPointerInteraction();
    state.tooltipPinned = false;
    tooltip.classList.remove('is-pinned');
    tooltip.hidden = true;
    state.tooltipToken++;

    const points = state.events
      .filter(event => event.visible && event.elementType !== 'Period' && Number.isFinite(event.start))
      .map(event => event.start)
      .sort((a, b) => a - b);

    if (points.length >= 4) {
      // Focus the initial view on the central 90% of point events. Long reference
      // periods and isolated ancient events remain visible in the overview navigator.
      const lower = quantile(points, 0.05);
      const upper = quantile(points, 0.95);
      const contentSpan = Math.max(1, upper - lower);
      const pad = Math.max(2, contentSpan * 0.08);
      state.viewStart = lower - pad;
      state.viewEnd = upper + pad;
    } else {
      showFullExtent(false);
      return;
    }
    scheduleRender();
  }

  function quantile(sortedValues, ratio) {
    if (!sortedValues.length) return 0;
    const position = (sortedValues.length - 1) * ratio;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
    const fraction = position - lowerIndex;
    return sortedValues[lowerIndex] * (1 - fraction) + sortedValues[upperIndex] * fraction;
  }

  function showFullExtent(renderAfter = true) {
    const bounds = navigationBounds();
    state.viewStart = bounds.min;
    state.viewEnd = bounds.max;
    if (renderAfter) scheduleRender();
  }

  function zoomAt(anchorRatio, factor) {
    const span = state.viewEnd - state.viewStart;
    const nextSpan = Math.min(MAX_VISIBLE_YEARS, Math.max(MIN_VISIBLE_YEARS, span * factor));
    const anchorTime = state.viewStart + span * anchorRatio;
    state.viewStart = anchorTime - nextSpan * anchorRatio;
    state.viewEnd = state.viewStart + nextSpan;
    scheduleRender();
  }

  function syncZoomDial() {
    if (!zoomDial || state.zoomDialActive) return;
    const span = Math.max(MIN_VISIBLE_YEARS, Math.min(MAX_VISIBLE_YEARS, state.viewEnd - state.viewStart));
    const ratio = 1 - (Math.log(span / MIN_VISIBLE_YEARS) / Math.log(MAX_VISIBLE_YEARS / MIN_VISIBLE_YEARS));
    zoomDial.value = String(Math.round(Math.max(0, Math.min(1, ratio)) * 400) / 4);
  }

  function updateZoomDialFromPointer(event) {
    const rect = zoomDial.getBoundingClientRect();
    if (!rect.height) return;
    const ratio = Math.max(0, Math.min(1, 1 - ((event.clientY - rect.top) / rect.height)));
    zoomDial.value = String(ratio * 100);
    state.pendingZoomRatio = ratio;
    applyPendingZoomRatio();
  }

  function applyPendingZoomRatio() {
    if (state.zoomDialRaf != null) return;
    state.zoomDialRaf = requestAnimationFrame(() => {
      state.zoomDialRaf = null;
      const ratio = state.pendingZoomRatio;
      if (!Number.isFinite(ratio)) return;
      const nextSpan = MIN_VISIBLE_YEARS * Math.pow(MAX_VISIBLE_YEARS / MIN_VISIBLE_YEARS, 1 - ratio);
      const center = (state.viewStart + state.viewEnd) / 2;
      state.viewStart = center - nextSpan / 2;
      state.viewEnd = center + nextSpan / 2;
      scheduleRender();
    });
  }

  function onZoomDialInput() {
    state.pendingZoomRatio = Number(zoomDial.value) / 100;
    applyPendingZoomRatio();
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    // Trackpad pinch (reported by browsers as Ctrl/Meta + wheel) remains zoom.
    if (event.ctrlKey || event.metaKey) {
      zoomAt(ratio, Math.exp(event.deltaY * 0.006));
      return;
    }

    // Two-finger horizontal movement pans through time. A conventional mouse
    // wheel with Shift held is treated as horizontal movement as well.
    const horizontalDelta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (horizontalDelta) {
      const span = state.viewEnd - state.viewStart;
      const shift = span * horizontalDelta / Math.max(1, rect.width);
      clampView(state.viewStart + shift, state.viewEnd + shift);
    }

    // Two-finger vertical movement moves the entire timeline up/down, matching
    // the existing click-and-drag vertical navigation.
    if (!event.shiftKey && event.deltaY) {
      state.axisYRatio = Math.max(
        0.22,
        Math.min(0.76, state.axisYRatio - event.deltaY / Math.max(1, rect.height))
      );
      localStorage.setItem('chrona-axis-y-ratio', String(state.axisYRatio));
    }

    scheduleRender();
  }

  function onPointerDown(event) {
    if (isInsideZoomRail(event.clientX, event.clientY)) return;
    if (detailPanel.contains(event.target) || tooltip.contains(event.target) || event.target.closest('a, button, input, select, textarea, [role=\"button\"]')) return;
    viewport.setPointerCapture(event.pointerId);
    state.pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointerMap.size === 1) {
      state.dragStartX = event.clientX;
      state.dragStartY = event.clientY;
      state.dragAxisRatio = state.axisYRatio;
      state.movedDuringDrag = false;
      state.dragViewStart = state.viewStart;
      state.dragViewEnd = state.viewEnd;
    } else if (state.pointerMap.size === 2) {
      beginPinch();
    }
  }

  function beginPinch() {
    const [a, b] = [...state.pointerMap.values()];
    state.pinchStartDistance = Math.hypot(b.x - a.x, b.y - a.y);
    state.pinchStartSpan = state.viewEnd - state.viewStart;
    const rect = viewport.getBoundingClientRect();
    const centerX = (a.x + b.x) / 2;
    state.pinchAnchorRatio = Math.min(1, Math.max(0, (centerX - rect.left) / rect.width));
    state.pinchAnchorTime = state.viewStart + state.pinchStartSpan * state.pinchAnchorRatio;
  }

  function onPointerMove(event) {
    if (!state.pointerMap.has(event.pointerId)) {
      updateYearCursor(event);
      return;
    }
    hideYearCursor();
    state.pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointerMap.size === 2) {
      const [a, b] = [...state.pointerMap.values()];
      const distance = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
      const nextSpan = Math.min(MAX_VISIBLE_YEARS, Math.max(MIN_VISIBLE_YEARS, state.pinchStartSpan * state.pinchStartDistance / distance));
      state.viewStart = state.pinchAnchorTime - nextSpan * state.pinchAnchorRatio;
      state.viewEnd = state.viewStart + nextSpan;
      scheduleRender();
    } else if (state.pointerMap.size === 1 && state.dragStartX != null) {
      const rect = viewport.getBoundingClientRect();
      const dx = event.clientX - state.dragStartX;
      const dy = event.clientY - state.dragStartY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.movedDuringDrag = true;
      const shift = -(dx / rect.width) * (state.dragViewEnd - state.dragViewStart);
      state.viewStart = state.dragViewStart + shift;
      state.viewEnd = state.dragViewEnd + shift;
      state.axisYRatio = Math.max(0.22, Math.min(0.76, state.dragAxisRatio + dy / rect.height));
      scheduleRender();
    }
  }

  function clearPointerInteraction() {
    state.pointerMap.clear();
    state.dragStartX = null;
    state.dragStartY = null;
    state.dragAxisRatio = null;
    state.dragViewStart = null;
    state.dragViewEnd = null;
    state.pinchStartDistance = null;
    state.pinchStartSpan = null;
    state.pinchAnchorTime = null;
    state.pinchAnchorRatio = null;
    state.movedDuringDrag = false;
  }

  function onGlobalPointerEnd(event) {
    // Pointer capture can occasionally be interrupted by UI controls. Keeping a
    // window-level fallback prevents stale entries from disabling hover handling.
    if (!state.pointerMap.has(event.pointerId)) return;
    onPointerUp(event);
  }

  function onPointerUp(event) {
    state.pointerMap.delete(event.pointerId);
    if (state.pointerMap.size === 1) {
      const only = [...state.pointerMap.values()][0];
      state.dragStartX = only.x;
      state.dragStartY = only.y;
      state.dragAxisRatio = state.axisYRatio;
      state.dragViewStart = state.viewStart;
      state.dragViewEnd = state.viewEnd;
    } else if (state.pointerMap.size === 0) {
      state.dragStartX = null;
      state.dragStartY = null;
      state.pinchStartDistance = null;
      localStorage.setItem('chrona-axis-y-ratio', String(state.axisYRatio));
    }
  }

  function onPointerLeave() {
    state.cursorX = null;
    state.cursorYear = null;
    yearCursor.hidden = true;
    scheduleRender();
    if (!state.tooltipPinned) { tooltip.hidden = true; state.tooltipToken++; }
  }

  function onHoverMove() {
    // Intentionally empty: Chrona has no hover interaction.
  }

  function positionTooltip(clientX, clientY) {
    const viewportRect = viewport.getBoundingClientRect();
    const margin = 10;
    const gap = 14;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const localX = clientX - viewportRect.left;
    const localY = clientY - viewportRect.top;
    let left = localX + gap;
    if (left + width > viewportRect.width - margin) left = localX - width - gap;
    left = Math.max(margin, Math.min(viewportRect.width - width - margin, left));
    let top = localY + gap;
    if (top + height > viewportRect.height - margin) top = localY - height - gap;
    top = Math.max(margin, Math.min(viewportRect.height - height - margin, top));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function render() {
    clampView();
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    leaderCanvas.width = Math.round(rect.width * state.dpr);
    leaderCanvas.height = Math.round(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    leaderCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    leaderCtx.clearRect(0, 0, rect.width, rect.height);
    labelLayer.replaceChildren();
    state.hitTargets = [];
    state.eventYearZones = [];
    state.eventLabelZones = [];
    state.pendingEventYears = [];
    state.pendingLeaders = [];

    const axisY = rect.height * state.axisYRatio;
    drawBackground(rect.width, rect.height);
    drawYearCursorCanvas(rect.height);
    drawAxis(rect.width, axisY);
    drawEvents(rect.width, rect.height, axisY);
    drawEventYears();
    drawTicks(rect.width, axisY);
    drawOverview();
    updateLaneLegends();
    syncZoomDial();
  }


  function updateLaneLegends() {
    laneCaptionTop.hidden = true;
    laneCaptionTop.innerHTML = '';
    laneCaptionBottom.hidden = true;
    laneCaptionBottom.innerHTML = '';
  }


  function isInsideZoomRail(clientX, clientY) {
    const rect = zoomRail?.getBoundingClientRect();
    return Boolean(rect &&
      clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom);
  }

  function updateYearCursor(event) {
    const railRect = zoomRail?.getBoundingClientRect();
    const overZoomRail = railRect &&
      event.clientX >= railRect.left && event.clientX <= railRect.right &&
      event.clientY >= railRect.top && event.clientY <= railRect.bottom;
    if (state.pointerMap.size || overZoomRail || event.target.closest?.('.zoom-rail')) {
      state.cursorX = null;
      state.cursorYear = null;
      yearCursor.hidden = true;
      scheduleRender();
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const year = state.viewStart + (x / rect.width) * (state.viewEnd - state.viewStart);
    state.cursorX = x;
    state.cursorYear = year;
    yearCursor.style.left = `${x + 5}px`;
    yearCursorLabel.textContent = formatCursorYear(year);
    yearCursor.hidden = false;
    scheduleRender();
  }

  function formatCursorYear(value) {
    const span = state.viewEnd - state.viewStart;
    if (span < 1) return formatFineDate(value, span < .08 ? 1 / 365.2425 : 1 / 12);
    return formatYear(Math.round(value));
  }

  function drawBackground(width, height) {
    const top = cssVar('--surface-solid', '#ffffff');
    const bottom = cssVar('--surface-soft', '#f3f5f7');
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.54, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawYearCursorCanvas(height) {
    if (state.cursorX == null) return;
    ctx.save();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(state.cursorX) + 0.5, 0);
    ctx.lineTo(Math.round(state.cursorX) + 0.5, height);
    ctx.stroke();
    ctx.restore();
  }

  function drawAxis(width, axisY) {
    ctx.strokeStyle = cssVar('--axis', '#30363d');
    ctx.lineWidth = document.documentElement.dataset.theme === 'dark' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, axisY + 0.5);
    ctx.lineTo(width, axisY + 0.5);
    ctx.stroke();
  }

  function chooseTickStep(span, width) {
    const targetTicks = Math.max(4, width / 120);
    const raw = span / targetTicks;
    const steps = [1/365.2425, 7/365.2425, 1/12, .25, .5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    return steps.find(s => s >= raw) || steps[steps.length - 1];
  }

  function chooseMinorTickStep(majorStep) {
    if (majorStep >= 1000) return majorStep / 10;
    if (majorStep >= 100) return majorStep / 10;
    if (majorStep >= 10) return majorStep / 10;
    if (majorStep >= 5) return 1;
    if (majorStep >= 1) return majorStep / 5;
    return majorStep / 4;
  }

  function drawTicks(width, axisY) {
    const span = state.viewEnd - state.viewStart;
    const majorStep = chooseTickStep(span, width);
    const minorStep = chooseMinorTickStep(majorStep);
    const firstMinor = Math.floor(state.viewStart / minorStep) * minorStep;

    ctx.font = '12px -apple-system, BlinkMacSystemFont, \"SF Pro Text\", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let value = firstMinor; value <= state.viewEnd + minorStep; value += minorStep) {
      const x = timeToX(value, width);
      if (x < -20 || x > width + 20) continue;
      const majorIndex = Math.round(value / majorStep);
      const isMajor = Math.abs(value - majorIndex * majorStep) < minorStep * 0.05;
      ctx.strokeStyle = isMajor ? cssVar('--tick-major', '#68717b') : cssVar('--tick-minor', '#c4cbd2');
      ctx.lineWidth = isMajor ? 1.1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, axisY - (isMajor ? 8 : 4));
      ctx.lineTo(x, axisY + (isMajor ? 8 : 4));
      ctx.stroke();
      if (isMajor) {
        const collidesWithEventYear = state.eventYearZones.some(zone =>
          zone.side === 'below' && Math.abs(zone.x - x) < Math.max(24, zone.width / 2 + 10)
        );
        if (!collidesWithEventYear) {
          ctx.fillStyle = cssVar('--text-muted', '#69717d');
          const label = majorStep < 1 ? formatFineDate(value, majorStep) : formatYear(value);
          ctx.fillText(label, x, axisY + 11);
        }
      }
    }

    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, \"SF Pro Text\", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = cssVar('--text', '#17191c');
    ctx.fillText(state.viewEnd < 0 ? 'YEAR (BCE)' : state.viewStart >= 1 ? 'YEAR (CE)' : 'YEAR (BCE / CE)', 12, axisY - 13);
  }

  function formatFineDate(value, step) {
    const year = Math.floor(value);
    const frac = value - year;
    if (step <= 8 / 365.2425) {
      const dayOfYear = Math.max(1, Math.round(frac * 365.2425));
      return `${formatYear(year)} d${dayOfYear}`;
    }
    const month = Math.max(1, Math.min(12, Math.floor(frac * 12) + 1));
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function timeToX(time, width) {
    return ((time - state.viewStart) / (state.viewEnd - state.viewStart)) * width;
  }

  function labelThreshold(span) {
    if (span > 1000) return 3;
    if (span > 100) return 2;
    return 1;
  }

  // Point events and long-running era blocks are both timeline records.
  // Search must treat them identically.
  function searchTextForEvent(event) {
    const end = Number.isFinite(event.end) ? event.end : event.start;

    return [
      event.headline,
      event.category,
      event.text,
      event.displayDate,
      formatYear(event.start),
      formatYear(end),
      `${formatYear(event.start)}–${formatYear(end)}`,
      event.importance,
      event.elementType
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function eventMatchesSearch(event, query = state.searchQuery) {
    const normalized = String(query || '').trim().toLowerCase();
    return !normalized || searchTextForEvent(event).includes(normalized);
  }

  function isEraBlock(event) {
    return Number.isFinite(event.end) && event.end > event.start;
  }

  function drawEvents(width, height, axisY) {
    const q = state.searchQuery.trim().toLowerCase();
    // Keep point labels alive until the complete rendered label has left the
    // viewport. Culling by the event anchor caused long labels to disappear
    // abruptly as soon as their dot crossed an edge. A 420 px time overscan is
    // larger than the maximum event-label width and is recomputed at every zoom.
    const timePerPixel = (state.viewEnd - state.viewStart) / Math.max(1, width);
    const labelOverscanYears = timePerPixel * 420;
    const visible = state.events.filter(e => {
      if (!state.enabledCategories.has(e.category)) return false;
      if (e.elementType === 'Period') {
        return e.start <= state.viewEnd && (e.end ?? e.start) >= state.viewStart;
      }
      const hasRange = Number.isFinite(e.end) && e.end > e.start;
      const anchor = e.start;
      return anchor >= state.viewStart - labelOverscanYears && anchor <= state.viewEnd + labelOverscanYears;
    });
    const threshold = labelThreshold(state.viewEnd - state.viewStart);
    const above = visible.filter(e => state.aboveGroups.has(e.category));
    const below = visible.filter(e => !state.aboveGroups.has(e.category));
    const abovePoints = above.filter(e => e.elementType !== 'Period');
    const belowPoints = below.filter(e => e.elementType !== 'Period');
    const abovePeriods = above.filter(e => e.elementType === 'Period' && e.end != null);
    const belowPeriods = below.filter(e => e.elementType === 'Period' && e.end != null);

    // Lay out every point label first. This gives connector rendering complete
    // knowledge of unrelated blocks so it can leave clean background gaps.
    const abovePointLanes = drawPointRows(abovePoints, width, axisY, true, threshold);
    const belowPointLanes = drawPointRows(belowPoints, width, axisY, false, threshold);
    drawLeaderLines(axisY);
    state.pendingLeadersDrawn = true;

    // Period bars are painted afterward, with a small background isolation ring,
    // so passing connectors never appear attached to an unrelated era block.
    drawPeriodRows(abovePeriods, width, height, axisY, threshold, true, abovePointLanes);
    drawPeriodRows(belowPeriods, width, height, axisY, threshold, false, belowPointLanes);
  }

  function resolvePosition(event) {
    return state.aboveGroups.has(event.category) ? 'Above' : 'Below';
  }

  function drawPointRows(events, width, axisY, isAbove, threshold) {
    const sorted = [...events].sort((a, b) => a.start - b.start || (importanceRank[b.importance] - importanceRank[a.importance]));
    const laneEnds = [];
    let maxLabelLane = -1;

    // Allocate compact micro-lanes for touching or overlapping duration spans.
    const durationLaneEnds = [];
    const durationLanes = new Map();
    sorted.forEach(event => {
      if (!(Number.isFinite(event.end) && event.end > event.start)) return;
      const left = Math.min(timeToX(event.start, width), timeToX(event.end, width));
      const right = Math.max(timeToX(event.start, width), timeToX(event.end, width));
      let microLane = 0;
      while (durationLaneEnds[microLane] != null && left <= durationLaneEnds[microLane] + 1) microLane++;
      durationLaneEnds[microLane] = right;
      durationLanes.set(event.id, microLane);
    });
    sorted.forEach(event => {
      const hasRange = Number.isFinite(event.end) && event.end > event.start;
      const anchorTime = event.start;
      const x = timeToX(anchorTime, width);
      const startX = x;
      const endX = hasRange ? timeToX(event.end, width) : startX;
      const visibleRangeLeft = Math.min(startX, endX);
      const visibleRangeRight = Math.max(startX, endX);
      if (visibleRangeRight < -40 || visibleRangeLeft > width + 40) return;
      const showLabel = (importanceRank[event.importance] || 2) >= threshold;
      ctx.save();
      ctx.font = `${event.importance === 'Major' ? '650' : '520'} 13px -apple-system, BlinkMacSystemFont, \"SF Pro Text\", sans-serif`;
      const timelinePreview = event.thumbnail || (looksLikeImage(event.media) ? event.media : '');
      const thumbnailAllowance = timelinePreview ? 33 : 0;
      const measuredLabelWidth = Math.ceil(ctx.measureText(event.headline).width + 20 + thumbnailAllowance);
      ctx.restore();
      // The zoom rail is a visual and interaction overlay, not a clipping
      // boundary. Event labels continue beneath its frosted surface and are
      // clipped only by the timeline viewport itself. This lets a label remain
      // partially readable as it naturally moves off either screen edge.
      const labelWidth = Math.min(
        360,
        Math.max(96, Math.min(measuredLabelWidth, Math.max(96, width)))
      );

      const visualTheme = document.documentElement.dataset.visualTheme || 'gradient';
      const isMetroTheme = visualTheme === 'metro';
      const isFlatTheme = visualTheme === 'flat';
      const leaderX = Math.round(x) + 0.5;

      // The event marker, connector, and the label's absolute left-most edge
      // share one x coordinate. Borders and Metro accents extend inward from
      // this edge rather than being centered over the connector.
      // Metro's 4 px accent straddles the connector axis: place its outer
      // edge one pixel left so the 2 px connector remains fully inside it.
      // Opaque themes keep the label's true outer edge on the connector axis.
      const labelLeft = isMetroTheme ? leaderX - 1 : leaderX;
      const labelRight = labelLeft + labelWidth;

      // Do not cull against the zoom-control footprint or require the whole
      // label to fit onscreen. The label layer's overflow clipping reveals the
      // visible portion until the complete block has left the viewport.
      if (labelRight <= 0 || labelLeft >= width) return;

      let lane = 0;
      if (showLabel) {
        while (
          laneEnds[lane] != null &&
          labelLeft < laneEnds[lane] + 8
        ) lane++;
        laneEnds[lane] = labelRight;
        maxLabelLane = Math.max(maxLabelLane, lane);
      }

      const labelHeight = 27;
      const laneGap = 34;
      const labelTop = isAbove ? axisY - 58 - lane * laneGap : axisY + 36 + lane * laneGap;

      // Theme-specific attachment geometry:
      // - Gradient joins the straight portion of the rounded left edge.
      // - Flat joins the exact square corner.
      // - Metro joins the near end of its short 4 px accent, never protruding
      //   beyond that accent.
      const gradientRadius = 8;
      const metroAccentTop = 5;
      const metroAccentBottom = 22;
      let leaderEndY;
      if (isMetroTheme) {
        leaderEndY = isAbove
          ? labelTop + metroAccentBottom
          : labelTop + metroAccentTop;
      } else if (isFlatTheme) {
        leaderEndY = isAbove ? labelTop : labelTop + labelHeight;
      } else {
        leaderEndY = isAbove
          ? labelTop + gradientRadius
          : labelTop + labelHeight - gradientRadius;
      }

      const microLane = hasRange ? (durationLanes.get(event.id) || 0) : 0;
      const spanOffset = hasRange ? 3 + microLane * 4 : 0;
      const spanY = hasRange ? axisY + (isAbove ? -spanOffset : spanOffset) : axisY;

      state.pendingLeaders.push({
        event,
        x: leaderX,
        y1: spanY,
        y2: leaderEndY,
        ownerId: event.id
      });

      // A ranged event uses a 3 px category-colored span beginning at its
      // exact start date. Touching or overlapping spans occupy separate micro-lanes.
      if (hasRange) {
        let spanLeft = Math.min(startX, endX);
        let spanRight = Math.max(startX, endX);
        if (spanRight - spanLeft < 4) spanRight = spanLeft + 4;
        const clippedLeft = Math.max(0, spanLeft);
        const clippedRight = Math.min(width, spanRight);
        if (clippedRight > clippedLeft) {
          ctx.save();
          ctx.strokeStyle = event.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(clippedLeft, spanY);
          ctx.lineTo(clippedRight, spanY);
          ctx.stroke();

          // A small perpendicular end cap separates adjacent duration spans.
          if (endX >= 0 && endX <= width) {
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(Math.round(endX) + 0.5, spanY - 3);
            ctx.lineTo(Math.round(endX) + 0.5, spanY + 3);
            ctx.stroke();
          }
          ctx.restore();
          state.hitTargets.push({ event, x1: clippedLeft, x2: clippedRight, y1: spanY - 5, y2: spanY + 5 });
        }
      }

      ctx.save();

      const hasSearch = Boolean(state.searchQuery.trim());
      const isSearchMatch = eventMatchesSearch(event);
      ctx.globalAlpha = hasSearch && !isSearchMatch ? 0.22 : 1;

      const isSelected = state.selectedEvent?.id === event.id;

      if (isSelected) {
        // A light separation ring keeps the selected marker visible against
        // the axis, event spans, and either theme.
        ctx.beginPath();
        ctx.arc(leaderX, spanY, 9.5, 0, Math.PI * 2);
        ctx.strokeStyle = cssVar('--surface-solid', '#ffffff');
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(leaderX, spanY, 8, 0, Math.PI * 2);
        ctx.strokeStyle = event.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = colorWithAlpha(event.color, .48);
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      ctx.fillStyle = event.color;
      ctx.shadowColor = colorWithAlpha(event.color, isSelected ? .45 : .24);
      ctx.shadowBlur = isSelected
        ? 10
        : (event.importance === 'Major' ? 8 : 5);

      ctx.beginPath();
      ctx.arc(
        leaderX,
        spanY,
        isSelected ? 5.6 : (event.importance === 'Major' ? 4.6 : 3.35),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
      state.hitTargets.push({ event, x1: leaderX - 10, x2: leaderX + 10, y1: spanY - 10, y2: spanY + 10 });
      state.hitTargets.push({ event, x1: leaderX - 5, x2: leaderX + 5, y1: Math.min(spanY, leaderEndY), y2: Math.max(spanY, leaderEndY) });

      if (hasRange) {
        state.pendingEventYears.push({
          text: formatYear(event.start),
          x: startX,
          y: isAbove ? axisY + 11 : axisY - 22,
          side: isAbove ? 'below' : 'above',
          color: event.color
        });
        state.pendingEventYears.push({
          text: formatYear(event.end),
          x: endX,
          y: isAbove ? axisY + 11 : axisY - 22,
          side: isAbove ? 'below' : 'above',
          color: event.color
        });
      } else {
        state.pendingEventYears.push({
          text: formatYear(event.start),
          x: leaderX,
          y: isAbove ? axisY + 11 : axisY - 22,
          side: isAbove ? 'below' : 'above',
          color: event.color
        });
      }

      if (showLabel) {
        const label = document.createElement('div');
        label.className = `event-label ${event.importance.toLowerCase()} ${isAbove ? 'event-label-above' : 'event-label-below'}`;

        if (state.searchQuery.trim()) {
          label.classList.add(
            eventMatchesSearch(event)
              ? 'is-search-match'
              : 'is-search-dim'
          );
        }
        if (timelinePreview && !failedTimelineThumbnails.has(timelinePreview)) {
          const thumbnail = document.createElement('img');
          thumbnail.className = 'event-thumbnail';
          thumbnail.alt = '';
          const alreadyLoaded = loadedTimelineThumbnails.has(timelinePreview);
          thumbnail.hidden = !alreadyLoaded;
          if (alreadyLoaded) label.classList.add('has-thumbnail');
          thumbnail.addEventListener('load', () => {
            loadedTimelineThumbnails.add(timelinePreview);
            thumbnail.hidden = false;
            label.classList.add('has-thumbnail');
          }, { once: true });
          thumbnail.addEventListener('error', () => {
            failedTimelineThumbnails.add(timelinePreview);
            thumbnail.remove();
          }, { once: true });
          thumbnail.src = timelinePreview;
          label.appendChild(thumbnail);
        }
        const labelText = document.createElement('span');
        labelText.className = 'event-label-text';
        labelText.textContent = event.headline;
        label.appendChild(labelText);
        label.dataset.eventId = event.id;
        if (state.selectedEvent?.id === event.id) label.classList.add('is-selected');
        label.style.left = `${labelLeft}px`;
        label.style.top = `${labelTop}px`;
        label.style.setProperty('--event-color', event.color);
        label.style.setProperty('--event-color-deep', `color-mix(in srgb, ${event.color} 76%, #08111f)`);
        label.style.setProperty('--event-color-light', `color-mix(in srgb, ${event.color} 58%, white)`);
        // The DOM label owns the final visible connector segment. It starts at
        // the timeline dot and overlaps the label's left edge, producing a
        // continuous balloon-string connection in every visual theme.
        label.style.setProperty('--leader-distance', `${Math.max(0, Math.abs(spanY - labelTop))}px`);
        label.style.maxWidth = `${labelWidth}px`;
        labelLayer.appendChild(label);
        state.eventLabelZones.push({
          x1: labelLeft,
          x2: labelRight,
          y1: labelTop,
          y2: labelTop + labelHeight,
          ownerId: event.id
        });
        state.hitTargets.push({
          event,
          x1: labelLeft,
          x2: labelRight,
          y1: labelTop,
          y2: labelTop + labelHeight
        });
      }
    });

    return maxLabelLane + 1;
  }

  function mixHex(colorA, colorB, amount) {
    const parse = value => {
      const hex = String(value || '').trim().replace('#', '');
      if (!/^[0-9a-f]{6}$/i.test(hex)) return [100, 116, 139];
      return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    };
    const a = parse(colorA);
    const b = parse(colorB);
    const t = Math.max(0, Math.min(1, amount));
    return `rgb(${a.map((v, i) => Math.round(v * t + b[i] * (1 - t))).join(',')})`;
  }

  function drawPeriodRows(periods, width, height, axisY, threshold, isAbove, pointLaneCount = 0) {
    const sorted = [...periods].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const laneEnds = [];
    const layout = [];
    const barHeight = 28;
    const laneGap = 36;
    const pointLabelHeight = 27;
    const pointLaneGap = 34;
    const separation = 12;

    for (const event of sorted) {
      const x1 = timeToX(event.start, width);
      const x2 = timeToX(event.end, width);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      if (right <= 0 || left >= width || right <= left) continue;
      let lane = 0;
      while (laneEnds[lane] != null && left < laneEnds[lane] + 8) lane++;
      laneEnds[lane] = right;
      layout.push({ event, left, right, lane });
    }
    if (!layout.length) return;

    const outermostPointTop = pointLaneCount > 0
      ? axisY - 58 - (pointLaneCount - 1) * pointLaneGap
      : axisY;
    const outermostPointBottom = pointLaneCount > 0
      ? axisY + 36 + (pointLaneCount - 1) * pointLaneGap + pointLabelHeight
      : axisY;
    let firstPeriodY = isAbove
      ? Math.min(axisY - 112, outermostPointTop - separation - barHeight)
      : Math.max(axisY + 92, outermostPointBottom + separation);

    // Era rows remain anchored to the timeline axis. They may naturally move
    // out of the clipped viewport when the user drags the timeline vertically.

    for (const { event, left, right, lane } of layout) {
      const y = isAbove ? firstPeriodY - lane * laneGap : firstPeriodY + lane * laneGap;
      // Canvas clips automatically, but the DOM label layer previously left a
      // faint, partially clipped duplicate at the top edge. Do not create any
      // period block or text when its complete row is outside the viewport.
      if (y + barHeight <= 0 || y >= height) continue;
      const periodFill = event.color;
      const periodWidth = Math.max(2, right - left);
      const periodRadius = Math.min(10, barHeight / 2, periodWidth / 2);
      // Periods are painted after connector lines, so the rounded period itself
      // cleanly occludes any unrelated connector without a square background mask.

      ctx.save();
      ctx.globalAlpha = 1;
      const flatVisualTheme = document.documentElement.dataset.visualTheme === 'flat';
      if (flatVisualTheme) {
        ctx.fillStyle = mixHex(periodFill, document.documentElement.dataset.theme === 'dark' ? '#101214' : '#ffffff', 0.18);
        ctx.strokeStyle = mixHex(periodFill, document.documentElement.dataset.theme === 'dark' ? '#ffffff' : '#08111f', 0.74);
        ctx.lineWidth = 1.5;
      } else {
        const periodGradient = ctx.createLinearGradient(left, 0, right, 0);
        periodGradient.addColorStop(0, mixHex(periodFill, '#08111f', 0.76));
        periodGradient.addColorStop(0.58, periodFill);
        periodGradient.addColorStop(1, mixHex(periodFill, '#ffffff', 0.58));
        ctx.fillStyle = periodGradient;
      }
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(left, y, periodWidth, barHeight, periodRadius);
      } else {
        ctx.rect(left, y, periodWidth, barHeight);
      }
      ctx.fill();
      if (flatVisualTheme) ctx.stroke();
      state.hitTargets.push({ event, x1: Math.max(0, left), x2: Math.min(width, right), y1: y, y2: y + barHeight });
      ctx.restore();

      if ((importanceRank[event.importance] || 2) >= threshold && right - left > 48) {
        const visibleLeft = Math.max(0, left);
        const visibleRight = Math.min(width, right);
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        if (visibleWidth < 24) continue;

        // Era text is painted by the same canvas pass as its bar. Keeping the fill
        // and text in one coordinate system prevents DOM labels from escaping to
        // the viewport's top edge when the timeline is moved vertically.
        const fullText = `${event.headline}${event.displayDate ? `  ${event.displayDate}` : ''}`;
        const horizontalPadding = 9;
        const availableWidth = Math.max(0, visibleWidth - horizontalPadding * 2);
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(left, y, periodWidth, barHeight, periodRadius);
        } else {
          ctx.rect(left, y, periodWidth, barHeight);
        }
        ctx.clip();
        ctx.font = '590 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = flatVisualTheme
          ? mixHex(periodFill, document.documentElement.dataset.theme === 'dark' ? '#ffffff' : '#08111f', 0.78)
          : '#ffffff';
        ctx.shadowColor = flatVisualTheme ? 'transparent' : 'rgba(0,0,0,.28)';
        ctx.shadowBlur = flatVisualTheme ? 0 : 1;
        ctx.shadowOffsetY = flatVisualTheme ? 0 : 1;

        let renderedText = fullText;
        const fullTextWidth = ctx.measureText(fullText).width;
        const isTruncated = fullTextWidth > availableWidth;
        if (isTruncated) {
          const ellipsis = '…';
          let low = 0;
          let high = fullText.length;
          while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            const candidate = fullText.slice(0, mid).trimEnd() + ellipsis;
            if (ctx.measureText(candidate).width <= availableWidth) low = mid;
            else high = mid - 1;
          }
          renderedText = fullText.slice(0, low).trimEnd() + ellipsis;
        }

        // Center complete names within the currently visible part of the bar.
        // Truncated names are left-aligned so their beginning remains readable.
        const textX = isTruncated
          ? visibleLeft + horizontalPadding
          : visibleLeft + visibleWidth / 2;
        ctx.textAlign = isTruncated ? 'left' : 'center';
        ctx.fillText(renderedText, textX, y + barHeight / 2);
        ctx.restore();

        state.eventLabelZones.push({ x1: visibleLeft, x2: visibleRight, y1: y, y2: y + barHeight, ownerId: event.id });
      }
    }
  }

  function drawLeaderLines(axisY) {
    if (!state.pendingLeaders.length) return;

    // Opaque themes place this canvas behind the DOM labels, so each front
    // block naturally masks connectors belonging to events behind it. Metro
    // places it above transparent labels so neighboring connectors remain
    // visible through them.
    for (const leader of state.pendingLeaders) {
      leaderCtx.save();
      leaderCtx.strokeStyle = colorWithAlpha(leader.event.color, 1);
      leaderCtx.lineWidth = 2;
      leaderCtx.lineCap = 'butt';
      leaderCtx.beginPath();
      leaderCtx.moveTo(leader.x, leader.y1);
      leaderCtx.lineTo(leader.x, leader.y2);
      leaderCtx.stroke();
      leaderCtx.restore();
    }
  }

  function drawEventYears() {
    const accepted = [];
    for (const item of state.pendingEventYears) {
      const width = Math.max(28, item.text.length * 7.1);
      const height = 14;
      const box = { x1: item.x - width / 2 - 3, x2: item.x + width / 2 + 3, y1: item.y - 2, y2: item.y + height + 2 };
      const overlapsLabel = state.eventLabelZones.some(zone =>
        box.x1 < zone.x2 + 3 && box.x2 > zone.x1 - 3 && box.y1 < zone.y2 + 3 && box.y2 > zone.y1 - 3
      );
      const overlapsYear = accepted.some(zone =>
        zone.side === item.side && box.x1 < zone.x2 + 7 && box.x2 > zone.x1 - 7 && box.y1 < zone.y2 + 2 && box.y2 > zone.y1 - 2
      );
      if (overlapsLabel || overlapsYear) continue;

      accepted.push({ ...box, side: item.side, x: item.x, width });
      state.eventYearZones.push({ x: item.x, width, side: item.side, lane: 0 });
      const year = document.createElement('div');
      year.className = 'event-year';
      year.textContent = item.text;
      year.style.left = `${item.x}px`;
      year.style.transform = 'translateX(-50%)';
      year.style.top = `${item.y}px`;
      year.style.color = item.color;
      labelLayer.appendChild(year);
    }
  }

  function targetAtClientPoint(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return [...state.hitTargets].reverse().find(t => x >= t.x1 && x <= t.x2 && y >= t.y1 && y <= t.y2) || null;
  }

  function onViewportClick(event) {
    if (isInsideZoomRail(event.clientX, event.clientY)) return;
    if (state.movedDuringDrag) {
      state.movedDuringDrag = false;
      return;
    }

    if (event.target.closest('a, button, input, select, textarea, [role="button"]')) return;

    const target = targetAtClientPoint(event.clientX, event.clientY);
    if (target) {
      openDetails(target.event, event.clientX, event.clientY);
      return;
    }

    closeDetails();
  }

  function detailMarkup(event) {
    const preview = event.thumbnail || (looksLikeImage(event.media) ? event.media : '');
    const image = preview ? `<img src="${escapeAttribute(preview)}" alt="${escapeAttribute(event.mediaCaption || event.headline)}" onerror="this.style.display='none'" />` : '';
    const body = event.text ? `<div class="detail-body">${escapeHtml(event.text)}</div>` : '<div class="detail-body">No additional description is available.</div>';
    const caption = event.mediaCaption ? `<div class="detail-meta">${escapeHtml(event.mediaCaption)}</div>` : '';
    const credit = event.mediaCredit ? `<div class="detail-meta">Credit: ${escapeHtml(event.mediaCredit)}</div>` : '';
    const link = event.media ? `<section class="detail-media"><div class="detail-meta">Media</div><a href="${escapeAttribute(mediaDestinationUrl(event.media))}" target="_blank" rel="noopener noreferrer">Open media ↗</a><div class="detail-media-url">${escapeHtml(event.media)}</div></section>` : '<div class="detail-meta">No media link is present in this record.</div>';
    return `<h2>${escapeHtml(event.headline)}</h2><div class="detail-date">${escapeHtml(event.displayDate || formatYear(event.start))}</div><div class="detail-meta">${escapeHtml(event.category)} · ${escapeHtml(event.elementType)}</div>${image}${caption}${credit}${body}${link}`;
  }

  function animateViewTo(targetStart, targetEnd, duration = 220, onDone = null) {
    if (state.viewAnimationRaf) cancelAnimationFrame(state.viewAnimationRaf);
    const fromStart = state.viewStart;
    const fromEnd = state.viewEnd;
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);

    const frame = now => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = ease(progress);
      state.viewStart = fromStart + (targetStart - fromStart) * eased;
      state.viewEnd = fromEnd + (targetEnd - fromEnd) * eased;
      scheduleRender();
      if (progress < 1) state.viewAnimationRaf = requestAnimationFrame(frame);
      else {
        state.viewAnimationRaf = null;
        state.viewStart = targetStart;
        state.viewEnd = targetEnd;
        scheduleRender();
        onDone?.();
      }
    };
    state.viewAnimationRaf = requestAnimationFrame(frame);
  }

  function shiftFocusedEventClearOfPanel(event) {
    requestAnimationFrame(() => {
      if (detailPanel.hidden || state.selectedEvent?.id !== event.id) return;
      const viewportRect = viewport.getBoundingClientRect();
      const panelRect = detailPanel.getBoundingClientRect();
      const width = viewportRect.width;
      const visibleRight = Math.max(120, panelRect.left - viewportRect.left - 24);
      const currentX = timeToX(event.start, width);
      const safeRight = visibleRight - 44;
      if (currentX <= safeRight) return;

      const targetX = Math.max(92, visibleRight * 0.62);
      const span = state.viewEnd - state.viewStart;
      const timeShift = ((currentX - targetX) / Math.max(1, width)) * span;
      animateViewTo(state.viewStart + timeShift, state.viewEnd + timeShift);
    });
  }

  function defaultDetailAnchor(event) {
    const rect = viewport.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const eventX = timeToX(event.start, width);

    return {
      clientX: rect.left + Math.max(24, Math.min(width - 24, eventX)),
      clientY: rect.top + Math.max(72, Math.min(rect.height - 72, rect.height * state.axisYRatio))
    };
  }

  function positionDetailPanel(clientX, clientY) {
    if (detailPanel.hidden) return;

    const viewportRect = viewport.getBoundingClientRect();
    const gap = 12;
    const edge = 12;

    detailPanel.style.left = '0px';
    detailPanel.style.top = '0px';
    detailPanel.style.right = 'auto';
    detailPanel.style.bottom = 'auto';

    requestAnimationFrame(() => {
      if (detailPanel.hidden) return;

      const panelRect = detailPanel.getBoundingClientRect();
      const anchorX = clientX - viewportRect.left;
      const anchorY = clientY - viewportRect.top;

      let left = anchorX + gap;
      let top = anchorY + gap;

      if (left + panelRect.width > viewportRect.width - edge) {
        left = anchorX - panelRect.width - gap;
      }

      if (top + panelRect.height > viewportRect.height - edge) {
        top = anchorY - panelRect.height - gap;
      }

      left = Math.max(
        edge,
        Math.min(left, viewportRect.width - panelRect.width - edge)
      );

      top = Math.max(
        edge,
        Math.min(top, viewportRect.height - panelRect.height - edge)
      );

      detailPanel.style.left = `${Math.round(left)}px`;
      detailPanel.style.top = `${Math.round(top)}px`;
    });
  }

  function openDetails(event, clientX = null, clientY = null) {
    if (!DETAILS_ENABLED) return;

    state.selectedEvent = event;
    state.detailRestoreView = null;

    state.tooltipPinned = false;
    tooltip.classList.remove('is-pinned');
    tooltip.hidden = true;
    state.tooltipToken++;

    state.focusedEvent = null;

    const anchor = Number.isFinite(clientX) && Number.isFinite(clientY)
      ? { clientX, clientY }
      : defaultDetailAnchor(event);

    state.detailAnchor = anchor;

    detailPanel.style.setProperty('--event-color', event.color || '#5b7cfa');
    detailContent.innerHTML = detailMarkup(event);
    detailPanel.hidden = false;

    // Restart the restrained entrance animation when the user selects a
    // different event while the floating panel is already open.
    detailPanel.classList.remove('is-opening');
    void detailPanel.offsetWidth;
    detailPanel.classList.add('is-opening');

    positionDetailPanel(anchor.clientX, anchor.clientY);
    scheduleRender();
  }

  function closeDetails() {
    if (detailPanel.hidden) return;

    state.detailRestoreView = null;
    state.detailAnchor = null;
    state.selectedEvent = null;
    detailPanel.classList.remove('is-opening');
    detailPanel.hidden = true;

    scheduleRender();
    viewport.focus();
  }


  function updateSearchResults() {
    const query = state.searchQuery.trim();

    state.searchMatches = query
      ? state.events
          .filter(event =>
            state.enabledCategories.has(event.category) &&
            eventMatchesSearch(event, query)
          )
          .sort((a, b) => a.start - b.start)
      : [];

    if (!state.searchMatches.length) {
      state.searchMatchIndex = -1;
      searchResults.hidden = !query;
      searchResultCount.textContent = '0 / 0';
      searchPrevious.disabled = true;
      searchNext.disabled = true;
      return;
    }

    if (
      state.searchMatchIndex < 0 ||
      state.searchMatchIndex >= state.searchMatches.length
    ) {
      state.searchMatchIndex = 0;
    }

    searchResults.hidden = false;
    searchResultCount.textContent =
      `${state.searchMatchIndex + 1} / ${state.searchMatches.length}`;
    searchPrevious.disabled = false;
    searchNext.disabled = false;
  }

  function onSearchInput() {
    state.searchQuery = searchInput.value;
    state.searchMatchIndex = -1;
    updateSearchResults();
    scheduleRender();
  }

  function moveToSearchResult(direction = 1) {
    updateSearchResults();
    if (!state.searchMatches.length) return;

    state.searchMatchIndex =
      (state.searchMatchIndex + direction + state.searchMatches.length) %
      state.searchMatches.length;

    const event = state.searchMatches[state.searchMatchIndex];
    const currentSpan = state.viewEnd - state.viewStart;

    if (isEraBlock(event)) {
      // Era blocks are framed around their complete duration, with modest
      // context on both sides.
      const eraSpan = Math.max(1, event.end - event.start);
      const padding = Math.max(eraSpan * 0.12, 4);
      const targetStart = event.start - padding;
      const targetEnd = event.end + padding;

      state.viewStart = targetStart;
      state.viewEnd = targetEnd;
    } else {
      // Point events retain the existing close-up behavior.
      const targetSpan = Math.min(
        currentSpan,
        Math.max(30, Math.min(140, currentSpan))
      );

      state.viewStart = event.start - targetSpan * 0.42;
      state.viewEnd = state.viewStart + targetSpan;
    }

    // Search navigation focuses the viewport without opening details.
    state.selectedEvent = null;
    searchResultCount.textContent =
      `${state.searchMatchIndex + 1} / ${state.searchMatches.length}`;

    scheduleRender();
  }

  function jumpToFirstSearchResult() {
    state.searchMatchIndex = -1;
    moveToSearchResult(1);
  }

  function onTimelineKeyDown(event) {
    if (event.key === 'Escape' && !detailPanel.hidden) { closeDetails(); return; }
    if (!['ArrowLeft','ArrowRight','Enter'].includes(event.key)) return;
    const candidates = state.events.filter(e => state.enabledCategories.has(e.category)).sort((a,b) => a.start-b.start);
    if (!candidates.length) return;
    let index = state.selectedEvent ? candidates.findIndex(e => e.id === state.selectedEvent.id) : -1;
    if (event.key === 'ArrowRight') index = Math.min(candidates.length - 1, index + 1);
    if (event.key === 'ArrowLeft') index = Math.max(0, index < 0 ? 0 : index - 1);
    if (event.key === 'Enter' && state.selectedEvent) { openDetails(state.selectedEvent); return; }
    state.selectedEvent = candidates[index];
    const center = state.selectedEvent.start;
    const span = state.viewEnd - state.viewStart;
    state.viewStart = center - span / 2;
    state.viewEnd = center + span / 2;
    scheduleRender();
  }

  function overviewRatioFromPointer(event) {
    const rect = overviewTrack.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
  }

  function moveOverviewWindowTo(centerRatio) {
    const bounds = navigationBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const span = Math.min(fullSpan, state.viewEnd - state.viewStart);
    const center = bounds.min + centerRatio * fullSpan;
    clampView(center - span / 2, center + span / 2);
    scheduleRender();
  }

  function onOverviewPointerDown(event) {
    if (!overviewTrack.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    overviewNavigator.setPointerCapture?.(event.pointerId);
    const ratio = overviewRatioFromPointer(event);
    const bounds = navigationBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const windowCenterRatio = (((state.viewStart + state.viewEnd) / 2) - bounds.min) / fullSpan;
    const handle = event.target.closest?.('[data-overview-handle]');
    state.overviewDragging = true;
    state.overviewDragStartRatio = ratio;
    state.overviewDragStartViewStart = state.viewStart;
    state.overviewDragStartViewEnd = state.viewEnd;

    if (handle) {
      state.overviewDragMode = handle.dataset.overviewHandle;
      return;
    }

    if (overviewWindow.contains(event.target)) {
      state.overviewDragMode = 'pan';
      state.overviewDragOffsetRatio = ratio - windowCenterRatio;
    } else {
      state.overviewDragMode = 'pan';
      state.overviewDragOffsetRatio = 0;
      moveOverviewWindowTo(ratio);
    }
  }

  function onOverviewPointerMove(event) {
    if (!state.overviewDragging) return;
    event.preventDefault();
    const ratio = overviewRatioFromPointer(event);
    if (state.overviewDragMode === 'pan') {
      moveOverviewWindowTo(ratio - state.overviewDragOffsetRatio);
      return;
    }

    const bounds = navigationBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const minSpan = Math.min(fullSpan, Math.max(MIN_VISIBLE_YEARS, fullSpan * 0.002));
    const pointerTime = bounds.min + ratio * fullSpan;
    if (state.overviewDragMode === 'left') {
      state.viewStart = Math.max(bounds.min, Math.min(pointerTime, state.viewEnd - minSpan));
    } else if (state.overviewDragMode === 'right') {
      state.viewEnd = Math.min(bounds.max, Math.max(pointerTime, state.viewStart + minSpan));
    }
    scheduleRender();
  }

  function onOverviewPointerUp(event) {
    if (!state.overviewDragging) return;
    state.overviewDragging = false;
    state.overviewDragMode = null;
    overviewNavigator.releasePointerCapture?.(event.pointerId);
  }

  function onOverviewWheel(event) {
    if (!overviewTrack.contains(event.target)) return;
    event.preventDefault();
    const ratio = overviewRatioFromPointer(event);
    const bounds = navigationBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const currentSpan = Math.max(MIN_VISIBLE_YEARS, state.viewEnd - state.viewStart);
    const anchorTime = bounds.min + ratio * fullSpan;
    const anchorRatio = Math.max(0, Math.min(1, (anchorTime - state.viewStart) / currentSpan));
    const nextSpan = Math.min(fullSpan, Math.max(MIN_VISIBLE_YEARS, currentSpan * Math.exp(event.deltaY * 0.004)));
    let start = anchorTime - nextSpan * anchorRatio;
    let end = start + nextSpan;
    clampView(start, end);
    scheduleRender();
  }

  function drawOverview() {
    const rect = overviewCanvas.getBoundingClientRect();
    const dpr = state.dpr;
    overviewCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    overviewCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    overviewCtx.setTransform(dpr,0,0,dpr,0,0);
    overviewCtx.clearRect(0,0,rect.width,rect.height);
    const bounds = navigationBounds();
    const span = Math.max(.0001, bounds.max-bounds.min);
    overviewCtx.globalAlpha = .78;
    const enabled = state.events.filter(e => state.enabledCategories.has(e.category));
    enabled.filter(e => e.elementType === 'Period' && e.end != null).forEach((e, index) => {
      const x = ((e.start-bounds.min)/span)*rect.width;
      const x2=((e.end-bounds.min)/span)*rect.width;
      overviewCtx.fillStyle = e.color;
      overviewCtx.fillRect(x, 28 + (index % 2) * 7, Math.max(1,x2-x), 5);
    });
    enabled.filter(e => e.elementType !== 'Period').forEach((e, index) => {
      const x = ((e.start-bounds.min)/span)*rect.width;
      overviewCtx.fillStyle = e.color;
      const y = 7 + (index % 3) * 6;
      overviewCtx.fillRect(x, y, 2, 14);
    });
    overviewCtx.globalAlpha = 1;
    const left = ((state.viewStart-bounds.min)/span)*rect.width;
    const right = ((state.viewEnd-bounds.min)/span)*rect.width;
    overviewWindow.style.left = `${Math.max(0,left)}px`;
    overviewWindow.style.width = `${Math.max(8,Math.min(rect.width, right)-Math.max(0,left))}px`;
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  loadTimeline();
})();
