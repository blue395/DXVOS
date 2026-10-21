-- Data fix (Blue, 2026-10-21): angels' phone numbers imported from spreadsheets kept the
-- leading apostrophe a spreadsheet adds to keep +44… / 07… as text. Strip it (straight,
-- curly or backtick, plus any spaces around it), the same as cleanPhone() in pipeline.ts.
-- Only rows that start with one are touched; a number that was nothing but an apostrophe
-- becomes empty. Safe to run again (nothing left to match).
UPDATE "Angel"
SET "phone" = NULLIF(btrim(regexp_replace(regexp_replace("phone", '^[[:space:]''‘’`]+', ''), '[[:space:]]+', ' ', 'g')), '')
WHERE "phone" ~ '^[[:space:]]*[''‘’`]';
