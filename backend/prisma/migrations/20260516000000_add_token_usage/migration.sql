-- Add token_usage table for rate limiting and tracking
CREATE TABLE IF NOT EXISTS token_usage (
  date          VARCHAR(10) PRIMARY KEY,
  tokens_used   BIGINT NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0
);
