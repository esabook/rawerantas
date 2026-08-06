# Supabase — RLS & Storage Setup

Panduan apply — **butuh akses konsol Supabase / service role key** (human
queue, lihat TASKS.md → "Antrean manusia").

## 1. Apply RLS

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → proyek kamu.
2. **SQL Editor** → paste isi [`rls.sql`](./rls.sql) → **Run**.
3. Verifikasi: **Table Editor** → tiap tabel → tab *RLS* → pastikan *RLS
   enabled* + policy tercantum.

## 2. Buat bucket Storage `proof-images`

1. **Storage** → **New bucket** → nama `proof-images` → centang *Public*.
2. **Policies** → *New policy* → `SELECT` untuk `public` (read tiket/admin),
   `INSERT` untuk `anon` (upload bukti dari klien).
3. Upload bukti transfer dari app → URL `public/proof-images/<uuid>.jpg`.

## 3. Checklist policies

- [ ] `competitions` — RLS on, `SELECT` publik
- [ ] `payment_configs` — RLS on, `SELECT` hanya `is_active = true`
- [ ] `participants` — RLS on, `SELECT` publik, `INSERT` publik,
      `UPDATE of status, lapak_number`
- [ ] `participant_payments` — RLS on, `INSERT` publik,
      `UPDATE of is_verified, verified_by`
- [ ] `scores_mancing` — RLS on, `SELECT` + `INSERT` publik
- [ ] `scores_layangan` — RLS on, `SELECT` + `INSERT` publik
- [ ] `scores_layangan_hias` — RLS on, `SELECT` + `INSERT` publik,
      `UPDATE of aesthetic, stability, creativity, edited_at` (edit window)
- [ ] `audit_logs` — RLS on, `INSERT` saja (append-only; TANPA policy UPDATE/DELETE)
- [ ] Bucket `proof-images` — public read, anon insert
- [ ] Uji: query anon (URL API) bisa SELECT leaderboard, gagal UPDATE skor
- [ ] Setelah acara: hapus policy UPDATE (data lock, A7-04)

## 4. Catatan keamanan

- `recorded_by` / `verified_by` = SHA-256 hash PIN (bukan PIN mentah).
- RLS + anon key = **pembatas UX, bukan keamanan sungguhan** — residual risk
  tercatat di `doc/ARCHITECTURE.md` §6.
