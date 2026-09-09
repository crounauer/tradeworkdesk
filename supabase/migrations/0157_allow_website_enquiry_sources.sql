-- Allow website form submissions to be stored as typed enquiries.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.enquiries'::regclass
      AND conname = 'enquiries_source_check'
  ) THEN
    ALTER TABLE public.enquiries
      DROP CONSTRAINT enquiries_source_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.enquiries'::regclass
      AND conname = 'enquiries_source_check'
  ) THEN
    ALTER TABLE public.enquiries
      ADD CONSTRAINT enquiries_source_check
      CHECK (source IN (
        'phone', 'email', 'text', 'facebook', 'whatsapp', 'messenger',
        'website', 'website_contact_form', 'website_free_survey', 'referral', 'other'
      ));
  END IF;
END $$;
