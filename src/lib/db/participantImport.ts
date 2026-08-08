import { get } from "svelte/store";
import { demoParticipants } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { localPut, localStores } from "./localStore";
import type { Competition, Participant } from "./queries";
import { getParticipants } from "./queries";
import {
	demoLocalParticipants,
	isValidPhone,
	normalizePhone,
} from "./register";

export type ParticipantImportIssueLevel = "error" | "warning";

export interface ParticipantImportIssue {
	row: number;
	level: ParticipantImportIssueLevel;
	message: string;
}

export interface ParticipantImportRow {
	row: number;
	competitionId: string;
	name: string;
	phone: string;
	ticketNumber: string | null;
	lapakNumber: string | null;
}

export interface ParticipantCsvPreview {
	delimiter: "," | ";" | "\t";
	headers: string[];
	rows: ParticipantImportRow[];
	issues: ParticipantImportIssue[];
	dataRowCount: number;
}

export interface ParticipantImportResult {
	imported: number;
	skipped: number;
	issues: ParticipantImportIssue[];
}

const aliases: Record<string, string> = {
	nama: "name",
	nama_peserta: "name",
	participant_name: "name",
	name: "name",
	no_wa: "phone",
	nomor_wa: "phone",
	nomor_whatsapp: "phone",
	whatsapp: "phone",
	phone: "phone",
	lomba: "competition",
	nama_lomba: "competition",
	competition: "competition",
	competition_name: "competition",
	competition_id: "competitionId",
	id_lomba: "competitionId",
	nomor_tiket: "ticket",
	no_tiket: "ticket",
	ticket: "ticket",
	ticket_number: "ticket",
	nomor_lapak: "lapak",
	lapak: "lapak",
	lapak_number: "lapak",
};

const ignoredHeaders = new Set([
	"status",
	"payment",
	"pembayaran",
	"payment_status",
	"status_pembayaran",
	"paid",
	"lunas",
	"is_verified",
	"verified",
	"reject_reason",
]);

function normalizeHeader(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function detectDelimiter(line: string): "," | ";" | "\t" {
	const candidates = [",", ";", "\t"] as const;
	let best: "," | ";" | "\t" = ",";
	let bestCount = -1;
	for (const candidate of candidates) {
		const count = [...line].filter((char) => char === candidate).length;
		if (count > bestCount) {
			best = candidate;
			bestCount = count;
		}
	}
	return best;
}

function parseCsv(text: string): {
	rows: string[][];
	delimiter: "," | ";" | "\t";
	parseError: string | null;
} {
	const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	const firstLine = source.split("\n").find((line) => line.trim()) ?? "";
	const delimiter = detectDelimiter(firstLine);
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index];
		const next = source[index + 1];
		if (quoted) {
			if (char === '"' && next === '"') {
				field += '"';
				index += 1;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
			continue;
		}
		if (char === '"' && field.length === 0) {
			quoted = true;
		} else if (char === delimiter) {
			row.push(field.trim());
			field = "";
		} else if (char === "\n") {
			row.push(field.trim());
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}
	if (quoted) {
		return { rows, delimiter, parseError: "Tanda kutip CSV belum ditutup." };
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field.trim());
		rows.push(row);
	}
	return { rows, delimiter, parseError: null };
}

function resolveCompetition(
	value: string,
	competitions: Competition[],
): Competition | null {
	const normalized = value.trim().toLowerCase();
	return (
		competitions.find((competition) => competition.id === value.trim()) ??
		competitions.find(
			(competition) => competition.name.trim().toLowerCase() === normalized,
		) ??
		null
	);
}

async function getExistingParticipants(): Promise<Participant[]> {
	if (get(demoMode)) {
		return [...demoParticipants(), ...(await demoLocalParticipants())];
	}
	return getParticipants();
}

function issue(
	issues: ParticipantImportIssue[],
	row: number,
	level: ParticipantImportIssueLevel,
	message: string,
): void {
	issues.push({ row, level, message });
}

export async function previewParticipantCsv(
	text: string,
	competitions: Competition[],
): Promise<ParticipantCsvPreview> {
	const parsed = parseCsv(text);
	const issues: ParticipantImportIssue[] = [];
	if (parsed.parseError) {
		issue(issues, 1, "error", parsed.parseError);
	}
	const [headerRow = [], ...dataRows] = parsed.rows;
	const headers = headerRow.map(normalizeHeader);
	const existing = await getExistingParticipants();
	const existingTickets = new Set(
		existing.map((participant) =>
			participant.ticketNumber.trim().toLowerCase(),
		),
	);
	const existingPhones = new Set(
		existing.map(
			(participant) =>
				`${participant.competitionId}:${normalizePhone(participant.phone)}`,
		),
	);
	const importedTickets = new Set<string>();
	const importedPhones = new Set<string>();
	const rows: ParticipantImportRow[] = [];

	if (headers.length === 0 || headers.every((header) => !header)) {
		issue(issues, 1, "error", "Header CSV belum diisi.");
		return {
			delimiter: parsed.delimiter,
			headers,
			rows,
			issues,
			dataRowCount: 0,
		};
	}
	const canonicalHeaders = headers.map((header) => aliases[header] ?? header);
	const headerIndexes = new Map<string, number>();
	for (const [index, header] of canonicalHeaders.entries()) {
		if (!header) continue;
		if (headerIndexes.has(header)) {
			issue(issues, 1, "error", `Kolom ${header} muncul lebih dari sekali.`);
		} else {
			headerIndexes.set(header, index);
		}
		if (!aliases[headers[index]] && !ignoredHeaders.has(headers[index])) {
			issue(
				issues,
				1,
				"warning",
				`Kolom ${headers[index]} tidak dikenali dan diabaikan.`,
			);
		}
		if (ignoredHeaders.has(headers[index])) {
			issue(
				issues,
				1,
				"warning",
				`Kolom ${headers[index]} diabaikan; status pembayaran harus berasal dari transaksi terverifikasi.`,
			);
		}
	}
	for (const required of ["name", "phone"]) {
		if (!headerIndexes.has(required)) {
			issue(issues, 1, "error", `Kolom wajib ${required} belum ada.`);
		}
	}
	if (
		!headerIndexes.has("competition") &&
		!headerIndexes.has("competitionId")
	) {
		issue(
			issues,
			1,
			"error",
			"Kolom wajib lomba atau competition_id belum ada.",
		);
	}
	if (issues.some((item) => item.level === "error" && item.row === 1)) {
		return {
			delimiter: parsed.delimiter,
			headers,
			rows,
			issues,
			dataRowCount: dataRows.filter((row) => row.some((cell) => cell.trim()))
				.length,
		};
	}
	if (!dataRows.some((row) => row.some((cell) => cell.trim()))) {
		issue(issues, 1, "error", "CSV tidak memiliki baris data peserta.");
	}

	for (const [index, values] of dataRows.entries()) {
		const rowNumber = index + 2;
		if (!values.some((value) => value.trim())) continue;
		if (values.length > headers.length) {
			issue(issues, rowNumber, "warning", "Kolom ekstra diabaikan.");
		}
		const valueAt = (name: string): string => {
			const columnIndex = headerIndexes.get(name);
			return columnIndex === undefined
				? ""
				: (values[columnIndex] ?? "").trim();
		};
		const name = valueAt("name");
		const rawPhone = valueAt("phone");
		const phone = normalizePhone(rawPhone);
		const competitionValue = valueAt("competition") || valueAt("competitionId");
		const competition = resolveCompetition(competitionValue, competitions);
		const ticketNumber = valueAt("ticket") || null;
		const lapakNumber = valueAt("lapak") || null;
		let valid = true;

		if (!name) {
			issue(issues, rowNumber, "error", "Nama peserta wajib diisi.");
			valid = false;
		}
		if (!rawPhone || !isValidPhone(rawPhone)) {
			issue(issues, rowNumber, "error", "Nomor WA tidak valid.");
			valid = false;
		}
		if (!competition) {
			issue(
				issues,
				rowNumber,
				"error",
				`Lomba tidak ditemukan: ${competitionValue || "(kosong)"}.`,
			);
			valid = false;
		}
		if (ticketNumber) {
			const ticketKey = ticketNumber.toLowerCase();
			if (importedTickets.has(ticketKey) || existingTickets.has(ticketKey)) {
				issue(
					issues,
					rowNumber,
					"error",
					`Nomor tiket sudah digunakan: ${ticketNumber}.`,
				);
				valid = false;
			}
			importedTickets.add(ticketKey);
		}
		if (competition) {
			const phoneKey = `${competition.id}:${phone}`;
			if (importedPhones.has(phoneKey) || existingPhones.has(phoneKey)) {
				issue(
					issues,
					rowNumber,
					"error",
					"Nomor WA sudah terdaftar di lomba ini.",
				);
				valid = false;
			}
			importedPhones.add(phoneKey);
		}
		if (valid && competition) {
			rows.push({
				row: rowNumber,
				competitionId: competition.id,
				name,
				phone,
				ticketNumber,
				lapakNumber,
			});
		}
	}

	const counts = new Map<string, number>();
	for (const participant of existing) {
		counts.set(
			participant.competitionId,
			(counts.get(participant.competitionId) ?? 0) + 1,
		);
	}
	for (const row of rows) {
		counts.set(row.competitionId, (counts.get(row.competitionId) ?? 0) + 1);
		const competition = competitions.find(
			(item) => item.id === row.competitionId,
		);
		const count = counts.get(row.competitionId) ?? 0;
		if (
			competition &&
			competition.totalQuota > 0 &&
			count > competition.totalQuota
		) {
			issue(
				issues,
				row.row,
				"error",
				`Kuota ${competition.name} akan terlampaui.`,
			);
		}
	}

	return {
		delimiter: parsed.delimiter,
		headers,
		rows,
		issues,
		dataRowCount: dataRows.filter((row) => row.some((cell) => cell.trim()))
			.length,
	};
}

function generatedTicket(usedTickets: Set<string>, index: number): string {
	let sequence = Date.now() % 1_000_000;
	let ticket = `T-${String(sequence).padStart(6, "0")}`;
	while (usedTickets.has(ticket.toLowerCase())) {
		sequence += index + 1;
		ticket = `T-${String(sequence % 1_000_000).padStart(6, "0")}`;
	}
	return ticket;
}

export async function importParticipantRows(
	rows: ParticipantImportRow[],
): Promise<ParticipantImportResult> {
	const issues: ParticipantImportIssue[] = [];
	let imported = 0;
	let skipped = 0;
	const existing = await getExistingParticipants();
	const usedTickets = new Set(
		existing.map((participant) => participant.ticketNumber.toLowerCase()),
	);
	const usedPhones = new Set(
		existing.map(
			(participant) =>
				`${participant.competitionId}:${normalizePhone(participant.phone)}`,
		),
	);

	if (get(demoMode)) {
		for (const row of rows) {
			const phoneKey = `${row.competitionId}:${row.phone}`;
			const ticket = row.ticketNumber ?? generatedTicket(usedTickets, row.row);
			if (usedPhones.has(phoneKey) || usedTickets.has(ticket.toLowerCase())) {
				skipped += 1;
				issue(
					issues,
					row.row,
					"error",
					"Data menjadi duplikat sebelum disimpan.",
				);
				continue;
			}
			const participant: Participant = {
				id: crypto.randomUUID(),
				competitionId: row.competitionId,
				ticketNumber: ticket,
				lapakNumber: row.lapakNumber,
				name: row.name,
				phone: row.phone,
				status: "registered",
				checkedInAt: null,
				createdAt: new Date(),
			};
			await localPut(localStores.registrations, participant);
			usedPhones.add(phoneKey);
			usedTickets.add(ticket.toLowerCase());
			imported += 1;
		}
		return { imported, skipped, issues };
	}

	const { getSupabase } = await import("./queries");
	const { supabase } = await getSupabase();
	for (const row of rows) {
		const ticket = row.ticketNumber ?? generatedTicket(usedTickets, row.row);
		const phoneKey = `${row.competitionId}:${row.phone}`;
		if (usedPhones.has(phoneKey) || usedTickets.has(ticket.toLowerCase())) {
			skipped += 1;
			issue(
				issues,
				row.row,
				"error",
				"Data menjadi duplikat sebelum disimpan.",
			);
			continue;
		}
		const { error } = await supabase.from("participants").insert({
			competition_id: row.competitionId,
			name: row.name,
			phone: row.phone,
			ticket_number: ticket,
			lapak_number: row.lapakNumber,
			status: "registered",
		});
		if (error) {
			skipped += 1;
			issue(
				issues,
				row.row,
				"error",
				`Gagal menyimpan peserta: ${error.message}`,
			);
			continue;
		}
		usedPhones.add(phoneKey);
		usedTickets.add(ticket.toLowerCase());
		imported += 1;
	}
	return { imported, skipped, issues };
}
