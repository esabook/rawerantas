-- Supabase setup — Tool Lomba Agustusan
-- SPA statis + anon key publik (ARCHITECTURE §6): RLS = pembatas akses,
-- bukan keamanan kuat. Apply via Supabase Dashboard > SQL Editor.
-- Script ini idempotent: aman ditempel ulang, tidak men-drop data lomba.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. Schema tabel live
-- ============================================================
create table if not exists competitions (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	scoring_mode text not null check (
		scoring_mode in (
			'terberat',
			'kumulatif',
			'jackpot_pita',
			'layangan_aduan',
			'layangan_hias'
		)
	),
	fee integer not null default 0 check (fee >= 0),
	min_dp integer not null default 0 check (min_dp >= 0),
	total_quota integer not null default 0 check (total_quota >= 0),
	current_round integer not null default 1 check (current_round >= 1),
	is_active boolean not null default true,
	created_at timestamptz not null default now()
);

create table if not exists payment_configs (
	id uuid primary key default gen_random_uuid(),
	method text not null,
	account_name text,
	account_number text,
	qris_image_url text,
	instructions text,
	is_active boolean not null default true,
	created_at timestamptz not null default now()
);

create table if not exists sponsors (
	id uuid primary key default gen_random_uuid(),
	image_url text not null,
	url text not null,
	created_at timestamptz not null default now()
);

create table if not exists participants (
	id uuid primary key default gen_random_uuid(),
	competition_id uuid not null references competitions(id),
	ticket_number text not null unique,
	lapak_number text,
	name text not null,
	phone text not null,
	status text not null default 'registered' check (
		status in (
			'registered',
			'dp_paid',
			'fully_paid',
			'checked_in',
			'disqualified'
		)
	),
	checked_in_at timestamptz,
	created_at timestamptz not null default now()
);

create table if not exists participant_payments (
	id uuid primary key default gen_random_uuid(),
	participant_id uuid not null references participants(id) on delete restrict,
	amount integer not null check (amount >= 0),
	payment_method text not null,
	proof_image_url text,
	is_verified boolean not null default false,
	verified_by text,
	reject_reason text,
	created_at timestamptz not null default now()
);

create table if not exists scores_mancing (
	id uuid primary key default gen_random_uuid(),
	competition_id uuid not null references competitions(id),
	participant_id uuid not null references participants(id),
	fish_weight_gram integer not null check (fish_weight_gram > 0),
	fish_type text,
	is_jackpot boolean not null default false,
	running_total integer not null default 0,
	recorded_by text not null,
	idempotency_key uuid not null unique,
	received_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);

create table if not exists scores_layangan (
	id uuid primary key default gen_random_uuid(),
	competition_id uuid not null references competitions(id),
	participant_id uuid not null references participants(id),
	round integer not null check (round >= 1),
	status text not null check (status in ('mudun', 'putus', 'menang')),
	flight_duration_ms integer,
	recorded_by text not null,
	idempotency_key uuid not null unique,
	received_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);

create table if not exists scores_layangan_hias (
	id uuid primary key default gen_random_uuid(),
	competition_id uuid not null references competitions(id),
	participant_id uuid not null references participants(id),
	aesthetic integer not null check (aesthetic >= 0 and aesthetic <= 100),
	stability integer not null check (stability >= 0 and stability <= 100),
	creativity integer not null check (creativity >= 0 and creativity <= 100),
	total_weighted real generated always as (
		aesthetic * 0.4 + stability * 0.4 + creativity * 0.2
	) stored,
	recorded_by text not null,
	idempotency_key uuid not null unique,
	received_at timestamptz not null default now(),
	edited_at timestamptz,
	created_at timestamptz not null default now()
);

create table if not exists audit_logs (
	id uuid primary key default gen_random_uuid(),
	action text not null,
	entity_type text not null,
	entity_id text not null,
	actor_hash text not null,
	payload jsonb,
	idempotency_key uuid not null unique,
	created_at timestamptz not null default now()
);

alter table participants add column if not exists checked_in_at timestamptz;
alter table participant_payments add column if not exists reject_reason text;
alter table scores_layangan add column if not exists flight_duration_ms integer;
alter table scores_layangan_hias add column if not exists total_weighted real
	generated always as (
		aesthetic * 0.4 + stability * 0.4 + creativity * 0.2
	) stored;

create unique index if not exists participants_competition_phone_idx
	on participants (competition_id, phone);
create unique index if not exists scores_mancing_idempotency_idx
	on scores_mancing (idempotency_key);
create unique index if not exists scores_layangan_idempotency_idx
	on scores_layangan (idempotency_key);
create unique index if not exists scores_layangan_hias_idempotency_idx
	on scores_layangan_hias (idempotency_key);
create unique index if not exists scores_layangan_hias_participant_competition_idx
	on scores_layangan_hias (competition_id, participant_id);
create unique index if not exists audit_logs_idempotency_idx
	on audit_logs (idempotency_key);

-- ============================================================
-- 2. Storage bukti transfer
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'proof-images',
	'proof-images',
	true,
	5242880,
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
	public = true,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 3. Seed demo dasar live mode
-- ============================================================
insert into competitions (
	id,
	name,
	scoring_mode,
	fee,
	min_dp,
	total_quota,
	current_round,
	is_active,
	created_at
)
values
	(
		'00000000-0000-4000-8000-000000000001',
		'Mancing Lele',
		'terberat',
		50000,
		25000,
		50,
		1,
		true,
		'2026-08-16T07:00:00+07:00'
	),
	(
		'00000000-0000-4000-8000-000000000002',
		'Aduan Layangan',
		'layangan_aduan',
		30000,
		15000,
		40,
		1,
		true,
		'2026-08-16T07:00:00+07:00'
	),
	(
		'00000000-0000-4000-8000-000000000003',
		'Layangan Hias',
		'layangan_hias',
		25000,
		10000,
		30,
		1,
		true,
		'2026-08-16T07:00:00+07:00'
	)
on conflict (id) do update
set
	name = excluded.name,
	scoring_mode = excluded.scoring_mode,
	fee = excluded.fee,
	min_dp = excluded.min_dp,
	total_quota = excluded.total_quota,
	current_round = excluded.current_round,
	is_active = excluded.is_active;

insert into payment_configs (
	id,
	method,
	account_name,
	account_number,
	qris_image_url,
	instructions,
	is_active,
	created_at
)
values
	(
		'00000000-0000-4000-8000-000000002000',
		'bank_transfer',
		'Panitia Lomba',
		'1234567890',
		null,
		'Transfer ke rekening panitia, lalu upload bukti.',
		true,
		'2026-08-17T06:59:30+07:00'
	),
	(
		'00000000-0000-4000-8000-000000002001',
		'ewallet',
		'Panitia Lomba (OVO)',
		'081234567890',
		null,
		'Kirim via e-wallet, lalu upload bukti.',
		true,
		'2026-08-17T06:59:31+07:00'
	),
	(
		'00000000-0000-4000-8000-000000002002',
		'qris',
		null,
		null,
		null,
		'Scan QRIS panitia, lalu upload bukti.',
		true,
		'2026-08-17T06:59:32+07:00'
	),
	(
		'00000000-0000-4000-8000-000000002003',
		'cash',
		null,
		null,
		null,
		'Bayar tunai ke panitia di lokasi.',
		false,
		'2026-08-17T06:59:33+07:00'
	)
on conflict (id) do update
set
	method = excluded.method,
	account_name = excluded.account_name,
	account_number = excluded.account_number,
	qris_image_url = excluded.qris_image_url,
	instructions = excluded.instructions,
	is_active = excluded.is_active;

-- ============================================================
-- 4. RLS policies
-- ============================================================
alter table competitions enable row level security;
alter table payment_configs enable row level security;
alter table sponsors enable row level security;
alter table participants enable row level security;
alter table participant_payments enable row level security;
alter table scores_mancing enable row level security;
alter table scores_layangan enable row level security;
alter table scores_layangan_hias enable row level security;
alter table audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select on
	competitions,
	payment_configs,
	sponsors,
	participants,
	participant_payments,
	scores_mancing,
	scores_layangan,
	scores_layangan_hias
to anon, authenticated;
grant insert on
	sponsors,
	participants,
	participant_payments,
	scores_mancing,
	scores_layangan,
	scores_layangan_hias,
	audit_logs
to anon, authenticated;
grant delete on sponsors, scores_mancing, scores_layangan
to anon, authenticated;

revoke update on
	competitions,
	payment_configs,
	participants,
	participant_payments,
	scores_layangan_hias
from anon, authenticated;
grant update (name, fee, total_quota, scoring_mode, is_active, current_round)
	on competitions to anon, authenticated;
grant update (account_name, account_number, qris_image_url, instructions, is_active)
	on payment_configs to anon, authenticated;
grant update on sponsors to anon, authenticated;
grant update (status, lapak_number, checked_in_at)
	on participants to anon, authenticated;
grant update (is_verified, verified_by, reject_reason)
	on participant_payments to anon, authenticated;
grant update (aesthetic, stability, creativity, edited_at, recorded_by)
	on scores_layangan_hias to anon, authenticated;

drop policy if exists "competitions public read" on competitions;
create policy "competitions public read" on competitions
	for select using (true);

drop policy if exists "payment_configs public read active" on payment_configs;
create policy "payment_configs public read active" on payment_configs
	for select using (is_active = true);

drop policy if exists "sponsors public read" on sponsors;
create policy "sponsors public read" on sponsors
	for select using (true);

drop policy if exists "sponsors public insert" on sponsors;
create policy "sponsors public insert" on sponsors
	for insert with check (true);

drop policy if exists "sponsors public update" on sponsors;
create policy "sponsors public update" on sponsors
	for update using (true) with check (true);

drop policy if exists "sponsors public delete" on sponsors;
create policy "sponsors public delete" on sponsors
	for delete using (true);

drop policy if exists "participants public read" on participants;
create policy "participants public read" on participants
	for select using (true);

drop policy if exists "scores_mancing public read" on scores_mancing;
create policy "scores_mancing public read" on scores_mancing
	for select using (true);

drop policy if exists "scores_layangan public read" on scores_layangan;
create policy "scores_layangan public read" on scores_layangan
	for select using (true);

drop policy if exists "scores_layangan_hias public read" on scores_layangan_hias;
create policy "scores_layangan_hias public read" on scores_layangan_hias
	for select using (true);

drop policy if exists "participants public insert" on participants;
create policy "participants public insert" on participants
	for insert with check (true);

drop policy if exists "participant_payments public insert" on participant_payments;
create policy "participant_payments public insert" on participant_payments
	for insert with check (true);

drop policy if exists "scores_mancing public insert" on scores_mancing;
create policy "scores_mancing public insert" on scores_mancing
	for insert with check (true);

drop policy if exists "scores_layangan public insert" on scores_layangan;
create policy "scores_layangan public insert" on scores_layangan
	for insert with check (true);

drop policy if exists "scores_layangan_hias public insert" on scores_layangan_hias;
create policy "scores_layangan_hias public insert" on scores_layangan_hias
	for insert with check (true);

drop policy if exists "payments admin verify columns" on participant_payments;
create policy "payments admin verify columns" on participant_payments
	for update
	using (true) with check (true);

drop policy if exists "participants admin status columns" on participants;
create policy "participants admin status columns" on participants
	for update
	using (true) with check (true);

drop policy if exists "scores_hias admin edit window" on scores_layangan_hias;
create policy "scores_hias admin edit window" on scores_layangan_hias
	for update
	using (true) with check (true);

drop policy if exists "competitions admin update" on competitions;
create policy "competitions admin update" on competitions
	for update
	using (true) with check (true);

drop policy if exists "payment_configs admin update" on payment_configs;
create policy "payment_configs admin update" on payment_configs
	for update
	using (true) with check (true);

drop policy if exists "scores_mancing undo delete" on scores_mancing;
create policy "scores_mancing undo delete" on scores_mancing
	for delete using (true);

drop policy if exists "scores_layangan undo delete" on scores_layangan;
create policy "scores_layangan undo delete" on scores_layangan
	for delete using (true);

drop policy if exists "audit_logs public insert" on audit_logs;
create policy "audit_logs public insert" on audit_logs
	for insert with check (true);

drop policy if exists "proof_images public read" on storage.objects;
create policy "proof_images public read" on storage.objects
	for select to public
	using (bucket_id = 'proof-images');

drop policy if exists "proof_images anon insert" on storage.objects;
create policy "proof_images anon insert" on storage.objects
	for insert to anon
	with check (bucket_id = 'proof-images');
