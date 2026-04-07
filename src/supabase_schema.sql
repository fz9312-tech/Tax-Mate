-- ============================================================
-- Mise Supabase Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Businesses table ────────────────────────────────────────
-- One row per restaurant/cafe/bar
create table if not exists businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users not null,
  name        text not null default 'My Restaurant',
  abn         text default '',
  industry    text default 'restaurant',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Core data tables (jsonb — no schema migrations needed) ──
create table if not exists mise_revenue    (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_expenses   (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_employees  (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_timesheets (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_roster     (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_insurance  (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_leave      (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_ias        (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_bashistory (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_documents  (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists mise_inventory  (id bigserial primary key, business_id uuid references businesses on delete cascade, data jsonb not null, created_at timestamptz default now());

-- ── Each data table stores the ENTIRE array as ONE row ──────
-- (one row per business per table = simplest possible approach)
-- data = JSON array of all records, e.g. [{id:1, date:'2025-07-01', ...}, ...]
-- This means no complex queries needed — just read/write the whole array

-- ── Row Level Security ───────────────────────────────────────
alter table businesses    enable row level security;
alter table mise_revenue    enable row level security;
alter table mise_expenses   enable row level security;
alter table mise_employees  enable row level security;
alter table mise_timesheets enable row level security;
alter table mise_roster     enable row level security;
alter table mise_insurance  enable row level security;
alter table mise_leave      enable row level security;
alter table mise_ias        enable row level security;
alter table mise_bashistory enable row level security;
alter table mise_documents  enable row level security;
alter table mise_inventory  enable row level security;

-- Businesses: owner can only see/edit their own
create policy "owner_read"   on businesses for select using (owner_id = auth.uid());
create policy "owner_insert" on businesses for insert with check (owner_id = auth.uid());
create policy "owner_update" on businesses for update using (owner_id = auth.uid());
create policy "owner_delete" on businesses for delete using (owner_id = auth.uid());

-- Helper: check business belongs to current user
create or replace function is_my_business(bid uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from businesses where id = bid and owner_id = auth.uid());
$$;

-- Apply RLS to all data tables
do $$ declare t text; begin
  foreach t in array array[
    'mise_revenue','mise_expenses','mise_employees','mise_timesheets',
    'mise_roster','mise_insurance','mise_leave','mise_ias',
    'mise_bashistory','mise_documents','mise_inventory'
  ] loop
    execute format('create policy "biz_select" on %I for select using (is_my_business(business_id))', t);
    execute format('create policy "biz_insert" on %I for insert with check (is_my_business(business_id))', t);
    execute format('create policy "biz_update" on %I for update using (is_my_business(business_id))', t);
    execute format('create policy "biz_delete" on %I for delete using (is_my_business(business_id))', t);
  end loop;
end $$;

