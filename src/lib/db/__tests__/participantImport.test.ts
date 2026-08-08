import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	importParticipantRows,
	previewParticipantCsv,
} from "$lib/db/participantImport";
import {
	demoLocalParticipants,
	resetDemoRegistrations,
} from "$lib/db/register";
import { demoCompetitions } from "$lib/demo/generator";
import { setDemoMode } from "$lib/demo/store";

describe("participant CSV import", () => {
	const competition = demoCompetitions()[0];

	beforeEach(async () => {
		await setDemoMode(true);
		await resetDemoRegistrations();
	});

	afterEach(async () => {
		await resetDemoRegistrations();
		await setDemoMode(false);
	});

	it("membaca BOM, delimiter titik koma, dan mendeteksi duplikasi WA", async () => {
		const preview = await previewParticipantCsv(
			`\uFEFFnama;no_wa;lomba;nomor_tiket\nPeserta Satu;081298765431;${competition.name};CSV-001\nPeserta Dua;081298765431;${competition.name};CSV-002`,
			demoCompetitions(),
		);

		expect(preview.delimiter).toBe(";");
		expect(preview.dataRowCount).toBe(2);
		expect(preview.rows).toHaveLength(1);
		expect(
			preview.issues.some((item) => item.message.includes("sudah terdaftar")),
		).toBe(true);
	});

	it("menolak lomba tidak dikenal dan status pembayaran tidak menjadi sumber kebenaran", async () => {
		const preview = await previewParticipantCsv(
			"nama,no_wa,lomba,status,pembayaran\nPeserta,081298765432,Lomba Fiktif,lunas,verified",
			demoCompetitions(),
		);

		expect(preview.rows).toHaveLength(0);
		expect(
			preview.issues.some((item) =>
				item.message.includes("Lomba tidak ditemukan"),
			),
		).toBe(true);
		expect(
			preview.issues.filter((item) => item.level === "warning"),
		).toHaveLength(2);
	});

	it("mengimpor peserta valid dan membuat nomor tiket bila kosong", async () => {
		const result = await importParticipantRows([
			{
				row: 2,
				competitionId: competition.id,
				name: "Peserta Import",
				phone: "+6281298765433",
				ticketNumber: null,
				lapakNumber: "17",
			},
		]);

		expect(result.imported).toBe(1);
		expect(result.skipped).toBe(0);
		const imported = (await demoLocalParticipants()).find(
			(participant) => participant.name === "Peserta Import",
		);
		expect(imported?.ticketNumber).toMatch(/^T-\d{6}$/);
		expect(imported?.status).toBe("registered");
	});
});
