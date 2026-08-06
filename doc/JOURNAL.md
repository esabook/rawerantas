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
- Keputusan: template `sv create --template minimal` dipakai pengganti `bun create svelte` — CLI lama redirect ke `sv`; minimal = skeleton (tanpa demo). `--no-add-ons` agar setup tailwind/shadcn/drizzle manual per task F0-02..F0-07.
