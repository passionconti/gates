export type Kind = "income" | "expense";

export type BookSummary = {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  displayName: string;
};

export type MemberRow = {
  userId: string;
  displayName: string;
  role: string;
};

export type PresenceRow = {
  userId: string;
  displayName: string;
};

export type EntryRow = {
  id: string;
  entryDate: string;
  kind: Kind;
  category: string;
  description: string;
  ownerName: string;
  paymentMethod: string;
  amount: number;
  note: string;
  actorUserId: string;
  actorName: string;
  createdAt: string;
};

export type BookSnapshot = {
  id: string;
  name: string;
  inviteCode: string;
  owners: string[];
  payments: string[];
  me: MemberRow;
  members: MemberRow[];
  presence: PresenceRow[];
  incomeCategories: string[];
  expenseCategories: string[];
  years: number[];
  year: number;
  entries: EntryRow[];
};
