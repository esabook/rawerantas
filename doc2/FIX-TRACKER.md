# FIX-TRACKER — Eksekusi Perbaikan Temuan doc2/

> Sumber kebenaran tunggal eksekusi. State hidup di file ini + `git log` + `doc/JOURNAL.md` —
> **tidak pernah di context sesi**. Sesi baru melanjutkan dengan membaca file ini dulu (rekonsiliasi).
> Temuan: `PESERTA-FLOW-REVIEW.md` (F1–F25) & `ADMIN-PANITIA-JURI-REVIEW.md` (A1–A41).
> Eksekutor: skill `/rawe3`. Audit ulang (bila kode berubah): skill `/rawe2`.

---

## Protokol anti-drift / miss / gap

### Anti-DRIFT (pekerjaan menyimpang dari temuan)
1. **Re-verify sebelum fix.** Setiap item mencantumkan `file:baris` versi audit. Sebelum mengerjakan,
   cek ulang lokasinya di kode terkini; bila bergeser → perbarui catatan item DULU, baru fix.
   Bila temuannya sudah tidak benar (diperbaiki pihak lain) → tandai `SUPERSEDED` + bukti commit;
   jangan diam-diam mengerjakan hal lain.
2. **Scope lock.** Tiap item punya daftar `FILES:`. Commit hanya boleh menyentuh file di daftar itu
   (+ test terkait). File lain tersentuh = investigasi, bukan lanjut.
3. **Satu item = satu commit.** Format `fix(<scope>): <deskripsi>` (ID, huruf kecil, imperatif),
   body menyebut ID item + ID temuan (mis. `QW-1 (A26)`). Perbaikan susulan → `--amend`, bukan commit baru.
4. **Jangan renumber/rename temuan.** F##/A## stabil; tracker memetakannya 1:1.

### Anti-MISS (temuan terlewat / setengah selesai)
5. **Pemetaan lengkap 66 temuan → item** (tabel di bawah). Gap terdeteksi bila ada temuan tanpa item.
6. **Status terminal wajib.** Tiap item berakhir di tepat satu dari:
   `[x]` DONE · `[W]` WONTFIX (alasan wajib) · `[D]` DEFERRED (entri wajib di `doc/DEFERRED.md`).
   Tidak ada item hilang tanpa status.
7. **DONE punya bukti.** Sebelum `[x]`: perintah `VERIFY` dijalankan exit 0, test baru/update jalan,
   dan bukti (nama test / exit code) ditulis di baris item + JOURNAL.
8. **Audit nol-limbo tiap akhir batch:** hitung semua item; `DONE + WONTFIX + DEFERRED + BLOCKED`
   harus menjelaskan 100% item. Sisanya = carry-over eksplisit ke batch berikutnya.
9. **Gate akhir batch:** `bun run test` (suite penuh) + `bun run check` + `bun run lint` (scoped path berubah).

### Anti-GAP (celah yang tidak terlihat)
10. **Temuan baru saat bekerja → item baru** (atau catat untuk `/rawe2`), jangan fix inline di luar scope item.
11. **Perubahan perilaku = test baru/update** (konvensi tdd-guard repo).
12. **Keputusan manusia tidak boleh diasumsikan** — masuk antrean "Keputusan & human queue" di bawah.
13. **Checklist pra-acara** (`ADMIN-PANITIA-JURI-REVIEW.md` §Checklist) diverifikasi ulang saat P0 & P1 tutup.

### Protokol mulai sesi (rekonsiliasi — wajib, urutan tetap)
1. Baca file ini + `git log --oneline -30`.
2. Ada commit cocok item tapi box belum dicentang → centang, tulis JOURNAL, **jangan ulangi** pekerjaannya.
3. `git status` kotor → cocokkan dengan item pertama belum centang; tidak jelas → `git stash` + JOURNAL.
4. Lanjut dari item `BELUM` paling awal pada batch aktif.

### Legenda status
`[ ]` BELUM · `[~]` SEDANG (hanya satu per sesi) · `[x]` DONE · `[W]` WONTFIX · `[D]` DEFERRED · `SUPERSEDED` (temuan tak lagi benar)

### Aturan waktu (ikuti tabel timeout rawe1)

---

## Pemetaan temuan → item (gap check)

| Temuan | Item | Temuan | Item | Temuan | Item |
|---|---|---|---|---|---|
| F1 | B1-4 | F10 | B4-10 | F19 | B2-2 |
| F2 | B1-4 | F11 | B2-6 | F20 | B4-11 |
| F3 | B1-4 | F12 | B1-4 | F21 | B2-3 |
| F4 | B1-1..B1-6 | F13 | B4-11 | F22 | B4-9 |
| F5 | B1-3 | F14 | B1-1 | F23 | QW-3 |
| F6 | B2-1 | F15 | QW-6 | F24 | B1-1 |
| F7 | B1-5, B2-4 | F16 | B2-4 | F25 | B4-9 |
| F8 | B1-2 | F17 | B1-2 | F18 | B2-1 |
| F9 | tercakup B1-1/B1-3 | | | | |
| A1 | B1-4, B3-3 | A15 | B4-1 | A29 | B3-2 |
| A2 | B1-3 | A16 | B1-4 | A30 | B4-3 |
| A3 | B3-2 | A17 | B1-8 | A31 | B2-5 |
| A4 | B3-6 | A18 | B1-6, B1-7 | A32 | B4-8 |
| A5 | B4-2 | A19 | B1-1 | A33 | B1-3 |
| A6 | B3-4 | A20 | QW-6 | A34 | B2-7 |
| A7 | B1-4, B4-7 | A21 | B1-5 | A35 | B3-7 |
| A8 | B2-5 | A22 | B1-5 | A36 | B3-3 |
| A9 | B2-6 | A23 | B3-1 | A37 | B4-5 |
| A10 | QW-4 | A24 | B3-1 | A38 | B4-4 |
| A11 | QW-5 | A25 | QW-2 | A39 | B4-7 |
| A12 | B3-6 | A26 | QW-1 | A40 | B4-9 |
| A13 | B3-3 | A27 | B3-5 | A41 | QW-3 |
| A14 | B4-6 | A28 | B3-5 | | |

---

## Batch 0 — Quick wins (tanpa migrasi DB; aman dikerjakan lebih dulu)

- [ ] **QW-1** — Executor layangan menulis `flight_duration_ms` — Temuan: A26
  - FILES: `src/lib/offline/executor.ts`, `src/lib/offline/__tests__/`
  - Plan: tambah `flight_duration_ms: payload.flightDurationMs` pada case `/rest/scores/layangan`.
  - VERIFY: `bunx vitest run src/lib/offline/__tests__` · `bun run check`
  - Commit: —
- [ ] **QW-2** — Undo skor queued memakai identitas yang benar — Temuan: A25
  - FILES: `src/lib/db/scores.ts`, `src/lib/db/layangan.ts`, `src/lib/offline/executor.ts`, test terkait
  - Plan: tombstone delete via `idempotency_key` (kolom sudah ada) alih-alih `id` ketika sumbernya antrean;
    pastikan `removePending` gagal → tombstone tetap valid.
  - VERIFY: `bunx vitest run src/lib/db/__tests__/scores.test.ts src/lib/db/__tests__/layangan.test.ts`
  - Commit: —
- [ ] **QW-3** — Indikator MODE DEMO + guard build — Temuan: A41, F23
  - FILES: `src/lib/components/AppShell.svelte`, `src/lib/demo/store.ts`, `src/lib/env.ts`
  - Plan: banner menonjol bila `demoMode` true; build warning bila `PUBLIC_ENABLE_DEMO_MODE=true` di luar dev.
  - VERIFY: `bun run check` + test render banner saat demo
  - Commit: —
- [ ] **QW-4** — Nonaktifkan tombol Check-in peserta belum layak + alasan — Temuan: A10
  - FILES: `src/lib/components/AdminPanel.svelte`, `src/lib/components/ParticipantDetailCard.svelte`, test terkait
  - Plan: disable/ubah label bila `paidStatus === "none"` atau rejected; tampilkan alasan singkat.
  - VERIFY: `bunx vitest run src/lib/components/__tests__/AdminPanel.test.ts src/lib/components/__tests__/ParticipantDetailCard.test.ts`
  - Commit: —
- [ ] **QW-5** — Verifikasi mensyaratkan bukti — Temuan: A11
  - FILES: `src/lib/components/AdminPanel.svelte`, `src/lib/db/admin.ts`, `src/lib/db/__tests__/admin.test.ts`
  - Plan: `verifyPayment` menolak bila `proof_image_url` kosong (atau konfirmasi eksplisit "verify tanpa bukti" + audit).
  - VERIFY: `bunx vitest run src/lib/db/__tests__/admin.test.ts src/lib/components/__tests__/AdminPanel.test.ts`
  - Commit: —
- [ ] **QW-6** — Gagal upload bukti = error fatal (live & executor) — Temuan: F15, A20
  - FILES: `src/lib/db/payment.ts`, `src/lib/offline/executor.ts`, test payment
  - Plan: jalur live: upload gagal → throw (jangan insert tanpa bukti); executor: upload gagal → return `error` (retry).
  - VERIFY: `bunx vitest run src/lib/db/__tests__/payment.test.ts src/lib/offline/__tests__`
  - Commit: —
`bun run check` ≤120s · test file tersentuh ≤120s · suite penuh ≤300s · build ≤240s.
Kena timeout = `BLOCKED` + catat di JOURNAL, jangan menaikkan timeout diam-diam.

## Batch 1 — Fondasi server: RPC + RLS (P0; butuh human queue apply SQL)

- [ ] **B1-1** — RPC `submit_payment` + kolom `idempotency_key` pembayaran — Temuan: F14, F24, A19, F9
  - FILES: `supabase/rls.sql`, `src/lib/db/schema.ts`, `src/lib/db/payment.ts`, `src/lib/offline/executor.ts`, test
  - Plan: kolom `idempotency_key uuid unique` (+backfill); RPC SECURITY DEFINER: ownership via phone, amount ≥ minDp
    & kelipatan, `ON CONFLICT (idempotency_key) DO NOTHING`; client & executor pindah `rpc()`; jangan set status optimistik.
  - VERIFY: test payment/executor · apply SQL = human queue
  - Commit: —
- [ ] **B1-2** — RPC `resubmit_payment` + jalur UI — Temuan: F8, F17
  - FILES: `supabase/rls.sql`, `src/lib/db/payment.ts`, `src/lib/components/RegistrantProfile.svelte`, test
  - Plan: resubmit baris rejected/pending (ownership phone); tombol "Kirim ulang bukti"; perbaiki teks janji F17.
  - VERIFY: test payment + RegistrantProfile
  - Commit: —
- [ ] **B1-3** — RPC `verify_payment`/`reject_payment` + guard state + recalc status — Temuan: F5, A2, A33, A34
  - FILES: `supabase/rls.sql`, `src/lib/db/admin.ts`, test admin
  - Plan: transisi hanya pending→verified/rejected (rejected→verified eksplisit); recalc `participants.status`
    dari total verified dalam RPC; audit dalam transaksi RPC (menutup A34 — bila selesai, B2-7 jadi SUPERSEDED).
  - VERIFY: `bunx vitest run src/lib/db/__tests__/admin.test.ts`
  - Commit: —
- [ ] **B1-4** — RPC `register_participant`: kuota atomik + tiket sequence + dedupe + lapak — Temuan: F1, F2, F3, F12, A16, A7, A1, A39 (sebagian)
  - FILES: `supabase/rls.sql` (RPC + unique `(competition_id, phone)` + sequence tiket + assign lapak),
    `src/lib/db/schema.ts`, `src/lib/db/register.ts`, `src/lib/offline/executor.ts`, `src/lib/db/participantImport.ts`, test
  - Plan: sesuai desain PESERTA-FLOW §5–6; deklarasi unique di `schema.ts`; import memakai sumber tiket/lapak server.
  - VERIFY: test register/executor/import
  - Commit: —
- [ ] **B1-5** — RPC `check_in` + eligibility re-check + audit — Temuan: F7, A21, A22
  - FILES: `supabase/rls.sql`, `src/lib/db/checkin.ts`, `src/lib/offline/executor.ts`, test checkin
  - Plan: RPC memvalidasi (status, rejected, diskualifikasi) → set `checked_in` + `audit_logs`;
    executor drain memanggil RPC (bukan update buta); simpan pelaku di audit payload.
  - VERIFY: `bunx vitest run src/lib/db/__tests__/checkin.test.ts`
  - Commit: —
- [ ] **B1-6** — Cabut policy UPDATE/INSERT/DELETE publik; tulis hanya via RPC — Temuan: F4, A18
  - FILES: `supabase/rls.sql`, klien terkait (setelah RPC B1-1..B1-5 + RPC skor siap)
  - Plan: drop UPDATE publik participants/payments/configs & DELETE/INSERT/UPDATE skor+sponsor;
    **urutan wajib: RPC siap dulu, baru policy dicabut** (kalau tidak, app mati).
  - VERIFY: uji anon ditolak + alur app tetap jalan · apply = human queue
  - Commit: —
- [ ] **B1-7** — Undo skor via RPC ber-audit (pengganti DELETE publik) — Temuan: A18 (lanjutan), pasangan A25
  - FILES: `supabase/rls.sql`, `src/lib/db/scores.ts`, `src/lib/db/layangan.ts`, `src/lib/offline/executor.ts`, test
  - Plan: `delete_score(idempotency_key, actor)` + audit; `removeScore`/tombstone pindah ke RPC.
  - VERIFY: test scores/layangan
  - Commit: —
- [ ] **B1-8** — Data lock pasca-acara — Temuan: A17
  - FILES: `supabase/rls.sql` (flag + prosedur), `src/lib/db/admin.ts`, `src/lib/components/AdminPanel.svelte`, test
  - Plan: flag lock dihormati semua tulis client + prosedur DB tertulis + audit lock on/off.
  - VERIFY: test admin + checklist prosedur
  - Commit: —

## Batch 2 — Pembayaran & status (P1)

- [ ] **B2-1** — Lanjut lunas menagih sisa — Temuan: F6, F18 — FILES: `payment.ts`, `RegistrantProfile.svelte`, test
  - Plan: default & validasi nominal = `max(0, fee - totalVerified)`; tampilkan rincian sisa.
- [ ] **B2-2** — Label `checked_in` menampilkan sisa bayar — Temuan: F19 — FILES: `RegistrantProfile.svelte`, `TicketCard.svelte`, test
- [ ] **B2-3** — Sesi guest tidak dihapus saat gagal jaringan — Temuan: F21 — FILES: `daftar/+page.svelte`
  - Plan: bedakan network error (pertahankan sesi + retry) vs hasil kosong (logout).
- [ ] **B2-4** — State lokal optimistik check-in & bayar tunai offline — Temuan: F7, F16
  - FILES: `checkin.ts`, `payment.ts`, `ParticipantDetailCard.svelte`, `AdminPanel.svelte`, test
  - Plan: record IDB lokal untuk op queued; `remaining`/status menghitung op lokal; badge "menunggu sinkron".
- [ ] **B2-5** — Settle: peringatkan pending + alur pasca-check-in — Temuan: A8, A31
  - FILES: `AdminPanel.svelte`, `payment.ts`, `ParticipantDetailCard.svelte`, test
  - Plan: warning pending di modal admin; izinkan pelunasan `checked_in` (atau alur "tagih sisa"); guard kuota onsite → keputusan.
- [ ] **B2-6** — `undoCheckIn` menghitung ulang status — Temuan: F11, A9 — FILES: `admin.ts`, test admin
- [ ] **B2-7** — Audit best-effort — Temuan: A34 — FILES: `admin.ts` (bisa SUPERSEDED bila B1-3 lebih dulu)

## Batch 3 — Juri & papan skor (P1)

- [ ] **B3-1** — Panel juri offline-safe — Temuan: A23, A24
  - FILES: `MancingPanel.svelte`, `LayanganPanel.svelte`, `HiasPanel.svelte`, cache peserta (IDB/high-water), test
  - Plan: fallback lokal daftar peserta/hasil; refetch pasca-submit opsional; `hasJackpot` offline = lewati konfirmasi.
- [ ] **B3-2** — Halaman juri: filter aktif + deteksi perubahan round + selektor — Temuan: A29, A3 — FILES: `juri/*/+page.svelte`
- [ ] **B3-3** — Peserta panel segar + BIB aktual + pencarian tiket/nama — Temuan: A36, A13, A1 (bagian UI)
  - FILES: `MancingPanel.svelte`, `HiasPanel.svelte`, `LayanganPanel.svelte`, test
- [ ] **B3-4** — Constraint unik `(competition_id, participant_id, round)` layangan — Temuan: A6
  - FILES: `supabase/rls.sql`, `schema.ts`, `layangan.ts`, `LayanganPanel.svelte`, test
  - Plan: unique index + `ON CONFLICT` terkontrol; panggil `hasResult` sebelum submit.
- [ ] **B3-5** — Papan aduan per-babak + semantik `mudun` — Temuan: A28, A27 (+keputusan)
  - FILES: `engine.ts`, `leaderboard.ts`, `LeaderboardBoard.svelte`, `DisplayScreen.svelte`, `layangan.ts`, `generator.ts`
- [ ] **B3-6** — Jackpot kategori terpisah + pembulatan hias konsisten — Temuan: A4, A12
  - FILES: `engine.ts`, `LeaderboardBoard.svelte`, `DisplayScreen.svelte`, `hias.ts`, test
- [ ] **B3-7** — Realtime publication + polling fallback leaderboard — Temuan: A35

## Batch 4 — Penguatan (P2)

- [ ] **B4-1** — Guard advance round (jumlah belum dinilai + opsi paksa) — Temuan: A15 — FILES: `admin.ts`, `AdminPanel.svelte`
- [ ] **B4-2** — `min_dp` editable & persist — Temuan: A5 — FILES: `AdminPanel.svelte`, `admin.ts`
- [ ] **B4-3** — Jalur admin untuk `payment_configs` non-aktif — Temuan: A30 — FILES: `rls.sql` (RPC select), `AdminPanel.svelte`
- [ ] **B4-4** — Storage bucket diperketat (path UUID, opsi private + signed URL) — Temuan: A38 — FILES: `rls.sql`, `payment.ts`
- [ ] **B4-5** — PIN hash-only di bundle + build warning + peran berbeda — Temuan: A37 — FILES: `.env.example`, `env.ts`, `pin.ts`
- [ ] **B4-6** — Identitas pelaku per orang (nama/ID petugas saat entry PIN) — Temuan: A14 — FILES: `PinGate.svelte`, `pin.ts`, panel juri/panitia
- [ ] **B4-7** — Import: audit batch + tiket/lapak dari sumber server (setelah B1-4) — Temuan: A39, A7 (bagian import) — FILES: `participantImport.ts`, `admin.ts`
- [ ] **B4-8** — HiasPanel: undo nyata, query batch, jendela edit berbasis waktu input — Temuan: A32 — FILES: `HiasPanel.svelte`, `hias.ts`
- [ ] **B4-9** — Hubungkan utilitas §5 atau amandemen ARCHITECTURE — Temuan: A40, F22, F25 — FILES: `sync.ts`, `reconcile.ts`, `networkStore.ts`, `RegistrationForm.svelte`, `doc/ARCHITECTURE.md`
- [ ] **B4-10** — Format tiket kanonik tunggal — Temuan: F10 — FILES: `register.ts`, `CheckinScanner.svelte`
- [ ] **B4-11** — Kebijakan akses e-tiket & privasi guest — Temuan: F13, F20 — FILES: `tiket/[id]/+page.svelte`, `daftar/+page.svelte` (+keputusan produk)

---

## Keputusan & human queue (jangan diasumsikan)

1. Apply `rls.sql` hasil Batch 1 ke Supabase (dashboard) — semua item B1-*.
2. `alter publication supabase_realtime add table ...` (B3-7).
3. Keputusan produk: e-tiket tanpa pembayaran (F13), semantik `mudun` (A27), sisa pasca-check-in & guard kuota onsite (A31), PIN per peran (A37).
4. Setelah Batch 1 apply: jalankan "Checklist pra-acara" dokumen admin sebagai gate rilis.

## Jurnal

Tulis `doc/JOURNAL.md` per item/batch: keputusan, deviasi, BLOCKED + perintah/detik (format rawe1).
  - FILES: `supabase/rls.sql` (alter publication — human queue), `leaderboard/+page.svelte`
  - Plan: polling 30 dtk + indikator "last updated" sebagai fallback bila realtime mati.