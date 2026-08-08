# Run Report — 2026-08-07

Fase: 4–7 selesai · 8 (QA) dimulai · Commit: `f7ca276..18ef5d5`

## Selesai

| Task | Commit | Verify | Bukti |
|---|---|---|---|
| J6-01 | f7ca276 | exit 0 | MancingPanel + db/scores 2 jalur + 9 test |
| J6-02 | 3305387 | exit 0 | LayanganPanel MUDUN/PUTUS + round reset + 10 test |
| J6-03 | d4a78d7 | exit 0 | HiasPanel slider + edit window 5 menit + 8 test |
| U4-05 | 8c4c176 | exit 0 | LeaderboardBoard engine 4 mode + realtime + 7 test |
| P5-01+P5-02 | 4946a9d | exit 0 | CheckinScanner QR + manual + gate DP + 10 test |
| A7-02 | 8a93a25 | exit 0 | Config & round manager + advance round aduan + 10 test |
| A7-03 | 18ef5d5 | exit 0 | DisplayScreen layar penuh + TTS + wake lock + 7 test |
| Q8-02 | lihat git log (`feat(q8-02)`) | suite penuh | smoke checklist di bawah |

## BLOCKED

| Task | Sebab | Butuh |
|---|---|---|
| D1-03 | RLS butuh service role | manusia (konsol Supabase) |
| A7-01 | DEP D1-03 (transitif) | D1-03 DONE → agen |
| A7-04 | DEP A7-01 | A7-01 DONE → agen |

## Smoke e2e demo mode — checklist per langkah (Q8-02)

Demo mode ON (PUBLIC_ENABLE_DEMO_MODE), tanpa DB. Bukti = test suite (188,
35 file, semua hijau) + komponen terkait.

| Langkah | Verifikasi | Bukti |
|---|---|---|
| Landing | countdown + nav + toaster slot | U4-01 test (existing), F0-05 struktural |
| Daftar | validasi WA, kuota habis, no-refund, draft restore, idempotent | register.test 7 — `demo_registrations` idb |
| Bayar | DP/lunas, cash tanpa bukti, upload kompres ≤200KB, metode aktif saja | payment.test 16 — `demo_payments` |
| Tiket | QR payload `/panitia/checkin?id=`, print 58/80mm, WA share | TicketCard test 8 |
| Juri mancing | numpad gram→kg, jackpot pita, undo 5s, offline antrean | scores.test + MancingPanel 9 |
| Juri layangan | MUDUN/PUTUS, board reset antar babak, undo | layangan.test + LayanganPanel 10 |
| Juri hias | 3 slider 40/40/20, edit window 5 menit, rescore tolak | hias.test + HiasPanel 8 |
| Leaderboard | 4 mode ranking, tie-break received_at, realtime live, offline last-known | leaderboard.test + LeaderboardBoard 7 |
| Admin verify | **TIDAK TERCOBA — A7-01 BLOCKED (D1-03 manusia)** | gap tercatat, bukan bug |
| Display | siklus kompetisi, jam, TTS event, wake lock, last-known banner | DisplayScreen 7 |
| Offline antrean | queue + reconcile + high-water | O2 suite (fase 2, tetap hijau) |
| PIN gate | juri/admin, lockout 5x, sessionStorage | C3-01 test 4 |

Suite penuh dijalankan sekali di fase ini: `bun run test` → 188 passed / 35
files; `bun run check` → 0 error; `bunx biome check src/lib src/routes` →
warnings pre-existing (tts test), tidak ada error; `bun run build` → hijau
(3 pass).

UPDATE pasca FASE 9 (2026-08-07): `bun run test` → 209 passed / 37 files,
`bun run lint` → 0 error. Angka di atas basi karena test bertambah selama
FASE 9 (bukan regresi) — lihat `TASKS.md` FASE 9 untuk detail.

## Menyimpang dari rencana

- A7-02: `queries.ts` demo branch getCompetitions/getPaymentConfigs dialihkan
  ke `getMerged*` (admin.ts) via dynamic import — override admin WAJIB terlihat
  panel lain (daftar, board layangan); circular import statis dihindari.
  idbSchema bump 8→9 + 2 store baru; 3 file test lama di-bump ke v9 +
  fake-indexeddb import di demo.test.ts (di luar daftar FILES A7-02).
- A7-02: `put()` idb gagal structured-clone proxy `$state` → JSON round-trip
  sebelum put (temuan runtime, panel baru yang kirim proxy).
- A7-03: konstanta timer di `<script module>` export (butuh nilai eksak utk
  test); announce check-in hanya jalur live (demo mode tak punya event
  realtime — diff poll mengumumkan skor baru/top); test ditambah di luar
  daftar FILES (kanon repo: komponen berpasangan __tests__).
- START.md fase: 4 stale → 8 (7 tertahan antrean manusia).

## Belum diverifikasi

- Render visual di browser nyata (tidak ada browser di sesi) — tiap layar
  hanya lewat test + build; butuh cek manual di Q8-02 ulang / Q8-04 manusia.
- TTS suara asli di browser (Web Speech API happy-dom tak menyediakan).
- Wake Lock nyata di perangkat (mock test saja).
- Admin verify (A7-01) & data lock/export (A7-04) belum bisa smoke — rantai
  manusia D1-03.
- Realtime Supabase live mode belum teruji (env kosong di dev).
