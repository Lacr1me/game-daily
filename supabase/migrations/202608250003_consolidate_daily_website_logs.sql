-- Website change logs are daily summaries. Keep exactly one row for each
-- Beijing calendar date, then make future syncs address that row by date.
with ranked as (
  select
    id,
    row_number() over (
      partition by (occurred_at at time zone 'Asia/Shanghai')::date
      order by occurred_at desc, updated_at desc, id desc
    ) as position
  from public.admin_logs
  where kind = 'website_change'
)
delete from public.admin_logs as log
using ranked
where log.id = ranked.id
  and ranked.position > 1;

update public.admin_logs
set
  source_key = 'website_change:' || ((occurred_at at time zone 'Asia/Shanghai')::date)::text,
  title = case
    when title ~ '^\d{4}-\d{2}-\d{2}｜' then title
    else ((occurred_at at time zone 'Asia/Shanghai')::date)::text || '｜' ||
      case when source = 'github_pages' then '网站修改' else title end
  end
where kind = 'website_change';

create unique index admin_logs_website_change_beijing_day_unique
on public.admin_logs (((occurred_at at time zone 'Asia/Shanghai')::date))
where kind = 'website_change';

comment on index public.admin_logs_website_change_beijing_day_unique is
  'Allows only one website change summary for each Beijing calendar date.';
