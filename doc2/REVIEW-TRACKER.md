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
| A42 | 🔴 High | `rls.sql` INVALID: commit B1-8 (`0de0cdc`) menyisip blok data-lock di tengah statement `create policy "proof_images anon insert" ... for insert to anon` → `with check (...)` yatim di baris 1097; apply file gagal mulai seksi 7 (data lock, drop policy B1-6 tetap jalan parsial, tapi `insert into data_lock` gagal → semua RPC tulis error runtime "relation data_lock does not exist") | `supabase/rls.sql:1023-1025,1097` | ✅ tertulis |
| A43 | 🟠 Medium | Aturan `submit_payment` (`amount <> fee → wajib ≥ min_dp & kelipatan 500`) bertabrakan dgn alur "tagih sisa" (B2-1/A31): bila sisa < min_dp (mis. fee 100rb, min_dp 50rb, DP terverifikasi 60rb → sisa 40rb) semua jalur lunas buntu: sisa ditolak server (`below_min_dp`), fee penuh diblokir client (overpayment), tunai gerbang via RPC yang sama | `rls.sql:525-535`, `payment.ts:339-395`, `RegistrantProfile.svelte:281-285` | ✅ tertulis |
| A44 | 🟠 Medium | B4-8 undo hias LIVE rusak senyap: `removeHiasScore` enqueue `/rest/scores/layangan-hias/delete` tapi executor tak punya case itu (default → "error" → retry s/d dead) dan RPC `delete_score` whitelist hanya mancing/layangan; toast "dibatalkan" tetap tampil; carryover TIDAK tercatat di tracker | `hias.ts:250-268`, `executor.ts` (default case), `rls.sql:985` | ✅ tertulis |
| A45 | 🟡 Low | `bun run lint` repo penuh EXIT 1 pada 4 file; 2 di antaranya terakhir disentuh rawe3 Batch 4 (`AdminPanel.test.ts`@`7090b20`, `queries.ts`@`c42a9b7`) → klaim "lint 0" tak akurat utk state akhir; 2 lain utang lama (`package.json`, `manifest.webmanifest`) | repo root | ✅ tertulis |
| A46 | 🟡 Low | B2-4 (`ebdfb94`): perubahan perilaku (flag `queued` + badge sinkron) tanpa test baru/update (konvensi tdd-guard, aturan 11 tracker); FILES menyebut `payment.ts`/`AdminPanel.svelte`/test tapi commit tak menyentuhnya (klaim FILES tak akurat) | commit `ebdfb94` | ✅ tertulis |
| A47 | 🟡 Low | Sisi A27 belum tuntas di seed demo: `generator.ts:282` masih acak `mudun` padahal engine hanya menghitung `menang` sbg win → leaderboard demo undercount; B3-5 tak menyentuh generator | `src/lib/demo/generator.ts:282` | ✅ tertulis |

---

## Matriks verifikasi item rawe3 (39)

Status awal `⏳`; diisi per batch. Kolom Cek = apa yang diverifikasi (commit/scope/kode).

### Batch 0 — Quick wins

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| QW-1 executor layangan menulis flight_duration_ms | c60dff6 | ✅ | commit+scope OK; `executor.ts:110` menulis kolom; test +2 | |
| QW-2 undo skor queued pakai idempotency_key | eff8398 | ✅ | kunci antrean = UUID idempotensi (`scores.ts:203`, `layangan.ts:226`); tombstone via `idempotency_key` → RPC delete | |
| QW-3 banner MODE DEMO + guard build | 0ff94d6 | ✅ | banner sticky amber `AppShell.svelte:23-31` + `data-testid`; env guard demo; test +2 | |
| QW-4 nonaktifkan tombol check-in belum layak | 8b4aa08 | ⚠️ | `AdminPanel.svelte:1197` "Belum layak" + alasan; `ParticipantDetailCard` derived reason | sisa: kasus rejected murni tak terdeteksi tab Panitia (perlu `admin.ts`) — tercatat |
| QW-5 verifikasi mensyaratkan bukti | ab6cb5c | ✅ | `assertProofForVerify` demo+live (`admin.ts:466`); RPC `no_proof` (`rls.sql:720`); UI blokir dini (`AdminPanel.svelte:658`) | cash dikecualikan (keputusan) |
| QW-6 gagal upload bukti = fatal (live & executor) | b1e5597 | ✅ | live throw (`payment.ts:158`); executor return `"error"` → retry (`executor.ts:180`) | |

### Batch 1 — Fondasi server RPC + RLS

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B1-1 RPC submit_payment + idempotency_key | 51c7826 | ⚠️ | RPC guard lengkap: lock/phone/diskualifikasi/min_dp/kelipatan/dedup/recalc (`rls.sql:482-586`); client+executor pindah rpc | artefak SQL rusak — lihat A42 |
| B1-2 RPC resubmit_payment + jalur UI | 4ced1b7 | ⚠️ | RPC guard verified+ownership (`rls.sql:596-648`); tombol kirim ulang (`RegistrantProfile.svelte:189,240`) | offline resubmit = celah tercatat; A42 |
| B1-3 RPC verify/reject + guard + recalc | 8f94dcd | ⚠️ | RPC `for update` + guard state + bukti + recalc + audit satu transaksi (`rls.sql:696-796`); client via RPC | A42 |
| B1-4 RPC register_participant (kuota+tiket+dedupe) | ded8f57 | ⚠️ | kuota atomik (`rls.sql:848`), sequence tiket (`:856`), dedupe ON CONFLICT (`:863`), unique di `schema.ts:94` | **lapak TIDAK di-assign RPC** padahal FILES menyebut "assign lapak" → A1 tetap PARSIAL; A42 |
| B1-5 RPC check_in + eligibility + audit | 7cd0c63 | ⚠️ | RPC: lock/disqualified/already/rejected/min_dp + audit recorded_by (`rls.sql:892-961`); client `checkin.ts:236`; executor via RPC | A42 |
| B1-6 cabut policy tulis publik | f533fb6 | ⚠️ | drops+revoke ada (`rls.sql:1086-1096`); sisa tulis publik tercatat sbg carryover | posisi di belakang statement rusak (A42) |
| B1-7 undo skor via RPC delete_score | 658d790 | ⚠️ | RPC whitelist mancing/layangan + audit (`rls.sql:969-1021`); `executor.ts:31` deleteScoreRpc | hias tak masuk whitelist (lihat A44); A42 |
| B1-8 data lock pasca-acara | 0de0cdc | ❌ | client OK (`admin.ts:637-699`, toggle AdminPanel, guard semua RPC) | **commit ini memotong statement `create policy` storage.objects → `rls.sql` invalid (A42)** — artefak SQL Batch 1 rusak; perbaiki sebelum human apply |

### Batch 2 — Pembayaran & status

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B2-1 lanjut lunas menagih sisa | 01554aa | ⚠️ | validateAmount full pakai nominal terkirim (`payment.ts:78-84`); sisa + blokir overpay (`RegistrantProfile.svelte:281,328`) | **deadlock bila sisa < min_dp** — aturan RPC menolak (A43) |
| B2-2 label checked_in menampilkan sisa | ce82735 | ✅ | `RegistrantProfile.svelte:365-371` + `TicketCard.svelte:150` "Sudah masuk — sisa Rp X" | |
| B2-3 sesi guest tak dihapus saat offline | 2edd548 | ✅ | `daftar/+page.svelte:58-64` isOfflineError → pertahankan sesi + pesan | |
| B2-4 state lokal optimistik check-in/tunai | ebdfb94 | ⚠️ | `queued:true` (`checkin.ts:271`); badge syncPending (`ParticipantDetailCard.svelte:249`) | **tanpa test baru** + FILES tak akurat (A46); sisa `remaining` summary tercatat |
| B2-5 settle: warning pending + pasca-check-in | 4fc0a44 | ✅ | guard pending menutupi sisa (`payment.ts:377`); checked_in diizinkan (A31); warning modal (`AdminPanel.svelte:1306`) | guard kuota onsite = keputusan produk, antre |
| B2-6 undoCheckIn recalc status | d6d2e81 | ✅ | recalc fee/minDp (`admin.ts:396-417`) + test lunas tetap fully_paid | audit undo masih absent → A21 PARSIAL |
| B2-7 audit best-effort | 581faa5 | ✅ | `admin.ts:241` console.warn tanpa throw; verify/reject audit di RPC | |

### Batch 3 — Juri & papan skor

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B3-1 panel juri offline-safe | 18a14c9 | ✅ | load catch di 3 panel (`MancingPanel.svelte:55` dll); jackpot lolos offline (A24) | cache peserta IDB = carryover tercatat |
| B3-2 halaman juri: selektor+filter+round | f6997cc | ✅ | selektor bila >1, filter isActive, polling 30 dtk + warning babak (`juri/mancing:18-61`) | |
| B3-3 BIB aktual + polling refresh | ce4e2a6 | ✅ | BIB dari peserta aktual; polling 30 dtk refresh peserta 3 panel | pencarian tiket/nama (A1 UI) = carryover |
| B3-4 unique constraint layangan + guard | 9e11070 | ✅ | unique index (`rls.sql:162`, `schema.ts`); guard `hasResult` pra-insert (`layangan.ts:196`) | ON CONFLICT terkontrol = carryover tercatat |
| B3-5 mudun/dq + papan per-babak | 9c7084b, 661eab5 | ⚠️ | status dq + tombol MUDUN→menang/PUTUS→putus/DQ→dq (`LayanganPanel:495-538`); filter round leaderboard/display | **seed demo masih acak `mudun`** (`generator.ts:282`) → A47 |
| B3-6 jackpot terpisah + pembulatan hias | fe8cbfe | ✅ | jackpot dirangking berat + subScore flag (`engine.ts:105-111`); badge; hias real | |
| B3-7 realtime publication + polling fallback | ba21558 | ✅ | `alter publication` (`rls.sql:1137`); polling 30 dtk + cleanup (`leaderboard/+page:86`) | publication apply = human queue; A42 |

### Batch 4 — Penguatan (P2)

| Item | Commit klaim | Status | Cek | Catatan |
|---|---|---|---|---|
| B4-1 guard advance round + opsi paksa | 7090b20 | ✅ | hitung unjudged + force (`admin.ts:169-184`); dialog + klik kedua paksa (`AdminPanel.svelte:766,1463`) | |
| B4-2 min_dp editable & persist | 6c45f76 | ✅ | input form (`AdminPanel.svelte:986`); saveCompetition menulis `min_dp` (`admin.ts:97`) | |
| B4-3 RPC payment_configs non-aktif | c42a9b7 | ✅ | RPC SECURITY DEFINER (`rls.sql:1101`); client via rpc (`queries.ts:185`) | A42 |
| B4-4 storage path UUID | d99be3f | ✅ | `crypto.randomUUID()` penuh di live (`payment.ts:154`) & executor (`executor.ts:176`) | privat+signed URL = carryover |
| B4-5 warning fallback DEMO_PIN + build | 98ca2af | ✅ | warn fallback (`pin.ts` verifyPin); build warning PIN kosong non-dev (`env.ts:50-53`) | hash-only bundle + PIN per peran = carryover keputusan |
| B4-6 identitas petugas saat entry PIN | 6b0c2ff | ✅ | input nama petugas (`PinGate.svelte:107`); grant.officer + readOfficer; mancing `hash:officer` (`juri/mancing:32-34`) | panel juri lain = carryover tercatat |
| B4-7 audit batch import peserta | 54f8ce4 | ✅ | audit `import_participants` per batch (`participantImport.ts:490`) | tiket/lapak import dari server = carryover (B1-4) |
| B4-8 HiasPanel undo nyata | 5f0a82a | ❌ | demo OK (local delete); wire onUndo | **LIVE rusak senyap**: endpoint executor tak ada + RPC whitelist tanpa hias (A44); N+1 & jendela edit carryover |
| B4-9 amandemen ARCHITECTURE §5 | 61b1851 | ✅ | doc-only; deviasi diterima tertulis (`ARCHITECTURE.md:159-166`) | |
| B4-10 format tiket kanonik T-xxxxxx | 80362fa | ⚠️ | `nextTicketNumber` T-xxxxxx (`register.ts:103`); seed + placeholder scanner diseragamkan | stub demo `payment.ts:118` masih `Date.now()%1M` (kosmetik, ℹ️) |
| B4-11 kebijakan e-tiket + disclaimer privasi | fc9fbd4 | ✅ | blokir hanya rejected + disclaimer (`tiket/[id]/+page.svelte:90-123`) | keputusan user tercatat |

## Re-verifikasi temuan (66)

Diisi setelah matriks item: tiap F##/A## dipetakan ke status pasca-fix
(`TERTUTUP` / `PARSIAL→carryover` / `TERBUKA` / `SUPERSEDED`).

| Temuan | Status pasca-fix | Via item | Catatan |
|---|---|---|---|
| F1 | TERTUTUP | B1-4 | kuota atomik RPC; apply SQL menunggu manusia (A42) |
| F2 | TERTUTUP | B1-4 | sequence `participant_ticket_seq` |
| F3 | TERTUTUP | B1-4 | unique `(competition_id, phone)` rls + schema |
| F4 | TERTUTUP (menunggu apply) | B1-6 | drops policy ada; artefak SQL rusak (A42) |
| F5 | TERTUTUP | B1-3 | recalc server dalam RPC |
| F6 | TERTUTUP dgn risiko | B2-1 | sisa ditagih; deadlock sisa<min_dp → A43 |
| F7 | TERTUTUP | B1-5, B2-4 | optimistik lokal + RPC saat drain |
| F8 | TERTUTUP | B1-2 | RPC resubmit + UI |
| F9 | TERTUTUP | B1-1 | insert+status satu transaksi server |
| F10 | TERTUTUP | B4-10 | kanonik T-xxxxxx |
| F11 | TERTUTUP | B2-6 | recalc saat undo |
| F12 | TERTUTUP | B1-4 | executor via RPC |
| F13 | TERTUTUP (keputusan) | B4-11 | tiket = bukti pendaftaran |
| F14 | TERTUTUP | B1-1 | idempotency_key unique + ON CONFLICT |
| F15 | TERTUTUP | QW-6 | fatal live & executor |
| F16 | TERTUTUP | B2-4 | badge + skip load() saat queued |
| F17 | TERTUTUP | B1-2 | teks nyata |
| F18 | TERTUTUP | B2-1 | nominal tak ditimpa fee |
| F19 | TERTUTUP | B2-2 | label sisa |
| F20 | TERTUTUP | B4-11 | disclaimer privasi |
| F21 | TERTUTUP | B2-3 | sesi dipertahankan saat offline |
| F22 | TERTUTUP via amandemen | B4-9 | checkDraftRestore tetap dead, deviasi diterima |
| F23 | TERTUTUP | QW-3 | banner + guard build |
| F24 | TERTUTUP | B1-1 | idempotensi end-to-end |
| F25 | TERTUTUP via amandemen | B4-9 | utilitas §5 teruji tak terhubung |
| A1 | **PARSIAL** | B1-4, B3-3 | BIB aktual OK; **lapak tak di-assign RPC** padahal FILES B1-4 menyebutnya |
| A2 | TERTUTUP | B1-3 | recalc RPC |
| A3 | TERTUTUP | B3-2 | selektor kompetisi |
| A4 | TERTUTUP | B3-6 | kategori terpisah |
| A5 | TERTUTUP | B4-2 | editable + persist |
| A6 | TERTUTUP | B3-4 | unique index + guard |
| A7 | PARSIAL | B4-10 | tiket live sequence; import masih generate lokal (carryover tercatat) |
| A8 | TERTUTUP | B2-5 | guard pending |
| A9 | TERTUTUP | B2-6 | recalc |
| A10 | TERTUTUP dgn sisa | QW-4 | rejected murni tab Panitia = carryover |
| A11 | TERTUTUP | QW-5 | wajib bukti |
| A12 | TERTUTUP | B3-6 | hias real seragam |
| A13 | TERTUTUP | B3-3 | BIB dari peserta aktual |
| A14 | PARSIAL | B4-6 | mancing wired; panel lain carryover |
| A15 | TERTUTUP | B4-1 | guard + paksa |
| A16 | TERTUTUP | B1-4 | kuota live atomik |
| A17 | TERTUTUP (menunggu apply) | B1-8 | client OK; artefak SQL rusak (A42) |
| A18 | PARSIAL | B1-6, B1-7 | delete skor mancing/layangan dicabut; sponsors CRUD dll carryover tercatat |
| A19 | TERTUTUP | B1-1 | idempotency |
| A20 | TERTUTUP | QW-6 | fatal |
| A21 | **PARSIAL** | B1-5 | check-in diaudit RPC; **`undoCheckIn` masih tanpa audit** — tak tercatat di carryover tracker |
| A22 | TERTUTUP | B1-5 | drain via RPC eligibility |
| A23 | PARSIAL | B3-1 | offline-safe OK; cache IDB carryover |
| A24 | TERTUTUP | B3-1 | jackpot lolos offline |
| A25 | TERTUTUP | QW-2, B1-7 | kunci idempotensi + RPC |
| A26 | TERTUTUP | QW-1 | kolom ditulis |
| A27 | **PARSIAL** | B3-5 | dq + semantik OK; seed demo masih `mudun` acak (A47) |
| A28 | TERTUTUP | B3-5 | filter round leaderboard/display |
| A29 | TERTUTUP | B3-2 | filter aktif + deteksi round |
| A30 | TERTUTUP (menunggu apply) | B4-3 | RPC semua baris |
| A31 | PARSIAL | B2-5 | settle checked_in OK; guard kuota onsite = keputusan produk |
| A32 | **PARSIAL→rusak live** | B4-8 | undo demo OK; **live mati senyap (A44)**; N+1 carryover |
| A33 | TERTUTUP | B1-3 | guard state |
| A34 | TERTUTUP | B1-3, B2-7 | audit transaksi + best-effort |
| A35 | TERTUTUP (menunggu apply) | B3-7 | publication + polling |
| A36 | TERTUTUP | B3-3 | polling refresh |
| A37 | PARSIAL | B4-5 | warning OK; hash-only & PIN per peran carryover keputusan |
| A38 | PARSIAL | B4-4 | path UUID; privat+signed URL carryover |
| A39 | PARSIAL | B4-7 | audit batch OK; kuota/decrement import carryover |
| A40 | TERTUTUP via amandemen | B4-9 | deviasi didokumentasikan |
| A41 | TERTUTUP | QW-3 | banner + guard; toggle UI = keputusan produk |

## Carryover yang diklaim rawe3 (harus tercatat, bukan hilang)

Daftar CARRYOVER dari keputusan tracker — diverifikasi tetap tercatat & tidak dikerjakan diam-diam:
- [x] Tiket/lapak import dari sumber server (A7/A39, sisa B1-4/B4-7) — tercatat ✅ (keputusan B1-4 & B4-7)
- [x] hasResult ON CONFLICT terkontrol layangan (sisa B3-4) — tercatat ✅
- [x] Cache peserta IDB high-water (sisa B3-1; A40/F25 amandemen via B4-9) — tercatat ✅
- [x] remaining getCheckinSummary utk op queued (sisa B2-4) — tercatat ✅
- [x] Guard kuota onsite (keputusan produk, A31) — tercatat ✅ (human queue)
- [x] Hash-only bundle PIN + PIN per peran (A37) — tercatat ✅ (human queue)
- [x] rejected murni tak terdeteksi tab Panitia (sisa QW-4) — tercatat ✅
- [x] Storage privat + signed URL (sisa B4-4) — tercatat ✅
- [x] N+1 hias + jendela edit berbasis waktu input (sisa B4-8) — tercatat ✅
- [ ] **BARU (R1)** Endpoint executor `/rest/scores/layangan-hias/delete` + whitelist RPC hias (A44) — BELUM tercatat di tracker
- [ ] **BARU (R1)** Audit `undo_check_in` (A21 sisi undo) — BELUM tercatat di tracker
- [ ] **BARU (R1)** Assign `lapak_number` di RPC `register_participant` (A1) — FILES B1-4 menyebut, implementasi tak ada
- [ ] **BARU (R1)** Seed demo layangan berhenti acak `mudun` (A47)
- [ ] **BARU (R1)** Perbaiki `rls.sql` invalid (A42) — P0 sebelum human apply
- [ ] **BARU (R1)** Aturan sisa<min_dp di `submit_payment` (A43)

## Gate R1 (dijalankan reviewer, bukan klaim)

| Perintah | Hasil | Keterangan |
|---|---|---|
| `bun run test` (suite penuh) | ✅ 275/275 (40 file) exit 0 | klaim rawe3 275/275 — cocok |
| `bun run check` | ✅ 0 error 0 warning exit 0 | |
| `bun run lint` (repo penuh) | ⚠️ EXIT 1 — 4 file format | 2 file terakhir disentuh rawe3 B4 (A45); klaim tracker "lint 0" = lint scoped |
| `git status` bersih (di luar doc2) | ✅ bersih | hanya doc2 berubah oleh review ini |

## Human queue (belum berubah sejak tracker — diverifikasi masih berlaku)

1. **⛔ TAHAN dulu**: perbaiki `rls.sql` invalid (A42) SEBELUM apply apa pun —
   tanpa itu apply Batch 1 merusak runtime (semua RPC tulis gagal).
2. Apply `rls.sql` (sudah diperbaiki) ke Supabase: semua RPC + pencabutan policy + data lock.
3. `alter publication supabase_realtime add table ...` (sudah di file; ikut ter-apply).
4. Keputusan produk tersisa: guard kuota onsite (A31), PIN per peran (A37).
5. Checklist pra-acara (`ADMIN-PANITIA-JURI-REVIEW.md` §Checklist) sebagai gate rilis.

## Jurnal review R1

- 2026-08-09 — Setup checkpoint + scaffold tracker ini dibuat; state awal: FIX-TRACKER
  klaim 39/39 DONE (commit terakhir `24fcd0e`), working tree bersih, branch main.
- 2026-08-09 — Verifikasi 39 item + 66 temuan selesai. Hasil: 25 ✅ / 12 ⚠️ / 2 ❌
  (B1-8 = sumber kerusakan `rls.sql`; B4-8 = undo hias live mati senyap). Temuan baru
  A42–A47 tertulis. Gate: test 275/275 · check 0/0 · lint repo EXIT 1 (A45).
  Keputusan review: temuan baru sisi admin/repo diberi nomor A42+ di
  `ADMIN-PANITIA-JURI-REVIEW.md`; tidak ada temuan baru sisi peserta (F doc hanya
  diberi seksi status pasca-fix).

