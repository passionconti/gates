const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEntryRowsPayload,
  createEmptyEntryDraft,
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

test('buildEntryRowsPayload builds multiple rows with expanded fields', () => {
  const now = '2026-04-10T08:30:00.000Z';
  const rows = buildEntryRowsPayload(
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
    { now },
  );

  assert.deepEqual(rows, [
    ['2026-04-10', '지출', '식비', '점심', '라이언', '카드', 12000, '팀 점심', now],
    ['2026-04-10', '수입', '급여', '월급', '법인', '계좌이체', 3000000, '', now],
  ]);
});

test('buildEntryRowsPayload ignores rows that are completely empty', () => {
  const rows = buildEntryRowsPayload(
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
    ['2026-04-10', '지출', '교통', '택시', '', '카드', 18000, '', '2026-04-10T08:30:00.000Z'],
  ]);
});

test('buildEntryRowsPayload throws with the row number when a required field is missing', () => {
  assert.throws(
    () =>
      buildEntryRowsPayload([
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
    /1번째 항목의 카테고리를 입력해 주세요\./,
  );
});

test('buildEntryRowsPayload throws when all rows are empty', () => {
  assert.throws(
    () => buildEntryRowsPayload([createEmptyEntryDraft('2026-04-10')]),
    /저장할 가계부 항목을 한 건 이상 입력해 주세요\./,
  );
});

test('buildEntryRowsPayload throws when amount is not a valid number', () => {
  assert.throws(
    () =>
      buildEntryRowsPayload([
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
