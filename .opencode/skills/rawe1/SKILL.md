---
name: rawe1
description: Use when the user invokes /rawe1 or asks to execute/lanjutkan/menjalankan backlog doc/TASKS.md (Tool Lomba Agustusan) while off-screen — resuming after token limit, context exhaustion, power loss, or a fresh session. Also triggers on "rawe1", "lanjutkan backlog", "eksekusi TASKS.md".
---

# Rawe1 — Eksekutor Backlog Tool Lomba Agustusan

## Ringkas

Jalankan backlog [`doc/TASKS.md`](../../../doc/TASKS.md) task demi task sampai
fase aktif habis atau tersisa hanya antrean manusia. User **OFF-SCREEN**:
jangan pernah bertanya, jangan menunggu persetujuan. Setiap keputusan ditulis
ke [`doc/JOURNAL.md`](../../../doc/JOURNAL.md), bukan ditanyakan.

State hidup di disk, tidak pernah di context: checkbox `TASKS.md` + `git log` +
`JOURNAL.md`. Crash apa pun dipulihkan dengan memanggil ulang `/rawe1`.

**Baca [`doc/START.md`](../../../doc/START.md) lebih dulu, selalu.** Itu
menentukan fase aktif.

Referensi kanonik: [`doc/ARCHITECTURE.md`](../../../doc/ARCHITECTURE.md) —
keputusan (PIN UX gate, tie-break `received_at`, hias weighted, syarat masuk
DP-cukup, data lock) HANYA boleh dilanggar lewat entri JOURNAL + amend task,
bukan diam-diam.

## Model

- **Implementasi → Sonnet.** Jangan pernah model murah (Haiku) untuk menulis
  kode: riwayat proyek sejenis menunjukkan ia menyatakan selesai padahal
  belum, butuh 2–4 kali prompt ulang. Itu asal commit jelek.
- **Model murah hanya untuk pencarian/pembacaan read-only** (menemukan file,
  membaca dokumen). Tidak pernah untuk edit, tidak pernah memutuskan `DONE`.
- Driver (sesi ini) yang memutuskan `DONE`, bukan subagent.

## Batas waktu — estimasi, DIUKUR di Q8-04

Setiap perintah dijalankan dengan `timeout`. Jangan pernah memanggil perintah
tanpa batas: itu penyebab macet.

| Perintah | Estimasi | `timeout` |
|---|---:|---:|
| `bun install` (fresh) | 10–40 s | 300 |
| `bun run check` (svelte-check) | 5–20 s | 120 |
| `bun run build` (produksi) | 15–45 s | 240 |
| `bun run test` (file tersentuh) | 1–10 s | 120 |
| `bun run test` (suite penuh) | 20–90 s | 300 |
| `bun run lint` (biome) | 1–5 s | 60 |
| `bunx drizzle-kit generate/push` | 2–10 s | 120 |

**Aturan anti-macet:**

1. **Verify per-task = SCOPED, bukan suite penuh.** Jalankan hanya file test
   yang tersentuh + biome pada path yang berubah. Target <30 detik.
   `bunx vitest run <file>.test.ts` · `bunx biome check <path>`
2. **Suite penuh dijalankan sekali di akhir fase** (saat menutup fase), bukan
   tiap task.
3. **Perintah kena `timeout` = `BLOCKED`, bukan diulang.** Catat perintah +
   detik di JOURNAL, lanjut ke task berikutnya. Jangan pernah menaikkan timeout
   diam-diam.
4. **Jangan pernah melonggarkan config utk melewati gate** — biome, tsconfig,
   svelte-check, `--fail-on-warnings`. Lint lambat/berisik = temuan JOURNAL,
   bukan config diubah.
5. **Q8-04 mengukur ulang dan meng-update tabel ini.** Setelah itu pakai angka
   terukur.

## Protokol (loop)

1. **Reconcile — SELALU pertama, tiap pemanggilan:**
   - Repo BELUM git (belum ada `F0-01`) → tidak ada `git log`. Mulai dari
     `F0-01`. Ini satu-satunya pengecualian "tanpa git".
   - `git log --oneline -30` versus checkbox `TASKS.md`. Ada commit tapi box
     belum dicentang → centang, tulis JOURNAL, **jangan ulangi task-nya**.
   - `git status` kotor → kalau perubahannya cocok dengan task pertama yang
     belum dicentang, selesaikan task itu (verify → commit); kalau tidak jelas
     → `git stash`, JOURNAL, ulangi task dari bersih.
   - Commit asing yang menyentuh file task (user sesi paralel) → baca dulu
     sebelum lanjut.
2. **Tentukan fase aktif** dari `doc/START.md`.
3. **Pilih** task `[ ]` pertama dari board `READY NOW`. Task di luar fase aktif
   **tidak pullable**, meskipun `READY`.
4. **Cek antrean manusia** (`TASKS.md` → "Antrean manusia"). Task ada di sana →
   `BLOCKED`, JOURNAL (`butuh manusia: <alasan>`), **lanjut**. Jangan berhenti,
   jangan menebak, jangan memalsukan bukti.
5. **Baca baris task lengkap**: `FILES:`, `VERIFY:`, dan terutama **`Edge:`**.
   `Edge:` = syarat, bukan saran. Kalau menyentuh `ARCHITECTURE.md` §keputusan,
   baca itu sebelum menyentuh kode.
6. **Dispatch SATU subagent** (`general-purpose`, `model: sonnet`). Prompt
   memuat: baris task verbatim, `FILES:`, `VERIFY:`, `Edge:` yang berlaku, dan
   satu file sibling/kanon utk di-mirror. Satu task = satu subagent = satu
   commit. (Task kecil murni 1 file boleh dikerjakan inline — driver.)
7. **Verify sendiri.** Klaim subagent bukan bukti. Jalankan `VERIFY:` + lint
   scoped, baca diff.
8. **Commit** (lihat disiplin commit).
9. Ulangi dari 3.

## Gerbang anti-"selesai padahal belum"

Sebuah task hanya `DONE` bila **kelima**-nya benar. Driver yang memeriksa,
bukan subagent. Satu saja gagal → task tetap `[ ]`, JOURNAL alasannya, perbaiki
di iterasi berikutnya (via `--amend`, bukan commit baru).

1. `git log -1` menunjukkan commit-nya ada, dan `git show --stat` hanya
   menyentuh file yang disebut `FILES:`. File di luar itu → **investigasi,
   jangan centang**.
2. Perintah `VERIFY:` dijalankan **oleh driver** dan exit 0.
   Untuk `VERIFY: artefak — …`: file ada, **tidak kosong**, memuat setiap unsur
   yang disebut setelah tanda `—`.
3. Lint scoped bersih (`bunx biome check <path yang berubah>`) dan
   `bun run check` hijau.
4. Kriteria "done when" di baris task benar-benar terpenuhi — baca ulang
   kalimatnya dan cocokkan dengan diff. **Juga: kasus di `Edge:` ditangani** —
   kalau baris `Edge:` menyebut X, dan implementasi tidak menangani X, task
   belum selesai.
5. Status konsisten: `TASKS.md` board + `START.md` fase aktif sinkron.

Kalau subagent melaporkan selesai tapi gerbang gagal: **jangan dispatch ulang
subagent yang sama dengan prompt yang sama.** Tulis apa yang kurang ke JOURNAL,
lalu dispatch dengan prompt yang menyebut kekurangan itu secara eksplisit.

## Disiplin commit — melawan commit redundan

- **Satu task = satu commit.** Perbaikan utk task yang sama masuk lewat
  `git commit --amend`, **bukan** commit baru. Tidak ada lagi "fix lint", "fix
  test", "perbaiki yang tadi".
- Format wajib: `<type>(<scope>): <deskripsi>` — Bahasa Indonesia, imperatif,
  huruf kecil. Body menjelaskan **kenapa** berubah.
- **DILARANG `Co-Authored-By`.**
- Sebutkan ID task di body, mis. `F0-01`, supaya `git log` bisa dipetakan ke
  backlog saat review.
- Jangan pernah `git push` kecuali user memintanya.

## Menutup fase

Saat semua task fase aktif `DONE` atau `BLOCKED`:

1. Jalankan **suite penuh sekali**: `bun run test` · `bun run check` ·
   `bun run lint`.
2. Verifikasi board sinkron (start.md + TASKS.md + fase).
3. Perbarui `START.md` (fase aktif, daftar tarik, syarat naik) **dan** board
   `TASKS.md` **dan** blok "Fase berikutnya" dalam satu commit.
4. Tulis [`doc/RUN-REPORT.md`](../../../doc/RUN-REPORT.md) (lihat bawah).
5. Berhenti. Jangan mulai fase berikutnya tanpa pemanggilan baru.

## Serah terima utk review di sesi baru

Tulis `doc/RUN-REPORT.md`, ditimpa tiap run:

```markdown
# Run Report — <tanggal>
Fase: <n> · Commit: <sha-awal>..<sha-akhir>

## Selesai
| Task | Commit | Verify | Bukti |
| F0-02 | a1b2c3d | exit 0 | — |

## BLOCKED
| Task | Sebab | Butuh |
| D1-03 | RLS butuh service role | manusia |

## Menyimpang dari rencana
<apa pun yang dikerjakan berbeda dari baris task, plus alasannya>

## Belum diverifikasi
<apa pun yang lolos gerbang tapi masih diragukan>
```

Reviewer membaca `RUN-REPORT.md` lebih dulu, lalu `JOURNAL.md` rentang tanggal
itu, lalu diff-nya. Bagian **"Menyimpang"** dan **"Belum diverifikasi"** paling
penting — mengosongkannya padahal ada penyimpangan adalah kegagalan run.

## Pool deferral

Cek [`doc/DEFERRED.md`](../../../doc/DEFERRED.md) SEBELUM menarik task baru.
Item di sana = kandidat kerja run ini. Format entri tetap; centang saat
dikerjakan, jangan dihapus.

## Yang tidak pernah dilakukan

- Bertanya ke user (off-screen) — JOURNAL sebagai gantinya.
- Melonggarkan lint/tsconfig/timeout utk melewati gate.
- Mengerjakan task di luar fase aktif atau yang ada di antrean manusia.
- Melanggar keputusan `ARCHITECTURE.md` tanpa JOURNAL + amend task.
- Menandai `DONE` tanpa kelima gerbang lulus.
- Commit kedua utk task yang sama (pakai `--amend`).
- `git push`.
- Membiarkan kasus `Edge:` di baris task tanpa penanganan.
