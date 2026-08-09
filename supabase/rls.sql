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
	status text not null check (status in ('mudun', 'putus', 'menang', 'dq')),
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

-- B1-1 (F14/F24/A19): idempotensi pembayaran — tambah kolom, backfill baris
-- lama, lalu NOT NULL + index unik. Urutan wajib agar aman di tabel berisi data.
alter table participant_payments add column if not exists idempotency_key uuid;
update participant_payments
set idempotency_key = gen_random_uuid()
where idempotency_key is null;
alter table participant_payments alter column idempotency_key set not null;

create unique index if not exists participants_competition_phone_idx
	on participants (competition_id, phone);
create unique index if not exists participant_payments_idempotency_idx
	on participant_payments (idempotency_key);
create unique index if not exists scores_mancing_idempotency_idx
	on scores_mancing (idempotency_key);
create unique index if not exists scores_layangan_idempotency_idx
	on scores_layangan (idempotency_key);
-- B3-4/A6: satu hasil per (kompetisi, peserta, babak) — cegah dobel-win
-- multi-device.
create unique index if not exists scores_layangan_participant_round_idx
	on scores_layangan (competition_id, participant_id, round);
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

-- UPDATE: grant penuh (bukan kolom-level) biar tidak ada miss "kolom lupa di-grant".
-- Kolom lonjakan (created_at, id, total_weighted) tetap aman karena kode tidak
-- pernah mengupdate-nya; RLS policy tetap membatasi baris via using(true).
revoke update on
	competitions,
	payment_configs,
	participants,
	participant_payments,
	scores_layangan_hias
from anon, authenticated;
grant update on
	competitions,
	payment_configs,
	participants,
	participant_payments,
	scores_layangan_hias
to anon, authenticated;

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

drop policy if exists "participant_payments public read" on participant_payments;
create policy "participant_payments public read" on participant_payments
	for select using (true);

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

-- ============================================================
-- 5. RPC tulis (Batch 1) — tulis lewat fungsi, bukan akses tabel langsung
-- ============================================================

-- B1-1 (F14, F24, A19, F9): satu-satunya cara membuat pembayaran.
-- - Ownership: bila p_phone diberikan, harus cocok participants.phone
--   (p_phone NULL = check dilewati; diaktifkan bertahap saat caller mengirimnya).
-- - Validasi nominal dipindah dari client (validateAmount): amount = fee
--   dianggap pelunasan; selain itu wajib >= min_dp dan kelipatan 500.
-- - ON CONFLICT (idempotency_key) DO NOTHING → retry/drain idempoten;
--   baris existing dikembalikan (menggantikan draft-restore rapuh, F24).
-- - Status peserta dihitung ulang dari total pembayaran TERVERIFIKASI
--   (server-side, bukan optimistik — memperbaiki F5; transaksi tunggal
--   insert+status menutup F9).
create or replace function submit_payment(
	p_participant_id uuid,
	p_method text,
	p_amount integer,
	p_proof_url text,
	p_is_cash boolean default false,
	p_idempotency_key uuid default gen_random_uuid(),
	p_phone text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_participant participants%rowtype;
	v_fee integer;
	v_min_dp integer;
	v_payment_id uuid;
	v_verified_total integer;
	v_new_status text;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	select * into v_participant from participants where id = p_participant_id;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'participant_not_found');
	end if;
	if p_phone is not null and v_participant.phone is distinct from p_phone then
		return jsonb_build_object('ok', false, 'reason', 'phone_mismatch');
	end if;
	if v_participant.status = 'disqualified' then
		return jsonb_build_object('ok', false, 'reason', 'disqualified');
	end if;

	select coalesce(fee, 0), coalesce(min_dp, 0)
	into v_fee, v_min_dp
	from competitions
	where id = v_participant.competition_id;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'competition_not_found');
	end if;

	if p_amount is null or p_amount <= 0 then
		return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
	end if;
	if p_amount <> v_fee then
		if p_amount < v_min_dp then
			return jsonb_build_object('ok', false, 'reason', 'below_min_dp');
		end if;
		if p_amount % 500 <> 0 then
			return jsonb_build_object('ok', false, 'reason', 'bad_increment');
		end if;
	end if;

	insert into participant_payments (
		participant_id,
		amount,
		payment_method,
		proof_image_url,
		is_verified,
		idempotency_key
	) values (
		p_participant_id,
		p_amount,
		p_method,
		p_proof_url,
		coalesce(p_is_cash, false),
		p_idempotency_key
	)
	on conflict (idempotency_key) do nothing
	returning id into v_payment_id;

	if v_payment_id is null then
		-- Duplikat idempotency: kembalikan baris yang sudah ada.
		select id into v_payment_id
		from participant_payments
		where idempotency_key = p_idempotency_key;
		return jsonb_build_object(
			'ok', true,
			'paymentId', v_payment_id,
			'duplicate', true
		);
	end if;

	-- Recalc status dari total terverifikasi; baris baru non-tunai (belum
	-- verified) tidak mengubah status; tunai (verified saat insert) bisa naik.
	if v_participant.status <> 'checked_in' then
		select coalesce(sum(amount), 0) into v_verified_total
		from participant_payments
		where participant_id = p_participant_id
			and is_verified = true
			and (reject_reason is null or trim(reject_reason) = '');
		v_new_status := case
			when v_verified_total >= v_fee then 'fully_paid'
			when v_verified_total >= v_min_dp then 'dp_paid'
			else 'registered'
		end;
		update participants set status = v_new_status
		where id = p_participant_id;
	end if;

	return jsonb_build_object('ok', true, 'paymentId', v_payment_id);
end;
$$;

grant execute on function submit_payment(uuid, text, integer, text, boolean, uuid, text)
	to anon, authenticated;

-- B1-2 (F8, F17): jalur perbaiki/kirim ulang pembayaran yang ditolak atau
-- masih pending. Kepemilikan via p_phone (bila diberikan); hanya baris yang
-- BELUM terverifikasi yang boleh diubah; reset reject + perbarui nominal/bukti;
-- tulis audit_logs. Riwayat penolakan tetap terbaca lewat audit, baris tidak
-- bertumpuk.
create or replace function resubmit_payment(
	p_payment_id uuid,
	p_amount integer,
	p_proof_url text,
	p_phone text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_payment participant_payments%rowtype;
	v_participant participants%rowtype;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	select * into v_payment from participant_payments where id = p_payment_id;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'payment_not_found');
	end if;
	if v_payment.is_verified then
		return jsonb_build_object('ok', false, 'reason', 'already_verified');
	end if;
	if p_amount is null or p_amount <= 0 then
		return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
	end if;

	select * into v_participant from participants where id = v_payment.participant_id;
	if p_phone is not null and v_participant.phone is distinct from p_phone then
		return jsonb_build_object('ok', false, 'reason', 'phone_mismatch');
	end if;

	update participant_payments
	set amount = p_amount,
		proof_image_url = p_proof_url,
		is_verified = false,
		verified_by = null,
		reject_reason = null
	where id = p_payment_id;

	insert into audit_logs (action, entity_type, entity_id, actor_hash, payload, idempotency_key)
	values (
		'resubmit_payment',
		'participant_payments',
		p_payment_id::text,
		'guest',
		jsonb_build_object('amount', p_amount),
		gen_random_uuid()
	);

	return jsonb_build_object('ok', true);
end;
$$;

grant execute on function resubmit_payment(uuid, integer, text, text)
	to anon, authenticated;

-- Helper internal: hitung ulang participants.status dari total pembayaran
-- TERVERIFIKASI (F5/A2). Tidak menimpa status disqualified/checked_in.
create or replace function _recalc_participant_status(p_participant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_fee integer;
	v_min_dp integer;
	v_total integer;
	v_status text;
begin
	select coalesce(c.fee, 0), coalesce(c.min_dp, 0)
	into v_fee, v_min_dp
	from participants pr
	join competitions c on c.id = pr.competition_id
	where pr.id = p_participant;
	if not found then
		return;
	end if;
	select coalesce(sum(amount), 0) into v_total
	from participant_payments
	where participant_id = p_participant
		and is_verified = true
		and (reject_reason is null or trim(reject_reason) = '');
	v_status := case
		when v_total >= v_fee then 'fully_paid'
		when v_total >= v_min_dp then 'dp_paid'
		else 'registered'
	end;
	update participants set status = v_status
	where id = p_participant
		and status not in ('disqualified', 'checked_in');
end;
$$;

-- B1-3 (F5, A2, A33, A34): verifikasi admin jadi RPC. Guard state (hanya
-- pending/ditolak boleh diverifikasi; tidak bisa verifikasi ulang baris
-- verified), guard bukti non-tunai, recalc status peserta, dan audit ditulis
-- dalam SATU transaksi (menutup A34 — tak ada error pasca-mutasi).
create or replace function verify_payment(
	p_payment_id uuid,
	p_actor_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_payment participant_payments%rowtype;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	select * into v_payment
	from participant_payments
	where id = p_payment_id
	for update;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'payment_not_found');
	end if;
	if v_payment.is_verified then
		return jsonb_build_object('ok', false, 'reason', 'already_verified');
	end if;
	if v_payment.payment_method <> 'cash'
		and (v_payment.proof_image_url is null or trim(v_payment.proof_image_url) = '') then
		return jsonb_build_object('ok', false, 'reason', 'no_proof');
	end if;

	update participant_payments
	set is_verified = true,
		verified_by = p_actor_hash,
		reject_reason = null
	where id = p_payment_id;

	perform _recalc_participant_status(v_payment.participant_id);

	insert into audit_logs (action, entity_type, entity_id, actor_hash, payload, idempotency_key)
	values (
		'verify_payment',
		'participant_payments',
		p_payment_id::text,
		p_actor_hash,
		jsonb_build_object('participantId', v_payment.participant_id, 'amount', v_payment.amount),
		gen_random_uuid()
	);

	return jsonb_build_object('ok', true);
end;
$$;

create or replace function reject_payment(
	p_payment_id uuid,
	p_actor_hash text,
	p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_payment participant_payments%rowtype;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	if p_reason is null or trim(p_reason) = '' then
		return jsonb_build_object('ok', false, 'reason', 'invalid_reason');
	end if;
	select * into v_payment
	from participant_payments
	where id = p_payment_id
	for update;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'payment_not_found');
	end if;
	if v_payment.is_verified then
		return jsonb_build_object('ok', false, 'reason', 'already_verified');
	end if;

	update participant_payments
	set is_verified = false,
		verified_by = null,
		reject_reason = p_reason
	where id = p_payment_id;

	perform _recalc_participant_status(v_payment.participant_id);

	insert into audit_logs (action, entity_type, entity_id, actor_hash, payload, idempotency_key)
	values (
		'reject_payment',
		'participant_payments',
		p_payment_id::text,
		p_actor_hash,
		jsonb_build_object('participantId', v_payment.participant_id, 'reason', p_reason),
		gen_random_uuid()
	);

	return jsonb_build_object('ok', true);
end;
$$;

grant execute on function verify_payment(uuid, text) to anon, authenticated;
grant execute on function reject_payment(uuid, text, text) to anon, authenticated;

-- Sequence tiket peserta — bebas kolisi Date.now()%1M (F2), format kanonik T-.
create sequence if not exists participant_ticket_seq;

-- B1-4 (F1, F2, F3, F12, A16): registrasi peserta via RPC. Kuota direservasi
-- atomik (fast-path dedupe dulu agar double-tap tidak membuang slot), nomor
-- tiket dari sequence, dedupe idempoten via ON CONFLICT (competition_id, phone).
create or replace function register_participant(
	p_competition uuid,
	p_name text,
	p_phone text,
	p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_existing participants%rowtype;
	v_competition_name text;
	v_ticket text;
	v_inserted boolean;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	if p_name is null or trim(p_name) = '' then
		return jsonb_build_object('ok', false, 'reason', 'invalid_name');
	end if;
	if p_phone is null or trim(p_phone) = '' then
		return jsonb_build_object('ok', false, 'reason', 'invalid_phone');
	end if;

	-- Fast path: sudah terdaftar utk lomba ini (double-tap umum) — tanpa
	-- membuang slot kuota.
	select * into v_existing
	from participants
	where competition_id = p_competition and phone = p_phone;
	if found then
		return jsonb_build_object(
			'ok', true,
			'participantId', v_existing.id,
			'ticketNumber', v_existing.ticket_number,
			'duplicated', true
		);
	end if;

	-- Reservasi kuota atomik (F1/A16): decrement hanya bila masih ada slot.
	update competitions set total_quota = total_quota - 1
	where id = p_competition and total_quota > 0
	returning name into v_competition_name;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'quota_full');
	end if;

	-- Nomor tiket dari sequence global (F2).
	v_ticket := 'T-' || lpad(nextval('participant_ticket_seq')::text, 6, '0');

	-- Dedupe idempoten (F3): bila ada race pendaftaran nomor sama, kembalikan
	-- baris existing (slot yang sudah direservasi barusan jadi terbuang — kasus
	-- ekstrem concurrency, diterima).
	insert into participants (competition_id, name, phone, ticket_number, status)
	values (p_competition, trim(p_name), p_phone, v_ticket, 'registered')
	on conflict (competition_id, phone)
	do update set id = participants.id
	returning id, ticket_number, (xmax = 0) as inserted
	into v_existing.id, v_ticket, v_inserted;

	if not v_inserted then
		return jsonb_build_object(
			'ok', true,
			'participantId', v_existing.id,
			'ticketNumber', v_ticket,
			'duplicated', true
		);
	end if;

	return jsonb_build_object(
		'ok', true,
		'participantId', v_existing.id,
		'ticketNumber', v_ticket,
		'duplicated', false
	);
end;
$$;

grant execute on function register_participant(uuid, text, text, uuid)
	to anon, authenticated;

-- B1-5 (F7, A21, A22): check-in via RPC — eligibility dicek ulang di server
-- (status, diskualifikasi, pembayaran ditolak, minimal DP), set checked_in +
-- audit dalam satu transaksi; pelaku (p_recorded_by) disimpan di audit.
create or replace function check_in(
	p_participant_id uuid,
	p_recorded_by text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_participant participants%rowtype;
	v_min_dp integer;
	v_total integer;
	v_rejected boolean;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	select * into v_participant
	from participants
	where id = p_participant_id
	for update;
	if not found then
		return jsonb_build_object('ok', false, 'reason', 'participant_not_found');
	end if;
	if v_participant.status = 'disqualified' then
		return jsonb_build_object('ok', false, 'reason', 'disqualified');
	end if;
	if v_participant.status = 'checked_in' then
		return jsonb_build_object('ok', true, 'already', true);
	end if;

	select exists (
		select 1 from participant_payments
		where participant_id = p_participant_id
			and is_verified = false
			and reject_reason is not null
			and trim(reject_reason) <> ''
	) into v_rejected;
	if v_rejected then
		return jsonb_build_object('ok', false, 'reason', 'payment_rejected');
	end if;

	select coalesce(min_dp, 0) into v_min_dp
	from competitions
	where id = v_participant.competition_id;
	select coalesce(sum(amount), 0) into v_total
	from participant_payments
	where participant_id = p_participant_id
		and is_verified = true
		and (reject_reason is null or trim(reject_reason) = '');
	if v_total < v_min_dp then
		return jsonb_build_object('ok', false, 'reason', 'not_eligible');
	end if;

	update participants
	set status = 'checked_in', checked_in_at = now()
	where id = p_participant_id;

	insert into audit_logs (action, entity_type, entity_id, actor_hash, payload, idempotency_key)
	values (
		'check_in',
		'participants',
		p_participant_id::text,
		coalesce(p_recorded_by, 'guest'),
		jsonb_build_object('participantId', p_participant_id),
		gen_random_uuid()
	);

	return jsonb_build_object('ok', true);
end;
$$;

grant execute on function check_in(uuid, text) to anon, authenticated;

-- B1-7 (A18 lanjutan, pasangan A25): undo skor via RPC ber-audit — pengganti
-- DELETE publik. Hapus via id (UUID baris) atau idempotency_key (undo jalur
-- antrean pasca-drain); tabel di-whitelist; tulis audit_logs.
create or replace function delete_score(
	p_table text,
	p_score_id uuid default null,
	p_idempotency_key uuid default null,
	p_actor_hash text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_deleted integer;
begin
	if data_lock_is_locked() then
		return jsonb_build_object('ok', false, 'reason', 'locked');
	end if;
	if p_table not in ('scores_mancing', 'scores_layangan') then
		return jsonb_build_object('ok', false, 'reason', 'invalid_table');
	end if;
	if p_score_id is null and p_idempotency_key is null then
		return jsonb_build_object('ok', false, 'reason', 'no_key');
	end if;

	if p_table = 'scores_mancing' then
		if p_score_id is not null then
			delete from scores_mancing where id = p_score_id;
		else
			delete from scores_mancing where idempotency_key = p_idempotency_key;
		end if;
	else
		if p_score_id is not null then
			delete from scores_layangan where id = p_score_id;
		else
			delete from scores_layangan where idempotency_key = p_idempotency_key;
		end if;
	end if;
	get diagnostics v_deleted = row_count;

	insert into audit_logs (action, entity_type, entity_id, actor_hash, payload, idempotency_key)
	values (
		'delete_score',
		p_table,
		coalesce(p_score_id::text, p_idempotency_key::text),
		coalesce(p_actor_hash, 'guest'),
		jsonb_build_object('deleted', v_deleted),
		gen_random_uuid()
	);

	return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

grant execute on function delete_score(text, uuid, uuid, text) to anon, authenticated;

create policy "proof_images anon insert" on storage.objects
	for insert to anon
	with check (bucket_id = 'proof-images');
-- ============================================================
-- 7. Data lock pasca-acara (B1-8) — A17
-- Lock memblokir SEMUA tulis setelah acara selesai. Tabel single-row;
-- setiap RPC tulis (B1-1..B1-7) menolak saat terkunci lewat data_lock_is_locked().
-- ============================================================
create table if not exists data_lock (
	singleton boolean primary key default true check (singleton = true),
	is_locked boolean not null default false,
	locked_at timestamptz,
	locked_by text,
	created_at timestamptz not null default now()
);
insert into data_lock (singleton) values (true) on conflict do nothing;

create or replace function data_lock_is_locked() returns boolean
language sql security definer set search_path = public
as $$
	select is_locked from data_lock where singleton = true;
$$;

-- Setel/lepas lock (admin, ber-PIN via actor_hash) + audit.
create or replace function set_data_lock(
	p_locked boolean,
	p_actor_hash text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
	update data_lock
	set is_locked = p_locked,
		locked_at = case when p_locked then now() else null end,
		locked_by = case when p_locked then coalesce(p_actor_hash, 'guest') else null end
	where singleton = true;

	insert into audit_logs (action, entity_type, entity_id, actor_hash, payload, idempotency_key)
	values (
		'data_lock',
		'app_settings',
		'data_lock',
		coalesce(p_actor_hash, 'guest'),
		jsonb_build_object('locked', p_locked),
		gen_random_uuid()
	);

	return jsonb_build_object('ok', true, 'locked', p_locked);
end;
$$;

grant execute on function data_lock_is_locked() to anon, authenticated;
grant execute on function set_data_lock(boolean, text) to anon, authenticated;
-- ============================================================
-- 6. Cabut tulis publik yang kini lewat RPC (B1-6) — F4, A18
--    Urutan: RPC B1-1..B1-5 & B1-7 sudah siap → baru dicabut di sini.
--    Sisa tulis publik yang TIDAK dicabut (belum ada RPC-nya, dicatat
--    carryover): scores/hias INSERT (submit skor), sponsors CRUD,
--    competitions & payment_configs UPDATE, participants UPDATE (undoCheckIn),
--    audit_logs INSERT — semua dijalankan klien; RPC-nya menyusul di batch
--    berikut (B3-4 hias, B4-* sponsor, dll).
-- ============================================================

-- Pembayaran: INSERT & UPDATE kini via RPC submit_/resubmit_/verify_/reject_payment.
drop policy if exists "participant_payments public insert" on participant_payments;
drop policy if exists "payments admin verify columns" on participant_payments;

-- Registrasi: INSERT peserta via RPC register_participant.
drop policy if exists "participants public insert" on participants;

-- Skor undo: DELETE via RPC delete_score (ber-audit).
drop policy if exists "scores_mancing undo delete" on scores_mancing;
drop policy if exists "scores_layangan undo delete" on scores_layangan;
revoke delete on scores_mancing, scores_layangan
	from anon, authenticated;

-- B4-3/A30: jalur admin membaca SEMUA payment_configs (termasuk non-aktif)
-- melewati RLS select is_active=true — SECURITY DEFINER.
create or replace function get_payment_configs(p_active_only boolean default true)
returns table (
	id uuid,
	method text,
	account_name text,
	account_number text,
	qris_image_url text,
	instructions text,
	is_active boolean,
	created_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
	if p_active_only then
		return query
			select pc.id, pc.method, pc.account_name, pc.account_number,
				   pc.qris_image_url, pc.instructions, pc.is_active, pc.created_at
			from payment_configs pc
			where pc.is_active = true
			order by pc.created_at asc;
	else
		return query
			select pc.id, pc.method, pc.account_name, pc.account_number,
				   pc.qris_image_url, pc.instructions, pc.is_active, pc.created_at
			from payment_configs pc
			order by pc.created_at asc;
	end if;
end;
$$;

grant execute on function get_payment_configs(boolean) to anon, authenticated;
-- ============================================================
-- 8. Realtime publication (B3-7/A35) — langkah deployment wajib
--    Tanpa ini postgres_changes di display/leaderboard tak pernah menyala.
-- ============================================================
alter publication supabase_realtime add table
	scores_mancing,
	scores_layangan,
	scores_layangan_hias,
	participants,
	competitions;