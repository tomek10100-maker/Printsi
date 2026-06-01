-- Table to persist Furgonetka OAuth2 tokens across serverless invocations
CREATE TABLE IF NOT EXISTS furgonetka_tokens (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one row ever exists (id=1)
-- Restrict access to service role only
ALTER TABLE furgonetka_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON furgonetka_tokens
  USING (false); -- blocks all anon/user access; service role bypasses RLS
