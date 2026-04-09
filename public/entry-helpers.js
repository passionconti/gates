(function (global, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.GatesEntryHelpers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ENTRY_TYPE_OPTIONS = ['수입', '지출'];
  const REQUIRED_FIELDS = [
    ['date', '날짜'],
    ['type', '수입/지출 구분'],
    ['category', '카테고리'],
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

  function buildEntryRow(entry, rowNumber, timestamp) {
    const draft = sanitizeEntryDraft(entry);
    validateRequiredFields(draft, rowNumber);

    return [
      draft.date,
      draft.type,
      draft.category,
      draft.description,
      draft.owner,
      draft.paymentMethod,
      parseAmount(draft.amount, rowNumber),
      draft.note,
      timestamp,
    ];
  }

  function buildEntryRowsPayload(entries, options = {}) {
    const drafts = Array.isArray(entries) ? entries : [];
    const nonEmptyDrafts = drafts.filter((entry) => !isEntryDraftEmpty(entry));

    if (nonEmptyDrafts.length === 0) {
      throw new Error('저장할 가계부 항목을 한 건 이상 입력해 주세요.');
    }

    const timestamp = options.now || new Date().toISOString();

    return nonEmptyDrafts.map((entry, index) => buildEntryRow(entry, index + 1, timestamp));
  }

  return {
    ENTRY_TYPE_OPTIONS,
    createEmptyEntryDraft,
    sanitizeEntryDraft,
    isEntryDraftEmpty,
    buildEntryRow,
    buildEntryRowsPayload,
  };
});
