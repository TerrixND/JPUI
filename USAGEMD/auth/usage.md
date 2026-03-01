# Auth Usage

Last updated: 2026-03-01

This document is the full auth contract for this backend.

It covers:

- the current app-level auth API
- the required frontend login and signup order
- account-access errors for restricted, banned, suspended, and terminated users
- the difference between backend prechecks and hard provider-level prevention
- the exact Supabase Auth Hook setup recommended for this project

Base API prefix:

- `http://<api-host>/api/v1`

Authentication provider:

- Supabase Auth is the identity provider
- this backend stores the app user in Postgres and applies business-specific access rules

Important architecture rule:

- backend API prechecks improve UX and stop normal frontend flows before sign-in
- they do not by themselves stop Supabase from issuing a session if a client bypasses the precheck
- hard provider-level prevention requires Supabase Auth Hooks

## Current Auth Architecture

Current flow in this project:

1. Frontend calls a public precheck route.
2. If allowed, frontend calls `supabase.auth.signIn*` or `supabase.auth.signUp`.
3. After successful Supabase auth, frontend calls backend sync/bootstrap routes.
4. Protected backend routes use bearer token auth and then apply account-access enforcement.

Important current backend files:

- [auth.controller.js](/D:/Work-Projects/Jade-Palace/Full-Stack/Jade-Palace-API/controllers/auth.controller.js)
- [auth.routes.js](/D:/Work-Projects/Jade-Palace/Full-Stack/Jade-Palace-API/routes/auth.routes.js)
- [auth.middleware.js](/D:/Work-Projects/Jade-Palace/Full-Stack/Jade-Palace-API/middlewares/auth.middleware.js)
- [account-access.middleware.js](/D:/Work-Projects/Jade-Palace/Full-Stack/Jade-Palace-API/middlewares/account-access.middleware.js)
- [account-access.js](/D:/Work-Projects/Jade-Palace/Full-Stack/Jade-Palace-API/utils/account-access.js)

## Response Pattern

Success:

- JSON response with route-specific fields

Error:

```json
{
  "message": "Human readable message",
  "code": "MACHINE_CODE",
  "details": {}
}
```

For account-access errors, `details` can include:

```json
{
  "code": "ACCOUNT_BANNED",
  "status": "BANNED",
  "message": "Your account is banned",
  "blockedScope": "AUTHENTICATION",
  "canAuthenticate": false,
  "canAccessRoleRoutes": false,
  "type": "BAN",
  "restrictionId": "uuid",
  "reason": "Fraud risk",
  "startsAt": "2026-03-01T10:00:00.000Z",
  "endsAt": "2026-03-01T18:00:00.000Z",
  "remainingMs": 28800000,
  "remainingSeconds": 28800,
  "remainingMinutes": 480,
  "remainingHours": 8,
  "isRestricted": false,
  "isBanned": true,
  "isTerminated": false,
  "isSuspended": false
}
```

## Auth Routes

### `POST /api/v1/auth/precheck-login`

Use before any `supabase.auth.signIn*` call.

Auth:

- public

Purpose:

- reject banned accounts before normal frontend login
- reject terminated accounts before normal frontend login
- reject suspended accounts before normal frontend login
- return enough detail for blocked-page UI and countdown UI

Body:

```json
{
  "email": "user@example.com",
  "phone": "+15551234567"
}
```

Notes:

- `email` is required
- `phone` is optional
- if `phone` is present, backend attempts best-effort E.164 normalization for access matching

Success:

```json
{
  "eligible": true,
  "flow": "LOGIN"
}
```

Blocked responses:

- `403 ACCOUNT_BANNED`
- `403 ACCOUNT_TERMINATED`
- `403 ACCOUNT_SUSPENDED`
- `403 CONTACT_BLOCKED`

Frontend rule:

1. Call this first.
2. Only call `supabase.auth.signIn*` if this returns `200`.
3. If blocked, do not attempt sign-in.
4. Show `message` and use `details.remainingMs` for countdown if present.

### `POST /api/v1/auth/precheck-signup`

Use before any signup or setup flow.

Auth:

- public

Purpose:

- detect whether the incoming identity is allowed to continue
- detect whether signup is staff onboarding or normal customer setup
- validate bootstrap-admin eligibility
- reject blocked, banned, terminated, or suspended identities before signup/setup

Body:

```json
{
  "email": "user@example.com",
  "phone": "+15551234567",
  "flow": "SETUP_USER | BOOTSTRAP_ADMIN",
  "bootstrapSecret": "only for bootstrap flow"
}
```

Flow meaning:

- `SETUP_USER`: normal app user setup flow
- `BOOTSTRAP_ADMIN`: one-time main-admin bootstrap
- if omitted, backend infers:
    - `BOOTSTRAP_ADMIN` when bootstrap secret is present
    - otherwise `SETUP_USER`

Success examples:

Customer:

```json
{
  "eligible": true,
  "flow": "SETUP_USER",
  "onboardingType": "CUSTOMER",
  "role": "CUSTOMER"
}
```

Staff:

```json
{
  "eligible": true,
  "flow": "SETUP_USER",
  "onboardingType": "STAFF",
  "role": "ADMIN",
  "permissions": {}
}
```

Bootstrap admin:

```json
{
  "eligible": true,
  "flow": "BOOTSTRAP_ADMIN",
  "onboardingType": "ADMIN_BOOTSTRAP",
  "role": "ADMIN"
}
```

Blocked responses:

- `403 ACCOUNT_BANNED`
- `403 ACCOUNT_TERMINATED`
- `403 ACCOUNT_SUSPENDED`
- `403 CONTACT_BLOCKED`

Frontend rule:

1. Always call this before signup/setup.
2. If blocked, do not call Supabase signup.
3. For staff setup, if a phone is required by onboarding, pass it here before showing the final setup form.

### `POST /api/v1/auth/bootstrap-admin`

Use only once to create the first main admin.

Auth:

- required bearer token

Purpose:

- create the first main admin app record after Supabase auth

Body:

```json
{
  "displayName": "Main Admin",
  "phone": "+15551234567",
  "lineId": "line-id",
  "note": "Bootstrap super admin",
  "bootstrapSecret": "optional if sent in header earlier"
}
```

Success:

- `200` if already synced to same Supabase user
- `201` if newly created

### `POST /api/v1/auth/setup-user`

Use after Supabase auth when app-level user record is needed.

Auth:

- required bearer token

Purpose:

- create or sync staff user records
- create or sync customer user records
- apply onboarding rules for staff
- reject blocked identities if precheck was skipped

Customer body example:

```json
{
  "displayName": "Customer Name",
  "phone": "+15551234567",
  "lineId": "line-id",
  "preferredLanguage": "en",
  "city": "Bangkok"
}
```

Staff body example:

```json
{
  "displayName": "Staff Name",
  "phone": "+15551234567",
  "lineId": "line-id"
}
```

Success:

- `200` if existing app user was returned
- `201` if a new app user was created

### `GET /api/v1/user/me`

Use after successful auth and on every app boot.

Auth:

- required bearer token

Purpose:

- get the current app user
- get current role and status
- get current account-access state

Success example:

```json
{
  "id": "uuid",
  "supabaseUserId": "supabase-uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "status": "ACTIVE",
  "isMainAdmin": false,
  "accountAccess": null
}
```

Blocked example:

```json
{
  "message": "Your account is banned",
  "code": "ACCOUNT_BANNED",
  "details": {
    "message": "Your account is banned",
    "blockedScope": "AUTHENTICATION",
    "canAuthenticate": false,
    "remainingMs": 3600000
  }
}
```

## Canonical Frontend Flows

### Login Flow

Required order:

1. Collect login form values.
2. Call `POST /api/v1/auth/precheck-login`.
3. If precheck returns `200`, call `supabase.auth.signInWithPassword` or the relevant Supabase sign-in method.
4. If Supabase returns a session, call `GET /api/v1/user/me`.
5. If `GET /api/v1/user/me` returns an account-access block, immediately clear local session and show blocked UI.
6. If allowed, continue into the app.

Minimal frontend pseudocode:

```ts
async function login(values: { email: string; password: string; phone?: string }) {
  await apiFetch("/api/v1/auth/precheck-login", {
    method: "POST",
    body: JSON.stringify({
      email: values.email,
      phone: values.phone ?? null,
    }),
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) throw error;

  try {
    await apiFetch("/api/v1/user/me");
  } catch (error: any) {
    if (["ACCOUNT_BANNED", "ACCOUNT_TERMINATED", "ACCOUNT_SUSPENDED"].includes(error.code)) {
      await supabase.auth.signOut();
    }
    throw error;
  }

  return data;
}
```

### Signup / Setup Flow

Required order:

1. Collect signup/setup values.
2. Call `POST /api/v1/auth/precheck-signup`.
3. If allowed, call the relevant Supabase signup method.
4. After Supabase signup or sign-in confirmation, call `POST /api/v1/auth/setup-user`.
5. Then call `GET /api/v1/user/me`.

### Main Admin Bootstrap Flow

Required order:

1. Collect bootstrap secret and admin details.
2. Call `POST /api/v1/auth/precheck-signup` with `flow: "BOOTSTRAP_ADMIN"`.
3. If allowed, complete Supabase auth.
4. Call `POST /api/v1/auth/bootstrap-admin`.
5. Call `GET /api/v1/user/me`.

## Current Account-Access Rules

This backend currently treats the following as login-blocking states:

- `ACCOUNT_BANNED`
- `ACCOUNT_TERMINATED`
- `ACCOUNT_SUSPENDED`

This backend currently treats the following as role-route blocking but not login-blocking:

- `ACCOUNT_RESTRICTED`

Current sources of blocking:

- direct `User.status`
- active `UserAccessRestriction` rows of type `BAN`
- blocked contacts in `BlockedContact`

Important current storage detail:

- termination is stored as both:
    - `User.status = TERMINATED`
    - an active `UserAccessRestriction` of type `BAN` with metadata key `isTerminationAction = true`

## Why API Precheck Alone Is Not Enough

Backend precheck helps normal frontend behavior, but it is not a hard IdP block.

If a client skips:

- `POST /api/v1/auth/precheck-login`
- or `POST /api/v1/auth/precheck-signup`

then Supabase can still create a session or user first, and this backend will only reject access on later API calls.

This is why hard provider-level prevention must be implemented inside Supabase Auth itself.

## Hard Provider-Level Prevention

Recommended final model:

1. Keep backend prechecks for rich UI messages and countdown data.
2. Add a Supabase `Before User Created` hook to reject unwanted signups before Auth creates the user.
3. Add a Supabase `Custom Access Token` hook to reject token issuance and refresh for banned, terminated, or suspended accounts.
4. If your project plan supports it and you use password login, add a `Password Verification` hook to reject password login attempts even earlier.
5. On ban or termination, revoke refresh tokens / sign out sessions and keep JWT expiry short, because already-issued access tokens remain valid until expiry.

### What Each Hook Solves

`Before User Created` hook:

- stops new signup before Auth creates the user
- best for:
    - blocked contacts
    - banned email or phone reuse
    - terminated account re-signup attempts

`Custom Access Token` hook:

- runs before a token is issued
- blocks new access token issuance and token refresh
- best for:
    - banned app users
    - terminated app users
    - suspended app users

`Password Verification` hook:

- runs on password sign-in attempts
- can explicitly reject password auth attempts
- useful if you want a password-specific hard stop
- currently plan-limited in Supabase docs

### Important Limitation Even After Hooks

Per Supabase docs, revoked sessions lose refresh tokens immediately, but already-issued access tokens remain valid until the JWT `exp` time.

That means:

- hard-provider prevention blocks new token issuance and refresh
- it does not magically invalidate a JWT that was already issued a few minutes ago

So after enabling hooks, you should also:

1. keep backend `/user/me` enforcement
2. revoke refresh tokens / sign out sessions when banning or terminating
3. reduce JWT lifetime in Supabase Auth settings to a short window that matches your risk tolerance

Recommended practical JWT lifetime:

- `5` to `15` minutes for stronger lockout behavior

## Supabase Hook Implementation Plan

This section describes exactly what to do in Supabase.

### Tables Read By Hook Logic

These examples read the current Prisma-managed tables:

- `public."User"`
- `public."UserAccessRestriction"`
- `public."BlockedContact"`
- `public."AdminProfile"`
- `public."ManagerProfile"`
- `public."SalespersonProfile"`
- `public."CustomerProfile"`

Important note:

- Prisma created quoted table and column names
- keep the double quotes in SQL examples below

### Step 1. Create the `Before User Created` Hook Function

Use this to block signups before the Auth user is created.

```sql
create or replace function public.before_user_created_block_account(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  incoming_email text := lower(nullif(event->'user'->>'email', ''));
  incoming_phone text := nullif(event->'user'->>'phone', '');
  matched_status text;
  matched_reason text;
  matched_is_termination boolean := false;
begin
  if exists (
    select 1
    from public."BlockedContact" bc
    where
      (incoming_email is not null and bc.email is not null and lower(bc.email) = incoming_email)
      or (incoming_phone is not null and bc.phone = incoming_phone)
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This contact is blocked'
      )
    );
  end if;

  select
    u.status::text,
    r.reason,
    coalesce((r.metadata ->> 'isTerminationAction')::boolean, false)
  into
    matched_status,
    matched_reason,
    matched_is_termination
  from public."User" u
  left join lateral (
    select
      ur.reason,
      ur.metadata,
      ur."startsAt"
    from public."UserAccessRestriction" ur
    where
      ur."userId" = u.id
      and ur.type = 'BAN'
      and ur."isActive" = true
      and ur."liftedAt" is null
      and ur."startsAt" <= now()
      and (ur."endsAt" is null or ur."endsAt" > now())
    order by ur."startsAt" desc
    limit 1
  ) r on true
  left join public."AdminProfile" ap on ap."userId" = u.id
  left join public."ManagerProfile" mp on mp."userId" = u.id
  left join public."SalespersonProfile" sp on sp."userId" = u.id
  left join public."CustomerProfile" cp on cp."userId" = u.id
  where
    (incoming_email is not null and u.email is not null and lower(u.email) = incoming_email)
    or (
      incoming_phone is not null
      and (
        ap.phone = incoming_phone
        or mp.phone = incoming_phone
        or sp.phone = incoming_phone
        or cp.phone = incoming_phone
      )
    )
  order by
    case
      when coalesce((r.metadata ->> 'isTerminationAction')::boolean, false) then 4
      when u.status = 'TERMINATED' then 3
      when r.reason is not null or u.status = 'BANNED' then 2
      when u.status = 'SUSPENDED' then 1
      else 0
    end desc
  limit 1;

  if matched_is_termination or matched_status = 'TERMINATED' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account has been terminated'
      )
    );
  end if;

  if matched_reason is not null or matched_status = 'BANNED' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account is banned'
      )
    );
  end if;

  if matched_status = 'SUSPENDED' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account is suspended'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;
```

### Step 2. Create the `Custom Access Token` Hook Function

Use this to stop token issuance and refresh for blocked app users.

```sql
create or replace function public.custom_access_token_block_account(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  auth_user_id uuid := (event->>'user_id')::uuid;
  app_user_id uuid;
  app_user_status text;
  active_ban_reason text;
  active_ban_is_termination boolean := false;
begin
  select
    u.id,
    u.status::text
  into
    app_user_id,
    app_user_status
  from public."User" u
  where u."supabaseUserId" = auth_user_id;

  if app_user_id is null then
    return jsonb_build_object('claims', event->'claims');
  end if;

  if app_user_status = 'TERMINATED' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account has been terminated'
      )
    );
  end if;

  if app_user_status = 'SUSPENDED' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account is suspended'
      )
    );
  end if;

  select
    ur.reason,
    coalesce((ur.metadata ->> 'isTerminationAction')::boolean, false)
  into
    active_ban_reason,
    active_ban_is_termination
  from public."UserAccessRestriction" ur
  where
    ur."userId" = app_user_id
    and ur.type = 'BAN'
    and ur."isActive" = true
    and ur."liftedAt" is null
    and ur."startsAt" <= now()
    and (ur."endsAt" is null or ur."endsAt" > now())
  order by ur."startsAt" desc
  limit 1;

  if active_ban_is_termination then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account has been terminated'
      )
    );
  end if;

  if active_ban_reason is not null or app_user_status = 'BANNED' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Your account is banned'
      )
    );
  end if;

  return jsonb_build_object('claims', event->'claims');
end;
$$;
```

### Step 3. Optional `Password Verification` Hook

Use this only if:

- your plan supports it
- password login is part of your main auth flow
- you want an additional password-login-specific hard stop

Example:

```sql
create or replace function public.password_verification_block_account(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  auth_user_id uuid := (event->>'user_id')::uuid;
  app_user_id uuid;
  app_user_status text;
  active_ban_reason text;
  active_ban_is_termination boolean := false;
begin
  if coalesce((event->>'valid')::boolean, false) = false then
    return jsonb_build_object('decision', 'continue');
  end if;

  select
    u.id,
    u.status::text
  into
    app_user_id,
    app_user_status
  from public."User" u
  where u."supabaseUserId" = auth_user_id;

  if app_user_id is null then
    return jsonb_build_object('decision', 'continue');
  end if;

  select
    ur.reason,
    coalesce((ur.metadata ->> 'isTerminationAction')::boolean, false)
  into
    active_ban_reason,
    active_ban_is_termination
  from public."UserAccessRestriction" ur
  where
    ur."userId" = app_user_id
    and ur.type = 'BAN'
    and ur."isActive" = true
    and ur."liftedAt" is null
    and ur."startsAt" <= now()
    and (ur."endsAt" is null or ur."endsAt" > now())
  order by ur."startsAt" desc
  limit 1;

  if active_ban_is_termination or app_user_status = 'TERMINATED' then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Your account has been terminated',
      'should_logout_user', true
    );
  end if;

  if active_ban_reason is not null or app_user_status = 'BANNED' then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Your account is banned',
      'should_logout_user', true
    );
  end if;

  if app_user_status = 'SUSPENDED' then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Your account is suspended',
      'should_logout_user', true
    );
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;
```

### Step 4. Grant Hook Permissions

At minimum, grant `supabase_auth_admin` access to execute the functions and read the tables they use.

```sql
grant usage on schema public to supabase_auth_admin;

grant execute on function public.before_user_created_block_account(jsonb) to supabase_auth_admin;
grant execute on function public.custom_access_token_block_account(jsonb) to supabase_auth_admin;
grant execute on function public.password_verification_block_account(jsonb) to supabase_auth_admin;

revoke execute on function public.before_user_created_block_account(jsonb) from authenticated, anon, public;
revoke execute on function public.custom_access_token_block_account(jsonb) from authenticated, anon, public;
revoke execute on function public.password_verification_block_account(jsonb) from authenticated, anon, public;

grant select on table public."User" to supabase_auth_admin;
grant select on table public."UserAccessRestriction" to supabase_auth_admin;
grant select on table public."BlockedContact" to supabase_auth_admin;
grant select on table public."AdminProfile" to supabase_auth_admin;
grant select on table public."ManagerProfile" to supabase_auth_admin;
grant select on table public."SalespersonProfile" to supabase_auth_admin;
grant select on table public."CustomerProfile" to supabase_auth_admin;
```

If you are not enabling the password hook:

- omit the password-hook `grant execute` and `revoke execute` statements above

If any of those tables use RLS:

- add `select` policies for `supabase_auth_admin`
- or redesign so the hook reads from a dedicated projection table with simpler permissions

### Step 5. Enable the Hooks in Supabase Dashboard

In Supabase Dashboard:

1. Open `Authentication`.
2. Open `Hooks`.
3. Enable `Before User Created`.
4. Select the Postgres function `public.before_user_created_block_account`.
5. Enable `Custom Access Token`.
6. Select the Postgres function `public.custom_access_token_block_account`.
7. If available on your plan and desired, enable `Password Verification`.
8. Select the Postgres function `public.password_verification_block_account`.

### Step 6. Keep Backend Prechecks Even After Hooks

Do not remove:

- `POST /api/v1/auth/precheck-login`
- `POST /api/v1/auth/precheck-signup`
- `GET /api/v1/user/me` enforcement

Reason:

- Supabase hook errors block the provider flow
- backend prechecks still provide richer UX data such as remaining ban time and structured account-access details
- hook failures should be handled by frontend as provider errors, not as the full backend `details` payload contract

### Step 7. Revoke Sessions on Ban / Termination

When an account is banned or terminated:

1. keep writing the app-level ban/termination state as you do now
2. revoke refresh tokens / terminate active sessions
3. force frontend sign-out when blocked
4. keep JWT expiry short

Why:

- Supabase docs state that revoked sessions lose refresh tokens immediately
- already-issued access tokens remain valid until their expiry

This means provider-level prevention is strongest when combined with:

- short JWT expiry
- backend `/user/me` enforcement
- session revocation on admin action

## Recommended Final Auth Policy For This Project

Recommended production rule set:

1. Frontend must always call `precheck-login` before any login attempt.
2. Frontend must always call `precheck-signup` before any signup/setup attempt.
3. Supabase `Before User Created` hook must be enabled in production.
4. Supabase `Custom Access Token` hook must be enabled in production.
5. `Password Verification` hook should be enabled if plan and auth method support it.
6. Backend `authorize` middleware must remain in place as defense-in-depth.
7. `/api/v1/user/me` must remain the final app-truth endpoint after session creation.

## Testing Checklist

### Login / Ban

1. Ban an account for 8 hours.
2. Call `POST /api/v1/auth/precheck-login`.
3. Confirm it returns `403 ACCOUNT_BANNED` with countdown fields.
4. Attempt direct Supabase password sign-in from a test client.
5. Confirm the provider-level hook blocks it.
6. If a session existed before the ban, confirm refresh is blocked and backend `/api/v1/user/me` also blocks access.

### Termination

1. Terminate an account.
2. Confirm `precheck-login` returns `403 ACCOUNT_TERMINATED`.
3. Confirm new signup with same identity is blocked by `Before User Created`.
4. Confirm token issuance/refresh is blocked by `Custom Access Token`.

### Suspension

1. Set user status to `SUSPENDED`.
2. Confirm `precheck-login` returns `403 ACCOUNT_SUSPENDED`.
3. Confirm token issuance/refresh is blocked.

### Customer Signup

1. Ban or terminate a customer identity by email or phone.
2. Call `precheck-signup`.
3. Confirm signup is blocked.
4. Attempt direct Supabase signup.
5. Confirm `Before User Created` blocks the signup.

## Supabase Documentation References

Official Supabase docs used for the hard-prevention plan:

- Auth Hooks overview: https://supabase.com/docs/guides/auth/auth-hooks
- Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Before User Created Hook: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- Password Verification Hook: https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook
- JWT behavior: https://supabase.com/docs/guides/auth/jwts
- Sign out and revoked-session behavior: https://supabase.com/docs/guides/auth/signout

## Bottom Line

If you want true hard prevention:

- keep backend prechecks for UX
- add Supabase hooks for hard enforcement
- revoke sessions on ban/termination
- shorten JWT expiry

That combination gives you:

- friendly blocked-page UI before auth
- provider-level denial when a client bypasses your API
- continued backend protection for stale or already-issued tokens
