create table if not exists households (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  created_by text not null,
  owners text not null,
  payments text not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id text not null references households (id) on delete cascade,
  user_id text not null,
  display_name text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx on household_members (user_id);

create table if not exists ledger_categories (
  id text primary key,
  household_id text not null references households (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null,
  unique (household_id, kind, name)
);

create table if not exists ledger_entries (
  id text primary key,
  household_id text not null references households (id) on delete cascade,
  entry_date date not null,
  kind text not null check (kind in ('income', 'expense')),
  category text not null,
  description text not null,
  owner_name text not null,
  payment_method text not null,
  amount integer not null check (amount >= 0),
  note text not null default '',
  actor_user_id text not null,
  actor_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_house_date_idx
  on ledger_entries (household_id, entry_date desc);

create table if not exists household_presence (
  household_id text not null,
  user_id text not null,
  display_name text not null,
  seen_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
