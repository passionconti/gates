const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEntryPreviewRows,
  buildLogsRowsPayload,
  buildMonthlySheetPayloads,
  createEmptyEntryDraft,
  formatAmountDisplayValue,
  formatDesktopDateValue,
  formatMonthlySheetName,
  getCategoryOptionsForType,
  getLogsHeaderRow,
  isLogsHeaderRowComplete,
  normalizeAmountInputValue,
  normalizeDesktopDateValue,
  OWNER_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} = require('../public/entry-helpers.js');

test('createEmptyEntryDraft returns the requested default values for a new row', () => {
  assert.deepEqual(createEmptyEntryDraft('2026-04-10'), {
    date: '2026-04-10',
    type: '지출',
    category: '생활비',
    description: '',
    owner: '생활비계좌',
    paymentMethod: '카드',
    amount: '',
    note: '',
  });
});

test('formatMonthlySheetName converts the date to the M월 format', () => {
  assert.equal(formatMonthlySheetName('2026-04-10'), '4월');
  assert.equal(formatMonthlySheetName('2026-11-01'), '11월');
});

test('formatDesktopDateValue formats YYYY-MM-DD dates as yy.mm.dd for desktop inputs', () => {
  assert.equal(formatDesktopDateValue('2026-04-11'), '26.04.11');
  assert.equal(formatDesktopDateValue('2026-11-03'), '26.11.03');
});

test('normalizeDesktopDateValue converts yy.mm.dd desktop input back to YYYY-MM-DD', () => {
  assert.equal(normalizeDesktopDateValue('26.04.11'), '2026-04-11');
  assert.equal(normalizeDesktopDateValue('2026.04.11'), '2026-04-11');
  assert.equal(normalizeDesktopDateValue('26-04-11'), '2026-04-11');
  assert.equal(normalizeDesktopDateValue('260411'), '2026-04-11');
});

test('normalizeAmountInputValue keeps digits only so formatted amount fields can store raw numbers', () => {
  assert.equal(normalizeAmountInputValue('12,345원'), '12345');
  assert.equal(normalizeAmountInputValue(' 001,200 '), '001200');
  assert.equal(normalizeAmountInputValue(''), '');
});

test('formatAmountDisplayValue adds thousand separators for amount inputs', () => {
  assert.equal(formatAmountDisplayValue('12345'), '12,345');
  assert.equal(formatAmountDisplayValue('001200'), '1,200');
  assert.equal(formatAmountDisplayValue('abc'), '');
  assert.equal(formatAmountDisplayValue(''), '');
});

test('getCategoryOptionsForType returns the allowed dropdown options for each type', () => {
  assert.deepEqual(getCategoryOptionsForType('지출'), [
    '헌금',
    '생활비',
    '경조사비',
    '부모님 용돈',
    '선물',
    '외식',
    '배달',
    '운동',
    '쇼핑',
    '병원비',
    '대출금',
    '시운',
    '승렬',
    '신영',
    '여행',
    '여가',
    '세금',
  ]);
  assert.deepEqual(getCategoryOptionsForType('수입'), ['월급', '용돈', '시운', '기타']);
});

test('exported dropdown option constants match the supported owner and payment methods', () => {
  assert.deepEqual(OWNER_OPTIONS, ['승렬', '신영', '생활비계좌']);
  assert.deepEqual(PAYMENT_METHOD_OPTIONS, ['카카오페이', '네이버페이', '쿠팡카드', '카드', '계좌이체', '현금']);
});

test('getLogsHeaderRow returns the actorname column expected by the logs sheet', () => {
  assert.deepEqual(getLogsHeaderRow(), [
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
  ]);
});

test('isLogsHeaderRowComplete detects older logs headers without actorname column', () => {
  assert.equal(
    isLogsHeaderRowComplete(['date', 'type', 'category', 'description', 'owner', 'paymentMethod', 'amount', 'note', 'savedAt']),
    false,
  );
  assert.equal(
    isLogsHeaderRowComplete(['date', 'type', 'category', 'description', 'owner', 'paymentMethod', 'amount', 'note', 'savedAt', 'actorname']),
    true,
  );
});

test('buildLogsRowsPayload normalizes stored dates to yy-mm-dd', () => {
  const rows = buildLogsRowsPayload(
    [
      {
        date: '2026-04-10',
        type: '지출',
        category: '외식',
        description: '점심',
        owner: '승렬',
        paymentMethod: '카드',
        amount: '12000',
        note: '',
      },
    ],
    { now: '2026-04-10T08:30:00.000Z' },
  );

  assert.equal(rows[0][0], '26-04-10');
});

test('buildLogsRowsPayload builds raw rows for the logs sheet with actor information', () => {
  const now = '2026-04-10T08:30:00.000Z';
  const actor = {
    name: 'Ryan',
  };
  const rows = buildLogsRowsPayload(
    [
      {
        date: '2026-04-10',
        type: '지출',
        category: '외식',
        description: '점심',
        owner: '승렬',
        paymentMethod: '카드',
        amount: '12,000',
        note: '팀 점심',
      },
      {
        date: '2026-04-10',
        type: '수입',
        category: '월급',
        description: '월급',
        owner: '생활비계좌',
        paymentMethod: '계좌이체',
        amount: '3000000',
        note: '',
      },
    ],
    { now, actor },
  );

  assert.deepEqual(rows, [
    ['26-04-10', '지출', '외식', '점심', '승렬', '카드', 12000, '팀 점심', now, 'Ryan'],
    ['26-04-10', '수입', '월급', '월급', '생활비계좌', '계좌이체', 3000000, '', now, 'Ryan'],
  ]);
});

test('buildMonthlySheetPayloads groups rows by month and maps expense and income columns separately', () => {
  const payloads = buildMonthlySheetPayloads([
    {
      date: '2026-04-10',
      type: '지출',
      category: '외식',
      description: '점심',
      owner: '승렬',
      paymentMethod: '카드',
      amount: '12,000',
      note: '팀 점심',
    },
    {
      date: '2026-04-20',
      type: '수입',
      category: '월급',
      description: '월급',
      owner: '생활비계좌',
      paymentMethod: '계좌이체',
      amount: '3000000',
      note: '',
    },
    {
      date: '2026-05-03',
      type: '지출',
      category: '여행',
      description: '택시',
      owner: '',
      paymentMethod: '카드',
      amount: '18000',
      note: '',
    },
  ]);

  assert.deepEqual(payloads, [
    {
      sheetName: '4월',
      rows: [
        ['26-04-10', '외식', '점심', 12000, '', '승렬', '카드', '팀 점심'],
        ['26-04-20', '월급', '월급', '', 3000000, '생활비계좌', '계좌이체', ''],
      ],
    },
    {
      sheetName: '5월',
      rows: [['26-05-03', '여행', '택시', 18000, '', '', '카드', '']],
    },
  ]);
});

test('buildEntryPreviewRows returns formatted confirmation rows for the save modal', () => {
  const previewRows = buildEntryPreviewRows([
    {
      date: '2026-04-10',
      type: '지출',
      category: '외식',
      description: '점심',
      owner: '승렬',
      paymentMethod: '카드',
      amount: '12000',
      note: '',
    },
  ]);

  assert.deepEqual(previewRows, [
    {
      date: '26.04.10',
      type: '지출',
      category: '외식',
      description: '점심',
      owner: '승렬',
      paymentMethod: '카드',
      amount: '12,000',
      note: '-',
    },
  ]);
});

test('buildLogsRowsPayload ignores rows that are completely empty', () => {
  const rows = buildLogsRowsPayload(
    [
      createEmptyEntryDraft('2026-04-10'),
      {
        date: '2026-04-10',
        type: '지출',
        category: '여행',
        description: '택시',
        owner: '',
        paymentMethod: '카드',
        amount: '18000',
        note: '',
      },
    ],
    { now: '2026-04-10T08:30:00.000Z' },
  );

  assert.deepEqual(rows, [
    ['26-04-10', '지출', '여행', '택시', '', '카드', 18000, '', '2026-04-10T08:30:00.000Z', ''],
  ]);
});

test('buildLogsRowsPayload throws with the row number when a required field is missing', () => {
  assert.throws(
    () =>
      buildLogsRowsPayload([
        {
          date: '2026-04-10',
          type: '지출',
          category: '',
          description: '택시',
          owner: '',
          paymentMethod: '카드',
          amount: '18000',
          note: '',
        },
      ]),
    /1번째 항목의 종류를 입력해 주세요\./,
  );
});

test('buildLogsRowsPayload throws when all rows are empty', () => {
  assert.throws(
    () => buildLogsRowsPayload([createEmptyEntryDraft('2026-04-10')]),
    /저장할 가계부 항목을 한 건 이상 입력해 주세요\./,
  );
});

test('buildLogsRowsPayload throws when amount is not a valid number', () => {
  assert.throws(
    () =>
      buildLogsRowsPayload([
        {
          date: '2026-04-10',
          type: '지출',
          category: '외식',
          description: '점심',
          owner: '',
          paymentMethod: '카드',
          amount: '만원',
          note: '',
        },
      ]),
    /1번째 항목의 금액은 숫자로 입력해 주세요\./,
  );
});

test('buildLogsRowsPayload throws when the category is not allowed for the selected type', () => {
  assert.throws(
    () =>
      buildLogsRowsPayload([
        {
          date: '2026-04-10',
          type: '수입',
          category: '외식',
          description: '잘못된 카테고리',
          owner: '승렬',
          paymentMethod: '계좌이체',
          amount: '10000',
          note: '',
        },
      ]),
    /1번째 항목의 카테고리를 다시 선택해 주세요\./,
  );
});

test('buildLogsRowsPayload throws when owner is outside the dropdown options', () => {
  assert.throws(
    () =>
      buildLogsRowsPayload([
        {
          date: '2026-04-10',
          type: '지출',
          category: '외식',
          description: '점심',
          owner: '라이언',
          paymentMethod: '카드',
          amount: '12000',
          note: '',
        },
      ]),
    /1번째 항목의 명의를 다시 선택해 주세요\./,
  );
});

test('buildLogsRowsPayload throws when payment method is outside the dropdown options', () => {
  assert.throws(
    () =>
      buildLogsRowsPayload([
        {
          date: '2026-04-10',
          type: '지출',
          category: '외식',
          description: '점심',
          owner: '승렬',
          paymentMethod: '법인카드',
          amount: '12000',
          note: '',
        },
      ]),
    /1번째 항목의 지출방식을 다시 선택해 주세요\./,
  );
});
