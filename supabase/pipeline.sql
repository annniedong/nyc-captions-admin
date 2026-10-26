-- Week 7: the AI pipeline and access-control tables. Run once in the Supabase SQL
-- Editor (after admin.sql). Safe to re-run: tables use IF NOT EXISTS, seeds skip
-- rows that already exist, and policies are dropped and recreated.
--
-- Access model for every table below:
--   * Row Level Security is ON.
--   * Superadmins (public.is_superadmin()) manage them, or only read them where the
--     assignment says read-only (chains, steps, requests, responses).
--   * The public app (signed-in users) may read only the active prompt content and
--     models it needs, and may only INSERT its own generation logs.
--   * Nothing here is readable or writable by logged-out visitors.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  api_base_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  model_code text not null,
  display_name text not null,
  priority integer not null default 100 check (priority between 1 and 1000),
  timeout_ms integer not null default 10000 check (timeout_ms between 1000 and 60000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider_id, model_code)
);

-- A "prompt chain" is a named, ordered set of prompt steps. Each caption voice is one.
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique,
  label text not null,
  description text,
  subway_line text not null default 'S',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  name text not null,
  instruction text not null,
  created_at timestamptz not null default now(),
  unique (chain_id, step_order)
);

-- How often "Surprise me" picks each chain (relative weights).
create table if not exists public.prompt_chain_mix (
  chain_id bigint primary key references public.prompt_chains (id) on delete cascade,
  weight integer not null default 1 check (weight between 0 and 100),
  updated_at timestamptz not null default now()
);

-- Glossary terms injected into prompts. chain_id NULL means "all chains".
create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null unique,
  definition text not null,
  chain_id bigint references public.prompt_chains (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Few-shot examples injected into prompts. chain_id NULL means "all chains".
create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  chain_id bigint references public.prompt_chains (id) on delete cascade,
  image_description text not null,
  example_captions text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per caption generation, and one row per model attempt within it.
create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  image_id uuid references public.images (id) on delete set null,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  status text not null check (status in ('succeeded', 'blocked', 'failed')),
  error text,
  model_used text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists generation_requests_created_idx
  on public.generation_requests (created_at desc);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete cascade,
  model_code text not null,
  provider_slug text,
  status text not null check (status in ('ok', 'error')),
  http_status integer,
  latency_ms integer,
  response_text text,
  created_at timestamptz not null default now()
);
create index if not exists llm_responses_request_idx
  on public.llm_responses (request_id);

create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique
    check (domain = lower(domain)
      and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null unique
    check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Seed data, taken from how the app works today (idempotent)
-- ---------------------------------------------------------------------------

insert into public.llm_providers (slug, name, api_base_url)
values ('google', 'Google (Gemini API)', 'https://generativelanguage.googleapis.com')
on conflict (slug) do nothing;

insert into public.llm_models (provider_id, model_code, display_name, priority, timeout_ms)
select p.id, m.code, m.name, m.prio, m.timeout
from public.llm_providers p
cross join (values
  ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 10, 10000),
  ('gemini-3.5-flash',      'Gemini 3.5 Flash',      20, 15000),
  ('gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', 30, 10000)
) as m(code, name, prio, timeout)
where p.slug = 'google'
on conflict (provider_id, model_code) do nothing;

insert into public.prompt_chains (slug, label, description, subway_line) values
  ('jaded-nyer',      'Jaded New Yorker',        'Seen it all. Impressed by nothing.',            '6'),
  ('midwest-tourist', 'Midwest in the Big City', 'Wide-eyed, polite, comparing it all to home.',  'N'),
  ('columbia-gc',     'Columbia group chat',     'Chronically online. Library at 2am.',           '1'),
  ('pigeon',          'The pigeon''s POV',       'Narrated by a very opinionated city pigeon.',   'A')
on conflict (slug) do nothing;

-- Step 1 is the persona; steps 2 and 3 are shared. Together they rebuild the exact
-- prompt the app used before it was moved into the database.
insert into public.prompt_chain_steps (chain_id, step_order, name, instruction)
select c.id, s.step_order, s.name, s.instruction
from public.prompt_chains c
join (values
  ('jaded-nyer', 1, 'Role and voice',
   E'You write captions for photos shared on a humor site for college students in New York City.\nVoice: A deadpan lifelong New Yorker who has seen everything twice. Dry, unimpressed, a little exhausted. Mentions of the MTA, rent, and bodegas are welcome when they fit.'),
  ('midwest-tourist', 1, 'Role and voice',
   E'You write captions for photos shared on a humor site for college students in New York City.\nVoice: A very polite, wide-eyed person from the Midwest who is new to New York. Overly earnest, apologizes to inanimate objects, and keeps comparing things to back home.'),
  ('columbia-gc', 1, 'Role and voice',
   E'You write captions for photos shared on a humor site for college students in New York City.\nVoice: A chronically online college student posting in the group chat. Lowercase, meme-literate, a bit unhinged, with references to midterms, Butler Library at 2am, and dining hall disappointment.'),
  ('pigeon', 1, 'Role and voice',
   E'You write captions for photos shared on a humor site for college students in New York City.\nVoice: A smug New York City pigeon narrating the scene. Territorial, food-motivated, and convinced the whole city belongs to it.')
) as s(slug, step_order, name, instruction) on s.slug = c.slug
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, name, instruction)
select c.id, s.step_order, s.name, s.instruction
from public.prompt_chains c
cross join (values
  (2, 'Writing rules',
   E'Rules:\n- Look carefully at the photo and make every caption specific to what is actually in it.\n- Write exactly 3 different captions, each under 140 characters.\n- Punchy and funny. No hashtags and no emojis. Do not be cruel to any individual in the photo.'),
  (3, 'Safety and output format',
   E'- If the photo contains nudity, graphic violence, or a clearly identifiable private person in a sensitive situation, set "safe" to false and return an empty captions list.\nReturn JSON with "safe" (boolean) and "captions" (array of strings).')
) as s(step_order, name, instruction)
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_mix (chain_id, weight)
select c.id, w.weight
from public.prompt_chains c
join (values ('jaded-nyer', 3), ('midwest-tourist', 2), ('columbia-gc', 3), ('pigeon', 2))
  as w(slug, weight) on w.slug = c.slug
on conflict (chain_id) do nothing;

insert into public.terms (term, definition) values
  ('Bodega',                 'A corner store, usually with a cat in charge.'),
  ('The 6',                  'The green Lexington Avenue subway line.'),
  ('Butler Library',         'Columbia''s main library, open late and full of stress.'),
  ('Dollar slice',           'A cheap slice of pizza, a New York staple.'),
  ('Alternate side parking', 'Street parking rules that make you move your car twice a week.'),
  ('Scaffolding',            'Sidewalk sheds that stay up for years.'),
  ('Straphanger',            'Someone standing on a crowded subway holding a strap.'),
  ('Stoop',                  'The front steps of a brownstone, where life happens.'),
  ('Pizza rat',              'The viral rat dragging a slice down the subway stairs.'),
  ('Rush hour',              'When the subway turns into a sardine tin.')
on conflict (term) do nothing;

insert into public.generation_examples (chain_id, image_description, example_captions)
select c.id, e.description, e.captions
from public.prompt_chains c
join (values
  ('jaded-nyer', 'A man in a full chicken suit riding the subway',
   E'A man in a full chicken suit on the 6 train. Tuesday, then.\nNobody looked up. Nobody ever does.'),
  ('midwest-tourist', 'A tourist photographing a rat near the subway steps',
   E'Ope, sorry, I think I just bumped into the whole city.\nBack home we would call that a very large squirrel.'),
  ('columbia-gc', 'A student asleep at a library desk',
   E'me walking into butler at 1:58am like it owes me an A\nthe reading said skim and i said no thank u'),
  ('pigeon', 'A pigeon eating a pizza crust on the sidewalk',
   E'My city. My crust. Back up.\nThe man dropped it. The man chose this.')
) as e(slug, description, captions) on e.slug = c.slug
where not exists (select 1 from public.generation_examples);

insert into public.allowed_signup_domains (domain, note) values
  ('barnard.edu',  'Barnard College'),
  ('columbia.edu', 'Columbia University'),
  ('gmail.com',    'Personal Google accounts')
on conflict (domain) do nothing;

-- The signup gate ships OFF, so nobody is locked out until an admin turns it on.
insert into public.app_settings (key, value) values ('signup_gate_enabled', 'false')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Photo replacement: let superadmins swap an image file (storage_path only)
-- ---------------------------------------------------------------------------

revoke update on public.images from anon, authenticated;
grant update (storage_path) on public.images to authenticated;

drop policy if exists "Superadmins can update images" on public.images;
create policy "Superadmins can update images"
  on public.images for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------

alter table public.llm_providers          enable row level security;
alter table public.llm_models             enable row level security;
alter table public.prompt_chains          enable row level security;
alter table public.prompt_chain_steps     enable row level security;
alter table public.prompt_chain_mix       enable row level security;
alter table public.terms                  enable row level security;
alter table public.generation_examples    enable row level security;
alter table public.generation_requests    enable row level security;
alter table public.llm_responses          enable row level security;
alter table public.allowed_signup_domains enable row level security;
alter table public.whitelisted_emails     enable row level security;
alter table public.app_settings           enable row level security;

-- Logged-out visitors get nothing, at the privilege level as well as through RLS.
revoke all on public.llm_providers, public.llm_models, public.prompt_chains,
  public.prompt_chain_steps, public.prompt_chain_mix, public.terms,
  public.generation_examples, public.generation_requests, public.llm_responses,
  public.allowed_signup_domains, public.whitelisted_emails, public.app_settings
  from anon;

-- Chains and steps are defined by migrations, never edited from the app.
revoke insert, update, delete on public.prompt_chains, public.prompt_chain_steps
  from authenticated;
-- Generation logs are append-only from the app.
revoke update, delete on public.generation_requests, public.llm_responses
  from authenticated;
-- The mix can only be re-weighted, not created or removed.
revoke insert, delete on public.prompt_chain_mix from authenticated;
revoke update on public.prompt_chain_mix from authenticated;
grant update (weight, updated_at) on public.prompt_chain_mix to authenticated;

-- llm_providers: admins manage; the app reads active ones.
drop policy if exists "Superadmins manage providers" on public.llm_providers;
create policy "Superadmins manage providers"
  on public.llm_providers for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "App reads active providers" on public.llm_providers;
create policy "App reads active providers"
  on public.llm_providers for select to authenticated
  using (is_active);

-- llm_models
drop policy if exists "Superadmins manage models" on public.llm_models;
create policy "Superadmins manage models"
  on public.llm_models for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "App reads active models" on public.llm_models;
create policy "App reads active models"
  on public.llm_models for select to authenticated
  using (is_active);

-- prompt_chains / prompt_chain_steps: admins read all; the app reads active ones.
drop policy if exists "Superadmins read chains" on public.prompt_chains;
create policy "Superadmins read chains"
  on public.prompt_chains for select to authenticated
  using (public.is_superadmin());
drop policy if exists "App reads active chains" on public.prompt_chains;
create policy "App reads active chains"
  on public.prompt_chains for select to authenticated
  using (is_active);

drop policy if exists "Superadmins read steps" on public.prompt_chain_steps;
create policy "Superadmins read steps"
  on public.prompt_chain_steps for select to authenticated
  using (public.is_superadmin());
drop policy if exists "App reads steps of active chains" on public.prompt_chain_steps;
create policy "App reads steps of active chains"
  on public.prompt_chain_steps for select to authenticated
  using (exists (
    select 1 from public.prompt_chains c
    where c.id = chain_id and c.is_active
  ));

-- prompt_chain_mix: everyone signed in reads; only superadmins re-weight.
drop policy if exists "Signed-in users read the mix" on public.prompt_chain_mix;
create policy "Signed-in users read the mix"
  on public.prompt_chain_mix for select to authenticated
  using (true);
drop policy if exists "Superadmins update the mix" on public.prompt_chain_mix;
create policy "Superadmins update the mix"
  on public.prompt_chain_mix for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- terms and generation_examples: admins manage; the app reads active rows.
drop policy if exists "Superadmins manage terms" on public.terms;
create policy "Superadmins manage terms"
  on public.terms for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "App reads active terms" on public.terms;
create policy "App reads active terms"
  on public.terms for select to authenticated
  using (is_active);

drop policy if exists "Superadmins manage examples" on public.generation_examples;
create policy "Superadmins manage examples"
  on public.generation_examples for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "App reads active examples" on public.generation_examples;
create policy "App reads active examples"
  on public.generation_examples for select to authenticated
  using (is_active);

-- generation_requests: a user logs their own; they and admins read them. No edits.
drop policy if exists "Users log their own requests" on public.generation_requests;
create policy "Users log their own requests"
  on public.generation_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Owners and admins read requests" on public.generation_requests;
create policy "Owners and admins read requests"
  on public.generation_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_superadmin());

-- llm_responses: the app logs responses for its own requests; only admins read them.
drop policy if exists "Users log responses for their requests" on public.llm_responses;
create policy "Users log responses for their requests"
  on public.llm_responses for insert to authenticated
  with check (exists (
    select 1 from public.generation_requests r
    where r.id = request_id and r.user_id = (select auth.uid())
  ));
drop policy if exists "Superadmins read responses" on public.llm_responses;
create policy "Superadmins read responses"
  on public.llm_responses for select to authenticated
  using (public.is_superadmin());

-- Access control tables and settings are superadmin-only.
drop policy if exists "Superadmins manage domains" on public.allowed_signup_domains;
create policy "Superadmins manage domains"
  on public.allowed_signup_domains for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "Superadmins manage emails" on public.whitelisted_emails;
create policy "Superadmins manage emails"
  on public.whitelisted_emails for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "Superadmins manage settings" on public.app_settings;
create policy "Superadmins manage settings"
  on public.app_settings for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 5. The signup gate. The public app calls this once after Google sign-in. It reads
--    the caller's own email from their token, so it can't be used to probe anyone
--    else, and it never exposes the lists themselves.
-- ---------------------------------------------------------------------------

create or replace function public.signup_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_domain text := split_part(lower(coalesce((select auth.jwt()) ->> 'email', '')), '@', 2);
  v_enabled boolean;
begin
  select (value = 'true') into v_enabled
  from public.app_settings where key = 'signup_gate_enabled';

  if coalesce(v_enabled, false) = false then
    return true;
  end if;
  if public.is_superadmin() then
    return true;
  end if;

  return exists (
           select 1 from public.whitelisted_emails w
           where w.is_active and w.email = v_email
         )
      or exists (
           select 1 from public.allowed_signup_domains d
           where d.is_active and d.domain = v_domain
         );
end;
$$;

revoke all on function public.signup_allowed() from public, anon;
grant execute on function public.signup_allowed() to authenticated;
