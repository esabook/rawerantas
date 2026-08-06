# MULAI DI SINI — Tool Lomba Agustusan

**FASE SEKARANG: 2 — Offline Engine**

## Tarik sekarang

| ID | Lane/Prio/Effort | Aksi |
|---|---|---|
| `O2-01` | RUN/P0/E:M | Service worker native: cache statis + navigate fallback |
| `O2-04` | FE/P1/E:XS | Offline UI: banner + badge antrean (setelah `O2-02`) |

`O2-01` dan `O2-02` (sudah `DONE`) menunggu `F0-02` (sudah `DONE`). Detail
(`FILES:`, `VERIFY:`, `Edge:`) ada di [`TASKS.md`](./TASKS.md).

## Kenapa fase ini dulu

Fase 1 (data & skema: Drizzle, Supabase client, demo, engine skor) sudah
selesai — 5/6 `DONE`, `D1-03` (apply RLS) `BLOCKED` menunggu manusia
(konsol/service role). Semua alur user (U4), juri (J6), admin (A7) butuh
bertahan di jaringan jelek lapangan: SW + queue + sync + reconcile inilah yang
menjamin data tidak hilang dan skor tidak ganda.

## Syarat naik ke fase 3

`O2-01` … `O2-05` semuanya `DONE`.

## Peta fase

| Fase | Isi | Selesai bila |
|---|---|---|
| 0 | `F0-*` — fondasi (repo, deps, env, tokens, layout, test, lint) | `F0-07` `DONE` |
| 1 | `D1-*` — data & skema (9 tabel, RLS, demo, engine skor) | `D1-06` `DONE` |
| **2** | `O2-*` — offline engine (SW, queue, sync, high-water) | `O2-05` `DONE` |
| 3 | `C3-*` — komponen shared (PIN, toast, QR, TTS, countdown) | `C3-05` `DONE` |
| 4 | `U4-*` — alur user (landing, daftar, bayar, tiket, leaderboard) | `U4-05` `DONE` |
| 5 | `P5-*` — panitia (scanner, check-in flow) | `P5-02` `DONE` |
| 6 | `J6-*` — juri (mancing, layangan aduan, hias) | `J6-03` `DONE` |
| 7 | `A7-*` — admin & display (verify, config, display, export) | `A7-04` `DONE` |
| 8 | `Q8-*` — QA & deploy (audit, smoke, deploy, sync-test) | `Q8-04` `DONE` |

## Kalau kamu mau…

| …ini | buka |
|---|---|
| tahu apa yang harus dikerjakan | [`TASKS.md`](./TASKS.md) — board `READY NOW` |
| tahu kenapa arsitekturnya begini | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| daftar yang ditunda/butuh manusia | [`DEFERRED.md`](./DEFERRED.md) |
| riwayat keputusan & eksekusi | [`JOURNAL.md`](./JOURNAL.md) |
| laporan run terakhir | [`RUN-REPORT.md`](./RUN-REPORT.md) |
| menjalankan backlog | skill `.opencode/skills/rawe1/SKILL.md` (perintah `/rawe1`) |

## Aturan mutlak

1. **Jangan lompat fase.** Task fase berikutnya tidak boleh ditarik meskipun
   statusnya `READY`.
2. **`TASKS.md` satu-satunya sumber status.** Dokumen lain tidak pernah
   menyimpan status task.
3. **Task tanpa `VERIFY` yang dijalankan tidak boleh ditandai `DONE`.**
   Perintahnya ada di baris task.
4. **`Edge:` di baris task = syarat.** Kasus batas yang tertulis WAJIB
   ditangani, bukan sekadar dibaca.
5. **Saat sebuah fase selesai, perbarui file ini** — fase aktif, daftar tarik,
   dan syarat naik.
