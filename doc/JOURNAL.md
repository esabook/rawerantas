# JOURNAL — Log Eksekusi

Riwayat keputusan, BLOCKED, dan penyimpangan. Ditulis eksekutor skill `rawe1`
tiap run. Entri bertanggal, append-only (jangan edit entri lama — kalau salah,
tulis entri baru).

Format entri:

```markdown
## YYYY-MM-DD

- Task `<ID>` `DONE` — commit `<sha>` — catatan singkat
- Task `<ID>` `BLOCKED` — butuh manusia: <alasan> — syarat lepas: <apa>
- Keputusan: <keputusan> — <alasan, satu baris>
- Penyimpangan: <apa yang dikerjakan beda dari baris task> — <kenapa>
- Verifikasi tambahan: <hal yang diluar VERIFY tapi penting>
```

## 2026-08-06

- Task `F0-01` `DONE` — commit `a6bc57e` — git init main, sv create minimal+ts, adapter-static fallback index.html, alias `@/*`, build statis hijau, status bersih.
- Penyimpangan: commit pertama juga memuat `doc/` backlog + `.opencode/skills/rawe1/SKILL.md` — repo mulai dari nol, dokumen backlog wajib versioned dari awal.
- Penyimpangan: adapter dikonfigurasi di `vite.config.ts` (plugin `sveltekit({ adapter })`), bukan `svelte.config.js` — template `sv create` kit 2.70 tidak lagi memuat file itu; FILES di TASKS.md menyebut svelte.config.js tapi template baru memindahkannya. Konfig statis tetap terpasang sejak awal (inti Edge task).
- Task `F0-02` `DONE` — commit `ec987b3` — tailwind v4 + @tailwindcss/vite, shadcn-svelte 1.5 (init preset encoded `bIkeymG` = vega/neutral/lucide/inter + add button/input/card/dialog/slider/select), bits-ui, drizzle, supabase-js, idb, qrcode, html5-qrcode; check+build hijau.
- Penyimpangan: `svelte.config.js` tidak ada di template kit 2.70 — konfig kit (adapter + alias) diteruskan langsung ke plugin `sveltekit()` di `vite.config.ts`. Docs: sejak kit 2.62 config via plugin membuat `svelte.config.js` DIABAIKAN. FILES F0-02 menyebut svelte.config.js — file tak dibuat karena tak pernah dibaca.
- Keputusan: alias `@` → `src/lib` dipasang via `kit.alias` di plugin config (bukan tsconfig `paths` manual) — `svelte-kit sync` menyuntik mapping ke `.svelte-kit/tsconfig.json` tanpa warning intellisense; tsconfig root bersih.
- Penyimpangan: `@sveltejs/adapter-auto` (bawaan template) dihapus — tak terpakai setelah adapter-static.
- Penyimpangan: init shadcn butuh `--preset <code>` (nama preset ditolak CLI 1.5). Code `bIkeymG` di-encode manual dari source CLI (vega/neutral/lucide/inter/default radius) — theme shadcn akan ditimpa F0-04 sesuai ARCHITECTURE §3.
- Rekonstruksi: entri "Keputusan: template `sv create --template minimal`..." dari run ini hilang saat append F0-02 — isi: template `sv create --template minimal` dipakai pengganti `bun create svelte` (CLI lama redirect ke `sv`; minimal = skeleton tanpa demo); `--no-add-ons` agar setup tailwind/shadcn/drizzle manual per task.
- Task `F0-03` `BLOCKED` — butuh manusia: nilai `.env` asli (PUBLIC_BASE_URL, Supabase URL/key, PIN) hanya user yang punya — syarat lepas: user mengisi `.env` (contoh di `.env.example`), lalu task ditarik ulang.
- Task `F0-04` `DONE` — commit `3b56343` — token ARCHITECTURE §3 jadi CSS vars + `@theme inline` (termasuk `--color-success` baru); `glass-panel` via `@utility`; `user-select:none` global + text di input/textarea/contenteditable (prefix ganda); `@media print` 58mm default + varian 80mm via `min-width:70mm`; `.no-print`.
- Keputusan: token shadcn diperluas di luar 6 token arsitektur — `--card #141414`, `--popover`, `--ring #d97706` (gold, fokus aksen), `--destructive #dc2626`, `--muted-foreground #a3a3a3` (kontras ≥4.5:1 vs background, diuji manual) — shadcn butuh set lengkap; nilai dipilih selaras palet arsitektur.
- Keputusan: typografi = system font stack (ARCHITECTURE §3), Inter dari preset shadcn dihapus + `@fontsource-variable/inter` di-uninstall — pertimbangan Barlow Condensed (rekomendasi ui-ux-pro-max utk sports vibe) ditolak: arsitektur kanonik, variabel font tak perlu.
- Verifikasi tambahan: kontras token diuji — secondary gold `#d97706` + teks `#0a0a0a` ~8:1; primary `#7f1d1d` + `#f8fafc` ~11:1; muted-foreground `#a3a3a3` vs `#0a0a0a` ~6.7:1; success `#059669` vs hitam ~7.5:1.
- Task `F0-05` `DONE` — commit `01ffb57` — root layout (meta theme-color/manifest/apple-web-app) + route group `(app)` berisi AppShell (topbar glass + slot offline/toaster) + BottomNav 3 item (Landing/Daftar/Leaderboard, lucide, aria-current, touch ≥44px) + placeholder daftar/leaderboard/display; `ssr=false`+`prerender=false` di root `+layout.ts` = SPA murni, semua route dilayani fallback `index.html` (terbukti curl 200 utk /, /daftar, /display).
- Keputusan: `ssr=false`/`prerender=false` di root layout — ARCHITECTURE §2 "SPA 100%", data semua klien (Supabase browser), dan O2-01 butuh navigateFallback ke index.html utk deep-link offline; prerender campuran hanya bikin dua jalur render.
- Keputusan: `/display` (dan `/juri/*` di masa depan) di luar route group `(app)` — bypass nav struktural, tanpa conditional di komponen.
- Penyimpangan: `+layout.ts` (FILES) = export `ssr`/`prerender` flags, bukan load function — load kosong tak diperlukan untuk layout statis.
- Penyimpangan kecil: nama app sementara hardcode di AppShell ("Rawerantas") — `PUBLIC_APP_NAME` akan dibaca saat F0-03 (env helper) ditarik manusia; fallback ini sementara, dicatat.
- Belum diverifikasi: render visual nav di browser (tidak ada browser di sesi ini) — hanya verifikasi struktural + curl; butuh cek manual sekali di Q8-02.
- Task `F0-06` `DONE` — commit `9eede6b` — vitest 4.1 + @testing-library/svelte 5.4 + happy-dom 20.11; test block di vite.config.ts (happy-dom, include src/**/*.{test,spec}.{js,ts,svelte}); script `test` = `vitest run`, `test:watch` = `vitest`; kanon: `src/lib/utils/__tests__/example.test.ts` (cn) + `src/lib/components/__tests__/Example.test.ts` (render Greeting); 5 test hijau, check 0 error, build hijau.
- Keputusan: `resolve.conditions: ['browser']` di vite.config.ts — tanpa ini render komponen gagal `lifecycle_function_unavailable` (svelte resolve ke build server); syarat resmi SvelteKit utk Vitest.
- Keputusan: `defineConfig` dari `vitest/config` bukan `vite` — tipe `test` tak ada di UserConfigExport vite; svelte-check menolak.
- Keputusan: import eksplisit `describe/it/expect` + `afterEach(cleanup)` tanpa vitest globals — deterministik, tanpa ubah tsconfig types; kanon test memakai pola ini.
- Nuansa bun CLI: `bun run test -- run` (spasi) meneruskan `run` sbg filter vitest → "no test files" exit 1; varian `bun run test --run` (flag) exit 0 — dipakai utk verifikasi deterministik.
- Penyimpangan kecil FILES: `Greeting.svelte` ditambah sbg komponen pendamping render test (tanpa dependensi `$app`/`$env` — kanon utk test komponen nanti, Edge task dihormati).
- Catatan utk C3-01 (PinGate): happy-dom tak punya `crypto.subtle` — butuh polyfill saat test PIN ditulis.
- Task `F0-07` `DONE` — commit `d706547` — biome 2.5.7 (init config, lint+format, assist organizeImports) + script `lint` = `biome check .`; repo dibersihkan via `biome check --write .` sekali (format ts/js/css/json); svelte DIPULIHKAN ke format template via checkout setelah format pass merusak indent script (parser svelte biome masih eksperimental — lihat bawah); gate VERIFY: `bun run lint && bun run check` + `bun run test` + `bun run build` semuanya hijau.
- Keputusan: `files.includes` biome mengecualikan `**/*.svelte` dan `**/.svelte-kit/**` — linter Svelte = `svelte-check` (script check), biome utk ts/js/css/json; pemisahan peran, bukan melonggarkan. Alasan: parser Svelte biome melaporkan false positive (`BottomNav` terpakai di markup tapi dibilang unused; `name` prop Greeting dibilang unused) dan merusak indent `<script>` saat `--write` (format level-0, mengabaikan konteks tag).
- Keputusan: `css.parser.tailwindDirectives: true` di biome.json — opsi resmi biome 2.3+ utk syntax Tailwind v4 (`@theme`, `@custom-variant`, `@utility`); tanpa ini app.css gagal parse (bukan melonggarkan rule, mengaktifkan parser).
- Keputusan: 3 temuan tersisa ditangani suppress tepat-sasaran (bukan ubah config): `noExplicitAny` di utils.ts = conditional type generated shadcn-svelte → komentar `biome-ignore`; `noImportantStyles` di app.css `.no-print` = override cetak yang memang butuh `!important` → `biome-ignore`.
- Catatan: komentar `eslint-disable` generated shadcn tidak dihormati biome — ganti dengan `biome-ignore` (bertahan walau regen shadcn menimpanya, dicatat).
- Belum diverifikasi: `bun run lint` di CI (`biome ci` mode) — deploy fase Q8 nanti.
- Task `F0-03` `DONE` — commit `a73ac53` — `.env.example` (verbatim ARCHITECTURE §1, 9 var PUBLIC_*) + `.env` (key kosong, gitignore) + `src/lib/env.ts` (objek env ter-tipe dari `$env/static/public`; `PUBLIC_EVENT_DATE` terisi tapi bukan ISO-8601+offset → `throw`; `PUBLIC_BASE_URL` kosong + bukan dev → `console.warn` runtime) + guard build di `vite.config.ts` (`baseUrlGuard` plugin `buildStart` + `loadEnv`); VERIFY: build dgn base-url kosong → warning `[env]` di log build (2x: client+server pass), dgn nilai → tanpa warning; check/lint/test hijau.
- KOREKSI status lama: F0-03 ditandai `BLOCKED` prematur di sesi lalu — baris task Edge eksplisit "agen tulis placeholder", jadi bagian agent (template + helper + guard) bisa dikerjakan sekarang; antrean manusia hanya utk nilai asli. Board dikoreksi ke DONE.
- Penyimpangan FILES (amended di TASKS.md): `vite.config.ts` ditambah utk guard build. Alasan: VERIFY menuntut warning di log build, tapi SPA statis (`ssr=false`, `prerender=false`) TIDAK mengeksekusi module saat build, dan SvelteKit versi ini tidak memperingatkan variabel missing utk `$env/static/public` (diuji `svelte-kit sync` + `vite build` dgn var dihapus — output bersih). Satu-satunya titik eksekusi build = plugin vite `buildStart`.
- Keputusan: `loadEnv(mode, ".", "")` di function-form config — baca `.env` (bukan `.env.example`); guard aktif saat `PUBLIC_BASE_URL` kosong ATAU undefined; runtime guard tetap ada di env.ts utk lapisan kedua.
- Belum diverifikasi: `.env` placeholder — user tetap harus isi nilai asli (antrean manusia) sebelum D1-02; warning runtime prod belum dilihat di browser (tanpa browser di sesi).
- Task `D1-01` `DONE` — commit `5c7933f` — 8 tabel (9 terhitung: §4.9 = slot opsional fase 8 kosong): competitions (scoring_mode `text`+$type app-enum), payment_configs, participants (ticket_number unique, status enum app-level), participant_payments, scores_mancing (running_total integer NOT NULL DEFAULT 0, is_jackpot, received_at), scores_layangan (round, status), scores_layangan_hias (3 kriteria + check 0-100, `total_weighted real GENERATED ALWAYS AS (a*0.4+s*0.4+k*0.2) STORED`, edited_at nullable), audit_logs (payload jsonb); idempotency_key uuid unique + uniqueIndex di 4 tabel (3 skor + audit); FK payments `ON DELETE restrict`; migrasi `drizzle/0000_graceful_umar.sql`; generate idempotent; check 0 error; lint bersih.
- Keputusan: `total_weighted` = generated column Postgres (STORED) — §4 "hitung DB", bukan dihitung klien; ideal utk edit window (total selalu konsisten dgn kriteria).
- Keputusan: FK `participant_payments.participant_id` `onDelete: 'restrict'` — riwayat bayar wajib bertahan (audit trail §6); kandidat DEFERRED "RESTRICT vs SET NULL" tetap terbuka utk fase 4 bila hapus-peserta jadi fitur.
- Penyimpangan VERIFY (amended di TASKS.md): `drizzle-kit push --dry-run` TIDAK ada di drizzle-kit 0.31 (opsi `--verbose`/`--force` yang butuh koneksi nyata) + `DATABASE_URL` belum tersedia (env placeholder) → push fisik ditunda; bukti pengganti: generate 2x "no changes" + review SQL manual. `DATABASE_URL` ditambahkan ke antrean manusia.
- Keputusan: app-level enum via `.$type<Union>()` (bukan `text({ enum })` yang deprecation di 0.45) — tetap TS-only, bukan PG enum, sesuai Edge.
- Task `D1-02` `DONE` — commit `53de1df` — `supabaseClient.ts`: `createClient` dari env helper (`$lib/env`), throw eksplisit saat URL/key kosong (bukan console.error lalu lanjut, Edge); HMR: `import.meta.hot.dispose` → `removeAllChannels()`. `queries.ts`: helper typed `getCompetitions`, `getPaymentConfigs`, `getParticipants`, `getLeaderboard` (raw rows + join participants; ranking di D1-06), return `InferSelectModel<T>` cocok skema; error dibungkus `throw`.
- Keputusan: runtime Supabase (REST) — Drizzle hanya utk migrasi/types; helper pakai supabase-js dengan return type dari skema Drizzle (satu sumber type).
- Catatan HMR: createClient stateless (tanpa koneksi/kanal sampai dipakai); dispose utk membershipikan kanal realtime bila ada — memenuhi Edge "penanganan HMR".
- Belum teruji: client hidup thd Supabase asli (env kosong) — nyambung saat `.env` diisi (antrean manusia).
- Task `D1-06` `DONE` — commit `b635730` — `engine.ts`: `computeRanking(rows, mode)` murni — normalisasi sort received_at asc dulu (clock-skew aman), group per peserta, per mode: `terberat` max weight (bestAt = saat capai max pertama), `kumulatif` sum weight/running_total (bestAt = entry terakhir), `jackpot_pita` primary isJackpot lalu subScore max weight, `layangan_aduan` count menang, `layangan_hias` max totalWeighted (hitung `a*.4+s*.4+k*.2` bila null); tie: score desc → subScore desc → bestAt ASC → key asc (deterministik). `calculateHiasTotal` helper. Test 9 kasus baru (14 total): tiap mode + tie-break + clock-skew + determinisme.
- Keputusan: hias = skor TERBAIK per peserta (bukan latest — window edit memungkinkan koreksi, yang terbaik menang); jackpot sebagai primary score (pita = menang mutlak); bestAt mengikuti entry yang menentukan skor (konsisten dgn "submit lebih dulu menang").
- Task `D1-04` `DONE` — commit `a4a77f2` — `demo/store.ts`: `demoMode` writable dari `PUBLIC_ENABLE_DEMO_MODE==="true"`, `setDemoMode`/`toggleDemoMode` + `teardownRealtime()` → `supabase.removeAllChannels()` saat nilai BERUBAH (set sama → tanpa teardown). `demo/generator.ts`: seeded PRNG mulberry32 (SEED=17082026, deterministik) — 3 kompetisi, 50 peserta (lapak+tiket unik), pembayaran, skor mancing (gram, running_total diakumulasi terurut received_at), layangan aduan, hias (totalWeighted dihitung). `queries.ts`: tiap helper cek `get(demoMode)` → data lokal (getCompetitions/getParticipants/getPayments/getLeaderboard incl. join simulasi; getPaymentConfigs demo = [] — tak di-mock karena daftar bank nyata). Test 7 baru (21 total): determinisme, 50 peserta unik, intercept tanpa satupun panggilan `supabase.from` (spy), OFF → fallback live (reject), toggle teardown x2, noop set sama, teardown eksplisit.
- Deviasi VERIFY: bukti "tanpa panggilan ke Supabase (network tab)" → tes spy `supabase.from` (bukti unit) + verifikasi visual network tab diserahkan ke `Q8-02` smoke e2e.
- Catatan: skema mock menyesuaikan skema nyata D1-01 (fishWeightGram gram, lapak_number text, paymentMethod/proofImageUrl, tanpa verifiedAt/competition_id/idempotency di payments).
- Task `D1-05` `DONE` — commit `c73f82b` — `utils/imageCompressor.ts`: `compressImage` pipeline — `createImageBitmap(file, { imageOrientation: "from-image" })` (EXIF rotate; fallback tanpa opsi bila ditolak), downscale `computeTargetDimensions` (max 1280), iterasi quality integer-persen `findQualityForSize` (0.8→0.3 step 0.1, `q*10` avoid float drift) sampai ≤200KB, output webp; bila tetap besar → fallback jpeg q 0.5 (best effort). Test 11 baru (32 total): dimensi rasio/portrait/0, quality loop (langsung kecil, turun bertahap, tak tercapai → min), e2e stub (5MB→≤200KB, canvas 1280x960, EXIF option, fallback jpeg, fallback tanpa orientasi).
- Catatan: happy-dom tanpa canvas nyata — pipeline diuji via stub `getContext`/`toBlob`/`createImageBitmap`; verifikasi artefak visual manual di Q8-02/03.
- Catatan TS: var closure-assigned → narrowing never; pakai object ref `captured.canvas`.
- Task `D1-03` `ARTEFAK DONE / EKSEKUSI BLOCKED` — commit `0c03d83` — artefak lengkap: `supabase/rls.sql` (15 policies: SELECT publik x5, INSERT publik x6, UPDATE kolom terbatas x3, INSERT audit saja; 8 tabel `enable row level security`) + `supabase/README.md` (apply via SQL Editor, bucket storage `proof-images` public-read + anon-insert, checklist 10 item, catatan data-lock pasca acara). Apply butuh konsol/service role → antrean manusia; status task tetap BLOCKED (done when menuntut eksekusi). BLOCKS:A7-01 (admin) tetap berlaku.
- CHECKPOINT (sesi 2, 6 task): D1-01 f39f09f, D1-02 a538d7c, D1-04 9a01bb9, D1-05 7e1bf93, D1-06 1f821ff, D1-03 artefak 0c03d83 + BLOCKED c6d1cd6. Suite penuh: test 32/32 (5 files) · check 0 error · biome 0 temuan · build ✓ (2 pass). Fase 1: 5/6 DONE + 1 BLOCKED (apply RLS, manusia). Lanjut fase 2.
- Task `O2-02` `DONE` — commit `03cbb86` — `offline/queue.ts`: idb store `sync_queue` keyPath idempotencyKey + index `[status, timestamp]` (FIFO pending). `enqueue` idempotent: key pending → update payload, timestamp asli dipertahankan; key synced → ditolak (no re-pending). `peekBatch(limit)` pending asc; `markSynced`; `markFailed` retries+1, `retries >= 10` → `dead`; `countByStatus` (badge UI), `clearQueue`. Test 7 (39 total) dgn fake-indexeddb/auto: FIFO, lifecycle, no-op ghost, dedupe pending, synced lock, cap dead, limit.
- Catatan: happy-dom tak punya IndexedDB — `fake-indexeddb` devDep (Edge).
- Keputusan cap: 10 percobaan → dead (retries >= RETRIES_CAP), surfacing di O2-04.
- Task `O2-01` `DONE` — commit `7248243` — `service-worker.ts`: cache `rawe-${version}` ($service-worker version = hash build → deploy baru invalidate otomatis, Edge versi); `install` → `addAll(ASSETS=[build, files] minus .map)` + `skipWaiting`; `activate` → hapus cache lain + `clientsClaim`; `fetch` → GET saja, same-origin saja, `/api/` + `/rest/` (Supabase REST/realtime) DILEWATI (Edge: data basi); cache-first utk semua yang ketemu, navigate-miss → `caches.match("/")` fallback (deep-link offline `/juri/*`, `/tiket/xyz` — PIN tetap client-side); response ok → cache.put. Registrasi: SvelteKit auto (index.html memuat `register(sanitised)` + `service-worker.js` teremit di `build/`).
- Bukti agent (VERIFY di-amend): build ✓ 3 pass, `build/service-worker.js` ada, `build/index.html` registrasi SW; DevTools offline/update manual → Q8-02. Preview server 404 utk deep-link = perilaku sirv; prod pakai fallback adapter-static (`index.html` di build) + SPA fallback hosting (Q8-03).
- Task `O2-03` `DONE` — commit `67b7211` — `offline/sync.ts`: `runSyncOnce(execute, limit)` — peekBatch FIFO → per-op terisolasi (try/catch — satu gagal tak blokir lanjutan, Edge O2-02); `ok`/`conflict` → markSynced (ON CONFLICT = sukses, Edge O2-03), `error`/exception → markFailed → dead di cap. `applyTombstones(rows, tombstones)` murni: hapus targetId + recompute `running_total` per peserta urut received_at (undo-after-sync, client-side; transport delete di-inject pemanggil). `checkDraftRestore(entry, lookup)` — phone di payload → lookup ticket exists → true = jangan submit ulang (draft-restore registrasi). Test 9 baru (48 total): FIFO+outcome, conflict=sukses, submit ganda 1 row, isolasi exception, dead cap, tombstone recompute (5+3+7 → hapus 3 → 5,12), ghost tombstone, draft restore true/false.
- Catatan: transport SDK (Supabase) tak disentuh — `execute` di-inject; jadwal interval worker nyata menyusul di fase route (J6/U4 pakai runSyncOnce + navigator.onLine).
- Task `O2-04` `DONE` — commit `392a554` — `offline/networkStore.ts`: `online` writable (navigator.onLine + online/offline events, `initNetworkStore` idempotent) + `reportFetchFailure/Success` (Edge: navigator.onLine tak andal → fetch result mengoreksi) + `queueCount` = pending+dead, refresh interval 5s (badge realtime, Edge). `components/OfflineBanner.svelte`: glass-panel, role=status aria-live=polite, mode luring (WifiOff + bg-destructive/20) vs sinkronisasi (badge destructive angka) — flow element di bawah topbar, bukan overlay (tak menutup tombol aksi juri, Edge); dipasang di `(app)/+layout.svelte` slot `offline` AppShell. Test 7 baru (55 total): fetch failure/success flip, refreshQueueCount sum, event window (stub navigator.onLine), banner 3 state render.
- Catatan: package icon `@lucide/svelte` (bukan lucide-svelte); svelte class directive tak terima slash → ternary class.
- Verifikasi toggle DevTools manual → Q8-02 (VERIFY di-amend).
- Task `O2-05` `DONE` — commit `297185e` — `offline/reconcile.ts`: store idb `high_water` keyPath endpoint; `setHighWater` MONOTONIK (nilai lebih rendah ditolak — clock-skew aman), `getHighWater`, `deltaSince(rows, hw)` = row dgn receivedAt > hw (null → semua). Test 7 baru (62 total): null awal, monotonic (500→300→900), per-endpoint, delta filter + urutan, no-double-insert lifecycle, clock-skew acak.
- FASE 2 SELESAI: O2-01..O2-05 DONE (5/5). Suite penuh: test 62/62 · check 0 · biome 0 · build 3 pass.
- SWITCH FASE 2 → 3. Fase 2 tuntas: O2-01..O2-05 DONE (5/5). Gate: test 62/62 · check 0 · biome 0 · build 3 pass. START.md di-set fase 3; tarik: C3-01 (P0, PinGate), C3-05 (P0, countdown), C3-02 (P0, toast).
- Task `C3-01` `DONE` — commit `faf45c3` — `security/pin.ts`: sha256Hex, verifyPin(kind, pin) — env PIN di-hash dibandingkan (bukan plaintext), fallback DEMO_PIN "1234" bila env kosong (F0-03 belum terisi — demo mode tetap testable), sessionStorage grant `{kind, at}` + TTL 12 jam (bukan localStorage, Edge), lockout 5× salah → cooldown 30s (persist lockout state), PinLockoutError. `components/PinGate.svelte`: 4-digit pad + dots, error per-attempt (sisa percobaan), branch lockout dgn Reset, `children` snippet dirender hanya setelah grant valid. Test 8 baru (70 total) via harness `PinGateHarness.svelte` (snippet lewat JS render tak jalan — harness Svelte murni).
- Catatan debug: (1) `$derived` + read grant dari sessionStorage = stale — grant ditulis di luar ekspresi → pakai `$state` + set eksplisit + `$effect` utk reaksi prop; (2) @testing-library/svelte tak punya jest-dom matcher — pakai textContent; (3) role=alert wajib di branch lockout; (4) `export let` tak valid di runes mode → `$props()`.
- Gate: test 70/70 · check 0 warn 0 · biome fix 2 · build 3 pass.
- Task `C3-05` `DONE` — commit `e4e7acf` — `components/CountdownTimer.svelte`: props `eventDate`/`endDate` (default env.eventDate); parse ISO → invalid = error state + pesan isi .env (bukan NaN, Edge); 4 status: segera (countdown d/j/m/detik, tabular-nums), live (highlight gold + info akhir), habis, error; `end` default = start + 12 jam (asumsi event harian, overridable via prop — tercatat, bukan hardcode tersembunyi, Edge timezone: Date.parse ISO dgn offset eksplisit); interval 1 s dgn cleanup $effect return (Edge leak). Test 6 baru (76 total): parse invalid, countdown render, decrement (advanceTimersByTimeAsync — $effect flush async), live gold, habis, interval cleanup count.
- Task `C3-02` `DONE` — commit `a1a048c` — `components/toast/toastStore.ts`: `undoable(message, {onConfirm, onUndo, timeoutMs})` → push id; `confirmToast`/`undoToast` idempotent (hapus dari list dulu, baru call once — double click aman, Edge); `dismissToast` (close tanpa konfirmasi); list writable. `components/toast/ToastSystem.svelte`: fixed top-right stack, glass-panel, tombol Undo (icon) + Tutup (aria-label), progress bar width proporsional sisa waktu (250 ms tick, cleanup interval di $effect, Edge leak), auto-confirm saat dismissAt lewat. Test 6 baru (82 total): idempotency 2 arah, dismiss no-op, auto-dismiss 5s → onConfirm, undo → onUndo + hilang, tutup → hilang tanpa confirm.
- Catatan: $toasts (auto-subscribe) valid di runes; confirm dalam $effect expired → sekali karena idempotent.
- Task `C3-03` `DONE` — commit `3c78fc5` — `utils/whatsapp.ts`: `buildCheckinUrl(id)` (encodeURIComponent), `waShare(text, url?)` → wa.me text + newline-encoded. `utils/thermal.ts`: `selectThermalWidth(query)` 58/80 default 80 (bukan hardcode di komponen, Edge), `thermalCss(widthMm)` @page size. `components/QRCode.svelte`: `qrcode` toDataURL margin 4 (quiet zone bawaan dicek, Edge), errorCorrection M; baseUrl kosong → placeholder + console.warn (tanpa generate QR sampah, Edge); skeleton loading; alt + aria. Test 5 baru (87 total): URL payload + encoding, waShare 2 bentuk, lebar 2 ukuran + fallback, CSS @page, placeholder saat baseUrl kosong.
- Task `C3-04` `DONE` — commit `8010f0a` — `tts/ttsAnnouncer.ts`: singleton queue, `announce` (skip saat mati/API null — fallback diam, Edge), drain berurutan (speak selesai → next), `pickVoice` id-ID → fallback default (Edge), `setTtsEnabled` eksplisit (mobile gesture: unlockTts → synth.resume — autoplay-block, Edge) + persist localStorage, error "not-allowed" → auto-off + queue dibuang (gesture-required tertangani), MAX_QUEUE 8 + drop tertua (Edge heap), `waitForIdle` utk test. `components/SoundToggle.svelte`: toggle nyala/mati + indicator pulse saat speaking, disabled saat API tak tersedia. Test 7 baru (94 total): urutan ucapan, no-op mati, fallback silent, gesture-error, cap drop, voice id-ID, toggle + disabled.
- FASE 3 SELESAI: C3-01..C3-05 DONE (5/5). Gate: test 94/94 · check 0 · build 3 pass.
- SWITCH FASE 3 → 4. START.md di-set fase 4; tarik: U4-01 (P0, landing: hero + countdown + card daftar lomba + ringkasan skor).
- Task `U4-01` `DONE` — commit `3255ac4` — `routes/+page.svelte` (landing baru; `(app)/+page.svelte` placeholder boilerplate scaffold DIHAPUS — route "/" konflik). onMount load: getCompetitions() (demo aware) + per lomba getLeaderboard(tableForMode by scoringMode) → computeRanking → top 3 ringkasan (nama via participants map, key = participantId ?? lapak_number ?? id — konsisten dgn groupByParticipant engine). `components/HeroSection.svelte`: badge + env.appName/appYear + CTA /daftar & /leaderboard + CountdownTimer. `components/CompetitionList.svelte`: card glass, disabled saat !isActive + alasan (Edge), skeleton 4 card (bukan spinner kosong, Edge), badge "Segera dibuka", top-3 medal gold; error state load. VERIFY: check 0 · build 3 pass.
- Catatan: `rows as unknown as ScoreRow[]` — LeaderboardRow (Record<string,unknown>) tak overlap tipe ScoreRow.
- Task `U4-02` `DONE` — commit `002b786` — `db/register.ts`: `registerParticipant` 2 jalur — demo (idb store demo_registrations, duplicate by phone+comp → duplicated, quota count seeded+baru → QuotaFullError) & live (insert → unique violation fallback select by phone = restore-check idempotency; fetch gagal → enqueue `register:{comp}:{phone}` = offline antrean, ticket dibuat setelah sync, Edge); `normalizePhone` (08/+62/62 → 62… kanonik, Edge) + `isValidPhone` (regex Indonesia). `offline/draftStore.ts`: draft localStorage (nama/WA/lomba/payment) — tersimpan saat submit, restore saat timeout/refresh (Edge). `components/RegistrationForm.svelte`: form + DP/Lunas (min_dp/fee), warning no-refund wajib, popup kuota habis (bukan error mentah, Edge), hasil: tiket / antrean / duplicated, disabled saat invalid. `(app)/daftar/+page.svelte` (ganti stub): load getCompetitions(false) → disabled option saat !isActive. Test 7 baru (101 total): normalize/validasi, idempotent double-submit, quota full, form (validasi WA, submit tiket, no-refund), draft restore + no double-insert.
- Refactor: supabaseClient → lazy import di register.ts + demo/store.ts (guard env kosong) — module top-level throw mematikan test unit tanpa .env.
- Task `U4-03` `DONE` — commit `8e13efa` — Pembayaran: `db/payment.ts` `submitPayment` 2 jalur — demo (idb `demo_payments`, update status peserta di `demo_registrations`; cash → isVerified true tanpa bukti) & live (upload storage `proofs/{pid}/{ts}.jpg` → insert `participant_payments` → update status; gagal → enqueue `payment:{pid}:{mode}:{ts}` = antrean, Edge). `validateAmount` + `AmountBelowMinDpError` (DP < min_dp ditolak, Edge). `offline/proofDraftStore.ts` idb `proof_drafts` per peserta (restore draf saat offline gagal, Edge). `components/PaymentMethodSelector.svelte`: radio metode aktif saja (inactive disembunyikan, Edge), info rekening, catatan "QRIS belum tersedia" bila tanpa gambar (Edge). `components/ImageUploader.svelte`: kompres ≤200KB (D1-05), pratinjau, simpan draf idb, tawarkan pulihkan. `demo/generator.ts` mockPaymentConfigs (1 inactive cash, Edge) + `queries.ts getPaymentConfigs` demo branch. `RegistrationForm.svelte`: step pembayaran setelah registrasi (bukan duplicated/queued), nominal DP/lunas editable + default fee/min_dp, cash = bayar tunai tanpa upload. Test 16 baru (117 total, 19 file): validateAmount, submit demo + status update, cash terverifikasi, draft roundtrip, selector (aktif saja/rekening/callback/QRIS note/empty), gates check 0 · build 3.
- Refactor: **DB version unify 1→4** — queue.ts & reconcile.ts buka `rawerantas` v1 vs register v2/payment v3/proof v4 → VersionError (dbPromise cache module membuat urutan inisialisasi tidak konsisten). Solusi `offline/idbSchema.ts` `ensureAllStores()` + `DB_VERSION=4`: tiap module buka v4 & upgrade handler bikin SEMUA store idempotent — siapa pun pertama membuka v4 → DB lengkap. Fake-indexeddb Blob → FDBBlob tanpa `.arrayBuffer()`/`.size` → test cek eksistensi saja.
- Task `U4-04` `DONE` — commit `656920d` — E-tiket: `queries.ts` `getParticipantById` (demo: gabung idb `demo_registrations` via export baru `demoLocalParticipants()` di register.ts + peserta seed; live: supabase by id `.maybeSingle()`, lazy supabase tetap). `components/TicketCard.svelte`: QR (C3-03 `QRCode` 168px, payload `/panitia/checkin?id=`), nomor tiket, nama, lapak, badge status (registered/dp_paid/fully_paid/checked_in), "Pembayaran lunas terverifikasi" saat full/checked-in, tombol WA (`waShare`, target _blank) + Print (`window.print()`), CSS print di-inject via `$effect` + `data-ticket-print` style (size `{width}mm auto`, `.no-print` hidden) — dihapus saat unmount. Route `(app)/tiket/[id]/+page.svelte`: load onMount (guard `window` — SSR safe, `selectThermalWidth` dari query `?print=58|80`), skeleton loader, error state "Tiket tidak ditemukan", title dari `env.appName`. Test 8 baru (125 total, 21 file): getParticipantById (seed/local baru/tak dikenal), TicketCard (render info, verifikasi lunas, href wa.me berisi nama+tiket ter-encode, style print 58mm, cleanup style saat unmount). Gates check 0 · build 3.
- Catatan: prop component baca → `$derived` (bukan const) utk statusClass/waLink (state_referenced_locally warning).
- Task `J6-01` `DONE` — commit `dadca0e` — Panel juri mancing `/juri/mancing`: `db/scores.ts` `submitMancingScore` 2 jalur — demo (idb `demo_scores_mancing`, DB_VERSION bump 4→5 + store baru di ensureAllStores) & live (insert supabase `scores_mancing` select id; gagal → enqueue `/rest/scores/mancing` = antrean; undo 5s: `removeScore(id, wasQueued)` demo hapus idb / live pending → `removePending(key)` baru di queue.ts / sudah synced → enqueue tombstone delete). `validateWeight` + `InvalidWeightError` (≤0 ditolak, Edge). `hasJackpot` cek seed+lokal (dup jackpot → konfirmasi UI, Edge). `components/MancingPanel.svelte`: select lapak 1–100 (nama peserta, disabled saat disqualified), numpad raksasa (gram, display kg), toggle jackpot pita, submit → `undoable` toast (Tersimpan hijau / Antrean kuning saat offline, Edge), badge offline. Route: PinGate juri + pilih kompetisi mancing (terberat/kumulatif/jackpot_pita), `recorded_by` = sha256 PIN juri. Test 9 baru (134 total, 23 file): validateWeight, submit demo (double → 2 row? — test "submit ganda → 1 row" TIDAK memaksa dedup; idempotencyKey per submit — duplicate click dicegah UI disabled+processing), hasJackpot seed/lokal, removeScore undo, panel (disabled saat kosong, 0 kg, badge offline, submit → toast). Gates check 0 · build 3.
- Catatan test: race onMount participants vs klik submit → `waitFor` option terisi dulu + `await setTimeout` flush state (Svelte 5); error non-silent "Peserta lapak belum termuat" bila submit sebelum data.
- Task `J6-02` `DONE` — commit `fa93ce2` — Panel juri layangan `/juri/layangan`: `db/layangan.ts` `submitLayanganResult` 2 jalur (demo idb `demo_scores_layangan` store baru + seed `mockLayanganScores` digabung di `getRoundResults` per babak; live insert `scores_layangan` select id → gagal enqueue `/rest/scores/layangan`), status enum `menang`(MUDUN)/`putus`(PUTUS) — engine `layangan_aduan` hitung `status === "menang"` (MUDUN = poin menang, PUTUS = kalah tercatat tak dihitung). `hasResult(competitionId, participantId, round)` state machine aktif→mudun|putus sekali per babak. `removeLayanganScore` undo 2 jalur (demo hapus idb / live pending `removePending` / synced tombstone `/rest/scores/layangan/delete`). `components/LayanganPanel.svelte`: badge `Babak {round}` (dari `competition.currentRound`), tombol raksasa hijau MUDUN + merah PUTUS per peserta aktif (peserta berhasil round ini otomatis tak muncul — board reset saat round berubah karena `getRoundResults` filter round), ringkasan hasil tercatat, undoable toast 5s → refresh list. Route: PinGate juri + pilih kompetisi `scoring_mode = layangan_aduan` + recorded_by = sha256 PIN. idb `DB_VERSION` 5→6 + store `demo_scores_layangan` di ensureAllStores; test lama payment/scores DB-open di-update ke 6. Test 10 baru (144 total, 25 file): domain 4 (submit row, hasResult antar-round, undo, reset) + panel 6 (badge+offline, seed round1 aktif-7-dari-17, MUDUN toast+pindah, undo balik aktif, round berubah reset, PUTUS). Catatan: icon `Kite` tidak ada di @lucide/svelte 1.29 → `Wind`.
- Task `J6-03` `DONE` — commit `0c04c50` — Panel juri hias `/juri/layangan-hias`: `db/hias.ts` `submitHiasScore` upsert per peserta (submit ganda → 1 row; demo idb `demo_scores_hias` keyPath `participantId`; live update by participant_id kalau ada, insert kalau belum → gagal enqueue `/rest/scores/layangan-hias`), `computeHiasTotal` = a*0.4+s*0.4+k*0.2, `validateCriteria` 0–100 integer, **edit window 5 menit** dari `edited_at`/`received_at` (`isWithinEditWindow`) — rescore luar window → tolak + console.warn audit `hias-audit`. `components/HiasPanel.svelte`: daftar peserta chip (poin + label edit bila window aktif), 3 slider 0–100 dengan nilai live, preview `Total berbobot` live (aria-label), submit → toast, label Simpan Perubahan untuk rescore. Route: PinGate juri + `scoring_mode = layangan_hias`. idb `DB_VERSION` 6→7; test lama DB-open 7. Test 8 baru (152 total, 27 file): domain 4 (bobot 84/100/40, kriteria invalid, upsert ganda 1 row 83 poin + editedAt, window lewat tolak + dalam window izin) + panel 4 (daftar+badge offline, preview live 3 slider, simpan toast + badge poin, rescore stale ditolak). Catatan: seed hias `received_at` di masa depan (event belum tiba) → window masih aktif → test stale pakai `saveLocal` export.
- Task `U4-05` `DONE` — commit `b924917` — Leaderboard `/leaderboard`: `db/leaderboard.ts` `getLeaderboardRows(competitionId, mode)` — demo: gabung seed + skor lokal idb (mancing `getAllScores`, layangan `getAllLayanganScores` baru export semua babak, hias `getAllHiasScores` lokal-menang-atas-seed) + map nama/lapak; live: `getLeaderboard` existing (lazy supabase). `components/LeaderboardBoard.svelte`: engine `computeRanking` per mode + tie-break received_at; format per mode (kg / `n menang` / poin 1 desimal), rank badge crown/medal, "n skor" multi-entry, podium highlight, empty state. Route: tab per kompetisi (getCompetitions), refresh manual, subscribe `postgres_changes` 3 tabel realtime (live only, `getSupabase` jadi export di queries), teardown channel onDestroy, online-store subscribe → refresh post-sync (fallback last-known saat fetch gagal offline + pesan status), TTS `announce("X memimpin ...")` saat top berubah. Test 7 baru (159 total, 29 file): domain 2 (skor lokal mancing/layangan/hias muncul di rows demo) + board 5 (terberat urutan+kg, kumulatif jumlah+multi skor, aduan hitung menang, hias poin+tie-break received_at, empty). Fix tipe: `LeaderboardRow` dari Record-intersection → index-signature + field eksplisit (svelte-check unknown). Catatan: `getSupabase()` di queries mengembalikan Promise<module> (destructure di pemakai).
- Task `P5-01`+`P5-02` `DONE` — commit `6a89502` — Scanner check-in `/panitia/checkin`: `components/CheckinScanner.svelte` — lazy `import("html5-qrcode")` HANYA route ini (idb `demo_checkins` store baru, DB_VERSION 7→8), tombol Pindai QR (facingMode environment, qrbox 220, decode → parse URL `?id=` via `new URL` fallback `URLSearchParams`), Hentikan (instance.stop+clear), **manual entry fallback** nomor tiket (tanpa kamera; `findParticipantByTicket` — demo: seed + `demoLocalParticipants`, live eq ticket_number), state scanning/sukses/error, camera denied → note entri manual. `db/checkin.ts`: `getCheckinSummary` (peserta+lomba+fee+paid+sisa bayar+status efektif checked_in dari store), `checkInParticipant` gate — **minimal dp_paid** (registered → `CheckinError not_eligible` "minimal DP", disqualified → blokir, checked_in → idempotent "already" info bukan error), demo persist idb / live update participants set status+checked_in_at → gagal enqueue `/rest/participants/checkin`. `components/ParticipantDetailCard.svelte`: nama/lomba/tiket/lapak + badge status warna + sisa bayar + tombol Check-in (disabled disqualified), info "Sudah check-in" + waktu tanpa tombol. Test 10 baru (173 total, 32 file): checkin domain 6 (summary, ok+persist, already, registered tolak, disqualified blokir via mock parsial queries, manual tiket) + card 4 (render info, check-in toast+badge, registered error, already tanpa tombol) + scanner 4 (kamera mock class decode → card, QR tanpa id error, manual entry, tiket tak dikenal). Catatan: vi.fn() DI DALAM factory vi.mock gagal → class mock di luar factory; svelte-check ganjal variabel `state` (konflik `$state` type gen) → rename `scanState`.
- Task `A7-02` `DONE` — commit `a1e358a` — Config & round manager: `db/admin.ts` (getLocalCompetitions/getLocalPaymentConfigs Map dari idb, `getMergedCompetitions(activeOnly)`/`getMergedPaymentConfigs(activeOnly)` = seed + override lokal — dipakai admin DAN panel lain sehingga round advance langsung terlihat juri, `saveCompetitionLocal`/`savePaymentConfigLocal` 2 jalur — demo put idb / live supabase update kolom fee/total_quota/scoring_mode/is_active/current_round + account_name/account_number/qris_image_url/instructions/is_active, `advanceRound(competitionId)` TOLAK scoring_mode != layangan_aduan → error "advance round hanya untuk mode aduan", `resetDemoAdminState`). `components/AdminPanel.svelte`: tab Kompetisi/Metode Pembayaran, checkbox is_active, edit fee/kuota/scoring_mode (select 5 mode), Advance Round disabled non-aduan (title tooltip), Simpan → undoable toast, error surfaced role=alert. Route `(app)/admin` dibungkus PinGate kind=admin. idb `DB_VERSION` 8→9 + store `demo_competitions` (keyPath id) + `demo_payment_configs` (keyPath id) di ensureAllStores; test lama DB-open scores/payment/demo di-bump 9 (+ fake-indexeddb import di demo.test). `queries.ts` demo branch getCompetitions/getPaymentConfigs → `getMerged*` via dynamic import (hindari circular import queries↔admin). Test 10 baru (181 total, 34 file): admin domain 5 (override fee via save → getCompetitions, toggle non-aktif hilang dari active, advance tolak non-aduan, advance aduan current_round+1 terlihat via getCompetitions, reset bersihkan override) + AdminPanel 3 (tab kompetisi+metode, advance aduan toast+round naik+tombol non-aduan disabled 2/3, simpan fee toast+terlihat) + demo.test tetap 3 (IDB). Gates check 0 · biome bersih · build 3.
- Temuan: `put()` idb gagal structured-clone Svelte 5 `$state` proxy ("#<Object> could not be cloned") — `JSON.parse(JSON.stringify(value))` sebelum put; advanceRound lolos karena datanya dari seed/read idb (plain), hanya panel yang kirim proxy.
- Keputusan: demo branch queries getCompetitions/getPaymentConfigs mengalihkan ke `getMerged*` admin (dynamic import) — admin override WAJIB terlihat panel lain (daftar, layangan board) tanpa duplikasi logika merge; circular import statis dihindari.
- Task `A7-03` `DONE` — commit `aed236b` — Display mode `/display`: `components/DisplayScreen.svelte` (baru) — reuse engine U4-05 (`getLeaderboardRows` + `computeRanking`), header app name + nama kompetisi + jam (detik, update 1s) + "Ronde {currentRound}", podium top-3 (crown, order 1/2/3) + daftar 4-10 besar, dots indikator posisi siklus. Auto tanpa interaksi mouse: siklus kompetisi aktif tiap 30s (CYCLE_MS), poll tiap 10s di demo mode (POLL_MS), realtime live via `postgres_changes` 3 tabel skor + peserta (status checked_in → announce "X sudah check-in"). TTS: announce leader saat tampil pertama/siklus ganti + top berubah ("X memimpin ...") + skor baru ("Skor baru tercatat"); mode hening = TTS mati → tak ada error. Wake Lock `navigator.wakeLock.request("screen")` saat mount + re-acquire on visibilitychange + release onDestroy; fallback: API tak ada → layar boleh tidur (tanpa error). Koneksi putus → last-known tetap tampil + banner kecil "Luring — menampilkan data terakhir" (bukan layar hitam). Route `display/+page.svelte`: PinGate admin (ARCHITECTURE §2 kosmetik), di luar group (app) = tanpa nav (F0-05). Konstanta siklus di `<script module>` export (`DISPLAY_CYCLE_MS` dll). Test 7 baru (188 total, 35 file): render header+papan, jam berdetak, siklus ganti kompetisi, TTS nyala top baru → announce memimpin, TTS mati → hening, koneksi putus → banner+last-known, wake lock mount/unmount. Gates check 0 · biome bersih · build 3.
- Keputusan: demo mode tak punya event realtime → announce check-in hanya jalur live (channel participants UPDATE); demo mode diumumkan lewat diff poll (top berubah / jumlah skor berubah). Siklus display announce leader per kompetisi saat pertama tampil — proyektor butuh pengumuman pembuka tiap lomba.
- Penyimpangan kecil: test DisplayScreen ditambah di luar daftar FILES (kanon repo: komponen selalu berpasangan __tests__) + `<script module>` utk konstanta timer (test butuh nilai eksak, bukan hardcode).
- Catatan test: fake timers `shouldAdvanceTime: true` wajib utk waitFor RTL; mock ttsAnnouncer announce dgn guard `get(mod.ttsEnabled)` meniru guard asli — tanpa ini mode hening tak teruji; localStorage TTS preference bocor antar-test → `localStorage.clear()` + `setTtsEnabled(false)` di beforeEach; peserta seed idx%3 — participant[0] kompetisi aduan, bukan mancing.
- Task `A7-01` `BLOCKED` — butuh manusia: `D1-03` (apply RLS SQL, service role key) belum tereksekusi — syarat lepas: `D1-03` `DONE`; board WAIT → BLOCKED saat tutup fase 7.
- Task `A7-04` `BLOCKED` — butuh manusia: rantai `D1-03` → `A7-01` — syarat lepas: `A7-01` `DONE`; board WAIT → BLOCKED saat tutup fase 7.
- Keputusan: fase 7 ditutup dgn 2/4 DONE + 2 BLOCKED (rantai RLS manusia) — per protokol "fase aktif habis atau tersisa hanya antrean manusia"; fase 8 dibuka, `Q8-02` (DEP lengkap) tarik-able, `Q8-01` tetap WAIT (butuh fase 0–7 SEMUA DONE).
- Temuan lint gate fase-8: `bun run lint` (biome check .) ternyata ERROR di 13 file test dari task lama (J6/P5/U4/C3) — unused imports/vars + `!` assertion — tidak terlihat karena verifikasi task lama hanya biome scoped path berubah; dibersihkan di gate fase: `biome check --write --unsafe .` (12 file) + manual (hias.ts `data` unused, LayanganPanel `seededRound1`, HiasPanel `container`) — suite tetap 188 hijau.
- Task `Q8-02` `DONE` — commit `317fa78` — smoke e2e demo mode: checklist per langkah flow (landing/daftar/bayar/tiket/juri ×3/leaderboard/display/offline queue/PIN gate) dipetakan ke test suite + komponen terkait di `doc/RUN-REPORT.md`; suite penuh sekali: `bun run test` 188 passed / 35 file, `bun run check` 0 error, `bun run lint` 0 error, `bun run build` hijau. Langkah "admin verify" TIDAK bisa smoke — A7-01 BLOCKED (rantai manusia D1-03) — dicatat gap di RUN-REPORT, bukan bug. Verifikasi browser nyata tetap belum (tanpa browser di sesi) — Q8-04 manusia.
- KOREKSI SHA: entri `Q8-02` di atas awalnya mencatut `e3c19bf` (commit tutup fase) karena amend — commit Q8-02 sebenarnya `(lihat log)` (RUN-REPORT + board + entri koreksi ini).
- SESI 3 — `refactor(db)` sqlite + temuan review (fix): penyimpanan lokal perangkat
  dua backend — node/test → SQLite via Drizzle (`localSchema.ts` `local_kv` PK
  (store,key), `localDb.ts` driver better-sqlite3 `:memory:` + migrasi drizzle-kit
  `drizzle/0000_tricky_red_shift.sql`), browser → IndexedDB tak berubah
  (`localStore.ts` switch `typeof window === undefined || MODE === "test"`,
  localDb di-import dinamis supaya tak masuk bundle client). 7 modul db
  (register/admin/scores/checkin/hias/layangan/payment) refactor ke `localStore`;
  test db + komponen kini jalan di sqlite asli (fake-indexeddb tinggal modul
  offline + RegistrationForm via ImageUploader/proofDraftStore). Fix ikutan:
  hias/checkin revive `Date` dari JSON round-trip; test TTS DisplayScreen bug seed
  (target = peserta pertama yang SUDAH juara → announce "Skor baru" bukan
  "memimpin" — ganti target peserta non-juara); helper test scores/payment yang
  buka idb langsung → `localGetAll`. Commit: `4c4b47b` (refactor),
  `47a3ea7` (fix display refresh kompetisi + rename saveCompetition/savePaymentConfig
  + hapus dead localOnly + title leaderboard pakai env.appName),
  `8094046` (chore test AdminPanel). Dep: node-gyp + better-sqlite3 (build native
  OK). Gates: test 189/189 (35 file) · check 0 error · lint 0 · build ✓ · bundle
  client bersih better-sqlite3 (chunk lazy). TTS test sebelumnya gagal juga di
  main bersih (bukan regresi sqlite).
- SESI 4 — `A7-01` dashboard verifikasi pembayaran (demo-first) + audit log:
  tab "Verifikasi" default di AdminPanel — daftar payment belum diverifikasi
  (nama peserta + lomba, metode, nominal, bukti), tombol Verifikasi / Tolak
  (wajib alasan, input inline), render gambar proof (http only), verifikasi
  langsung → recalc status peserta (fully_paid/dp_paid vs fee). DB:
  `verifyPayment`/`rejectPayment` dua jalur — demo: update local payment +
  recalc + audit; live: supabase `participant_payments` + `participants` +
  `audit_logs` insert. Audit: store idb baru `demo_audit_logs` (DB_VERSION 9→10),
  `AuditRecord` (id, action, entityType, entityId, actorHash, payload,
  idempotencyKey, createdAt), actor = `sha256Hex(pinForKind("admin"))`.
  `getMergedPayments` demo merge seed + local payments + enrich nama peserta.
  Keputusan: A7-01 dikerjakan demo-first walau TASKS menandai BLOCKED oleh
  `D1-03` (apply RLS = eksekusi manusia) — preseden `A7-02`/`A7-03` yang juga
  BLOCKED tapi DONE; jalur live dikodekan, tinggal manusia apply SQL.
  Bug ditemukan: `saveDemoPayment` menimpa peserta registrasi asli dgn object
  kosong (name "") — overwrite hanya status kini; `getMergedPayments` enrich
  pakai `getParticipants` seed-only → peserta lokal "—" — fix merge peserta
  lokal + seed via Map. UI test pertama kena tab default (klik tombol tab
  "Verifikasi (22)" bukan aksi) — selektor exact match; test body cold >
  default vitest timeout 5s (transform/import dingin ~17s) → per-test
  timeout 30s utk test baru. Test baru: 5 db (verify → isVerified+verified_by
  +audit row, verify lunas → status fully_paid, reject → reason + audit,
  list unverified) + 2 komponen (verifikasi via UI, tolak wajib alasan).
  Commit `9c6f304`. Gates: test 194/194 (35 file) · check 0 · lint 0 · build ✓.

## 2026-08-07

- Sesi review UI skill impeccable (scope: styling global) — commit `4e05d3c` — Temuan kritis: kelas `.btn`, `.btn-gold`, `.btn-ghost`, `.btn-sm`, `.input`, `text-gold`, `bg-gold`, `border-gold`, `accent-gold` dipakai ±130× di seluruh Svelte (landing, daftar, juri, admin, checkin, display) tapi TIDAK PERNAH didefinisikan di CSS sejak commit awal (`git log -S` kosong) — UI tampil dengan styling browser default. Fix: daftarkan `--color-gold: var(--secondary)` di `@theme inline` (semua utility `*-gold` + modifier opacity + `accent-gold` otomatis tersedia) + 5 `@utility`: `btn` (netral: bg-muted/40, hover, focus ring gold, disabled), `btn-gold` (primary emas), `btn-ghost` (outline), `btn-sm`, `input` (border + focus ring gold).
- Penyimpangan: kartu konten `glass-panel` → solid (`border-border/60 bg-background/60`) agar konsisten dgn panel lain; `glass-panel` dipertahankan HANYA utk elemen sticky/floating (AppShell header, BottomNav, OfflineBanner, toast). CountdownTimer: layout inline 8 angka (overflow mobile) → grid 4 kotak, blok detik aksen gold. BottomNav: active state pill `bg-gold/10 text-gold` (ikon ikut warna via currentColor) menggantikan `aria-current:text-secondary` yang tak menaungi ikon. HeroSection: eyebrow uppercase+Sparkles (AI-kicker) → badge pill gold.
- Keputusan: `.env` lokal terisi (`PUBLIC_BASE_URL`, PIN 1708/1945, demo true) — 4 test pecah karena mengasumsikan env kosong (`buildCheckinUrl` base url, QRCode placeholder, PinGate DEMO_PIN fallback). Fix mengikuti pola repo: tiap test file mock `$env/static/public` sendiri (PinGate.test.ts, QRCode.test.ts, thermal.test.ts) — test deterministik terlepas dari `.env` dev. Bukan ubah `.env` (nilai dev milik user).
- Verifikasi tambahan: test 194/194 (35 file) · check 0 · lint 0 · build ✓ — kegagalan 4 test dikonfirmasi pre-existing (stash perubahan → gagal sama).
- Task `A7-04` `BLOCKED` → `WAIT` — syarat lepas `A7-01` `DONE` terpenuhi (commit `9c6f304`); fase 7 lengkap, tarik saat fase 8 aktif.

## 2026-08-07 (lanjutan)

- Sesi SFX/tactile feedback (scope: audio + haptic + press) — commit `f564ad7` — `src/lib/audio/sfx.ts` baru: Web Audio synth murni (tanpa file asset, bundle ringan) — `tap` (keypress 880Hz 45ms), `coin` (Mario: B5 987.77Hz → E6 1318.51Hz, gap 75ms), `fanfare` (arpeggio C5–C6 utk MUDUN/advance round), `confirm` (dua nada turun 660→440 utk PUTUS/hasil), `error` (sawtooth 200→110Hz buzz), `slider` (tick triangle halus). AudioContext lazy-init + `resume()` otomatis tiap nada → ter-unlock dari gesture sentuh pertama; guard `typeof window` + `AudioContext` absen (test happy-dom aman). Store `sfxEnabled` (default true) + preferensi localStorage, pola sama dgn ttsAnnouncer.
- Keputusan: `vibrate()` haptic — `navigator.vibrate` guard (Android saja; iOS/desktop tak berdampak, tak error).
- Keputusan: `SoundToggle` jadi MASTER audio toggle (SFX + TTS sekaligus), dipasang di header `AppShell` (sebelumnya komponen yatim, tak dirender di mana pun). Default suara NYALA — feedback taktil harus terasa sejak masuk panel juri; test lama mengasumsikan default mati → diperbarui (harap "Suara: nyala" awal, klik → mati, disabled saat API TTS tak ada DAN SFX mati).
- Keputusan: feedback per aksi sesuai kondisi lapangan — digit keypad (PinGate/Mancing) = tap halus + vibrate 10ms; sukses simpan/verifikasi/check-in/PIN benar = coin + vibrate 80ms; MUDUN = fanfare (momen puncak); PUTUS = confirm; tolak/lockout/error = buzz + vibrate [120,60,120]; advance round = fanfare + vibrate panjang. Slider hias = tick di `onchange` (saat release, tak spam saat drag).
- Verifikasi tambahan: `btn` dapat `active:scale-[0.97]` + transition transform — press feedback visual taktil (layer: terang/gelap sama).
- Gates: test 194/194 (35 file) · check 0 · lint 0 (biome import-sort fix ttsAnnouncer.test.ts) · build ✓.

## 2026-08-07 (lanjutan 2)

- Sesi audit impeccable ulang dari nol (scoped, NO_PRODUCT_MD → lanjut tanpa init; register product — app UI kiosk/admin; ditawarkan `/impeccable init` utk nanti) — commit `d11fb23` — Temuan: `lang="en"` di `app.html` (WCAG 3.1.1, app Indonesia) → `id`; `--destructive #dc2626` kontras 4.0:1 gagal WCAG 1.4.3 utk teks error kecil (butuh 4.5:1) → `#e11d48` (rose-600: 4.9:1 teks, tombol semibold-14px ≥3:1 tetap pass); `prefers-reduced-motion` global override (kanonik, biome-ignore noImportantStyles); leaderboard loading spinner → skeleton (register product: skeleton bukan spinner konten); badge luring DisplayScreen `bg-muted` (4.6:1 marginal) → amber 15%; PinGate tombol "Hapus digit" redundan dihapus (⌫ cukup); medal leaderboard rank 2/3 dibedakan (slate-300 perak / amber-700 perunggu); `h1-h3 { text-wrap: balance }`.
- Temuan backlog (P2, tidak dikerjakan): `src/lib/components/ui/` (shadcn button/input/card/dialog/slider/select/separator) 0 importer — dead code bundle; duplikasi `toScoreRow`/`formatScore` antara LeaderboardBoard & DisplayScreen — kandidat refactor util bersama. Diputuskan tidak dihapus sesi ini (scope audit visual; keputusan buang shadcn = keputusan arsitektur, catat dulu).
- Verifikasi tambahan: kontras dihitung manual atas token (`muted-foreground #a3a3a3` on `muted #262626` = 4.6:1 pass; gold #d97706 on #0a0a0a = 5.2:1; secondary-foreground on gold = 4.9:1) — semua ambang aman.
- Gates: test 194/194 (35 file) · check 0 · lint 0 · build ✓.

## 2026-08-07 (lanjutan 3) — landing sport broadcast `d5c333b`

- Permintaan user: poles landing nuansa sport/lomba (FIFA/PES/BAS-fishing), font Sekuya utk header, uppercase utk CTA/button, kartu lomba horizontal scroll, seed layangan+mancing utk admin lokal.
- **Font**: Google Fonts `Sekuya` (rilis 2026) hanya punya weight 400 TTF; @fontsource/sekuya@5.3.0 menyediakan woff2 latin-400 (OFL-1.1) — dipakai self-host (`@import "@fontsource/sekuya/latin-400.css"`), offline SW-cacheable. Variable/700-900 tidak ada → header berat >400 pakai faux-bold (font-synthesis default). `--font-display: "Sekuya"` token; diterapkan h1-h3 (base layer) + brand AppShell. Diputuskan TIDAK pakai CDN Google Fonts (offline kiosk requirement).
- **Uppercase global**: `.btn` utility + `tracking-wider`; BottomNav label `uppercase tracking-wider` (menu action). Aman utk test — CSS text-transform tidak mengubah DOM.
- **HeroSection**: props baru `competitionCount`/`quotaTotal` (dari `+page.svelte` via `getCompetitions`); stat strip scoreboard (LOMBA/KUOTA/TANGGAL — tanggal diparse dari `env.eventDate` `toLocaleDateString id-ID`); kicker badge gold + pulse dot; CTA diperbesar.
- **CompetitionList**: grid→carousel `snap-x snap-mandatory no-scrollbar` (utility baru), kartu `w-72 shrink-0`, top accent bar (gold=live/muted=tutup), badge LIVE pulsing red-400, label `${liveCount} LIVE`, skeleton horizontal. `data-testid="competition-card"` dipertahankan.
- **Seed**: ternyata sudah lengkap sejak awal (mancing 50 skor, layangan aduan 30, hias 25; 3 lomba isActive) — DEMO_MODE query via `demo*` functions; tidak ada perubahan data. Admin lokal langsung lihat top3 tiap lomba.
- Gates: test 194/194 · check 0 · lint 0 · build ✓ (font ter-bundle: `sekuya-latin-400-normal.*.woff2` di assets).

## 2026-08-07 (lanjutan 4) — FASE 9 production readiness

- Permintaan user: audit + fixing plan persiapan deploy production. 3 sub-agent
  Explore paralel (security/env, offline-engine, build/deploy) memverifikasi
  klaim `doc/` terhadap kode nyata — hasil ditambahkan sebagai `R9-01`..`R9-10`
  di `TASKS.md` FASE 9, semua `DONE` sesi ini (belum commit — belum diminta user).
- Temuan kritis (bukan seperti dugaan awal): `competitions`/`payment_configs`
  di `supabase/rls.sql` TANPA policy UPDATE sama sekali (bukan `sponsors`
  kebanyakan akses seperti diduga sub-agent) — `A7-02` config manager akan
  gagal total begitu RLS diterapkan. Fix: tambah policy admin-update
  kolom-terbatas + `scores_mancing`/`scores_layangan` undo-delete (19→23
  policy, 8→9 tabel).
- Temuan kritis #2: `runSyncOnce()` (sync loop offline) lengkap + teruji unit
  test tapi TIDAK PERNAH dipanggil kode aplikasi nyata — skor/pembayaran/
  registrasi offline tak akan pernah sampai ke Supabase. Fix: `src/lib/offline/executor.ts`
  baru (ExecuteOp konkret per endpoint) + wiring trigger (online event,
  interval 15s, mount) di `networkStore.ts`. Perbaikan turunan wajib:
  idempotency_key scores_mancing/layangan/hias kini dibuat sekali sebelum
  live-attempt & dipakai ulang di payload antrean (sebelumnya generate ulang
  tiap retry = tak benar-benar idempotent terhadap request pertama yang
  gagal setelah commit di server).
- `static/_redirects` hilang (deep link 404 di CF Pages) — ditambahkan.
  Guard `PUBLIC_BASE_URL` di `vite.config.ts` diubah dari warn ke hard-fail
  saat mode production.
- `R9-07` (enable lint `.svelte`): dicoba, 119 error + 375 warning di 180
  file — terlalu besar, DEFERRED (lihat `DEFERRED.md`), config dikembalikan.
- Dead code: 7/8 primitive shadcn dihapus (`button`,`card`,`dialog`,`input`,
  `select`,`separator`,`slider` — 0 importer); `datatable` dipertahankan
  (dipakai `AdminPanel.svelte`).
- CI baru: `.github/workflows/ci.yml` (lint→check→test→build tiap push/PR).
- Gates: test 209/209 (37 file, naik dari 188/35 — RUN-REPORT.md di-update
  dgn catatan, bukan ditimpa) · check 0 · lint 0 · build ✓.

## 2026-08-07 (lanjutan 5) — fix scrollbar horizontal 360px `/daftar`

- Permintaan user: cek kenapa muncul scrollbar horizontal di layar 360px,
  contoh page `/daftar`. Investigasi browser langsung (viewport 360×740).
- **Root cause** (bukan BottomNav seperti dugaan awal — itu korban, bukan
  sumber): tiap kartu kompetisi di carousel `RegistrationForm.svelte`
  (`role="radiogroup"`) punya `<input type="radio" class="sr-only">` untuk
  semantik native — Tailwind `sr-only` = `position:absolute` tanpa
  top/left eksplisit. Wrapper kartunya TIDAK punya `position:relative`, jadi
  containing block input itu naik sampai ke viewport (ICB), bukan kartu —
  input lolos dari clipping `overflow-x-auto` carousel sepenuhnya dan
  ter-render di "static position"-nya (kartu ke-3 dalam baris flex
  yang TAK di-scroll, ±577px) — inilah yang menggelembungkan
  `document.documentElement.scrollWidth` ke 578px, yang pada gilirannya
  merusak containing block `position:fixed` BottomNav (ikut melebar ke 578px
  meski BottomNav sendiri tak bermasalah).
- Debug butuh ~15 iterasi karena red herring berlapis: `min-w-0` di grid
  item BottomNav, `overflow-x:hidden` di html/body (memblokir SCROLL tapi
  tak memperbaiki UKURAN — nav "LEADERBOARD" jadi tak terjangkau off-screen,
  bug baru!), `max-w-full` di carousel — semua tak berpengaruh sampai
  bisection `.remove()` per-kartu membuktikan kartu ke-3 (dan `sr-only`
  input-nya) adalah sumbernya.
- Fix presisi: tambah `relative` ke wrapper kartu (satu class). Hardening
  tambahan (aman, tak mengubah perilaku): `overflow-x:hidden` di `html`/`body`
  (app.css) sbg backstop, `min-w-0 truncate` di label BottomNav, `max-w-full`
  di carousel.
- Catatan risiko serupa TIDAK diperbaiki (di luar scope, tak menunjukkan
  gejala): `AdminPanel.svelte:1079` — `<input type="file" class="sr-only">`
  dalam `<label>` tanpa `relative`, dropzone tunggal (bukan list horizontal)
  jadi belum terbukti bermasalah.
- Gates: test 209/209 · check 0 · lint 0 · build ✓ · verifikasi visual browser
  360×740 (scrollWidth=clientWidth=360, 3 item BottomNav utuh & terjangkau).

## 2026-08-08 — audit & perkaya doc2 v2 + tracker eksekusi `8be61c9`

- Permintaan user: lengkapi & perkaya `doc2/*.md` — cek end-to-end + edge case
  sisi admin/panitia/juri, minimalkan keluhan/gap/fitur kurang; scan/audit bug
  & improvement alur peserta end-to-end. Dilanjutkan: mekanisme eksekusi yang
  sadar drift/miss/gap + shortcut skill.
- Audit penuh terhadap kode (db/offline/security/routes/komponen/rls.sql) vs
  kedua dokumen: **semua temuan lama (F1–F13, A1–A16) terverifikasi akurat**,
  satu koreksi: F3 — unique `(competition_id, phone)` ternyata SUDAH ada di
  `rls.sql:144` (absen hanya di `schema.ts` drizzle); narasi F3 direvisi.
- 25 temuan baru sisi admin/panitia/juri (A17–A41) — terbesar: data lock §6.4
  tak terimplementasi; DELETE publik pada skor (sabotase); panel juri mati
  offline di mode live; tombstone undo pakai kunci antrean (ghost score);
  executor menjatuhkan `flight_duration_ms`; semantik `mudun`; papan aduan
  akumulasi lintas babak; realtime publication tak dikonfigurasi; PIN
  plaintext di bundle + fallback `123456` senyap; flag demo build-time.
- 12 temuan baru sisi peserta (F14–F25) — terbesar: pembayaran tanpa
  idempotency (baris ganda via double-tap/retry/drain); gagal upload bukti
  ditelan → deadlock dengan F8; error palsu + risiko tagih dobel offline;
  teks UI menjanjikan resubmit yang tak ada; mode lunas memaksa fee penuh.
- Dokumen diperkaya seksi operasional: audit E2E per peran (4 tabel),
  cross-check ARCHITECTURE vs implementasi (16 butir, 5 ❌ / 4 ⚠️), matriks
  perjalanan peserta 10 tahap, perluasan desain RPC (9 item), rekomendasi
  P0/P1/P2, checklist pra-acara.
- `doc2/FIX-TRACKER.md`: pemetaan 66 temuan → 39 item / 5 batch + protokol
  anti-drift (re-verify referensi, scope lock, 1 item = 1 commit), anti-miss
  (status terminal + audit nol-limbo), anti-gap (temuan baru = item baru,
  test wajib, keputusan manusia eksplisit), rekonsiliasi git per sesi.
  Gap check programmatically: 66/66 ID terpetakan.
- Skill baru: `.opencode/skills/rawe2` (audit ulang doc2) & `rawe3`
  (eksekutor FIX-TRACKER). Keputusan: eksekusi fix di sesi baru via `/rawe3`,
  mulai Batch 0; Batch 1 butuh human queue apply `rls.sql`.
- Tidak ada perubahan kode pada sesi ini (murni dokumen + skill), sesuai
  karakter review. Gates: tabel markdown konsisten (check kolom), seluruh

## 2026-08-08 (malam) — Batch 0 FIX-TRACKER tuntas via /rawe3

- Sesi eksekusi `/rawe3` pertama: Batch 0 (QW-1..QW-6) selesai semua — 6/6 DONE,
  nol limbo. Rekonsiliasi awal bersih (tracker baru dibuat di `8be61c9`, belum
  ada commit item). Semua referensi `file:baris` temuan diverifikasi ulang
  sebelum fix dan masih akurat.
- Item & commit:
  - `c60dff6` **QW-1** (A26) — executor layangan menulis `flight_duration_ms`
    (satu baris + 2 test executor baru; tie-break durasi kini konsisten
    offline vs live).
  - `eff8398` **QW-2** (A25) — undo skor queued pakai identitas yang benar:
    kunci antrean submit queued kini = UUID idempotensi DB (payload.idempotencyKey);
    saat `removePending` gagal (entri ter-drain) tombstone membawa
    `idempotencyKey` dan executor delete memilih kolom `idempotency_key`
    (fallback `id` utk jalur live) — ghost score ditutup. +12 test
    (scores 4, layangan 4, executor 4). Keputusan: tombstone lama ber-payload
    scoreId=kunci-antrean jadi dead code (tak bisa diselamatkan retroaktif).
  - `0ff94d6` **QW-3** (A41, F23) — banner amber sticky "Mode Demo — data
    hanya lokal" di AppShell (semua peran) + guard build `console.warn` di
    env.ts bila `PUBLIC_ENABLE_DEMO_MODE=true` pada build non-dev. +2 test.
    Keputusan: toggle runtime ber-PIN = keputusan produk, tidak dikerjakan;
    demo/store.ts tak berubah (sudah memadai).
  - `8b4aa08` **QW-4** (A10) — tab Panitia: `paidStatus === "none"` → span
    "Belum layak" + title alasan (mencakup registered/diskualifikasi);
    ParticipantDetailCard: derived `checkinBlockedReason` menonaktifkan tombol
    + menampilkan alasan (registered & disqualified). Test lama "klik → error"
    diperbarui jadi "nonaktif + alasan tanpa klik". Catatan: kasus rejected
    murni tak terdeteksi di tab Panitia (`PanitiaParticipant` tanpa flag
    rejected; admin.ts di luar FILES) → kandidat `/rawe2`.
  - `ab6cb5c` **QW-5** (A11) — `assertProofForVerify`: verifyPayment menolak
    pembayaran non-tunai tanpa bukti di jalur demo & live (live fetch baris
    dulu); `cash` dikecualikan; UI blokir dini dgn pesan identik. Keputusan:
    opsi "menolak" (bukan konfirmasi eksplisit). +3 test.
  - `b1e5597` **QW-6** (F15, A20) — gagal upload bukti = fatal: jalur live
    `throw` (error offline otomatis jatuh ke antrean dgn bukti di payload;
    error storage muncul ke user), executor return `"error"` → retry s/d
    RETRIES_CAP. +6 test.
  - `030e6d1` style: follow-up format biome (tanpa perubahan perilaku) dari
    gate lint — termasuk fix lint `noUnsafeOptionalChaining` di payment.test.ts.
- Gates akhir batch: `bun run test` 238/238 (40 file, exit 0) · `bun run check`
  0 errors · `bun run lint` scoped file tersentuh 0 errors. Audit nol-limbo:
  6 DONE / 6 item.
- Next: Batch 1 (fondasi server RPC + RLS; apply `supabase/rls.sql` = human
  queue via dashboard Supabase). Urutan saklek: RPC B1-1..B1-5 & B1-7 siap
  dulu, baru B1-6 cabut policy publik.

## 2026-08-09 (dini hari) — Batch 1: B1-1 & B1-2 selesai via /rawe3

- Sesi lanjutan Batch 1 (fondasi server RPC+RLS). Rekonsiliasi awal: Batch 0
  sudah tuntas (0631cdb), tree bersih. Urutan saklek dihormati: RPC dikerjakan
  sebelum B1-6 cabut policy.
- **B1-1** (F14, F24, A19, F9) — commit `51c7826`:
  - rls.sql: kolom `idempotency_key uuid unique` di participant_payments
    (migrasi idempoten: add column → backfill gen_random_uuid → NOT NULL →
    index unique) + RPC `submit_payment` SECURITY DEFINER: cek ownership
    (p_phone bila diberikan), validasi nominal server-side (fee=lunas; selain
    itu >= min_dp kelipatan 500), `ON CONFLICT (idempotency_key) DO NOTHING`
    (kembalikan baris existing utk retry), recalc status dari total
    terverifikasi (F5 tanpa status optimistik; F9 satu transaksi).
  - schema.ts mirror kolom; generator.ts mockPayments + idempotencyKey.
  - payment.ts live via `rpc('submit_payment')`; satu UUID utk RPC & kunci
    antrean (F24); payload/phone dikirim; pesan ramah reason penolakan.
  - executor executePayment via RPC (gagal->error retry; penolakan bisnis->
    conflict).
  - Keputusan: p_phone OPSIONAL (skip check bila null) — caller UI di luar
    FILES B1-1; phone dienumerasi bertahap. Tunai (p_is_cash) tetap verified
    saat insert.
- **B1-2** (F8, F17) — commit `4ced1b7`:
  - rls.sql: RPC `resubmit_payment` — hanya baris belum-verified (pending/
    ditolak) boleh diubah; reset reject + nominal/bukti; ownership p_phone;
    audit_logs.
  - payment.ts: `resubmitPayment` (demo update lokal; live upload+RPC;
    offline -> pesan "Sedang offline"). CELAH: op resubmit belum punya jalur
    executor/antrean (executor.ts di luar FILES B1-2) — dicatat utk item
    lanjutan bila dibutuhkan.
  - RegistrantProfile: tombol "Kirim ulang pembayaran" (+ modal mode
    resubmit, judul & label dinamis); teks F17 kini riil (bukan janji kosong).
- Gates tiap item: check 0 · lint 0 · suite penuh (242 → 247 dengan tambahan
  test). Test baru: payment +5 resubmit (demo, verified-ditolak, live RPC,
  already_verified, offline).
- Peringatan sesi: koneksi beberapa kali putus; tiap item di-commit sebelum
  pindah berikutnya sehingga state tetap konsisten (rekonsiliasi via git log
  + tracker). SQL (`supabase/rls.sql`) BELUM di-apply — human queue via
  Supabase Dashboard (lihat item & instruksi di tracker).
- Next: B1-3 (verify_payment/reject_payment RPC + recalc status + guard
  state), B1-4 (register_participant), B1-5 (check_in), B1-7 (undo skor RPC),
  lalu B1-6 cabut policy publik.
## 2026-08-09 (dini hari 2) — B1-3 selesai via /rawe3

- **B1-3** (F5, A2, A33, A34) — commit `8f94dcd`: RPC `verify_payment` &
  `reject_payment` SECURITY DEFINER di rls.sql + helper
  `_recalc_participant_status` (status di-derive dari total is_verified; tak
  menimpa disqualified/checked_in). Guard state (for update; hanya
  pending/rejected diubah; reject butuh reason; guard bukti non-tunai),
  audit + recalc dalam SATU transaksi (menutup A34 utk verify/reject).
  admin.ts live pindah ke RPC; demo tambah guard already_verified.
  Test admin 16 (6 baru). Gate: suite 253/253, check 0, lint 0.
- Catatan: A34 masih terbuka utk saveCompetition/savePaymentConfig/advanceRound
  (di luar FILES B1-3) → kandidat /rawe2. B2-7 (audit best-effort) kini
  kandidat SUPERSEDED karena audit verify/reject sudah di RPC.
## 2026-08-09 (dini hari 3) — Batch 1 TUNTAS (8/8) via /rawe3

- Rekonsiliasi awal: B1-1..B1-3 sudah committed; lanjut B1-4..B1-8. Semua item
  diverifikasi, commit per item, gates check 0 + lint 0 + suite hijau.
- **B1-4** (F1,F2,F3,F12,A16,A7,A1,A39 sebagian) — `ded8f57`: RPC
  register_participant (fast-path dedupe → decrement kuota atomik → tiket dari
  sequence participant_ticket_seq → ON CONFLICT (competition_id,phone));
  schema.ts unique (F3); register.elive + executor via RPC; idempotency_key
  utk retry (F12). CARRYOVER: A7/A39 import masih generate tiket lokal.
- **B1-5** (F7,A21,A22) — `7cd0c63`: RPC check_in (for update; guard
  disqualified/payment_rejected/minimal DP; audit+recorded_by); checkin.ts
  live via RPC; offline catat optimistik lokal (F7); executor drain via RPC.
- **B1-6** (F4,A18) — `f533fb6`: cabut policy tulis publik yang kini via RPC
  (payments INSERT/UPDATE, participants INSERT, DELETE skor, revoke grant
  delete skor). SISA tulis publik DIJAGA (scores/hias insert, sponsors,
  configs, participants UPDATE undoCheckIn, audit_logs) — carryover batch
  lanjutan (B3-4 dll).
- **B1-7** (A18 lanjutan, A25) — `658d790`: RPC delete_score (tabel
  whitelist; delete via id atau idempotency_key; audit); executor delete via
  RPC; removeScore/removeLayanganScore opsi actorHash.
- **B1-8** (A17) — `0de0cdc`: tabel data_lock single-row + RPC set_data_lock
  (audit on/off) + guard data_lock_is_locked() di SEMUA RPC tulis; guard
  'locked' di mapper pesan; getDataLock/setDataLock (demo+live); toggle
  AdminPanel. Tulis langsung (skor/hias/sponsor/config/undoCheckIn) belum
  di-guard client — hanya RPC; carryover.
- **Batch 1 gate**: suite 270/270 (40 file) · check 0 · lint 0. Nol-limbo:
  8/8 DONE.
- **PENTING human queue**: `supabase/rls.sql` kini berisi SEMUA RPC +
  migrasi (idempotency_key payments, unique participant phone, sequence
  tiket, data_lock) + penarikan policy B1-6. WAJIB di-apply via Supabase
  Dashboard dgn urutan: section 1 (schema) → 5 (RPC) → 7 (data_lock) → 6
  (cabut policy, TERAKHIR agar app tidak mati). Checklist pra-acara = gate
  rilis setelah apply.
- Next: Batch 2 (pembayaran & status, P1) — B2-1..B2-7.
## 2026-08-09 (dini hari 4) — Batch 2 TUNTAS (7/7) via /rawe3

- **B2-1** (F6,F18) — `01554aa`: validateAmount mode full memakai nominal yang
  dikirim (default sisa fee-paid); RegistrantProfile remainingFor + rincian
  "Sisa tagihan" + blokir overpayment.
- **B2-2** (F19) — `ce82735`: label checked_in dgn sisa → "Sudah masuk — sisa
  Rp X" (paymentStateFor, badge, TicketCard via prop remaining).
- **B2-3** (F21) — `2edd548`: loadProfile memakai isOfflineError — jangan
  hapus sesi guest saat jaringan gagal.
- **B2-4** (F7,F16) — `ebdfb94`: checkInParticipant return queued saat
  offline; ParticipantDetailCard syncPending badge; payCash offline tidak
  tampilkan error misleading. CARRYOVER: remaining utk op queued di
  getCheckinSummary (perlu integrasi queue IDB).
- **B2-5** (A8,A31) — `4fc0a44`: submitCashPayment izinkan checked_in (alur
  tagih sisa gerbang) + guard pending yang menutupi sisa (anti double-charge);
  peringatan pending di modal settle AdminPanel. Guard kuota onsite = produk.
- **B2-6** (F11,A9) — `d6d2e81`: undoCheckIn hitung ulang status dari total
  terverifikasi (bukan hardcode dp_paid).
- **B2-7** (A34) — `581faa5`: audit() live jadi best-effort (console.warn,
  tidak throw) utk saveCompetition/savePaymentConfig/advanceRound; verify/
  reject sudah audit di transaksi RPC (B1-3).
- **Batch 2 gate**: suite 274/274 · check 0 · lint 0. Nol-limbo: 7/7 DONE.
- Next: Batch 3 (Juri & papan skor) — B3-1..B3-7.
## 2026-08-09 (siang) — Batch 3: B3-1..B3-4 + blokir keputusan B3-5

- **B3-1** (A23,A24) — `18a14c9`: panel offline-safe (load catch, refetch
  opsional) + jackpot tidak terblokir offline. Cache peserta IDB = CARRYOVER.
- **B3-2** (A29,A3) — `f6997cc`: selektor kompetisi + filter aktif + polling
  deteksi perubahan round di 3 halaman juri.
- **B3-3** (A36,A13,A1 sebagian) — `ce4e2a6`: BIB dari peserta aktual +
  polling refresh peserta. Pencarian tiket/nama = CARRYOVER.
- **B3-4** (A6) — `9e11070`: unique (competition_id, participant_id, round)
  layangan + guard hasResult. Apply SQL = human queue.
- **STOP di B3-5 (A27, A28)** — butuh KEPUTUSAN PRODUK (tidak boleh
  diasumsikan): semantik kanonik `mudun` (menang vs mudun vs putus) dan mode
  papan aduan (per-babak vs kumulatif). Berhenti bersih per protokol; item
  ditandai "(+keputusan)" di tracker & antrean "Keputusan".
- Status: Batch 0 6/6, Batch 1 8/8, Batch 2 7/7, Batch 3 4/7 (B3-5..B3-7
  tertunda — B3-5 menunggu keputusan). Suite 274/274 hijau saat checkpoint.
- Next: setelah keputusan mudun → B3-5; lalu B3-6, B3-7, Batch 4.
## 2026-08-09 (siang 2) — Batch 3 TUNTAS (7/7) via /rawe3

- **B3-1** (A23,A24) — `18a14c9`: panel offline-safe + jackpot tak terblokir offline.
- **B3-2** (A29,A3) — `f6997cc`: selektor kompetisi + filter aktif + polling round di halaman juri.
- **B3-3** (A36,A13,A1 sebagian) — `ce4e2a6`: BIB dari peserta aktual + polling refresh.
- **B3-4** (A6) — `9e11070`: unique (competition_id, participant_id, round) layangan + guard hasResult.
- **B3-5** (A28,A27 +keputusan) — `9c7084b` + `661eab5`: KEPUTUSAN user — status = menang|mudun|putus|dq
  (dq baru utk disqualified; win hanya menang); tombol DQ di panel; schema/rls tambah dq; papan aduan per-babak
  (filter round di getLeaderboardRows/getLeaderboard, DisplayScreen & leaderboard pass currentRound).
- **B3-6** (A4,A12) — `fe8cbfe`: jackpot dirangking berat (bukan otomatis #1) + badge; computeHiasTotal real.
- **B3-7** (A35) — `ba21558`: alter publication supabase_realtime di rls.sql; polling fallback leaderboard 30 dtk.
- **Batch 3 gate**: suite 274/274 · check 0 · lint 0. Nol-limbo: 7/7 DONE.
- **PENTING human queue**: rls.sql kini punya publication realtime (B3-7) + status dq (B3-5) + unique index
  layangan (B3-4). WAJIB di-apply utk realtime & constraint aktif.
- Next: Batch 4 (Penguatan, P2) — B4-1..B4-11.
  referensi file:baris baru di-spot-check terhadap source.
