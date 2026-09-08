CREATE TABLE "ai_governance_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"score" integer,
	"assessor_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_governance_framework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_key" text NOT NULL,
	"category_name" text NOT NULL,
	"description" text,
	"total_items" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_governance_framework_category_key_unique" UNIQUE("category_key")
);
--> statement-breakpoint
ALTER TABLE "ai_governance_assessment" ADD CONSTRAINT "ai_governance_assessment_framework_id_ai_governance_framework_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."ai_governance_framework"("id") ON DELETE no action ON UPDATE no action;