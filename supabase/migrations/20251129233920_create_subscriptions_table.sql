/*
  # Create Newsletter Subscriptions Table

  1. New Tables
    - `newsletter_subscriptions`
      - `id` (uuid, primary key) - Unique subscription ID
      - `name` (text) - Subscriber's name
      - `email` (text, unique) - Subscriber's email address
      - `subscribed_at` (timestamptz) - Subscription timestamp
      - `status` (text) - Subscription status (active, unsubscribed)
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `newsletter_subscriptions` table
    - Add policy for public insert (anyone can subscribe)
    - Add policy for authenticated users to read all subscriptions

  3. Indexes
    - Index on email for fast lookups
    - Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  subscribed_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view subscriptions"
  ON newsletter_subscriptions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscriptions(status);