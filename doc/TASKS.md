# TASKS — Tool Lomba Agustusan, Execution Backlog

**Status:** Fase 1 (Data & Skema) aktif — `D1-01` siap ditarik.

**Source of truth:** file ini satu-satunya pemilik status dan urutan eksekusi
task. [`ARCHITECTURE.md`](./ARCHITECTURE.md) mendefinisikan arsitektur dan
keputusan; `START.md` menentukan fase aktif. Tidak satu pun menduplikasi status
task.

**Eksekutor:** skill `.opencode/skills/rawe1/SKILL.md` (autonomous,
crash-safe). Kode rujukan protokol: skill `orkes12`.

---

## READY NOW — FASE 1: DATA & SKEMA

Pintu masuk: [`START.md`](./START.md). Board ini = **`READY` dari fase aktif**,
urut sesuai aturan pull (prio → effort → ID).

| # | Lane | ID | Status | Prio | Effort |
|---|---|---|---|---|---|
| 1 | DATA | `D1-01` | DONE | P0 | E:M |
| 2 | DATA | `D1-02` | DONE | P0 | E:S |
| 3 | SEC | `D1-03` | BLOCKED | P1 | E:S |
| 4 | DATA | `D1-04` | DONE | P1 | E:M |
| 5 | FE | `D1-05` | DONE | P2 | E:XS |
| 6 | DATA | `D1-06` | DONE | P1 | E:S |

**Kenapa hanya ini.** Skema Drizzle (D1-01) = fondasi semua data: Supabase
client (D1-02), RLS (D1-03), demo/seed (D1-04), dan scoring engine (D1-06)
bergantung padanya. D1-05 (image compressor) independen — sudah `READY`
menurut `DEP` (F0-02 `DONE`).

### Fase berikutnya — JANGAN ditarik

Sudah `READY` menurut `DEP`, tapi fase-nya belum aktif:

- Fase 2 (`O2`): `O2-01`, `O2-02` — offline engine
- Fase 3 (`C3`): `C3-01`, `C3-03`, `C3-05` — komponen shared siap menurut `DEP`
  (`F0-03` `DONE`)

### Antrean manusia — task yang agen TIDAK bisa kerjakan

Default setiap task = **AGENT**. Yang di bawah butuh manusia (akses konsol,
nilai rahasia, akun, perangkat fisik). Eksekutor yang menabrak salah satunya
wajib tandai `BLOCKED`, tulis `JOURNAL.md`, lanjut ke task berikutnya — bukan
berhenti, bukan menebak.

| Task | Fase | Kenapa manusia |
|---|---|---|
| `F0-03` (isi nilai `.env`) | 0 | `PUBLIC_BASE_URL`, Supabase URL/key, PIN asli — hanya user yang punya |
| `DATABASE_URL` (D1-01 push) | 1 | Connection string Postgres Supabase utk `drizzle-kit push`/migrasi fisik |
| `D1-03` (apply RLS SQL) | 1 | Butuh service role key / konsol Supabase |
| `U4-03` (konten QRIS) | 4 | Upload gambar QRIS + instruksi bayar nyata |
| `Q8-03` (deploy) | 8 | Akun Cloudflare Pages + domain |
| `Q8-04` (sync-test) | 8 | Butuh 2 perangkat + orang kedua |
| Uji print thermal | 4 | Printer fisik 58/80mm, QR quiet zone |

### Peta fase

| Fase | Isi | Selesai bila |
|---|---|---|
| **1** | `D1-*` data & skema | `D1-06` `DONE` |
| 2 | `O2-*` offline engine | `O2-05` `DONE` |
| 3 | `C3-*` komponen shared | `C3-05` `DONE` |
| 4 | `U4-*` alur user | `U4-05` `DONE` |
| 5 | `P5-*` panitia | `P5-02` `DONE` |
| 6 | `J6-*` juri | `J6-03` `DONE` |
| 7 | `A7-*` admin & display | `A7-04` `DONE` |
| 8 | `Q8-*` QA & deploy | `Q8-04` `DONE` |

---

## Cara membaca satu task

```text
- [ ] `ID` · `LANE/STATUS/PRIORITY/EFFORT` · `DEP:prasyarat` · `BLOCKS:hilir` — aksi; done when kriteria terukur.
      FILES: path/nyata.ts, path/baru.ts (baru)
      VERIFY: perintah yang bisa dijalankan driver
      Edge: kasus batas yang wajib ditangani (dan bagaimana)
```

Segmen `LANE/STATUS/PRIORITY/EFFORT` selalu 4 bagian dipisah `/`, tanpa spasi.

### Legend field

| Field | Nilai | Arti |
|---|---|---|
| Lane | `ARC` `FE` `API` `DATA` `RUN` `OPS` `REL` `PERF` `SEC` `QA` `OBS` | Arsitektur, frontend, API/data, data, runtime/offline, operasi, release, performa, keamanan, kualitas, observability |
| Status | `DONE` `READY` `ACTIVE` `WAIT` `HOLD` `BLOCKED` | Selesai; tarik sekarang; dikerjakan; menunggu `DEP`; menunggu trigger kondisional; terhenti hambatan eksternal |
| Prio | `P0` `P1` `P2` `P3` | `P0` = gate/blokir fase atau gate keputusan. `P1` = wajib rilis. `P2` = penting. `P3` = opsional. |
| Effort | `E:XS` `E:S` `E:M` | ≤4 jam; 1–2 hari; 3–5 hari. **`E:L` dilarang** — pecah sebelum ditulis. |
| `DEP` | ID task, `—` | Otoritatif. Semua harus `DONE` sebelum status boleh `READY`. |
| `BLOCKS` | ID task, `—` | Informatif saja. Bukan dasar readiness. |
| `FILES` | path relatif root repo | Tempat pekerjaan. `(baru)` = belum ada. |
| `VERIFY` | perintah shell / artefak | Bukti objektif selesai. |

### Aturan pull dan update

1. Tarik hanya `READY`. Jangan pernah mulai `WAIT`, `HOLD`, `BLOCKED`.
2. Urutan: `P0` → `P3`; effort sama-prio: `XS` → `S` → `M`; seri berikutnya: ID
   terkecil alfabet. Deterministik.
3. `set ACTIVE` saat diklaim. `set DONE` hanya setelah implementasi + `VERIFY`
   dijalankan driver + lint bersih + commit.
4. Satu task = satu deliverable. >5 hari saat dikerjakan → berhenti dan pecah
   jadi sub-ID huruf (mis. `F0-02a`, `F0-02b`), jangan lanjut sebagai satu task.
5. `BLOCKED` wajib entri `JOURNAL.md` bertanggal: owner, sebab, syarat lepas.
6. `DEP` menjadi `DONE` → segera rekonsiliasi task `WAIT` yang bergantung.
7. **Tarik hanya dari fase aktif** (lihat `START.md`).
8. Fase selesai → perbarui board, blok "Fase berikutnya", dan `START.md` dalam
   satu perubahan.

---

## FASE 0: FONDASI

- [x] `F0-01` · `ARC/DONE/P0/E:S` · `DEP:—` · `BLOCKS:F0-02` — Init git repo (`git init`, branch `main`) + `.gitignore` (node_modules, .env, build, .svelte-kit, .env.* kecuali `.env.example`) + skeleton SvelteKit SPA statis (`bun create svelte@latest` non-interaktif: TypeScript, skeleton, `@sveltejs/adapter-static`, tanpa git-internal); done when `bun run build` menghasilkan output statis, `git status` bersih, commit pertama ada.
      FILES: package.json, svelte.config.js, vite.config.ts, tsconfig.json, .gitignore, .npmrc (baru)
      VERIFY: bun run build && git log --oneline -1
      Edge: `bun create svelte` kadang interaktif — pakai flag `--no-git --yes`/args eksplisit; kalau repo root tidak kosong (ada doc/), pindahkan dulu atau pakai `--force`; adapter-static wajib di-set dari awal, bukan belakangan.

- [x] `F0-02` · `OPS/DONE/P0/E:M` · `DEP:F0-01` · `BLOCKS:D1-01,D1-05,D1-06,O2-01,O2-02,C3-03` — Install deps inti: `@sveltejs/adapter-static`, tailwindcss v4 + `@tailwindcss/vite`, shadcn-svelte (`bunx shadcn-svelte init` + add button/input/card/dialog/slider/select), bits-ui, `drizzle-orm` + `drizzle-kit`, `@supabase/supabase-js`, `idb`, `qrcode`, `html5-qrcode`; done when `bun run check` + `bun run build` hijau, semua import terbaca.
      FILES: package.json, svelte.config.js, vite.config.ts, src/app.css, components.json
      VERIFY: bun run check && bun run build
      Edge: html5-qrcode besar → pastikan cuma di route panitia via lazy `import()` (jangan bundle landing); shadcn-svelte init butuh Tailwind v4 — ikuti versi terkini, jangan ikut tutorial Tailwind v3; kalau `bunx shadcn-svelte add` manggil alias `@/*`, set `paths` tsconfig lebih dulu.

- [x] `F0-03` · `OPS/DONE/P0/E:S` · `DEP:F0-02` · `BLOCKS:D1-02,C3-01,C3-05` — Setup env: tulis `.env.example` (lihat ARCHITECTURE §1, termasuk `PUBLIC_EVENT_DATE`) + `.env` kosong + helper baca `$env/static/public`; tambah build-time guard: `PUBLIC_BASE_URL` kosong di mode `build` → warning keras (log, jangan silent); done when tiap `PUBLIC_*` terbaca dari `$env/static/public`, build di luar dev memperingatkan base-url kosong.
      FILES: .env.example (baru), .env (baru), src/lib/env.ts (baru), vite.config.ts (guard build — AMENDED: VERIFY butuh warning di log build; SPA statis tak eksekusi module saat build, guard ditaruh di plugin `buildStart`)
      VERIFY: bun run build (dengan dan tanpa PUBLIC_BASE_URL — lihat warning) && bun run check
      Edge: nilai `.env` asli HANYA manusia (human queue) — agen tulis placeholder; jangan commit `.env` (guard di .gitignore F0-01); `PUBLIC_EVENT_DATE` wajib ISO-8601 lengkap dengan offset, parse gagal = build error bukan NaN.

- [x] `F0-04` · `FE/DONE/P0/E:M` · `DEP:F0-02` · `BLOCKS:F0-05,U4-01` — Design tokens: set warna/typografi/spasi ARCHITECTURE §3 di config Tailwind + `src/app.css` (CSS reset `user-select:none`, kecuali input/textarea; `glass-panel`; `@media print` 58mm + varian 80mm + `.no-print`); done when token `background/foreground/primary/secondary/success/muted` terpakai di class, print CSS ada untuk dua ukuran, user-select benar.
      FILES: src/app.css, vite.config.ts / tailwind config, src/lib/components/ui/ (shadcn theming)
      VERIFY: bun run check && bun run build && grep -n "user-select" src/app.css
      Edge: spacing ≤24px (1.5rem) HANYA batas container/padding — font elemen big-button boleh lebih besar (ARCHITECTURE §3); print CSS harus tidak mengunci konten saat layar (print-only class); jangan reset `user-select` di browser non-webkit tanpa prefix ganda.

- [x] `F0-05` · `FE/DONE/P0/E:S` · `DEP:F0-04` · `BLOCKS:C3-02,C3-04,U4-01` — Base layout: `+layout.svelte` (glass topbar + iOS-style bottom nav: Landing/Daftar/Leaderboard) + meta `theme-color`, viewport, manifest injection + offline banner slot + global toaster slot; done when nav muncul di semua route non-display, layout kunci konten aman utk layar kecil (375px).
      FILES: src/routes/+layout.svelte, src/lib/components/AppShell.svelte (baru), src/lib/components/BottomNav.svelte (baru), src/routes/+layout.ts
      VERIFY: bun run check && bun run build && bunx vite preview (cek nav render)
      Edge: `/display` dan `/juri/*` harus bisa bypass nav (layout route group atau conditional); route kosong lain dulu → `+page.svelte` placeholder agar build tidak error.

- [x] `F0-06` · `QA/DONE/P1/E:S` · `DEP:F0-02` · `BLOCKS:semua task dengan VERIFY test` — Test harness: install + config Vitest + `@testing-library/svelte` + `happy-dom` + script `bun run test`; tulis 2 test contoh (util murni + render komponen sederhana) sebagai kanon; done when `bun run test` exit 0 dan `bun run test -- run` jalan deterministik.
      FILES: vite.config.ts (test block), src/lib/utils/__tests__/example.test.ts (baru), src/lib/components/__tests__/Example.test.ts (baru)
      VERIFY: bun run test
      Edge: SvelteKit komponen pakai `$app/env`/`$env` → mock atau gunakan komponen tanpa dependency itu untuk test contoh; `happy-dom` tidak punya `crypto.subtle` → polyfill saat test PinGate (C3-01) ditulis, catat sekarang.

- [x] `F0-07` · `QA/DONE/P1/E:S` · `DEP:F0-02` · `BLOCKS:Q8-01` — Baseline quality gates: install `biome` (lint+format) + `svelte-check`; script `bun run lint` (biome check) + `bun run check` (svelte-check); done when keduanya hijau di repo kosong (tanpa temuan) dan dipakai sebagai gate `VERIFY` semua task berikut.
      FILES: package.json (scripts), biome.json (baru)
      VERIFY: bun run lint && bun run check
      Edge: biome vs prettier konflik — pilih SATU formatter (biome), matikan prettier di `package.json`; `svelte-check` butuh `check` script bawaan SvelteKit; jangan pernah melonggarkan config utk lulus gate — temuan = JOURNAL, bukan config diubah.

## FASE 1: DATA & SKEMA

- [x] `D1-01` · `DATA/DONE/P0/E:M` · `DEP:F0-02,F0-03` · `BLOCKS:D1-02,D1-03,D1-04,D1-06` — Skema Drizzle 9 tabel (ARCHITECTURE §4): `competitions`(+`scoring_mode`), `payment_configs`, `participants`, `participant_payments`, `scores_mancing`(+`running_total`, `received_at`), `scores_layangan`(+`received_at`), `scores_layangan_hias`(+`total_weighted`, `edited_at`), `audit_logs`; semua tabel skor + audit punya `idempotency_key uuid unique` + `uniqueIndex`; hias punya check constraint kriteria 0–100; done when migrasi Drizzle generate + push dry-run tanpa error, index unik terlihat.
      FILES: src/lib/db/schema.ts (baru), drizzle.config.ts (baru), src/lib/db/index.ts (baru)
      VERIFY: bunx drizzle-kit generate && bunx drizzle-kit push --dry-run && bun run check
      Edge: `running_total` harus `integer` + default 0 (bukan nullable) agar SUM offline aman; `scoring_mode` pakai `text` + app-level enum (jangan PG enum — migrasi kaku); FK cascade perilaku pendaftaran hapus → jangan `onDelete: cascade` ke payments tanpa keputusan; `received_at` default `now()` di DB, bukan klien.
      AMENDED: VERIFY `push --dry-run` dihapus di drizzle-kit 0.31 (sisa `--verbose`/`--force` yang butuh koneksi) + `DATABASE_URL` belum ada → push ke DB dijalankan saat koneksi tersedia (lihat antrean manusia). Pengganti bukti: `drizzle-kit generate` idempotent (2x = "no changes") + review SQL migrasi manual (8 tabel, 4 unique index idempotency, 3 check 0–100, generated column `total_weighted`, FK `ON DELETE restrict` payments). 8 tabel nyata — entri §4.9 adalah slot opsional fase 8 (kosong).

- [x] `D1-02` · `DATA/DONE/P0/E:S` · `DEP:D1-01,F0-03` · `BLOCKS:D1-04` — Supabase client singleton: baca `PUBLIC_SUPABASE_URL`/`ANON_KEY` dari `$env/static/public`; export typed client + helper query (getCompetitions, getLeaderboard, dll.) yang bakal dipakai semua route; done when client terbentuk tanpa error, helper mengembalikan type yang cocok skema Drizzle.
      FILES: src/lib/db/supabaseClient.ts (baru), src/lib/db/queries.ts (baru)
      VERIFY: bun run check && bun run test
      Edge: URL/key kosong saat build → konstruksi client gagal; harus error eksplisit (bukan console.error lalu lanjut); jangan simpan instance di module-level tanpa penanganan HMR SvelteKit (re-export dari `$lib`).

- [ ] `D1-03` · `SEC/BLOCKED/P1/E:S` · `DEP:D1-01` · `BLOCKS:A7-01` — RLS SQL: tulis file SQL policies (SELECT publik utk tabel publik; INSERT publik utk registrasi+skor; UPDATE terbatas; `verified_by`/`recorded_by` = hash PIN) + skrip apply via service role; done when SQL tereksekusi (oleh manusia/konsol) dan policies tercatat di evidence; agen hanya siapkan SQL + panduan, BUKAN menyentuh service role key.
  - ARTEFAK DONE (`0c03d83`): `supabase/rls.sql` (15 policies, 8 tabel RLS on) + `supabase/README.md` (panduan apply, bucket `proof-images`, checklist). EKSEKUSI menunggu manusia (konsol/service role) → antrean manusia. Status tetap BLOCKED sampai policies ter-apply + tercatat.
      FILES: supabase/rls.sql (baru), supabase/README.md (baru)
      VERIFY: artefak — rls.sql ada + panduan apply + checklist policies
      Edge: RLS apply butuh service role / konsol = **human queue** → kalau belum, task `BLOCKED`+JOURNAL, lanjut; jangan pakai `GRANT ALL`; proof images pakai Storage bucket policy (public-read, upload lewat client).

- [x] `D1-04` · `DATA/DONE/P1/E:M` · `DEP:D1-01,D1-02` · `BLOCKS:U4-05` — Demo mode + seed: `demoStore.ts` (flag `PUBLIC_ENABLE_DEMO_MODE`), generator mock (50 peserta, skor, pembayaran), query layer yang intercept ke data lokal saat demo ON; **realtime teardown**: saat toggle demo ON, semua subscription Supabase channel di-teardown; done when demo ON menampilkan data penuh tanpa satu pun panggilan ke Supabase terlihat (network tab), toggle OFF mengembalikan live.
      FILES: src/lib/demo/demoStore.ts (baru), src/lib/demo/mockData.ts (baru), src/lib/db/queries.ts
      VERIFY: bun run test && bun run build && manual: network tab bersih saat demo ON
      Edge: mode demo harus tidak bisa menulis ke Supabase (jangan pakai client yang sama utk tulis); toggle saat ada channel live → teardown dulu, jangan leak subscription; data demo deterministik (seed tetap) agar test stabil.

- [x] `D1-05` · `FE/DONE/P2/E:XS` · `DEP:F0-02` · `BLOCKS:U4-03` — Image compressor (canvas): kompres bukti transfer ≤200KB (jpeg/webp, max dimensi), EXIF rotate; done when gambar 5MB jadi ≤200KB tanpa artefak parah, utilitas punya test.
      FILES: src/lib/utils/imageCompressor.ts (baru), src/lib/utils/__tests__/imageCompressor.test.ts (baru)
      VERIFY: bun run test
      Edge: webp tidak didukung Safari lama → fallback jpeg; HEIC dari iPhone gagal decode → pesan error jelas; file >20MB tolak di UI sebelum canvas.

- [x] `D1-06` · `DATA/DONE/P1/E:S` · `DEP:D1-01` · `BLOCKS:U4-05,J6-01,J6-03` — Scoring rules engine: fungsi murni per mode (`terberat`/`kumulatif`/`jackpot_pita`/`hias`) utk peringkat + tie-break `received_at ASC`; hias `total_weighted = a*0.4 + s*0.4 + k*0.2`; done when engine punya test untuk tiap mode + tie-break clock-skew (input received_at tidak berurutan).
      FILES: src/lib/scoring/engine.ts (baru), src/lib/scoring/__tests__/engine.test.ts (baru)
      VERIFY: bun run test
      Edge: jackpot = kategori terpisah, jangan tercampur ranking biasa; mode kumulatif pakai `running_total` (bukan sum on-the-fly); tie `received_at` sama → tambah tie-break `id` asc (deterministik).

## FASE 2: OFFLINE ENGINE

- [ ] `O2-01` · `RUN/WAIT/P0/E:M` · `DEP:F0-02` · `BLOCKS:U4-04` — Service worker native `$service-worker`: cache statis versi-tagged, `navigateFallback` ke `index.html` (deep-link offline `/tiket/xyz`, `/juri/*`), `skipWaiting` + `clientsClaim`, exclude route dinamis/API dari cache; done when offline reload route dalam di DevTools → halaman render, bundle baru menggantikan yang lama setelah deploy.
      FILES: src/service-worker.ts (baru), vite.config.ts (SW manifest/plugins)
      VERIFY: bun run build && bunx vite preview (DevTools: offline + update check)
      Edge: SW versi — deploy baru harus invalidate cache lama (bump versi di build); jangan cache fetch API/realtime (data basi mematikan leaderboard); navigasi ke `/juri/*` yang di-PIN tetap boleh render shell (PIN ada di client).

- [ ] `O2-02` · `RUN/WAIT/P0/E:S` · `DEP:F0-02` · `BLOCKS:O2-03` — IndexedDB queue (`idb`): store `sync_queue` keyed `idempotencyKey`, status `pending|syncing|synced`, field `endpoint/payload/timestamp/retries`; API `enqueue`, `peekBatch`, `markSynced`, `markFailed`; done when test (fake-indexeddb) membuktikan enqueue→markSynced lifecycle + urutan FIFO.
      FILES: src/lib/offline/queue.ts (baru), src/lib/offline/__tests__/queue.test.ts (baru)
      VERIFY: bun run test
      Edge: `fake-indexeddb` dipakai di test (happy-dom tidak punya IndexedDB); op gagal tidak memblokir batch berikutnya (isolasi per-op); `retries` cap (mis. 10) → `dead` status + surfacing di offline UI, bukan loop abadi.

- [ ] `O2-03` · `RUN/WAIT/P0/E:M` · `DEP:O2-02` · `BLOCKS:J6-01,J6-02,J6-03,U4-02` — Sync loop + idempotency: worker/interval kirim batch via SDK, tangani `ON CONFLICT DO NOTHING` = sukses (retry bukan error), **undo-after-sync** (op tombstone + recompute `running_total`), **draft-restore-check** utk registrasi (cek `ticket_number exists for phone` sebelum submit ulang); done when test: submit ganda → 1 row; retry setelah sukses → UI hijau; undo setelah sync → row hilang + running_total benar.
      FILES: src/lib/offline/sync.ts (baru), src/lib/offline/__tests__/sync.test.ts (baru)
      VERIFY: bun run test
      Edge: conflict retry — `ON CONFLICT` mengembalikan row → treat sebagai sukses, jangan show error; tombstone op harus di-proses berurutan setelah insert-nya (queue order), kalau tidak running_total kacau; offline queue vs realtime double-update → leaderboard pakai satu sumber (post-sync) utk konsistensi.

- [ ] `O2-04` · `FE/WAIT/P1/E:XS` · `DEP:O2-02` · `BLOCKS:U4-05` — Offline UI: banner "luring — data tersimpan lokal" + badge jumlah antrean + status online/offline store (`navigator.onLine` + event); done when UI berubah state saat toggle DevTools offline, badge = jumlah queue pending.
      FILES: src/lib/offline/networkStore.ts (baru), src/lib/components/OfflineBanner.svelte (baru)
      VERIFY: bun run test && bun run build && manual DevTools
      Edge: `navigator.onLine` tidak andal — kombinasi dengan hasil fetch gagal; banner tidak boleh menutup tombol aksi juri; queue badge update realtime via store subscription.

- [ ] `O2-05` · `RUN/WAIT/P1/E:S` · `DEP:O2-03` · `BLOCKS:Q8-04` — High-water reconcile: simpan `received_at`/server time tertinggi per device, re-sync hanya delta; done when test membuktikan re-sync tidak double-insert dan urutan benar.
      FILES: src/lib/offline/reconcile.ts (baru), src/lib/offline/__tests__/reconcile.test.ts (baru)
      VERIFY: bun run test
      Edge: clock klien miring → high-water dari SERVER, bukan local; device ganti → high-water dibaca dari server (query max received_at), bukan localStorage; conflict dengan row yang diedit (hias edit window) → last-write-wins + audit.

## FASE 3: KOMPONEN SHARED

- [ ] `C3-01` · `FE/WAIT/P0/E:M` · `DEP:F0-03` · `BLOCKS:J6-01,J6-02,J6-03,A7-01,A7-02,A7-03` — `PinGate.svelte`: baca `PUBLIC_JURI_PIN`/`PUBLIC_ADMIN_PIN` dari env (hash SHA-256 dibandingkan, bukan plaintext), 4-digit pad, simpan sukses di `sessionStorage` (bukan localStorage), lockout 5x salah PIN per sesi (cooldown 30s), slot `children` dirender hanya setelah lolos; done when test: PIN benar → render, salah 5x → lockout, refresh session → tetap terbuka.
      FILES: src/lib/components/PinGate.svelte (baru), src/lib/components/__tests__/PinGate.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: `crypto.subtle` butuh secure context — polyfill di test (F0-06 note); PIN di hash SHA-256 bundle = UX gate, catat ulang di kode (bukan security claim); akses `/display` pakai ADMIN_PIN juga.

- [ ] `C3-02` · `FE/WAIT/P0/E:S` · `DEP:F0-05` · `BLOCKS:J6-01,J6-02` — Toast + `UndoToast.svelte`: sistem toast global + undo bar 5 detik (progress), API `undoable(message, onConfirm, onUndo)`; done when test: toast auto-dismiss 5s, undo membatalkan, confirm kedua tidak jalan (idempotent).
      FILES: src/lib/components/toast/ToastSystem.svelte (baru), src/lib/components/toast/toastStore.ts (baru), src/lib/components/__tests__/UndoToast.test.ts (baru)
      VERIFY: bun run test
      Edge: tombol undo dua kali cepat → sekali jalan; timer + unmount komponen → clear interval (leak); undo saat aksi sudah sync = opsional tombstone (dipanggil via O2-03 callback).

- [ ] `C3-03` · `FE/WAIT/P1/E:M` · `DEP:F0-02` · `BLOCKS:U4-04,P5-01` — QR + print + WA helper: generate QR dari `PUBLIC_BASE_URL/panitia/checkin?id={id}`, print CSS thermal (58/80mm), helper `wa.me` text share; done when unit test QR payload benar, print layout render dua ukuran.
      FILES: src/lib/components/QRCode.svelte (baru), src/lib/utils/thermal.ts (baru), src/lib/utils/whatsapp.ts (baru), src/lib/utils/__tests__/thermal.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: `PUBLIC_BASE_URL` kosong → komponen QR menampilkan placeholder + warning (jangan generate QR sampah); QR perlu quiet zone — padding bawaan library diperiksa; print 58mm vs 80mm — pilih lebar dari config/query, jangan hardcode.

- [ ] `C3-04` · `FE/WAIT/P2/E:S` · `DEP:F0-05` · `BLOCKS:A7-03,U4-05` — TTS announcer: Web Speech API `id-ID`, antrean ucapan, **tombol "nyalakan suara" eksplisit** (mobile autoplay-block), fallback diam saat API tak tersedia; done when test: enqueue → ucapan berurutan, gesture-required tertangani.
      FILES: src/lib/tts/ttsAnnouncer.ts (baru), src/lib/components/SoundToggle.svelte (baru), src/lib/tts/__tests__/ttsAnnouncer.test.ts (baru)
      VERIFY: bun run test
      Edge: `speechSynthesis` null di beberapa browser → graceful silent + toggle disabled; voice id-ID mungkin belum ke-download → fallback ke voice default; jangan heap ucapan saat offline (queue cap + drop tertua).

- [ ] `C3-05` · `FE/WAIT/P0/E:XS` · `DEP:F0-03` · `BLOCKS:U4-01` — `CountdownTimer.svelte`: baca `PUBLIC_EVENT_DATE`, 4 state (segera/live/habis/error), format countdown d/m/j/m/detik, state live → highlight gold; done when test: date parse valid, countdown decrement, state transisi benar.
      FILES: src/lib/components/CountdownTimer.svelte (baru), src/lib/components/__tests__/CountdownTimer.test.ts (baru)
      VERIFY: bun run test
      Edge: `PUBLIC_EVENT_DATE` invalid → error state + pesan, bukan NaN; timezone — pakai offset eksplisit env, jangan `local` asumsi; timer interval cleanup saat unmount.

## FASE 4: ALUR USER

- [ ] `U4-01` · `FE/WAIT/P0/E:M` · `DEP:F0-05,C3-05,D1-04` · `BLOCKS:U4-02` — Landing `/`: hero + countdown + card daftar lomba (dari `competitions`) + ringkasan skor (dari leaderboard engine); done when render data live ATAU demo, akses ke `/daftar` dan `/leaderboard` benar.
      FILES: src/routes/+page.svelte, src/lib/components/HeroSection.svelte (baru), src/lib/components/CompetitionList.svelte (baru)
      VERIFY: bun run check && bun run build
      Edge: lomba non-aktif (`is_active=false`) → card disabled + alasan; loading state jangan spinner kosong (skeleton); `PUBLIC_APP_NAME`/`YEAR` dipakai di hero.

- [ ] `U4-02` · `FE/WAIT/P0/E:M` · `DEP:U4-01,D1-01,O2-03` · `BLOCKS:U4-03` — Pendaftaran `/daftar`: form nama+WA+pilih lomba, DP vs lunas (min_dp), warning merah no-refund wajib tampil, **quota race** (atomic update, 0 row → popup habis), **idempotency registration** (token localStorage, restore-check "ticket exists by phone"), draft tersimpan saat submit timeout; done when test: kuota habis → tolak; double-submit → 1 peserta; refresh setelah timeout → form terisi + tidak double-insert.
      FILES: src/routes/daftar/+page.svelte, src/lib/components/RegistrationForm.svelte (baru), src/lib/offline/draftStore.ts (baru), src/lib/components/__tests__/RegistrationForm.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: nomor WA — validasi format Indonesia (62/08), simpan kanonik; kuota habis antara load & submit → tampilkan popup bukan error mentah; pendaftaran offline → antrean + tiket dibuat setelah sync; lomba yang sudah `checked_in` penuh → tolak.

- [ ] `U4-03` · `FE/WAIT/P0/E:M` · `DEP:U4-02,D1-01,D1-05` · `BLOCKS:U4-04,A7-01` — Pembayaran: pilih metode dari `payment_configs` aktif (bank/ewallet/qris), upload bukti (compressor D1-05 ≤200KB), buat `participant_payments`, status `dp_paid`/`fully_paid`; done when test: DP bawah min_dp ditolak, upload terkompresi, payment tersimpan (live atau antrean).
      FILES: src/lib/components/PaymentMethodSelector.svelte (baru), src/lib/components/ImageUploader.svelte (baru), src/routes/daftar/+page.svelte
      VERIFY: bun run test && bun run check
      Edge: metode non-aktif tak muncul; bukti WAJIB untuk transfer, opsional cash; upload gagal saat offline → simpan draft bukti (blob/url), tawarkan ulang saat online; jangan biarkan user pilih QRIS saat `qris_image_url` kosong (fallback ke instruksi teks).

- [ ] `U4-04` · `FE/WAIT/P1/E:M` · `DEP:U4-03,C3-03,O2-01` · `BLOCKS:P5-01` — E-tiket `/tiket/[id]`: tampil QR (C3-03), print thermal, tombol "Hubungi Panitia via WA"; done when URL QR benar, print 58mm rapi, link wa.me valid.
      FILES: src/routes/tiket/[id]/+page.svelte, src/lib/components/ThermalPrintButton.svelte (baru), src/lib/components/WaShareButton.svelte (baru)
      VERIFY: bun run check && bun run build
      Edge: tiket id tak ditemukan → 404 halaman ramah + CTA daftar; status `disqualified` → tiket menampilkan batal; QR harus regenerable offline (payload dari env, bukan fetch live).

- [ ] `U4-05` · `FE/WAIT/P1/E:M` · `DEP:U4-01,D1-04,D1-06,C3-04,O2-04` · `BLOCKS:A7-03` — Leaderboard `/leaderboard`: subscribe realtime channel (dengan teardown saat demo OFF/ON), tampil per-kompetisi via engine (tie-break `received_at`), post-sync refresh utk konsistensi, TTS trigger skor baru opsional; done when test: update realtime render, urutan benar untuk semua mode, offline fallback ke last-known.
      FILES: src/routes/leaderboard/+page.svelte, src/lib/components/ScoreboardTable.svelte (baru), src/lib/components/__tests__/ScoreboardTable.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: koneksi putus → tampilkan last-known + banner (jangan hilangkan data); perubahan setelah `checked_in` (mis. diskualifikasi) → leaderboard update; channel error → auto-retry dengan backoff, jangan spam log.

## FASE 5: PANITIA

- [ ] `P5-01` · `FE/WAIT/P1/E:M` · `DEP:U4-04,C3-03` · `BLOCKS:P5-02` — Scanner check-in `/panitia/checkin`: lazy-load `html5-qrcode` (cuma route ini), parse `?id=`, **manual entry fallback** (ketik no. tiket, input nomor kamera perm denied), state scan (scanning/sukses/error); done when scan sukses → panggil status flow (P5-02), manual entry bekerja tanpa kamera.
      FILES: src/routes/panitia/checkin/+page.svelte, src/lib/components/QrScanner.svelte (baru)
      VERIFY: bun run check && bun run build && manual (kamera)
      Edge: permission kamera denied → fallback manual + pesan jelas; cahaya buruk → pesan panduan; bundle scanner TIDAK masuk route lain (lazy import, verifikasi bundle split).

- [ ] `P5-02` · `FE/WAIT/P1/E:S` · `DEP:P5-01` · `BLOCKS:—` — Detail + status flow: `ParticipantDetailCard` (nama, lomba, status, sisa bayar), transisi `registered/dp_paid/fully_paid → checked_in`, **syarat masuk: minimal `dp_paid`** (keputusan), re-scan idempotent (sudah `checked_in` → info, bukan error), `disqualified` → blokir; done when test: tiap transisi status valid/invalid teruji.
      FILES: src/lib/components/ParticipantDetailCard.svelte (baru), src/lib/components/__tests__/ParticipantDetailCard.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: sisa bayar >0 → tampil + tagih onsite hanya bila `quota - terdaftar > 0`; status invalid → tolak dengan alasan + audit entry; offline → antrean status update.

## FASE 6: JURI

- [ ] `J6-01` · `FE/WAIT/P0/E:M` · `DEP:C3-01,C3-02,O2-03,D1-06` · `BLOCKS:U4-05,A7-01` — Panel mancing `/juri/mancing`: PinGate, numpad raksasa, pilih lapak (1–100), toggle jackpot pita, mode dari `scoring_mode`, submit via queue (UI hijau/kuning), undo 5s utk jackpot keliru; done when test: timbangan ≤0 ditolak, jackpot dup → konfirmasi, submit ganda → 1 row, UI state benar saat offline.
      FILES: src/routes/juri/mancing/+page.svelte, src/lib/components/WeightInputPad.svelte (baru), src/lib/components/__tests__/WeightInputPad.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: input non-numeric ditolak; lapak kosong (belum terdaftar) → warning; jackpot kedua utk lapak sama → konfirmasi "timpa/abaikan"; timbangan >50kg (curiga salah ketik) → konfirmasi; numpad padding tetap ≤24px container (ARCHITECTURE §3).

- [ ] `J6-02` · `FE/WAIT/P0/E:M` · `DEP:C3-01,C3-02,O2-03` · `BLOCKS:U4-05` — Panel layangan aduan `/juri/layangan`: PinGate, tombol raksasa MUDUN/PUTUS per peserta, UndoToast 5s (dua state: belum sync = hapus queue, sudah sync = tombstone), **round indicator** (dari `current_round`), state machine `aktif→mudun|putus`; done when test: transisi valid, undo dua state benar, round berubah → board reset.
      FILES: src/routes/juri/layangan/+page.svelte, src/lib/components/BigRedButton.svelte (baru), src/lib/components/__tests__/BigRedButton.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: double-tap cepat → 1 op (guard tombol saat in-flight); peserta sudah `putus` di round ini → tombol disabled + alasan; undo setelah round maju → tolak (round berubah = konteks beda); multi-device last-write-wins (catat, jangan cegah).

- [ ] `J6-03` · `FE/WAIT/P1/E:M` · `DEP:C3-01,C3-02,O2-03,D1-06` · `BLOCKS:U4-05` — Panel hias `/juri/layangan-hias`: PinGate, 3 slider 0–100 (estetika/stabil/kreativitas), preview `total_weighted` live, submit via queue, **edit window 5 menit** (dari `edited_at`), rescore luar window → tolak + audit; done when test: bobot benar, window berlalu → tolak, submit ganda → 1 row.
      FILES: src/routes/juri/layangan-hias/+page.svelte, src/lib/components/HiasScoreForm.svelte (baru), src/lib/components/__tests__/HiasScoreForm.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: slider kosong → submit disabled; edit hanya boleh oleh actor sama (hash PIN sama); window timeout dihitung server-side (`edited_at`), bukan timer klien (user bisa putar jam).

## FASE 7: ADMIN & DISPLAY

- [ ] `A7-01` · `FE/WAIT/P0/E:M` · `DEP:C3-01,D1-03,U4-03` · `BLOCKS:A7-04` — Dashboard admin `/admin`: PinGate (ADMIN_PIN), tabel `participant_payments` belum diverifikasi (dengan gambar proof), tombol Verifikasi/Tolak + alasan, tulis `audit_logs` (action + actor_hash), `verified_by` hash; done when test: verifikasi → status pembayaran update + audit row, tolak → status + reason.
      FILES: src/routes/admin/+page.svelte, src/lib/components/PaymentReviewTable.svelte (baru), src/lib/components/__tests__/PaymentReviewTable.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: bukti hilang/gagal load → jangan bisa verifikasi (tombol disabled); jumlah DP vs fee tidak cocok → warning "jumlah kurang"; dua admin verifikasi bersamaan → last-write-wins + audit dua entri; gambar proof tidak boleh di-cache lama (supabase storage signed/expiry).

- [ ] `A7-02` · `FE/WAIT/P1/E:M` · `DEP:C3-01,D1-01` · `BLOCKS:A7-03` — Config & round manager: CRUD `payment_configs` (aktif/non-aktif, QRIS image), kelola `competitions` (fee, quota, scoring_mode, is_active), **advance round** (`current_round +1`) → reset board layangan utk round baru; done when test: CRUD valid, round advance hanya utk mode aduan, board reset dipicu.
      FILES: src/lib/components/ConfigManager.svelte (baru), src/lib/components/RoundManager.svelte (baru), src/lib/components/__tests__/RoundManager.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: advance round saat masih ada peserta `aktif` → konfirmasi tegas (data bisa hilang); non-aktifkan lomba saat ada peserta → blokir (atau alasan tertulis); setiap perubahan config → audit entry.

- [ ] `A7-03` · `FE/WAIT/P1/E:M` · `DEP:A7-02,U4-05,C3-04` · `BLOCKS:Q8-02` — Display mode `/display`: layar penuh leaderboard (reuse U4-05 engine), hide nav (route group khusus), auto-update realtime, TTS pengumuman (check-in/skor baru via C3-04), clock/round header; done when render full-screen stabil, TTS trigger saat event, tanpa interaksi mouse.
      FILES: src/routes/display/+page.svelte, src/lib/components/DisplayScreen.svelte (baru)
      VERIFY: bun run check && bun run build && manual preview
      Edge: layar tidur — Wake Lock API + fallback; TTS off → mode hening (jangan error); display di route group yang exclude nav (cek F0-05); koneksi putus → last-known + banner kecil (jangan layar hitam).

- [ ] `A7-04` · `FE/WAIT/P2/E:S` · `DEP:A7-01` · `BLOCKS:Q8-04` — Export + data lock: tombol export CSV (peserta, pembayaran, peringkat per lomba) + **toggle data lock** (blokir semua tulis non-admin, set flag + audit); done when test: CSV kolom lengkap, lock ON → tulis non-admin ditolak.
      FILES: src/lib/utils/export.ts (baru), src/lib/components/DataLockControl.svelte (baru), src/lib/components/__tests__/DataLockControl.test.ts (baru)
      VERIFY: bun run test && bun run check
      Edge: CSV dengan nilai koma → escape benar (RFC 4180); export offline → queue + notif; lock permanen per acara (tidak ada unlock UI) — pastikan teks konfirmasi tegas.

## FASE 8: QA & DEPLOY

- [ ] `Q8-01` · `QA/WAIT/P1/E:M` · `DEP:F0-07` + semua fase 0–7 `DONE` · `BLOCKS:Q8-03` — Build + audit: `bun run build` produksi, audit Lighthouse (PWA installable, a11y, perf ≥90), periksa bundle split (scanner lazy), SW update path; done when skor tercatat di `JOURNAL.md`, temuan ditindak atau di-DEFERRED.
      FILES: (hasil audit) .omo/../doc/RUN-REPORT.md, JOURNAL.md
      VERIFY: bun run check && bun run lint && bun run build && bunx lighthouse <preview-url>
      Edge: PWA audit butuh HTTPS (vite preview tidak) — pakai tunnel atau deploy preview dulu; skor di bawah 90 → perbaiki atau catat alasan; bundle split diverifikasi di network tab (scanner hanya di route panitia).

- [ ] `Q8-02` · `QA/WAIT/P1/E:M` · `DEP:U4-05,J6-03,A7-03,D1-04` · `BLOCKS:Q8-04` — Smoke e2e demo mode: alur penuh offline + demo data (landing → daftar → bayar → tiket → juri mancing/layangan/hias → leaderboard → admin verify → display); done when tiap langkah diverifikasi manual/test dan tercatat, bug ditemukan → task baru atau fix task terkait.
      FILES: (evidence) doc/RUN-REPORT.md
      VERIFY: manual checklist di RUN-REPORT + bun run test (suite penuh sekali)
      Edge: gunakan demo mode (tanpa DB) untuk smoke; jangan jalankan suite penuh per task — sekali di fase ini; temuan yang butuh keputusan → DEFERRED + JOURNAL.

- [ ] `Q8-03` · `REL/WAIT/P1/E:S` · `DEP:Q8-01` · `BLOCKS:—` — Deploy Cloudflare Pages: buat project, export `PUBLIC_*` env di dashboard, **SPA fallback `_redirects`** (`/* /index.html 200`), domain, verifikasi deep-link `/tiket/xyz` tidak 404; done when URL live + deep-link render; **HUMAN QUEUE** (butuh akun CF Pages + domain).
      FILES: build/_redirects (baru), README deploy section
      VERIFY: curl -I <url>/tiket/xyz (200, bukan 404) && curl <url> (HTML index)
      Edge: `_redirects` harus ikut output build (folder `build/`, bukan root repo); env `PUBLIC_BASE_URL` di CF harus URL final, bukan localhost; cache CF lama → hard refresh test setelah deploy.

- [ ] `Q8-04` · `RUN/WAIT/P1/E:S` · `DEP:Q8-02,O2-05` · `BLOCKS:—` — Sync-test nyata + kalibrasi: 2 perangkat offline→online, idempotency & high-water, undo-after-sync, timbangan berbarengan; **ukur dan perbarui tabel timeout di skill rawe1**; done when hasil sync test tercatat, timeout table real (bukan estimasi).
      FILES: .opencode/skills/rawe1/SKILL.md (timeout table), doc/RUN-REPORT.md
      VERIFY: artefak — hasil sync test + tabel timeout terukur
      Edge: butuh 2 perangkat/2 orang = **human queue** (BLOCKED+JOURNAL kalau belum); kalau bertemu bug sync → fix task baru atau amend task terkait (jangan commit baru utk task lama — disiplin amend).

---

## Kanon format task

Contoh benar:

```text
- [ ] `F9-99` · `OPS/WAIT/P0/E:S` · `DEP:F0-02` · `BLOCKS:F0-03` — Setup env; done when ...
      FILES: .env.example (baru)
      VERIFY: bun run build
```

Contoh salah:

```text
- [ ] `F9-99` · `OPS / WAIT / P0 / E:S` ...   ← spasi dalam segmen
- [ ] `F9-99` · `OPS/WAIT/P0/E:S` · `BLOCKS:F9-99` ...  ← BLOCKS harus ID task/gate nyata, bukan diri sendiri
```

`F9-99` adalah ID ilustrasi, bukan task nyata — entri asli hanya di bawah
heading fase.
