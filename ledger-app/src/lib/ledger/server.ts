import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  DEFAULT_OWNERS,
  DEFAULT_PAYMENTS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/ledger/constants";
import type { BookSnapshot, BookSummary, EntryRow, Kind, MemberRow } from "@/lib/ledger/types";

const kindSchema = z.enum(["income", "expense"]);

function fail(message: string): never {
  throw new Error(message);
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) fail("입력값을 다시 확인해 주세요.");
  return result.data;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return [];
    }
  }
  return [];
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

async function accountName(sql: Sql, userId: string) {
  const rows = await sql<{ name: string; email: string }>`
    select name, email from "user" where id = ${userId} limit 1
  `;
  const row = rows[0];
  const name = row?.name?.trim();
  if (name) return name.slice(0, 20);
  const email = row?.email?.split("@")[0]?.trim();
  return email ? email.slice(0, 20) : "구성원";
}

function chosenName(nickname: string | undefined, fallback: string) {
  const trimmed = nickname?.trim();
  return (trimmed || fallback).slice(0, 20);
}

async function requireMember(sql: Sql, userId: string, bookId: string) {
  const rows = await sql<{
    id: string;
    name: string;
    inviteCode: string;
    owners: string;
    payments: string;
    userId: string;
    displayName: string;
    role: string;
  }>`
    select
      h.id,
      h.name,
      h.invite_code as "inviteCode",
      h.owners,
      h.payments,
      m.user_id as "userId",
      m.display_name as "displayName",
      m.role
    from households h
    join household_members m on m.household_id = h.id
    where h.id = ${bookId} and m.user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) fail("이 가계부의 구성원이 아닙니다.");
  return row;
}

async function listMembers(sql: Sql, bookId: string): Promise<MemberRow[]> {
  return sql<MemberRow>`
    select user_id as "userId", display_name as "displayName", role
    from household_members
    where household_id = ${bookId}
    order by joined_at asc
  `;
}

function mapEntry(row: EntryRow): EntryRow {
  return {
    ...row,
    amount: Number(row.amount),
    entryDate: String(row.entryDate).slice(0, 10),
    kind: row.kind === "income" ? "income" : "expense",
  };
}

async function seedCategories(sql: Sql, bookId: string) {
  const rows: Array<[Kind, string]> = [
    ...EXPENSE_CATEGORIES.map((name) => ["expense", name] as [Kind, string]),
    ...INCOME_CATEGORIES.map((name) => ["income", name] as [Kind, string]),
  ];
  for (const [kind, name] of rows) {
    await sql`
      insert into ledger_categories (id, household_id, kind, name)
      values (${crypto.randomUUID()}, ${bookId}, ${kind}, ${name})
      on conflict (household_id, kind, name) do nothing
    `;
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  nickname: z.string().trim().max(20).optional(),
});

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(createSchema, input))
  .handler(async ({ data, context }): Promise<BookSummary> => {
    const sql = await getSql();
    const userId = context.userId;
    const displayName = chosenName(data.nickname, await accountName(sql, userId));
    const id = crypto.randomUUID();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = inviteCode();
      try {
        await sql`
          insert into households (id, name, invite_code, created_by, owners, payments)
          values (
            ${id},
            ${data.name},
            ${code},
            ${userId},
            ${JSON.stringify([...DEFAULT_OWNERS])},
            ${JSON.stringify([...DEFAULT_PAYMENTS])}
          )
        `;
        await sql`
          insert into household_members (household_id, user_id, display_name, role)
          values (${id}, ${userId}, ${displayName}, 'owner')
        `;
        await seedCategories(sql, id);
        return { id, name: data.name, inviteCode: code, role: "owner", displayName };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/unique|duplicate|23505/i.test(message) || attempt === 4) throw error;
      }
    }
    fail("가계부를 만들지 못했습니다.");
  });

const joinSchema = z.object({
  code: z.string().trim().min(4).max(12),
  nickname: z.string().trim().max(20).optional(),
});

export const joinHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(joinSchema, input))
  .handler(async ({ data, context }): Promise<BookSummary> => {
    const sql = await getSql();
    const userId = context.userId;
    const code = data.code.trim().toUpperCase();
    const houses = await sql<{ id: string; name: string; inviteCode: string }>`
      select id, name, invite_code as "inviteCode"
      from households
      where invite_code = ${code}
      limit 1
    `;
    const house = houses[0];
    if (!house) fail("초대 코드를 다시 확인해 주세요.");
    const displayName = chosenName(data.nickname, await accountName(sql, userId));
    await sql`
      insert into household_members (household_id, user_id, display_name, role)
      values (${house.id}, ${userId}, ${displayName}, 'member')
      on conflict (household_id, user_id) do update
      set display_name = excluded.display_name
    `;
    return {
      id: house.id,
      name: house.name,
      inviteCode: house.inviteCode,
      role: "member",
      displayName,
    };
  });

export const listMyHouseholds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BookSummary[]> => {
    const sql = await getSql();
    return sql<BookSummary>`
      select
        h.id,
        h.name,
        h.invite_code as "inviteCode",
        m.role,
        m.display_name as "displayName"
      from household_members m
      join households h on h.id = m.household_id
      where m.user_id = ${context.userId}
      order by m.joined_at desc
    `;
  });

const syncSchema = z.object({
  bookId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
});

export const syncHousehold = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(syncSchema, input))
  .handler(async ({ data, context }): Promise<BookSnapshot> => {
    const sql = await getSql();
    const access = await requireMember(sql, context.userId, data.bookId);
    await sql`
      insert into household_presence (household_id, user_id, display_name, seen_at)
      values (${data.bookId}, ${context.userId}, ${access.displayName}, now())
      on conflict (household_id, user_id) do update
      set display_name = excluded.display_name, seen_at = now()
    `;
    const members = await listMembers(sql, data.bookId);
    const presence = await sql<{ userId: string; displayName: string }>`
      select user_id as "userId", display_name as "displayName"
      from household_presence
      where household_id = ${data.bookId}
        and seen_at > now() - interval '20 seconds'
      order by display_name asc
    `;
    const categories = await sql<{ kind: Kind; name: string }>`
      select kind, name
      from ledger_categories
      where household_id = ${data.bookId}
      order by name asc
    `;
    const yearRows = await sql<{ year: string }>`
      select distinct to_char(entry_date, 'YYYY') as year
      from ledger_entries
      where household_id = ${data.bookId}
      order by year desc
    `;
    const years = yearRows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year));
    const entries = (
      await sql<EntryRow>`
        select
          id,
          to_char(entry_date, 'YYYY-MM-DD') as "entryDate",
          kind,
          category,
          description,
          owner_name as "ownerName",
          payment_method as "paymentMethod",
          amount,
          note,
          actor_user_id as "actorUserId",
          actor_name as "actorName",
          to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') as "createdAt"
        from ledger_entries
        where household_id = ${data.bookId}
          and to_char(entry_date, 'YYYY') = ${String(data.year)}
        order by entry_date desc, created_at desc
      `
    ).map(mapEntry);

    return {
      id: access.id,
      name: access.name,
      inviteCode: access.inviteCode,
      owners: asStringArray(access.owners),
      payments: asStringArray(access.payments),
      me: { userId: access.userId, displayName: access.displayName, role: access.role },
      members,
      presence,
      incomeCategories: categories.filter((row) => row.kind === "income").map((row) => row.name),
      expenseCategories: categories.filter((row) => row.kind === "expense").map((row) => row.name),
      years: years.length > 0 ? years : [data.year],
      year: data.year,
      entries,
    };
  });

const entrySchema = z.object({
  bookId: z.string().min(1),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: kindSchema,
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(200),
  ownerName: z.string().trim().min(1).max(40),
  paymentMethod: z.string().trim().min(1).max(40),
  amount: z.number().int().positive().max(1_000_000_000),
  note: z.string().trim().max(200).optional(),
});

export const addEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(entrySchema, input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sql = await getSql();
    const access = await requireMember(sql, context.userId, data.bookId);
    const owners = asStringArray(access.owners);
    const payments = asStringArray(access.payments);
    if (!owners.includes(data.ownerName)) fail("명의를 다시 선택해 주세요.");
    if (!payments.includes(data.paymentMethod)) fail("지출방식을 다시 선택해 주세요.");
    const allowed = await sql<{ name: string }>`
      select name from ledger_categories
      where household_id = ${data.bookId} and kind = ${data.kind} and name = ${data.category}
      limit 1
    `;
    if (!allowed[0]) fail("카테고리를 다시 선택해 주세요.");
    const id = crypto.randomUUID();
    await sql`
      insert into ledger_entries (
        id, household_id, entry_date, kind, category, description,
        owner_name, payment_method, amount, note, actor_user_id, actor_name
      ) values (
        ${id},
        ${data.bookId},
        ${data.entryDate},
        ${data.kind},
        ${data.category},
        ${data.description},
        ${data.ownerName},
        ${data.paymentMethod},
        ${data.amount},
        ${data.note ?? ""},
        ${context.userId},
        ${access.displayName}
      )
    `;
    return { id };
  });

const deleteSchema = z.object({
  bookId: z.string().min(1),
  entryId: z.string().min(1),
});

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(deleteSchema, input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await requireMember(sql, context.userId, data.bookId);
    const removed = await sql<{ id: string }>`
      delete from ledger_entries
      where id = ${data.entryId} and household_id = ${data.bookId}
      returning id
    `;
    if (!removed[0]) fail("이미 삭제된 항목입니다.");
    return { ok: true };
  });

const categorySchema = z.object({
  bookId: z.string().min(1),
  kind: kindSchema,
  name: z.string().trim().min(1).max(40),
});

export const addCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(categorySchema, input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await requireMember(sql, context.userId, data.bookId);
    await sql`
      insert into ledger_categories (id, household_id, kind, name)
      values (${crypto.randomUUID()}, ${data.bookId}, ${data.kind}, ${data.name})
      on conflict (household_id, kind, name) do nothing
    `;
    return { ok: true };
  });

const ownerSchema = z.object({
  bookId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

export const addOwner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(ownerSchema, input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const access = await requireMember(sql, context.userId, data.bookId);
    const owners = asStringArray(access.owners);
    if (!owners.includes(data.name)) owners.push(data.name);
    await sql`
      update households set owners = ${JSON.stringify(owners)} where id = ${data.bookId}
    `;
    return { ok: true };
  });
