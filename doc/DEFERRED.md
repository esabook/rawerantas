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

- [ ] `R9-07` — Enable lint `.svelte` di `biome.json` (saat ini `!**/*.svelte`
  exclude semua) — dicoba (`includes` tanpa exclude, `bunx biome check .`):
  119 error + 375 warning di 180 file, terlalu besar untuk diperbaiki aman
  dalam satu task tanpa risiko regresi UI. Config dikembalikan ke exclude
  semula. Upgrade path: pecah per-domain (components/, routes/) jadi
  beberapa task terpisah, mulai dari kategori error paling ringan
  (import order, unused var) sebelum kategori style/a11y yang lebih besar
  — logged 2026-08-07.

## Kandidat yang diketahui di awal (belum diputuskan, bukan deferral tetap)

- Validasi nomor WA & normalisasi (62/08) — keputusan format kanonik.
- `onDelete` behavior FK `participant_payments.participant_id` saat peserta
  dihapus — keputusan RESTRICT vs SET NULL.
- Jalur upgrade: guard tambahan di luar data lock (mis. "kunci per-lomba").
- Export format Excel (`.xlsx`) bila CSV tidak cukup — P3, butuh library.
