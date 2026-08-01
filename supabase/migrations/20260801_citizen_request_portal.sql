begin;

create extension if not exists pgcrypto;

create table if not exists public.citizen_requests (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  request_type text not null,
  title text not null,
  description text not null,
  location_text text,
  incident_date timestamptz,
  contact_preference text,
  contact_value text,
  status text not null default 'submitted',
  priority text not null default 'unreviewed',
  assigned_officer_id uuid,
  station_unit_id uuid,
  district_unit_id uuid,
  submitted_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  reviewed_at timestamptz,
  converted_case_id uuid,
  internal_notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.citizen_request_activity (
  id uuid primary key default gen_random_uuid(),
  citizen_request_id uuid not null references public.citizen_requests(id) on delete cascade,
  action text not null,
  public_status text not null,
  summary text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists citizen_requests_reference_idx on public.citizen_requests(reference);
create index if not exists citizen_requests_status_idx on public.citizen_requests(status);
create index if not exists citizen_requests_priority_idx on public.citizen_requests(priority);
create index if not exists citizen_requests_station_idx on public.citizen_requests(station_unit_id);
create index if not exists citizen_requests_district_idx on public.citizen_requests(district_unit_id);
create index if not exists citizen_requests_assigned_idx on public.citizen_requests(assigned_officer_id);
create index if not exists citizen_request_activity_request_idx on public.citizen_request_activity(citizen_request_id, created_at desc);

alter table if exists public.citizen_requests enable row level security;
alter table if exists public.citizen_request_activity enable row level security;

create or replace function public.citizen_request_public_status_label(raw_status text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(raw_status, 'submitted')))
    when 'submitted' then 'Submitted'
    when 'received' then 'Received'
    when 'under_review' then 'Under review'
    when 'additional_info_requested' then 'Additional information requested'
    when 'referred_for_action' then 'Referred for action'
    when 'closed' then 'Closed'
    else 'Submitted'
  end;
$$;

create or replace function public.citizen_request_priority_label(raw_priority text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(raw_priority, 'unreviewed')))
    when 'low' then 'Low'
    when 'medium' then 'Medium'
    when 'high' then 'High'
    else 'Unreviewed'
  end;
$$;

create or replace function public.generate_citizen_request_reference()
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
  year_text text := to_char(now(), 'YYYY');
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := format('CIT-%s-%s', year_text, lpad((floor(random() * 1000000))::integer::text, 6, '0'));

    exit when not exists (
      select 1
      from public.citizen_requests cr
      where cr.reference = candidate
    );

    exit when attempts >= 25;
  end loop;

  return candidate;
end;
$$;

create or replace function public.citizen_request_before_insert()
returns trigger
language plpgsql
as $$
begin
  if coalesce(trim(new.reference), '') = '' then
    new.reference := public.generate_citizen_request_reference();
  end if;

  new.request_type := trim(new.request_type);
  new.title := trim(new.title);
  new.description := trim(new.description);
  new.status := lower(trim(coalesce(new.status, 'submitted')));
  new.priority := lower(trim(coalesce(new.priority, 'unreviewed')));
  new.updated_at := now();

  if coalesce(trim(new.request_type), '') = '' then
    raise exception 'request_type is required';
  end if;

  if coalesce(trim(new.title), '') = '' then
    raise exception 'title is required';
  end if;

  if coalesce(trim(new.description), '') = '' then
    raise exception 'description is required';
  end if;

  if new.request_type not in (
    'General information request',
    'Suspicious activity report',
    'Lost property report',
    'Community safety concern',
    'Non-emergency incident report'
  ) then
    raise exception 'Invalid citizen request type';
  end if;

  if new.status not in (
    'submitted',
    'received',
    'under_review',
    'additional_info_requested',
    'referred_for_action',
    'closed'
  ) then
    raise exception 'Invalid citizen request status';
  end if;

  if new.priority not in ('unreviewed', 'low', 'medium', 'high') then
    raise exception 'Invalid citizen request priority';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_citizen_requests_before_insert on public.citizen_requests;
create trigger trg_citizen_requests_before_insert
before insert on public.citizen_requests
for each row
execute function public.citizen_request_before_insert();

create or replace function public.citizen_request_after_change()
returns trigger
language plpgsql
as $$
declare
  request_text text;
  current_actor uuid := app_private.current_uid();
  public_status text := public.citizen_request_public_status_label(new.status);
  summary text;
  action text;
  old_payload jsonb := coalesce(to_jsonb(old), '{}'::jsonb);
  new_payload jsonb := to_jsonb(new);
begin
  if TG_OP = 'UPDATE' then
    old_payload := old_payload - 'updated_at';
    new_payload := new_payload - 'updated_at';

    if old_payload = new_payload then
      return new;
    end if;
  end if;

  if TG_OP = 'INSERT' then
    action := 'submitted';
    summary := 'Request submitted.';
  elsif new.converted_case_id is not null and old.converted_case_id is null then
    action := 'converted';
    summary := 'Request converted to a case.';
  elsif new.status is distinct from old.status then
    action := 'status_changed';
    summary := format('Status updated to %s.', public_status);
  elsif new.priority is distinct from old.priority then
    action := 'priority_changed';
    summary := format('Priority updated to %s.', public.citizen_request_priority_label(new.priority));
  elsif new.assigned_officer_id is distinct from old.assigned_officer_id then
    action := 'assignment_changed';
    summary := 'Assignment updated.';
  elsif new.internal_notes is distinct from old.internal_notes then
    action := 'internal_note_updated';
    summary := 'Internal review notes updated.';
  elsif new.acknowledged_at is distinct from old.acknowledged_at then
    action := 'acknowledged';
    summary := 'Request acknowledged.';
  elsif new.reviewed_at is distinct from old.reviewed_at then
    action := 'reviewed';
    summary := 'Request marked under review.';
  else
    action := 'updated';
    summary := 'Request updated.';
  end if;

  insert into public.citizen_request_activity (
    citizen_request_id,
    action,
    public_status,
    summary,
    actor_user_id,
    metadata
  ) values (
    new.id,
    action,
    public_status,
    summary,
    current_actor,
    jsonb_build_object(
      'request_type', new.request_type,
      'status', new.status,
      'priority', new.priority
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_citizen_requests_after_change on public.citizen_requests;
create trigger trg_citizen_requests_after_change
after insert or update on public.citizen_requests
for each row
execute function public.citizen_request_after_change();

create or replace function app_private.get_active_citizen_posting_scope(uid uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  posting jsonb;
begin
  if to_regclass('public.user_postings') is null or to_regclass('public.organisational_units') is null then
    return null;
  end if;

  select jsonb_build_object(
    'role_code', up.role_code,
    'station_unit_id', station.id,
    'district_unit_id', district.id
  )
  into posting
  from public.user_postings up
  left join public.organisational_units station
    on station.id = up.organisational_unit_id
  left join public.organisational_units subdivision
    on subdivision.id = station.parent_unit_id
  left join public.organisational_units district
    on district.id = subdivision.parent_unit_id
  where up.user_id = uid
    and up.is_active = true
    and up.valid_from <= now()
    and (up.valid_until is null or up.valid_until > now())
  order by coalesce(up.is_primary, false) desc, up.valid_from desc
  limit 1;

  return posting;
end;
$$;

create or replace function public.can_view_citizen_request(target_request_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  uid uuid := app_private.current_uid();
  request_row jsonb;
  scope_row jsonb;
  role_code text;
begin
  if uid is null or target_request_id is null then
    return false;
  end if;

  if to_regclass('public.citizen_requests') is null then
    return false;
  end if;

  select to_jsonb(cr)
  into request_row
  from public.citizen_requests cr
  where cr.id = target_request_id;

  if request_row is null then
    return false;
  end if;

  if coalesce(request_row ->> 'assigned_officer_id', '') = uid::text then
    return true;
  end if;

  if coalesce(request_row ->> 'converted_case_id', '') <> '' and public.can_access_case((request_row ->> 'converted_case_id')::uuid) then
    return true;
  end if;

  scope_row := app_private.get_active_citizen_posting_scope(uid);
  if scope_row is null then
    return false;
  end if;

  role_code := lower(coalesce(scope_row ->> 'role_code', ''));
  if role_code not in ('investigating_officer', 'supervising_officer', 'supervisor', 'station_house_officer') then
    return false;
  end if;

  if coalesce(request_row ->> 'station_unit_id', '') = coalesce(scope_row ->> 'station_unit_id', '') then
    return true;
  end if;

  if coalesce(request_row ->> 'district_unit_id', '') = coalesce(scope_row ->> 'district_unit_id', '') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_manage_citizen_request(target_request_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_view_citizen_request(target_request_id);
$$;

create or replace function public.submit_citizen_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted_row public.citizen_requests;
  request_type text;
  title text;
  description text;
  location_text text;
  incident_date timestamptz;
  contact_preference text;
  contact_value text;
begin
  request_type := nullif(trim(p_request ->> 'request_type'), '');
  title := nullif(trim(p_request ->> 'title'), '');
  description := nullif(trim(p_request ->> 'description'), '');
  location_text := nullif(trim(p_request ->> 'location_text'), '');
  contact_preference := nullif(trim(p_request ->> 'contact_preference'), '');
  contact_value := nullif(trim(p_request ->> 'contact_value'), '');

  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Request body must be an object';
  end if;

  if request_type is null or title is null or description is null then
    raise exception 'Please complete every required field with a non-emergency request.';
  end if;

  if request_type not in (
    'General information request',
    'Suspicious activity report',
    'Lost property report',
    'Community safety concern',
    'Non-emergency incident report'
  ) then
    raise exception 'Invalid request type';
  end if;

  if p_request ? 'incident_date' and nullif(trim(p_request ->> 'incident_date'), '') is not null then
    begin
      incident_date := (p_request ->> 'incident_date')::timestamptz;
    exception when others then
      raise exception 'Invalid incident date';
    end;
  end if;

  insert into public.citizen_requests (
    request_type,
    title,
    description,
    location_text,
    incident_date,
    contact_preference,
    contact_value
  ) values (
    request_type,
    title,
    description,
    location_text,
    incident_date,
    contact_preference,
    contact_value
  )
  returning * into inserted_row;

  return jsonb_build_object(
    'reference', inserted_row.reference,
    'submitted_at', inserted_row.submitted_at,
    'status', inserted_row.status,
    'public_status', public.citizen_request_public_status_label(inserted_row.status),
    'latest_update', 'Request submitted.'
  );
end;
$$;

create or replace function public.track_citizen_request(p_reference text)
returns table(
  reference text,
  request_type text,
  title text,
  public_status text,
  submitted_at timestamptz,
  latest_update text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    cr.reference,
    cr.request_type,
    cr.title,
    public.citizen_request_public_status_label(cr.status) as public_status,
    cr.submitted_at,
    coalesce(latest_activity.summary, public.citizen_request_public_status_label(cr.status) || '.') as latest_update
  from public.citizen_requests cr
  left join lateral (
    select activity.summary
    from public.citizen_request_activity activity
    where activity.citizen_request_id = cr.id
    order by activity.created_at desc
    limit 1
  ) latest_activity on true
  where cr.reference = upper(trim(p_reference));
end;
$$;

revoke all on function public.submit_citizen_request(jsonb) from public;
grant execute on function public.submit_citizen_request(jsonb) to anon, authenticated;

revoke all on function public.track_citizen_request(text) from public;
grant execute on function public.track_citizen_request(text) to anon, authenticated;

do $$
begin
  if to_regclass('public.citizen_requests') is not null then
    execute 'drop policy if exists citizen_requests_select_authorized on public.citizen_requests';
    execute 'create policy citizen_requests_select_authorized on public.citizen_requests for select using (auth.uid() is not null and public.can_view_citizen_request(id))';

    execute 'drop policy if exists citizen_requests_update_authorized on public.citizen_requests';
    execute 'create policy citizen_requests_update_authorized on public.citizen_requests for update using (auth.uid() is not null and public.can_manage_citizen_request(id)) with check (auth.uid() is not null and public.can_manage_citizen_request(id))';
  end if;

  if to_regclass('public.citizen_request_activity') is not null then
    execute 'drop policy if exists citizen_request_activity_select_authorized on public.citizen_request_activity';
    execute 'create policy citizen_request_activity_select_authorized on public.citizen_request_activity for select using (auth.uid() is not null and public.can_view_citizen_request(citizen_request_id))';
  end if;
end $$;

commit;
