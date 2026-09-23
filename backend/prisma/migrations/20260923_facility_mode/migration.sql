-- Facility mode: managing the compound after the move.
-- Purely additive — creates the rooms, reservations and maintenance-report
-- tables used by the "צלם וטפל", "חדרים משותפים" and "תובנות מתחם" flows.
-- Nothing here touches the logistics tables, their constraints or the
-- user_access_profiles view.

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('booked', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_urgency AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_category AS ENUM (
    'office_equipment', 'air_conditioning', 'lighting', 'electricity',
    'plumbing', 'network', 'furniture', 'cleaning', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  building    text NOT NULL,
  floor       text NOT NULL,
  capacity    integer NOT NULL,
  features    text[] NOT NULL DEFAULT '{}',
  image_url   text,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooms_building_floor_idx ON rooms(building, floor);

CREATE TABLE IF NOT EXISTS room_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES rooms(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  title           text,
  attendees       integer,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  status          reservation_status NOT NULL DEFAULT 'booked',
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_reservations_time_order CHECK (end_at > start_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS room_reservations_idempotency_key_key
  ON room_reservations(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS room_reservations_room_start_idx
  ON room_reservations(room_id, start_at);
CREATE INDEX IF NOT EXISTS room_reservations_user_start_idx
  ON room_reservations(user_id, start_at);

-- Double booking is rejected in the database as well as in the service, so a
-- race between two clients cannot produce two live reservations that overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  ALTER TABLE room_reservations
    ADD CONSTRAINT room_reservations_no_overlap
    EXCLUDE USING gist (
      room_id WITH =,
      tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status = 'booked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS facility_report_number_seq START WITH 45000;

CREATE TABLE IF NOT EXISTS facility_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number           integer NOT NULL DEFAULT nextval('facility_report_number_seq'),
  object_label            text NOT NULL,
  issue_description       text NOT NULL,
  category                report_category NOT NULL,
  urgency                 report_urgency NOT NULL,
  status                  report_status NOT NULL DEFAULT 'open',
  location_description    text,
  room_id                 uuid REFERENCES rooms(id),
  photo_data_url          text,
  assigned_team           text NOT NULL,
  expected_response_hours integer NOT NULL,
  ai_confidence           double precision,
  ai_analysis             jsonb,
  reported_by_user_id     uuid NOT NULL REFERENCES users(id),
  org_scope_id            uuid REFERENCES org_scopes(id),
  idempotency_key         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  acknowledged_at         timestamptz,
  resolved_at             timestamptz
);

ALTER SEQUENCE facility_report_number_seq OWNED BY facility_reports.report_number;

CREATE UNIQUE INDEX IF NOT EXISTS facility_reports_report_number_key
  ON facility_reports(report_number);
CREATE UNIQUE INDEX IF NOT EXISTS facility_reports_idempotency_key_key
  ON facility_reports(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS facility_reports_status_created_idx
  ON facility_reports(status, created_at);
CREATE INDEX IF NOT EXISTS facility_reports_reporter_created_idx
  ON facility_reports(reported_by_user_id, created_at);
