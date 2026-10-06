-- A role for DXV OS itself (e.g. "DXV website", which files founder submissions). Never signs in.
-- Its own migration: PostgreSQL only lets a new enum value be used once this has committed.
ALTER TYPE "Role" ADD VALUE 'SYSTEM';
