CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor_hash" text NOT NULL,
	"payload" jsonb,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scoring_mode" text NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"min_dp" integer DEFAULT 0 NOT NULL,
	"total_quota" integer DEFAULT 0 NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_method" text NOT NULL,
	"proof_image_url" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"ticket_number" text NOT NULL,
	"lapak_number" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "payment_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" text NOT NULL,
	"account_name" text,
	"account_number" text,
	"qris_image_url" text,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores_layangan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"status" text NOT NULL,
	"recorded_by" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_layangan_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "scores_layangan_hias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"aesthetic" integer NOT NULL,
	"stability" integer NOT NULL,
	"creativity" integer NOT NULL,
	"total_weighted" real GENERATED ALWAYS AS ((aesthetic * 0.4 + stability * 0.4 + creativity * 0.2)) STORED NOT NULL,
	"recorded_by" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_layangan_hias_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "hias_kriteria_0_100" CHECK ("scores_layangan_hias"."aesthetic" >= 0 AND "scores_layangan_hias"."aesthetic" <= 100),
	CONSTRAINT "hias_stability_0_100" CHECK ("scores_layangan_hias"."stability" >= 0 AND "scores_layangan_hias"."stability" <= 100),
	CONSTRAINT "hias_creativity_0_100" CHECK ("scores_layangan_hias"."creativity" >= 0 AND "scores_layangan_hias"."creativity" <= 100)
);
--> statement-breakpoint
CREATE TABLE "scores_mancing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"fish_weight_gram" integer NOT NULL,
	"fish_type" text,
	"is_jackpot" boolean DEFAULT false NOT NULL,
	"running_total" integer DEFAULT 0 NOT NULL,
	"recorded_by" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_mancing_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "participant_payments" ADD CONSTRAINT "participant_payments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores_layangan" ADD CONSTRAINT "scores_layangan_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores_layangan" ADD CONSTRAINT "scores_layangan_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores_layangan_hias" ADD CONSTRAINT "scores_layangan_hias_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores_layangan_hias" ADD CONSTRAINT "scores_layangan_hias_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores_mancing" ADD CONSTRAINT "scores_mancing_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores_mancing" ADD CONSTRAINT "scores_mancing_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_logs_idempotency_idx" ON "audit_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_layangan_idempotency_idx" ON "scores_layangan" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_layangan_hias_idempotency_idx" ON "scores_layangan_hias" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_mancing_idempotency_idx" ON "scores_mancing" USING btree ("idempotency_key");