# MULAI DI SINI — Tool Lomba Agustusan

**FASE SEKARANG: 9 selesai (production readiness) — sisa murni antrean manusia.**

## Tarik sekarang

Semua task yang bisa dikerjakan agen (`R9-01`..`R9-10`) sudah `DONE`. Yang
tersisa SELURUHNYA butuh aksi manusia — tidak ada lagi yang bisa ditarik agen
sampai salah satu di bawah beres:

| ID | Lane/Prio/Effort | Aksi |
|---|---|---|
| `D1-03` | SEC/P1/E:S | **HUMAN** — apply RLS SQL (`supabase/rls.sql`, 23 policy/9 tabel, sudah termasuk fix `R9-01`) di konsol Supabase (service role); lepaskan `A7-01` |
| `A7-01` | FE/P0/E:M | Admin verify pembayaran (setelah `D1-03`) |
| `A7-04` | FE/P2/E:S | Export CSV + data lock (setelah `A7-01`) |
| `Q8-01` | QA/P1/E:M | Build + audit Lighthouse (butuh fase 0–7 SEMUA `DONE` — masih menunggu rantai manusia `D1-03`→`A7-01`→`A7-04`) |
| `Q8-03` | REL/P1/E:S | **HUMAN** — deploy Cloudflare Pages (akun + domain; `static/_redirects` dari `R9-03` sudah siap) |
| `Q8-04` | RUN/P1/E:S | **HUMAN** — sync-test 2 perangkat + kalibrasi timeout (sync loop kini benar-benar wired, `R9-02`) |

Detail (`FILES:`, `VERIFY:`, `Edge:`) ada di [`TASKS.md`](./TASKS.md).

## Kenapa fase ini dulu

Fase 4–7 selesai (7/7, 5/5, 3/3, 2/4+2 BLOCKED): alur user, panitia, juri,
admin & display. Yang tersisa di fase 7 (`A7-01` admin verify, `A7-04` export
+ data lock) bergantung `D1-03` RLS SQL yang butuh service role manusia — rantai
tersebut membuka `Q8-01` (audit butuh semua fase DONE). `Q8-02` smoke e2e demo
mode sudah tuntas run 2026-08-07 (suite 188 hijau + checklist RUN-REPORT).

## Syarat naik ke fase 8

Fase 8 dibuka: fase 7 habis (DONE + BLOCKED). `Q8-02` smoke demo mode:
DONE run ini. `Q8-01` tetap WAIT sampai `A7-04` DONE (rantai manusia).

## Fase 9 — production readiness (DONE, 2026-08-07)

Audit persiapan deploy (security/env, offline-engine, build/deploy) menemukan
gap agent-fixable yang harus beres sebelum `D1-03`/`Q8-03`/`Q8-04` berarti
apa-apa: RLS `competitions`/`payment_configs` tanpa policy UPDATE (blokir
A7-02 total begitu RLS aktif), sync loop offline tak pernah dipanggil kode
nyata (skor offline tak pernah sampai ke Supabase), `_redirects` hilang
(deep link 404 di CF Pages), plus 6 gap lain (audit config, guard base-url,
lint, dead code, CI). Semua `R9-01`..`R9-10` `DONE` — detail di `TASKS.md`
FASE 9. Rantai manusia (`D1-03`→`A7-01`→`A7-04`→`Q8-01`, dan `Q8-03`/`Q8-04`)
TIDAK berubah statusnya, hanya sekarang tidak ada bug menunggu di baliknya.

## Peta fase

| Fase | Isi | Selesai bila |
|---|---|---|
| 0 | `F0-*` — fondasi (repo, deps, env, tokens, layout, test, lint) | `F0-07` `DONE` |
| 1 | `D1-*` — data & skema (9 tabel, RLS, demo, engine skor) | `D1-06` `DONE` |
| 2 | `O2-*` — offline engine (SW, queue, sync, high-water) | `O2-05` `DONE` |
| 3 | `C3-*` — komponen shared (PIN, toast, QR, TTS, countdown) | `C3-05` `DONE` |
| 4 | `U4-*` — alur user (landing, daftar, bayar, tiket, leaderboard) | `U4-05` `DONE` |
| 5 | `P5-*` — panitia (scanner, check-in flow) | `P5-02` `DONE` |
| 6 | `J6-*` — juri (mancing, layangan aduan, hias) | `J6-03` `DONE` |
| 7 | `A7-*` — admin & display (verify, config, display, export) | `A7-04` `DONE` |
| 8 | `Q8-*` — QA & deploy (audit, smoke, deploy, sync-test) | `Q8-04` `DONE` |
| 9 | `R9-*` — production readiness (fix agent-fixable dari audit deploy) | `R9-10` `DONE` |
