# RUN-REPORT — Laporan Run

Ditimpa tiap run oleh skill `rawe1`. Reviewer (manusia/Opus) membaca file ini
lebih dulu, lalu `JOURNAL.md`, lalu diff-nya. Bagian "Menyimpang" dan "Belum
diverifikasi" paling penting — mengosongkannya padahal ada isi = kegagalan run.

```markdown
# Run Report — <tanggal>
Fase: <n> · Commit: <sha-awal>..<sha-akhir>

## Selesai
| Task | Commit | Verify | Bukti |
| <ID> | <sha> | exit 0 | <artefak> |

## BLOCKED
| Task | Sebab | Butuh |
| <ID> | <alasan> | manusia |

## Menyimpang dari rencana
<apa pun yang dikerjakan berbeda dari baris task, plus alasannya>

## Belum diverifikasi
<apa pun yang lolos gerbang tapi masih diragukan>
```

## Checklist smoke e2e (Q8-02)

- [ ] Landing render (live/demo)
- [ ] Daftar → kuota habis tolak
- [ ] Daftar → DP bawah min_dp tolak
- [ ] Bayar → upload terkompresi
- [ ] Tiket → QR benar, print
- [ ] Juri mancing → timbangan, jackpot, undo
- [ ] Juri layangan → mudun/putus, undo, round
- [ ] Juri hias → 3 slider, edit window
- [ ] Leaderboard → urutan per mode
- [ ] Admin verify → audit row
- [ ] Display → fullscreen + TTS
