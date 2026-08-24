alter table public.messages
  add column owner_reply text,
  add column owner_replied_at timestamptz,
  add column owner_reply_updated_by uuid,
  add constraint messages_owner_reply_length
    check (owner_reply is null or char_length(owner_reply) between 1 and 500);

comment on column public.messages.owner_reply is 'Single public Springhues reply; null means no public reply.';
comment on column public.messages.owner_reply_updated_by is 'Supabase Auth user id of the administrator who last changed the reply.';

create or replace function public.set_message_owner_reply_metadata()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.owner_reply := nullif(btrim(new.owner_reply), '');
  if new.owner_reply is distinct from old.owner_reply then
    new.owner_replied_at := case when new.owner_reply is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger messages_owner_reply_metadata_trigger
before update of owner_reply on public.messages
for each row execute function public.set_message_owner_reply_metadata();

drop function public.list_approved_messages_internal(integer, timestamptz, uuid);

create function public.list_approved_messages_internal(
  p_limit integer default 21,
  p_cursor_approved_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  nickname text,
  content text,
  approved_at timestamptz,
  owner_reply text,
  owner_replied_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    message.id,
    message.nickname,
    message.content,
    message.approved_at,
    message.owner_reply,
    message.owner_replied_at
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

create or replace function public.list_messages_for_admin_internal(
  p_status text default null,
  p_limit integer default 21,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  nickname text,
  content text,
  status text,
  created_at timestamptz,
  approved_at timestamptz,
  owner_reply text,
  owner_replied_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_MESSAGE_STATUS';
  end if;

  return query
  select
    message.id,
    message.nickname,
    message.content,
    message.status,
    message.created_at,
    message.approved_at,
    message.owner_reply,
    message.owner_replied_at
  from public.messages as message
  where (p_status is null or message.status = p_status)
    and (
      p_cursor_created_at is null
      or (message.created_at, message.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by message.created_at desc, message.id desc
  limit least(greatest(p_limit, 1), 51);
end;
$$;

create or replace function public.update_message_for_admin_internal(
  p_id uuid,
  p_status text default null,
  p_set_reply boolean default false,
  p_reply text default null,
  p_admin_id uuid default null
)
returns table (
  id uuid,
  nickname text,
  content text,
  status text,
  created_at timestamptz,
  approved_at timestamptz,
  owner_reply text,
  owner_replied_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reply text := nullif(btrim(p_reply), '');
begin
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_MESSAGE_STATUS';
  end if;
  if p_set_reply and v_reply is not null and char_length(v_reply) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_REPLY';
  end if;
  if p_set_reply and p_admin_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_ID';
  end if;

  return query
  update public.messages as message
  set
    status = coalesce(p_status, message.status),
    owner_reply = case when p_set_reply then v_reply else message.owner_reply end,
    owner_reply_updated_by = case when p_set_reply then p_admin_id else message.owner_reply_updated_by end
  where message.id = p_id
  returning
    message.id,
    message.nickname,
    message.content,
    message.status,
    message.created_at,
    message.approved_at,
    message.owner_reply,
    message.owner_replied_at;
end;
$$;

revoke all on function public.list_approved_messages_internal(integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.list_messages_for_admin_internal(text, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.update_message_for_admin_internal(uuid, text, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.list_approved_messages_internal(integer, timestamptz, uuid) to service_role;
grant execute on function public.list_messages_for_admin_internal(text, integer, timestamptz, uuid) to service_role;
grant execute on function public.update_message_for_admin_internal(uuid, text, boolean, text, uuid) to service_role;
