-- Little Date production-oriented schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-f0-9]{20}$'),
  mode text not null check (mode in ('custom','surprise')),
  sender text not null check (char_length(sender) between 1 and 60),
  recipient text not null check (char_length(recipient) between 1 and 60),
  place text, date date, time text, bring text, "then" text,
  theme text not null default 'midnight' check(theme in ('midnight','pastel','rose','minimal','starlight')),
  no_dodge boolean not null default false,
  status text not null default 'pending' check(status in ('pending','planning','yes','no')),
  response_date date, response_time text, response_place text, response_bring text, response_then text,
  is_paid boolean not null default false,
  payment_order_id text unique,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint paid_invitation_expiry check (not is_paid or (paid_at is not null and expires_at is not null))
);
alter table public.invitations add column if not exists no_dodge boolean not null default false;
alter table public.invitations add column if not exists response_time text;
alter table public.invitations add column if not exists is_paid boolean not null default false;
alter table public.invitations add column if not exists payment_order_id text unique;
alter table public.invitations add column if not exists paid_at timestamptz;
alter table public.invitations add column if not exists expires_at timestamptz;
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to anon, authenticated;
drop policy if exists "anon can create invitations" on public.invitations;
drop policy if exists "anon can read invitations" on public.invitations;
drop policy if exists "anon can update invitations" on public.invitations;
drop policy if exists "public can read active paid invitations" on public.invitations;
create policy "public can read active paid invitations" on public.invitations for select to anon, authenticated using (is_paid = true and expires_at > now());

create or replace function public.submit_invitation_response(p_slug text, p_response text)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if p_response is null or p_response not in ('yes','no') then return false; end if;
  update invitations set status = case when p_response = 'yes' and mode = 'surprise' then 'planning' else p_response end
  where slug = p_slug and is_paid = true and expires_at > now() and status = 'pending';
  get diagnostics changed = row_count;
  return changed = 1;
end; $$;

drop function if exists public.submit_surprise_plan(text,date,text,text,text);
create or replace function public.submit_surprise_plan(p_slug text, p_date date, p_time text, p_place text, p_bring text, p_then text)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if p_date is null or p_date < current_date or p_time is null or p_time not in ('10:00 AM','12:00 PM','2:00 PM','4:00 PM','6:00 PM','7:00 PM','8:00 PM') or p_place is null or p_place not in ('Sushi','Pizza','Pasta','Burgers','Korean food','Dessert')
    or p_bring is null or p_bring not in ('Flowers','Something sweet','A playlist','Just me')
    or p_then is null or p_then not in ('Dessert','Stargazing','A drive','Not going home') then return false; end if;
  update invitations set status='yes', response_date=p_date, response_time=p_time, response_place=p_place, response_bring=p_bring, response_then=p_then
  where slug=p_slug and mode='surprise' and status='planning' and is_paid=true and expires_at>now();
  get diagnostics changed = row_count;
  return changed = 1;
end; $$;
revoke all on function public.submit_invitation_response(text,text) from public;
revoke all on function public.submit_surprise_plan(text,date,text,text,text,text) from public;
grant execute on function public.submit_invitation_response(text,text) to anon, authenticated;
grant execute on function public.submit_surprise_plan(text,date,text,text,text,text) to anon, authenticated;
