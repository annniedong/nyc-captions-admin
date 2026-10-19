-- Week 6: admin panel. Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Design: authorization lives in the database. The admin app uses the signed-in
-- user's own session (no service-role key). Only a profile with
-- is_superadmin = true can read everything or change media.

-- ---------------------------------------------------------------------------
-- 1. The flag. Everyone starts as false.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Close the privilege-escalation hole.
--    The existing "update your own profile" policy has no column limit, so
--    without this ANY signed-in user could set is_superadmin = true on their
--    own row. Column privileges below limit what a user may change to the
--    fields the profile form actually edits.
-- ---------------------------------------------------------------------------

revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url, updated_at)
  on public.profiles to authenticated;

-- Superadmins may only edit a caption's text. Scores belong to the votes trigger.
revoke update on public.captions from anon, authenticated;
grant update (content) on public.captions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Who is an admin? SECURITY DEFINER so it can read profiles without
--    recursing through that table's own RLS policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row level security: superadmin-only extras (added on top of the existing
--    rules, which keep working for everyone else).
-- ---------------------------------------------------------------------------

-- READ every profile and every vote.
drop policy if exists "Superadmins can read all profiles" on public.profiles;
create policy "Superadmins can read all profiles"
  on public.profiles for select to authenticated
  using (public.is_superadmin());

drop policy if exists "Superadmins can read all votes" on public.votes;
create policy "Superadmins can read all votes"
  on public.votes for select to authenticated
  using (public.is_superadmin());

-- Media: delete photos, and add / edit / delete captions.
drop policy if exists "Superadmins can delete images" on public.images;
create policy "Superadmins can delete images"
  on public.images for delete to authenticated
  using (public.is_superadmin());

drop policy if exists "Superadmins can add captions" on public.captions;
create policy "Superadmins can add captions"
  on public.captions for insert to authenticated
  with check (
    public.is_superadmin()
    and created_by = (select auth.uid())
    and score = 0
    and vote_count = 0
  );

drop policy if exists "Superadmins can edit captions" on public.captions;
create policy "Superadmins can edit captions"
  on public.captions for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Superadmins can delete captions" on public.captions;
create policy "Superadmins can delete captions"
  on public.captions for delete to authenticated
  using (public.is_superadmin());

-- Storage: remove the image file when a photo is deleted. Supabase Storage must be
-- able to SEE an object before it will delete it, so admins get a read policy too.
-- (Public URLs are unaffected; the bucket is public.)
drop policy if exists "Superadmins can read photo objects" on storage.objects;
create policy "Superadmins can read photo objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_superadmin());

drop policy if exists "Superadmins can delete photos" on storage.objects;
create policy "Superadmins can delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 5. Stats and the user list. SECURITY DEFINER (they read auth.users and
--    aggregate across everyone), so each one refuses non-admins up front.
-- ---------------------------------------------------------------------------

create or replace function public.admin_users()
returns table (
  uid uuid, email text, first_name text, last_name text, avatar_url text,
  superadmin boolean, joined_at timestamptz, last_seen_at timestamptz,
  photos bigint, votes_cast bigint, votes_received bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.first_name,
    p.last_name,
    p.avatar_url,
    coalesce(p.is_superadmin, false),
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.images i where i.user_id = u.id),
    (select count(*) from public.votes v where v.user_id = u.id),
    (select coalesce(sum(c.vote_count), 0)::bigint
       from public.captions c join public.images i on i.id = c.image_id
      where i.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users',       (select count(*) from auth.users),
    'photos',      (select count(*) from public.images),
    'captions',    (select count(*) from public.captions),
    'votes',       (select count(*) from public.votes),
    'upvotes',     (select count(*) from public.votes where value = 1),
    'downvotes',   (select count(*) from public.votes where value = -1),
    'votes_today', (select count(*) from public.votes
                     where (created_at at time zone 'America/New_York')::date
                         = (now() at time zone 'America/New_York')::date),
    'photos_today',(select count(*) from public.images
                     where (created_at at time zone 'America/New_York')::date
                         = (now() at time zone 'America/New_York')::date),
    'active_7d',   (select count(distinct a.uid) from (
                      select user_id as uid from public.votes  where created_at > now() - interval '7 days'
                      union
                      select user_id as uid from public.images where created_at > now() - interval '7 days'
                    ) a),
    'superadmins', (select count(*) from public.profiles where is_superadmin)
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_daily(p_days integer default 14)
returns table (day date, photos bigint, votes bigint, signups bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  with days as (
    select g.d::date as d
    from generate_series(
      (now() at time zone 'America/New_York')::date - (greatest(p_days, 1) - 1),
      (now() at time zone 'America/New_York')::date,
      interval '1 day'
    ) as g(d)
  )
  select
    days.d,
    (select count(*) from public.images i
      where (i.created_at at time zone 'America/New_York')::date = days.d),
    (select count(*) from public.votes v
      where (v.created_at at time zone 'America/New_York')::date = days.d),
    (select count(*) from auth.users u
      where (u.created_at at time zone 'America/New_York')::date = days.d)
  from days
  order by days.d;
end;
$$;

create or replace function public.admin_hourly()
returns table (hr integer, vote_total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    g.h,
    (select count(*) from public.votes v
      where extract(hour from v.created_at at time zone 'America/New_York')::integer = g.h)
  from generate_series(0, 23) as g(h)
  order by g.h;
end;
$$;

create or replace function public.admin_voices()
returns table (
  style_id text, caption_count bigint, photo_count bigint,
  avg_score numeric, vote_total bigint, upvote_pct numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    c.style,
    count(*),
    count(distinct c.image_id),
    round(avg(c.score)::numeric, 2),
    coalesce(sum(c.vote_count), 0)::bigint,
    case when coalesce(sum(c.vote_count), 0) > 0 then
      round(100.0 * (
        select count(*) from public.votes v
          join public.captions c2 on c2.id = v.caption_id
         where c2.style = c.style and v.value = 1
      ) / sum(c.vote_count), 1)
    end
  from public.captions c
  group by c.style
  order by avg(c.score) desc;
end;
$$;

create or replace function public.admin_models()
returns table (model_name text, caption_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select c.model, count(*)
  from public.captions c
  group by c.model
  order by count(*) desc;
end;
$$;

-- The "most divisive" captions: the ones whose upvotes and downvotes cancel out most.
create or replace function public.admin_divisive(p_limit integer default 3)
returns table (
  cap_id uuid, img_id uuid, caption_text text, caption_score integer,
  ups bigint, downs bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.image_id,
    c.content,
    c.score,
    count(*) filter (where v.value = 1),
    count(*) filter (where v.value = -1)
  from public.captions c
  join public.votes v on v.caption_id = c.id
  group by c.id
  having count(*) filter (where v.value = 1) >= 1
     and count(*) filter (where v.value = -1) >= 1
  order by (count(*) - abs(sum(v.value))) desc, count(*) desc
  limit greatest(p_limit, 1);
end;
$$;

-- Only signed-in users may call these, and they refuse anyone who is not a superadmin.
revoke all on function public.admin_users()     from public, anon;
revoke all on function public.admin_overview()  from public, anon;
revoke all on function public.admin_daily(integer)   from public, anon;
revoke all on function public.admin_hourly()    from public, anon;
revoke all on function public.admin_voices()    from public, anon;
revoke all on function public.admin_models()    from public, anon;
revoke all on function public.admin_divisive(integer) from public, anon;

grant execute on function public.admin_users()     to authenticated;
grant execute on function public.admin_overview()  to authenticated;
grant execute on function public.admin_daily(integer)   to authenticated;
grant execute on function public.admin_hourly()    to authenticated;
grant execute on function public.admin_voices()    to authenticated;
grant execute on function public.admin_models()    to authenticated;
grant execute on function public.admin_divisive(integer) to authenticated;
