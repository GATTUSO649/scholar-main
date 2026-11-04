CREATE TABLE "admin_audit_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"actor_user_id" varchar(36),
	"actor_email" varchar(255) NOT NULL,
	"action" varchar(80) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" varchar(36),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_actor_created_idx" ON "admin_audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_target_created_idx" ON "admin_audit_events" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE FUNCTION public.prevent_admin_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
		RAISE EXCEPTION 'admin audit events are append-only' USING ERRCODE = '42501';
	END IF;
	IF (to_jsonb(NEW) - 'actor_user_id') IS DISTINCT FROM (to_jsonb(OLD) - 'actor_user_id')
		OR NEW.actor_user_id IS NOT NULL THEN
		RAISE EXCEPTION 'admin audit events are append-only' USING ERRCODE = '42501';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER admin_audit_events_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_event_mutation();
--> statement-breakpoint
CREATE TRIGGER admin_audit_events_no_truncate
BEFORE TRUNCATE ON public.admin_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_admin_audit_event_mutation();