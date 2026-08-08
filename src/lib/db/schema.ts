import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const scoringMode = [
	"terberat",
	"kumulatif",
	"jackpot_pita",
	"layangan_aduan",
	"layangan_hias",
] as const;
export type ScoringMode = (typeof scoringMode)[number];

export const participantStatus = [
	"registered",
	"dp_paid",
	"fully_paid",
	"checked_in",
	"disqualified",
] as const;
export type ParticipantStatus = (typeof participantStatus)[number];

export const layanganStatus = ["mudun", "putus", "menang"] as const;
export type LayanganStatus = (typeof layanganStatus)[number];

export const competitions = pgTable("competitions", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	scoringMode: text("scoring_mode").$type<ScoringMode>().notNull(),
	fee: integer("fee").notNull().default(0),
	minDp: integer("min_dp").notNull().default(0),
	totalQuota: integer("total_quota").notNull().default(0),
	currentRound: integer("current_round").notNull().default(1),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const paymentConfigs = pgTable("payment_configs", {
	id: uuid("id").primaryKey().defaultRandom(),
	method: text("method").notNull(),
	accountName: text("account_name"),
	accountNumber: text("account_number"),
	qrisImageUrl: text("qris_image_url"),
	instructions: text("instructions"),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const sponsors = pgTable("sponsors", {
	id: uuid("id").primaryKey().defaultRandom(),
	imageUrl: text("image_url").notNull(),
	url: text("url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const participants = pgTable("participants", {
	id: uuid("id").primaryKey().defaultRandom(),
	competitionId: uuid("competition_id")
		.notNull()
		.references(() => competitions.id),
	ticketNumber: text("ticket_number").notNull().unique(),
	lapakNumber: text("lapak_number"),
	name: text("name").notNull(),
	phone: text("phone").notNull(),
	status: text("status")
		.$type<ParticipantStatus>()
		.notNull()
		.default("registered"),
	checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const participantPayments = pgTable("participant_payments", {
	id: uuid("id").primaryKey().defaultRandom(),
	participantId: uuid("participant_id")
		.notNull()
		.references(() => participants.id, { onDelete: "restrict" }),
	amount: integer("amount").notNull(),
	paymentMethod: text("payment_method").notNull(),
	proofImageUrl: text("proof_image_url"),
	isVerified: boolean("is_verified").notNull().default(false),
	verifiedBy: text("verified_by"),
	rejectReason: text("reject_reason"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const scoresMancing = pgTable(
	"scores_mancing",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		competitionId: uuid("competition_id")
			.notNull()
			.references(() => competitions.id),
		participantId: uuid("participant_id")
			.notNull()
			.references(() => participants.id),
		fishWeightGram: integer("fish_weight_gram").notNull(),
		fishType: text("fish_type"),
		isJackpot: boolean("is_jackpot").notNull().default(false),
		runningTotal: integer("running_total").notNull().default(0),
		recordedBy: text("recorded_by").notNull(),
		idempotencyKey: uuid("idempotency_key").notNull().unique(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("scores_mancing_idempotency_idx").on(table.idempotencyKey),
	],
);

export const scoresLayangan = pgTable(
	"scores_layangan",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		competitionId: uuid("competition_id")
			.notNull()
			.references(() => competitions.id),
		participantId: uuid("participant_id")
			.notNull()
			.references(() => participants.id),
		round: integer("round").notNull(),
		status: text("status").$type<LayanganStatus>().notNull(),
		flightDurationMs: integer("flight_duration_ms"),
		recordedBy: text("recorded_by").notNull(),
		idempotencyKey: uuid("idempotency_key").notNull().unique(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("scores_layangan_idempotency_idx").on(table.idempotencyKey),
	],
);

export const scoresLayanganHias = pgTable(
	"scores_layangan_hias",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		competitionId: uuid("competition_id")
			.notNull()
			.references(() => competitions.id),
		participantId: uuid("participant_id")
			.notNull()
			.references(() => participants.id),
		aesthetic: integer("aesthetic").notNull(),
		stability: integer("stability").notNull(),
		creativity: integer("creativity").notNull(),
		totalWeighted: real("total_weighted")
			.generatedAlwaysAs(
				sql`(aesthetic * 0.4 + stability * 0.4 + creativity * 0.2)`,
			)
			.notNull(),
		recordedBy: text("recorded_by").notNull(),
		idempotencyKey: uuid("idempotency_key").notNull().unique(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		editedAt: timestamp("edited_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("scores_layangan_hias_idempotency_idx").on(
			table.idempotencyKey,
		),
		uniqueIndex("scores_layangan_hias_participant_competition_idx").on(
			table.competitionId,
			table.participantId,
		),
		check(
			"hias_kriteria_0_100",
			sql`${table.aesthetic} >= 0 AND ${table.aesthetic} <= 100`,
		),
		check(
			"hias_stability_0_100",
			sql`${table.stability} >= 0 AND ${table.stability} <= 100`,
		),
		check(
			"hias_creativity_0_100",
			sql`${table.creativity} >= 0 AND ${table.creativity} <= 100`,
		),
	],
);

export const auditLogs = pgTable(
	"audit_logs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		action: text("action").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		actorHash: text("actor_hash").notNull(),
		payload: jsonb("payload"),
		idempotencyKey: uuid("idempotency_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("audit_logs_idempotency_idx").on(table.idempotencyKey),
	],
);
