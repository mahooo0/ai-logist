CREATE TYPE "public"."body_type_t" AS ENUM('tent', 'ref', 'iso', 'container');--> statement-breakpoint
CREATE TYPE "public"."client_lang" AS ENUM('ru', 'ua');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('NEW', 'QUALIFIED', 'MATCHED', 'QUOTED', 'AGREED', 'ORDER_CREATED', 'IN_PROGRESS', 'DONE', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."order_event_type" AS ENUM('created', 'driver_assigned', 'at_loading', 'in_transit', 'at_border', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('CREATED', 'DRIVER_ASSIGNED', 'AT_LOADING', 'IN_TRANSIT', 'AT_BORDER', 'DELIVERED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."truck_status" AS ENUM('available', 'busy', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."webhook_source" AS ENUM('telegram', 'voice', 'gps');--> statement-breakpoint
CREATE TABLE "bourse_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_hash" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"direction" text NOT NULL,
	"duration_s" bigint,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recording_url" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_ru" text NOT NULL,
	"name_ua" text NOT NULL,
	"country_code" text NOT NULL,
	"geom" geography(Point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_geom_srid_chk" CHECK (ST_SRID("cities"."geom") = 4326)
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"telegram_id" text,
	"lang" "client_lang" DEFAULT 'ru' NOT NULL,
	"tax_id" text,
	"tax_id_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"stage" "lead_stage" DEFAULT 'NEW' NOT NULL,
	"from_city_id" uuid,
	"to_city_id" uuid,
	"tons" numeric(10, 2),
	"body_type" "body_type_t",
	"budget" bigint,
	"volume_m3" numeric(10, 2),
	"dimensions_lxwxh" text,
	"packaging" text,
	"adr_class" text,
	"declared_value" bigint,
	"matched_truck_id" uuid,
	"quoted_price" bigint,
	"order_id" uuid,
	"price_overrides" jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "order_event_type" NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"geom" geography(Point, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_events_geom_srid_chk" CHECK ("order_events"."geom" IS NULL OR ST_SRID("order_events"."geom") = 4326)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"lead_id" uuid,
	"client_id" uuid NOT NULL,
	"truck_id" uuid,
	"from_city_id" uuid,
	"to_city_id" uuid,
	"distance_km" numeric(10, 2),
	"price" bigint NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"status" "order_status" DEFAULT 'CREATED' NOT NULL,
	"public_token" text NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "pod_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"signature_url" text,
	"photo_url" text,
	"gps" geography(Point, 4326),
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pod_artifacts_gps_srid_chk" CHECK ("pod_artifacts"."gps" IS NULL OR ST_SRID("pod_artifacts"."gps") = 4326)
);
--> statement-breakpoint
CREATE TABLE "pricing_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "truck_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"truck_id" uuid NOT NULL,
	"geom" geography(Point, 4326) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "truck_positions_geom_srid_chk" CHECK (ST_SRID("truck_positions"."geom") = 4326)
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plate_number" text NOT NULL,
	"driver_name" text NOT NULL,
	"driver_phone" text NOT NULL,
	"driver_telegram_id" text,
	"capacity_t" bigint NOT NULL,
	"body_type" "body_type_t" NOT NULL,
	"geom" geography(Point, 4326) NOT NULL,
	"status" "truck_status" DEFAULT 'available' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trucks_plate_number_unique" UNIQUE("plate_number"),
	CONSTRAINT "trucks_geom_srid_chk" CHECK (ST_SRID("trucks"."geom") = 4326)
);
--> statement-breakpoint
CREATE TABLE "webhook_updates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" "webhook_source" NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_updates_source_ext_unq" UNIQUE("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_from_city_id_cities_id_fk" FOREIGN KEY ("from_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_to_city_id_cities_id_fk" FOREIGN KEY ("to_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_matched_truck_id_trucks_id_fk" FOREIGN KEY ("matched_truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_from_city_id_cities_id_fk" FOREIGN KEY ("from_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_to_city_id_cities_id_fk" FOREIGN KEY ("to_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_artifacts" ADD CONSTRAINT "pod_artifacts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_positions" ADD CONSTRAINT "truck_positions_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bourse_cache_query_hash_unq" ON "bourse_cache" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "bourse_cache_source_idx" ON "bourse_cache" USING btree ("source");--> statement-breakpoint
CREATE INDEX "calls_lead_id_idx" ON "calls" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "calls_created_at_idx" ON "calls" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_unq" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_geom_gist" ON "cities" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "leads_client_id_idx" ON "leads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "messages_client_id_idx" ON "messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "messages_lead_id_idx" ON "messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_events_order_type_unq" ON "order_events" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_client_id_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_lead_id_idx" ON "orders" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "pod_artifacts_order_id_idx" ON "pod_artifacts" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "truck_positions_truck_recorded_unq" ON "truck_positions" USING btree ("truck_id","recorded_at");--> statement-breakpoint
CREATE INDEX "truck_positions_geom_gist" ON "truck_positions" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "truck_positions_truck_id_idx" ON "truck_positions" USING btree ("truck_id");--> statement-breakpoint
CREATE INDEX "trucks_geom_gist" ON "trucks" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "trucks_status_idx" ON "trucks" USING btree ("status");