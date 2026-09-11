-- GrowMate AI – Supabase / PostgreSQL schema
-- All business data is scoped by shop_id. One `customers` table for ALL customers
-- (never one table per customer).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shops
-- ---------------------------------------------------------------------------
create table if not exists shops (
  id          text primary key default ('shop_' || replace(gen_random_uuid()::text, '-', '')),
  name        text not null,
  owner_name  text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers (Khata owners)
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id                  text primary key default ('cust_' || replace(gen_random_uuid()::text, '-', '')),
  shop_id             text not null references shops(id) on delete cascade,
  name                text not null,
  father_name         text,
  phone               text,
  outstanding_balance numeric(12,2) not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists customers_shop_idx on customers(shop_id);
create index if not exists customers_name_idx on customers(shop_id, lower(name));

-- ---------------------------------------------------------------------------
-- Products / Inventory
-- ---------------------------------------------------------------------------
create table if not exists products (
  id            text primary key default ('prod_' || replace(gen_random_uuid()::text, '-', '')),
  shop_id       text not null references shops(id) on delete cascade,
  name          text not null,
  quantity      numeric(12,3) not null default 0,
  unit          text not null default 'pcs',
  price         numeric(12,2),
  minimum_stock numeric(12,3) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists products_shop_idx on products(shop_id);

-- ---------------------------------------------------------------------------
-- Transactions
--   credit  : goods taken on udhaar   -> outstanding += amount
--   cash    : paid sale               -> no balance change
--   payment : customer paid back      -> outstanding -= amount
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id               text primary key default ('txn_' || replace(gen_random_uuid()::text, '-', '')),
  shop_id          text not null references shops(id) on delete cascade,
  customer_id      text references customers(id) on delete set null,   -- null = walk-in
  date             timestamptz not null default now(),
  amount           numeric(12,2) not null default 0,
  transaction_type text not null check (transaction_type in ('credit','cash','payment')),
  payment_status   text not null default 'pending'
                   check (payment_status in ('paid','pending','amount_missing')),
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists transactions_shop_date_idx on transactions(shop_id, date desc);
create index if not exists transactions_customer_idx on transactions(customer_id, date desc);

-- ---------------------------------------------------------------------------
-- Transaction items
-- ---------------------------------------------------------------------------
create table if not exists transaction_items (
  id             text primary key default ('item_' || replace(gen_random_uuid()::text, '-', '')),
  transaction_id text not null references transactions(id) on delete cascade,
  product_id     text references products(id) on delete set null,
  product_name   text,
  quantity       numeric(12,3) not null default 1,
  unit           text,
  price          numeric(12,2)          -- null = price not supplied (never invented)
);
create index if not exists transaction_items_txn_idx on transaction_items(transaction_id);

-- ---------------------------------------------------------------------------
-- Demo seed (matches the in-memory demo data)
-- ---------------------------------------------------------------------------
insert into shops (id, name, owner_name) values ('shop_demo_001', 'Sharma General Store', 'Rajesh')
on conflict (id) do nothing;

insert into products (shop_id, name, quantity, unit, price, minimum_stock) values
  ('shop_demo_001', 'Rice',        42, 'kg',     58,  15),
  ('shop_demo_001', 'Wheat',       30, 'kg',     34,  20),
  ('shop_demo_001', 'Sugar',        8, 'kg',     44,  10),
  ('shop_demo_001', 'Milk',         6, 'litre',  62,  12),
  ('shop_demo_001', 'Cooking Oil', 14, 'litre', 148,   6),
  ('shop_demo_001', 'Dal',          0, 'kg',    128,   8),
  ('shop_demo_001', 'Tea',         22, 'packet', 55,  10),
  ('shop_demo_001', 'Biscuits',     4, 'packet', 10,  20);

insert into customers (shop_id, name, father_name, phone, outstanding_balance) values
  ('shop_demo_001', 'Ramesh Kumar', 'Mohan Kumar',     '9876543210', 2450),
  ('shop_demo_001', 'Rahul Verma',  'Vikash Verma',    '9812345678',  800),
  ('shop_demo_001', 'Priya Sharma', 'Suresh Sharma',   '9898989898', 1500),
  ('shop_demo_001', 'Amit Singh',   'Rajendra Singh',  '9765432109',  400),
  ('shop_demo_001', 'Neha Gupta',   'Anil Gupta',      '9654321098',  600),
  ('shop_demo_001', 'Suresh Yadav', 'Ram Yadav',       '9543210987', 2000);

-- Row Level Security (recommended): enable and scope by shop_id via JWT claims.
-- alter table customers enable row level security;
-- create policy "shop scoped" on customers using (shop_id = auth.jwt() ->> 'shop_id');
