/*
  # Fix advertisements RLS - allow public read for approved ads

  ## Problem
  The existing SELECT policy restricts reads to authenticated users only,
  meaning anonymous visitors cannot see approved advertisements.

  ## Changes
  - Drop the existing authenticated-only SELECT policy
  - Add a new policy allowing anyone (including anonymous) to read approved ads
  - Keep existing INSERT and UPDATE policies unchanged
*/

DROP POLICY IF EXISTS "Authenticated users can view all advertisements" ON advertisements;

CREATE POLICY "Anyone can view approved advertisements"
  ON advertisements
  FOR SELECT
  USING (status = 'approved');
