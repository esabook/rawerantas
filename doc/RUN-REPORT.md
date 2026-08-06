# Run Report — 2026-08-06

Fase: 0 → 1 · Commit: `2b9f5a7`..`d702099`

## Selesai

| Task | Commit | Verify | Bukti |
|---|---|---|---|
| F0-01 | 2b9f5a7 | exit 0 | init git + skeleton SvelteKit SPA statis, adapter-static fallback |
| F0-02 | 2722041 | exit 0 | deps inti: tailwind v4, shadcn-svelte (preset bIkeymG), drizzle, supabase, idb, qrcode, html5-qrcode |
| F0-03 | d702099 | exit 0 | .env.example + .env placeholder + env.ts + guard build (warning `[env]` di log build) |
| F0-04 | f96380e | exit 0 | design tokens ARCHITECTURE §3, glass-panel, print CSS 58/80mm |
| F0-05 | 5767385 | exit 0 | AppShell + BottomNav + manifest; SPA murni (ssr off, fallback) |
| F0-06 | ca63a46 | exit 0 | vitest + testing-library svelte + happy-dom; 5 test kanon |
| F0-07 | eb7e525 | exit 0 | biome lint+format + svelte-check; script lint/check/test |

Suite penuh terakhir: test 2 files/5 tests ✓ · check 0 error ✓ · lint 0 temuan
✓ · build ✓ (warning `[env]` wajar — `.env` masih placeholder).

## BLOCKED

| Task | Sebab | Butuh |
|---|---|---|
| — (aktif) | — | — |

Antrean manusia aktif (bukan BLOCKED task): `F0-03` isi nilai `.env` asli
(`PUBLIC_BASE_URL`, Supabase URL/key, PIN) — wajib sebelum `D1-02` (client
Supabase) dan sebelum build rilis; `D1-03` (apply RLS) saat ditarik.

## Menyimpang dari rencana

- `F0-03` sebelumnya ditandai `BLOCKED` prematur (sesi lebih awal) — baris task
  Edge eksplisit "agen tulis placeholder"; dikerjakan ulang penuh di run ini,
  board dikoreksi `DONE`.
- `F0-03` `FILES` + `vite.config.ts` (di-amend di TASKS.md): VERIFY menuntut
  warning di log build, tapi SPA statis (`ssr=false`, `prerender=false`) tidak
  mengeksekusi module saat build, dan SvelteKit versi ini tidak memperingatkan
  variabel `$env/static/public` yang hilang (diuji: sync + build dgn var
  dihapus — output bersih). Guard ditaruh di plugin vite `buildStart`
  (`baseUrlGuard` + `loadEnv`).
- Biome parser Svelte (2.5, eksperimental) melaporkan false positive (komponen
  yang dipakai di markup dibilang "unused") dan merusak indent `<script>` saat
  `--write` → `.svelte` di-exclude biome; linter Svelte = svelte-check. Keputusan
  peran, bukan pelonggaran.
- `css.parser.tailwindDirectives: true` — opsi resmi biome utk syntax Tailwind
  v4 di app.css (tanpa ini parser error).
- Vitest: `resolve.conditions: ["browser"]` (syarat SvelteKit) + `defineConfig`
  dari `vitest/config` (tipe `test` tak ada di `vite`).
- `F0-05` AppShell: snippet props optional → default `noop` (`noopSnippet` tak
  di-export di Svelte versi terpasang; `() => {}` tak cocok tipe `Snippet`).

## Belum diverifikasi

- Render visual nav/layout di browser sungguhan (sesi tanpa browser; hanya
  struktural + curl 200 via `vite preview`). Butuh cek manual di Q8-02.
- Warning runtime `PUBLIC_BASE_URL` di console browser prod (hanya log build
  yang teruji).
- Print thermal fisik 58/80mm + QR quiet zone (butuh printer).
- Daftar `.env` asli belum ada — build rilis belum bisa dilakukan.
