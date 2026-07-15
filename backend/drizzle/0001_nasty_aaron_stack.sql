CREATE TABLE "recipe_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_versions_recipe_version_unique" UNIQUE("recipe_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"diet" varchar(32),
	"avoid" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notify_recipe_saved" boolean DEFAULT true NOT NULL,
	"notify_weekly_digest" boolean DEFAULT false NOT NULL,
	"notify_product_updates" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cookbook_items" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "current_version_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "video_platform" varchar(16);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" varchar(16) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_versions_recipe_id_idx" ON "recipe_versions" USING btree ("recipe_id");