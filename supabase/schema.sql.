-- DRIPCTRL store schema for Supabase.
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

-- Products (prices are checked on the server when an order is placed)
create table if not exists public.products (
  id text primary key,
  name text not null,
  price integer not null check (price > 0)
);
insert into public.products (id, name, price) values
  ('thorn', 'THORN//RELIC', 999),
  ('cross', 'SILENT//CROSS', 699)
on conflict (id) do update set name = excluded.name, price = excluded.price;
alter table public.products enable row level security;
drop policy if exists "products are public" on public.products;
create policy "products are public" on public.products for select using (true);

-- Customer profiles (username + avatar)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (char_length(username) between 2 and 40),
  pic text check (pic is null or char_length(pic) < 200000),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Orders (created only through place_order, readable by their owner)
create table if not exists public.orders (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  items jsonb not null,
  total integer not null,
  status text not null default 'Pending payment',
  created_at timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);
alter table public.orders enable row level security;
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders for select using (auth.uid() = user_id);

create or replace function public.place_order(items jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t integer := 0;
  it jsonb;
  p integer;
  oid text;
  clean jsonb := '[]'::jsonb;
  r public.orders;
begin
  if uid is null then raise exception 'Sign in to place an order'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 or jsonb_array_length(items) > 20 then
    raise exception 'Invalid cart';
  end if;
  for it in select * from jsonb_array_elements(items) loop
    select price into p from public.products where id = it->>'id';
    if p is null or coalesce(it->>'size', '') not in ('S', 'M', 'L', 'XL')
       or coalesce(it->>'qty', '') !~ '^\d{1,2}$' or (it->>'qty')::int not between 1 and 20 then
      raise exception 'Invalid cart item';
    end if;
    t := t + p * (it->>'qty')::int;
    clean := clean || jsonb_build_object('id', it->>'id', 'size', it->>'size', 'qty', (it->>'qty')::int);
  end loop;
  oid := 'DC-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
  insert into public.orders (id, user_id, items, total) values (oid, uid, clean, t) returning * into r;
  return to_jsonb(r) - 'user_id';
end $$;

-- Order tracking by ID (works for anyone with the ID; returns no personal data)
create or replace function public.track_order(order_id text)
returns jsonb
language sql security definer set search_path = public
as $$
  select to_jsonb(o) - 'user_id' from public.orders o where o.id = upper(trim(order_id));
$$;

revoke execute on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;
grant execute on function public.track_order(text) to anon, authenticated;

-- Email list
create table if not exists public.subscribers (
  id bigint generated always as identity primary key,
  email text not null unique check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists "anyone can subscribe" on public.subscribers;
create policy "anyone can subscribe" on public.subscribers for insert to anon, authenticated with check (true);

-- Contact messages
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text check (char_length(name) <= 100),
  email text check (char_length(email) <= 254),
  message text not null check (char_length(message) between 1 and 5000),
  user_id uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists "anyone can send a message" on public.contact_messages;
create policy "anyone can send a message" on public.contact_messages for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
