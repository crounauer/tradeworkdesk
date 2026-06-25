-- Migration 0103: Add missing RLS policies for tables flagged by Security Advisor
-- "RLS Enabled No Policy"

DO $$
BEGIN
  -- beta_invites: platform-only data
  IF to_regclass('public.beta_invites') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS beta_invites_super_admin ON public.beta_invites';
    EXECUTE '
      CREATE POLICY beta_invites_super_admin ON public.beta_invites
      FOR ALL TO authenticated
      USING (get_user_role(auth.uid()) = ''super_admin'')
      WITH CHECK (get_user_role(auth.uid()) = ''super_admin'')
    ';
  END IF;

  -- customer_portal_users: tenant scoped (tenant_id is TEXT)
  IF to_regclass('public.customer_portal_users') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS customer_portal_users_tenant ON public.customer_portal_users';
    EXECUTE '
      CREATE POLICY customer_portal_users_tenant ON public.customer_portal_users
      FOR ALL TO authenticated
      USING (
        tenant_id = get_user_tenant_id(auth.uid())::text
        OR get_user_role(auth.uid()) = ''super_admin''
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())::text
        OR get_user_role(auth.uid()) = ''super_admin''
      )
    ';
  END IF;

  -- platform_settings: platform-only data
  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS platform_settings_super_admin ON public.platform_settings';
    EXECUTE '
      CREATE POLICY platform_settings_super_admin ON public.platform_settings
      FOR ALL TO authenticated
      USING (get_user_role(auth.uid()) = ''super_admin'')
      WITH CHECK (get_user_role(auth.uid()) = ''super_admin'')
    ';
  END IF;

  -- schema_migrations: metadata table, read for super admins only
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS schema_migrations_super_admin_select ON public.schema_migrations';
    EXECUTE '
      CREATE POLICY schema_migrations_super_admin_select ON public.schema_migrations
      FOR SELECT TO authenticated
      USING (get_user_role(auth.uid()) = ''super_admin'')
    ';
  END IF;

  -- sms_messages: tenant scoped
  IF to_regclass('public.sms_messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS sms_messages_tenant ON public.sms_messages';
    EXECUTE '
      CREATE POLICY sms_messages_tenant ON public.sms_messages
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
  END IF;

  -- sms_templates: tenant scoped
  IF to_regclass('public.sms_templates') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS sms_templates_tenant ON public.sms_templates';
    EXECUTE '
      CREATE POLICY sms_templates_tenant ON public.sms_templates
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
  END IF;

  -- support_tickets: tenant scoped
  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS support_tickets_tenant ON public.support_tickets';
    EXECUTE '
      CREATE POLICY support_tickets_tenant ON public.support_tickets
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
  END IF;

  -- support_ticket_messages: tenant scoped
  IF to_regclass('public.support_ticket_messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS support_ticket_messages_tenant ON public.support_ticket_messages';
    EXECUTE '
      CREATE POLICY support_ticket_messages_tenant ON public.support_ticket_messages
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
  END IF;

  -- support_ticket_attachments: tenant scoped
  IF to_regclass('public.support_ticket_attachments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS support_ticket_attachments_tenant ON public.support_ticket_attachments';
    EXECUTE '
      CREATE POLICY support_ticket_attachments_tenant ON public.support_ticket_attachments
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
  END IF;

  -- tenant_addon_credits: tenant scoped
  IF to_regclass('public.tenant_addon_credits') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_addon_credits_tenant ON public.tenant_addon_credits';
    EXECUTE '
      CREATE POLICY tenant_addon_credits_tenant ON public.tenant_addon_credits
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
  END IF;

  -- user_addons: tenant scoped
  IF to_regclass('public.user_addons') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_addons_tenant ON public.user_addons';
    EXECUTE '
      CREATE POLICY user_addons_tenant ON public.user_addons
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
  END IF;
END
$$;
