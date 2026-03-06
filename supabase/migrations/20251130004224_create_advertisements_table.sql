/*
  # Create Advertisements Table

  1. New Tables
    - `advertisements`
      - `id` (uuid, primary key) - Unique identifier for each ad submission
      - `type` (text) - Type of advertisement: 'product' or 'service'
      - `company_name` (text) - Name of the company/brand
      - `product_name` (text, nullable) - Product name (only for product type)
      - `contact_name` (text) - Contact person name
      - `contact_email` (text) - Contact email address
      - `contact_phone` (text, nullable) - Contact phone number
      - `services_provided` (text, nullable) - Services description (only for service type)
      - `website_url` (text, nullable) - Company website or product URL
      - `status` (text) - Ad status: 'pending', 'approved', 'rejected'
      - `notes` (text, nullable) - Additional notes from advertiser
      - `created_at` (timestamptz) - Timestamp of submission
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `advertisements` table
    - Add policy for anyone to submit advertisements (insert)
    - Add policy for authenticated admin users to view all advertisements
*/

CREATE TABLE IF NOT EXISTS advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('product', 'service')),
  company_name text NOT NULL,
  product_name text,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  services_provided text,
  website_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit advertisements"
  ON advertisements
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all advertisements"
  ON advertisements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update advertisements"
  ON advertisements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);