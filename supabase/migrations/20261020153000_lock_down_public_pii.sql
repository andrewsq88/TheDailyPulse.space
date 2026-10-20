/*
  # Stop anonymous reads of subscriber and advertiser contact data

  The public site previously allowed the anon role to read every column of
  approved advertisements, including contact name, email, phone, and notes.
  Inserts also accepted any status, so a submission could mark itself approved.

  - Remove the anon select policy on advertisements
  - Let anon insert only rows that stay pending
  - Expose approved ads through a column-limited view
  - Keep newsletter rows insert-only for anon
*/

DROP POLICY IF EXISTS "Anyone can view approved advertisements" ON public.advertisements;
DROP POLICY IF EXISTS "Authenticated users can view all advertisements" ON public.advertisements;

CREATE POLICY "Authenticated users can view all advertisements"
  ON public.advertisements
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can submit advertisements" ON public.advertisements;
DROP POLICY IF EXISTS "Anyone can submit pending advertisements" ON public.advertisements;

CREATE POLICY "Anyone can submit pending advertisements"
  ON public.advertisements
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND type IN ('product', 'service')
    AND char_length(company_name) BETWEEN 1 AND 200
    AND char_length(contact_name) BETWEEN 1 AND 200
    AND char_length(contact_email) BETWEEN 3 AND 320
    AND contact_email LIKE '%@%'
  );

REVOKE ALL ON TABLE public.advertisements FROM anon;
GRANT INSERT ON TABLE public.advertisements TO anon;

CREATE OR REPLACE VIEW public.approved_advertisements
WITH (security_invoker = false) AS
SELECT
  id,
  type,
  company_name,
  product_name,
  services_provided,
  website_url,
  created_at
FROM public.advertisements
WHERE status = 'approved';

GRANT SELECT ON public.approved_advertisements TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscriptions;

CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'active'
    AND char_length(name) BETWEEN 1 AND 200
    AND char_length(email) BETWEEN 3 AND 320
    AND email LIKE '%@%'
  );

REVOKE ALL ON TABLE public.newsletter_subscriptions FROM anon;
GRANT INSERT ON TABLE public.newsletter_subscriptions TO anon;
