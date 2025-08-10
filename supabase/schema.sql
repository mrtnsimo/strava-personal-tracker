-- Supabase schema for Strava tracker

-- Enable required extensions (for UUID/time helpers); may already exist
create extension if not exists pgcrypto;

-- Stores OAuth tokens per Strava athlete
create table if not exists public.strava_tokens (
  id uuid primary key default gen_random_uuid(),
  athlete_id bigint unique not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strava_tokens_athlete_id on public.strava_tokens(athlete_id);

-- Stores Strava activities (denormalized minimal fields)
create table if not exists public.activities (
  id bigint primary key, -- Strava activity ID
  athlete_id bigint not null,
  name text,
  sport_type text not null,
  distance_m double precision not null default 0,
  moving_time_seconds integer not null default 0,
  start_date timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_activities_athlete_id on public.activities(athlete_id);
create index if not exists idx_activities_start_date on public.activities(start_date);
create index if not exists idx_activities_sport_type on public.activities(sport_type);



