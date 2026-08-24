create extension if not exists pgcrypto;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitter_hash text not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

comment on table public.messages is 'Moderated Springhues guestbook messages; submitter_hash is an HMAC and never a raw IP address.';

create index messages_moderation_queue_idx on public.messages (status, created_at desc);
create index messages_public_feed_idx on public.messages (approved_at desc, id desc) where status = 'approved';
create index messages_rate_limit_idx on public.messages (submitter_hash, created_at desc);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant all on table public.messages to service_role;

create or replace function public.set_message_approved_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status <> 'approved' then
    new.approved_at := null;
  end if;
  return new;
end;
$$;

create trigger messages_approved_at_trigger
before update of status on public.messages
for each row execute function public.set_message_approved_at();

create or replace function public.submit_message_internal(
  p_nickname text,
  p_content text,
  p_submitter_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nickname text := btrim(p_nickname);
  v_content text := btrim(p_content);
  v_id uuid;
begin
  if char_length(v_nickname) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;
  if char_length(v_content) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'INVALID_CONTENT';
  end if;
  if p_submitter_hash is null or char_length(p_submitter_hash) <> 64 then
    raise exception using errcode = '22023', message = 'INVALID_SUBMITTER_HASH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submitter_hash, 0));
  if (
    select count(*)
    from public.messages
    where submitter_hash = p_submitter_hash
      and created_at >= now() - interval '10 minutes'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'MESSAGE_RATE_LIMITED';
  end if;

  insert into public.messages (nickname, content, submitter_hash)
  values (v_nickname, v_content, p_submitter_hash)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.list_approved_messages_internal(
  p_limit integer default 21,
  p_cursor_approved_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  nickname text,
  content text,
  approved_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select message.id, message.nickname, message.content, message.approved_at
  from public.messages as message
  where message.status = 'approved'
    and message.approved_at is not null
    and (
      p_cursor_approved_at is null
      or (message.approved_at, message.id) < (p_cursor_approved_at, p_cursor_id)
    )
  order by message.approved_at desc, message.id desc
  limit least(greatest(p_limit, 1), 51);
$$;

revoke all on function public.submit_message_internal(text, text, text) from public, anon, authenticated;
revoke all on function public.list_approved_messages_internal(integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.submit_message_internal(text, text, text) to service_role;
grant execute on function public.list_approved_messages_internal(integer, timestamptz, uuid) to service_role;
