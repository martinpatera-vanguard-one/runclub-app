create extension if not exists postgis;

-- store last known location so we can find users near a new event
alter table users
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create or replace function users_near_event(
  event_lat float,
  event_lng float,
  radius_km float
)
returns table(id uuid, push_token text)
language sql
stable
as $$
  select u.id, u.push_token
  from users u
  where u.push_token is not null
    and u.lat is not null
    and u.lng is not null
    and ST_DWithin(
      ST_MakePoint(u.lng, u.lat)::geography,
      ST_MakePoint(event_lng, event_lat)::geography,
      radius_km * 1000
    );
$$;
