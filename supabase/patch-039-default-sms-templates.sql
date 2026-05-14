-- patch-039: Default SMS Templates
-- Seeds useful starter templates for every tenant that currently has none.
-- Also creates a helper function that can be called to seed any tenant.

CREATE OR REPLACE FUNCTION seed_default_sms_templates(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Only seed if the tenant has no templates at all
  IF EXISTS (SELECT 1 FROM sms_templates WHERE tenant_id = p_tenant_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO sms_templates (tenant_id, name, content) VALUES

    -- Booking / Scheduling
    (p_tenant_id,
     'Appointment Confirmed',
     'Hi, your appointment is confirmed. Our engineer will visit on the date agreed. Any questions? Reply to this message or call us.'),

    (p_tenant_id,
     'Appointment Reminder (Day Before)',
     'Reminder: Our engineer is visiting you tomorrow. Please ensure access to the boiler/heating system. Reply to rearrange if needed.'),

    (p_tenant_id,
     'Appointment Reminder (Morning Of)',
     'Good morning! Our engineer is scheduled to visit you today. We will contact you when they are on the way. Thank you.'),

    -- On The Day
    (p_tenant_id,
     'Engineer On The Way',
     'Your engineer is on the way and should arrive within approximately 30 minutes. Please ensure access to your property. Thank you.'),

    (p_tenant_id,
     'Running Late',
     'We are sorry, our engineer is running a little late and will be with you shortly. We apologise for any inconvenience caused.'),

    (p_tenant_id,
     'Unable to Gain Access',
     'Our engineer visited today but was unable to gain access. Please contact us as soon as possible to rebook your appointment.'),

    -- Job Completion
    (p_tenant_id,
     'Job Complete – Thank You',
     'Your service/repair is now complete. Thank you for choosing us. If you have any questions about the work carried out please do not hesitate to call.'),

    (p_tenant_id,
     'Parts Required – Return Visit Needed',
     'Following our visit, we need to order parts for your repair. We will be in touch to arrange a return visit once they arrive.'),

    -- Invoicing & Payments
    (p_tenant_id,
     'Invoice Ready',
     'Your invoice is ready. Please log in to your customer portal to view and pay online, or contact us to arrange payment. Thank you.'),

    (p_tenant_id,
     'Payment Reminder',
     'Friendly reminder: your invoice is now due for payment. Please contact us to arrange this at your earliest convenience. Thank you.'),

    -- Annual Servicing
    (p_tenant_id,
     'Annual Service Due',
     'Your annual boiler service is due. Regular servicing keeps your system safe and your warranty valid. Please contact us to book.'),

    (p_tenant_id,
     'Service Overdue',
     'Your boiler service is now overdue. Please contact us to arrange an appointment. Annual servicing is important for safety and efficiency.');

END;
$$;

-- Seed all existing tenants that have no templates yet
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM seed_default_sms_templates(t.id);
  END LOOP;
END;
$$;
