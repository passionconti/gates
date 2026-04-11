(function (global, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.GatesEntryHelpers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ENTRY_TYPE_OPTIONS = ['수입', '지출'];
  const LOGS_HEADER_ROW = [
    'date',
    'type',
    'category',
    'description',
    'owner',
    'paymentMethod',
    'amount',
    'note',
    'savedAt',
    'actorname',
  ];
  const REQUIRED_FIELDS = [
    ['date', '날짜'],
    ['type', '수입/지출 구분'],
    ['category', '종류'],
    ['description', '내용'],
    ['amount', '금액'],
  ];

  function toTrimmedString(value) {
    return String(value || '').trim();
  }

  function createEmptyEntryDraft(defaultDate = '') {
    return {
      date: toTrimmedString(defaultDate),
      type: '지출',
      category: '',
      description: '',
      owner: '',
      paymentMethod: '',
      amount: '',
      note: '',
    };
  }

  function sanitizeEntryDraft(entry) {
    const draft = {
      ...createEmptyEntryDraft(),
      ...(entry || {}),
    };

    return {
      date: toTrimmedString(draft.date),
      type: toTrimmedString(draft.type) || '지출',
      category: toTrimmedString(draft.category),
      description: toTrimmedString(draft.description),
      owner: toTrimmedString(draft.owner),
      paymentMethod: toTrimmedString(draft.paymentMethod),
      amount: toTrimmedString(draft.amount),
      note: toTrimmedString(draft.note),
    };
  }

  function isEntryDraftEmpty(entry) {
    const draft = sanitizeEntryDraft(entry);

    return [
      draft.category,
      draft.description,
      draft.owner,
      draft.paymentMethod,
      draft.amount,
      draft.note,
    ].every((value) => value === '');
  }

  function parseAmount(amountText, rowNumber) {
    const normalized = toTrimmedString(amountText).replaceAll(',', '');
    const amount = Number(normalized);

    if (!normalized || Number.isNaN(amount)) {
      throw new Error(`${rowNumber}번째 항목의 금액은 숫자로 입력해 주세요.`);
    }

    return amount;
  }

  function normalizeStoredDate(dateText, rowNumber) {
    const normalized = toTrimmedString(dateText);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
      throw new Error(`${rowNumber}번째 항목의 날짜 형식을 다시 확인해 주세요.`);
    }

    return `${match[1].slice(-2)}-${match[2]}-${match[3]}`;
  }

  function validateRequiredFields(entry, rowNumber) {
    for (const [field, label] of REQUIRED_FIELDS) {
      if (!toTrimmedString(entry[field])) {
        throw new Error(`${rowNumber}번째 항목의 ${label}를 입력해 주세요.`);
      }
    }

    if (!ENTRY_TYPE_OPTIONS.includes(entry.type)) {
      throw new Error(`${rowNumber}번째 항목의 수입/지출 구분을 다시 선택해 주세요.`);
    }
  }

  function getNonEmptyDrafts(entries) {
    const drafts = Array.isArray(entries) ? entries : [];
    const nonEmptyDrafts = drafts.filter((entry) => !isEntryDraftEmpty(entry));

    if (nonEmptyDrafts.length === 0) {
      throw new Error('저장할 가계부 항목을 한 건 이상 입력해 주세요.');
    }

    return nonEmptyDrafts;
  }

  function sanitizeActor(actor) {
    return {
      name: toTrimmedString(actor?.name),
    };
  }

  function getLogsHeaderRow() {
    return [...LOGS_HEADER_ROW];
  }

  function normalizeHeaderCell(value) {
    return toTrimmedString(value).toLowerCase();
  }

  function isLogsHeaderRowComplete(row) {
    const headerRow = Array.isArray(row) ? row : [];

    return LOGS_HEADER_ROW.every((cell, index) => normalizeHeaderCell(headerRow[index]) === normalizeHeaderCell(cell));
  }

  function buildLogsRow(entry, rowNumber, timestamp, actor) {
    const draft = sanitizeEntryDraft(entry);
    validateRequiredFields(draft, rowNumber);
    const sanitizedActor = sanitizeActor(actor);

    return [
      normalizeStoredDate(draft.date, rowNumber),
      draft.type,
      draft.category,
      draft.description,
      draft.owner,
      draft.paymentMethod,
      parseAmount(draft.amount, rowNumber),
      draft.note,
      timestamp,
      sanitizedActor.name,
    ];
  }

  function formatMonthlySheetName(dateText) {
    const date = toTrimmedString(dateText);
    const match = date.match(/^\d{4}-(\d{2})-\d{2}$/);

    if (!match) {
      return '';
    }

    return `${Number(match[1])}월`;
  }

  function buildMonthlySheetRow(entry, rowNumber) {
    const draft = sanitizeEntryDraft(entry);
    validateRequiredFields(draft, rowNumber);
    const amount = parseAmount(draft.amount, rowNumber);

    return {
      sheetName: formatMonthlySheetName(draft.date),
      row: [
        normalizeStoredDate(draft.date, rowNumber),
        draft.category,
        draft.description,
        draft.type === '지출' ? amount : '',
        draft.type === '수입' ? amount : '',
        draft.owner,
        draft.paymentMethod,
        draft.note,
      ],
    };
  }

  function buildLogsRowsPayload(entries, options = {}) {
    const timestamp = options.now || new Date().toISOString();
    const actor = sanitizeActor(options.actor);
    return getNonEmptyDrafts(entries).map((entry, index) => buildLogsRow(entry, index + 1, timestamp, actor));
  }

  function buildMonthlySheetPayloads(entries) {
    const groupedRows = new Map();

    getNonEmptyDrafts(entries).forEach((entry, index) => {
      const payload = buildMonthlySheetRow(entry, index + 1);

      if (!payload.sheetName) {
        throw new Error(`${index + 1}번째 항목의 날짜 형식을 다시 확인해 주세요.`);
      }

      if (!groupedRows.has(payload.sheetName)) {
        groupedRows.set(payload.sheetName, []);
      }

      groupedRows.get(payload.sheetName).push(payload.row);
    });

    return Array.from(groupedRows.entries()).map(([sheetName, rows]) => ({
      sheetName,
      rows,
    }));
  }

  return {
    ENTRY_TYPE_OPTIONS,
    createEmptyEntryDraft,
    sanitizeEntryDraft,
    isEntryDraftEmpty,
    getLogsHeaderRow,
    isLogsHeaderRowComplete,
    formatMonthlySheetName,
    buildLogsRowsPayload,
    buildMonthlySheetPayloads,
  };
});