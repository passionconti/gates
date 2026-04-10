const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLogsRowsPayload,
  buildMonthlySheetPayloads,
  createEmptyEntryDraft,
  formatMonthlySheetName,
} = require('../public/entry-helpers.js');

test('createEmptyEntryDraft returns default values for a new row', () => {
  assert.deepEqual(createEmptyEntryDraft('2026-04-10'), {
    date: '2026-04-10',
    type: '지출',
    category: '',
    description: '',
    owner: '',
    paymentMethod: '',
    amount: '',
    note: '',
  });
});

test('formatMonthlySheetName converts the date to the M월 format', () => {
  assert.equal(formatMonthlySheetName('2026-04-10'), '4월');
  assert.equal(formatMonthlySheetName('2026-11-01'), '11월');
});

test('buildLogsRowsPayload normalizes stored dates to yy-mm-dd', () => {
  const rows = buildLogsRowsPayload(
    [
      {
        date: '2026-04-10',
        type: '지출',
        category: '식비',
        description: '점심',
        owner: '라이언',
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
    email: 'ryan@example.com',
  };
  const rows = buildLogsRowsPayload(
    [
      {
        date: '2026-04-10',
        type: '지출',
        category: '식비',
        description: '점심',
        owner: '라이언',
        paymentMethod: '카드',
        amount: '12,000',
        note: '팀 점심',
      },
      {
        date: '2026-04-10',
        type: '수입',
        category: '급여',
        description: '월급',
        owner: '법인',
        paymentMethod: '계좌이체',
        amount: '3000000',
        note: '',
      },
    ],
    { now, actor },
  );

  assert.deepEqual(rows, [
    ['26-04-10', '지출', '식비', '점심', '라이언', '카드', 12000, '팀 점심', now, 'Ryan', 'ryan@example.com'],
    ['26-04-10', '수입', '급여', '월급', '법인', '계좌이체', 3000000, '', now, 'Ryan', 'ryan@example.com'],
  ]);
});

test('buildMonthlySheetPayloads groups rows by month and maps expense and income columns separately', () => {
  const payloads = buildMonthlySheetPayloads([
    {
      date: '2026-04-10',
      type: '지출',
      category: '식비',
      description: '점심',
      owner: '라이언',
      paymentMethod: '카드',
      amount: '12,000',
      note: '팀 점심',
    },
    {
      date: '2026-04-20',
      type: '수입',
      category: '급여',
      description: '월급',
      owner: '법인',
      paymentMethod: '계좌이체',
      amount: '3000000',
      note: '',
    },
    {
      date: '2026-05-03',
      type: '지출',
      category: '교통',
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
        ['26-04-10', '식비', '점심', 12000, '', '라이언', '카드', '팀 점심'],
        ['26-04-20', '급여', '월급', '', 3000000, '법인', '계좌이체', ''],
      ],
    },
    {
      sheetName: '5월',
      rows: [['26-05-03', '교통', '택시', 18000, '', '', '카드', '']],
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
        category: '교통',
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
    ['26-04-10', '지출', '교통', '택시', '', '카드', 18000, '', '2026-04-10T08:30:00.000Z', '', ''],
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
          category: '식비',
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
