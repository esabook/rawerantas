# Review End-to-End Sisi Admin, Panitia & Juri — Temuan & Edge Case

> Tanggal: 2026-08-08 · **Update v2: 2026-08-08** (audit penuh lanjutan) · **Review ulang R1: 2026-08-09** (verifikasi hasil eksekusi rawe3) · Scope: alur admin, panitia (check-in), juri (mancing/aduan/hias), display/leaderboard, offline sync, RLS/keamanan, deployment
> Dokumen pelengkap dari `PESERTA-FLOW-REVIEW.md`. Tidak ada perubahan kode — murni temuan & rekomendasi.
> v2 menambahkan: temuan A17–A41, audit alur end-to-end per peran, cross-check spesifikasi ARCHITECTURE vs implementasi, rekomendasi berprioritas P0/P1/P2, dan checklist pra-acara.
> **R1 (2026-08-09):** verifikasi 39 item FIX-TRACKER pasca-eksekusi rawe3 → temuan baru A42–A47; status re-verifikasi tiap temuan lama di `doc2/REVIEW-TRACKER.md` (sumber kebenaran review, resumable).

## Ruang lingkup yang ditinjau

| Area | File utama |
|---|---|
| Admin: verifikasi, konfigurasi, round, panitia-tab, import CSV | `src/lib/components/AdminPanel.svelte`, `src/lib/db/admin.ts`, `src/lib/db/participantImport.ts` |
| Panitia: check-in & bayar tunai | `src/lib/components/CheckinScanner.svelte`, `ParticipantDetailCard.svelte`, `src/lib/db/checkin.ts`, `payment.ts` |
| Juri Mancing | `src/lib/components/MancingPanel.svelte`, `src/lib/db/scores.ts` |
| Juri Aduan Layangan | `src/lib/components/LayanganPanel.svelte`, `src/lib/db/layangan.ts` |
| Juri Layangan Hias | `src/lib/components/HiasPanel.svelte`, `src/lib/db/hias.ts` |
| Engine peringkat & leaderboard | `src/lib/db/engine.ts`, `leaderboard.ts`, `LeaderboardBoard.svelte` |
| Display big-screen | `src/routes/display/+page.svelte`, `src/lib/components/DisplayScreen.svelte` |
| Datatable | `src/lib/components/ui/datatable/DataTable.svelte` |
| Offline sync engine | `src/lib/offline/queue.ts`, `executor.ts`, `sync.ts`, `networkStore.ts`, `reconcile.ts` |
| Keamanan & PIN | `src/lib/security/pin.ts`, `src/lib/env.ts`, `src/lib/demo/store.ts` |
| Deployment & RLS | `supabase/rls.sql`, `supabase/README.md`, `src/service-worker.ts`, `.env` |

---

## Ringkasan temuan

| # | Severitas | Isu | File |
|---|---|---|---|
| A1 | 🔴 High | Peserta daftar live tanpa `lapak_number` → sulit di-score juri via BIB | `register.ts`, `MancingPanel.svelte` |
| A2 | 🔴 High | `verifyPayment` live tidak update `participants.status` → tab panitia salah | `admin.ts`, `AdminPanel.svelte` |
| A3 | 🟠 Medium | Juri route pilih `competitions[0]` — tidak ada selektor kompetisi | `juri/*/+page.svelte` |
| A4 | 🟠 Medium | `jackpot_pita` tercampur di papan utama (rank 1) vs "kategori terpisah" | `engine.ts` |
| A5 | 🟠 Medium | `min_dp` tidak bisa diedit admin & `saveCompetition` tak persist | `AdminPanel.svelte`, `admin.ts` |
| A6 | 🟠 Medium | Layangan: tak ada constraint unik (comp, peserta, round) → dobel-win multi-device | `schema.ts` |
| A7 | 🟠 Medium | Nomor tiket kolisi `Date.now()%1M` (ulang F2) + apply ke import | `register.ts`, `participantImport.ts` |
| A8 | 🟠 Medium | `settle`/`submitCashPayment` tidak memperhitungkan bayaran pending → bisa tagih dobel | `AdminPanel.svelte`, `payment.ts` |
| A9 | 🟡 Low | `undoCheckIn` hardcode `dp_paid` (downgrade lunas) | `admin.ts` |
| A10 | 🟡 Low | Panitia-tab tampilkan tombol Check-in untuk peserta belum layak → error | `AdminPanel.svelte` |
| A11 | 🟡 Low | Verifikasi tidak mensyaratkan bukti (bisa verify tanpa proof) | `admin.ts` |
| A12 | 🟡 Low | Hias: total tampil dibulatkan (Math.round) vs ranking (desimal) tidak konsisten | `hias.ts`, `engine.ts` |
| A13 | 🟡 Low | Mancing BIB select hardcode 1–100; nomor >100 / non-numerik tak terjangkau | `MancingPanel.svelte` |
| A14 | 🟡 Low | `recordedBy`/`actor_hash` = hash PIN publik → semua admin/juri satu identitas (audit lemah) | `pin.ts`, routes juri |
| A15 | 🟡 Low | Advance round tanpa guard "semua sudah dinilai" & tanpa undo (risiko) | `admin.ts`, `AdminPanel.svelte` |
| A16 | 🟡 Info | Kuota tidak ditegakkan live (ulang F1) — hanya demo & import | `register.ts` |
| A17 | 🔴 High | Data lock (§6.4/A7-04) tidak ada di app — hanya langkah manual README | (tidak ada), `supabase/README.md:51` |
| A18 | 🔴 High | RLS memberi DELETE publik pada skor mancing/layangan + CRUD sponsor → sabotase | `rls.sql:325-326,435-441` |
| A19 | 🟠 Medium | Pembayaran tanpa idempotency key → duplikasi baris (ulang F14) | `payment.ts`, `executor.ts` |
| A20 | 🟠 Medium | Gagal upload bukti ditelan diam-diam (ulang F15) | `payment.ts:139-148`, `executor.ts:142-150` |
| A21 | 🟠 Medium | Check-in/undo live tidak diaudit; `recordedBy` diabaikan di jalur live | `checkin.ts:229-241`, `admin.ts:367-382` |
| A22 | 🟠 Medium | Drain offline menjalankan check-in tanpa re-cek eligibility | `executor.ts:35-44` |
| A23 | 🟠 Medium | Panel juri tak terpakai saat offline (live): load peserta/hasil tanpa fallback | `MancingPanel/LayanganPanel/HiasPanel.svelte` |
| A24 | 🟠 Medium | Submit jackpot offline terblokir (`hasJackpot` tidak offline-safe) | `MancingPanel.svelte:70-85`, `scores.ts:96-117` |
| A25 | 🟠 Medium | Undo skor yang tersinkron dari antrean → tombstone pakai kunci antrean (bukan UUID) | `scores.ts:129-147`, `layangan.ts:141-159` |
| A26 | 🟠 Medium | Executor layangan offline menjatuhkan `flight_duration_ms` | `executor.ts:66-76` |
| A27 | 🟠 Medium | Status `mudun` mati: UI menulis `menang` berlabel MUDUN; engine hanya hitung `menang`; seed demo acak | `layangan.ts:16`, `LayanganPanel.svelte:484-512`, `engine.ts:111-118`, `generator.ts:281` |
| A28 | 🟠 Medium | Leaderboard/display aduan akumulasi semua babak (tak ada filter babak, tak "reset") | `leaderboard.ts:55-66`, `DisplayScreen.svelte` |
| A29 | 🟠 Medium | Halaman juri stale round + memuat kompetisi non-aktif (`getCompetitions(false)` + `[0]`) | `juri/*/+page.svelte` |
| A30 | 🟡 Low | RLS `payment_configs` hanya select aktif → admin tak bisa re-enable metode mati | `rls.sql:350-352` |
| A31 | 🟡 Low | Pelunasan tunai diblokir setelah check-in vs §7 "sisa ditagih di check-in"; guard kuota onsite absen | `payment.ts:202-204` |
| A32 | 🟡 Low | HiasPanel: undo noop, N+1 query sekuensial, load offline throw, edit window dari waktu sync | `HiasPanel.svelte`, `hias.ts` |
| A33 | 🟡 Low | verify/reject live tanpa guard state (verify baris rejected / reject baris verified) | `admin.ts:450-462,492-504` |
| A34 | 🟡 Low | Gagal insert audit membatalkan aliran setelah mutasi utama sukses | `admin.ts:209-221` |
| A35 | 🟡 Low | Realtime publication tidak dikonfigurasi → display/leaderboard live update mati senyap | `rls.sql` (absen), `DisplayScreen.svelte:253-314` |
| A36 | 🟡 Low | Daftar peserta panel juri statis setelah mount (peserta baru/import tak muncul tanpa reload) | `MancingPanel/HiasPanel/LayanganPanel.svelte` |
| A37 | 🟡 Low | PIN plaintext di bundle (vs §6.1), fallback senyap `DEMO_PIN`, satu PIN 3 peran di `.env` | `env.ts`, `pin.ts`, `.env` |
| A38 | 🟡 Low | Bucket `proof-images`: anon insert + public read (abuse + privasi bukti) | `rls.sql:160-172,447-455` |
| A39 | 🟡 Low | Import CSV: kuota hanya saat preview, tanpa audit, tanpa decrement | `participantImport.ts:356-381,403-490` |
| A40 | ℹ️ Info | Dead code §5: tombstone recompute, `checkDraftRestore`, high-water, `reportFetch*` | `sync.ts`, `reconcile.ts`, `networkStore.ts` |
| A41 | ℹ️ Info | `PUBLIC_ENABLE_DEMO_MODE` terkunci build-time tanpa toggle UI — risiko produksi-demo senyap | `demo/store.ts:4`, `.env` |
| A42 | 🔴 High | **R1:** `rls.sql` invalid — statement `create policy proof_images anon insert` terpotong blok data-lock (B1-8); apply gagal, `data_lock` tak terbuat → semua RPC tulis error runtime | `supabase/rls.sql:1023-1025,1097` |
| A43 | 🟠 Medium | **R1:** Aturan `submit_payment` (amount ≠ fee → ≥ min_dp & kelipatan 500) deadlock dgn alur tagih sisa bila sisa < min_dp | `rls.sql:525-535`, `payment.ts:339-395` |
| A44 | 🟠 Medium | **R1:** Undo hias LIVE mati senyap — endpoint executor `/rest/scores/layangan-hias/delete` tak ada & RPC `delete_score` tanpa whitelist hias | `hias.ts:250-268`, `executor.ts`, `rls.sql:985` |
| A45 | 🟡 Low | **R1:** `bun run lint` repo EXIT 1 (4 file; 2 terakhir disentuh rawe3 B4) — klaim "lint 0" state akhir tak akurat | `AdminPanel.test.ts`, `queries.ts`, `package.json`, `manifest.webmanifest` |
| A46 | 🟡 Low | **R1:** B2-4 perubahan perilaku tanpa test baru (tdd-guard) + klaim FILES commit tak akurat | commit `ebdfb94` |
| A47 | 🟡 Low | **R1:** Seed demo masih acak `mudun` (tak dihitung win engine) — sisi A27 belum tuntas | `src/lib/demo/generator.ts:282` |

---

## Koreksi & catatan review R1 (2026-08-09) — status temuan lama pasca-eksekusi rawe3

Verifikasi penuh 39 item + 66 temuan: lihat `doc2/REVIEW-TRACKER.md` (matriks resumable).
Perubahan status penting pada temuan lama:

- **A1 → tetap PARSIAL.** BIB aktual selesai (B3-3), tetapi `register_participant` TIDAK meng-assign
  `lapak_number` padahal FILES B1-4 menyebut "assign lapak". Peserta live tetap tanpa lapak.
- **A21 → PARSIAL.** Check-in kini diaudit server (RPC `check_in`, B1-5), tetapi `undoCheckIn`
  masih tanpa `audit()` di jalur apa pun — dan ini TIDAK tercatat sebagai carryover di tracker.
- **A27 → PARSIAL.** Tombol dq + semantik menang/mudun selesai (B3-5), tetapi seed demo masih
  acak `mudun` → lihat temuan baru **A47**.
- **A32 → PARSIAL (live rusak).** Undo demo nyata; undo LIVE mati senyap → lihat **A44**.
- **A18 → tetap PARSIAL** sesuai catatan tracker (sponsors CRUD, config UPDATE, undo hias dsb. carryover).
- Temuan lain: status per-temuan (TERTUTUP/PARSIAL/via amandemen) di tabel re-verifikasi REVIEW-TRACKER.

Tambahan antrean perbaikan (detail di bagian Detail temuan): **A42, A43, A44 (P0)**, **A45, A46, A47 (P2)**.

---

## Detail temuan

### A1 — 🔴 Peserta daftar live tanpa `lapak_number`

**Lokasi:** `register.ts:115-124` (insert live), `MancingPanel.svelte:34-39` (pencarian BIB).

**Deskripsi:** Registrasi live (`registerParticipant`) hanya menulis `competition_id, name, phone, ticket_number, status` — **tidak** mengisi `lapak_number`. Panel mancing/aduan memilih peserta berdasarkan BIB (`p.lapakNumber === String(lapak)`), dan dropdown hanya menampilkan BIB 1–100. Peserta yang daftar online (tanpa lapak) tidak muncul di papan pencarian BIB → **tidak bisa di-score** oleh juri.

**Dampak:** Peserta online tidak bisa dinilai di mancing/aduan layangan (kecuali di-assign lapak manual via DB/import).

**Rekomendasi:** Assign `lapak_number` saat registrasi (mis. counter per kompetisi) atau sediakan opsi "cari dengan nomor tiket / nama" di panel juri. Tambahkan cara assign/ubah lapak di admin.

---

### A2 — 🔴 `verifyPayment` live tidak update `participants.status`

**Lokasi:** `admin.ts:450-462` (`verifyPayment` live hanya update `participant_payments`), `admin.ts:345-349` (tab panitia baca `participant.status`).

**Deskripsi:** Setelah admin memverifikasi pembayaran di mode live, `participant_payments.is_verified=true` berubah, tetapi `participants.status` tidak diubah. Tab Panitia menghitung `paidStatus` dari `participant.status` (yang masih `registered`/optimistik lama). Akibatnya setelah verifikasi, tabel panitia tetap menampilkan status pembayaran yang salah (mis. masih "Belum"/"DP" padahal sudah lunas).

**Dampak:** Panitia/admin salah membaca status pembayaran di tab Panitia setelah verifikasi.

**Rekomendasi:** Saat `verifyPayment`/`rejectPayment` live, juga perbarui `participants.status` (hitung ulang dari total `is_verified`), atau ubah tab panitia agar menghitung `paidStatus` dari total `is_verified` (bukan kolom `status`). Ini juga menyelesaikan inkonsistensi F5 di dokumen peserta.

---

### A3 — 🟠 Juri route hardcode `competitions[0]`

**Lokasi:** `juri/mancing/+page.svelte:21`, `juri/layangan/+page.svelte:19`, `juri/layangan-hias/+page.svelte:19`.

**Deskripsi:** Ketiga halaman juri mengambil `competition = <filtrasi>[0]` — hanya kompetisi pertama yang cocok dengan `scoring_mode`. Tidak ada dropdown/selector untuk memilih kompetisi lain. Jika ada lebih dari satu lomba mancing (atau aduman/hias), hanya yang pertama yang bisa dinilai.

**Dampak:** Multi-kompetisi sejenis tidak bisa dinilai.

**Rekomendasi:** Tambahkan selektor kompetisi (dropdown) di halaman juri; pertahankan default ke kompetisi pertama.

---

### A4 — 🟠 `jackpot_pita` tercampur di papan utama

**Lokasi:** `engine.ts:93-110` (`jackpot_pita` → `score = jackpot ? 1 : 0`), `computeRanking` sort by score.

**Deskripsi:** ARCHITECTURE §7 menyatakan "peserta jackpot menang kategori terpisah, tidak ikut urutan biasa." Namun `computeRanking` memberi `score=1` untuk semua peserta jackpot dan `score=0` untuk yang bukan, lalu mengurutkan menurun. Akibatnya **semua peserta jackpot menempati peringkat teratas** papan utama, bercampur dengan urutan berat.

**Dampak:** Papan skor utama menampilkan jackpot sebagai juara umum, bukan kategori terpisah — tidak sesuai spesifikasi.

**Rekomendasi:** Pisahkan peserta jackpot ke kategori tersendiri di leaderboard/display; jangan set `score=1` di peringkat umum.

---

### A5 — 🟠 `min_dp` tidak dapat diedit admin

**Lokasi:** `AdminPanel.svelte:911-931` (form kompetisi: fee, quota, scoringMode, isActive — tanpa `minDp`), `admin.ts:93-99` (`saveCompetition` tidak menulis `min_dp`).

**Deskripsi:** Form edit kompetisi di admin tidak menampilkan `min_dp`, dan `saveCompetition` (live) tidak meng-`update` kolom `min_dp`. Nilai DP minimum hanya bisa diubah lewat DB/seed.

**Dampak:** Admin tidak bisa mengubah DP minimum dari UI; kebijakan bayar onsite/deviasi tidak fleksibel.

**Rekomendasi:** Tambahkan input `minDp` di form kompetisi dan sertakan `min_dp` pada `saveCompetition`.

---

### A6 — 🟠 Layangan: dobel-win multi-device

**Lokasi:** `schema.ts:135-160` (hanya `uniqueIndex` idempotency, tanpa unik `(competition_id, participant_id, round)`).

**Deskripsi:** Dua device juri men-submit hasil untuk peserta yang sama pada babak yang sama → dua baris `scores_layangan`. `computeRanking` `layangan_aduan` menghitung `wins.length` → kemenangan ter-inflasi. ARCHITECTURE menyadari "konflik tidak dicek", tapi tanpa constraint, kesalahan ganda tidak pernah terdeteksi.

**Dampak:** Perhitungan menang bisa ganda/salah di papan skor.

**Tambahan v2:** `hasResult()` (`layangan.ts:122-129`) sebenarnya tersedia, tetapi `LayanganPanel` tidak pernah memanggilnya — guard hanya dari state lokal hasil `load()` awal (`LayanganPanel.svelte:82-93,146-148`), sehingga dua device yang sama-sama fresh tetap lolos berdua. Jalur undo-nya pun bermasalah bila entri antrean sudah tersinkron (lihat A25).

---

### A7 — 🟠 Kolisi nomor tiket (ulang F2) + import

**Lokasi:** `register.ts:121`, `participantImport.ts:393-400`.

**Deskripsi:** `nextTicketNumber(Date.now() % 1_000_000)` rentan kolisi (ms sama + wrap). `generatedTicket` di import menangani kolisi *dalam batch* (`usedTickets` lokal), tetapi basis `Date.now()%1M` bisa bentrok dengan tiket remote yang belum ada di `existing` (data basi) → insert gagal.

**Dampak:** Sinkronisasi/import bisa gagal acak akibat nomor tiket duplikat.

**Rekomendasi:** Nomor tiket deterministik dari server (sequence/ULID); di import, re-fetch `existing` terbaru atau gunakan range yang aman.

---

### A8 — 🟠 `settle` (Lunas) tidak memperhitungkan bayaran pending

**Lokasi:** `AdminPanel.svelte:657-689` (`settle`), `payment.ts:209-224` (`submitCashPayment` menghitung `remaining` hanya dari `is_verified`).

**Deskripsi:** `canSettlePayment`/`submitCashPayment` menghitung sisa dari pembayaran **terverifikasi** saja. Jika peserta juga punya pembayaran transfer **pending** yang akan menutupi sisa, panitia masih bisa mencatat tunai sisa penuh → **double-charge** saat pending akhirnya diverifikasi.

**Dampak:** Potensi kelebihan bayar bila peserta punya transfer pending + tunai sisa.

**Rekomendasi:** Saat settle, tampilkan catatan/peringatan bila ada pending; atau blokir settle sampai pending diselesaikan (verify/tolak) dulu, konsisten dengan `ParticipantDetailCard` yang sudah menampilkan peringatan pending.

**Tambahan v2:** modal pembayaran admin (`AdminPanel.svelte`, dialog `selectedPayment`) tidak menampilkan peringatan pembayaran pending sama sekali — berbeda dengan `ParticipantDetailCard.svelte:188-204` yang sudah mengingatkan "Jangan tagih ulang full". Peringatan yang sama perlu dibawa ke tabel Verifikasi sebelum tombol Lunas ditekan.

---

### A9 — 🟡 `undoCheckIn` hardcode `dp_paid`

**Lokasi:** `admin.ts:377`.

**Deskripsi:** `undoCheckIn` (live) selalu mengeset `status: "dp_paid"`, meski peserta sebelumnya `fully_paid` (lunas) atau `registered`. Men-downgrade status.

**Dampak:** Setelah undo check-in, status peserta salah (turun ke DP).

**Rekomendasi:** Hitung ulang status dari total `is_verified` saat undo, bukan hardcode.

---

### A10 — 🟡 Tombol Check-in untuk peserta belum layak

**Lokasi:** `AdminPanel.svelte:1115-1120` (tombol Check-in tampil untuk semua `!checkedIn`), `checkin.ts` (throws bila belum syarat).

**Deskripsi:** Tab Panitia menampilkan tombol "Check-in" untuk peserta yang belum check-in tanpa memandang status pembayaran. Klik pada peserta belum bayar akan melempar error "Belum memenuhi syarat masuk".

**Dampak:** UX: tombol muncul tapi gagal; kebingungan panitia.

**Rekomendasi:** Nonaktifkan/ganti label tombol bila `paidStatus === "none"` atau `paymentRejected`, atau tampilkan alasan.

---

### A11 — 🟡 Verifikasi tanpa syarat bukti

**Lokasi:** `admin.ts:450-462` (`verifyPayment` tidak cek `proof_image_url`).

**Deskripsi:** `verifyPayment` memverifikasi tanpa memeriksa apakah ada bukti (`proof_image_url`). Admin bisa memverifikasi baris tanpa gambar.

**Dampak:** Risiko salah verifikasi; akuntabilitas lemah.

---

### A12 — 🟡 Hias: total tampil vs ranking tidak konsisten

**Lokasi:** `hias.ts:47-53` (`computeHiasTotal` pakai `Math.round`), `engine.ts:37-49` (`hiasTotal` pakai `total_weighted` real / tidak dibulatkan).

**Deskripsi:** Panel menampilkan total berbobot yang **dibulatkan** (`Math.round`), sedangkan leaderboard/ranking memakai `total_weighted` DB (real, ditampilkan 1 desimal). Contoh: `83*0.4+82*0.4+84*0.2 = 82.8` → panel "83", papan "82.8".

**Dampak:** Juri melihat angka berbeda dari papan skor; bisa membingungkan.

**Rekomendasi:** Seragamkan pembulatan (pakai `total_weighted` real di panel, atau bulatkan di engine).

---

### A13 — 🟡 Mancing BIB select hardcode 1–100 & non-numerik

**Lokasi:** `MancingPanel.svelte:174-181`, `scores.ts:203-213` (`findParticipantByLapak`).

**Deskripsi:** Dropdown BIB dibuat `Array.from({length:100})` (1–100). Peserta dengan `lapakNumber` > 100, non-numerik, atau `null` tidak bisa dipilih oleh juri. BIB kosong (belum terdaftar) tetap bisa dipilih → error "Peserta BIB belum termuat".

**Dampak:** Sebagian peserta tidak bisa di-score; pilihan keliru.

**Rekomendasi:** Bangun option dari daftar peserta aktual (nama + lapak), jangan rentang hardcode; disable BIB tanpa peserta. Daftar peserta juga perlu di-refresh (lihat A36) karena peserta baru/hasil import tidak muncul tanpa reload halaman.

---

### A14 — 🟡 Identitas auditor lemah (semua satu hash PIN)

**Lokasi:** `pin.ts`, `juri/*/+page.svelte:24` (`recordedBy = sha256Hex(env.juriPin)`), `admin.ts:183-186`.

**Deskripsi:** `recordedBy`/`actorHash` = hash dari PIN publik yang sama untuk semua juri/admin. Tidak bisa membedakan siapa yang mencatat. Audit tidak bisa menunjuk individu.

**Dampak:** Audit log tidak dapat mengidentifikasi pelaku spesifik.

**Rekomendasi:** Minta identitas petugas (nama/ID) saat masuk PIN, atau jadikan bagian dari sesi; simpan sebagai `recordedBy` selain hash PIN. (Batas: tanpa auth, tetap lemah.)

---

### A15 — 🟡 Advance round tanpa guard & tanpa undo

**Lokasi:** `admin.ts:154-172` (`advanceRound`), `AdminPanel.svelte:1331-1360` (dialog hanya peringatan).

**Deskripsi:** `advanceRound` menambah `current_round` tanpa memeriksa apakah semua peserta babak ini sudah dinilai / ada hasil tersisa. Dialog hanya memberi peringatan; tidak ada undo otomatis (hanya edit DB manual).

**Dampak:** Risiko advance terlalu cepat / salah; pemulihan manual.

**Rekomendasi:** Tampilkan jumlah peserta belum dinilai di dialog; blokir advance bila masih `n > 0` belum dinilai (opsi paksa dengan konfirmasi kuat). Perhatikan juga sisi juri: halaman juri tidak mengetahui perpindahan babak sampai reload (lihat A29), sehingga advance mendadak membuat juri tetap mencatat ke babak lama.

---

### A16 — 🟡 Kuota tidak ditegakkan live (ulang F1)

**Lokasi:** `register.ts:107` (`registerParticipant`), `executor.ts:175`.

**Deskripsi:** Registrasi live tidak men-decrement `competitions.total_quota` secara atomik; kuota hanya dicek di demo (`register.ts:193-199`) dan preview import (`participantImport.ts:371`). Jalur offline `executeRegister` juga tidak cek.

**Dampak:** Kuota bisa oversubscribe di produksi.

**Rekomendasi:** Terapkan atomik decrement kuota di RPC/server (lihat desain di `PESERTA-FLOW-REVIEW.md`).

---

### A17 — 🔴 Data lock (A7-04 / §6.4) tidak terimplementasi di aplikasi

**Lokasi:** tidak ada di kode (grep `dataLock|data_lock|kunciData` = 0 hasil produksi); spesifikasi di `doc/ARCHITECTURE.md` §2 (route `/admin`: "…data lock") & §6 mitigasi 4; satu-satunya jejak operasional di `supabase/README.md:51` ("Setelah acara: hapus policy UPDATE (data lock, A7-04)").

**Deskripsi:** ARCHITECTURE mensyaratkan toggle data lock yang memblokir semua write setelah acara selesai, mencegah perubahan hasil pasca-penilaian. Implementasinya nol: AdminPanel tidak punya kontrol lock, dan RLS tetap memberi UPDATE/INSERT/DELETE publik tanpa batas waktu. "Lock" hanya berupa langkah manual manusia (menghapus policy SQL) yang tertulis di checklist README.

**Dampak:** Hasil lomba (skor, verifikasi pembayaran, status peserta) dapat diubah kapan pun oleh siapa pun yang memegang anon key — bahkan setelah pemenang diumumkan.

**Rekomendasi:** (a) Tambah flag lock (mis. kolom `locked_at` di tabel konfigurasi) yang dihormati semua operasi tulis client; (b) di level DB, jalankan langkah README sebagai RPC/policy bersyarat, bukan penghapusan manual mendadak; (c) tulis entri `audit_logs` saat lock aktif/nonaktif.

---

### A18 — 🔴 RLS: DELETE publik pada skor & CRUD sponsor penuh

**Lokasi:** `rls.sql:325-326` (`grant delete on sponsors, scores_mancing, scores_layangan to anon`), `rls.sql:435-441` (policy delete skor), `rls.sql:358-368` + `425-433` (insert/update sponsor & delete grant).

**Deskripsi:** Anon (kunci yang juga di-bundle publik) mendapat hak DELETE penuh atas `scores_mancing` dan `scores_layangan`, serta INSERT/UPDATE/DELETE atas `sponsors`. Siapa pun dapat menghapus skor peserta mana pun atau mengganti banner sponsor landing tanpa PIN apa pun — melampaui pengakuan "RLS lemah" §6, karena ini aksi destruktif satu arah.

**Dampak:** Sabotase papan skor (hapus skor unggulan) dan vandalisme landing sangat mudah dilakukan.

**Rekomendasi:** Cabut grant/policy DELETE anon; undo skor semestinya lewat RPC ber-audit (atau soft-delete); write sponsor hanya via jalur admin ber-PIN (RPC), bukan policy publik.

---

### A19 — 🟠 Insert pembayaran tanpa idempotency (sisi admin: verifikasi bisa ganda)

**Lokasi:** `payment.ts:149-159`, `executor.ts:152-162`, tabel `participant_payments` tanpa `idempotency_key` (`schema.ts:91-105`).

**Deskripsi:** Uraian lengkap di dokumen peserta (F14/F24). Dari sisi admin: baris ganda hasil double-tap/retry semuanya tampil di tab Verifikasi sebagai "Baru" dan dapat diverifikasi satu per satu → total terverifikasi melebihi fee → status/pelaporan salah; `settle` (A8) juga menghitung sisa dari data yang sudah terinflasi.

**Dampak:** Keuangan dan status peserta tidak dapat dipercaya bila ada duplikat pembayaran.

**Rekomendasi:** Sama dengan F14: kolom `idempotency_key` unique + `ON CONFLICT` di semua jalur insert; tampilkan indikator "kemungkinan duplikat" di tab Verifikasi bila ada ≥2 baris pending peserta sama dengan nominal mirip.

---

### A20 — 🟠 Gagal upload bukti ditelan diam-diam (ulang F15)

**Lokasi:** `payment.ts:139-148`, `executor.ts:142-150`.

**Deskripsi:** Lihat F15 di dokumen peserta. Dari sisi admin: baris pembayaran tanpa `proof_image_url` tampil "Belum ada bukti" (kolom Bukti, `AdminPanel.svelte:316-318`) — admin dipaksa memutuskan tanpa bukti, dan karena A11 verifikasi tanpa bukti tidak dicegah, dua kesalahan ini saling menutupi.

**Dampak:** Keputusan verifikasi tanpa dasar; sengketa dengan peserta.

**Rekomendasi:** Sesuai F15; ditambah: blokir tombol Verifikasi bila `proofImageUrl` kosong (A11) agar admin sadar sedang memverifikasi tanpa bukti.

---

### A21 — 🟠 Check-in/undo tidak diaudit; `recordedBy` hilang di jalur live

**Lokasi:** `checkin.ts:190-254` (`recordedBy` hanya dipakai di record demo, baris 218-222), `admin.ts:367-382` (`undoCheckIn` tanpa `audit()`); bandingkan `verifyPayment`/`rejectPayment`/`saveCompetition` yang menulis audit.

**Deskripsi:** Mutasi gerbang (masuk/batal masuk) justru tidak meninggalkan jejak audit di mode live: update `participants.status='checked_in'` tidak menyertakan pelaku, dan `undoCheckIn` tidak memanggil `audit()` sama sekali. ARCHITECTURE §4.8/§6.3 mewajibkan audit untuk mutasi sensitif.

**Dampak:** Sengketa di pintu masuk ("siapa yang meloloskan peserta ini?") tidak bisa ditelusuri; undo check-in tak terlacak.

**Rekomendasi:** Tulis `audit_logs` (action `check_in`/`undo_check_in`, payload peserta + aktor) di kedua jalur; simpan `recordedBy` yang sudah diterima fungsi (mis. payload audit) alih-alih membuangnya.

---

### A22 — 🟠 Drain offline menjalankan check-in tanpa re-cek eligibility

**Lokasi:** `executor.ts:35-44` (op `/rest/participants/checkin` = update status tanpa syarat).

**Deskripsi:** Check-in offline di-enqueue saat itu juga memenuhi syarat. Jika di antara enqueue dan drain admin **menolak** pembayaran peserta (atau mendiskualifikasi), executor tetap mengeksekusi `status='checked_in'` tanpa mengecek ulang — karena executor hanya membawa `participantId`.

**Dampak:** Peserta yang seharusnya diblokir tetap tercatat masuk lewat antrean yang terlambat tersinkron.

**Rekomendasi:** Executor melakukan eligibility re-check (status + rejected payment) sebelum update, atau pindah ke RPC `check_in` yang memvalidasi; bila tidak lolos, tandai `conflict` dan laporkan di UI panitia.

---

### A23 — 🟠 Panel juri tak terpakai saat offline (live mode)

**Lokasi:** `MancingPanel.svelte:48-52` (`getParticipants` on-mount, `.then` tanpa catch), `LayanganPanel.svelte:82-93` (`load()` tanpa catch) & `179` (refetch pasca-submit), `HiasPanel.svelte:43-72` (`load()` + `select()` memanggil `getHiasScore` sekuensial).

**Deskripsi:** Ketiga panel memuat daftar peserta/hasil lewat Supabase tanpa fallback lokal. Saat jaringan putus di mode live: `getParticipants`/`getRoundResults`/`getHiasScore` reject → promise tak tertangani → panel kosong (mancing: semua BIB tampil "belum terdaftar"; aduan/hias: daftar peserta kosong). Lebih buruk, `LayanganPanel.submit` memanggil `getRoundResults` setelah `submitLayanganResult` berhasil — offline, refetch melempar → catch menampilkan "Gagal menyimpan hasil" padahal hasil **sudah masuk antrean**. Ini melanggar janji "Juri First" offline-first ARCHITECTURE §5.

**Dampak:** Saat jaringan lokasi lomba turun (skenario sangat nyata di lapangan terbuka), seluruh penilaian berhenti dan pesan error menyesatkan muncul.

**Rekomendasi:** Cache daftar peserta per kompetisi di IDB (high-water, A40) sebagai fallback offline; refetch pasca-submit bersifat opsional (try/catch terpisah); tampilkan badge "antrean" yang sudah ada dengan jumlah op tertunda.

---

### A24 — 🟠 Submit jackpot terblokir saat offline

**Lokasi:** `MancingPanel.svelte:70-85` (`confirmJackpot` memanggil `hasJackpot` sebelum submit), `scores.ts:96-117` (`hasJackpot` live = query Supabase tanpa pembungkus offline).

**Deskripsi:** Ketika checkbox Jackpot aktif, alur submit memanggil `hasJackpot` (query live). Offline, query menolak → error ditangkap `submit` → skor tidak jadi disimpan. Skor non-jackpot offline jalan normal (masuk antrean), jadi hanya jalur jackpot yang mati.

**Dampak:** Tepat saat lomba mancing puncak (ikan besar + pita jackpot) dan jaringan jelek, fitur utama tidak bisa dicatat.

**Rekomendasi:** Perlakukan kegagalan `hasJackpot` sebagai "tidak diketahui" → lewati konfirmasi ganda dan lanjut submit (konfirm via toast setelah online), atau cache status jackpot lokal dari skor yang sudah dimuat.

---

### A25 — 🟠 Undo skor yang tersinkron dari antrean memakai kunci yang salah

**Lokasi:** `scores.ts:129-147` (`removeScore`), `layangan.ts:141-159` (`removeLayanganScore`), `executor.ts:58-64,78-84` (delete `.eq("id", payload.scoreId)`).

**Deskripsi:** Untuk submit yang queued, `result.id` = **kunci antrean** (mis. `score-mancing:{comp}:{peserta}:{ts}`), bukan UUID DB. Bila entri ter-drain sebelum undo (interval 15 detik, atau drain langsung saat event `online`), `removePending(id)` mengembalikan false → kode men-enqueue tombstone `score-delete:{kunci}` dengan `payload.scoreId` = kunci antrean tadi → executor menjalankan `.delete().eq("id", kunci)` → tidak ada baris UUID yang cocok → **0 baris terhapus**. Toast "Skor dibatalkan" tetap tampil.

**Dampak:** Ghost score yang tidak bisa dibatalkan dari UI; papan skor salah tanpa disadari.

**Rekomendasi:** Simpan pemetaan kunci antrean → UUID (return id saat insert sukses di executor), atau delete via `idempotency_key` (kolom itu ada di tabel skor); toast undo harus memverifikasi hasil tombstone.

---

### A26 — 🟠 Executor layangan offline menjatuhkan `flight_duration_ms`

**Lokasi:** `executor.ts:66-76` (insert tanpa `flight_duration_ms`) vs `layangan.ts:204-212` (payload antrean menyertakan `flightDurationMs`) vs `layangan.ts:184-191` (jalur live menyertakannya).

**Deskripsi:** Panel aduan mencatat waktu terbang dan mengirimnya di payload, tetapi executor tidak pernah menulis kolomnya saat drain. Baris hasil offline-synced memiliki `flight_duration_ms = NULL`, sedangkan baris live memiliki nilai.

**Dampak:** Tie-break `layangan_aduan` (subScore total durasi, `engine.ts:111-118`) dan tampilan "Total/Terlama" di papan (`LeaderboardBoard.svelte:162-169`, `DisplayScreen.svelte:402-408`) berbeda antara data online dan offline — peringkat bisa berubah hanya karena cara sinkronisasi.

**Rekomendasi:** Tambahkan `flight_duration_ms: payload.flightDurationMs` pada insert executor.

---

### A27 — 🟠 Semantik status `mudun` tidak konsisten (UI ↔ engine ↔ seed)

**Lokasi:** `schema.ts:33` & `rls.sql:100` (status sah `mudun|putus|menang`), `layangan.ts:16` (tipe hanya `"menang" | "putus"`), `LayanganPanel.svelte:481-512` (tombol "Catat MUDUN" menyimpan **`menang`**), `LayanganPanel.svelte:49-51` (`normalizeStatus`: `mudun`→`menang` hanya untuk tampilan), `engine.ts:111-118` (win hanya `status === "menang"`), `generator.ts:281` (seed demo memilih acak `mudun|putus|menang`).

**Deskripsi:** UI hanya pernah menulis `menang`/`putus` (tombol berlabel MUDUN menyimpan nilai `menang`), sementara DB mengenal tiga nilai dan engine menghitung menang hanya dari string `menang`. Seed demo memakai `mudun` acak → baris `mudun` **tidak dihitung sebagai kemenangan** di leaderboard demo, padahal panel menampilkannya sebagai MUDUN (via `normalizeStatus`). Nilai `mudun` efektif mati di data live dan inkonsisten di data demo; ARCHITECTURE §7 menulis state machine `aktif → mudun|putus` dengan status per babak `mudun|putus|menang` — tanpa definisi operasional ketiganya.

**Dampak:** Demo leaderboard undercount menang; semantik hasil ambigu (apa bedanya mudun vs menang?) → potensi sengketa penjurian.

**Rekomendasi:** Tetapkan definisi kanonik (mis. `menang` = mengalahkan lawan; `mudun` = turun/mengundurkan diri tanpa lawan) lalu samakan: engine menghitung sesuai definisi, seed demo berhenti memakai nilai acak, label tombol ↔ nilai DB konsisten, atau hapus nilai yang tidak dipakai dari check constraint.

---

### A28 — 🟠 Papan aduan mengakumulasi semua babak — tidak ada "reset"

**Lokasi:** `layangan.ts:56-81` (`getAllLayanganScores` tanpa filter round), `leaderboard.ts:55-66`, `LeaderboardBoard.svelte` & `DisplayScreen.svelte` (`computeRanking` atas seluruh entri), `admin.ts:150-153` (komentar: "board reset otomatis karena panel juri membaca `current_round`").

**Deskripsi:** `advanceRound` memang me-reset *working list* panel juri (karena membaca round aktif), tetapi leaderboard publik dan display besar menghitung kemenangan **lintas semua babak** — tidak ada filter babak di mana pun. Setelah babak 2 dimulai, penonton masih melihat akumulasi babak 1+2 dengan header "Ronde 2".

**Dampak:** Ekspektasi "papan reset tiap babak" (tersirat komentar admin & alur turnamen) tidak terjadi; klasemen babak berjalan menyesatkan; tidak ada cara melihat peringkat per babak.

**Rekomendasi:** Tambah mode tampilan (babak aktif vs kumulatif) di leaderboard/display dengan filter `round`, atau dokumentasikan dengan tegas bahwa papan aduan selalu kumulatif; sinkronkan komentar `admin.ts` dengan perilaku nyata.

---

### A29 — 🟠 Halaman juri: babak stale & kompetisi non-aktif ikut dimuat

**Lokasi:** `juri/mancing/+page.svelte:21,31-41`, `juri/layangan/+page.svelte:19,29-39`, `juri/layangan-hias/+page.svelte` (pola sama: `getCompetitions(false)` + `competitions[0]`, round dikirim sekali sebagai prop).

**Deskripsi:** (a) Kompetisi diambil sekali saat mount tanpa polling/realtime — bila admin menaikkan babak (A15) saat halaman juri terbuka, panel terus menulis hasil ke babak lama sampai reload; display membaca round baru, juri menulis round lama. (b) `getCompetitions(false)` menyertakan kompetisi non-aktif; karena seleksi hanya `[0]`, kompetisi yang sudah dimatikan bisa tetap menjadi target penilaian. Memperluas A3 (tanpa selektor) dan A15 (advance tanpa guard).

**Dampak:** Skor masuk babak yang salah; penilaian pada lomba yang seharusnya ditutup.

**Rekomendasi:** Subscribe perubahan `competitions` (realtime/polling 30 detik) + peringatan saat `current_round` berubah; filter `isActive` di halaman juri; tampilkan badge round aktif di panel.

---

### A30 — 🟡 RLS `payment_configs` hanya mengekspos metode aktif

**Lokasi:** `rls.sql:350-352` (policy select `using (is_active = true)`), `AdminPanel.svelte:197` (`getPaymentConfigs(false)` di tab Metode Pembayaran).

**Deskripsi:** Di mode live, policy SELECT hanya mengembalikan baris `is_active = true` — `getPaymentConfigs(false)` tidak bisa menembusnya. Begitu admin mematikan satu metode pembayaran (checkbox aktif → simpan), barisnya hilang dari daftar dan **tidak bisa diaktifkan kembali** lewat UI; satu-satunya jalan adalah UPDATE manual di database.

**Dampak:** Dead-end konfigurasi permanen; metode yang tak sengaja dimatikan tidak bisa dipulihkan panitia/admin di lapangan.

**Rekomendasi:** Policy select khusus jalur admin (RPC `get_payment_configs` SECURITY DEFINER) yang membaca semua baris, atau toggle via RPC tanpa perlu melihat baris non-aktif di muka; minimal dokumentasikan jebakan ini.

---

### A31 — 🟡 Pelunasan tunai diblokir setelah check-in; guard kuota onsite absen

**Lokasi:** `payment.ts:199-204` (`submitCashPayment`: "Peserta sudah check-in."), `ParticipantDetailCard.svelte:94-104` (tombol bayar tunai disembunyikan untuk `checked_in`), ARCHITECTURE §7:208-210 ("syarat masuk minimal dp_paid… sisa bayar ditagih panitia di check-in bila kuota masih ada").

**Deskripsi:** Spesifikasi mengamanatkan alur: peserta masuk dengan DP → panitia menagih sisa di check-in bila kuota masih ada. Implementasi justru memblokir pelunasan tunai begitu peserta berstatus `checked_in` — artinya setelah scan gerbang, panitia tidak bisa lagi mencatat sisa tunai (harus undo check-in dulu, A9 ikut bermain). Guard "kuota - pendaftar > 0" untuk sisa onsite juga tidak ada di mana pun (konsisten dengan A16/F1).

**Dampak:** Alur gerbang yang dirancang spesifikasi tidak bisa dijalankan; workaround undo-check-in menurunkan kepercayaan data.

**Rekomendasi:** Izinkan `submitCashPayment` untuk peserta `checked_in` (atau sediakan alur eksplisit "tagih sisa" di kartu detail), dan terapkan pengecekan sisa kuota sesuai §7 bila keputusan produknya demikian.

---

### A32 — 🟡 Kelemahan HiasPanel: undo noop, N+1 query, jendela edit offline

**Lokasi:** `HiasPanel.svelte:94-100` (`onUndo: () => {}` pada toast), `HiasPanel.svelte:43-57` (`getHiasScore` dipanggil sekuensial per peserta saat `load()`), `hias.ts:55-59,158-170` (jendela edit dari `editedAt ?? receivedAt`; untuk baris queued `received_at` diisi server saat sync).

**Deskripsi:** (1) Tombol Undo pada toast hias tidak melakukan apa-apa — berbeda dengan mancing/layangan yang benar-benar menghapus; UI menjanjikan undo yang tidak ada. (2) `load()` melakukan satu query Supabase per peserta secara berurutan (N+1) — lambat untuk puluhan peserta. (3) Bagian dari A23: `load()`/`select()` melempar saat offline → panel tak bisa dipakai. (4) Untuk skor yang diantrekan offline, jendela edit 5 menit dihitung dari `received_at` server (waktu drain), bukan waktu input juri — jendela bisa lebih pendek dari niat.

**Dampak:** UX juri hias tidak konsisten dengan panel lain; load lambat; rescore offline bisa tertolak tak terduga.

**Rekomendasi:** Implementasikan undo hias (delete dalam jendela), atau ubah toast tanpa tombol Undo; ganti N+1 dengan satu query per kompetisi; simpan waktu input client di payload sebagai basis jendela edit.

---

### A33 — 🟡 verify/reject live tanpa guard state

**Lokasi:** `admin.ts:450-462` (`verifyPayment`), `admin.ts:492-504` (`rejectPayment`).

**Deskripsi:** Kedua fungsi tidak memeriksa keadaan baris sebelum mutasi: baris yang sudah ditolak bisa diverifikasi, baris yang sudah terverifikasi bisa ditolak lagi. Di mode live tidak ada recalc `participants.status` (A2), sehingga reject-after-verify membiarkan status `fully_paid`/`dp_paid` menggembung padahal pembayarannya dibatalkan; verify-after-reject menghidupkan kembali baris tanpa jejak transisi.

**Dampak:** State machine pembayaran tidak terjaga; hasil keuangan bisa berubah tanpa terdeteksi.

**Rekomendasi:** Guard transisi di server (RPC): hanya `pending → verified | rejected`, dan `rejected → verified` dengan alasan eksplisit; recalc status peserta dalam operasi yang sama.

---

### A34 — 🟡 Kegagalan audit membatalkan aliran setelah mutasi sukses

**Lokasi:** `admin.ts:209-221` (`audit()` melempar bila insert gagal) dipanggil setelah mutasi utama di `verifyPayment`/`rejectPayment`/`saveCompetition`/`savePaymentConfig`/`advanceRound`.

**Deskripsi:** Audit ditulis setelah operasi utama berkomit. Bila insert `audit_logs` gagal (mis. jaringan berkedip), fungsi melempar → UI menampilkan "gagal" padahal verify/reject/save **sudah terjadi** dan tidak ada rollback. Admin mungkin mengulang aksi (untuk op non-idempoten seperti settle, pengulangan = masalah baru).

**Dampak:** Error palsu pasca-mutasi; potensi aksi ganda akibat retry panik.

**Rekomendasi:** Jadikan audit best-effort (tangkap error, simpan lokal + antrean) atau satukan dalam transaksi RPC bersama mutasi utama.

---

### A35 — 🟡 Realtime publication tidak dikonfigurasi → papan live mati senyap

**Lokasi:** `DisplayScreen.svelte:253-314` & `leaderboard/+page.svelte:81-114` (subscribe `postgres_changes`), `supabase/rls.sql` (tidak ada `alter publication supabase_realtime add table ...` di mana pun; `supabase/README.md` juga tidak menyebutnya).

**Deskripsi:** Display dan leaderboard publik bergantung pada Supabase Realtime, tetapi tabel-tabel skor/peserta/kompetisi tidak pernah dimasukkan ke publication `supabase_realtime` — tanpa langkah manual itu, event tidak akan pernah menyala. Fallback: display masih refresh lewat siklus 30 detik (`DISPLAY_CYCLE_MS`), tetapi leaderboard publik **tidak punya polling sama sekali** (hanya tombol manual + flap `online`).

**Dampak:** Papan skor "live" bisa diam-diam basi di hari-H; penonton melihat data lama tanpa indikator.

**Rekomendasi:** Tambahkan `alter publication` ke `rls.sql`/README sebagai langkah deployment wajib (lihat desain §8 dokumen peserta); beri leaderboard fallback polling (mis. 30 detik) dan indikator "last updated".

---

### A36 — 🟡 Daftar peserta panel juri statis setelah mount

**Lokasi:** `MancingPanel.svelte:48-52`, `HiasPanel.svelte:59-61`, `LayanganPanel.svelte:91-93` (`onMount` fetch sekali, tanpa refresh).

**Deskripsi:** Peserta dimuat sekali saat panel dibuka. Peserta yang mendaftar live, diimport admin, atau baru diberi `lapak_number` setelahnya tidak muncul sampai halaman juri di-reload; tidak ada tombol refresh. Untuk mancing ini memperparah A13 (BIB baru tetap "belum terdaftar").

**Dampak:** Juri tidak bisa menilai peserta baru tanpa ritual reload; lapak yang di-assign belakangan tidak terlihat.

**Rekomendasi:** Tombol refresh +/atau polling ringan (30–60 detik) + realtime pada `participants`; tampilkan waktu muat terakhir.

---

### A37 — 🟡 PIN: plaintext di bundle, fallback senyap ke DEMO_PIN, satu PIN tiga peran

**Lokasi:** `env.ts:22-24` (`PUBLIC_*_PIN` di-inline `$env/static/public`), `pin.ts:39-43` (`pinForKind` mengembalikan plaintext), `pin.ts:162-168` (`configured ? sha256Hex(configured) : demoPinHash()`), `pin.ts:11` (`DEMO_PIN = "123456"`), `.env` (JURI=PANITIA=ADMIN=`123123`).

**Deskripsi:** ARCHITECTURE §6 mitigasi 1 menyatakan "PIN dibundel sebagai SHA-256 hash, bukan plaintext" — implementasi justru meng-inline PIN plaintext ke bundle dan meng-hash saat runtime; siapa pun bisa grep PIN dari berkas JS. Bila `PUBLIC_*_PIN` kosong saat build, `verifyPin` fallback **senyap** ke `DEMO_PIN "123456"` tanpa peringatan build (env.ts hanya memperingatkan `BASE_URL`). `.env` saat ini memakai satu PIN yang sama untuk juri/panitia/admin → tidak ada pemisahan peran. Grant & lockout berbasis sessionStorage → incognito/tab baru mereset penghitung percobaan.

**Dampak:** Gate PIN lebih lemah dari mitigasi yang diklaim spesifikasi; salah konfigurasi env = PIN default di produksi tanpa disadari.

**Rekomendasi:** Bundel hanya hash (`PUBLIC_*_PIN_HASH`), build gagal/warn keras bila PIN kosong, isi PIN berbeda per peran, terima & dokumentasikan batas lockout per-browser (konsisten dengan posture §6).

---

### A38 — 🟡 Bucket `proof-images`: anon insert + public read

**Lokasi:** `rls.sql:160-172` (bucket public, limit 5 MB, image MIME), `rls.sql:447-455` (policy select publik + insert anon), `payment.ts:138-146` (path `proofs/{participantId}/{Date.now()}.{ext}` + `getPublicUrl`).

**Deskripsi:** Bucket bukti transfer dapat ditulis oleh siapa pun yang memegang anon key (tanpa batas jumlah), dan seluruh isinya dapat dibaca publik. Bukti transfer memuat nama/nomor rekening — PII — dengan pola path yang sebagian tertebak (participantId UUID + timestamp ms).

**Dampak:** Abuse biaya penyimpanan/moderasi; eksposur bukti pembayaran peserta.

**Rekomendasi:** Ketatkan path/prefix insert, pertimbangkan rate-limit via RPC upload, buat objek privat dengan signed URL untuk panel admin, atau minimal path tak tertebak (UUID penuh, bukan `Date.now()`).

---

### A39 — 🟡 Import CSV: kuota hanya saat preview, tanpa audit, tanpa decrement

**Lokasi:** `participantImport.ts:356-381` (cek kuota pada snapshot preview), `participantImport.ts:403-490` (eksekusi: re-fetch hanya untuk dedupe).

**Deskripsi:** Kuota divalidasi terhadap snapshot saat preview; saat eksekusi yang di-re-check hanya duplikat, bukan kuota — registrasi live yang masuk di antara preview dan eksekusi bisa membuat kuota terlampaui. Import juga tidak menulis `audit_logs` (siapa mengimport apa tidak terlacak) dan tidak men-decrement kuota (konsisten A16/F1). Kegagalan parsial = sebagian terimport dengan laporan error per baris (tanpa rollback) — perilaku ini wajar, tetapi perlu dipahami operator.

**Dampak:** Oversubscribe via import; tidak ada jejak audit batch import.

**Rekomendasi:** Re-check kuota atomik saat eksekusi (RPC), tulis satu entri audit per batch (payload ringkas), pertahankan laporan parsial dengan pesan jelas.

---

### A40 — ℹ️ Dead code elemen §5: tombstone recompute, draft-restore, high-water, fetch-report

**Lokasi:** `sync.ts:58-101` (`applyTombstones`, `checkDraftRestore`), `reconcile.ts` (high-water), `networkStore.ts:12-18` (`reportFetchSuccess/Failure`) — semuanya hanya diimpor oleh test.

**Deskripsi:** ARCHITECTURE §5 menjanjikan high-water reconcile (delta re-sync), tombstone + recompute `running_total` untuk undo-after-sync, dan koreksi status online dari hasil fetch. Semuanya terimplementasi dan teruji unit, tetapi tidak terhubung ke jalur produksi: papan selalu full-fetch, undo pasca-sync menunggu delete server (A25), status online hanya dari event browser (navigator.onLine dikenal tidak andal). Padanan sisi peserta: F22/F25.

**Dampak:** Deviasi spesifikasi tanpa bug langsung; utilitas terawat tapi tak terpakai.

**Rekomendasi:** Hubungkan bertahap (prioritas: pemetaan kunci→UUID A25, lalu cache peserta A23), atau amandemen ARCHITECTURE §5 untuk mengakui simplifikasi.

---

### A41 — ℹ️ Flag demo terkunci build-time — risiko produksi berjalan demo

**Lokasi:** `demo/store.ts:4` (`demoMode = writable(env.enableDemoMode === "true")`), tidak ada pemanggil `toggleDemoMode`/`setDemoMode` di UI, `.env` saat ini `PUBLIC_ENABLE_DEMO_MODE="true"`.

**Deskripsi:** Mode demo ditentukan saat build tanpa toggle runtime dan tanpa indikator visual menonjol. Bila build hari-H terbawa flag `true`: seluruh panel admin/panitia/juri bekerja di atas seed + IDB lokal per perangkat — verifikasi pembayaran, check-in, dan skor tidak pernah menyentuh Supabase, dan setiap perangkat punya "kebenaran" sendiri. Tidak ada peringatan apa pun di UI admin.

**Dampak:** Kegagalan operasional senyap berskala penuh bila flag salah saat build rilis.

**Rekomendasi:** Checklist rilis: `PUBLIC_ENABLE_DEMO_MODE=false` + uji asap lintas peran; banner "MODE DEMO" mencolok bila aktif; pertimbangkan toggle runtime ber-PIN admin untuk gladi resik.

---

### A42 — 🔴 `rls.sql` invalid — artefak deployment Batch 1 rusak (review R1)

**Lokasi:** `supabase/rls.sql:1023-1025` (`create policy "proof_images anon insert" on storage.objects for insert to anon` — tanpa `with check`, langsung disambung blok seksi 7) dan `:1097` (`with check (bucket_id = 'proof-images');` yatim setelah `revoke delete`).

**Deskripsi:** Commit B1-8 (`0de0cdc`) menyisipkan blok data-lock pasca-acara di TENGAH statement `create policy` storage.objects yang utuh sejak `ebb616d`. Akibatnya file berisi satu statement gabungan `create policy ... for insert to anon create table if not exists data_lock ...` yang gagal parse; tabel `data_lock` tak pernah terbuat; `insert into data_lock` gagal; fungsi `data_lock_is_locked()` (dipanggil semua RPC tulis: submit/resubmit/verify/reject/register/check_in/delete_score/set_data_lock) melempar `relation "data_lock" does not exist` saat runtime. Dalam transaksi tunggal (dashboard) seluruh apply rollback; dalam psql default sebagian jalan — dua-duanya rusak.

**Dampak:** Human queue "apply rls.sql" (semua item B1-*, B3-7, B4-3) tidak bisa dijalankan aman; bila dipaksa, mode live mati total (semua tulis RPC gagal) atau kebijakan keamanan tak terpasang.

**Rekomendasi:** (1) Tutup statement policy dengan `with check (bucket_id = 'proof-images');` SEBELUM blok data-lock (pindahkan fragmen yatim baris 1097 ke bawah `for insert to anon`); (2) validasi file dengan parser SQL sebelum diserahkan ke human queue; (3) tambah langkah "apply rls.sql di proyek uji" ke checklist pra-acara.

---

### A43 — 🟠 `submit_payment` menolak pelunasan "sisa < min_dp" — deadlock tagih sisa (review R1)

**Lokasi:** `supabase/rls.sql:525-535` (guard `p_amount <> v_fee → wajib >= v_min_dp dan kelipatan 500`), `src/lib/db/payment.ts:339-395` (`submitCashPayment` menghitung `remaining` lalu via RPC yang sama), `src/lib/components/RegistrantProfile.svelte:281-285` (blokir overpayment di client).

**Deskripsi:** B2-1/A31 membuat alur "lanjut lunas menagih sisa" dan B2-5 mengizinkan pelunasan `checked_in` di gerbang. Tapi RPC `submit_payment` menolak setiap nominal yang bukan fee penuh bila `< min_dp`. Contoh nyata: fee 100rb, min_dp 50rb, peserta DP terverifikasi 60rb → sisa 40rb. Jalur buntu semua: bayar sisa 40rb ditolak server (`below_min_dp`); bayar fee 100rb diblokir client (melebihi sisa); bayar tunai gerbang memakai RPC yang sama → juga ditolak. Peserta tak bisa lunas tanpa intervensi manual DB.

**Dampak:** Alur uang peserta macet pada kondisi yang cukup umum (DP dibayar lebih dari `fee - min_dp`); panitia harus menolak-lalu-catat-ulang manual.

**Rekomendasi:** Khususkan guard di RPC: izinkan `p_amount` berapa pun bila peserta sudah punya pembayaran terverifikasi DAN `p_amount <= fee - total_verified` (pelunasan sisa), tetap tolak di atasnya; atau tambah parameter `p_is_settlement` dari client yang diverifikasi server. Uji: kasus sisa < min_dp di `payment.test.ts`.

---

### A44 — 🟠 Undo skor hias LIVE mati senyap — endpoint executor & whitelist RPC tak ada (review R1)

**Lokasi:** `src/lib/db/hias.ts:250-268` (`removeHiasScore` enqueue `/rest/scores/layangan-hias/delete`), `src/lib/offline/executor.ts` (default case → `"error"`), `supabase/rls.sql:985` (whitelist `delete_score` hanya `scores_mancing`, `scores_layangan`).

**Deskripsi:** B4-8 mengaitkan undo nyata HiasPanel: demo menghapus lokal (jalan), live men-enqueue tombstone delete. Tapi (a) executor tidak punya case `/rest/scores/layangan-hias/delete` — op mengembalikan `"error"`, retry sampai `RETRIES_CAP` lalu dead; dan (b) seandainya case ditambahkan meniru mancing/layangan, RPC `delete_score` menolak tabel hias (whitelist). Komentar `hias.ts` mengakui ("executor belum punya endpoint delete hias — catat utk lanjutan") tetapi FIX-TRACKER B4-8 tidak mencatatnya sebagai carryover — status DONE diberikan untuk jalur live yang tidak berfungsi. Toast "Skor hias dibatalkan" tetap tampil.

**Dampak:** Juri hias yang meng-undo skor di mode live melihat sukses palsu; papan skor mempertahankan nilai yang dikira sudah dibatalkan (ghost score kebalikan A25).

**Rekomendasi:** Tambah case `/rest/scores/layangan-hias/delete` di executor + perluas whitelist `delete_score` ke `scores_layangan_hias`, lalu uji tombstone hias di `executor.test.ts`; ATAU tandai B4-8 live = carryover eksplisit sampai keduanya ada.

---

### A45 — 🟡 Gate lint repo merah; 2 file terakhir disentuh rawe3 Batch 4 (review R1)

**Lokasi:** `bun run lint` EXIT 1 pada `package.json`, `static/manifest.webmanifest` (utang lama, terakhir disentuh `ebb616d`/sebelumnya) dan `src/lib/components/__tests__/AdminPanel.test.ts` (terakhir `7090b20` B4-1), `src/lib/db/queries.ts` (terakhir `c42a9b7` B4-3).

**Deskripsi:** Tracker mengklaim "lint 0" per batch, tetapi konvensi gate adalah lint *scoped*; pada state akhir HEAD, lint repo penuh gagal format di 4 file — 2 di antaranya file yang terakhir diubah commit rawe3 Batch 4. Berarti perubahan Batch 4 meninggalkan drift format yang tak tertangkap (kemungkinan lint scoped dijalankan sebelum edit terakhir, atau file di luar path scoped).

**Dampak:** Gate kualitas merah di HEAD; `bun run lint` gagal; preseden buruk untuk disiplin gate.

**Rekomendasi:** `bunx biome check --write` pada keempat file (sekali jalan), lalu pertahankan `bun run lint` repo-penuh sebagai gate akhir batch (bukan hanya scoped).

---

### A46 — 🟡 B2-4 tanpa test perilaku baru + klaim FILES tak akurat (review R1)

**Lokasi:** commit `ebdfb94` (item B2-4).

**Deskripsi:** B2-4 mengubah perilaku publik: `checkInParticipant` kini mengembalikan `queued?: boolean` dan `ParticipantDetailCard` menampilkan badge "Menunggu sinkron". Commit tidak menyentuh satu pun file test (grep `queued` di `checkin.test.ts` & `ParticipantDetailCard.test.ts` = 0 hasil) — melanggar aturan 11 tracker ("perubahan perilaku = test baru/update", konvensi tdd-guard). Selain itu baris FILES item menyebut `payment.ts`, `AdminPanel.svelte`, dan "test" padahal commit hanya mengubah `checkin.ts` + `ParticipantDetailCard.svelte` (scope tercatat lebih luas dari nyata — arah yang kurang berbahaya, tapi tetap tidak akurat untuk audit).

**Dampak:** Regresi pada jalur queued/optimistik tidak terdeteksi suite; jejak audit scope meleset.

**Rekomendasi:** Tambah test: (a) `checkInParticipant` offline mengembalikan `queued:true` + record lokal; (b) badge tampil saat `submitCashPayment` queued; perbarui disiplin FILES (hanya file yang benar-benar disentuh).

---

### A47 — 🟡 Seed demo layangan masih acak `mudun` — undercount menang di demo (review R1)

**Lokasi:** `src/lib/demo/generator.ts:282` (`status: pick(["mudun", "putus", "menang"])`).

**Deskripsi:** Keputusan produk B3-5 (A27) menetapkan engine menghitung win hanya dari `status === "menang"`; UI live menulis `menang` (tombol MUDUN), `putus`, dan `dq`. Tetapi seed demo masih menabur nilai `mudun` acak, yang tidak dihitung menang oleh engine — persis inkonsistensi demo yang disebut A27 ("seed demo berhenti memakai nilai acak"). B3-5 tidak menyentuh generator.

**Dampak:** Leaderboard demo undercount kemenangan aduan; gladi resik/demo hari-H menampilkan semantik yang salah.

**Rekomendasi:** Ganti seed ke `pick(["menang", "putus", "dq"])` (atau bobot sesuai skenario gladi) di `generator.ts`, jalankan ulang test engine/leaderboard.

---

## Audit alur end-to-end per peran (v2)

Checklist edge case hasil penelusuran penuh tiap peran. Kolom "Status" merujuk temuan; ✅ = perilaku sudah benar/diverifikasi saat audit.

### Admin (`/admin`, PIN admin)

| Langkah | Edge case yang diuji | Status |
|---|---|---|
| Buka panel, muat 5 sumber data paralel | Salah satu fetch gagal → error tunggal ditampilkan, data lain tetap terisi | ✅ |
| Tab Verifikasi: filter status/metode/lomba | Baris rejected punya alasan; verify tanpa syarat bukti | A11, A33 |
| Klik baris → modal detail + bukti | Bukti tidak ada → teks "Belum ada bukti"; verify tetap mungkin | A11, A20 |
| Verifikasi pembayaran | Status peserta tidak di-recalc (live); audit bisa gagal pasca-mutasi | A2, A34 |
| Tolak pembayaran | Alasan wajib ✅; baris terverifikasi bisa ditolak tanpa recalc | A33 |
| Lunas (settle) dari baris verified | Sisa dihitung dari verified saja; pending tak diperingatkan; checked_in → throw | A8, A31 |
| Tab Kompetisi: edit fee/kuota/mode/aktif | `min_dp` tidak bisa diedit & tak dipersist | A5 |
| Babak berikutnya (aduan) | Tanpa guard "semua dinilai", tanpa undo; juri stale | A15, A29 |
| Tab Metode Pembayaran | Menonaktifkan metode = baris hilang selamanya (RLS) | A30 |
| Tab Sponsor | CRUD publik via RLS (siapa pun bisa mengubah) | A18 |
| Import CSV | Kuota snapshot-only, tanpa audit, tiket `Date.now()%1M` | A7, A39 |
| Tab Panitia (check-in manual) | Tombol check-in untuk peserta belum layak; undo downgrade status | A10, A9 |
| Data lock pasca-acara | Tidak ada di app | A17 |

### Panitia (`/panitia/checkin`, PIN panitia)

| Langkah | Edge case yang diuji | Status |
|---|---|---|
| Pilih filter lomba + statistik | Statistik mengecualikan disqualified/rejected (definisi konsisten) | ✅ |
| Scan QR tiket | QR tak dikenal → pesan jelas; peserta lomba lain → ditolak dengan nama lomba | ✅ |
| Entry manual nomor tiket | Case dinormalisasi; format RA- vs T- tidak konsisten | F10 |
| Kartu detail peserta | Pending diperingatkan ✅; rejected memblokir dengan alasan ✅; tombol check-in aktif untuk peserta belum layak | A10 |
| Bayar tunai sisa (pre-check-in) | Menghitung sisa dari verified ✅; checked_in diblokir | A31 |
| Bayar tunai saat offline | Enqueue ✅ tapi error palsu + sisa basi setelahnya | F16 |
| Check-in | Status derived ✅ (aman); offline enqueue tanpa record lokal | F7, A22 |
| Undo check-in (via admin) | Downgrade status, tanpa audit | A9, A21 |
| Perangkat tanpa kamera | Fallback entry manual tersedia | ✅ |

### Juri (`/juri/*`, PIN juri)

| Langkah | Edge case yang diuji | Status |
|---|---|---|
| Buka `/juri` → pilih event | Index event ✅; PIN per-kind | ✅ |
| Halaman memilih kompetisi | `[0]` tanpa selektor; kompetisi non-aktif ikut | A3, A29 |
| Mancing: pilih BIB | Hardcode 1–100; kosong tetap bisa dipilih; daftar statis | A13, A36, A1 |
| Mancing: input gram (maks 6 digit) | Validasi > 0 ✅; tampilan kg ✅ | ✅ |
| Mancing: jackpot | Konfirmasi jackpot kedua ✅ (online); offline terblokir | A24 |
| Mancing: undo 5 detik | Queued+synced → tombstone salah kunci | A25 |
| Aduan: timer + MUDUN/PUTUS | Timer wajib sebelum hasil ✅; label MUDUN menyimpan `menang`; multi-device tanpa guard DB | A27, A6 |
| Aduan: hasil babak | Offline menjatuhkan durasi; load awal gagal offline | A26, A23 |
| Hias: slider 3 kriteria + jendela edit | Default 80/80/80 (risiko lupa ubah); undo noop; N+1 query; pembulatan vs papan | A32, A12 |
| Semua panel: indikator offline | Badge "Offline — antrean" ada di ketiga panel | ✅ |
| Identitas pelaku | `recordedBy` = hash PIN bersama (semua juri satu identitas) | A14 |

### Display & Leaderboard (`/display` PIN admin, `/leaderboard` publik)

| Langkah | Edge case yang diuji | Status |
|---|---|---|
| Display: siklus antar-kompetisi 30 dtk | Refresh terjadwal ✅ (fallback realtime) | ✅ |
| Display: realtime | Publication belum dikonfigurasi | A35 |
| Display: offline | Data terakhir ditampilkan + badge "Luring" | ✅ |
| Display: wake lock + TTS pengumuman | Wake lock re-acquire saat visible ✅; TTS graceful bila unsupported | ✅ |
| Leaderboard publik: refresh | Hanya manual + realtime + flap online (tanpa polling) | A35 |
| Papan aduan lintas babak | Akumulasi semua babak, tak ada filter | A28 |
| Papan jackpot | Bercampur papan utama (rank 1) | A4 |
| Papan hias | Total desimal di papan vs bulat di panel | A12 |

---

## Cross-check spesifikasi ARCHITECTURE vs implementasi (v2)

| # | Spesifikasi | Status | Catatan / temuan |
|---|---|---|---|
| 1 | §6.1 PIN dibundel sebagai hash, bukan plaintext | ❌ Melanggar | Plaintext ter-inline; hash saat runtime; fallback `123456` senyap (A37) |
| 2 | §6.2 RLS pembatas + audit + hash | ⚠️ Parsial | Audit ada untuk pembayaran/kompetisi, tidak untuk check-in/skor juri (A21, A14) |
| 3 | §6.3 Tanpa service role key | ✅ Sesuai | Semua via anon key; konsekuensi: policy publik (F4, A18) |
| 4 | §6.4 Data lock pasca-acara | ❌ Belum ada | Hanya langkah manual README (A17) |
| 5 | §7 Kuota atomik decrement | ❌ Belum ada | Hanya demo & import preview (F1, A16, A39) |
| 6 | §7 Jackpot kategori terpisah | ❌ Melanggar | Bercampur di rank atas (A4) |
| 7 | §7 Tie-break `received_at` server | ✅ Sesuai | Engine memakai `receivedAt` baris DB |
| 8 | §7 State machine aduan `mudun\|putus\|menang` | ⚠️ Parsial | `mudun` tak pernah ditulis UI; semantik ambigu (A27) |
| 9 | §7 "Board reset" saat advance round | ⚠️ Parsial | Hanya panel juri; leaderboard/display akumulatif (A28) |
| 10 | §7 Sisa bayar ditagih di check-in bila kuota ada | ❌ Melanggar | Diblokir setelah check-in; guard kuota absen (A31) |
| 11 | §7 Bukti dikompres ≤200 KB | ✅ Sesuai | `imageCompressor` 200 KB/1280px + fallback jpeg |
| 12 | §7 Draft-restore cek existing dulu | ❌ Belum terhubung | `checkDraftRestore` dead code (F22) |
| 13 | §5 Undo-after-sync tombstone + recompute | ⚠️ Parsial | Tombstone ada tapi salah kunci bila queued (A25); recompute dead code (A40) |
| 14 | §5 High-water delta re-sync | ❌ Belum terhubung | Dead code; selalu full-fetch (A40, F25) |
| 15 | §2 `/display` proteksi lemah (kosmetik) | ✅ Sesuai | PinGate admin, diakui kosmetik |
| 16 | §8 SPA fallback deep-link | ✅ Sesuai | Service worker + adapter-static |

---

## Rekomendasi berprioritas (v2)

**P0 — sebelum acara (fraud / sabotase / alur utama mati):**
1. Cabut DELETE publik skor & sponsor; write sponsor via RPC admin (A18).
2. Tutup UPDATE/INSERT publik via RPC SECURITY DEFINER: verifikasi/tolak bayar, check-in, skor (F4 dokumen peserta; terkait A2, A33).
3. Implementasi data lock — minimal jalankan langkah README sebagai prosedur tertulis + flag app (A17).
4. `flight_duration_ms` di executor layangan (A26) — satu baris, dampak tie-break nyata.
5. Fix tombstone undo queued (pemetaan kunci → UUID / delete by idempotency_key) (A25).
6. Realtime publication + fallback polling leaderboard (A35).
7. **R1: Perbaiki `rls.sql` invalid (A42) SEBELUM human apply — tanpa ini semua item SQL di atas tak terpasang aman.**
8. **R1: Atasi deadlock pelunasan sisa < min_dp di `submit_payment` (A43).**
9. **R1: Endpoint undo hias live — executor case + whitelist RPC (A44).**

**P1 — selama acara (kebingungan / salah skor):**
7. Panel juri offline-safe: cache peserta lokal, refetch pasca-submit opsional, jackpot offline lolos (A23, A24).
8. Halaman juri: filter aktif + deteksi perubahan round (A29, A3).
9. Settle: peringatkan pending (A8), izinkan pasca-check-in atau alur "tagih sisa" (A31).
10. Audit untuk check-in/undo + simpan pelaku (A21); audit best-effort (A34).
11. Papan aduan per-babak vs kumulatif + semantik `mudun` (A28, A27).
12. Jackpot kategori terpisah di papan (A4); pembulatan hias diseragamkan (A12).
13. Refresh daftar peserta panel juri (A36, A13: option dari data aktual).

**P2 — perbaikan lanjutan:**
14. Guard advance round + jumlah belum dinilai (A15); `min_dp` editable + persist (A5).
15. RLS `payment_configs` jalur admin (A30); storage bucket diketatkan (A38).
16. PIN: hash-only bundle + build warning + PIN beda peran (A37); identitas pelaku per-orang (A14).
17. Import: re-check kuota + audit batch (A39); kuota live atomik (A16).
18. HiasPanel: undo nyata, query batch, jendela edit berbasis waktu input (A32).
19. Hubungkan utilitas §5 atau amandemen spesifikasi (A40); banner mode demo + checklist rilis (A41).

---

## Checklist pra-acara (v2)

Verifikasi satu per satu sebelum hari-H; tiap item merujuk temuan terkait.

- [ ] `PUBLIC_ENABLE_DEMO_MODE=false` di build produksi (A41, F23 dokumen peserta).
- [ ] `PUBLIC_BASE_URL` benar (QR & wa.me) — build warning sudah ada, verifikasi manual tetap (env.ts).
- [ ] PIN juri/panitia/admin **berbeda** dan terisi (bukan fallback `123456`) (A37).
- [ ] `rls.sql` dijalankan idempoten + **realtime publication** ditambahkan (A35).
- [ ] Kebijakan DELETE skor/sponsor dicabut (A18) — atau keputusan sadar diterima + tercatat.
- [ ] Data lock: prosedur pasca-acara disepakati & diuji (A17, README §4 item terakhir).
- [ ] Bucket `proof-images` ada, public read, upload dari app menghasilkan URL bucket (README §2).
- [ ] Uji asap lintas peran: daftar → bayar → verify → check-in → skor juri → tampil di display/leaderboard (A23, A35).
- [ ] Uji offline minimal: 1 submit mancing + 1 check-in masuk antrean lalu tersinkron (F7, F16, A25).
- [ ] Gladi advance round aduan: juri reload, papan babak baru tampil (A15, A28, A29).
- [ ] Import CSV ujicoba (baris duplikat, kuota, BOM, delimiter) (A39, A7).
- [ ] Keputusan produk dicatat: e-tiket tanpa bayar (F13), semantik `mudun` (A27), sisa pasca-check-in (A31).