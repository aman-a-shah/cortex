alter table public.context_entries
add column if not exists backboard_synced_at timestamptz,
add column if not exists backboard_sync_error text;

create table if not exists public.backboard_agents (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('company', 'department')),
  department_id text references public.departments(id),
  department_key text generated always as (coalesce(department_id, '__company__')) stored,
  backboard_thread_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, department_key)
);

create index if not exists backboard_agents_scope_department_idx
  on public.backboard_agents (scope, department_id);

drop trigger if exists backboard_agents_set_updated_at on public.backboard_agents;
create trigger backboard_agents_set_updated_at
before update on public.backboard_agents
for each row execute function public.set_updated_at();

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.backboard_agents to authenticated, service_role;
grant select, insert, update, delete on public.context_entries to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter table public.backboard_agents enable row level security;

drop policy if exists "Authenticated users can read backboard agents" on public.backboard_agents;
create policy "Authenticated users can read backboard agents"
on public.backboard_agents for select
to authenticated
using (true);

delete from public.backboard_agents
where scope = 'department';
