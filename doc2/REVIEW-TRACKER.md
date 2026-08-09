# REVIEW-TRACKER — Review Ulang Hasil Eksekusi rawe3 (R1)

> Sumber kebenaran tunggal review ulang ini. State hidup di file ini + `git log` + `git status` —
> **tidak pernah di context sesi**. Sesi baru melanjutkan dengan membaca file ini dulu (resume).
> Objek review: 39 item DONE di `doc2/FIX-TRACKER.md` (Batch 0–4, klaim "SELESAI 39/39",
> commit `0631cdb`..`24fcd0e`) + re-verifikasi 66 temuan F1–F25 & A1–A41 + scan temuan baru.
> Protokol mengacu skill `/rawe2` (audit doc-only, temuan baru melanjutkan nomor).

---

## Protokol resume (wajib, urutan tetap)

1. Baca file ini penuh + `git log --oneline -20`.
2. Baris pertama berstatus `⏳` pada §Matriks = titik lanjut. Jangan ulangi baris `✅`/`⚠️`/`❌`.
3. `git status` kotor hanya oleh `doc2/*.md` → itu progres review sendiri; lanjutkan, jangan stash.
4. Setelah satu blok verifikasi selesai (per batch / per gate), **update file ini lalu commit**:
   `docs(doc2): checkpoint review R1 — <blok>` (commit checkpoint boleh lebih dari satu;
   deviasi sadar dari aturan "satu commit" rawe2, diminta user agar resumable).
5. Review selesai bila: §Matriks 39/39 terisi, §Re-verifikasi temuan 66/66 terisi,
   §Gate R1 terisi, temuan baru (bila ada) tertulis di dokumen review, commit final dibuat.

## Legenda status review

`⏳` BELUM · `✅` OK (klaim cocok dgn kode & commit) · `⚠️` OK dgn catatan (carryover/deviasi wajar) · `❌` MASALAH → temuan baru R##

## Temuan baru review ini (R##)

Penomoran melanjutkan konvensi dokumen induk: sisi peserta → `F26+` (ditulis di
`PESERTA-FLOW-REVIEW.md`), sisi admin/panitia/juri → `A42+` (ditulis di
`ADMIN-PANITIA-JURI-REVIEW.md`). Kolom "R##" di matriks hanya penunjuk lokasi.

| # | Severitas | Isu | Lokasi | Status tulis |
|---|---|---|---|---|
| (belum ada) | | | | |

---

## Matriks verifikasi item rawe3 (39)

Status awal `⏳`; diisi per batch. Kolom Cek = apa yang diverifikasi (commit/scope/kode).

### Batch 0 — Quick wins

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| QW-1 executor layangan menulis flight_duration_ms | c60dff6 | ⏳ | | |
| QW-2 undo skor queued pakai idempotency_key | eff8398 | ⏳ | | |
| QW-3 banner MODE DEMO + guard build | 0ff94d6 | ⏳ | | |
| QW-4 nonaktifkan tombol check-in belum layak | 8b4aa08 | ⏳ | | |
| QW-5 verifikasi mensyaratkan bukti | ab6cb5c | ⏳ | | |
| QW-6 gagal upload bukti = fatal (live & executor) | b1e5597 | ⏳ | | |

### Batch 1 — Fondasi server RPC + RLS

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B1-1 RPC submit_payment + idempotency_key | 51c7826 | ⏳ | | |
| B1-2 RPC resubmit_payment + jalur UI | 4ced1b7 | ⏳ | | |
| B1-3 RPC verify/reject + guard + recalc | 8f94dcd | ⏳ | | |
| B1-4 RPC register_participant (kuota+tiket+dedupe) | ded8f57 | ⏳ | | |
| B1-5 RPC check_in + eligibility + audit | 7cd0c63 | ⏳ | | |
| B1-6 cabut policy tulis publik | f533fb6 | ⏳ | | |
| B1-7 undo skor via RPC delete_score | 658d790 | ⏳ | | |
| B1-8 data lock pasca-acara | 0de0cdc | ⏳ | | |

### Batch 2 — Pembayaran & status

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B2-1 lanjut lunas menagih sisa | 01554aa | ⏳ | | |
| B2-2 label checked_in menampilkan sisa | ce82735 | ⏳ | | |
| B2-3 sesi guest tak dihapus saat offline | 2edd548 | ⏳ | | |
| B2-4 state lokal optimistik check-in/tunai | ebdfb94 | ⏳ | | |
| B2-5 settle: warning pending + pasca-check-in | 4fc0a44 | ⏳ | | |
| B2-6 undoCheckIn recalc status | d6d2e81 | ⏳ | | |
| B2-7 audit best-effort | 581faa5 | ⏳ | | |

### Batch 3 — Juri & papan skor

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B3-1 panel juri offline-safe | 18a14c9 | ⏳ | | |
| B3-2 halaman juri: selektor+filter+round | f6997cc | ⏳ | | |
| B3-3 BIB aktual + polling refresh | ce4e2a6 | ⏳ | | |
| B3-4 unique constraint layangan + guard | 9e11070 | ⏳ | | |
| B3-5 mudun/dq + papan per-babak | 9c7084b, 661eab5 | ⏳ | | |
| B3-6 jackpot terpisah + pembulatan hias | fe8cbfe | ⏳ | | |
| B3-7 realtime publication + polling fallback | ba21558 | ⏳ | | |

### Batch 4 — Penguatan (P2)

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B4-1 guard advance round + opsi paksa | 7090b20 | ⏳ | | |
| B4-2 min_dp editable & persist | 6c45f76 | ⏳ | | |
| B4-3 RPC payment_configs non-aktif | c42a9b7 | ⏳ | | |
| B4-4 storage path UUID | d99be3f | ⏳ | | |
| B4-5 warning fallback DEMO_PIN + build | 98ca2af | ⏳ | | |
| B4-6 identitas petugas saat entry PIN | 6b0c2ff | ⏳ | | |
| B4-7 audit batch import peserta | 54f8ce4 | ⏳ | | |
| B4-8 HiasPanel undo nyata | 5f0a82a | ⏳ | | |
| B4-9 amandemen ARCHITECTURE §5 | 61b1851 | ⏳ | | |
| B4-10 format tiket kanonik T-xxxxxx | 80362fa | ⏳ | | |
| B4-11 kebijakan e-tiket + disclaimer privasi | fc9fbd4 | ⏳ | | |

## Re-verifikasi temuan (66)

Diisi setelah matriks item: tiap F##/A## dipetakan ke status pasca-fix
(`TERTUTUP` / `PARSIAL→carryover` / `TERBUKA` / `SUPERSEDED`).

| Temuan | Status pasca-fix | Via item | Catatan |
|---|---|---|---|
| (diisi saat verifikasi) | | | |

## Carryover yang diklaim rawe3 (harus tercatat, bukan hilang)

Daftar CARRYOVER dari keputusan tracker — diverifikasi tetap tercatat & tidak dikerjakan diam-diam:
- [ ] Tiket/lapak import dari sumber server (A7/A39, sisa B1-4/B4-7)
- [ ] hasResult ON CONFLICT terkontrol layangan (sisa B3-4)
- [ ] Cache peserta IDB high-water (sisa B3-1; A40/F25 sudah amandemen via B4-9)
- [ ] remaining getCheckinSummary utk op queued (sisa B2-4)
- [ ] Guard kuota onsite (keputusan produk, A31)
- [ ] Hash-only bundle PIN + PIN per peran (A37, keputusan arsitektur)
- [ ] rejected murni tak terdeteksi tab Panitia (sisa QW-4, perlu ubah admin.ts)
- [ ] Storage privat + signed URL (sisa B4-4)
- [ ] N+1 hias + jendela edit berbasis waktu input (sisa B4-8)

## Gate R1 (dijalankan reviewer, bukan klaim)

| Perintah | Hasil | Keterangan |
|---|---|---|
| `bun run test` (suite penuh) | ⏳ | klaim rawe3: 275/275 |
| `bun run check` | ⏳ | klaim rawe3: 0 error |
| `bun run lint` | ⏳ | klaim rawe3: 0 error |
| `git status` bersih (di luar doc2) | ⏳ | |

## Human queue (belum berubah sejak tracker — diverifikasi masih berlaku)

1. Apply `rls.sql` Batch 1 ke Supabase (semua RPC + pencabutan policy + data lock).
2. `alter publication supabase_realtime add table ...` (B3-7).
3. Keputusan produk tersisa: guard kuota onsite (A31), PIN per peran (A37).
4. Checklist pra-acara (`ADMIN-PANITIA-JURI-REVIEW.md` §Checklist) sebagai gate rilis.

## Jurnal review R1

- 2026-08-09 — Setup checkpoint + scaffold tracker ini dibuat; state awal: FIX-TRACKER
  klaim 39/39 DONE (commit terakhir `24fcd0e`), working tree bersih, branch main.

