---
name: rawe2
description: Use when the user invokes /rawe2 or asks to execute/menjalankan/refresh audit & enrichment review doc2/*.md (Tool Lomba Agustusan) — cek end-to-end + edge case sisi admin/panitia/juri dan scan/audit bug & improvement alur peserta. Also triggers on "rawe2", "audit doc2", "perkaya review doc2", "lengkapi doc2".
---

# Rawe2 — Auditor & Pengaya Review doc2/

## Ringkas

Audit silang dan perkaya dua dokumen review di [`doc2/`](../../../doc2/):

- [`doc2/ADMIN-PANITIA-JURI-REVIEW.md`](../../../doc2/ADMIN-PANITIA-JURI-REVIEW.md)
  — temuan & edge case alur admin, panitia (check-in), juri (mancing/aduan/hias),
  display/leaderboard, offline sync, RLS/keamanan, deployment.
- [`doc2/PESERTA-FLOW-REVIEW.md`](../../../doc2/PESERTA-FLOW-REVIEW.md)
  — temuan & rekomendasi alur peserta end-to-end (daftar → login guest →
  bayar → verifikasi → e-tiket → check-in) termasuk jalur offline.

User **OFF-SCREEN**: jangan bertanya, jangan menunggu persetujuan. Keputusan
ditulis langsung ke dokumen (bagian "Koreksi" bila merevisi temuan lama).

**Hanya mengubah `doc2/*.md` — TIDAK ada perubahan kode.** Setiap perbaikan
kode hanya boleh muncul sebagai *rekomendasi* di dokumen.

State hidup di disk: isi kedua dokumen + `git log` + `git status`. Crash apa
pun dipulihkan dengan memanggil ulang `/rawe2`.

Referensi kanonik: [`doc/ARCHITECTURE.md`](../../../doc/ARCHITECTURE.md)
(spesifikasi bisnis & keamanan), [`supabase/rls.sql`](../../../supabase/rls.sql)
(skema + policy live), [`supabase/README.md`](../../../supabase/README.md)
(checklist deployment).

## Protokol (tiap pemanggilan)

1. **Muat state:** baca penuh kedua dokumen doc2. Catat nomor temuan terakhir
   (mis. `A41`, `F25`). Nomor lama **tidak pernah** diubah/dipakai ulang.
2. **Verifikasi temuan lama:** untuk tiap `A##`/`F##`, cek ulang referensi
   `file:baris` terhadap kode saat ini (grep/read). Bila bergeser/salah:
   perbaiki referensinya dan tambahkan catatan kecil; bila temuan sudah tidak
   benar (mis. constraint ternyata ada), tulis koreksi eksplisit — jangan
   dihapus, tandai `KOREKSI`.
3. **Scan temuan baru:** telusuri ulang area berikut mencari bug/gap/edge case
   yang belum tercatat:
   - Admin: `AdminPanel.svelte`, `db/admin.ts`, `db/participantImport.ts`,
     sponsor, import CSV, round advance, data lock.
   - Panitia: `CheckinScanner.svelte`, `ParticipantDetailCard.svelte`,
     `db/checkin.ts`, `submitCashPayment`, undo check-in.
   - Juri: `MancingPanel/LayanganPanel/HiasPanel.svelte`, `db/scores.ts`,
     `db/layangan.ts`, `db/hias.ts`, route `juri/*`, undo/tombstone,
     multi-device, offline.
   - Engine & papan: `db/engine.ts`, `db/leaderboard.ts`,
     `LeaderboardBoard.svelte`, `DisplayScreen.svelte`, display page.
   - Peserta: `RegistrationForm.svelte`, `RegistrantProfile.svelte`,
     `db/register.ts`, `db/payment.ts`, tiket/QR, guest session, draft.
   - Offline: `offline/queue.ts`, `executor.ts`, `sync.ts`, `networkStore.ts`,
     `reconcile.ts`, `proofDraftStore.ts`.
   - Keamanan/deployment: `security/pin.ts`, `env.ts`, `demo/store.ts`,
     `supabase/rls.sql`, `service-worker.ts`, realtime publication.
4. **Perkaya dokumen:**
   - Temuan baru melanjutkan nomor (`A42…`, `F26…`) dengan format sama:
     **Lokasi / Deskripsi / Dampak / Rekomendasi** (+ severitas 🔴/🟠/🟡/ℹ️).
   - Perbarui tabel ringkasan di kepala dokumen.
   - Jaga seksi: (a) audit alur end-to-end per peran / matriks perjalanan
     peserta, (b) cross-check spesifikasi ARCHITECTURE vs implementasi,
     (c) rekomendasi berprioritas P0/P1/P2, (d) checklist pra-acara.
5. **Validasi (wajib sebelum selesai):**
   - Setiap referensi `file:baris` baru dicek dengan grep/read.
   - `git status` menunjukkan perubahan **hanya** pada `doc2/*.md`.
   - Tabel markdown utuh (jumlah kolom konsisten).
6. **Commit:** satu commit `docs(doc2): <ringkasan>` bila repo bersih dari
   perubahan lain; body menyebut rentang temuan baru. Jangan `git push`.

## Disiplin

- Temuan harus **spesifik dan dapat dicek**: sebut file + baris + mekanisme,
  bukan kesan umum. Satu temuan = satu masalah.
- Severitas: 🔴 fraud/kehilangan data/flow utama mati; 🟠 salah hitung/UX
  merusak/alur alternatif mati; 🟡 edge case/kosmetik/audit lemah; ℹ️ info
  deviasi spesifikasi tanpa dampak langsung.
- Temuan lama yang tumpang-tindih dengan yang baru: tambahkan cross-reference
  `(lihat A##/F##)`, jangan duplikasi isi.
- Bahasa Indonesia, gaya konsisten dengan dokumen yang ada.

## Yang tidak pernah dilakukan

- Mengubah kode (`src/`, `supabase/`, config) — rekomendasi saja.
- Menghapus/menomor-ulang temuan lama.
- Menulis temuan tanpa referensi lokasi yang bisa diverifikasi.
- Bertanya ke user (off-screen) — tulis asumsi di dokumen.
- `git push`.