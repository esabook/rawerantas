import { get } from "svelte/store";
import { demoCompetitions, demoParticipants } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { enqueue } from "$lib/offline/queue";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import type { Participant } from "./queries";

export interface RegistrationInput {
	competitionId: string;
	name: string;
	phone: string;
}

export interface RegistrationResult {
	participantId: string;
	ticketNumber: string | null;
	duplicated: boolean;
	queued: boolean;
}

export class QuotaFullError extends Error {
	constructor(competitionName: string) {
		super(`Kuota lomba ${competitionName} sudah habis.`);
		this.name = "QuotaFullError";
	}
}

const STORE = localStores.registrations;

export async function resetDemoRegistrations(): Promise<void> {
	await localClear(STORE);
}

async function demoRegistrations(): Promise<Participant[]> {
	return localGetAll<Participant>(STORE);
}

/**
 * Peserta yang terdaftar di perangkat ini (mode demo / offline lokal),
 * termasuk yang baru didaftarkan via `registerParticipant`.
 */
export async function demoLocalParticipants(): Promise<Participant[]> {
	return demoRegistrations();
}

async function saveDemoRegistration(participant: Participant): Promise<void> {
	await localPut(STORE, participant);
}

export function normalizePhone(raw: string): string {
	const digits = raw.replace(/[^\d+]/g, "");
	if (digits.startsWith("+62")) {
		return `62${digits.slice(3)}`;
	}
	if (digits.startsWith("62")) {
		return digits;
	}
	if (digits.startsWith("0")) {
		return `62${digits.slice(1)}`;
	}
	return digits;
}

export function isValidPhone(raw: string): boolean {
	const digits = raw.replace(/[^\d+]/g, "");
	return /^(?:\+62|62|08)\d{8,12}$/.test(digits);
}

function nextTicketNumber(seq: number): string {
	return `T-${String(seq).padStart(6, "0")}`;
}

export async function registerParticipant(
	input: RegistrationInput,
): Promise<RegistrationResult> {
	if (get(demoMode)) {
		return registerParticipantDemo(input);
	}
	const { supabase } = await import("./supabaseClient");
	try {
		const { data, error } = await supabase
			.from("participants")
			.insert({
				competition_id: input.competitionId,
				name: input.name,
				phone: normalizePhone(input.phone),
				ticket_number: nextTicketNumber(Date.now() % 1_000_000),
				status: "registered",
			})
			.select()
			.single();
		if (error) {
			throw error;
		}
		return {
			participantId: (data as Participant).id,
			ticketNumber: (data as Participant).ticketNumber,
			duplicated: false,
			queued: false,
		};
	} catch {
		const { data: existing } = await supabase
			.from("participants")
			.select("id, ticket_number")
			.eq("competition_id", input.competitionId)
			.eq("phone", normalizePhone(input.phone))
			.maybeSingle();
		if (existing) {
			return {
				participantId: existing.id,
				ticketNumber: existing.ticket_number,
				duplicated: true,
				queued: false,
			};
		}
		await enqueue(
			`register:${input.competitionId}:${normalizePhone(input.phone)}`,
			"/rest/participants",
			{
				competitionId: input.competitionId,
				name: input.name,
				phone: normalizePhone(input.phone),
			},
		);
		return {
			participantId: "",
			ticketNumber: null,
			duplicated: false,
			queued: true,
		};
	}
}

async function registerParticipantDemo(
	input: RegistrationInput,
): Promise<RegistrationResult> {
	const phone = normalizePhone(input.phone);
	const regs = await demoRegistrations();
	const existing = regs.find(
		(r) => r.competitionId === input.competitionId && r.phone === phone,
	);
	if (existing) {
		return {
			participantId: existing.id,
			ticketNumber: existing.ticketNumber,
			duplicated: true,
			queued: false,
		};
	}
	const competition = demoCompetitions().find(
		(c) => c.id === input.competitionId,
	);
	const quota = competition?.totalQuota ?? 0;
	const count =
		demoParticipants().filter((p) => p.competitionId === input.competitionId)
			.length +
		regs.filter((r) => r.competitionId === input.competitionId).length;
	if (count >= quota) {
		throw new QuotaFullError(competition?.name ?? "tersebut");
	}
	const seq = regs.length + 1;
	const participant: Participant = {
		id: crypto.randomUUID(),
		competitionId: input.competitionId,
		ticketNumber: nextTicketNumber(seq),
		lapakNumber: null,
		name: input.name.trim(),
		phone,
		status: "registered",
		createdAt: new Date(),
	};
	await saveDemoRegistration(participant);
	return {
		participantId: participant.id,
		ticketNumber: participant.ticketNumber,
		duplicated: false,
		queued: false,
	};
}
