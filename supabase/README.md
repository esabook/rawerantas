# Supabase — Demo Setup

Panduan apply — **butuh akses konsol Supabase**. PIN tidak perlu diubah untuk
demo; biarkan nilai `PUBLIC_*_PIN` yang sudah ada.

## 1. Apply setup SQL

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → proyek kamu.
2. **SQL Editor** → paste isi [`rls.sql`](./rls.sql) → **Run**.
3. Script ini membuat/melengkapi tabel, index, RLS policy, bucket
   `proof-images`, dan seed demo dasar (`competitions`, `payment_configs`).
4. Aman dijalankan ulang: data peserta/skor/pembayaran tidak dihapus.

## 2. Verifikasi cepat

1. **Table Editor** → `competitions` berisi 3 lomba demo.
2. **Table Editor** → tiap tabel utama menampilkan RLS enabled.
3. **Storage** → bucket `proof-images` ada dan public.
4. Upload bukti transfer dari app menghasilkan URL bucket `proof-images`.

## 3. Cloudflare Pages env

Build Pages cukup pakai subdomain bawaan:

```env
PUBLIC_BASE_URL="https://<nama-project>.pages.dev"
PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
PUBLIC_ENABLE_DEMO_MODE="true"
```

PIN biarkan dulu untuk demo. Setelah env diubah di Pages, lakukan rebuild.

## 4. Checklist policies

- [ ] `competitions` — RLS on, `SELECT` publik, `UPDATE` kolom config
- [ ] `payment_configs` — RLS on, `SELECT` hanya `is_active = true`,
      `UPDATE` kolom instruksi
- [ ] `sponsors` — RLS on, `SELECT` publik, write untuk panel admin demo
- [ ] `participants` — RLS on, `SELECT` publik, `INSERT` publik,
      `UPDATE` kolom `status`, `lapak_number`, `checked_in_at`
- [ ] `participant_payments` — RLS on, `INSERT` publik,
      `UPDATE` kolom `is_verified`, `verified_by`, `reject_reason`
- [ ] `scores_mancing` — RLS on, `SELECT` + `INSERT` publik
- [ ] `scores_layangan` — RLS on, `SELECT` + `INSERT` publik
- [ ] `scores_layangan_hias` — RLS on, `SELECT` + `INSERT` publik,
      `UPDATE` kolom nilai + `edited_at` + `recorded_by` (edit window)
- [ ] `audit_logs` — RLS on, `INSERT` saja (append-only; TANPA policy UPDATE/DELETE)
- [ ] Bucket `proof-images` — public read, anon insert
- [ ] Uji: query anon bisa SELECT leaderboard, upload bukti, dan daftar peserta
- [ ] Setelah acara: hapus policy UPDATE (data lock, A7-04)

## 5. Catatan keamanan

- `recorded_by` / `verified_by` = SHA-256 hash PIN (bukan PIN mentah).
- RLS + anon key = **pembatas UX, bukan keamanan sungguhan** — residual risk
  tercatat di `doc/ARCHITECTURE.md` §6.
