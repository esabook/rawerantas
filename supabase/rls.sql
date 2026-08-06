-- RLS — Tool Lomba Agustusan
-- SPA statis + anon key publik (ARCHITECTURE §6): RLS = pembatas akses,
-- bukan keamanan kuat. Apply via konsol Supabase (SQL Editor) atau service role.
-- JANGAN GRANT ALL — default role anon/authenticated sudah ter-grant di Supabase;
-- kebijakan RLS di bawah yang membatasi.

-- ============================================================
-- 1. Aktifkan RLS per tabel
-- ============================================================
alter table competitions enable row level security;
alter table payment_configs enable row level security;
alter table participants enable row level security;
alter table participant_payments enable row level security;
alter table scores_mancing enable row level security;
alter table scores_layangan enable row level security;
alter table scores_layangan_hias enable row level security;
alter table audit_logs enable row level security;

-- ============================================================
-- 2. SELECT publik (leaderboard, daftar lomba, config bayar, tiket)
-- ============================================================
create policy "competitions public read" on competitions
	for select using (true);

-- config pembayaran: hanya yang aktif tampil
create policy "payment_configs public read active" on payment_configs
	for select using (is_active = true);

create policy "participants public read" on participants
	for select using (true);

create policy "scores_mancing public read" on scores_mancing
	for select using (true);

create policy "scores_layangan public read" on scores_layangan
	for select using (true);

create policy "scores_layangan_hias public read" on scores_layangan_hias
	for select using (true);

-- ============================================================
-- 3. INSERT publik (registrasi + bukti bayar + skor juri)
--    Idempotency: unique index idempotency_key di sisi DB; retry = ON CONFLICT
-- ============================================================
create policy "participants public insert" on participants
	for insert with check (true);

create policy "participant_payments public insert" on participant_payments
	for insert with check (true);

create policy "scores_mancing public insert" on scores_mancing
	for insert with check (true);

create policy "scores_layangan public insert" on scores_layangan
	for insert with check (true);

create policy "scores_layangan_hias public insert" on scores_layangan_hias
	for insert with check (true);

-- ============================================================
-- 4. UPDATE terbatas (verifikasi admin + data lock)
--    Verifikasi bayar: HANYA kolom is_verified / verified_by yang boleh berubah.
--    Data lock (A7-04): matikan policy ini setelah acara — tanpa policy UPDATE,
--    RLS menolak semua perubahan.
-- ============================================================
create policy "payments admin verify columns" on participant_payments
	for update of is_verified, verified_by using (true) with check (true);

create policy "participants admin status columns" on participants
	for update of status, lapak_number using (true) with check (true);

-- skor hias edit window (edited_at + kriteria): admin/juri boleh koreksi
create policy "scores_hias admin edit window" on scores_layangan_hias
	for update of aesthetic, stability, creativity, edited_at using (true) with check (true);

-- ============================================================
-- 5. audit_logs — append-only: INSERT via client, tanpa UPDATE/DELETE policy.
--    Keberadaan policy = dijamin tidak bisa diubah/dihapus lewat API anon.
-- ============================================================
create policy "audit_logs public insert" on audit_logs
	for insert with check (true);

-- ============================================================
-- 6. Storage: bukti transfer (proof images)
--    Bucket `proof-images`: public-read, upload anon lewat client.
--    Buat bucket + policy di konsol: Storage → New bucket → public.
--    (Server-side policy utk storage TIDAK bisa dibuat lewat SQL ini —
--     gunakan UI konsol: Policies → New policy → SELECT public, INSERT anon.)
-- ============================================================
