import type { InferSelectModel } from "drizzle-orm";
import type {
	competitions,
	participantPayments,
	participants,
	paymentConfigs,
	scoresLayangan,
	scoresLayanganHias,
	scoresMancing,
	sponsors,
} from "../db/schema";

export type MockCompetition = InferSelectModel<typeof competitions>;
export type MockParticipant = InferSelectModel<typeof participants>;
export type MockPayment = InferSelectModel<typeof participantPayments>;
export type MockPaymentConfig = InferSelectModel<typeof paymentConfigs>;
export type MockSponsor = InferSelectModel<typeof sponsors>;
export type MockMancing = InferSelectModel<typeof scoresMancing>;
export type MockLayangan = InferSelectModel<typeof scoresLayangan>;
export type MockHias = InferSelectModel<typeof scoresLayanganHias>;

export const SEED = 17082026;
export const EVENT_START = "2026-08-17T07:00:00+07:00";

const mulberry32 = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const rand = mulberry32(SEED);
const pick = <T>(list: readonly T[]): T =>
	list[Math.floor(rand() * list.length)] ?? list[0];
const int = (min: number, max: number): number =>
	Math.floor(rand() * (max - min + 1)) + min;
const uuid = (n: number): string =>
	`00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const FIRST_NAMES = [
	"Budi",
	"Sari",
	"Joko",
	"Dewi",
	"Agus",
	"Ratna",
	"Hendra",
	"Sri",
	"Bambang",
	"Nita",
	"Eko",
	"Maya",
	"Rudi",
	"Lina",
	"Yanto",
	"Fitri",
	"Dedi",
	"Wulan",
	"Slamet",
	"Rina",
	"Gunawan",
	"Tuti",
	"Arif",
	"Nina",
	"Sugeng",
] as const;
const LAST_NAMES = [
	"Setiawan",
	"Kusuma",
	"Pratama",
	"Wijaya",
	"Santoso",
	"Lestari",
	"Hartono",
	"Susanti",
	"Firmansyah",
	"Anggraini",
	"Nugroho",
	"Utami",
	"Wibowo",
	"Safitri",
	"Rahmawati",
] as const;
const FISH_TYPES = ["lele", "nila", "mas", "patin"] as const;
const PIN_HASH =
	"3f5f0e5f4eef39465702a3c2471e7ec2e5a8acb9229052b2df7e4c25d1e2b0b3";

const at = (offsetMs: number): Date =>
	new Date(new Date(EVENT_START).getTime() + offsetMs);

export const mockCompetitions: MockCompetition[] = [
	{
		id: uuid(1),
		name: "Mancing Lele",
		scoringMode: "terberat",
		fee: 50000,
		minDp: 25000,
		totalQuota: 50,
		currentRound: 1,
		isActive: true,
		createdAt: at(-86_400_000),
	},
	{
		id: uuid(2),
		name: "Aduan Layangan",
		scoringMode: "layangan_aduan",
		fee: 30000,
		minDp: 15000,
		totalQuota: 40,
		currentRound: 1,
		isActive: true,
		createdAt: at(-86_400_000),
	},
	{
		id: uuid(3),
		name: "Layangan Hias",
		scoringMode: "layangan_hias",
		fee: 25000,
		minDp: 10000,
		totalQuota: 30,
		currentRound: 1,
		isActive: true,
		createdAt: at(-86_400_000),
	},
];

export const mockParticipants: MockParticipant[] = Array.from(
	{ length: 50 },
	(_, i) => {
		const idx = i + 1;
		return {
			id: uuid(100 + idx),
			competitionId: uuid(1 + (idx % 3)),
			ticketNumber: `T-${idx.toString().padStart(6, "0")}`,
			lapakNumber: idx.toString(),
			name: `${FIRST_NAMES[idx % FIRST_NAMES.length]} ${LAST_NAMES[(idx * 7) % LAST_NAMES.length]}`,
			phone: `+6281${int(100000000, 999999999)}`,
			status:
				idx <= 12
					? "fully_paid"
					: idx <= 22
						? "dp_paid"
						: idx <= 30
							? "checked_in"
							: "registered",
			checkedInAt: idx > 22 && idx <= 30 ? at(-int(1_000, 20_000)) : null,
			createdAt: at(-int(1_000, 40_000)),
		};
	},
);

export const mockPayments: MockPayment[] = mockParticipants
	.filter((_, i) => i % 3 !== 2)
	.map((p, i) => ({
		id: uuid(1000 + i),
		participantId: p.id,
		amount:
			p.status === "fully_paid" || p.status === "checked_in" ? 50000 : 25000,
		paymentMethod: pick(["bank_transfer", "ewallet", "qris"] as const),
		proofImageUrl: `https://example.com/proof/${i}.jpg`,
		isVerified: p.status === "fully_paid" || p.status === "checked_in",
		verifiedBy:
			p.status === "fully_paid" || p.status === "checked_in" ? PIN_HASH : null,
		rejectReason: null,
		idempotencyKey: uuid(3000 + i),
		createdAt: at(-int(1_000, 40_000)),
	}));

export const mockPaymentConfigs: MockPaymentConfig[] = [
	{
		id: uuid(2000),
		method: "bank_transfer",
		accountName: "Panitia Lomba",
		accountNumber: "1234567890",
		qrisImageUrl: null,
		instructions: "Transfer ke rekening panitia, lalu upload bukti.",
		isActive: true,
		createdAt: at(-30_000),
	},
	{
		id: uuid(2001),
		method: "ewallet",
		accountName: "Panitia Lomba (OVO)",
		accountNumber: "081234567890",
		qrisImageUrl: null,
		instructions: "Kirim via e-wallet, lalu upload bukti.",
		isActive: true,
		createdAt: at(-29_000),
	},
	{
		id: uuid(2002),
		method: "qris",
		accountName: null,
		accountNumber: null,
		qrisImageUrl: null,
		instructions: "Scan QRIS panitia, lalu upload bukti.",
		isActive: true,
		createdAt: at(-28_000),
	},
	{
		id: uuid(2003),
		method: "cash",
		accountName: null,
		accountNumber: null,
		qrisImageUrl: null,
		instructions: "Bayar tunai ke panitia di lokasi.",
		isActive: false,
		createdAt: at(-27_000),
	},
];

export const mockSponsors: MockSponsor[] = [
	{
		id: uuid(3000),
		imageUrl: "https://placehold.co/1200x360/0b1020/22d3ee?text=SPONSOR+ARENA",
		url: "https://example.com/arena",
		createdAt: at(-20_000),
	},
	{
		id: uuid(3001),
		imageUrl: "https://placehold.co/1200x360/111827/a5b4fc?text=PARTNER+WARGA",
		url: "https://example.com/partner",
		createdAt: at(-19_000),
	},
	{
		id: uuid(3002),
		imageUrl: "https://placehold.co/1200x360/450a0a/fda4af?text=DUKUNG+LOMBA",
		url: "https://example.com/support",
		createdAt: at(-18_000),
	},
];

export const mockMancingScores: MockMancing[] = mockParticipants.flatMap(
	(p, i) => {
		const attempts = int(1, 4);
		return Array.from({ length: attempts }, (_, j) => ({
			id: uuid(20_000 + i * 4 + j),
			competitionId: p.competitionId,
			participantId: p.id,
			fishWeightGram: int(1_000, 20_000),
			fishType: pick(FISH_TYPES),
			isJackpot: rand() < 0.04,
			runningTotal: 0,
			recordedBy: PIN_HASH,
			idempotencyKey: uuid(30_000 + i * 4 + j),
			receivedAt: at(int(600_000, 7_200_000)),
			createdAt: at(600_000),
		}));
	},
);

const grouped = new Map<string, MockMancing[]>();
for (const row of mockMancingScores) {
	const bucket = grouped.get(row.participantId);
	if (bucket) {
		bucket.push(row);
	} else {
		grouped.set(row.participantId, [row]);
	}
}
for (const rows of grouped.values()) {
	let total = 0;
	for (const row of rows.sort(
		(a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
	)) {
		total += row.fishWeightGram;
		row.runningTotal = total;
	}
}

export const mockLayanganScores: MockLayangan[] = mockParticipants
	.slice(0, 30)
	.map((p, i) => ({
		id: uuid(40_000 + i),
		competitionId: p.competitionId,
		participantId: p.id,
		round: 1,
		status: pick(["menang", "putus", "dq"] as const),
		flightDurationMs: int(30_000, 600_000),
		recordedBy: PIN_HASH,
		idempotencyKey: uuid(50_000 + i),
		receivedAt: at(int(600_000, 7_200_000)),
		createdAt: at(600_000),
	}));

export const mockHiasScores: MockHias[] = mockParticipants
	.slice(0, 25)
	.map((p, i) => {
		const aesthetic = int(60, 100);
		const stability = int(50, 100);
		const creativity = int(40, 100);
		return {
			id: uuid(60_000 + i),
			competitionId: p.competitionId,
			participantId: p.id,
			aesthetic,
			stability,
			creativity,
			totalWeighted: aesthetic * 0.4 + stability * 0.4 + creativity * 0.2,
			recordedBy: PIN_HASH,
			idempotencyKey: uuid(70_000 + i),
			receivedAt: at(int(600_000, 7_200_000)),
			editedAt: rand() < 0.2 ? at(-int(1_000, 300_000)) : null,
			createdAt: at(600_000),
		};
	});

export const demoCompetitions = () => mockCompetitions;
export const demoParticipants = () => mockParticipants;
export const demoMancingScores = () => mockMancingScores;
export const demoLayanganScores = () => mockLayanganScores;
export const demoHiasScores = () => mockHiasScores;
export const demoPayments = () => mockPayments;
export const demoPaymentConfigs = () => mockPaymentConfigs;
export const demoSponsors = () => mockSponsors;
