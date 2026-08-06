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
