-- ═══════════════════════════════════════════════════════════════
--  001: PostgreSQL Extensions
-- ═══════════════════════════════════════════════════════════════
-- uuid-ossp:   Generates RFC 4122 v4 UUIDs for primary keys.
--              UUIDs are preferred over SERIAL/BIGSERIAL because:
--                • No sequential guessing (security)
--                • Safe for distributed systems (no sequence conflicts)
--                • Can be generated client-side if needed
--
-- pgcrypto:    Provides gen_random_uuid() (faster than uuid-ossp)
--              and cryptographic functions for server-side hashing.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
