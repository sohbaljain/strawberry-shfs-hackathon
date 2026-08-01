-- Investigating Officer operationalization migration
-- Adds transactional RPCs and RLS helper functions/policies for case creation,
-- assignment-scoped access, and analysis version persistence.

begin;

create schema if not exists app_private;

create or replace function app_private.current_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app_private.jsonb_text(source jsonb, key_name text)
returns text
language sql
immutable
as $$
  select nullif(trim(source ->> key_name), '');
$$;

create or replace function app_private.try_uuid(raw text)
returns uuid
language plpgsql
immutable
as $$
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  begin
    return raw::uuid;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function app_private.try_bool(raw text)
returns boolean
language sql
immutable
as $$
  select case
    when raw is null then null
    when lower(trim(raw)) in ('true', 't', '1', 'yes', 'y') then true
    when lower(trim(raw)) in ('false', 'f', '0', 'no', 'n') then false
    else null
  end;
$$;

create or replace function app_private.try_timestamptz(raw text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  begin
    return raw::timestamptz;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function app_private.is_row_owned_by_uid(row_data jsonb, uid uuid)
returns boolean
language sql
immutable
as $$
  select coalesce(row_data ->> 'user_id', '') = uid::text
    or coalesce(row_data ->> 'auth_user_id', '') = uid::text
    or coalesce(row_data ->> 'assigned_user_id', '') = uid::text
    or coalesce(row_data ->> 'assigned_to_user_id', '') = uid::text
    or coalesce(row_data ->> 'officer_id', '') = uid::text
    or coalesce(row_data ->> 'owner_id', '') = uid::text
    or coalesce(row_data ->> 'profile_id', '') = uid::text
    or coalesce(row_data ->> 'id', '') = uid::text;
$$;

create or replace function app_private.has_active_profile(uid uuid)
returns boolean
language plpgsql
stable
as $$
declare
  profile_exists boolean := false;
begin
  if to_regclass('public.profiles') is null then
    return false;
  end if;

  execute $sql$
    select exists(
      select 1
      from public.profiles p
      where app_private.is_row_owned_by_uid(to_jsonb(p), $1)
        and coalesce(lower(to_jsonb(p) ->> 'status'), 'active') in ('active', 'enabled')
    )
  $sql$
  into profile_exists
  using uid;

  return coalesce(profile_exists, false);
end;
$$;

create or replace function app_private.get_active_posting(uid uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  posting jsonb;
  active_uid uuid := uid;
begin
  if to_regclass('public.user_postings') is null then
    return null;
  end if;

  if to_regclass('public.organisational_units') is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', up.id,
    'user_id', up.user_id,
    'organisational_unit_id', up.organisational_unit_id,
    'role_code', up.role_code,
    'posting_title', up.posting_title,
    'valid_from', up.valid_from,
    'valid_until', up.valid_until,
    'is_primary', up.is_primary,
    'is_active', up.is_active,
    'station_unit_id', station.id,
    'subdivision_unit_id', subdivision.id,
    'district_unit_id', district.id,
    'state_unit_id', state.id
  )
  into posting
  from public.user_postings up
  left join public.organisational_units station
    on station.id = up.organisational_unit_id
  left join public.organisational_units subdivision
    on subdivision.id = station.parent_unit_id
  left join public.organisational_units district
    on district.id = subdivision.parent_unit_id
  left join public.organisational_units state
    on state.id = district.parent_unit_id
  where up.user_id = active_uid
    and up.is_active = true
    and up.valid_from <= now()
    and (up.valid_until is null or up.valid_until > now())
  order by coalesce(up.is_primary, false) desc, up.valid_from desc
  limit 1;

  if posting is not null then
    return posting;
  end if;

  return null;
end;
$$;

create or replace function public.can_create_case()
returns boolean
language plpgsql
stable
as $$
declare
  uid uuid := app_private.current_uid();
  posting jsonb;
  role_text text;
begin
  if uid is null then
    return false;
  end if;

  if not app_private.has_active_profile(uid) then
    return false;
  end if;

  posting := app_private.get_active_posting(uid);
  if posting is null then
    return false;
  end if;

  role_text := lower(coalesce(posting ->> 'role', posting ->> 'role_code', posting ->> 'posting_role', ''));

  return role_text in (
    'investigating_officer',
    'supervising_officer',
    'supervisor',
    'station_house_officer'
  );
end;
$$;

create or replace function public.can_access_case(target_case_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  uid uuid := app_private.current_uid();
  posting jsonb;
  case_access boolean := false;
begin
  if uid is null or target_case_id is null then
    return false;
  end if;

  if not app_private.has_active_profile(uid) then
    return false;
  end if;

  posting := app_private.get_active_posting(uid);
  if posting is null then
    return false;
  end if;

  if to_regclass('public.case_assignments') is null then
    return false;
  end if;

  execute $sql$
    select exists(
      select 1
      from public.case_assignments ca
      where coalesce(app_private.try_uuid(to_jsonb(ca) ->> 'case_id'), '00000000-0000-0000-0000-000000000000'::uuid) = $1
        and app_private.is_row_owned_by_uid(to_jsonb(ca), $2)
        and coalesce(lower(to_jsonb(ca) ->> 'status'), 'active') not in ('inactive', 'ended', 'closed')
        and coalesce(app_private.try_bool(to_jsonb(ca) ->> 'active'), true)
        and coalesce(app_private.try_bool(to_jsonb(ca) ->> 'is_active'), true)
        and (
          to_jsonb(ca) ->> 'ends_at' is null
          or app_private.try_timestamptz(to_jsonb(ca) ->> 'ends_at') > now()
        )
    )
  $sql$
  into case_access
  using target_case_id, uid;

  return coalesce(case_access, false);
end;
$$;

create or replace function public.can_verify_case(target_case_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_access_case(target_case_id);
$$;

create or replace function public.create_investigation_case(p_case_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := app_private.current_uid();
  posting jsonb;
  district_unit_id uuid;
  station_unit_id uuid;
  posting_station_unit_id uuid;
  station_parent_unit_id uuid;
  subdivision_unit_id uuid;
  subdivision_parent_unit_id uuid;
  case_insert jsonb;
  assignment_insert jsonb;
  activity_insert jsonb;
  inserted_case_id uuid;
  inserted_case_reference text;
  case_reference text;
  case_title text;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_create_case() then
    raise exception 'Not authorised to create case';
  end if;

  posting := app_private.get_active_posting(uid);
  if posting is null then
    raise exception 'Active posting required';
  end if;

  posting_station_unit_id := app_private.try_uuid(posting ->> 'organisational_unit_id');

  if posting_station_unit_id is null then
    raise exception 'Active posting is missing district or station scope';
  end if;

  select ou.id, ou.parent_unit_id
  into station_unit_id, station_parent_unit_id
  from public.organisational_units ou
  where ou.id = posting_station_unit_id;

  if station_unit_id is null then
    raise exception 'Active posting is missing district or station scope';
  end if;

  if station_parent_unit_id is null then
    raise exception 'Active posting is missing district or station scope';
  end if;

  select ou.id, ou.parent_unit_id
  into subdivision_unit_id, subdivision_parent_unit_id
  from public.organisational_units ou
  where ou.id = station_parent_unit_id;

  if subdivision_unit_id is null or subdivision_parent_unit_id is null then
    raise exception 'Active posting is missing district or station scope';
  end if;

  select ou.id
  into district_unit_id
  from public.organisational_units ou
  where ou.id = subdivision_parent_unit_id;

  if district_unit_id is null or station_unit_id is null then
    raise exception 'Active posting is missing district or station scope';
  end if;

  case_reference := coalesce(
    app_private.jsonb_text(p_case_payload #> '{caseIdentification}', 'fictionalCaseNumber'),
    app_private.jsonb_text(p_case_payload, 'case_reference')
  );

  case_title := coalesce(
    app_private.jsonb_text(p_case_payload #> '{caseNarrative}', 'incidentSummary'),
    app_private.jsonb_text(p_case_payload, 'title'),
    'Fictional case record'
  );

  case_insert := jsonb_build_object(
    'case_reference', case_reference,
    'title', left(case_title, 280),
    'district_unit_id', district_unit_id,
    'station_unit_id', station_unit_id,
    'created_by', uid,
    'case_input', p_case_payload
  );

  insert into public.cases
  select *
  from jsonb_populate_record(null::public.cases, case_insert)
  returning id, coalesce(case_reference, id::text)
  into inserted_case_id, inserted_case_reference;

  if inserted_case_id is null then
    raise exception 'Case insert failed';
  end if;

  assignment_insert := jsonb_build_object(
    'case_id', inserted_case_id,
    'user_id', uid,
    'auth_user_id', uid,
    'assigned_user_id', uid,
    'assigned_to_user_id', uid,
    'officer_id', uid,
    'is_primary', true,
    'primary_assignment', true,
    'active', true,
    'is_active', true,
    'status', 'active',
    'assigned_at', now(),
    'starts_at', now(),
    'created_by', uid
  );

  insert into public.case_assignments
  select *
  from jsonb_populate_record(null::public.case_assignments, assignment_insert);

  activity_insert := jsonb_build_object(
    'case_id', inserted_case_id,
    'action', 'case_created',
    'summary', format('Case %s created by assigned officer.', coalesce(inserted_case_reference, inserted_case_id::text)),
    'source', 'case_creation',
    'created_by', uid,
    'actor', uid,
    'event_at', now(),
    'occurred_at', now(),
    'timestamp', now()
  );

  insert into public.case_activity
  select *
  from jsonb_populate_record(null::public.case_activity, activity_insert);

  return jsonb_build_object(
    'case_id', inserted_case_id,
    'case_reference', inserted_case_reference
  );
end;
$$;

revoke all on function public.create_investigation_case(jsonb) from public;
grant execute on function public.create_investigation_case(jsonb) to authenticated;

create or replace function public.save_case_analysis_version(
  p_case_id uuid,
  p_report jsonb,
  p_source text default 'gemini',
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := app_private.current_uid();
  latest_version integer := 0;
  insert_payload jsonb;
  inserted_row jsonb;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_access_case(p_case_id) then
    raise exception 'Not authorised for this case';
  end if;

  select coalesce(max((to_jsonb(ca) ->> 'version')::integer), 0)
  into latest_version
  from public.case_analyses ca
  where coalesce(app_private.try_uuid(to_jsonb(ca) ->> 'case_id'), '00000000-0000-0000-0000-000000000000'::uuid) = p_case_id;

  insert_payload := jsonb_build_object(
    'case_id', p_case_id,
    'version', latest_version + 1,
    'analysis_json', p_report,
    'report_json', p_report,
    'structured_json', p_report,
    'structured_output', p_report,
    'response', p_report,
    'source', p_source,
    'model', p_model,
    'verification_status', 'unverified',
    'validated', false,
    'generated_at', now(),
    'created_by', uid,
    'created_at', now(),
    'updated_at', now()
  );

  insert into public.case_analyses
  select *
  from jsonb_populate_record(null::public.case_analyses, insert_payload)
  returning to_jsonb(case_analyses.*)
  into inserted_row;

  return jsonb_build_object(
    'id', inserted_row ->> 'id',
    'case_id', inserted_row ->> 'case_id',
    'version', inserted_row ->> 'version',
    'generated_at', inserted_row ->> 'generated_at',
    'verification_status', inserted_row ->> 'verification_status',
    'analysis', coalesce(inserted_row -> 'analysis_json', inserted_row -> 'report_json', inserted_row -> 'structured_json')
  );
end;
$$;

revoke all on function public.save_case_analysis_version(uuid, jsonb, text, text) from public;
grant execute on function public.save_case_analysis_version(uuid, jsonb, text, text) to authenticated;

create or replace function public.enforce_case_analysis_verification_columns()
returns trigger
language plpgsql
as $$
declare
  allowed_keys text[] := array[
    'verification_status',
    'verified_by',
    'verified_at',
    'updated_at'
  ];
  old_clean jsonb;
  new_clean jsonb;
begin
  if auth.uid() is null then
    return new;
  end if;

  old_clean := to_jsonb(old);
  new_clean := to_jsonb(new);

  old_clean := old_clean - allowed_keys;
  new_clean := new_clean - allowed_keys;

  if old_clean <> new_clean then
    raise exception 'Only verification fields may be updated in this path';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_case_analyses_verify_columns on public.case_analyses;
create trigger trg_case_analyses_verify_columns
before update on public.case_analyses
for each row
execute function public.enforce_case_analysis_verification_columns();

-- Enable RLS where relevant.
alter table if exists public.cases enable row level security;
alter table if exists public.case_assignments enable row level security;
alter table if exists public.case_actions enable row level security;
alter table if exists public.case_activity enable row level security;
alter table if exists public.case_analyses enable row level security;
alter table if exists public.forensic_requests enable row level security;
alter table if exists public.forensic_responses enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.user_postings enable row level security;
alter table if exists public.organisational_units enable row level security;

-- Cases policies
DO $$
BEGIN
  IF to_regclass('public.cases') IS NOT NULL THEN
    execute 'drop policy if exists cases_select_assigned on public.cases';
    execute 'create policy cases_select_assigned on public.cases for select using (public.can_access_case(id))';

    execute 'drop policy if exists cases_insert_authorized on public.cases';
    execute 'create policy cases_insert_authorized on public.cases for insert with check (public.can_create_case())';

    execute 'drop policy if exists cases_update_assigned on public.cases';
    execute 'create policy cases_update_assigned on public.cases for update using (public.can_access_case(id)) with check (public.can_access_case(id))';
  END IF;
END $$;

-- Case assignment policies
DO $$
BEGIN
  IF to_regclass('public.case_assignments') IS NOT NULL THEN
    execute 'drop policy if exists case_assignments_select_assigned on public.case_assignments';
    execute 'create policy case_assignments_select_assigned on public.case_assignments for select using (public.can_access_case(case_id))';

    execute 'drop policy if exists case_assignments_insert_authorized on public.case_assignments';
    execute 'create policy case_assignments_insert_authorized on public.case_assignments for insert with check (public.can_create_case() and public.can_access_case(case_id))';
  END IF;
END $$;

-- Shared case-scoped read policies
DO $$
DECLARE
  table_name text;
  scoped_tables text[] := array['case_actions', 'case_activity', 'case_analyses', 'forensic_requests', 'forensic_responses'];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    execute format('drop policy if exists %I_select_assigned on public.%I', table_name, table_name);
    execute format('create policy %I_select_assigned on public.%I for select using (public.can_access_case(case_id))', table_name, table_name);
  END LOOP;
END $$;

-- Case analyses verification update policy
DO $$
BEGIN
  IF to_regclass('public.case_analyses') IS NOT NULL THEN
    execute 'drop policy if exists case_analyses_update_verify on public.case_analyses';
    execute 'create policy case_analyses_update_verify on public.case_analyses for update using (public.can_verify_case(case_id)) with check (public.can_verify_case(case_id))';

    execute 'drop policy if exists case_analyses_insert_assigned on public.case_analyses';
    execute 'create policy case_analyses_insert_assigned on public.case_analyses for insert with check (public.can_access_case(case_id))';
  END IF;
END $$;

-- Read-only profile/posting/unit protections for officers
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    execute 'drop policy if exists profiles_select_self on public.profiles';
    execute 'create policy profiles_select_self on public.profiles for select using (app_private.is_row_owned_by_uid(to_jsonb(profiles), auth.uid()))';
  END IF;

  IF to_regclass('public.user_postings') IS NOT NULL THEN
    execute 'drop policy if exists user_postings_select_self on public.user_postings';
    execute 'create policy user_postings_select_self on public.user_postings for select using (app_private.is_row_owned_by_uid(to_jsonb(user_postings), auth.uid()))';
  END IF;

  IF to_regclass('public.organisational_units') IS NOT NULL THEN
    execute 'drop policy if exists organisational_units_read_all_authenticated on public.organisational_units';
    execute 'create policy organisational_units_read_all_authenticated on public.organisational_units for select using (auth.uid() is not null)';
  END IF;
END $$;

commit;
