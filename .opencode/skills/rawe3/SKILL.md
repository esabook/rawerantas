---
name: rawe3
description: Use when the user invokes /rawe3 or asks to execute/menjalankan/mengerjakan perbaikan temuan doc2 — backlog doc2/FIX-TRACKER.md (fix F##/A## review Tool Lomba Agustusan). Also triggers on "rawe3", "kerjakan tracker", "fix temuan doc2", "perbaiki F/A".
---

# Rawe3 — Eksekutor FIX-TRACKER doc2/

## Ringkas

Kerjakan [`doc2/FIX-TRACKER.md`](../../../doc2/FIX-TRACKER.md) item demi item, batch demi
batch, sampai batch aktif habis atau tersisa hanya antrean manusia. User **OFF-SCREEN**:
jangan bertanya; keputusan ditulis ke `doc/JOURNAL.md`.

**Sumber kebenaran = FIX-TRACKER.md**, bukan ingatan sesi. Bacalah penuh setiap mulai.
Temuan didefinisikan di [`doc2/PESERTA-FLOW-REVIEW.md`](../../../doc2/PESERTA-FLOW-REVIEW.md)
(F1–F25) dan [`doc2/ADMIN-PANITIA-JURI-REVIEW.md`](../../../doc2/ADMIN-PANITIA-JURI-REVIEW.md)
(A1–A41). Spesifikasi kanonik: `doc/ARCHITECTURE.md`.

## Disiplin inti (anti-drift / miss / gap — detail penuh di tracker)

1. **Rekonsiliasi dulu**: baca tracker + `git log --oneline -30` + `git status`.
   Commit ada tapi box belum dicentang → centang + JOURNAL, jangan kerjakan ulang.
2. **Re-verify referensi** `file:baris` tiap item sebelum fix; kode boleh sudah bergeser.
   Temuan tak lagi benar → `SUPERSEDED` + bukti, jangan kerjakan hal lain diam-diam.
3. **Scope lock**: commit hanya menyentuh `FILES:` item (+test). Satu item = satu commit
   `fix(<scope>): <deskripsi>` + body menyebut ID item & temuan. Susulan → `--amend`.
4. **Status terminal**: `[x]` DONE (bukti VERIFY exit 0 wajib) / `[W]` WONTFIX (alasan) /
   `[D]` DEFERRED (entri `doc/DEFERRED.md`). Akhir batch: audit nol-limbo 100% item.
5. **Perubahan perilaku = test baru/update** (konvensi tdd-guard repo).
6. **Temuan baru saat kerja → item baru** di tracker; jangan fix inline di luar scope.
7. **Urutan Batch 1 saklek**: RPC (B1-1..B1-5, B1-7) harus siap SEBELUM policy publik
   dicabut (B1-6). SQL diaplikasikan manusia (human queue) — tulis instruksi apply di JOURNAL.
8. **Keputusan produk tidak diasumsikan** — item terkait ditandai "keputusan" di tracker.
9. Timeout mengikuti tabel rawe1; kena timeout = BLOCKED + JOURNAL, jangan naikkan diam-diam.
10. Gate akhir batch: `bun run test` penuh + `bun run check` + `bun run lint` scoped.

## Urutan kerja default

Batch 0 (QW-1..QW-6) → Batch 1 (B1-1..B1-8) → Batch 2 → Batch 3 → Batch 4.
Dalam satu sesi, selesaikan sebanyak mungkin item batch aktif; berhenti bersih di batas
item yang membutuhkan keputusan/apply manusia, tulis JOURNAL + status tracker, sudah.

## Yang tidak pernah dilakukan

- Menomori ulang / mengganti ID temuan atau item.
- Commit tanpa menjalankan VERIFY item.
- Meninggalkan item tanpa status terminal di akhir batch.
- `git push`.
- Bertanya ke user (off-screen) — JOURNAL sebagai gantinya.