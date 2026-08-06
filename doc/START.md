# MULAI DI SINI — Tool Lomba Agustusan

**FASE SEKARANG: 3 — Komponen Shared**

## Tarik sekarang

| ID | Lane/Prio/Effort | Aksi |
|---|---|---|
| `C3-01` | FE/P0/E:M | PinGate: PIN 4-digit + lockout + sessionStorage (butuh `F0-03` env — fallback demo PIN bila kosong) |
| `C3-05` | FE/P0/E:XS | CountdownTimer: 4 state + format d/m/j/m/detik |
| `C3-02` | FE/P0/E:S | Toast + undo bar 5 detik (setelah `C3-01`) |

Detail (`FILES:`, `VERIFY:`, `Edge:`) ada di [`TASKS.md`](./TASKS.md).

## Kenapa fase ini dulu

Fase 0–2 selesai (7/7, 5/6+1 blocked, 5/5): fondasi, data & skema, offline
engine. Fase 4–7 (alur user, panitia, juri, admin) semuanya `BLOCKS:` ke
komponen shared ini — PIN gate membuka `J6-*`/`A7-*`, countdown membuka `U4-01`,
toast membuka `J6-01`/`U4-03`, QR membuka `P5-01`. Kerjakan dulu supaya fase
lanjutan tidak menunggu.

## Syarat naik ke fase 4

`C3-01` … `C3-05` semuanya `DONE`.

## Peta fase

| Fase | Isi | Selesai bila |
|---|---|---|
| 0 | `F0-*` — fondasi (repo, deps, env, tokens, layout, test, lint) | `F0-07` `DONE` |
| 1 | `D1-*` — data & skema (9 tabel, RLS, demo, engine skor) | `D1-06` `DONE` |
| 2 | `O2-*` — offline engine (SW, queue, sync, high-water) | `O2-05` `DONE` |
| **3** | `C3-*` — komponen shared (PIN, toast, QR, TTS, countdown) | `C3-05` `DONE` |
| 4 | `U4-*` — alur user (landing, daftar, bayar, tiket, leaderboard) | `U4-05` `DONE` |
| 5 | `P5-*` — panitia (scanner, check-in flow) | `P5-02` `DONE` |
| 6 | `J6-*` — juri (mancing, layangan aduan, hias) | `J6-03` `DONE` |
| 7 | `A7-*` — admin & display (verify, config, display, export) | `A7-04` `DONE` |
| 8 | `Q8-*` — QA & deploy (audit, smoke, deploy, sync-test) | `Q8-04` `DONE` |
