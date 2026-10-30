# REST API (`/api/v1`)

Base URL: `http://localhost:1002/api/v1` (adjust for deployment).

Admin endpoints expect header: `Authorization: Bearer <accessToken>` unless noted.

## Auth

| Method | Path | Body | Notes |
|--------|------|------|--------|
| POST | `/auth/login` | `{ email, password, slug? }` or `{ email, password, organizationId? }` | One of `slug` or `organizationId` required. Returns `organization`, `accessToken`, `refreshToken`, `admin` |
| POST | `/auth/refresh` | `{ refreshToken }` | Returns new `accessToken` |
| POST | `/auth/logout` | — | Protected; invalidates refresh chain |

## Organizations (super_admin only, except lookup)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/organizations/lookup/:slug` | **Public** — returns `{ id, name, slug }` for login |
| GET | `/organizations` | List all firms; each item includes `adminCount` |
| POST | `/organizations` | Body `{ name, slug? }` — create firm |
| GET | `/organizations/:orgId/admins` | List admins for that firm (no passwords) |
| POST | `/organizations/:orgId/admins` | Body `{ name, email, password, role? }` — create admin in that firm |
| PATCH | `/organizations/:orgId/admins/:adminId` | Body optional: `name`, `email`, `password` (min 6), `role` (`admin` \| `super_admin`), `active` |

## Dashboard

| Method | Path | Notes |
|--------|------|--------|
| GET | `/dashboard/summary` | Cards: totals, present/absent/late/active |

## Employees

| Method | Path | Notes |
|--------|------|--------|
| GET | `/employees` | Query: `q`, `department`, `active`, `page`, `limit` |
| GET | `/employees/:id` | |
| POST | `/employees` | Create; response `meta.registrationLink` for Telegram |
| PATCH | `/employees/:id` | Partial update |
| DELETE | `/employees/:id` | |
| GET | `/employees/:id/registration-link` | `inviteUrl` for Telegram |
| POST | `/employees/:id/profile-photo` | `multipart/form-data` field `photo` |

## Attendance

| Method | Path | Notes |
|--------|------|--------|
| GET | `/attendance` | Query: `employeeId`, `from`, `to`, `status`, `page`, `limit` |
| GET | `/attendance/today/:employeeId` | |
| POST | `/attendance/punch-in` | JSON or multipart; `employeeId`; optional `lat`, `lng`, `selfie` file |
| POST | `/attendance/punch-out` | `employeeId`; optional `lat`, `lng` |
| PATCH | `/attendance/:id/correct` | Manual correction fields |

## Activities

| Method | Path | Notes |
|--------|------|--------|
| GET | `/activities` | Query filters |
| POST | `/activities` | Create log (admin / integrations) |

## Leaves

| Method | Path | Notes |
|--------|------|--------|
| GET | `/leaves` | |
| POST | `/leaves/apply` | Protected; admin on behalf: `employeeId`, `startDate`, `endDate`, `reason` |
| POST | `/leaves/:id/approve` | |
| POST | `/leaves/:id/reject` | Optional `adminNote` body |

## Reports

| Method | Path | Notes |
|--------|------|--------|
| GET | `/reports/summary` | `period=daily|weekly|monthly` or `from` + `to` (ISO dates) |
| GET | `/reports/export/excel` | Binary XLSX |
| GET | `/reports/export/csv` | |
| GET | `/reports/export/pdf` | |

## Notifications

| Method | Path | Notes |
|--------|------|--------|
| GET | `/notifications` | `unread=true` optional |
| POST | `/notifications/mark-read` | `{ ids: [] }` |

## Socket.IO (realtime)

Connect with `auth: { token: <accessToken> }`, path `/socket.io`.

Events are emitted to room `org:<organizationId>` (derived from the JWT):

- `activity:new`
- `attendance:updated`
- `leave:updated`
- `notification:new`
- `cron:absent`, `cron:shift-reminder`

## Health

`GET /health` — no auth.
