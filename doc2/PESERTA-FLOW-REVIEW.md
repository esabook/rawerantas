# Review End-to-End Alur Peserta — Temuan & Rekomendasi

> Tanggal: 2026-08-08 · **Update v2: 2026-08-08** (audit penuh lanjutan) · **Review ulang R1: 2026-08-09** (verifikasi hasil eksekusi rawe3) · Scope: alur peserta end to end
> Tidak ada perubahan kode dari review ini — murni dokumen temuan & rekomendasi.
> v2 menambahkan: temuan F14–F25, koreksi F3, matriks perjalanan peserta end-to-end (online/offline), perluasan desain penutupan (RPC, idempotensi, storage, realtime, flag demo), dan roadmap prioritas. Dokumen pendamping: `ADMIN-PANITIA-JURI-REVIEW.md`.
> **R1 (2026-08-09):** semua temuan F1–F25 telah dieksekusi rawe3 dan diverifikasi ulang — status per-temuan di seksi "Status pasca-fix rawe3 (R1)" di bawah; matriks resumable di `doc2/REVIEW-TRACKER.md`.

## Ruang lingkup yang ditinjau

Alur peserta end-to-end beserta lapisan yang mendukungnya:

| Area | File utama |
|---|---|
| Pendaftaran & login guest | `src/routes/(app)/daftar/+page.svelte`, `src/lib/components/RegistrationForm.svelte`, `src/lib/db/register.ts` |
| Profil & status pendaftaran | `src/lib/components/RegistrantProfile.svelte`, `src/lib/offline/guestSession.ts` |
| Pembayaran (DP/lunas, upload bukti) | `src/lib/db/payment.ts`, `src/lib/components/PaymentMethodSelector.svelte`, `src/lib/components/ImageUploader.svelte` |
| E-tiket & QR | `src/routes/(app)/tiket/[id]/+page.svelte`, `src/lib/components/TicketCard.svelte`, `src/lib/components/QRCode.svelte`, `src/lib/utils/whatsapp.ts` |
| Check-in panitia | `src/routes/(app)/panitia/checkin/+page.svelte`, `src/lib/components/CheckinScanner.svelte`, `src/lib/components/ParticipantDetailCard.svelte`, `src/lib/db/checkin.ts` |
| Persetujuan admin (verifikasi/tolak bayar) | `src/lib/db/admin.ts` |
| Offline engine | `src/lib/offline/queue.ts`, `src/lib/offline/executor.ts`, `src/lib/offline/sync.ts`, `src/lib/offline/draftStore.ts` |
| Keamanan data (RLS) | `supabase/rls.sql`, `src/lib/env.ts`, `src/lib/security/pin.ts` |

---

## Ringkasan temuan

| # | Severitas | Isu | File |
|---|---|---|---|
| F1 | 🔴 High | Kuota tidak ditegakkan di mode live | `register.ts:107` |
| F2 | 🔴 High | Kolisi nomor tiket `Date.now() % 1_000_000` | `register.ts:121`, `executor.ts:193` |
| F3 | 🔴 High | Duplikasi registrasi live (tanpa guard pra-insert) | `register.ts`, `schema.ts` |
| F4 | 🔴 High | RLS memampukan UPDATE/INSERT publik menyeluruh | `rls.sql` |
| F5 | 🟠 Medium | Kolom `participants.status` melenceng dari pembayaran | `payment.ts:165`, `admin.ts` |
| F6 | 🟠 Medium | Overpayment saat lanjut lunas (tagih fee penuh, bukan sisa) | `RegistrantProfile.svelte`, `payment.ts:73` |
| F7 | 🟠 Medium | Check-in offline tidak mencatat lokal di mode live | `checkin.ts:246` |
| F8 | 🟠 Medium | **Tidak ada jalur resubmit** pembayaran yang ditolak di UI | `RegistrantProfile.svelte` `openPayment` |
| F9 | 🟡 Low | `executePayment` tidak memeriksa hasil update status | `executor.ts:166-171` |
| F10 | 🟡 Low | Nomor tiket format tidak konsisten (RA- vs T-) | `CheckinScanner.svelte`, `register.ts:103` |
| F11 | 🟡 Low | `undoCheckIn` selalu set `dp_paid` meski sebelumnya lunas | `admin.ts:377` |
| F12 | 🟡 Low | Jalur offline (executor) tidak tegas kuota & validasi | `executor.ts` |
| F13 | 🟡 Low | E-tiket bisa dibuka tanpa pembayaran apa pun (hanya ditolak yang diblokir) | `tiket/[id]/+page.svelte` |
| F14 | 🔴 High | Pembayaran tanpa idempotency → double-tap/retry/drain = baris pembayaran ganda | `payment.ts`, `executor.ts` |
| F15 | 🟠 Medium | Gagal upload bukti ditelan diam-diam → bayar "tercatat" tanpa bukti → deadlock (×F8) | `payment.ts:139-148` |
| F16 | 🟠 Medium | Check-in/settle offline tanpa state lokal → error palsu & risiko tagih dobel (lanjutan F7) | `ParticipantDetailCard.svelte`, `payment.ts` |
| F17 | 🟠 Medium | Teks UI menjanjikan "kirim ulang pembayaran" padahal semua jalur diblokir (×F8) | `RegistrantProfile.svelte:596-602` |
| F18 | 🟠 Medium | Mode lunas menimpa nominal dengan fee penuh — mekanisme F6 | `payment.ts:67-83` |
| F19 | 🟡 Low | `checked_in` dilabeli "Lunas"/"Siap bertanding" padahal sisa bayar masih ada | `RegistrantProfile.svelte`, `TicketCard.svelte` |
| F20 | 🟡 Low | Login guest hanya nomor WA; `/tiket/[id]` tanpa cek kepemilikan (privasi) | `daftar/+page.svelte`, `tiket/[id]/+page.svelte` |
| F21 | 🟡 Low | Restore profil offline menghapus sesi guest (logout paksa saat sinyal jelek) | `daftar/+page.svelte:42-64` |
| F22 | 🟡 Low | Cek draft-restore §7 (`checkDraftRestore`) belum terhubung di form | `sync.ts:91-101`, `RegistrationForm.svelte` |
| F23 | 🟡 Low | Build dengan `PUBLIC_ENABLE_DEMO_MODE=true` → pendaftaran/pembayaran hanya tersimpan lokal | `demo/store.ts:4`, `.env` |
| F24 | 🟡 Low | Kunci antrean pembayaran pakai `Date.now()` → tanpa dedupe server, drain bisa duplikat (×F14) | `payment.ts:172-186` |
| F25 | ℹ️ Info | High-water reconcile & tombstone tidak dipakai di jalur baca (deviasi §5) | `reconcile.ts`, `sync.ts:58-82` |

---

## Detail temuan

### F1 — 🔴 Kuota tidak ditegakkan di mode live

**Lokasi:** `src/lib/db/register.ts:107` (`registerParticipant`), `src/lib/offline/executor.ts:175` (`executeRegister`).

**Deskripsi:** ARCHITECTURE §7 mensyaratkan pengurangan kuota secara atomik:

```sql
UPDATE competitions SET total_quota = total_quota - 1
WHERE id = :id AND total_quota > 0 RETURNING id;
```

Namun implementasi live `registerParticipant` hanya melakukan `insert` ke `participants` tanpa mengecek/decrement `total_quota`. Kuota hanya ditegakkan di mode demo (`registerParticipantDemo`, `register.ts:193-199`) dan di `participantImport.ts:371`. Akibatnya di produksi peserta bisa mendaftar melebihi kuota tanpa batasan.

**Dampak:** Kuota lomba bisa oversubscribe; slot tidak terdistribusi adil.

**Rekomendasi:** Tegakkan kuota di server (lihat desain RPC di bagian khusus). Atomik `UPDATE ... RETURNING` dalam satu transaksi bersama insert peserta, atau RPC `register_participant` (SECURITY DEFINER) yang: cek kuota → decrement → insert → kembalikan tiket. Jalur offline `executeRegister` harus ikut pakai RPC yang sama + idempotency key.

---

### F2 — 🔴 Kolisi nomor tiket

**Lokasi:** `src/lib/db/register.ts:121` & `src/lib/offline/executor.ts:193`:

```ts
ticket_number: nextTicketNumber(Date.now() % 1_000_000)
```

**Deskripsi:** `Date.now() % 1_000_000` menghasilkan nomor berbasis waktu (ms). Dua pendaftaran di milidetik yang sama → nomor sama → melanggar `ticket_number unique` (error 23505). Nomor juga akan *wrap* kembali ke 0 setelah melewati 1.000.000 (≈ 16,7 menit dalam bentuk ms), sehingga bentrok antar waktu. Error 23505 **bukan** `isOfflineError`, sehingga di `register.ts` blok `catch` akan melempar error ke pengguna (daftar gagal) ketimbang menganggap duplikat.

**Dampak:** Pendaftaran gagal secara acak saat beban tinggi; risiko dobel-slot.

**Rekomendasi:** Gunakan `ULID`/`ulid` monotonic, atau sequence/`gen_random_uuid` + counter, atau ber-*retry* dengan counter saat terjadi kolisi. Nomor tiket sebaiknya di-generate/di-assign di server (RPC) agar deterministik dan bebas kolisi.

---

### F3 — 🔴 Duplikasi registrasi live

**Lokasi:** `src/lib/db/schema.ts` (tabel `participants` — drizzle hanya mendeklarasikan `ticket_number` unique); `register.ts:107` (duplikat hanya dicek di blok `catch`). **KOREKSI v2:** `supabase/rls.sql:144-145` ternyata MEMBUAT `create unique index if not exists participants_competition_phone_idx on participants(competition_id, phone)` — guard DB itu ada di skrip setup live.

**Deskripsi (koreksi v2):** DB live yang dibuat lewat `rls.sql` **punya** unique index `(competition_id, phone)`, sehingga double-submit live sebetulnya tertangkap sebagai 23505 → blok `catch` → lookup existing → return `duplicated: true`. Sisa risikonya: (1) deklarasi drizzle (`schema.ts`) **tidak** memuat constraint ini → deployment yang dibangun lewat migrasi drizzle TIDAK punya guard dan double-insert benar-benar terjadi; (2) kode tetap bergantung pada catch, bukan guard pra-insert seperti `executor.executeRegister`; (3) error 23505 karena **kolisi nomor tiket** (F2) masuk catch yang sama — karena lookup phone tidak menemukan existing, error mentah dilempar ke pengguna (bukan dianggap duplikat).

**Dampak:** Double-tap / double-submit / pengisian ulang dengan nomor sama → peserta terdaftar dua kali untuk lomba yang sama bila index DB absen; error mentah ke pengguna bila penyebabnya kolisi tiket.

**Rekomendasi:** Tambahkan guard pra-insert (cek `existing` sebelum insert) seperti `executor`; deklarasikan unique `(competition_id, phone)` juga di `schema.ts` agar migrasi drizzle setara dengan `rls.sql`; RPC `register_participant` menangani idempotensi (return existing bila sudah ada).

---

### F4 — 🔴 RLS memampukan UPDATE/INSERT publik menyeluruh

**Lokasi:** `supabase/rls.sql`:
- `participants admin status columns` → `for update using (true) with check (true)` (l.415-418)
- `payments admin verify columns` → `for update using (true) with check (true)` (l.410-413)
- `participant_payments public insert` → `for insert with check (true)` (l.390-392)
- `participants public insert` → `for insert with check (true)` (l.386-388)

**Deskripsi:** Semua policy bersifat `using (true)`/`with check (true)` — siapa pun (anon key, yang juga di-bundle ke publik) dapat:
- mengubah `participants.status` / `checked_in_at` (mis. set sendiri `fully_paid` / `checked_in`),
- mengubah `is_verified` pada payment (self-verify),
- menyisipkan payment untuk peserta mana pun.

ARCHITECTURE §6 mengakui RLS bukan "keamanan kuat", dan PIN juga tersimpan di bundle. Namun membiarkan **UPDATE langsung** tanpa gate sama sekali membuat status pembayaran/check-in bisa dipalsukan tanpa perlu PIN.

**Dampak:** Fraud: siapa pun bisa menandai bayarannya sendiri lunas, atau check-in sendiri tanpa bayar.

---

### F5 — 🟠 Kolom `participants.status` melenceng dari pembayaran

**Lokasi:** `payment.ts:165` (set status optimistik saat submit), `admin.ts:450-504` (`verifyPayment`/`rejectPayment` live tidak mengubah status).

**Deskripsi:** Saat submit, `persistPayment` langsung mengeset `participant.status = "fully_paid"`/`"dp_paid"` **sebelum diverifikasi**. Setelah itu, `verifyPayment`/`rejectPayment` di mode live hanya mengubah `participant_payments`, **tidak pernah** memperbarui `participants.status`. Akibatnya:
- pembayaran transfer yang belum diverifikasi → status sudah `dp_paid`/`fully_paid`,
- pembayaran yang **ditolak** → status tetap `dp_paid` di kolom DB,
- list admin (`admin.ts:345-349`) memakai `participant.status` → menampilkan status yang salah.

Check-in aman karena `getCheckinSummary` (`checkin.ts:130-165`) menghitung ulang status dari total `is_verified`; tapi kolom DB dan tampilan lain tidak konsisten.

**Dampak:** Info status tidak akurat di admin & daftar peserta; membingungkan verifikasi.

**Rekomendasi:** Jangan set `participant.status` secara optimistik saat submit. Derive status efektif dari jumlah `is_verified` (RPC/trigger/view), atau perbarui status hanya pada saat verifikasi/tolak. Kolom `status` perlu di-sinkronkan/di-recalc tiap kali pembayaran berubah.

**Tambahan v2:** pola abai-error yang sama ada di jalur live `persistPayment` — `payment.ts:163-166` meng-update status peserta **tanpa memeriksa error** hasil update (versi live dari F9). `rejectPayment` live (`admin.ts:492-504`) juga tidak menghitung ulang status, jadi reject setelah verify pun membiarkan status lama menggembung. Lihat juga A2/A33 di dokumen admin.

---

### F6 — 🟠 Overpayment saat lanjut lunas

**Lokasi:** `RegistrantProfile.svelte` (`openPayment` l.167-181, `setPaymentMode` l.183-197), `payment.ts:73` (`validateAmount` mode `"full"` mengembalikan `fee`).

**Deskripsi:** Saat peserta berstatus `dp_paid` memilih "Lunas", `paymentAmount` diisi `competition.fee` (biaya penuh), bukan `fee - paid` (sisa). `validateAmount("full")` di `submitPayment` juga mengembalikan `competition?.fee` apa adanya, sehingga DP yang sudah dibayar tidak diperhitungkan.

**Dampak:** Peserta yang sudah bayar DP lalu lanjut melunasi akan ditagih **full fee lagi** → kelebihan bayar.

**Rekomendasi:** Default nominal "Lunas" = `fee - total verified` (sisa). `validateAmount("full")` sebaiknya memvalidasi terhadap sisa, bukan selalu `fee`. Pastikan juga tidak boleh menagih lebih dari `fee - paid`.

**Tambahan v2:** lihat **F18** untuk mekanisme persisnya — `validateAmount` mode `full` bahkan **mengabaikan input user** dan selalu menagih `fee` penuh, dan `openPayment` otomatis memilih mode `full` + nominal `fee` begitu status peserta `dp_paid`. Overpayment terjadi tanpa interaksi pengguna.

---

### F7 — 🟠 Check-in offline tidak mencatat lokal di mode live

**Lokasi:** `checkin.ts:246-253` (`checkInParticipant`, blok offline di mode non-demo).

**Deskripsi:** Saat offline di mode live, check-in masuk antrean (`enqueue("checkin:...")`) dan mengembalikan `eligibility: "ok"`, **tanpa** menulis record check-in lokal. `getCheckinSummary` setelahnya tetap mengembalikan "belum check-in" karena tidak ada record lokal. Tidak ada konfirmasi visual bahwa check-in berhasil sementara menunggu sinkron.

**Dampak:** Panitia tidak yakin check-in tercatat saat offline; state tidak konsisten sampai antrean tersinkron.

**Rekomendasi:** Tulis record lokal optimistik (mirip mode demo) lalu *reconcile* saat sync; atau tampilkan status "menunggu sinkron" yang jelas. Key `checkin:${id}` sudah mendekom-duplikasi antrean, tapi perlu representasi lokal agar UI konsisten.

---

### F8 — 🟠 Tidak ada jalur resubmit pembayaran yang ditolak

**Lokasi:** `src/lib/components/RegistrantProfile.svelte` `openPayment` (l.158-165).

**Deskripsi:** Ketika pembayaran ditolak admin, UI menampilkan:

> "Pembayaran ini ditolak panitia dan tidak dapat dikirim ulang."

Tidak ada opsi untuk memperbaiki bukti / mengirim ulang. Ini membuat peserta yang buktinya kurang jelas (mis. nominal salah, gambar buram) tidak punya jalur untuk melengkapi selain menghubungi panitia secara manual — dan `submitPayment`/`submitContinuationPayment` juga memblokir karena adanya `rejectReason`.

**Dampak:** Peserta yang ditolak tidak bisa menyelesaikan pembayaran secara mandiri; antre di jalur manual.

**Tambahan v2 (kait F17):** ironisnya, teks UI di kartu riwayat justru berbunyi "Periksa alasan di atas lalu **kirim ulang pembayaran**" (`RegistrantProfile.svelte:596-602`) — menjanjikan jalur yang tidak ada. Kombinasi F8 + F15 (bukti hilang diam-diam saat upload gagal) membentuk deadlock paling umum di lapangan: bukti gagal terupload → pembayaran tercatat tanpa bukti → ditolak admin → tidak bisa kirim ulang → harus lewat panitia manual.

---

### F9 — 🟡 `executePayment` tidak memeriksa hasil update status

**Lokasi:** `src/lib/offline/executor.ts:166-171`.

**Deskripsi:** Setelah insert payment berhasil, update status peserta dilakukan tanpa memeriksa `error` dari `.update()`. Kalau update status gagal, antrean tetap menandai op sebagai `synced` (lewat `toResult` yang hanya mengecek error insert), sehingga status peserta basi tanpa disadari.

**Dampak:** Status peserta tidak sinkron setelah sinkronisasi offline.

**Rekomendasi:** Periksa error update status; bila gagal, kembalikan `error` sehingga op ditandai `failed` dan bisa dicoba ulang (atau gabungkan ke dalam satu transaksi/RPC).

---

### F10 — 🟡 Format nomor tiket tidak konsisten

**Lokasi:** `CheckinScanner.svelte` (placeholder `RA-2026-001`), `register.ts:103` (`nextTicketNumber` → `T-xxxxxx`).

**Deskripsi:** Demo seeded memakai format `RA-2026-001`, sedangkan pendaftaran baru (live & demo) memakai `T-000001` dst. Manual entry di check-in menampilkan placeholder `RA-2026-001` yang tidak cocok dengan format yang dihasilkan `nextTicketNumber`.

**Dampak:** Entry manual nomor tiket membingungkan; dua format berbeda.

**Rekomendasi:** Satu format kanonik (mis. `RA-2026-001`), update placeholder & `nextTicketNumber` agar konsisten.

---

### F11 — 🟡 `undoCheckIn` selalu mengeset `dp_paid`

**Lokasi:** `src/lib/db/admin.ts:377`.

**Deskripsi:** `undoCheckIn` (live) mengeset `status: "dp_paid"` untuk semua peserta yang di-undo, padahal peserta mungkin sebelumnya `fully_paid` (lunas) atau `registered` (jika dibiarkan masuk dengan min DP). Ini meng-*downgrade* status peserta yang seharusnya `fully_paid`.

**Dampak:** Setelah undo check-in, status peserta salah (turun ke DP).

**Rekomendasi:** Hitung ulang status dari jumlah `is_verified` (fee vs total) saat undo, bukan hardcode `dp_paid`.

---

### F12 — 🟡 Jalur offline (executor) tidak tegas kuota & validasi

**Lokasi:** `src/lib/offline/executor.ts` (`executeRegister`, `executePayment`).

**Deskripsi:** Jalur offline melakukan insert/update langsung tanpa validasi kuota, tanpa validasi nominal server-side, dan tanpa relasi ke constraint `(competition_id, phone)` yang baru. Ini memperluas F1/F3/F6 ke jalur queue.

**Dampak:** Registrasi/pembayaran offline bisa melebihi kuota atau duplikat bila hanya bergantung pada client.

**Rekomendasi:** Saat menutup RLS, jalur executor mengalihkan ke RPC yang sama dengan idempotency key, sehingga validasi kuota & dedup berlaku di server untuk jalur online maupun offline.

---

### F13 — 🟡 `tiket/[id]` tidak memeriksa status pembayaran

**Lokasi:** `src/routes/(app)/tiket/[id]/+page.svelte`.

**Deskripsi:** Halaman tiket hanya memblokir jika ada pembayaran **ditolak** (`ticketBlocked` saat `rejectReason` ada). Peserta yang belum melakukan pembayaran sama sekali tetap bisa membuka e-tiket. Ini bisa dianggap wajar (tiket = bukti pendaftaran) atau celah (tiket ditampilkan sebelum bayar), tergantung keputusan produk.

**Dampak:** Konsistensi kebijakan "minimal DP untuk masuk" vs tampilan tiket.

---

### F14 — 🔴 Pembayaran tanpa idempotency → duplikasi baris

**Lokasi:** `payment.ts:149-159` (insert live), `executor.ts:152-162` (insert jalur offline), `schema.ts:91-105` & `rls.sql:69-79` (tabel `participant_payments` tanpa kolom `idempotency_key`).

**Deskripsi:** Semua tabel skor punya `idempotency_key` unik — tabel pembayaran tidak. Konsekuensinya: (1) double-tap "Kirim pembayaran" membuat dua baris pending; admin dapat memverifikasi keduanya sehingga total terverifikasi melebihi tagihan; (2) retry op antrean setelah kegagalan ambigu (insert sukses, respons hilang) membuat duplikat, karena `toResult` hanya menganggap "conflict" bila ada pelanggaran unique — dan tidak ada constraint yang bisa dilanggar; (3) kunci antrean lokal (lihat F24) tidak membantu dedupe di sisi server.

**Dampak:** Data pembayaran ganda; status `fully_paid` palsu bila baris ganda terverifikasi; rekonsiliasi keuangan sulit.

**Rekomendasi:** Tambah kolom `idempotency_key uuid unique` di `participant_payments`; client men-generate satu UUID per percobaan submit; `ON CONFLICT DO NOTHING` di server — idealnya lewat RPC `submit_payment` (lihat bagian desain). Sekaligus menyelesaikan F24.

---

### F15 — 🟠 Gagal upload bukti ditelan diam-diam

**Lokasi:** `payment.ts:139-148` (`if (!uploadError) { ... }` tanpa cabang else), pola sama di `executor.ts:142-150`.

**Deskripsi:** Bila upload bukti ke Storage gagal (berkas terlalu besar, gangguan storage, konfigurasi bucket), `proofUrl` tetap `null` dan insert pembayaran **tetap dijalankan**. UI menyatakan "Pembayaran tercatat". Di sisi admin baris tampil "Belum ada bukti" (`AdminPanel.svelte:316-318`) sehingga sangat mungkin ditolak — dan karena F8 tidak ada jalur kirim ulang, peserta menemui jalan buntu.

**Dampak:** Pembayaran tanpa bukti → penolakan → deadlock peserta; keluhan langsung ke panitia.

**Rekomendasi:** Jadikan kegagalan upload error fatal di jalur online (pesan jelas + tombol coba lagi); di jalur offline executor harus memperlakukan gagal upload sebagai `error` (retry), bukan melanjutkan insert tanpa bukti. Pasangkan dengan perbaikan F8 (resubmit) sebagai jaring pengaman.

---

### F16 — 🟠 Check-in/settle offline tanpa state lokal (lanjutan F7)

**Lokasi:** `ParticipantDetailCard.svelte:105-131` (`payCash` → `persistPayment` → `enqueue`, lalu `await load()`), `payment.ts:168-187`, `checkin.ts:242-253`.

**Deskripsi:** Setelah pelunasan tunai offline masuk antrean, kartu memanggil `load()` → `getCheckinSummary` → `getPayments` yang mencoba Supabase → gagal karena offline → melempar error. Hasilnya: UI menampilkan error padahal op berhasil diantrekan, dan sisa bayar tampil basi (belum berkurang). Tidak ada penanda lokal "pembayaran/check-in dalam antrean" — masalah yang sama dengan F7 untuk jalur pembayaran.

**Dampak:** Panitia mengira gagal → menagih ulang atau meng-check-in ulang (double charge / double op); kepercayaan terhadap mode offline di gerbang turun.

**Rekomendasi:** Tulis state lokal optimistik (IDB) untuk check-in dan pembayaran tunai yang diantrekan, tampilkan badge "menunggu sinkron", dan perhitungkan op lokal tersebut dalam `remaining`/status sebelum sync. Drain executor harus idempoten (F14).

---

### F17 — 🟠 Teks UI menjanjikan "kirim ulang pembayaran" yang tidak ada

**Lokasi:** `RegistrantProfile.svelte:596-602` (teks "…lalu kirim ulang pembayaran") vs `RegistrantProfile.svelte:156-165` (`openPayment` memblokir pembayaran ditolak) & `285-289` (`canContinuePayment` mengecualikan pembayaran rejected).

**Deskripsi:** Kartu riwayat menampilkan "Pembayaran ditolak panitia. Periksa alasan di atas lalu kirim ulang pembayaran." — tetapi tombol "Lanjut bayar" disembunyikan (`canContinuePayment` false bila ada rejected) dan `openPayment` menolak dengan notice "tidak dapat dikirim ulang". Janji UI tidak punya implementasi; ini sisi UX dari F8.

**Dampak:** Peserta bingung dan frustrasi: disuruh kirim ulang tetapi tidak ada caranya → komplain ke panitia di lokasi.

**Rekomendasi:** Implementasikan jalur resubmit (desain `resubmit_payment` di bagian bawah dokumen ini); sampai saat itu tiba, ubah teks menjadi instruksi menghubungi panitia disertai alasan penolakan.

---

### F18 — 🟠 Mode lunas menimpa nominal dengan fee penuh (mekanisme F6)

**Lokasi:** `payment.ts:67-83` (`validateAmount` mode `full` → `return competition?.fee ?? amount`), `RegistrantProfile.svelte:167-177` (`openPayment`: status `dp_paid` → mode `full`, nominal = `fee`).

**Deskripsi:** Ada dua lapis overcharge: (1) default nominal lanjutan untuk peserta `dp_paid` adalah `fee` penuh, bukan `fee - totalTerverifikasi`; (2) sekalipun user mengubah nominal, `validateAmount` mode `full` **membuang input** dan selalu memakai `fee`. Contoh: fee Rp50.000, DP terverifikasi Rp25.000 → lanjut lunas menagih Rp50.000 lagi (total Rp75.000). Tidak ada warning kelebihan dan tidak ada batas atas nominal.

**Dampak:** Overpayment sistematis untuk semua peserta yang DP dulu lalu melunasi online.

**Rekomendasi:** Default & validasi nominal lanjutan = `max(0, fee - totalVerified)`; tampilkan rincian "sisa tagihan"; hitung sisa di server (RPC) agar tidak bisa dimanipulasi (sekalian menutup celah nominal aneh).

---

### F19 — 🟡 `checked_in` dilabeli "Lunas"/"Siap bertanding" meski masih sisa

**Lokasi:** `RegistrantProfile.svelte:298-302` (`paymentStateFor`: `fully_paid`/`checked_in` → "Lunas"), `643-651` (badge "Siap bertanding" untuk `checked_in`), `TicketCard.svelte:145-150` ("Pembayaran lunas terverifikasi" untuk `checked_in`).

**Deskripsi:** Syarat masuk cukup DP (ARCHITECTURE §7), jadi peserta bisa check-in dengan sisa bayar > 0. Namun semua label di atas menyamakan `checked_in` dengan lunas — sisa bayar tidak lagi terlihat oleh peserta maupun panitia setelah check-in (apalagi pelunasan pasca-check-in diblokir — lihat A31 dokumen admin).

**Dampak:** Sisa pembayaran tidak tertagih; laporan keuangan tidak akurat; panitia mengira sudah lunas.

**Rekomendasi:** Derive label dari `totalVerified vs fee`; untuk `checked_in` dengan sisa tampilkan "Sudah masuk — sisa Rp X".

---

### F20 — 🟡 Identitas guest hanya nomor WA; tiket tanpa cek kepemilikan

**Lokasi:** `daftar/+page.svelte:76-101` (login guest = nomor WA saja, tanpa OTP), `guestSession.ts` (identitas di localStorage), `tiket/[id]/+page.svelte` (tanpa verifikasi kepemilikan).

**Deskripsi:** Siapa pun yang tahu nomor WA peserta dapat "login" dan melihat seluruh pendaftaran + status pembayaran orang tersebut; siapa pun yang tahu UUID peserta dapat membuka e-tiket (nama, nomor WA, nomor tiket, QR check-in). Ini konsisten dengan posture "UX gate, bukan keamanan sungguhan" (§6), dan data peserta memang SELECT publik via RLS, namun layak dicatat sebagai residual risk privasi — nomor WA adalah PII, dan QR bisa dicetak/dipakai pihak lain.

**Dampak:** Paparan data pribadi antar-peserta bila nomor/UUID diketahui; QR check-in bisa disalahgunakan.

**Rekomendasi:** Terima + tulis disclaimer (keputusan produk), atau tambah verifikasi ringan (mis. cocokkan 4 digit terakhir nomor tiket saat login, atau OTP WA) untuk halaman tiket; pertimbangkan tidak mempublikasikan kolom `phone` lewat RLS SELECT anonim.

---

### F21 — 🟡 Offline = logout paksa saat restore profil

**Lokasi:** `daftar/+page.svelte:42-64` (`loadProfile`: setiap `catch` → `clearGuestSession()` + error).

**Deskripsi:** Saat `/daftar` dibuka tanpa sinyal, `findParticipantsByPhone` melempar (fetch gagal) → blok catch **menghapus sesi guest** dan menampilkan error. Peserta kehilangan profil hanya karena jaringan; harus login ulang setelah online.

**Dampak:** UX buruk justru di lokasi acara (sinyal jelek) — saat peserta paling membutuhkan tiketnya.

**Rekomendasi:** Bedakan kegagalan jaringan (pertahankan sesi + tawarkan "coba lagi", tampilkan data lokal bila ada) dari hasil kosong (baru logout).

---

### F22 — 🟡 Cek draft-restore §7 belum terhubung

**Lokasi:** `sync.ts:91-101` (`checkDraftRestore` — hanya diimpor oleh test), `RegistrationForm.svelte:48-60` (restore field draft tanpa cek server).

**Deskripsi:** ARCHITECTURE §7 mensyaratkan: saat restore draft, cek dulu `ticket_number exists for phone` sebelum submit ulang (server mungkin sudah commit). Implementasi hanya mengisi ulang form dari draft dan mengandalkan dedupe catch-based (yang bekerja hanya bila unique index F3 ada). Utilitas `checkDraftRestore` sudah dibuat + teruji unit, tetapi tidak pernah dipanggil dari produksi.

**Dampak:** Ketergantungan penuh pada guard DB; bila index absen (lihat koreksi F3), draft-restore bisa double-insert.

**Rekomendasi:** Panggil `checkDraftRestore` saat draft ditemukan: bila peserta sudah ada di server, arahkan ke login (bukan submit ulang); atau amandemen spesifikasi sebagai keputusan sadar.

---

### F23 — 🟡 Flag demo build-time: produksi bisa tanpa sadar berjalan demo

**Lokasi:** `demo/store.ts:4` (`demoMode = writable(env.enableDemoMode === "true")`), tidak ada pemanggil `toggleDemoMode`/`setDemoMode` di UI (grep seluruh `src/`), `.env` saat ini `PUBLIC_ENABLE_DEMO_MODE="true"`.

**Deskripsi:** Mode demo ditentukan saat build dan tidak ada toggle runtime. Bila build produksi terbawa flag `true`, seluruh alur peserta berjalan di data lokal per-perangkat: registrasi "sukses" (bahkan kuota dicek — hanya di demo), pembayaran "tercatat", QR terbit — tetapi **tidak ada satu pun yang masuk Supabase**. Panitia live tidak akan pernah menemukan peserta/tiket tersebut saat check-in.

**Dampak:** Mode kegagalan alur peserta yang paling parah dan senyap: semua terlihat normal sampai check-in gagal massal di gerbang.

**Rekomendasi:** Checklist rilis wajib: `PUBLIC_ENABLE_DEMO_MODE=false` + uji asap "daftar → baris terlihat di Supabase"; tampilkan badge/banner "MODE DEMO" yang mencolok bila aktif; pertimbangkan toggle runtime ber-PIN admin.

---

### F24 — 🟡 Kunci antrean pembayaran `Date.now()` tanpa dedupe server

**Lokasi:** `payment.ts:172-186` (kunci `payment:{participantId}:{mode}:{Date.now()}`).

**Deskripsi:** Dua submit offline dalam milidetik yang sama → kunci sama → entry antrean tertimpa (dedupe lokal tak disengaja); milidetik berbeda → dua entry → keduanya di-drain. Karena server tidak punya idempotency pembayaran (F14), keduanya menjadi dua baris pembayaran nyata.

**Dampak:** Duplikasi pembayaran lewat jalur antrean offline.

**Rekomendasi:** Kunci antrean = UUID idempotency yang sama dengan yang dikirim ke server (kolom baru F14) sehingga drain idempoten end-to-end.

---

### F25 — ℹ️ High-water reconcile & tombstone belum dipakai jalur baca

**Lokasi:** `reconcile.ts` (`getHighWater`/`setHighWater`/`deltaSince`), `sync.ts:58-82` (`applyTombstones`), `networkStore.ts:12-18` (`reportFetchSuccess/Failure`) — semuanya hanya diimpor oleh test.

**Deskripsi:** Elemen desain §5 (delta re-sync lewat high-water, recompute `running_total` setelah tombstone undo, koreksi status online dari hasil fetch) terimplementasi dan teruji unit, tetapi tidak terhubung ke jalur produksi: pembacaan selalu full-fetch, skor yang di-undo pasca-sync masih tampil sampai delete server tersinkron, dan status online hanya dari event browser. Kolom `running_total` DB juga tidak pernah diisi (default 0; ADR-6).

**Dampak:** Deviasi spesifikasi tanpa bug fungsional langsung; undo-after-sync menampilkan data basi sementara.

**Rekomendasi:** Hubungkan (prioritas rendah) atau amandemen ARCHITECTURE §5 untuk mengakui simplifikasi ini.

---

## Matriks perjalanan peserta end-to-end (v2)

Ringkasan satu layar: tahap × (normal / edge / offline) dengan rujukan temuan.

| # | Tahap | Normal (online) | Edge / kegagalan | Offline | Temuan |
|---|---|---|---|---|---|
| 1 | Buka `/daftar`, pilih lomba | Kartu lomba tampil fee/minDp/kuota | Kuota hanya ditampilkan, tidak ditegakkan live | Landing cache SW (SPA fallback OK) | F1 |
| 2 | Submit registrasi | Insert + tiket `T-xxxxxx`, QR terbit | Kolisi tiket → error mentah; duplikat phone → `duplicated` (bila index ada); error server → draft disimpan | Enqueue `register:comp:phone`; `participantId=""` → QR/tiket/pembayaran disembunyikan sampai sync | F2, F3, F22, F23 |
| 3 | Login guest (nomor WA) | `findParticipantsByPhone` → profil | Nomor tak dikenal → ditolak dengan pesan; **nomor orang lain = akses ke datanya** | Fetch gagal → **sesi dihapus** (logout paksa) | F20, F21 |
| 4 | Bayar DP (transfer/QRIS) | Insert pending + bukti ≤200KB (kompresi) | Upload bukti gagal → **tetap tercatat tanpa bukti**; nominal < minDp / bukan kelipatan 500 → ditolak; double-tap → baris ganda | Pembayaran + proof ArrayBuffer diantrekan; status tidak berubah lokal | F5, F14, F15 |
| 5 | Bayar sisa (lanjut lunas) | Seharusnya menagih sisa | Default & paksaan nominal = **fee penuh** → overpayment | Sama (antrean) | F6, F18 |
| 6 | Menunggu verifikasi | Profil menampilkan "Menunggu verifikasi" | Tidak ada notifikasi push — peserta harus refresh manual | Profil gagal dimuat (error) | — |
| 7 | Ditolak admin | Alasan tampil di riwayat | **Tidak ada jalur resubmit**, padahal teks UI menjanjikan; e-tiket terkunci | — | F8, F17 |
| 8 | Diverifikasi admin | Pembayaran terhitung | `participants.status` tidak diperbarui live; reject-after-verify tanpa recalc; undo check-in downgrade status | — | F5, F11, A2, A33 |
| 9 | Buka e-tiket & QR | QR = `{baseUrl}/panitia/checkin?id={uuid}` | Bisa dibuka tanpa bayar; siapa pun tahu UUID bisa buka; `BASE_URL` salah → QR mati | Halaman butuh fetch → gagal offline (QR tak tampil) | F13, F20 |
| 10 | Check-in oleh panitia | Scan QR/manual → ringkasan → check-in | Peserta belum layak tetap bisa diklik (error); pembayaran ditolak memblokir | Enqueue tanpa record lokal → error palsu, risiko dobel | F7, F16, A10, A22 |

---

## Desain: menutup RLS + jalur resubmit pembayaran

Menyikapi F4, F5, F8, dan pertanyaan "bagaimana peserta resubmit pembayaran yang belum dibayar jika RLS ditutup":

**Prinsip: jangan buka INSERT/UPDATE tabel langsung ke publik — ganti dengan RPC (SECURITY DEFINER) yang memvalidasi aturan bisnis di dalam PostgreSQL.**

### 1. RPC `submit_payment` (satu-satunya cara membuat pembayaran)
- Tarik policy `participant_payments public insert` (F4).
- `submit_payment(participant_id, phone, method, amount, proof_url, idempotency_key)`:
  - SECURITY DEFINER (jalan sebagai owner),
  - validasi: peserta ada & tidak `disqualified`; `phone` cocok dengan `participants.phone` (identitas = nomor WA, sama seperti login guest); `amount` valid (≥ minDp, kelipatan step); pindahkan validasi yang sekarang di client (`validateAmount`) ke dalam RPC,
  - insert `participant_payments` dengan `is_verified=false`,
  - `ON CONFLICT (idempotency_key)` → hapus duplikat (menggantikan draft-restore yang sekarang rapuh),
  - **jangan** set `participant.status` optimistik (memperbaiki F5); status efektif di-derive dari total `is_verified`.

### 2. RPC `resubmit_payment` (jalur perbaiki/kirim ulang — menyelesaikan F8)
- Ganti blok "tidak dapat dikirim ulang" dengan tombol **"Kirim ulang / Perbaiki bukti"**.
- `resubmit_payment(payment_id, phone, amount, proof_url)`:
  - `phone` harus cocok dengan `participants.phone` (bukti kepemilikan),
  - baris hanya boleh diubah jika berstatus **`rejected`** (`is_verified=false` DAN `reject_reason IS NOT NULL`) **atau masih `pending`** (`is_verified=false` tanpa reject) — tidak menyentuh yang sudah `verified`/`checked_in`,
  - set `is_verified=false, reject_reason=NULL, verified_by=NULL`, perbarui `amount`/`proof_image_url`,
  - tulis `audit_logs` (action `resubmit_payment`).

Dengan ini "belum dibayar" ditangani dua cara:
- **Belum pernah ada baris** → panggil `submit_payment` (buat pending baru).
- **Pernah ditolak / masih pending** → `resubmit_payment` memperbarui baris yang sama; riwayat reject tetap tersimpan untuk admin tanpa menumpuk baris.

### 3. Verifikasi admin jadi RPC
- `verify_payment`/`reject_payment` (sekarang direct UPDATE via policy publik, F4) pindah ke RPC yang menerima `actor_hash` (hash PIN) dan menulis `verified_by`/`audit_logs`.
- Kelemahan intrinsik tetap diakui: PIN publik + tanpa auth → RPC menutup *akses langsung*, bukan menambah otentikasi sungguhan (sejalan dengan pengakuan ARCHITECTURE §6).

### 4. Jalur offline ikut lewat RPC
- `executor.executePayment` / `executeRegister` ganti insert/update langsung menjadi `supabase.rpc('submit_payment' | 'resubmit_payment' | 'register_participant', ...)` dengan `idempotency_key` yang sama, agar drain queue tetap idempoten dan validasi kuota/dedup berlaku di server (menyelesaikan F9, F12, dan memperkuat F1/F3).

### 5. RPC `register_participant` (kuota + tiket + dedup) — menutup F1/F2/F3/F12/F24
- Signature `register_participant(p_competition uuid, p_name text, p_phone text, p_idempotency_key uuid)`, SECURITY DEFINER:
  - `UPDATE competitions SET total_quota = total_quota - 1 WHERE id = p_competition AND total_quota > 0 RETURNING id` — 0 baris → RAISE 'kuota habis' (F1).
  - Nomor tiket dari sequence/counter tabel (bebas kolisi `Date.now()%1M`, F2; format kanonik tunggal, F10).
  - `INSERT participants ... ON CONFLICT (competition_id, phone) DO UPDATE SET id = participants.id RETURNING id, ticket_number, (xmax = 0) AS inserted` — dedupe idempoten (F3).
  - Idempotency key untuk retry jalur offline (F12).
- `executeRegister` dan `registerParticipant` live pindah ke RPC ini (bagian 4 sudah menyebut; ditegaskan lagi di sini).

### 6. Idempotensi tabel pembayaran — menutup F14/F24
- Migrasi: `alter table participant_payments add column idempotency_key uuid unique;` (backfill baris lama dengan `gen_random_uuid()`).
- Semua insert (live, executor, RPC `submit_payment`/`resubmit_payment`) membawa key dari client → `ON CONFLICT DO NOTHING`/return baris existing.

### 7. Ketatkan storage & DELETE — menutup F15 & (A18/A38 dokumen admin)
- Cabut grant/policy DELETE anon pada `scores_mancing`/`scores_layangan`/`sponsors` (`rls.sql:325-326`, `435-441`); undo skor lewat RPC ber-audit.
- Bucket `proof-images`: validasi path/prefix + pertimbangkan objek privat dengan signed URL untuk panel admin, atau minimal path tak tertebak (UUID, bukan `Date.now()`).

### 8. Realtime publication — prasyarat papan live (A35 dokumen admin)
- `alter publication supabase_realtime add table scores_mancing, scores_layangan, scores_layangan_hias, participants, competitions;`
- Tanpa ini `postgres_changes` di display/leaderboard tidak pernah menyala; display terselamatkan siklus 30 detik, leaderboard publik tidak punya fallback apa pun.

### 9. Guard flag demo — menutup F23
- Build rilis wajib `PUBLIC_ENABLE_DEMO_MODE=false`; tambahkan banner "MODE DEMO" bila aktif + smoke test "daftar → terlihat di Supabase" dalam checklist rilis.

### Ringkasan tradeoff

| | Sekarang | Usulan |
|---|---|---|
| INSERT/UPDATE payment | publik (`using true`) | hanya via RPC `submit_/resubmit_payment` |
| Status peserta | diset optimistik saat submit → melenceng (F5) | di-derive dari total `is_verified` |
| Resubmit setelah ditolak | diblokir (F8) | `resubmit_payment` (perbaiki bukti) |
| Validasi amount/minDp | di client (bisa dimanipulasi) | di RPC (server-side) |
| Offline | insert langsung | `rpc()` + idempotency key |
| Keamanan sejati vs RLS | masih lemah (PIN publik) | akses langsung ditutup; PIN tetap gate kosmetik |
| Idempotensi pembayaran | tidak ada → baris ganda (F14/F24) | `idempotency_key` unique per percobaan submit |
| Kuota & nomor tiket | client-side/tidak ada (F1/F2) | RPC `register_participant` atomik + sequence |

## Roadmap prioritas (v2)

**P0 — sebelum acara (fraud / kehilangan data / alur utama mati):**
1. Tutup RLS + RPC `submit_payment`/`resubmit_payment`/`verify_payment`/`reject_payment` (F4) — fondasi anti-fraud.
2. RPC `register_participant`: kuota atomik + tiket sequence + dedupe (F1, F2, F3, F12).
3. Kolom `idempotency_key` di `participant_payments` + semua insert memakainya (F14, F24).
4. Deklarasikan unique `(competition_id, phone)` di `schema.ts` agar setara `rls.sql` (koreksi F3).
5. Pastikan `PUBLIC_ENABLE_DEMO_MODE=false` di build produksi + banner demo (F23).
6. Gagal upload bukti = error fatal, live & executor (F15).

**P1 — selama acara (kebingungan / potensi tagih dobel):**
7. Derive `participants.status` dari total `is_verified`, recalc saat verify/reject/undo (F5, F11, A2, A9, A33).
8. Lanjut lunas menagih sisa, bukan fee penuh (F6, F18).
9. Jalur resubmit pembayaran ditolak + perbaiki teks UI (F8, F17).
10. State lokal optimistik untuk check-in & bayar tunai offline (F7, F16).
11. Label `checked_in` menampilkan sisa bayar (F19); sesi guest tidak dihapus saat gagal jaringan (F21).

**P2 — pelengkap:**
12. Cek error update status di executor (F9 — ikut tertutup desain RPC).
13. Format tiket kanonik tunggal (F10).
14. Kebijakan akses e-tiket: keputusan produk (F13) + mitigasi privasi ringan (F20).
15. Hubungkan `checkDraftRestore` (F22); high-water/tombstone atau amandemen spesifikasi (F25).

---

## Status pasca-fix rawe3 (R1, 2026-08-09)

Semua item eksekusi (rawe3) diverifikasi ulang terhadap kode & commit — matriks lengkap
resumable di `doc2/REVIEW-TRACKER.md`.

| Temuan | Status R1 | Catatan |
|---|---|---|
| F1 | TERTUTUP | kuota atomik RPC `register_participant` (menunggu apply SQL — A42) |
| F2 | TERTUTUP | tiket sequence `participant_ticket_seq` |
| F3 | TERTUTUP | unique `(competition_id, phone)` di rls + schema |
| F4 | TERTUTUP (menunggu apply) | policy publik dicabut di file; artefak SQL rusak (A42) |
| F5 | TERTUTUP | status di-recalc dari total terverifikasi dalam RPC |
| F6 | TERTUTUP dgn risiko | sisa ditagih — **deadlock bila sisa < min_dp (lihat A43 dokumen admin)** |
| F7 | TERTUTUP | check-in offline: optimistik lokal + RPC saat drain |
| F8 | TERTUTUP | RPC `resubmit_payment` + tombol kirim ulang |
| F9 | TERTUTUP | insert+status satu transaksi server |
| F10 | TERTUTUP | format kanonik `T-xxxxxx` (catatan: stub demo `payment.ts:118` masih `Date.now()%1M`, kosmetik) |
| F11 | TERTUTUP | `undoCheckIn` menghitung ulang status |
| F12 | TERTUTUP | executor registrasi via RPC |
| F13 | TERTUTUP (keputusan user) | tiket = bukti pendaftaran; hanya rejected diblokir |
| F14 | TERTUTUP | `idempotency_key` unique + `ON CONFLICT DO NOTHING` |
| F15 | TERTUTUP | gagal upload bukti fatal (live & executor) |
| F16 | TERTUTUP | badge "menunggu sinkron" + skip load() saat queued |
| F17 | TERTUTUP | teks kirim-ulang kini nyata |
| F18 | TERTUTUP | mode lunas tak lagi menimpa nominal dgn fee penuh |
| F19 | TERTUTUP | label "Sudah masuk — sisa Rp X" |
| F20 | TERTUTUP | disclaimer privasi di halaman tiket |
| F21 | TERTUTUP | sesi guest dipertahankan saat gagal jaringan |
| F22 | TERTUTUP via amandemen | `checkDraftRestore` tetap dead code; deviasi diterima (ARCHITECTURE §5) |
| F23 | TERTUTUP | banner MODE DEMO + guard build |
| F24 | TERTUTUP | idempotensi end-to-end (kunci antrean = UUID DB) |
| F25 | TERTUTUP via amandemen | utilitas §5 teruji-tak-terhubung didokumentasikan sbg deviasi |

**Tidak ada temuan baru sisi peserta pada R1.** Risiko lintas-sisi (pelunasan sisa)
tercatat sebagai A43 di `ADMIN-PANITIA-JURI-REVIEW.md`.