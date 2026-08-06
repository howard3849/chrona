(() => {
  'use strict';

  const APP_VERSION = window.CHRONA_VERSION || 'dev';

  const DEFAULT_SHEET_STORAGE_KEY = 'chrona-default-sheet-url';
  const ONBOARDING_DISMISSED_STORAGE_KEY = 'chrona-onboarding-dismissed-v2';
  const INCLUDE_SAMPLE_STORAGE_KEY = 'chrona-include-sample-timeline-v1';
  const DEFAULT_EVENT_GID = 681184261;
  const DEFAULT_CONFIG_GID = 1696716043;
  // Legacy tab GIDs remain import-only so existing workbooks can be migrated.
  const DEFAULT_CATEGORY_GID = 1068523108;
  const DEFAULT_TRANSLATION_GID = 1376603082;
  const DEFAULT_DICTIONARY_GID = 331215478;
  const LANGUAGE_STORAGE_KEY = 'chrona-language';
  const TRANSLATION_CACHE_KEY = 'chrona-translation-cache-v1';
  const TRANSLATION_SESSION_KEY = 'chrona-translation-session-v1';
  const DEFAULT_AXIS_Y_RATIO = 0.47;
  // Desktop timelines can require substantial vertical travel when several
  // point and period lanes sit on the same side of the axis. Keep the axis
  // movable beyond the viewport so those off-screen rows can be brought into view.
  const DESKTOP_AXIS_MIN_RATIO = -1.5;
  const DESKTOP_AXIS_MAX_RATIO = 2.5;
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
  const aboveSetsSave = document.getElementById('aboveSetsSave');
  const sheetUrlInput = document.getElementById('defaultSheetUrl');
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
  const searchClose = document.getElementById('searchClose');
  const appHeader = document.querySelector('.app-header');
  const toolbar = document.querySelector('.toolbar');
  const detailPanel = document.getElementById('detailPanel');
  const detailPanelHome = detailPanel?.parentElement;
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
  const yearCursorRelative = document.getElementById('yearCursorRelative');
  const languageSelect = document.getElementById('languageSelect');
  const onboardingNotice = document.getElementById('onboardingNotice');
  const onboardingUseSample = document.getElementById('onboardingUseSample');
  const onboardingAddSheet = document.getElementById('onboardingAddSheet');
  const exportWorkbookButton = document.getElementById('exportWorkbook');
  const workbookTransferStatus = document.getElementById('workbookTransferStatus');
  const includeSampleTimelineInput = document.getElementById('includeSampleTimeline');
  const listViewToggle = document.getElementById('listViewToggle');
  const listViewBackdrop = document.getElementById('listViewBackdrop');
  const listViewPanel = document.getElementById('listViewPanel');
  const listViewClose = document.getElementById('listViewClose');
  const listViewScroller = document.getElementById('listViewScroller');
  const listViewItems = document.getElementById('listViewItems');
  const listViewSummary = document.getElementById('listViewSummary');

  const state = {
    events: [],
    categories: new Map(),
    enabledCategories: new Set(),
    aboveGroups: new Set(),
    language: localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en-US',
    baselineLanguage: 'en',
    availableLanguages: ['en'],
    translations: new Map(),
    neverTranslate: [],
    config: new Map(),
    groupColors: new Map(),
    configuredPrimaryGroups: [],
    workbookRows: { timeline: [], config: [] },
    privateTimelineRows: [],
    browserTranslationCache: new Map(),
    browserTranslator: null,
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
    cursorY: null,
    cursorYear: null,
    mobileEventPositions: [],
    selectedPhonePeriodId: null,
    detailShowOriginal: false,
    pendingAboveGroups: null,
    viewAnimationRaf: null,
    zoomDialActive: false,
    axisYRatio: Math.max(DESKTOP_AXIS_MIN_RATIO, Math.min(DESKTOP_AXIS_MAX_RATIO, Number(localStorage.getItem('chrona-axis-y-ratio')) || DEFAULT_AXIS_Y_RATIO)),
    tooltipToken: 0,
    overviewDragging: false,
    overviewDragMode: null,
    overviewDragOffsetRatio: 0,
    overviewDragStartRatio: 0,
    overviewDragStartViewStart: 0,
    overviewDragStartViewEnd: 0,
    overviewRefreshTimer: null,
    overviewCategorySnapshot: new Set(),
    overviewBounds: null,
    listViewOpen: false,
    listViewAnchorId: null
  };

  const UI_STRINGS = {
    'en-US': {
      'app.subtitle': 'Interactive Timeline Explorer',
      'language.label': 'Language',
      'language.baseline': 'Baseline',
      'actions.reload': 'Reload',
      'actions.save': 'Save',
      'actions.useBannerUrl': 'Use banner URL',
      'actions.saveDefault': 'Save default',
      'actions.clear': 'Clear',
      'actions.hide': 'Hide',
      'actions.show': 'Show',
      'settings.title': 'Settings',
      'settings.googleSheet': 'Google Sheet URL',
      'settings.timeline': 'Timeline',
      'settings.appearance': 'Appearance',
      'settings.general': 'General',
      'settings.advanced': 'Advanced',
      'settings.version': 'Version',
      'settings.versionHelp': 'The version is finalized automatically with each Chrona release.',
      'settings.sheetHelp': 'This default is stored locally on this device. The Sheet URL in the top banner remains temporary unless you save it here.',
      'settings.subtitle': 'Appearance changes apply immediately.',
      'settings.defaultSheet': 'Default Google Sheet',
      'settings.savedBrowser': 'Saved only in this browser',
      'settings.timelineStyle': 'Timeline style',
      'settings.colorMode': 'Color mode',
      'settings.languageHeading': 'Language',
      'settings.languageHelp': 'The Config sheet defines the baseline and available languages. Human-translated Timeline Data columns are used first; missing text is translated on the fly while Never Translate phrases stay unchanged.',
      'toolbar.aboveSets': 'Primary',
      'toolbar.visible': 'Visible',
      'groups.none': 'None',
      'groups.choose': 'Choose groups',
      'groups.search': 'Search groups',
      'search.placeholder': 'Event, group, or year',
      'sheet.placeholder': 'Paste a Google Sheet URL',
      'overview.title': 'Timeline overview',
      'overview.help': 'Drag window to pan · drag edges to zoom',
      'details.noDescription': 'No additional description is available.',
      'details.aboveSet': 'Above set',
      'details.referenceSet': 'Reference set',
      'details.machineTranslationDisclosure': 'This card includes AI or machine-translated text. Translation may contain errors.',
      'details.showOriginal': 'Show original',
      'details.showTranslation': 'Show translation',
      'details.mediaDisclosure': 'Media links and credits are provided by the timeline record.',
      'details.source': 'Source',
      'details.mediaSource': 'Media',
      'details.duration': 'Duration',
      'details.event': 'Event',
      'details.period': 'Period',
      'status.loading': 'Loading timeline data…',
      'status.records': '{count} timeline records loaded — {source}.',
      'status.translationFallback': 'Some translated text is unavailable; baseline-language text is shown.'
    },
    'zh-TW': {
      'app.subtitle': '互動式時間軸瀏覽器',
      'language.label': '語言',
      'language.baseline': '基準',
      'actions.reload': '重新載入',
      'actions.save': '儲存',
      'actions.useBannerUrl': '使用上方網址',
      'actions.saveDefault': '儲存預設值',
      'actions.clear': '清除',
      'actions.hide': '隱藏',
      'actions.show': '顯示',
      'settings.title': '設定',
      'settings.googleSheet': 'Google 試算表網址',
      'settings.timeline': '時間軸',
      'settings.appearance': '外觀',
      'settings.general': '一般',
      'settings.advanced': '進階',
      'settings.version': '版本',
      'settings.versionHelp': '每次產生替換 ZIP 時，版本號都會增加。',
      'settings.sheetHelp': '此預設值只會儲存在這台裝置。本頁上方的試算表網址仍是暫時使用，除非您在此儲存。',
      'settings.subtitle': '外觀變更會立即套用。',
      'settings.defaultSheet': '預設 Google 試算表',
      'settings.savedBrowser': '只儲存在此瀏覽器',
      'settings.timelineStyle': '時間軸樣式',
      'settings.colorMode': '色彩模式',
      'settings.languageHeading': '語言',
      'settings.languageHelp': 'Config 工作表會指定基準語言與可用語言。Chrona 會優先使用 Timeline Data 內的人工作翻譯欄位，缺少的內容才即時翻譯，並保留 Never Translate 詞彙。',
      'toolbar.aboveSets': '主要',
      'toolbar.visible': '顯示',
      'groups.none': '無',
      'groups.choose': '選擇群組',
      'groups.search': '搜尋群組',
      'search.placeholder': '事件、群組或年份',
      'sheet.placeholder': '貼上 Google 試算表網址',
      'overview.title': '時間軸總覽',
      'overview.help': '拖曳視窗平移 · 拖曳邊緣縮放',
      'details.noDescription': '沒有其他說明。',
      'details.aboveSet': '上方群組',
      'details.referenceSet': '參考群組',
      'details.machineTranslationDisclosure': '此卡片包含 AI 或機器翻譯文字，翻譯內容可能有誤。',
      'details.showOriginal': '顯示原文',
      'details.showTranslation': '顯示翻譯',
      'details.mediaDisclosure': '媒體連結與出處由時間軸資料提供。',
      'details.source': '來源',
      'details.mediaSource': '媒體',
      'details.duration': '期間',
      'details.event': '事件',
      'details.period': '時期',
      'status.loading': '正在載入時間軸資料…',
      'status.records': '已載入 {count} 筆時間軸資料 — {source}。',
      'status.translationFallback': '部分翻譯尚未提供，已顯示基準語言內容。'
    }
  };

  function t(key, variables = {}) {
    const table = UI_STRINGS[state.language] || UI_STRINGS['en-US'];
    let value = table[key] ?? UI_STRINGS['en-US'][key] ?? key;
    Object.entries(variables).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, String(replacement));
    });
    return value;
  }

  function loadBrowserTranslationCache() {
    try {
      const sessionValue = sessionStorage.getItem(TRANSLATION_SESSION_KEY);
      const legacyValue = localStorage.getItem(TRANSLATION_CACHE_KEY);
      const saved = JSON.parse(sessionValue || legacyValue || '{}');
      state.browserTranslationCache = new Map(Object.entries(saved));
      if (!sessionValue && legacyValue) {
        sessionStorage.setItem(TRANSLATION_SESSION_KEY, JSON.stringify(saved));
        localStorage.removeItem(TRANSLATION_CACHE_KEY);
      }
    } catch (_) {
      state.browserTranslationCache = new Map();
    }
  }

  function saveBrowserTranslationCache() {
    const entries = [...state.browserTranslationCache.entries()].slice(-2000);
    sessionStorage.setItem(TRANSLATION_SESSION_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  function languageName(code) {
    const fallbacks = { 'en-US': 'English', 'zh-TW': '繁體中文', 'zh-CN': '简体中文', 'ja-JP': '日本語', 'ko-KR': '한국어' };
    try {
      return new Intl.DisplayNames([state.language, 'en-US'], { type: 'language' }).of(code) || fallbacks[code] || code;
    } catch (_) {
      return fallbacks[code] || code;
    }
  }

  function rebuildLanguageOptions() {
    if (!languageSelect) return;
    languageSelect.replaceChildren();
    state.availableLanguages.forEach(code => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `${languageName(code)}${code === state.baselineLanguage ? ` · ${t('language.baseline')}` : ''}`;
      languageSelect.appendChild(option);
    });
    languageSelect.value = state.language;
  }

  function translatorLanguageCandidates(code, isSource = false) {
    const normalized = String(code || '').trim();
    const map = {
      'en-US': ['en-US', 'en'],
      'en-GB': ['en-GB', 'en'],
      'zh-TW': ['zh-Hant', 'zh-TW', 'zh'],
      'zh-CN': ['zh-Hans', 'zh-CN', 'zh'],
      'ja-JP': ['ja-JP', 'ja'],
      'ko-KR': ['ko-KR', 'ko']
    };
    const candidates = map[normalized] || [normalized, normalized.split('-')[0]];
    return [...new Set(candidates.filter(Boolean))];
  }

  function applyInterfaceLanguage() {
    document.documentElement.lang = state.language;
    rebuildLanguageOptions();
    const appVersion = document.getElementById('appVersion');
    if (appVersion) appVersion.textContent = `v${APP_VERSION}`;
    document.querySelectorAll('[data-i18n]').forEach(node => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
    if (aboveSetsSearch) aboveSetsSearch.placeholder = t('groups.search');
  }

  function translationMapKey(entityId, language, field) {
    return `${language}::${entityId}::${field}`;
  }

  function normalizeLanguageCode(value) {
    const raw = String(value || '').trim().replaceAll('_', '-');
    if (!raw) return '';
    const aliases = { SP: 'es', EN: 'en', FR: 'fr', TC: 'zh-TW', SC: 'zh-CN' };
    if (aliases[raw.toUpperCase()]) return aliases[raw.toUpperCase()];
    const parts = raw.split('-').filter(Boolean);
    return parts.map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (part.length === 4) return part[0].toUpperCase() + part.slice(1).toLowerCase();
      if (part.length === 2 || /^\d{3}$/.test(part)) return part.toUpperCase();
      return part.toLowerCase();
    }).join('-');
  }

  function loadTranslations(rows) {
    // Legacy Translations-tab support. New workbooks keep translations beside
    // their Timeline Data row in fields such as Title [zh-TW].
    state.translations.clear();
    rows.forEach(row => {
      const entityId = String(row['Entity ID'] || row['Event ID'] || '').trim();
      const language = normalizeLanguageCode(row.Language);
      const field = String(row.Field || '').trim();
      const translation = String(row.Translation || '').trim();
      if (!entityId || !language || !field || !translation || translation.startsWith('#')) return;
      state.translations.set(translationMapKey(entityId, language, field), {
        translation: sanitizeTranslationArtifacts(translation),
        sourceText: String(row['Source Text'] || ''),
        status: String(row.Status || 'human').toLowerCase()
      });
    });
  }

  function translatedColumnInfo(header) {
    const match = String(header || '').trim().match(/^(Title|Headline|Description|Text|Media Caption)\s*\[([^\]]+)\]$/i);
    if (!match) return null;
    const fieldName = match[1].toLowerCase();
    const field = fieldName === 'title' || fieldName === 'headline'
      ? 'headline'
      : fieldName === 'description' || fieldName === 'text'
        ? 'text'
        : 'mediaCaption';
    return { field, language: normalizeLanguageCode(match[2]) };
  }

  function inferLanguagesFromTimelineRows(rows) {
    const inferred = [];
    rows.forEach(row => Object.keys(row).forEach(header => {
      const info = translatedColumnInfo(header);
      if (info?.language) inferred.push(info.language);
    }));
    return [...new Set(inferred)];
  }

  function loadInlineTranslations(rows) {
    rows.forEach((row, index) => {
      const group = String(row.Group || row.Category || 'Uncategorized').trim();
      const title = String(row.Title || row.Title || row.Headline || '(Untitled)');
      const entityId = String(row['Event ID'] || generateEventId(group, row.Year, title, index)).trim();
      Object.entries(row).forEach(([header, value]) => {
        const info = translatedColumnInfo(header);
        const translation = String(value || '').trim();
        if (!info?.language || !translation) return;
        const sourceText = info.field === 'headline'
          ? String(row.Title || row.Headline || '')
          : info.field === 'text'
            ? String(row.Description || row.Description || row.Text || '')
            : String(row['Media Caption'] || '');
        state.translations.set(translationMapKey(entityId, info.language, info.field), {
          translation: sanitizeTranslationArtifacts(translation),
          sourceText,
          status: 'human'
        });
      });
    });
  }

  function configRowsToMap(rows) {
    const map = new Map();
    rows.forEach(row => {
      const key = String(row.Key || row.Setting || '').trim();
      if (!key) return;
      map.set(key, String(row.Value || '').trim());
    });
    return map;
  }

  function loadConfig(rows, timelineRows = []) {
    state.workbookRows.config = rows.map(row => ({ ...row }));
    state.config = configRowsToMap(rows);
    state.baselineLanguage = normalizeLanguageCode(
      state.config.get('language_baseline') ||
      state.config.get('baseline_language') ||
      state.config.get('default_language') ||
      'en'
    ) || 'en';

    const configuredLanguages = String(
      state.config.get('language_available') ||
      state.config.get('available_languages') ||
      ''
    ).split(',').map(normalizeLanguageCode).filter(Boolean);
    const inferredLanguages = configuredLanguages.length ? [] : inferLanguagesFromTimelineRows(timelineRows);
    state.availableLanguages = [...new Set([state.baselineLanguage, ...configuredLanguages, ...inferredLanguages])];
    if (!state.availableLanguages.includes(state.language)) state.language = state.baselineLanguage;

    state.neverTranslate = [...state.config.entries()]
      .filter(([key, value]) => /^never_translate(?:\.|$)/i.test(key) && value)
      .map(([, value]) => value)
      .sort((a, b) => b.length - a.length);

    state.groupColors = new Map();
    [...state.config.entries()].forEach(([key, value]) => {
      const match = key.match(/^group_color\.(.+)$/i);
      if (match && value) state.groupColors.set(match[1].trim(), normalizeHex(value));
    });
    state.configuredPrimaryGroups = String(state.config.get('primary_groups') || '')
      .split(',').map(value => value.trim()).filter(Boolean);
    rebuildLanguageOptions();
  }

  function protectNeverTranslateTerms(sourceText) {
    let protectedText = String(sourceText || '');
    const replacements = [];
    state.neverTranslate.forEach(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const startsWord = /^[\p{L}\p{N}]/u.test(term);
      const endsWord = /[\p{L}\p{N}]$/u.test(term);
      const pattern = new RegExp(`${startsWord ? '(?<![\\p{L}\\p{N}])' : ''}${escaped}${endsWord ? '(?![\\p{L}\\p{N}])' : ''}`, 'giu');
      protectedText = protectedText.replace(pattern, match => {
        const token = `CHRONATERM${replacements.length}TOKEN`;
        replacements.push({ token, displayAs: match, original: match });
        return token;
      });
    });
    return { protectedText, replacements };
  }

  function sanitizeTranslationArtifacts(value, replacements = []) {
    let cleaned = String(value || '');
    replacements.forEach(({ token, displayAs }, index) => {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escapedToken, 'gi'), displayAs);
      cleaned = cleaned.replace(new RegExp(`chronaterm\\s*\\(?\\s*${index}\\s*\\)?\\s*token`, 'gi'), displayAs);
    });
    cleaned = cleaned.replace(/chronaterm\s*\(?\s*\d+\s*\)?\s*token/gi, '');
    return cleaned.replace(/\s{2,}/g, ' ').replace(/\s+([，。！？；：,.!?;:])/g, '$1').trim();
  }

  function restoreNeverTranslateTerms(translatedText, replacements) {
    return sanitizeTranslationArtifacts(translatedText, replacements);
  }

  function translationLanguageCandidates(language) {
    const normalized = normalizeLanguageCode(language);
    if (!normalized) return [];
    const candidates = [normalized];
    const lower = normalized.toLowerCase();

    // Treat script and region variants as equivalent for worksheet lookup.
    // This lets a selected browser language such as zh-Hant use a human
    // worksheet column named Title [zh-TW], and vice versa.
    if (lower === 'zh-hant' || lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo') {
      candidates.push('zh-TW', 'zh-Hant', 'zh-HK', 'zh');
    } else if (lower === 'zh-hans' || lower === 'zh-cn' || lower === 'zh-sg') {
      candidates.push('zh-CN', 'zh-Hans', 'zh');
    } else if (normalized.includes('-')) {
      candidates.push(normalized.split('-')[0]);
    }
    return [...new Set(candidates.map(normalizeLanguageCode).filter(Boolean))];
  }

  function savedTranslation(entityId, field, sourceText) {
    if (state.language === state.baselineLanguage) return '';
    for (const language of translationLanguageCandidates(state.language)) {
      const record = state.translations.get(translationMapKey(entityId, language, field));
      if (!record) continue;

      // Human-authored inline worksheet translations are authoritative.
      // Source-text drift checks apply only to generated/legacy machine entries.
      const status = String(record.status || '').toLowerCase();
      const humanAuthored = status === 'human' || status === 'approved';
      const savedSource = String(record.sourceText || '').trim();
      const currentSource = String(sourceText || '').trim();
      if (!humanAuthored && savedSource && currentSource && savedSource !== currentSource) continue;

      const translation = sanitizeTranslationArtifacts(record.translation);
      if (translation) return translation;
    }
    return '';
  }

  function groupDisplayName(groupName) {
    return savedTranslation(`GROUP:${groupName}`, 'name', groupName) || groupName;
  }

  function localizedDisplayDate(event) {
    if (state.language === state.baselineLanguage) return event.sourceDisplayDate || '';
    const year = event.sourceYear;
    const month = event.sourceMonth;
    const day = event.sourceDay;
    const endYear = event.sourceEndYear;
    const endMonth = event.sourceEndMonth;
    const endDay = event.sourceEndDay;
    if (!year) return event.sourceDisplayDate || '';

    if (state.language === 'zh-TW' || state.language === 'zh-CN') {
      const start = `${year}年${month ? `${Number(month)}月` : ''}${day ? `${Number(day)}日` : ''}`;
      if (!endYear) return start;
      const end = `${endYear}年${endMonth ? `${Number(endMonth)}月` : ''}${endDay ? `${Number(endDay)}日` : ''}`;
      return `${start}－${end}`;
    }

    if (state.language.startsWith('en')) {
      const formatPart = (y, m, d) => {
        if (!m) return String(y);
        const monthName = new Intl.DateTimeFormat(state.language, { month: 'long', timeZone: 'UTC' })
          .format(new Date(Date.UTC(2000, Number(m) - 1, 1)));
        return d ? `${monthName} ${Number(d)}, ${y}` : `${monthName} ${y}`;
      };
      const first = formatPart(year, month, day);
      return endYear ? `${first}–${formatPart(endYear, endMonth, endDay)}` : first;
    }

    return event.sourceDisplayDate || '';
  }

  async function createBrowserTranslator() {
    if (state.language === state.baselineLanguage) return null;
    const API = globalThis.Translator;
    if (!API?.create) return null;
    const cacheKey = `${state.baselineLanguage}>${state.language}`;
    if (state.browserTranslator?.cacheKey === cacheKey) return state.browserTranslator.instance;

    for (const sourceLanguage of translatorLanguageCandidates(state.baselineLanguage, true)) {
      for (const targetLanguage of translatorLanguageCandidates(state.language)) {
        if (sourceLanguage === targetLanguage) continue;
        try {
          const availability = await API.availability?.({ sourceLanguage, targetLanguage });
          if (availability === 'unavailable') continue;
          const instance = await API.create({ sourceLanguage, targetLanguage });
          state.browserTranslator = { cacheKey, instance };
          return instance;
        } catch (_) {}
      }
    }
    return null;
  }

  async function browserTranslate(sourceText) {
    const text = String(sourceText || '').trim();
    if (!text || state.language === state.baselineLanguage) return '';
    const cacheKey = `${state.baselineLanguage}>${state.language}::never-translate-v1::${text}`;
    if (state.browserTranslationCache.has(cacheKey)) {
      const cached = sanitizeTranslationArtifacts(state.browserTranslationCache.get(cacheKey));
      if (cached) state.browserTranslationCache.set(cacheKey, cached);
      return cached;
    }
    const translator = await createBrowserTranslator();
    if (!translator?.translate) return '';
    const { protectedText, replacements } = protectNeverTranslateTerms(text);
    try {
      const translated = await translator.translate(protectedText);
      const restored = restoreNeverTranslateTerms(translated, replacements);
      if (restored) {
        state.browserTranslationCache.set(cacheKey, restored);
        saveBrowserTranslationCache();
      }
      return restored || '';
    } catch (_) {
      return '';
    }
  }

  function applyLanguageToEvents() {
    state.events.forEach(event => {
      event.headline = savedTranslation(event.id, 'headline', event.sourceHeadline) || event.sourceHeadline;
      event.text = savedTranslation(event.id, 'text', event.sourceText) || event.sourceText;
      event.mediaCaption = savedTranslation(event.id, 'mediaCaption', event.sourceMediaCaption) || event.sourceMediaCaption;
      event.categoryLabel = groupDisplayName(event.category);
      event.displayDate = localizedDisplayDate(event);
    });
  }

  async function translateMissingEvents() {
    if (state.language === state.baselineLanguage) return;
    const translator = await createBrowserTranslator();
    if (!translator) return;
    let changed = false;
    for (const event of state.events) {
      for (const [field, sourceField] of [['headline', 'sourceHeadline'], ['text', 'sourceText'], ['mediaCaption', 'sourceMediaCaption']]) {
        if (!event[sourceField] || savedTranslation(event.id, field, event[sourceField])) continue;
        const translated = await browserTranslate(event[sourceField]);
        if (translated) { event[field] = translated; changed = true; }
      }
      event.categoryLabel = groupDisplayName(event.category);
      if (changed) scheduleRender();
    }
    if (changed) {
      buildFilters();
      buildAboveSetsMenu();
      if (!detailPanel.hidden && state.selectedEvent) detailContent.innerHTML = detailMarkup(state.selectedEvent);
    }
  }

  function setLanguage(language, translateMissing = true) {
    state.detailShowOriginal = false;
    state.language = state.availableLanguages.includes(language) ? language : state.baselineLanguage;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
    applyInterfaceLanguage();
    applyLanguageToEvents();
    buildFilters();
    buildAboveSetsMenu();
    updateSearchResults();
    if (!detailPanel.hidden && state.selectedEvent) detailContent.innerHTML = detailMarkup(state.selectedEvent);
    scheduleRender();
    if (translateMissing) translateMissingEvents();
  }

  loadBrowserTranslationCache();
  applyInterfaceLanguage();
  languageSelect?.addEventListener('change', () => setLanguage(languageSelect.value));

  try {
    const savedAboveGroups = JSON.parse(localStorage.getItem('chrona-above-groups') || '[]');
    if (Array.isArray(savedAboveGroups)) state.aboveGroups = new Set(savedAboveGroups.map(String));
  } catch (_) {
    localStorage.removeItem('chrona-above-groups');
  }

  const importanceRank = { Major: 3, Medium: 2, Minor: 1 };
  const loadedTimelineThumbnails = new Set();
  const failedTimelineThumbnails = new Set();

  function syncSavedSheetUrlField() {
    if (!defaultSheetUrlInput) return;
    defaultSheetUrlInput.value = localStorage.getItem(DEFAULT_SHEET_STORAGE_KEY) || '';
  }

  syncSavedSheetUrlField();
  syncSampleLayerControl();
  window.addEventListener('pageshow', syncSavedSheetUrlField);
  window.addEventListener('storage', event => {
    if (event.key === DEFAULT_SHEET_STORAGE_KEY) syncSavedSheetUrlField();
  });

  const savedTheme = localStorage.getItem('timeline-theme') || 'auto';
  const savedVisualTheme = localStorage.getItem('chrona-visual-theme') || 'gradient';
  applyTheme(savedTheme);
  applyVisualTheme(savedVisualTheme);
  themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeValue)));
  visualThemeButtons.forEach(button => button.addEventListener('click', () => applyVisualTheme(button.dataset.visualThemeValue)));
  settingsToggle.addEventListener('click', () => toggleSettings());
  settingsClose.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', closeSettings);
  listViewToggle?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); state.listViewOpen ? closeListView() : openListView(); });
  listViewClose?.addEventListener('click', closeListView);
  listViewBackdrop?.addEventListener('click', closeListView);
  onboardingUseSample?.addEventListener('click', dismissOnboardingNotice);
  onboardingAddSheet?.addEventListener('click', () => {
    dismissOnboardingNotice();
    toggleSettings(true);
    requestAnimationFrame(() => defaultSheetUrlInput?.focus());
  });
  saveDefaultSheetUrlButton?.addEventListener('click', async () => {
    const value = sheetUrlInput?.value.trim() || '';
    try {
      if (value) {
        parseSheetSource(value);
        localStorage.setItem(DEFAULT_SHEET_STORAGE_KEY, value);
      } else {
        localStorage.removeItem(DEFAULT_SHEET_STORAGE_KEY);
        localStorage.removeItem(ONBOARDING_DISMISSED_STORAGE_KEY);
      }
      syncSavedSheetUrlField();
      syncSampleLayerControl();
      updateOnboardingNotice();
      defaultSheetStatus.textContent = state.language === 'zh-TW' ? '正在重新載入…' : 'Reloading…';
      await loadTimeline();
      defaultSheetStatus.textContent = value
        ? (state.language === 'zh-TW' ? '時間軸已重新載入。' : 'Timeline reloaded.')
        : (state.language === 'zh-TW' ? '已清除試算表網址並載入範例時間軸。' : 'Sheet URL cleared. Sample timeline loaded.');
    } catch (error) {
      defaultSheetStatus.textContent = error.message;
      sheetUrlInput?.focus();
    }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeSettings(); closeAboveSetsMenu(); closeListView(); } });
  systemTheme.addEventListener?.('change', () => {
    if ((localStorage.getItem('timeline-theme') || 'auto') === 'auto') {
      applyTheme('auto', false);
    }
  });

  reloadButton?.addEventListener('click', () => {
    loadTimeline();
    closeSheetControl();
  });
  includeSampleTimelineInput?.addEventListener('change', async () => {
    localStorage.setItem(INCLUDE_SAMPLE_STORAGE_KEY, String(includeSampleTimelineInput.checked));
    await loadTimeline();
  });

  exportWorkbookButton?.addEventListener('click', async event => {
    event.preventDefault();
    exportWorkbookButton.setAttribute('aria-disabled', 'true');
    workbookTransferStatus.textContent = state.language === 'zh-TW' ? '正在建立工作簿…' : 'Building workbook…';
    try {
      const translationCount = await exportTranslatedWorkbook();
      workbookTransferStatus.textContent = state.language === 'zh-TW'
        ? `已匯出工作簿，包含 ${translationCount} 個翻譯欄位。`
        : `Workbook exported with ${translationCount} translated cells.`;
    } catch (error) {
      workbookTransferStatus.textContent = error.message;
    } finally {
      exportWorkbookButton.removeAttribute('aria-disabled');
    }
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
    const preferred = Number(aboveSetsMenu.dataset.preferredWidth) || 180;
    const menuWidth = Math.min(preferred, window.innerWidth - 16);
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, buttonRect.left));
    aboveSetsMenu.style.width = `${menuWidth}px`;
    aboveSetsMenu.style.left = `${left}px`;
    aboveSetsMenu.style.right = 'auto';
    aboveSetsMenu.style.top = `${buttonRect.bottom}px`;
  }

  if (aboveSetsMenu && aboveSetsMenu.parentElement !== document.body) document.body.appendChild(aboveSetsMenu);

  aboveSetsButton?.addEventListener('click', event => {
    event.stopPropagation();
    const willOpen = aboveSetsMenu.hidden;
    aboveSetsMenu.hidden = !willOpen;
    aboveSetsButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      state.pendingAboveGroups = new Set(state.aboveGroups);
      buildAboveSetsMenu();
      filterAboveSetsMenu('');
      positionAboveSetsMenu();
      requestAnimationFrame(() => {
        aboveSetsList?.querySelector('.above-set-option')?.focus();
      });
    }
  });
  aboveSetsSave?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (state.pendingAboveGroups) {
      state.aboveGroups = new Set(state.pendingAboveGroups);
      localStorage.setItem('chrona-above-groups', JSON.stringify([...state.aboveGroups]));
      state.pendingAboveGroups = null;
      buildAboveSetsMenu();
      scheduleRender();
    }
    closeAboveSetsMenu();
  });
  window.addEventListener('resize', positionAboveSetsMenu);
  window.addEventListener('scroll', positionAboveSetsMenu, true);
  aboveSetsMenu?.addEventListener('pointerdown', event => event.stopPropagation());
  aboveSetsMenu?.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('pointerdown', event => {
    if (!aboveSetsMenu?.hidden && !aboveSetsMenu.contains(event.target) && !aboveSetsButton?.contains(event.target)) {
      closeAboveSetsMenu();
    }
  });

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown);

  // The detail pane is an independent scroll/selection surface layered inside
  // the timeline viewport. Stop its input events before they reach the viewport
  // handlers, but never prevent their default behavior: the browser still needs
  // pointer defaults for text selection and wheel/touch defaults for pane scroll.
  const isolateDetailInteraction = event => event.stopPropagation();
  detailPanel.addEventListener('pointerdown', isolateDetailInteraction);
  detailPanel.addEventListener('mousedown', isolateDetailInteraction);
  detailPanel.addEventListener('touchstart', isolateDetailInteraction, { passive: true });
  detailPanel.addEventListener('touchmove', isolateDetailInteraction, { passive: true });
  detailPanel.addEventListener('wheel', isolateDetailInteraction, { passive: true });
  detailPanel.addEventListener('selectstart', isolateDetailInteraction);
  detailPanel.addEventListener('click', isolateDetailInteraction);
  document.addEventListener('pointerdown', event => {
    if (!detailPanel.hidden && !detailPanel.contains(event.target)) closeDetails();
  }, true);
  viewport.addEventListener('pointermove', onPointerMove);
  window.addEventListener('resize', scheduleRender);
  window.addEventListener('orientationchange', () => setTimeout(scheduleRender, 120));
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

  detailContent.addEventListener('pointerdown', event => {
    event.stopPropagation();
  });

  detailContent.addEventListener('click', event => {
    const toggle = event.target.closest('[data-detail-language-toggle]');
    if (!toggle || !state.selectedEvent) return;
    event.preventDefault();
    event.stopPropagation();
    state.detailShowOriginal = !state.detailShowOriginal;
    detailContent.innerHTML = detailMarkup(state.selectedEvent);
  });
  function closeSheetControl() {
    sheetControl?.classList.remove('is-open');
  }

  function closeSearchControl() {
    searchControl.classList.remove('is-open');
    searchControl.closest('.search-shell')?.classList.remove('is-open');
    appHeader?.classList.remove('search-is-open');
    searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle.setAttribute('aria-label', 'Open search');

    // Exiting search mode must also remove every visual search state.
    // Keeping the query in state left non-matches dimmed and the active
    // match frame enlarged even after the control had retracted.
    state.searchQuery = '';
    state.searchMatches = [];
    state.searchMatchIndex = -1;
    searchInput.value = '';
    searchResults.hidden = true;
    searchResultCount.textContent = '0/0';
    searchPrevious.disabled = true;
    searchNext.disabled = true;
    scheduleRender();
  }

  function openSearchControl() {
    searchControl.classList.add('is-open');
    searchControl.closest('.search-shell')?.classList.add('is-open');
    appHeader?.classList.add('search-is-open');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchToggle.setAttribute('aria-label', 'Close search');
    updateSearchNavigation();
    requestAnimationFrame(() => {
      searchInput.focus({ preventScroll: true });
      searchInput.select();
    });
  }

  searchToggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const opening = !searchControl.classList.contains('is-open');
    if (opening) {
      openSearchControl();
    } else {
      closeSearchControl();
    }
  });

  searchControl.addEventListener('pointerdown', event => event.stopPropagation());
  document.addEventListener('pointerdown', event => {
    if (
      searchControl.classList.contains('is-open') &&
      !searchControl.contains(event.target) &&
      !searchToggle.contains(event.target)
    ) {
      closeSearchControl();
    }
  });
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearchControl();
      searchToggle.focus({ preventScroll: true });
      return;
    }
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
  if (searchClose) {
    searchClose.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeSearchControl();
      searchToggle?.focus({ preventScroll: true });
    });
  }
  viewport.addEventListener('click', onViewportClick);

  const viewportDebugButtons = [...document.querySelectorAll('[data-preview-size]')];
  function applyPreviewSize(size) {
    const normalized = ['computer', 'tablet', 'phone'].includes(size) ? size : 'computer';
    document.documentElement.dataset.previewSize = normalized;
    viewportDebugButtons.forEach(button => {
      button.classList.toggle('is-active', button.dataset.previewSize === normalized);
      button.setAttribute('aria-pressed', String(button.dataset.previewSize === normalized));
    });
    localStorage.setItem('chrona.previewSize', normalized);
    window.dispatchEvent(new Event('resize'));
    scheduleRender();
  }
  viewportDebugButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      applyPreviewSize(button.dataset.previewSize);
    });
  });
  applyPreviewSize(localStorage.getItem('chrona.previewSize') || 'computer');
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
    const normalized = ['ai', 'gradient', 'flat', 'metro'].includes(mode) ? mode : 'gradient';
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
    if (opening) {
      syncSavedSheetUrlField();
      if (defaultSheetStatus) defaultSheetStatus.textContent = '';
    }
    settingsPanel.hidden = !opening;
    settingsBackdrop.hidden = !opening;
    settingsToggle.classList.toggle('is-active', opening);
    settingsToggle.setAttribute('aria-expanded', String(opening));
    settingsToggle.setAttribute('aria-label', opening ? 'Close settings' : 'Open settings');
    if (opening) requestAnimationFrame(() => settingsClose.focus());
  }

  function dismissOnboardingNotice() {
    localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, 'true');
    if (onboardingNotice) onboardingNotice.hidden = true;
  }

  function updateOnboardingNotice() {
    if (!onboardingNotice) return;
    const hasSavedSheet = Boolean(localStorage.getItem(DEFAULT_SHEET_STORAGE_KEY));
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === 'true';
    onboardingNotice.hidden = hasSavedSheet || dismissed;
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
    const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
    if (duplicates.length) console.warn('Duplicate timeline headers detected; the leftmost populated value wins:', [...new Set(duplicates)]);
    return rows.slice(1).map(row => {
      const object = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const value = row[index] ?? '';
        if (!(header in object) || (!String(object[header]).trim() && String(value).trim())) object[header] = value;
      });
      return object;
    });
  }


  function workbookDateStamp() {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function translationCacheValue(language, sourceText) {
    const text = String(sourceText || '').trim();
    if (!text || language === state.baselineLanguage) return '';
    return sanitizeTranslationArtifacts(state.browserTranslationCache.get(`${state.baselineLanguage}>${language}::never-translate-v1::${text}`) || '');
  }

  function translatedHeader(field, language) {
    const labels = { headline: 'Title', text: 'Description', mediaCaption: 'Media Caption' };
    return `${labels[field]} [${language}]`;
  }

  function exportedTimelineRows() {
    return state.workbookRows.timeline.map((sourceRow, index) => {
      const row = { ...sourceRow };
      // Normalize the new schema while retaining all non-legacy custom columns.
      row.Title = row.Title || row.Headline || '';
      row.Description = row.Description || row.Text || '';
      delete row.Headline;
      delete row.Text;
      delete row.Position;
      const group = String(row.Group || row.Category || 'Uncategorized').trim();
      const entityId = String(row['Event ID'] || generateEventId(group, row.Year, row.Title, index)).trim();
      row['Event ID'] = entityId;

      state.availableLanguages.filter(language => language !== state.baselineLanguage).forEach(language => {
        const fields = [
          ['headline', row.Title || ''],
          ['text', row.Description || ''],
          ['mediaCaption', row['Media Caption'] || '']
        ];
        fields.forEach(([field, sourceText]) => {
          const saved = state.translations.get(translationMapKey(entityId, language, field))?.translation || '';
          const generated = translationCacheValue(language, sourceText);
          const value = sanitizeTranslationArtifacts(saved || generated || '');
          const header = translatedHeader(field, language);
          if (value) row[header] = value;
        });
      });
      return row;
    });
  }

  function exportedConfigRows() {
    const retained = state.workbookRows.config
      .filter(row => {
        const key = String(row.Key || row.Setting || '').trim();
        return key && ![
          'language_baseline', 'baseline_language', 'default_language',
          'language_available', 'available_languages', 'primary_groups'
        ].includes(key) && !/^group_color\./i.test(key) && !/^never_translate(?:\.|$)/i.test(key);
      })
      .map(row => ({ Key: String(row.Key || row.Setting || '').trim(), Value: String(row.Value || '') }));

    const exportGroups = [...new Set(state.workbookRows.timeline
      .map(row => String(row.Group || row.Category || '').trim())
      .filter(Boolean))];
    const exportGroupSet = new Set(exportGroups);
    const privateNeverTranslate = state.workbookRows.config
      .filter(row => /^never_translate(?:\.|$)/i.test(String(row.Key || row.Setting || '').trim()))
      .map(row => String(row.Value || '').trim())
      .filter(Boolean);
    const rows = [
      { Key: 'language_baseline', Value: state.baselineLanguage },
      { Key: 'language_available', Value: state.availableLanguages.join(',') },
      { Key: 'primary_groups', Value: [...state.aboveGroups].filter(name => exportGroupSet.has(name)).join(',') }
    ];
    exportGroups.forEach(name => rows.push({ Key: `group_color.${name}`, Value: state.categories.get(name)?.color || stableGroupColor(name) }));
    privateNeverTranslate.forEach((term, index) => rows.push({ Key: `never_translate.${index + 1}`, Value: term }));
    return [...rows, ...retained];
  }

  function jsonSheet(rows, fallbackHeaders) {
    const safeRows = rows.length ? rows : [Object.fromEntries(fallbackHeaders.map(header => [header, '']))];
    const sheet = XLSX.utils.json_to_sheet(safeRows, { header: fallbackHeaders });
    if (!rows.length && sheet['!ref']) XLSX.utils.sheet_add_aoa(sheet, [fallbackHeaders], { origin: 'A1' });
    return sheet;
  }

  async function exportTranslatedWorkbook() {
    if (!window.XLSX?.utils || !window.XLSX?.writeFile) {
      throw new Error('The workbook export library did not load. Check your internet connection and reload Chrona.');
    }
    if (!state.workbookRows.timeline.length) throw new Error('No timeline data is loaded.');

    const timelineRows = exportedTimelineRows();
    const configRows = exportedConfigRows();
    const workbook = XLSX.utils.book_new();
    const baseHeaders = [
      'Year', 'Month', 'Day', 'Time', 'End Year', 'End Month', 'End Day', 'End Time',
      'Display Date', 'Title', 'Description', 'Media', 'Media Credit', 'Media Caption',
      'Media Thumbnail', 'Group', 'Type', 'Importance', 'Color', 'Visible', 'Event ID'
    ];
    const translatedHeaders = state.availableLanguages
      .filter(language => language !== state.baselineLanguage)
      .flatMap(language => ['headline', 'text', 'mediaCaption'].map(field => translatedHeader(field, language)));
    const extraHeaders = [...new Set(timelineRows.flatMap(row => Object.keys(row)))]
      .filter(header => !baseHeaders.includes(header) && !translatedHeaders.includes(header));
    XLSX.utils.book_append_sheet(workbook, jsonSheet(timelineRows, [...baseHeaders, ...translatedHeaders, ...extraHeaders]), 'Timeline Data');
    XLSX.utils.book_append_sheet(workbook, jsonSheet(configRows, ['Key', 'Value']), 'Config');
    XLSX.writeFile(workbook, `chrona-export-${workbookDateStamp()}.xlsx`, { compression: true });
    return timelineRows.reduce((count, row) => count + Object.keys(row).filter(header => translatedColumnInfo(header) && row[header]).length, 0);
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
    // Timeline values contain a fractional month/day component. Rounding made
    // dates after midyear appear as the following year (for example Aug 9,
    // 1968 displayed as 1969). The integer year is always the floor value.
    const year = Math.floor(Number(value));
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year}`;
  }

  function normalizeHex(value, fallback = '#64748B') {
    return /^#[0-9A-F]{6}$/i.test(value || '') ? value : fallback;
  }

  function stableGroupColor(name) {
    const palette = ['#2563EB', '#DC2626', '#7C3AED', '#D97706', '#059669', '#DB2777', '#0891B2', '#4F46E5', '#EA580C', '#65A30D'];
    let hash = 0;
    for (const ch of String(name || '')) hash = ((hash << 5) - hash + ch.codePointAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  // The fallback timeline lives in sample-data.js so it can be reviewed and
  // edited independently from the application logic.
  const SAMPLE_DATA = window.CHRONA_SAMPLE_DATA || { categories: [], events: [] };
  const SAMPLE_CATEGORIES = SAMPLE_DATA.categories;
  const SAMPLE_EVENTS = SAMPLE_DATA.events;

  function sampleLayerDefault() {
    const stored = localStorage.getItem(INCLUDE_SAMPLE_STORAGE_KEY);
    if (stored != null) return stored === 'true';
    // Existing users with a saved private source are not surprised on upgrade.
    // Brand-new users start with the public sample enabled, and that choice
    // remains enabled when they add their first private Sheet.
    const enabled = !localStorage.getItem(DEFAULT_SHEET_STORAGE_KEY);
    localStorage.setItem(INCLUDE_SAMPLE_STORAGE_KEY, String(enabled));
    return enabled;
  }

  function sampleLayerEnabled() {
    return includeSampleTimelineInput ? includeSampleTimelineInput.checked : sampleLayerDefault();
  }

  function syncSampleLayerControl() {
    if (!includeSampleTimelineInput) return;
    const hasPrivateUrl = Boolean(String(sheetUrlInput?.value || '').trim());
    includeSampleTimelineInput.checked = hasPrivateUrl ? sampleLayerDefault() : true;
    includeSampleTimelineInput.disabled = !hasPrivateUrl;
  }

  function mergeTimelineRows(sampleRows, privateRows) {
    const result = [];
    const privateIds = new Set(privateRows.map(row => String(row['Event ID'] || '').trim()).filter(Boolean));
    sampleRows.forEach(row => {
      const id = String(row['Event ID'] || '').trim();
      if (!id || !privateIds.has(id)) result.push({ ...row, __chronaSource: 'sample' });
    });
    privateRows.forEach(row => result.push({ ...row, __chronaSource: 'private' }));
    return result;
  }

  function mergeConfigRows(sampleRows, privateRows) {
    const regular = new Map();
    const protectedValues = [];
    const add = (rows, privateWins) => rows.forEach(row => {
      const key = String(row.Key || row.Setting || '').trim();
      const value = String(row.Value ?? '').trim();
      if (!key) return;
      if (/^never_translate(?:\.|$)/i.test(key)) {
        if (value && !protectedValues.includes(value)) protectedValues.push(value);
        return;
      }
      if (privateWins || !regular.has(key)) regular.set(key, { Key: key, Value: value });
    });
    add(sampleRows, false);
    add(privateRows, true);
    protectedValues.forEach((value, index) => regular.set(`never_translate.${index + 1}`, { Key: `never_translate.${index + 1}`, Value: value }));
    return [...regular.values()];
  }

  function applyRows(rawEvents, rawCategories, sourceLabel, exportTimelineRows = rawEvents) {
    state.workbookRows.timeline = exportTimelineRows.map(row => ({ ...row }));
    state.categories.clear();
    const legacyGroups = new Map(rawCategories.map(row => [String(row.Group || row.Category || '').trim(), row]));
    const groupNamesFromRows = [...new Set(rawEvents.map(row => String(row.Group || row.Category || 'Uncategorized').trim()).filter(Boolean))];
    groupNamesFromRows.forEach(name => {
      const legacy = legacyGroups.get(name) || {};
      const configuredColor = state.groupColors.get(name);
      state.categories.set(name, {
        name,
        color: configuredColor || normalizeHex(legacy.Color, stableGroupColor(name)),
        visible: String(legacy['Default Visible']).toUpperCase() !== 'FALSE',
        position: state.configuredPrimaryGroups.includes(name) ? 'Above' : 'Below'
      });
    });

    loadInlineTranslations(rawEvents);
    state.events = rawEvents.map((row, index) => {
      const start = toTimelineTime(row.Year, row.Month, row.Day, row.Time);
      const end = toTimelineTime(row['End Year'], row['End Month'], row['End Day'], row['End Time']);
      const categoryName = (row.Group || row.Category || 'Uncategorized').trim();
      const category = state.categories.get(categoryName) || { color: '#64748B', position: 'Below', visible: true };
      return {
        id: row['Event ID'] || generateEventId(categoryName, row.Year, row.Title || row.Headline, index),
        sourceHeadline: row.Title || row.Headline || '(Untitled)',
        sourceText: row.Description || row.Text || '',
        sourceDisplayDate: row['Display Date'] || '',
        headline: row.Title || row.Headline || '(Untitled)',
        text: row.Description || row.Text || '',
        displayDate: row['Display Date'] || '',
        sourceYear: row.Year || '',
        sourceMonth: row.Month || '',
        sourceDay: row.Day || '',
        sourceEndYear: row['End Year'] || '',
        sourceEndMonth: row['End Month'] || '',
        sourceEndDay: row['End Day'] || '',
        start,
        end,
        category: categoryName,
        elementType: normalizeElementType(row.Type || row['Element Type'] || 'event'),
        position: category.position || 'Below',
        importance: row.Importance || 'Medium',
        color: state.groupColors.has(categoryName) ? category.color : normalizeHex(row.Color, category.color),
        visible: String(row.Visible).toUpperCase() !== 'FALSE' && start != null,
        media: normalizeMediaUrl(row.Media || row['Media URL'] || row.media || row.mediaUrl || ''),
        sourceMediaCaption: row['Media Caption'] || row.MediaCaption || row.mediaCaption || '',
        mediaCaption: row['Media Caption'] || row.MediaCaption || row.mediaCaption || '',
        categoryLabel: categoryName,
        mediaCredit: row['Media Credit'] || row.MediaCredit || row.mediaCredit || '',
        thumbnail: normalizeMediaUrl(row['Media Thumbnail'] || row.Thumbnail || row['Thumbnail URL'] || row.mediaThumbnail || row.thumbnail || ''),
        dataSource: row.__chronaSource || 'private'
      };
    }).filter(e => e.visible && e.elementType !== 'Title');

    if (!state.events.length) throw new Error('No visible timeline records were found.');
    applyLanguageToEvents();
    state.enabledCategories = new Set(
      [...new Set(state.events.map(e => e.category))].filter(name => state.categories.get(name)?.visible !== false)
    );
    const groupNames = categoryNames();
    const groupNameByKey = new Map(groupNames.map(name => [normalizeGroupKey(name), name]));
    const configuredAbove = state.configuredPrimaryGroups
      .map(name => groupNameByKey.get(normalizeGroupKey(name)))
      .filter(Boolean);
    if (configuredAbove.length) {
      state.aboveGroups = new Set(configuredAbove);
    } else {
      state.aboveGroups = new Set(
        [...state.aboveGroups]
          .map(name => groupNameByKey.get(normalizeGroupKey(name)))
          .filter(Boolean)
      );
    }
    buildFilters();
    buildAboveSetsMenu();
    state.overviewCategorySnapshot = new Set(state.enabledCategories);
    state.overviewBounds = null;
    const times = state.events.flatMap(e => [e.start, e.end]).filter(v => v != null);
    state.minTime = Math.min(...times);
    state.maxTime = Math.max(...times);
    resetView();
    renderAfterDataLoad();
    statusEl.textContent = t('status.records', { count: state.events.length, source: sourceLabel });
  }

  async function loadTimeline() {
    updateOnboardingNotice();
    statusEl.classList.remove('status-warning');
    statusEl.textContent = t('status.loading');
    const requestedUrl = sheetUrlInput.value.trim();
    syncSampleLayerControl();

    const sampleConfig = window.CHRONA_SAMPLE_DATA?.config || window.CHRONA_SAMPLE_DATA?.settings || [];
    if (!requestedUrl) {
      loadTranslations([]);
      loadConfig(sampleConfig, SAMPLE_EVENTS);
      if (!SAMPLE_EVENTS.length) throw new Error('Sample data is unavailable.');
      applyRows(SAMPLE_EVENTS.map(row => ({ ...row, __chronaSource: 'sample' })), SAMPLE_CATEGORIES, 'sample timeline', SAMPLE_EVENTS);
      setLanguage(state.language, false);
      statusEl.textContent = `${state.events.length} sample timeline records loaded — add a Google Sheet URL in Settings.`;
      return;
    }

    try {
      const source = parseSheetSource(requestedUrl);
      const eventPromise = (async () => {
        try { return await fetchCsvCompatible(source, 'Timeline Data', DEFAULT_EVENT_GID); }
        catch (_) { return await fetchCsvCompatible(source, 'TimelineJS Data', DEFAULT_EVENT_GID); }
      })();
      const optional = async (sheetName, gid, warning) => {
        try { return await fetchCsvCompatible(source, sheetName, gid); }
        catch (error) { console.warn(warning, error); return null; }
      };

      const [eventResult, configResult, legacyGroupsResult, legacyTranslationsResult, legacySettingsResult, legacyDictionaryResult] = await Promise.all([
        eventPromise,
        optional('Config', DEFAULT_CONFIG_GID, 'Config tab unavailable; Chrona will infer defaults.'),
        optional('Groups', DEFAULT_CATEGORY_GID, 'Legacy Groups tab unavailable.'),
        optional('Translations', DEFAULT_TRANSLATION_GID, 'Legacy Translations tab unavailable.'),
        optional('Dataset Settings', DEFAULT_CONFIG_GID, 'Legacy Dataset Settings tab unavailable.'),
        optional('Dictionary', DEFAULT_DICTIONARY_GID, 'Legacy Dictionary tab unavailable.')
      ]);

      const privateRows = rowsToObjects(parseCsv(eventResult.text));
      let privateConfig = configResult ? rowsToObjects(parseCsv(configResult.text)) : [];
      if (!privateConfig.length && legacySettingsResult) {
        privateConfig = rowsToObjects(parseCsv(legacySettingsResult.text)).map(row => ({ Key: row.Setting, Value: row.Value }));
      }
      if (legacyDictionaryResult) {
        const legacyTerms = rowsToObjects(parseCsv(legacyDictionaryResult.text));
        legacyTerms.forEach((row, index) => {
          const term = String(row.Term || row['Display As'] || '').trim();
          if (term) privateConfig.push({ Key: `never_translate.legacy${index + 1}`, Value: term });
        });
      }

      const includeSample = sampleLayerEnabled();
      const displayRows = includeSample ? mergeTimelineRows(SAMPLE_EVENTS, privateRows) : privateRows.map(row => ({ ...row, __chronaSource: 'private' }));
      const effectiveConfig = includeSample ? mergeConfigRows(sampleConfig, privateConfig) : privateConfig;
      loadConfig(effectiveConfig, displayRows);
      // Export remains private-only when a private workbook is loaded.
      state.workbookRows.config = privateConfig.map(row => ({ ...row }));
      state.privateTimelineRows = privateRows.map(row => ({ ...row }));
      loadTranslations(legacyTranslationsResult ? rowsToObjects(parseCsv(legacyTranslationsResult.text)) : []);
      const legacyGroups = legacyGroupsResult ? rowsToObjects(parseCsv(legacyGroupsResult.text)) : [];

      const sourceLabel = includeSample
        ? `private Google Sheet + bundled sample via ${eventResult.sourceLabel}`
        : `private Google Sheet via ${eventResult.sourceLabel}`;
      applyRows(displayRows, legacyGroups, sourceLabel, privateRows);
      setLanguage(state.language, false);
      statusEl.textContent = t('status.records', { count: state.events.length, source: sourceLabel });
      translateMissingEvents();
    } catch (error) {
      console.warn('Private sheet unavailable; using sample-data.js.', error);
      loadTranslations([]);
      loadConfig(sampleConfig, SAMPLE_EVENTS);
      if (!SAMPLE_EVENTS.length) throw error;
      applyRows(SAMPLE_EVENTS.map(row => ({ ...row, __chronaSource: 'sample' })), SAMPLE_CATEGORIES, 'sample timeline', SAMPLE_EVENTS);
      setLanguage(state.language, false);
      statusEl.classList.add('status-warning');
      statusEl.textContent = `Google Sheet could not be loaded; showing the bundled sample timeline instead. ${error.message}`;
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
    scheduleOverviewRefresh();
    if (state.listViewOpen) renderListView(true);
  }

  function scheduleOverviewRefresh() {
    if (state.overviewRefreshTimer) clearTimeout(state.overviewRefreshTimer);
    state.overviewRefreshTimer = setTimeout(() => {
      state.overviewRefreshTimer = null;
      state.overviewCategorySnapshot = new Set(state.enabledCategories);
      state.overviewBounds = calculateOverviewBounds(state.overviewCategorySnapshot);
      scheduleRender();
    }, 140);
  }

  function overviewEvents(categorySet = state.overviewCategorySnapshot) {
    const active = categorySet instanceof Set ? categorySet : state.enabledCategories;
    return state.events.filter(event =>
      event.elementType !== 'Title' && active.has(event.category)
    );
  }

  function calculateOverviewBounds(categorySet = state.overviewCategorySnapshot) {
    const events = overviewEvents(categorySet);
    const values = events.flatMap(event => [event.start, event.end]).filter(Number.isFinite);
    if (!values.length) {
      return state.overviewBounds || { min: state.minTime, max: Math.max(state.minTime + 0.0001, state.maxTime) };
    }
    let min = Math.min(...values);
    let max = Math.max(...values);
    const rawSpan = Math.max(0.0001, max - min);
    const padding = Math.max(0.25, rawSpan * 0.04);
    min -= padding;
    max += padding;
    return { min, max: Math.max(min + 0.0001, max) };
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
      const displayName = groupDisplayName(name);
      button.setAttribute('title', `${state.enabledCategories.has(name) ? t('actions.hide') : t('actions.show')} ${displayName}`);
      button.innerHTML = '<span class="category-quick-name"></span>';
      button.querySelector('.category-quick-name').textContent = displayName;
      button.addEventListener('click', () => updateCategorySelection(name, !state.enabledCategories.has(name)));
      quickFiltersEl.appendChild(button);
    });
  }

  function normalizeGroupKey(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function primaryGroupName(name) {
    const key = normalizeGroupKey(name);
    return [...state.aboveGroups].find(group => normalizeGroupKey(group) === key) || null;
  }

  function isPrimaryCategory(name) {
    return Boolean(primaryGroupName(name));
  }

  function updateAboveGroup(name, above) {
    const existing = primaryGroupName(name);
    if (existing) state.aboveGroups.delete(existing);
    if (above) state.aboveGroups.add(name);
    localStorage.setItem('chrona-above-groups', JSON.stringify([...state.aboveGroups]));
    buildAboveSetsMenu();
    scheduleRender();
  }

  function buildAboveSetsMenu() {
    if (!aboveSetsList) return;
    aboveSetsList.replaceChildren();
    const names = categoryNames();
    names.forEach(name => {
      const sourceSet = state.pendingAboveGroups || state.aboveGroups;
      const selected = [...sourceSet].some(group => normalizeGroupKey(group) === normalizeGroupKey(name));
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'above-set-option';
      node.setAttribute('role', 'menuitemcheckbox');
      node.setAttribute('aria-checked', String(selected));
      node.dataset.categoryName = `${name} ${groupDisplayName(name)}`.toLocaleLowerCase();
      node.innerHTML = '<span class="filter-name"></span><span class="above-set-check" aria-hidden="true">✓</span>';
      node.querySelector('.filter-name').textContent = groupDisplayName(name);
      node.querySelector('.above-set-check').hidden = !selected;
      node.addEventListener('click', () => {
        if (!state.pendingAboveGroups) state.pendingAboveGroups = new Set(state.aboveGroups);
        const existing = [...state.pendingAboveGroups].find(group => normalizeGroupKey(group) === normalizeGroupKey(name));
        if (existing) state.pendingAboveGroups.delete(existing);
        else state.pendingAboveGroups.add(name);
        buildAboveSetsMenu();
      });
      node.addEventListener('keydown', event => {
        const options = [...aboveSetsList.querySelectorAll('.above-set-option:not([hidden])')];
        const index = options.indexOf(node);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          options[(index + delta + options.length) % options.length]?.focus();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closeAboveSetsMenu();
          aboveSetsButton?.focus();
        }
      });
      aboveSetsList.appendChild(node);
    });
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = '12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    const longest = Math.max(...names.map(name => measure.measureText(groupDisplayName(name)).width), 72);
    // Enough for the longest label, the aligned check column, and compact padding.
    aboveSetsMenu.dataset.preferredWidth = String(Math.ceil(Math.min(176, Math.max(148, longest + 44))));
    const selected = names.filter(name => isPrimaryCategory(name));
    aboveSetsSummary.textContent = selected.length ? selected.map(groupDisplayName).join(', ') : t('groups.none');
    if (aboveSetsCount) aboveSetsCount.textContent = `${selected.length}/${names.length}`;
    filterAboveSetsMenu('');
  }

  function filterAboveSetsMenu(query) {
    const normalized = String(query || '').trim().toLocaleLowerCase();
    aboveSetsList?.querySelectorAll('.above-set-option').forEach(node => {
      node.hidden = Boolean(normalized) && !node.dataset.categoryName.includes(normalized);
    });
  }

  function closeAboveSetsMenu() {
    if (!aboveSetsMenu || aboveSetsMenu.hidden) return;
    aboveSetsMenu.hidden = true;
    aboveSetsButton?.setAttribute('aria-expanded', 'false');
    state.pendingAboveGroups = null;
  }


  function overviewDataBounds() {
    if (!state.overviewBounds) {
      state.overviewBounds = calculateOverviewBounds();
    }
    return state.overviewBounds;
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
    // Wheel events originating in the floating detail pane belong exclusively
    // to that pane. Do not zoom, pan, or vertically move the timeline behind it.
    if (detailPanel.contains(event.target)) return;

    if (isPhoneVerticalMode()) {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
      if (event.ctrlKey || event.metaKey) {
        zoomAt(ratio, Math.exp(event.deltaY * 0.006));
      } else {
        const span = state.viewEnd - state.viewStart;
        const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        const shift = span * delta / Math.max(1, rect.height);
        clampView(state.viewStart + shift, state.viewEnd + shift);
        scheduleRender();
      }
      return;
    }

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
        DESKTOP_AXIS_MIN_RATIO,
        Math.min(DESKTOP_AXIS_MAX_RATIO, state.axisYRatio - event.deltaY / Math.max(1, rect.height))
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
    if (isPhoneVerticalMode()) {
      const centerY = (a.y + b.y) / 2;
      state.pinchAnchorRatio = Math.min(1, Math.max(0, (centerY - rect.top) / Math.max(1, rect.height)));
    } else {
      const centerX = (a.x + b.x) / 2;
      state.pinchAnchorRatio = Math.min(1, Math.max(0, (centerX - rect.left) / Math.max(1, rect.width)));
    }
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
      const span = state.dragViewEnd - state.dragViewStart;
      if (isPhoneVerticalMode()) {
        const shift = -(dy / Math.max(1, rect.height)) * span;
        state.viewStart = state.dragViewStart + shift;
        state.viewEnd = state.dragViewEnd + shift;
      } else {
        const shift = -(dx / Math.max(1, rect.width)) * span;
        state.viewStart = state.dragViewStart + shift;
        state.viewEnd = state.dragViewEnd + shift;
        state.axisYRatio = Math.max(
          DESKTOP_AXIS_MIN_RATIO,
          Math.min(DESKTOP_AXIS_MAX_RATIO, state.dragAxisRatio + dy / Math.max(1, rect.height))
        );
      }
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

  function compactCjkLatinSpacing(value) {
    return String(value ?? '')
      .replace(/([\u3400-\u9FFF\uF900-\uFAFF])\s+([A-Za-z0-9])/g, '$1$2')
      .replace(/([A-Za-z0-9])\s+([\u3400-\u9FFF\uF900-\uFAFF])/g, '$1$2');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }


  function listVisibleEvents() {
    return state.events
      .filter(event => event.elementType !== 'Title' && state.enabledCategories.has(event.category))
      .sort((a, b) => a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start) || a.headline.localeCompare(b.headline));
  }

  function listAnchorEvent(events, focusTime) {
    const containingPeriods = events.filter(event => event.elementType === 'Period' && Number.isFinite(event.end) && event.start <= focusTime && event.end >= focusTime);
    if (containingPeriods.length) {
      return containingPeriods.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    }
    return events.reduce((best, event) => {
      const eventTime = Number.isFinite(event.end) && event.end > event.start ? (event.start + event.end) / 2 : event.start;
      const distance = Math.abs(eventTime - focusTime);
      if (!best || distance < best.distance) return { event, distance };
      return best;
    }, null)?.event || null;
  }

  function listDateMarkup(event) {
    const display = localizedDisplayDate(event) || event.displayDate || formatYear(event.start);
    const year = formatYear(event.start);
    const secondary = display === year ? '' : `<span>${escapeHtml(display)}</span>`;
    return `<strong>${escapeHtml(year)}</strong>${secondary}`;
  }

  function renderListView(reanchor = false) {
    if (!state.listViewOpen || !listViewItems) return;
    const events = listVisibleEvents();
    listViewSummary.textContent = `${events.length} event${events.length === 1 ? '' : 's'} · ${state.enabledCategories.size} visible group${state.enabledCategories.size === 1 ? '' : 's'}`;
    listViewItems.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const event of events) {
      const row = document.createElement('article');
      const searchClass = state.searchQuery.trim()
        ? (isActiveSearchResult(event) ? ' is-search-match' : (eventMatchesSearch(event) ? ' is-search-result' : ' is-search-dim'))
        : '';
      row.className = `list-view-row ${event.elementType === 'Period' ? 'is-period' : 'is-event'}${searchClass}`;
      row.dataset.eventId = event.id;
      row.style.setProperty('--event-color', event.color);
      row.innerHTML = `
        <div class="list-view-date">${listDateMarkup(event)}</div>
        <div class="list-view-rail" aria-hidden="true"><i></i></div>
        <button class="list-view-card" type="button">
          <span class="list-view-card-title">${escapeHtml(event.headline)}</span>
          ${event.categoryLabel || event.category ? `<small>${escapeHtml(event.categoryLabel || event.category)}</small>` : ''}
        </button>`;
      row.querySelector('.list-view-card').addEventListener('click', () => {
        const panelRect = listViewPanel.getBoundingClientRect();
        document.body.classList.add('list-view-detail-open');
        if (detailPanel && detailPanel.parentElement !== document.body) document.body.appendChild(detailPanel);
        openDetails(event, panelRect.left + panelRect.width / 2, panelRect.top + 28);
      });
      fragment.appendChild(row);
    }
    listViewItems.appendChild(fragment);
    if (reanchor || !state.listViewAnchorId || !events.some(event => event.id === state.listViewAnchorId)) {
      const focusTime = (state.viewStart + state.viewEnd) / 2;
      state.listViewAnchorId = listAnchorEvent(events, focusTime)?.id || null;
    }
    if (reanchor) scrollListViewToAnchor(true);
  }

  function scrollListViewToAnchor(pulse = false) {
    const anchorId = state.listViewAnchorId;
    if (!anchorId || !listViewScroller || !listViewItems) return;
    const position = () => {
      const anchor = listViewItems.querySelector(`[data-event-id="${CSS.escape(anchorId)}"]`);
      if (!anchor || !listViewScroller.clientHeight) return false;
      const top = anchor.offsetTop - (listViewScroller.clientHeight - anchor.offsetHeight) / 2;
      listViewScroller.scrollTop = Math.max(0, top);
      if (pulse) {
        anchor.classList.remove('is-anchor');
        void anchor.offsetWidth;
        anchor.classList.add('is-anchor');
        setTimeout(() => anchor.classList.remove('is-anchor'), 800);
      }
      return true;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!position()) setTimeout(position, 240);
      });
    });
  }

  function syncListViewSafeTop() {
    const toolbarBottom = toolbar?.getBoundingClientRect().bottom || appHeader?.getBoundingClientRect().bottom || 0;
    const safeTop = Math.max(8, Math.round(toolbarBottom + 8));
    document.documentElement.style.setProperty('--list-view-safe-top', `${safeTop}px`);
  }

  function openListView() {
    if (!listViewPanel || !listViewBackdrop) return;
    closeSettings();
    closeSearchControl();
    syncListViewSafeTop();
    state.listViewOpen = true;
    state.listViewAnchorId = null;
    listViewPanel.hidden = false;
    listViewBackdrop.hidden = false;
    document.body.classList.add('list-view-is-open');
    listViewToggle?.setAttribute('aria-expanded', 'true');
    listViewToggle?.classList.add('is-active');
    renderListView(true);
    requestAnimationFrame(() => {
      listViewPanel.classList.add('is-open');
      scrollListViewToAnchor(true);
    });
  }

  function closeListView() {
    if (!state.listViewOpen) return;
    state.listViewOpen = false;
    if (document.body.classList.contains('list-view-detail-open')) closeDetails();
    document.body.classList.remove('list-view-detail-open');
    listViewPanel?.classList.remove('is-open');
    listViewToggle?.setAttribute('aria-expanded', 'false');
    listViewToggle?.classList.remove('is-active');
    document.body.classList.remove('list-view-is-open');
    setTimeout(() => {
      if (state.listViewOpen) return;
      if (listViewPanel) listViewPanel.hidden = true;
      if (listViewBackdrop) listViewBackdrop.hidden = true;
    }, 220);
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  // Data loading can finish while the responsive shell is still recalculating
  // its height (especially when the sample layer adds group chips). The radar
  // has its own fixed track and can render while the main viewport is still at
  // zero height. Retry the main render after layout settles so the canvas and
  // label layer never remain blank after a successful load.
  function renderAfterDataLoad(attempt = 0) {
    requestAnimationFrame(() => {
      const rect = viewport.getBoundingClientRect();
      if ((!rect.width || !rect.height) && attempt < 4) {
        setTimeout(() => renderAfterDataLoad(attempt + 1), 40 * (attempt + 1));
        return;
      }
      state.renderQueued = false;
      render();
      // One additional frame catches late toolbar wrapping and font layout.
      if (attempt === 0) requestAnimationFrame(() => render());
    });
  }


  function isPhoneVerticalMode() {
    return document.documentElement.dataset.previewSize === 'phone' ||
      window.matchMedia('(max-width: 699px) and (orientation: portrait)').matches;
  }

  function resetRendererMode() {
    const mobile = isPhoneVerticalMode();
    viewport.classList.toggle('is-phone-vertical', mobile);
    if (!mobile) {
      viewport.style.removeProperty('--mobile-content-height');
      labelLayer.style.height = '';
      canvas.style.height = '';
      leaderCanvas.style.height = '';
      state.mobileEventPositions = [];
      state.cursorY = null;
    }
  }

  function mobileShortDate(event) {
    const startYear = Number(event.sourceYear);
    const startMonth = Number(event.sourceMonth);
    const startDay = Number(event.sourceDay);
    const endYear = Number(event.sourceEndYear);
    const endMonth = Number(event.sourceEndMonth);
    const endDay = Number(event.sourceEndDay);

    const formatParts = (year, month, day) => {
      if (!Number.isFinite(year)) return '';
      if (year < 0) return `${Math.abs(year)} BCE`;
      if (Number.isFinite(month) && month > 0) {
        return Number.isFinite(day) && day > 0 ? `${month}/${day}/${year}` : `${month}/${year}`;
      }
      return `${year}`;
    };

    const start = formatParts(startYear, startMonth, startDay);
    const end = formatParts(endYear, endMonth, endDay);
    if (start && end) return `${start}–${end}`;
    return start || event.displayDate || formatYear(event.start);
  }

  function mobileCardMarkup(event, isPrimary, isPeriod) {
    const date = mobileShortDate(event);
    const classNames = [
      'event-label',
      'mobile-timeline-card',
      isPrimary ? 'mobile-primary-card' : 'mobile-secondary-card',
      isPeriod ? 'mobile-period-card' : ''
    ].filter(Boolean).join(' ');
    const roleLabel = isPrimary ? t('details.aboveSet') : t('details.referenceSet');
    return {
      classNames,
      html: `<span class="event-label-text">${escapeHtml(event.headline)}</span><span class="mobile-card-meta"><span class="mobile-card-date">${escapeHtml(date)}</span> <span class="mobile-card-group">${escapeHtml(event.categoryLabel || event.category)} · ${escapeHtml(roleLabel)}</span></span>`
    };
  }

  function renderPhoneVertical(rect) {
    const width = rect.width;
    const height = rect.height;
    const topPad = 28;
    const bottomPad = 30;
    const axisX = 42;
    const usableHeight = Math.max(1, height - topPad - bottomPad);
    const span = Math.max(MIN_VISIBLE_YEARS, state.viewEnd - state.viewStart);
    const yearToY = value => topPad + ((value - state.viewStart) / span) * usableHeight;

    state.dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * state.dpr);
    canvas.height = Math.round(height * state.dpr);
    leaderCanvas.width = Math.round(width * state.dpr);
    leaderCanvas.height = Math.round(height * state.dpr);
    canvas.style.height = '';
    leaderCanvas.style.height = '';
    labelLayer.style.height = '';
    viewport.style.removeProperty('--mobile-content-height');

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    leaderCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    leaderCtx.clearRect(0, 0, width, height);
    labelLayer.replaceChildren();
    state.hitTargets = [];
    state.eventYearZones = [];
    state.eventLabelZones = [];
    state.mobileEventPositions = [];

    drawBackground(width, height);

    // Vertical time axis.
    ctx.save();
    ctx.strokeStyle = cssVar('--axis', '#30363d');
    ctx.lineWidth = document.documentElement.dataset.theme === 'dark' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(axisX + .5, 0);
    ctx.lineTo(axisX + .5, height);
    ctx.stroke();
    ctx.restore();

    // Scale-aware year/decade ticks.
    const targetTicks = Math.max(4, Math.floor(height / 72));
    const rawStep = span / targetTicks;
    const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    const tickStep = candidates.find(step => step >= rawStep) || candidates[candidates.length - 1];
    const firstTick = Math.ceil(state.viewStart / tickStep) * tickStep;

    ctx.save();
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.textBaseline = 'middle';
    for (let year = firstTick; year <= state.viewEnd + tickStep * .25; year += tickStep) {
      const y = yearToY(year);
      if (y < -2 || y > height + 2) continue;
      ctx.strokeStyle = cssVar('--tick', 'rgba(100,116,139,.55)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisX - 4, Math.round(y) + .5);
      ctx.lineTo(axisX + 5, Math.round(y) + .5);
      ctx.stroke();
      ctx.fillStyle = cssVar('--text-muted', '#667085');
      ctx.textAlign = 'right';
      ctx.fillText(formatYear(year), axisX - 7, y);
    }
    ctx.restore();

    const visible = state.events
      .filter(event =>
        state.enabledCategories.has(event.category) &&
        event.elementType !== 'Title' &&
        event.end >= state.viewStart &&
        event.start <= state.viewEnd
      )
      .sort((a, b) => a.start - b.start || (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0));

    const visiblePeriods = visible.filter(event =>
      event.elementType === 'Period' && Number.isFinite(event.end)
    );
    const periodLanes = [];
    const periodLaneById = new Map();
    for (const event of visiblePeriods) {
      let lane = 0;
      while (
        lane < periodLanes.length &&
        event.start <= periodLanes[lane] + 0.0001
      ) lane++;
      if (lane === periodLanes.length) periodLanes.push(-Infinity);
      periodLanes[lane] = event.end;
      periodLaneById.set(event.id, lane);
    }
    const periodRailWidth = 20;
    const periodRailGap = 4;
    const periodRailStartX = axisX + 19;
    const periodRailSpan = visiblePeriods.length
      ? Math.min(74, periodLanes.length * (periodRailWidth + periodRailGap))
      : 0;

    const durationEvents = visible.filter(event =>
      event.elementType !== 'Period' &&
      Number.isFinite(event.end) &&
      event.end > event.start + 0.0001
    );
    const durationLaneById = new Map();
    const durationLaneEnds = [];
    for (const event of durationEvents) {
      let lane = 0;
      while (
        lane < durationLaneEnds.length &&
        event.start <= durationLaneEnds[lane] + 0.0001
      ) lane++;
      if (lane === durationLaneEnds.length) durationLaneEnds.push(-Infinity);
      durationLaneEnds[lane] = event.end;
      durationLaneById.set(event.id, lane);
    }
    const durationRailWidth = 3;
    const durationRailGap = 2;
    const phoneAxisHalfThickness =
      (document.documentElement.dataset.theme === 'dark' ? 3 : 2) / 2;
    const canvasAntialiasClearance = 0.5;
    const durationRailStartX =
      axisX + 0.5 +
      phoneAxisHalfThickness +
      durationRailWidth / 2 +
      canvasAntialiasClearance;

    // Greedy horizontal collision lanes. Events with the same date keep the same
    // vertical coordinate and are moved into adjacent columns rather than spaced
    // artificially in time.
    const laneBottoms = [];
    const rows = [];
    const cardHeight = 30;
    const cardGapY = 4;

    for (const event of visible) {
      const y = yearToY(event.start);
      const top = y - cardHeight / 2;
      let lane = 0;
      while (lane < laneBottoms.length && top < laneBottoms[lane] + cardGapY) lane++;
      if (lane === laneBottoms.length) laneBottoms.push(-Infinity);
      laneBottoms[lane] = top + cardHeight;
      rows.push({
        event,
        lane,
        y,
        top,
        isPrimary: isPrimaryCategory(event.category),
        isPeriod: event.elementType === 'Period'
      });
    }

    const laneStep = 24;

    for (const row of rows) {
      const { event, lane, y, top, isPrimary, isPeriod } = row;
      const eventBaseX = Math.max(50, periodRailStartX + periodRailSpan + 8);
      const cardLeft = (isPrimary ? eventBaseX : eventBaseX + 14) + lane * laneStep;
      const cardWidth = Math.max(118, width - cardLeft - 8);
      const markerRadius = isPrimary ? 5 : 4;

      state.mobileEventPositions.push({ event, y });

      ctx.save();
      const phoneSearchActive = Boolean(state.searchQuery.trim());
      ctx.globalAlpha = phoneSearchActive && !isActiveSearchResult(event) ? 0.22 : 1;
      ctx.strokeStyle = event.color;
      ctx.fillStyle = event.color;

      if (isPeriod) {
        // Preserve the true off-screen endpoints. The rail path uses these
        // unclamped coordinates to decide whether its top or bottom is open.
        const periodStartY = yearToY(event.start);
        const periodEndY = yearToY(event.end);
        const periodLane = periodLaneById.get(event.id) || 0;
        const railX = periodRailStartX + periodLane * (periodRailWidth + periodRailGap);
        const rawRailTop = Math.min(periodStartY, periodEndY);
        const rawRailBottom = Math.max(periodStartY, periodEndY);
        const railTop = Math.max(0, rawRailTop);
        const railBottom = Math.min(height, rawRailBottom);
        const railHeight = Math.max(18, railBottom - railTop);
        const selected = state.selectedPhonePeriodId === event.id;
        ctx.restore();

        const rail = document.createElement('button');
        rail.type = 'button';
        // Boundary shape follows the geometry actually clipped by the phone
        // viewport. A period is open only when its real endpoint lies beyond
        // the visible screen; an endpoint exactly on-screen remains closed.
        const continuesBefore = rawRailTop < -0.5;
        const continuesAfter = rawRailBottom > height + 0.5;
        rail.className = [
          'event-label',
          'mobile-period-rail',
          selected ? 'is-selected' : '',
          continuesBefore ? 'continues-before' : '',
          continuesAfter ? 'continues-after' : '',
          state.searchQuery.trim()
            ? (isActiveSearchResult(event) ? 'is-search-match' : 'is-search-dim')
            : ''
        ].filter(Boolean).join(' ');
        rail.dataset.eventId = event.id;
        rail.style.left = `${railX - periodRailWidth / 2}px`;
        rail.style.top = `${railTop}px`;
        rail.style.width = `${selected ? 48 : periodRailWidth}px`;
        rail.style.height = `${railHeight}px`;
        rail.style.setProperty('--event-color', event.color);
        const visiblePeriodTitle = railHeight < 24 ? '…' : event.headline;
        const svgGradientId = `mobile-period-gradient-${String(event.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        // A rail is open only where the actual period continues outside the
        // viewport. When its real start/end year is visible, draw that cap.
        let framePath;
        let interiorPath;
        if (continuesBefore && continuesAfter) {
          // Period crosses the entire viewport: two open-ended side strokes.
          framePath = 'M 1.5 0 V 100 M 98.5 0 V 100';
          interiorPath = 'M 1.5 0 H 98.5 V 100 H 1.5 Z';
        } else if (continuesBefore) {
          // Start is above the viewport; keep the top open and close the end.
          framePath = 'M 1.5 0 V 92 Q 1.5 98.5 8 98.5 H 92 Q 98.5 98.5 98.5 92 V 0';
          interiorPath = 'M 1.5 0 H 98.5 V 92 Q 98.5 98.5 92 98.5 H 8 Q 1.5 98.5 1.5 92 Z';
        } else if (continuesAfter) {
          // The actual start year is visible. Close it with a flat top edge;
          // the period still continues beyond the bottom of the viewport.
          framePath = 'M 1.5 100 V 1.5 H 98.5 V 100';
          interiorPath = 'M 1.5 1.5 H 98.5 V 100 H 1.5 Z';
        } else {
          // Both actual boundaries are visible. Use a flat top and a rounded
          // bottom: the start is precise, while the end reads as a terminal cap.
          framePath = 'M 1.5 92 V 1.5 H 98.5 V 92 Q 98.5 98.5 92 98.5 H 8 Q 1.5 98.5 1.5 92';
          interiorPath = 'M 1.5 1.5 H 98.5 V 92 Q 98.5 98.5 92 98.5 H 8 Q 1.5 98.5 1.5 92 Z';
        }
        rail.innerHTML = `
          <svg class="mobile-period-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="${svgGradientId}" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#168cff"></stop>
                <stop offset="48%" stop-color="#6f63ff"></stop>
                <stop offset="100%" stop-color="#ff3d9a"></stop>
              </linearGradient>
            </defs>
            <path class="mobile-period-frame-path" d="${framePath}" stroke="url(#${svgGradientId})"></path>
          </svg>
          <span class="event-label-text mobile-period-text" title="${escapeAttribute(event.headline)}">${escapeHtml(visiblePeriodTitle)}</span>`;
        rail.addEventListener('click', clickEvent => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();

          if (state.selectedPhonePeriodId !== event.id) {
            state.selectedPhonePeriodId = event.id;
            scheduleRender();
            return;
          }

          const viewportRect = viewport.getBoundingClientRect();
          openDetails(
            event,
            viewportRect.left + Math.min(width - 16, railX + 52),
            viewportRect.top + Math.max(14, Math.min(height - 14, railTop + 18))
          );
        });
        labelLayer.appendChild(rail);

        state.hitTargets.push({
          event,
          x1: railX - periodRailWidth / 2,
          x2: railX + (selected ? 48 : periodRailWidth),
          y1: railTop,
          y2: railTop + railHeight
        });
        continue;
      }

      if (Number.isFinite(event.end) && event.end > event.start + 0.0001) {
        const durationLane = durationLaneById.get(event.id) || 0;
        const spanX = durationRailStartX + durationLane * (durationRailWidth + durationRailGap);
        const spanStartY = yearToY(Math.max(event.start, state.viewStart));
        const spanEndY = yearToY(Math.min(event.end, state.viewEnd));
        ctx.save();
        ctx.strokeStyle = event.color;
        ctx.lineWidth = durationRailWidth;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(spanX, spanStartY);
        ctx.lineTo(spanX, spanEndY);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(axisX, y, markerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(axisX + markerRadius, y);
      ctx.lineTo(cardLeft, y);
      ctx.stroke();
      ctx.restore();

      const card = document.createElement('button');
      card.type = 'button';
      card.className = [
        'event-label',
        'mobile-scale-card',
        isPrimary ? 'mobile-scale-primary' : 'mobile-scale-reference',
        state.searchQuery.trim()
          ? (isActiveSearchResult(event) ? 'is-search-match' : 'is-search-dim')
          : ''
      ].filter(Boolean).join(' ');
      card.dataset.eventId = event.id;
      card.style.left = `${cardLeft}px`;
      card.style.top = `${top}px`;
      card.style.width = `${cardWidth}px`;
      card.style.height = `${cardHeight}px`;
      card.style.setProperty('--event-color', event.color);
      card.innerHTML = `<span class="event-label-text">${escapeHtml(event.headline)}</span>`;
      card.addEventListener('click', clickEvent => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        const viewportRect = viewport.getBoundingClientRect();
        openDetails(
          event,
          viewportRect.left + Math.min(width - 16, cardLeft + cardWidth * .65),
          viewportRect.top + Math.max(14, Math.min(height - 14, y))
        );
      });
      labelLayer.appendChild(card);

      state.hitTargets.push({
        event,
        x1: cardLeft,
        x2: cardLeft + cardWidth,
        y1: top,
        y2: top + cardHeight
      });
    }

    drawMobileYearCursor(width, height);
    overviewNavigator.hidden = false;
    drawOverview();
    updateLaneLegends();
    syncZoomDial();
    if (state.listViewOpen) { syncListViewSafeTop(); renderListView(false); }
  }

  function drawMobileYearCursor(width, height) {
    if (state.cursorY == null) return;
    const y = Math.max(0, Math.min(height, state.cursorY));
    ctx.save();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + .5);
    ctx.lineTo(width, Math.round(y) + .5);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    resetRendererMode();
    clampView();
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (isPhoneVerticalMode()) {
      renderPhoneVertical(rect);
      return;
    }
    overviewNavigator.hidden = false;
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
    if (isPhoneVerticalMode()) {
      const rect = viewport.getBoundingClientRect();
      const topPad = 28;
      const bottomPad = 30;
      const usableHeight = Math.max(1, rect.height - topPad - bottomPad);
      state.cursorY = Math.max(topPad, Math.min(rect.height - bottomPad, event.clientY - rect.top));
      const ratio = (state.cursorY - topPad) / usableHeight;
      state.cursorYear = state.viewStart + ratio * (state.viewEnd - state.viewStart);
      yearCursor.style.top = `${state.cursorY}px`;
      yearCursor.style.left = '0px';
      yearCursorLabel.textContent = formatCursorYear(state.cursorYear);
      yearCursorRelative.textContent = formatRelativeYears(state.cursorYear);
      yearCursor.hidden = false;
      scheduleRender();
      return;
    }
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

    // Phone mode positions the horizontal cursor with an inline `top` value.
    // Clear that mode-specific geometry before drawing the desktop vertical
    // ruler, otherwise its top endpoint—and therefore both labels—can remain
    // stranded in the middle of the canvas after a mode/preview switch.
    yearCursor.style.top = '0px';
    yearCursor.style.bottom = '0px';
    yearCursor.style.right = 'auto';
    yearCursor.style.height = 'auto';
    yearCursor.style.width = '0px';
    yearCursor.style.left = `${x}px`;
    yearCursorLabel.textContent = formatCursorYear(year);
    yearCursorRelative.textContent = formatRelativeYears(year);
    yearCursor.hidden = false;
    scheduleRender();
  }

  function formatCursorYear(value) {
    const span = state.viewEnd - state.viewStart;
    if (span < 1) return formatFineDate(value, span < .08 ? 1 / 365.2425 : 1 / 12);
    return formatYear(Math.round(value));
  }

  function formatRelativeYears(value) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const nextYear = new Date(now.getFullYear() + 1, 0, 1);
    const yearProgress = (now - startOfYear) / Math.max(1, nextYear - startOfYear);
    const currentYear = now.getFullYear() + yearProgress;
    const delta = currentYear - Number(value);
    if (!Number.isFinite(delta) || Math.abs(delta) < 1) {
      return state.language === 'zh-TW' ? '今年' : 'this year';
    }
    const years = Math.max(1, Math.floor(Math.abs(delta)));
    if (state.language === 'zh-TW') {
      return delta >= 0 ? `${years} 年前` : `${years} 年後`;
    }
    return delta >= 0
      ? `${years} year${years === 1 ? '' : 's'} ago`
      : `in ${years} year${years === 1 ? '' : 's'}`;
  }

  function drawBackground(width, height) {
    const top = cssVar('--parchment-top', '#fffaf0');
    const middle = cssVar('--parchment-mid', '#f6ecd8');
    const bottom = cssVar('--parchment-bottom', '#eadbc0');
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.5, middle);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // A broad highlight preserves the dimensional gradient while keeping the
    // canvas recognizably parchment rather than flat beige.
    const glow = ctx.createRadialGradient(width * .5, 0, 0, width * .5, 0, Math.max(width, height));
    glow.addColorStop(0, 'rgba(255,255,255,.34)');
    glow.addColorStop(.55, 'rgba(255,255,255,.05)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
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
      event.categoryLabel || event.category,
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

  function isActiveSearchResult(event) {
    if (!state.searchQuery.trim() || !state.searchMatches.length) return false;
    const active = state.searchMatches[state.searchMatchIndex];
    return Boolean(active && active.id === event.id);
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
    const above = visible.filter(e => isPrimaryCategory(e.category));
    const below = visible.filter(e => !isPrimaryCategory(e.category));
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
    return isPrimaryCategory(event.category) ? 'Above' : 'Below';
  }

  function measureEventLabelWidth(text, isMajor, hasThumbnail) {
    const probe = document.createElement('span');
    probe.className = 'event-label-measure-probe';
    probe.style.fontWeight = isMajor ? '650' : '520';
    probe.textContent = text || '';
    document.body.appendChild(probe);
    const width = Math.ceil(probe.getBoundingClientRect().width + 20 + (hasThumbnail ? 33 : 0));
    probe.remove();
    return width;
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
      const timelinePreview = event.thumbnail || (looksLikeImage(event.media) ? event.media : '');
      const measuredLabelWidth = measureEventLabelWidth(
        event.headline,
        event.importance === 'Major',
        Boolean(timelinePreview)
      );
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
      const axisHalfThickness = 2;
      const spanHalfThickness = 1.5;
      const spanOffset = hasRange
        ? axisHalfThickness + spanHalfThickness + microLane * 4
        : 0;
      const spanY = hasRange
        ? axisY + (isAbove ? -spanOffset : spanOffset)
        : axisY;

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
      const isSearchMatch = isActiveSearchResult(event);
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
        requestAnimationFrame(() => {
          const clipped = labelText.scrollWidth > labelText.clientWidth + 1;
          labelText.classList.toggle('is-clipped', clipped);
        });
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
      const visualTheme = document.documentElement.dataset.visualTheme || 'gradient';
      const flatVisualTheme = visualTheme === 'flat';
      const aiVisualTheme = visualTheme === 'ai';
      const metroVisualTheme = visualTheme === 'metro';
      if (metroVisualTheme) {
        const visibleLeft = Math.max(0, left);
        const visibleRight = Math.min(width, right);
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        if (visibleWidth <= 0) {
          ctx.restore();
          continue;
        }

        const lineY = y + barHeight - 5;
        const actualStartVisible = left >= 0 && left <= width;
        const actualEndVisible = right >= 0 && right <= width;

        // Duration line.
        ctx.strokeStyle = periodFill;
        ctx.lineWidth = 3;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(visibleLeft, lineY);
        ctx.lineTo(visibleRight, lineY);
        ctx.stroke();

        // Start accent uses the same 4px vertical-bar language as Metro events.
        if (actualStartVisible) {
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(left, y + 5);
          ctx.lineTo(left, lineY);
          ctx.stroke();
        }

        // Small end cap only when the true end is visible.
        if (actualEndVisible) {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(right, lineY - 7);
          ctx.lineTo(right, lineY + 1);
          ctx.stroke();
        }

        state.hitTargets.push({
          event,
          x1: visibleLeft,
          x2: visibleRight,
          y1: y,
          y2: y + barHeight
        });

        if ((importanceRank[event.importance] || 2) >= threshold) {
          const fullText = `${event.headline}${event.displayDate ? ` ${event.displayDate}` : ''}`;
          const textPadding = 8;
          const availableWidth = Math.max(0, visibleWidth - textPadding * 2);

          ctx.font = '650 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = periodFill;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          let renderedText = fullText;
          const fullWidth = ctx.measureText(fullText).width;
          const tiny = visibleWidth < 22;
          const truncated = tiny || fullWidth > availableWidth;

          if (tiny) {
            renderedText = '…';
          } else if (truncated) {
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

          const textX = tiny
            ? visibleLeft + visibleWidth / 2
            : truncated
              ? visibleLeft + textPadding
              : visibleLeft + visibleWidth / 2;

          ctx.textAlign = tiny ? 'center' : truncated ? 'left' : 'center';
          ctx.fillText(renderedText, textX, y + 10);

          state.eventLabelZones.push({
            x1: visibleLeft,
            x2: visibleRight,
            y1: y,
            y2: y + barHeight,
            ownerId: event.id
          });
        }

        ctx.restore();
        continue;
      }

      if (flatVisualTheme) {
        ctx.fillStyle = document.documentElement.dataset.theme === 'dark'
          ? cssVar('--surface-solid', '#1f242c')
          : mixHex(periodFill, '#ffffff', 0.18);
        ctx.strokeStyle = mixHex(periodFill, document.documentElement.dataset.theme === 'dark' ? '#ffffff' : '#08111f', 0.74);
        ctx.lineWidth = 1.5;
      } else if (aiVisualTheme) {
        ctx.fillStyle = document.documentElement.dataset.theme === 'dark'
          ? cssVar('--surface-solid', '#1f242c')
          : '#ffffff';
        const aiBorder = ctx.createLinearGradient(left, 0, right, 0);
        aiBorder.addColorStop(0, '#168cff');
        aiBorder.addColorStop(1, '#ff3d9a');
        ctx.strokeStyle = aiBorder;
        ctx.lineWidth = 2;
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
      if (flatVisualTheme || aiVisualTheme) ctx.stroke();
      state.hitTargets.push({ event, x1: Math.max(0, left), x2: Math.min(width, right), y1: y, y2: y + barHeight });
      ctx.restore();

      if ((importanceRank[event.importance] || 2) >= threshold && right - left > 48) {
        const visibleLeft = Math.max(0, left);
        const visibleRight = Math.min(width, right);
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        if (visibleWidth <= 0) continue;

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
          : aiVisualTheme
            ? periodFill
            : '#ffffff';
        ctx.shadowColor = (flatVisualTheme || aiVisualTheme) ? 'transparent' : 'rgba(0,0,0,.28)';
        ctx.shadowBlur = (flatVisualTheme || aiVisualTheme) ? 0 : 1;
        ctx.shadowOffsetY = (flatVisualTheme || aiVisualTheme) ? 0 : 1;

        let renderedText = fullText;
        const fullTextWidth = ctx.measureText(fullText).width;
        const tinyBar = visibleWidth < 24;
        const isTruncated = tinyBar || fullTextWidth > availableWidth;

        if (tinyBar) {
          renderedText = '…';
        } else if (isTruncated) {
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

        // Complete titles are centered in the currently visible portion of a
        // long bar. Truncated titles begin at the visible edge, while tiny bars
        // always show a centered ellipsis indicator rather than appearing empty.
        const textX = tinyBar
          ? visibleLeft + visibleWidth / 2
          : isTruncated
            ? visibleLeft + horizontalPadding
            : visibleLeft + visibleWidth / 2;
        ctx.textAlign = tinyBar ? 'center' : isTruncated ? 'left' : 'center';
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
    const y = clientY - rect.top + (isPhoneVerticalMode() ? viewport.scrollTop : 0);
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

  function translationRecord(entityId, field) {
    if (state.language === state.baselineLanguage) return null;
    return state.translations.get(translationMapKey(entityId, state.language, field)) || null;
  }

  function translationStatusIsMachine(status) {
    return !['approved', 'human', 'manual', 'verified'].includes(String(status || 'machine').toLowerCase());
  }

  function fieldUsesMachineTranslation(event, field, sourceField) {
    if (state.language === state.baselineLanguage) return false;
    const sourceText = String(event[sourceField] || '').trim();
    const displayedText = String(event[field] || '').trim();
    if (!sourceText || !displayedText || displayedText === sourceText) return false;
    const record = translationRecord(event.id, field);
    return record ? translationStatusIsMachine(record.status) : true;
  }

  function groupUsesMachineTranslation(event) {
    if (state.language === state.baselineLanguage) return false;
    const sourceText = String(event.category || '').trim();
    const displayedText = String(event.categoryLabel || '').trim();
    if (!sourceText || !displayedText || sourceText === displayedText) return false;
    const record = translationRecord(`GROUP:${event.category}`, 'name');
    return record ? translationStatusIsMachine(record.status) : true;
  }

  function detailUsesMachineTranslation(event) {
    const translatedFieldsDiffer = [
      ['headline', 'sourceHeadline'],
      ['text', 'sourceText'],
      ['mediaCaption', 'sourceMediaCaption']
    ].some(([field, sourceField]) => {
      const source = String(event[sourceField] || '').trim();
      const shown = String(event[field] || '').trim();
      return source && shown && source !== shown;
    });

    return translatedFieldsDiffer ||
      fieldUsesMachineTranslation(event, 'headline', 'sourceHeadline') ||
      fieldUsesMachineTranslation(event, 'text', 'sourceText') ||
      fieldUsesMachineTranslation(event, 'mediaCaption', 'sourceMediaCaption') ||
      groupUsesMachineTranslation(event);
  }

  function mediaSourceLabel(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    try {
      const host = new URL(value, window.location.href).hostname
        .replace(/^www\./, '');
      if (host === 'upload.wikimedia.org' || host.endsWith('.wikimedia.org')) {
        return 'Wikimedia Commons';
      }
      return host || value;
    } catch (_) {
      return value;
    }
  }

  function detailDisplayValues(event, showOriginal) {
    if (!showOriginal) {
      return {
        headline: compactCjkLatinSpacing(sanitizeTranslationArtifacts(event.headline)),
        text: compactCjkLatinSpacing(sanitizeTranslationArtifacts(event.text)),
        mediaCaption: compactCjkLatinSpacing(sanitizeTranslationArtifacts(event.mediaCaption)),
        category: compactCjkLatinSpacing(event.categoryLabel || event.category),
        displayDate: compactCjkLatinSpacing(event.displayDate || formatYear(event.start))
      };
    }
    return {
      headline: compactCjkLatinSpacing(event.sourceHeadline || event.headline),
      text: compactCjkLatinSpacing(event.sourceText || ''),
      mediaCaption: compactCjkLatinSpacing(event.sourceMediaCaption || ''),
      category: compactCjkLatinSpacing(event.category),
      displayDate: compactCjkLatinSpacing(event.sourceDisplayDate || formatYear(event.start))
    };
  }

  function detailDateText(event, showOriginal) {
    const explicit = showOriginal
      ? event.sourceDisplayDate
      : event.displayDate;
    if (explicit) return compactCjkLatinSpacing(explicit);

    const localized = showOriginal
      ? ''
      : localizedDisplayDate(event);
    if (localized) return compactCjkLatinSpacing(localized);

    const startText = formatYear(event.start);
    if (!Number.isFinite(event.end) || event.end <= event.start + 0.0001) return startText;
    return compactCjkLatinSpacing(`${startText}–${formatYear(event.end)}`);
  }

  function detailDurationText(event) {
    if (!Number.isFinite(event.start) || !Number.isFinite(event.end) || event.end <= event.start + 0.0001) {
      return '';
    }

    const totalMonths = Math.max(1, Math.round((event.end - event.start) * 12));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    if (state.language === 'zh-TW') {
      const parts = [];
      if (years) parts.push(`${years}年`);
      if (months) parts.push(`${months}個月`);
      return parts.join('');
    }

    const parts = [];
    if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
    if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    return parts.join(' ');
  }

  function detailTypeText(event) {
    return event.elementType === 'Period'
      ? t('details.period')
      : t('details.event');
  }

  function detailFinePrintItems(event, values, hasMachineTranslation, showOriginal) {
    const items = [];

    if (values.mediaCaption) {
      items.push(values.mediaCaption);
    }

    if (event.mediaCredit) {
      items.push(`${t('details.source')}: ${event.mediaCredit}`);
    }

    if (event.media) {
      items.push(`${t('details.mediaSource')}: ${event.media}`);
    }

    if (hasMachineTranslation) {
      items.push(t('details.machineTranslationDisclosure'));
    }

    return items.map(item => compactCjkLatinSpacing(item));
  }

  function detailHasAlternateLanguage(event) {
    const sourceHeadline = String(event.sourceHeadline || '').trim();
    const sourceText = String(event.sourceText || '').trim();
    const sourceCaption = String(event.sourceMediaCaption || '').trim();

    const shownHeadline = String(event.headline || '').trim();
    const shownText = String(event.text || '').trim();
    const shownCaption = String(event.mediaCaption || '').trim();

    return Boolean(
      (sourceHeadline && sourceHeadline !== shownHeadline) ||
      (sourceText && sourceText !== shownText) ||
      (sourceCaption && sourceCaption !== shownCaption)
    );
  }

  function detailMarkup(event) {
    const showOriginal = Boolean(state.detailShowOriginal);
    const values = detailDisplayValues(event, showOriginal);
    const hasTranslatedText = detailUsesMachineTranslation(event);
    const hasAlternateLanguage = detailHasAlternateLanguage(event);
    const preview = event.thumbnail || (looksLikeImage(event.media) ? event.media : '');

    const dateText = detailDateText(event, showOriginal);
    const durationText = detailDurationText(event);
    const typeText = detailTypeText(event);
    const metadata = compactCjkLatinSpacing(
      [dateText, values.category, typeText, durationText].filter(Boolean).join(' • ')
    );

    const image = preview
      ? `<img class="detail-image" src="${escapeAttribute(preview)}" alt="${escapeAttribute(values.mediaCaption || values.headline)}" onerror="this.style.display='none'" />`
      : '';

    const body = values.text
      ? `<div class="detail-body">${escapeHtml(values.text)}</div>`
      : `<div class="detail-body">${escapeHtml(t('details.noDescription'))}</div>`;

    const mediaSection = event.media
      ? `<section class="detail-media">
          <div class="detail-meta">${escapeHtml(t('details.mediaSource'))}</div>
          <a href="${escapeAttribute(mediaDestinationUrl(event.media))}" target="_blank" rel="noopener noreferrer">Open media ↗</a>
          <div class="detail-media-url">${escapeHtml(event.media)}</div>
        </section>`
      : '';

    const finePrintParts = [];

    const explicitCredit = String(event.mediaCredit || '').trim();
    const fallbackSource = mediaSourceLabel(event.media || preview);
    const sourceLabel = explicitCredit || fallbackSource || (state.language === 'zh-TW' ? '時間軸資料記錄' : 'Timeline record');
    finePrintParts.push(`<span class="detail-fine-print-source"><strong>${escapeHtml(t('details.source'))}:</strong> ${escapeHtml(sourceLabel)}</span>`);

    if (event.media) {
      finePrintParts.push(`<span>${escapeHtml(t('details.mediaDisclosure'))}</span>`);
    }

    const hasOriginalSource = Boolean(
      String(event.sourceHeadline || '').trim() ||
      String(event.sourceText || '').trim() ||
      String(event.sourceMediaCaption || '').trim()
    );
    const shouldOfferOriginal = hasOriginalSource && (state.language !== 'en-US' || hasAlternateLanguage || hasTranslatedText);

    if (hasTranslatedText || hasAlternateLanguage || shouldOfferOriginal) {
      finePrintParts.push(`<span>${escapeHtml(t('details.machineTranslationDisclosure'))}</span>`);
      if (shouldOfferOriginal) {
        finePrintParts.push(
          `<a href="#" class="detail-language-link" data-detail-language-toggle>${escapeHtml(
            showOriginal ? t('details.showTranslation') : t('details.showOriginal')
          )}</a>`
        );
      }
    }

    const finePrint = `<p class="detail-fine-print" role="note" aria-label="Credits and translation information">${finePrintParts.join('  ')}</p>`;

    return `<h2>${escapeHtml(values.headline)}</h2>
      <div class="detail-date detail-meta-line">${escapeHtml(metadata)}</div>
      ${image}
      ${body}
      ${mediaSection}
      ${finePrint}`;
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

    if (state.listViewOpen && document.body.classList.contains('list-view-detail-open')) {
      detailPanel.style.left = '50%';
      detailPanel.style.top = 'calc(var(--list-view-safe-top, 140px) + 18px)';
      detailPanel.style.right = 'auto';
      detailPanel.style.bottom = 'auto';
      return;
    }

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
    state.detailShowOriginal = false;
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
    state.detailShowOriginal = false;
    detailPanel.classList.remove('is-opening');
    detailPanel.hidden = true;
    document.body.classList.remove('list-view-detail-open');
    if (detailPanelHome && detailPanel.parentElement !== detailPanelHome) detailPanelHome.appendChild(detailPanel);

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
      searchResultCount.textContent = '0/0';
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
      `${state.searchMatchIndex + 1}/${state.searchMatches.length}`;
    searchPrevious.disabled = false;
    searchNext.disabled = false;
  }

  function onSearchInput() {
    state.searchQuery = searchInput.value;
    state.searchMatchIndex = -1;
    updateSearchResults();
    if (state.listViewOpen) renderListView(false);
    scheduleRender();
  }

  function moveToSearchResult(direction = 1) {
    updateSearchResults();
    if (!state.searchMatches.length) return;

    state.searchMatchIndex =
      (state.searchMatchIndex + direction + state.searchMatches.length) %
      state.searchMatches.length;

    const event = state.searchMatches[state.searchMatchIndex];
    if (state.listViewOpen) {
      state.listViewAnchorId = event.id;
      renderListView(false);
      scrollListViewToAnchor(true);
      searchResultCount.textContent = `${state.searchMatchIndex + 1}/${state.searchMatches.length}`;
      return;
    }
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
      `${state.searchMatchIndex + 1}/${state.searchMatches.length}`;

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
    if (isPhoneVerticalMode()) {
      return Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    }
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
  }

  function moveOverviewWindowTo(centerRatio) {
    const bounds = overviewDataBounds();
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

    const trackRect = overviewTrack.getBoundingClientRect();
    const windowRect = overviewWindow.getBoundingClientRect();
    const ratio = overviewRatioFromPointer(event);
    const bounds = overviewDataBounds();
    const fullSpan = Math.max(0.0001, bounds.max - bounds.min);
    const windowCenterRatio = (((state.viewStart + state.viewEnd) / 2) - bounds.min) / fullSpan;
    const vertical = isPhoneVerticalMode();
    const handleZone = vertical ? 18 : 14;
    const coordinate = vertical ? event.clientY : event.clientX;
    const startEdge = vertical ? windowRect.top : windowRect.left;
    const endEdge = vertical ? windowRect.bottom : windowRect.right;
    const insideWindow = vertical
      ? event.clientY >= windowRect.top && event.clientY <= windowRect.bottom
      : event.clientX >= windowRect.left && event.clientX <= windowRect.right;

    overviewTrack.setPointerCapture?.(event.pointerId);
    state.overviewDragging = true;
    state.overviewDragStartRatio = ratio;
    state.overviewDragStartViewStart = state.viewStart;
    state.overviewDragStartViewEnd = state.viewEnd;

    // Detect handles from actual geometry, not fragile DOM/pseudo-element targeting.
    if (Math.abs(coordinate - startEdge) <= handleZone) {
      state.overviewDragMode = 'left';
      return;
    }
    if (Math.abs(coordinate - endEdge) <= handleZone) {
      state.overviewDragMode = 'right';
      return;
    }
    if (insideWindow) {
      state.overviewDragMode = 'pan';
      state.overviewDragOffsetRatio = ratio - windowCenterRatio;
      return;
    }

    state.overviewDragMode = 'pan';
    state.overviewDragOffsetRatio = 0;
    moveOverviewWindowTo(ratio);
  }

  function onOverviewPointerMove(event) {
    if (!state.overviewDragging) return;
    event.preventDefault();
    const ratio = overviewRatioFromPointer(event);
    if (state.overviewDragMode === 'pan') {
      moveOverviewWindowTo(ratio - state.overviewDragOffsetRatio);
      return;
    }

    const bounds = overviewDataBounds();
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
    state.overviewDragOffsetRatio = 0;
    overviewTrack.releasePointerCapture?.(event.pointerId);
  }

  function onOverviewWheel(event) {
    if (!overviewTrack.contains(event.target)) return;
    event.preventDefault();
    const ratio = overviewRatioFromPointer(event);
    const bounds = overviewDataBounds();
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

    const bounds = overviewDataBounds();
    const dataMin = bounds.min;
    const dataMax = bounds.max;
    const span = Math.max(.0001, dataMax - dataMin);
    const allEvents = overviewEvents();
    const periods = allEvents.filter(event => event.elementType === 'Period' && Number.isFinite(event.end));
    const points = allEvents.filter(event => event.elementType !== 'Period');
    const vertical = isPhoneVerticalMode();
    const leftHandle = overviewWindow.querySelector('[data-overview-handle="left"], [data-overview-handle="top"]');
    const rightHandle = overviewWindow.querySelector('[data-overview-handle="right"], [data-overview-handle="bottom"]');
    if (leftHandle) leftHandle.dataset.overviewHandle = vertical ? 'top' : 'left';
    if (rightHandle) rightHandle.dataset.overviewHandle = vertical ? 'bottom' : 'right';

    overviewCtx.globalAlpha = .84;

    if (vertical) {
      const pointLeft = 3;
      const pointArea = Math.max(10, rect.width * .48);
      const periodLeft = Math.max(pointLeft + pointArea + 2, rect.width * .58);
      const periodArea = Math.max(5, rect.width - periodLeft - 2);

      points.forEach((event, index) => {
        const y = ((event.start - dataMin) / span) * rect.height;
        const lanes = 3;
        const laneWidth = pointArea / lanes;
        const x = pointLeft + (index % lanes) * laneWidth;
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(
          x,
          Math.max(0, Math.min(rect.height - 1, y)),
          Math.max(2, laneWidth - 1),
          2
        );
      });

      periods.forEach((event, index) => {
        const y1 = ((event.start - dataMin) / span) * rect.height;
        const y2 = ((event.end - dataMin) / span) * rect.height;
        const lanes = Math.max(1, Math.min(3, periods.length));
        const laneWidth = Math.max(2, periodArea / lanes);
        const x = periodLeft + (index % lanes) * laneWidth;
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(
          x,
          Math.max(0, Math.min(rect.height, y1)),
          Math.max(2, laneWidth - 1),
          Math.max(1, Math.min(rect.height, y2) - Math.max(0, y1))
        );
      });

      const top = ((state.viewStart - dataMin) / span) * rect.height;
      const bottom = ((state.viewEnd - dataMin) / span) * rect.height;
      const clampedTop = Math.max(0, Math.min(rect.height, top));
      const clampedBottom = Math.max(0, Math.min(rect.height, bottom));
      // In vertical phone mode the base desktop rule still gives the focus
      // window a bottom inset. Clear it explicitly so top + height control the
      // frame. Leaving bottom set over-constrains the absolutely positioned
      // element, causing the frame to retain its old size and making pointer
      // hit-testing disagree with the visible frame after radar rescaling.
      overviewWindow.style.left = '0px';
      overviewWindow.style.width = '100%';
      overviewWindow.style.right = '';
      overviewWindow.style.bottom = 'auto';
      overviewWindow.style.top = `${clampedTop}px`;
      overviewWindow.style.height = `${Math.max(10, clampedBottom - clampedTop)}px`;
    } else {
      const h = Math.max(1, rect.height);
      const pointTop = Math.max(2, h * .08);
      const pointArea = Math.max(8, h * .46);
      const periodTop = Math.max(pointTop + pointArea + 2, h * .60);
      const periodArea = Math.max(6, h - periodTop - 2);

      points.forEach((event, index) => {
        const x = ((event.start - dataMin) / span) * rect.width;
        const lanes = 3;
        const lane = index % lanes;
        const y = pointTop + lane * (pointArea / lanes);
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(Math.max(0, Math.min(rect.width - 1, x)), y, 2, Math.max(5, pointArea / lanes - 1));
      });

      periods.forEach((event, index) => {
        const x1 = ((event.start - dataMin) / span) * rect.width;
        const x2 = ((event.end - dataMin) / span) * rect.width;
        const lanes = Math.max(1, Math.min(3, periods.length));
        const laneHeight = Math.max(2, periodArea / lanes);
        const y = periodTop + (index % lanes) * laneHeight;
        overviewCtx.fillStyle = event.color;
        overviewCtx.fillRect(
          Math.max(0, Math.min(rect.width, x1)),
          y,
          Math.max(1, Math.min(rect.width, x2) - Math.max(0, x1)),
          Math.max(2, laneHeight - 1)
        );
      });

      const left = ((state.viewStart - dataMin) / span) * rect.width;
      const right = ((state.viewEnd - dataMin) / span) * rect.width;
      const clampedLeft = Math.max(0, Math.min(rect.width, left));
      const clampedRight = Math.max(0, Math.min(rect.width, right));
      // Restore the desktop/iPad top-and-bottom inset after leaving phone
      // mode; phone mode sets bottom:auto so its height can be controlled.
      overviewWindow.style.top = '';
      overviewWindow.style.bottom = '';
      overviewWindow.style.height = '';
      overviewWindow.style.right = '';
      overviewWindow.style.left = `${clampedLeft}px`;
      overviewWindow.style.width = `${Math.max(8, clampedRight - clampedLeft)}px`;
    }

    overviewCtx.globalAlpha = 1;
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
