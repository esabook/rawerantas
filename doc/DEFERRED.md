# DEFERRED — Pool Deferral

Satu-satunya tempat mencatat pekerjaan yang ditunda/skip/postpone dari run.
Format entri:

```text
- [ ] <ID task / nama> — <apa yang ditunda> — <kenapa> — logged <tanggal>
```

Centang (`[x]`) saat akhirnya dikerjakan (jangan dihapus — file ini tetap
bacaan sejarah). Cek pool ini SEBELUM menarik task baru. Bila sebuah fase
membutuhkan keputusan manusia yang belum ada, entri tetap di sini — jangan
pernah "asumsikan selesai".

## Pool aktif

Belum ada. Terisi oleh run pertama (skill `rawe1`).

## Kandidat yang diketahui di awal (belum diputuskan, bukan deferral tetap)

- Validasi nomor WA & normalisasi (62/08) — keputusan format kanonik.
- `onDelete` behavior FK `participant_payments.participant_id` saat peserta
  dihapus — keputusan RESTRICT vs SET NULL.
- Jalur upgrade: guard tambahan di luar data lock (mis. "kunci per-lomba").
- Export format Excel (`.xlsx`) bila CSV tidak cukup — P3, butuh library.
