export const EXPENSE_CATEGORIES = [
  "헌금",
  "생활비",
  "경조사비",
  "부모님 용돈",
  "선물",
  "외식",
  "배달",
  "운동",
  "쇼핑",
  "병원비",
  "대출금",
  "시운",
  "승렬",
  "신영",
  "여행",
  "여가",
  "세금",
] as const;

export const INCOME_CATEGORIES = ["월급", "용돈", "시운", "기타"] as const;

export const DEFAULT_OWNERS = ["승렬", "신영", "생활비계좌"] as const;

export const DEFAULT_PAYMENTS = [
  "카카오페이",
  "네이버페이",
  "쿠팡카드",
  "카드",
  "계좌이체",
  "현금",
] as const;
