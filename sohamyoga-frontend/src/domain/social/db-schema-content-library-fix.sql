-- Fix: content_asset.created_by was typed UUID, inconsistent with every
-- other module's created_by (CTA, Form, Event, Video, Competitor all use
-- TEXT deliberately, since AdminPrincipal.id is a string from the external
-- auth backend, not guaranteed to be a valid Postgres UUID literal). Would
-- have broken real admin usage the first time a non-UUID-formatted admin id
-- was inserted. Caught via live testing before any real data existed in the
-- table.
ALTER TABLE content_asset ALTER COLUMN created_by TYPE TEXT;
