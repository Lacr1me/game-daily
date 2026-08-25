create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('website_change', 'maintenance')),
  occurred_at timestamptz not null,
  title text not null check (char_length(title) between 1 and 160),
  summary text not null check (char_length(summary) between 1 and 2000),
  status text not null default 'info' check (status in ('info', 'success', 'warning', 'failure')),
  source text not null check (char_length(source) between 1 and 80),
  source_key text not null unique check (char_length(source_key) between 1 and 300),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_logs is 'Private, sanitized operational and website change logs for Springhues administrators.';

create index admin_logs_kind_timeline_idx on public.admin_logs (kind, occurred_at desc, id desc);

alter table public.admin_logs enable row level security;
revoke all on table public.admin_logs from public, anon, authenticated;
grant all on table public.admin_logs to service_role;

create or replace function public.set_admin_log_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger admin_logs_updated_at_trigger
before update on public.admin_logs
for each row execute function public.set_admin_log_updated_at();

create or replace function public.list_admin_logs_internal(
  p_kind text,
  p_limit integer default 21,
  p_cursor_occurred_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  kind text,
  occurred_at timestamptz,
  title text,
  summary text,
  status text,
  source text,
  source_key text,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind not in ('website_change', 'maintenance') then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_LOG_KIND';
  end if;

  return query
  select
    log.id,
    log.kind,
    log.occurred_at,
    log.title,
    log.summary,
    log.status,
    log.source,
    log.source_key,
    log.metadata
  from public.admin_logs as log
  where log.kind = p_kind
    and (
      p_cursor_occurred_at is null
      or (log.occurred_at, log.id) < (p_cursor_occurred_at, p_cursor_id)
    )
  order by log.occurred_at desc, log.id desc
  limit least(greatest(p_limit, 1), 51);
end;
$$;

create or replace function public.upsert_admin_logs_internal(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_LOG_BATCH';
  end if;

  insert into public.admin_logs as log (
    kind, occurred_at, title, summary, status, source, source_key, metadata
  )
  select
    item.kind,
    item.occurred_at,
    item.title,
    item.summary,
    item.status,
    item.source,
    item.source_key,
    coalesce(item.metadata, '{}'::jsonb)
  from jsonb_to_recordset(p_items) as item(
    kind text,
    occurred_at timestamptz,
    title text,
    summary text,
    status text,
    source text,
    source_key text,
    metadata jsonb
  )
  on conflict (source_key) do update set
    kind = excluded.kind,
    occurred_at = excluded.occurred_at,
    title = excluded.title,
    summary = excluded.summary,
    status = excluded.status,
    source = excluded.source,
    metadata = excluded.metadata;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.list_admin_logs_internal(text, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.upsert_admin_logs_internal(jsonb) from public, anon, authenticated;
grant execute on function public.list_admin_logs_internal(text, integer, timestamptz, uuid) to service_role;
grant execute on function public.upsert_admin_logs_internal(jsonb) to service_role;
