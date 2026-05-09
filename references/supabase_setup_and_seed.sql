create extension if not exists "pgcrypto";

create table if not exists public.departments (
  id text primary key,
  name text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  department_id text not null references public.departments(id),
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id text not null references public.departments(id),
  title text,
  backboard_thread_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.context_entries (
  id uuid primary key default gen_random_uuid(),
  department_id text not null references public.departments(id),
  created_by uuid references auth.users(id) on delete set null,
  text text not null,
  summary text not null,
  source text,
  media_url text,
  media_public_id text,
  token_count int,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.departments (id, name)
values
  ('engineering', 'Engineering'),
  ('marketing', 'Marketing'),
  ('finance', 'Finance'),
  ('legal', 'Legal'),
  ('product', 'Product'),
  ('management', 'Management')
on conflict (id) do nothing;

create index if not exists profiles_department_idx
  on public.profiles (department_id);

create index if not exists chat_threads_user_department_updated_idx
  on public.chat_threads (user_id, department_id, updated_at desc);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at asc);

create index if not exists context_entries_created_idx
  on public.context_entries (created_at desc);

create index if not exists context_entries_department_created_idx
  on public.context_entries (department_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row execute function public.set_updated_at();

grant usage on schema public to anon, authenticated, service_role;

grant select on public.departments to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.chat_threads to authenticated, service_role;
grant select, insert, update, delete on public.chat_messages to authenticated, service_role;
grant select, insert, update, delete on public.context_entries to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.context_entries enable row level security;

drop policy if exists "Authenticated users can read departments" on public.departments;
create policy "Authenticated users can read departments"
on public.departments for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can read own chat threads" on public.chat_threads;
create policy "Users can read own chat threads"
on public.chat_threads for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own chat threads" on public.chat_threads;
create policy "Users can create own chat threads"
on public.chat_threads for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own chat threads" on public.chat_threads;
create policy "Users can update own chat threads"
on public.chat_threads for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own chat threads" on public.chat_threads;
create policy "Users can delete own chat threads"
on public.chat_threads for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own chat messages" on public.chat_messages;
create policy "Users can read own chat messages"
on public.chat_messages for select
to authenticated
using (
  exists (
    select 1 from public.chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "Users can create messages in own threads" on public.chat_messages;
create policy "Users can create messages in own threads"
on public.chat_messages for insert
to authenticated
with check (
  exists (
    select 1 from public.chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete messages in own threads" on public.chat_messages;
create policy "Users can delete messages in own threads"
on public.chat_messages for delete
to authenticated
using (
  exists (
    select 1 from public.chat_threads t
    where t.id = chat_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read all context" on public.context_entries;
create policy "Authenticated users can read all context"
on public.context_entries for select
to authenticated
using (true);

drop policy if exists "Users can create context for own department" on public.context_entries;
create policy "Users can create context for own department"
on public.context_entries for insert
to authenticated
with check (
  created_by = auth.uid()
  and department_id = (
    select p.department_id from public.profiles p where p.id = auth.uid()
  )
);

drop policy if exists "Creators and department admins can update context" on public.context_entries;
create policy "Creators and department admins can update context"
on public.context_entries for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.department_id = context_entries.department_id
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.department_id = context_entries.department_id
  )
);

drop policy if exists "Creators and department admins can delete context" on public.context_entries;
create policy "Creators and department admins can delete context"
on public.context_entries for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.department_id = context_entries.department_id
  )
);

insert into public.context_entries
  (department_id, text, summary, source, token_count, created_at)
select
  seed.department_id,
  seed.text,
  seed.summary,
  seed.source,
  seed.token_count,
  seed.created_at
from (
  values
    (
      'marketing',
      'Q3 2025 Campaign: Focus on B2B SaaS verticals. Total budget $500K. Primary channel LinkedIn (60%), secondary Content Marketing (25%), Events (15%). Campaign theme: Build Faster Together. Key messaging: speed-to-value, team collaboration, enterprise security. Target ICP: SaaS companies 50-500 employees, Series A-C.',
      'Q3 campaign: B2B SaaS, $500K, LinkedIn-first, Build Faster Together',
      'Marketing Planning Session',
      312,
      now() - interval '3 hours'
    ),
    (
      'finance',
      'Q3 2025 Budget Approved: Total $2.1M. Breakdown: Engineering $840K (40%), Marketing $504K (24%), Operations $315K (15%), Sales $252K (12%), Legal & Compliance $189K (9%). No department can exceed allocation without CFO written sign-off. Headcount freeze in effect until Q4 review. Cloud infra budget capped at $180K.',
      'Q3 budget $2.1M approved: Eng 40%, Mktg 24%, Ops 15%, Sales 12%, Legal 9%',
      'CFO Budget Review',
      428,
      now() - interval '5 hours'
    ),
    (
      'legal',
      'Data Privacy Policy v2.1 effective July 1 2025. All user PII must be encrypted at rest (AES-256) and in transit (TLS 1.3+). Retention policy: user data max 24 months post-churn. GDPR & CCPA compliance mandatory for all new features. New data collection requires DPO sign-off. Cookie consent banner required on all web properties.',
      'Privacy v2.1: AES-256 required, 24mo retention, GDPR/CCPA mandatory',
      'Legal Compliance Review',
      380,
      now() - interval '8 hours'
    ),
    (
      'engineering',
      'Architecture Decision: Migrating from REST to GraphQL. Target completion Q4 2025. All new APIs must be GraphQL-first. Auth service moving to JWT with 15-minute access tokens + 7-day refresh tokens. Avoid creating new REST endpoints. Current stack: Next.js, PostgreSQL, Redis for caching. Infra: AWS ECS, targeting zero-downtime deployments.',
      'REST to GraphQL migration Q4, JWT auth, no new REST endpoints, AWS ECS',
      'Engineering Architecture Meeting',
      356,
      now() - interval '6 hours'
    ),
    (
      'management',
      'Q3 2025 OKRs: Company ARR target $4.2M (current $3.1M), NPS target >47 (current 41), churn target <2.8% (current 3.4%). All teams must align deliverables to ARR impact. Monthly all-hands first Friday. Board presentation August 15. Hiring: 3 senior engineers approved, 1 Head of Growth approved.',
      'Q3 OKRs: $4.2M ARR, NPS >47, churn <2.8%; 4 hires approved',
      'Executive OKR Review',
      390,
      now() - interval '10 hours'
    )
) as seed(department_id, text, summary, source, token_count, created_at)
where not exists (
  select 1
  from public.context_entries existing
  where existing.source = seed.source
    and existing.summary = seed.summary
);
