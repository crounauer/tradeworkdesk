-- Migration 0104: Add missing RLS policies for website_traffic_events

DO $$
BEGIN
  IF to_regclass('public.website_traffic_events') IS NOT NULL THEN
    -- Tenant/super-admin access for signed-in users.
    EXECUTE 'DROP POLICY IF EXISTS website_traffic_events_tenant ON public.website_traffic_events';
    EXECUTE '
      CREATE POLICY website_traffic_events_tenant ON public.website_traffic_events
      FOR ALL TO authenticated
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        OR get_user_role(auth.uid()) = ''super_admin''
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())
        OR get_user_role(auth.uid()) = ''super_admin''
      )
    ';

    -- Public websites can emit tracking events, but only inserts and only valid shapes.
    EXECUTE 'DROP POLICY IF EXISTS website_traffic_events_public_insert ON public.website_traffic_events';
    EXECUTE '
      CREATE POLICY website_traffic_events_public_insert ON public.website_traffic_events
      FOR INSERT TO anon
      WITH CHECK (
        event_type IN (''page_view'', ''session_end'')
        AND length(session_id) BETWEEN 1 AND 128
        AND length(visitor_id) BETWEEN 1 AND 128
        AND session_elapsed_seconds >= 0
        AND session_page_index >= 0
      )
    ';
  END IF;
END
$$;
