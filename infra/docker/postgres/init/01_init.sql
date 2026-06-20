-- Project Zenith: PostgreSQL Initialization Script
-- This runs once when the container is first created.
-- Migrations (via Prisma) will handle schema evolution.

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create a read-only user for the replica and analytics
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'zenith_readonly') THEN
    CREATE ROLE zenith_readonly WITH LOGIN PASSWORD 'readonly_changeme' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE zenith_db TO zenith_readonly;
GRANT USAGE ON SCHEMA public TO zenith_readonly;
-- Tables will be granted after migration via: GRANT SELECT ON ALL TABLES IN SCHEMA public TO zenith_readonly;

-- Create analytics database for MongoDB mirroring (via Debezium/CDC in future)
-- For now just log the initialization
DO $$
BEGIN
  RAISE NOTICE 'Project Zenith PostgreSQL initialized successfully.';
  RAISE NOTICE 'Extensions: uuid-ossp, pg_stat_statements, btree_gin, pg_trgm';
END
$$;
