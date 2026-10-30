# 🕒 Attendance Admin — Telegram-Based Employee Attendance System

A multi-tenant employee attendance platform where employees punch in/out, request leave, and log activity **entirely through Telegram** — while admins manage everything from a full-featured web dashboard.

**Live app:** [orlix.online](https://orlix.online)

---

## 📖 Overview

This system lets any number of organizations ("firms") run their own isolated attendance setup on one shared platform. Employees never install an app — they interact with a Telegram bot to punch in/out, go on break, request leave, and submit task updates/proof photos. Admins (and a cross-organization Super Admin) manage employees, attendance, leave approvals, reports, and per-organization settings from a React dashboard.

Key design principles baked into the codebase:

- **Multi-tenant by organization** — every record is scoped to an `organizationId`; a Super Admin can view/manage every organization, a regular Admin only their own.
- **Organization-level configurability** — timezone, shift/break timings, Sunday-off automation, office geofence, and punch-in verification (location/selfie) are all per-organization settings, not global.
- **Role-based access control** — Super Admin vs. Admin, with granular permission flags (e.g. an Admin can be individually granted the right to edit specific organization settings) enforced on both frontend and backend.

---

## ✨ Key Features

- 🤖 **Telegram-native attendance** — Punch In / Punch Out, Break Start/End, Task Updates, and Selfie/Proof uploads, all via Telegram bot commands and menus.
- 📍 **Optional location + selfie verification at punch-in** — per-organization toggles for location sharing (with an office-geofence hard block) and selfie capture (with duplicate-photo rejection).
- 🏢 **Multi-tenant organization management** — create/manage organizations, each with its own timezone, shift timing, break schedule, and admins.
- 🧑‍💼 **Employee management** — onboarding with auto-generated employee IDs, Telegram registration links, profile photos, and per-employee shift/break overrides.
- 📊 **Attendance tracking** — automatic late/overtime/early-leave calculation, manual corrections, and a live dashboard of who's in, out, or on break.
- 🏖️ **Leave management** — Casual/Sick/Other leave types, running balances, admin approval workflow, and role-based approval restrictions (e.g. only a Super Admin can approve leave for Admin-level employees).
- 📅 **Off-days & Sunday automation** — automatic weekly-off handling plus manually set leave/off days.
- 🔔 **Real-time updates** — Socket.IO pushes live attendance, activity, leave, and notification events straight to the dashboard.
- 📈 **Reports** — daily/weekly/monthly summaries with Excel, CSV, and PDF export, plus scheduled daily Telegram reports.
- 🔐 **Two-factor authentication (TOTP)** for admin accounts, with encrypted secrets and backup codes.
- 🛡️ **Granular admin permissions** — Manage Admin lets a Super Admin grant a regular Admin narrow rights (e.g. editing an organization's punch-in feature toggles) without handing over full organization control.
- 🌍 **Per-organization timezone support** — attendance days, shift calculations, and reports all respect each organization's own IANA timezone.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Backend runtime** | Node.js, Express 4 |
| **Database** | MongoDB (Mongoose ODM), MongoDB Atlas in production |
| **Realtime** | Socket.IO |
| **Bot** | Telegraf (Telegram Bot API) |
| **Auth** | JWT (access + refresh tokens), bcrypt, TOTP 2FA (`otplib`) |
| **Scheduling** | `node-cron` |
| **File storage** | Cloudinary (selfies/profile photos), local `uploads/` fallback |
| **Exports** | ExcelJS, PDFKit |
| **Security middleware** | Helmet, `express-rate-limit`, `express-mongo-sanitize` |
| **Frontend framework** | React 19 + Vite 6 |
| **UI library** | MUI (Material UI) v6 |
| **State management** | Redux Toolkit |
| **Routing** | React Router 7 |
| **HTTP client** | Axios |
| **Charts** | Recharts |

---

## 📁 Folder Structure

```
.
├── backend/
│   ├── bot/                 # Telegram bot (Telegraf) — employee-facing commands
│   ├── config/               # Env loading, DB connection, Cloudinary config
│   ├── controllers/          # Express route handlers
│   ├── jobs/                  # Scheduled cron jobs (daily reports, absentee checks, etc.)
│   ├── middlewares/           # Auth, role/permission checks, error handling
│   ├── models/                 # Mongoose schemas (Organization, Employee, Attendance, Leave, Admin, ...)
│   ├── routes/v1/              # Versioned REST API routes
│   ├── scripts/                # One-off/maintenance scripts (seed admin, reset 2FA, sync indexes)
│   ├── services/                # Business logic (attendance, leave, reports, notifications, ...)
│   ├── socket/                  # Socket.IO setup
│   ├── utils/                    # Shared helpers (JWT, geofence, date/timezone helpers, ...)
│   ├── uploads/                   # Local file storage fallback
│   ├── app.js                     # Express app wiring
│   └── server.js                  # Entry point (HTTP + Socket.IO + bot + cron bootstrap)
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── layouts/              # Dashboard shell/navigation
│   │   ├── pages/                 # Route-level pages (Employees, Attendance, Leaves, Organizations, ...)
│   │   │   └── details/             # Drill-down detail pages
│   │   ├── redux/                   # Redux Toolkit store & slices
│   │   ├── services/                 # API client, Socket.IO client
│   │   ├── theme/                     # MUI theme
│   │   └── utils/                      # Formatting/helper utilities
│   └── vite.config.js
│
└── docs/
    └── API.md                # REST API reference
```

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** (LTS recommended)
- **MongoDB** (local instance or a MongoDB Atlas connection string)
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather)

### 1. Clone the repository

```bash
git clone <repository-url>
cd Telegram-attendance
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values — see Environment Variables below
npm run dev             # starts the API with nodemon on PORT (default 1002)
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # then fill in the values — see Environment Variables below
npm run dev             # starts the Vite dev server on PORT (default 1001)
```

The frontend dev server proxies `/api`, `/uploads`, and `/socket.io` to the backend (`API_PROXY_TARGET`), so both must be running for the dashboard to work locally.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default `1002`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRES` | Access token lifetime (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime (e.g. `7d`) |
| `TWO_FA_ENCRYPTION_KEY` | Key used to encrypt TOTP secrets at rest — set once, never change afterwards |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `FRONTEND_URL` | Public frontend URL — used to build emailed password-reset links |
| `OVERTIME_AFTER_MINS` | Minutes past shift end before overtime starts accruing |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | Bot's public username (no `@`) |
| `TELEGRAM_WEBHOOK_URL` | Public HTTPS base URL for the bot webhook (production) |
| `TELEGRAM_WEBHOOK_PATH` | Webhook path (default `/telegram/webhook`) |
| `API_BASE_URL` | Base URL the API is reachable at |
| `UPLOADS_DIR` | Local uploads directory name (default `uploads`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | Upload folder path within Cloudinary |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials for outgoing email (password resets, notifications) — works with any standard SMTP provider |
| `EMAIL_FROM` | "From" address used on outgoing emails |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Dev server port (default `1001`) |
| `API_PROXY_TARGET` | Backend URL the dev server proxies `/api`, `/uploads`, `/socket.io` to |
| `VITE_DEFAULT_SLUG` | Default organization slug pre-filled on the login screen |

---

## 🚀 Usage

1. Start MongoDB, then the backend (`npm run dev` inside `backend/`) — this also auto-seeds a Super Admin account on first run (see `backend/utils/ensureSeedAdmin.js` / `backend/scripts/seedAdmin.js`).
2. Start the frontend (`npm run dev` inside `frontend/`) and sign in as the Super Admin.
3. Create an organization from the **Organizations** page, then add employees from **Employees** — each employee gets a Telegram registration link.
4. Employees open that link in Telegram, register, and can immediately use the bot menu (Punch In/Out, Break Start/End, Leave Request, Task Update, Selfie/Proof).
5. Attendance, activity, and leave requests appear live on the dashboard via Socket.IO.

Useful backend scripts (run from `backend/`):

```bash
npm run seed:admin          # (re)seed the Super Admin account
npm run reset:2fa           # emergency 2FA reset for an admin
npm run sync:indexes        # sync Mongoose indexes with the current schemas
npm run fix:telegram-index  # repair the Telegram-session unique index
```

---

## 🌐 Deployment

The production app is live at **[orlix.online](https://orlix.online)**, deployed on **Render**, with **MongoDB Atlas** as the database and **Cloudinary** for selfie/photo storage.

For your own deployment:
- Set `NODE_ENV=production` and configure all backend environment variables (above) in your hosting provider's dashboard.
- Point `TELEGRAM_WEBHOOK_URL` at your deployed backend's public HTTPS URL so Telegram delivers bot updates via webhook instead of polling.
- Build the frontend with `npm run build` (inside `frontend/`) and serve the resulting `dist/` as a static site, with `API_PROXY_TARGET`/API base URL pointed at your deployed backend.

---

## 📄 API Reference

Full endpoint documentation lives in [`docs/API.md`](docs/API.md), covering:

- **Auth** — login, token refresh, logout, 2FA
- **Organizations** — multi-tenant management, admin accounts, per-organization settings
- **Employees** — onboarding, profile, Telegram registration links
- **Attendance** — punch-in/out, corrections, history
- **Leaves** — requests, balances, approvals
- **Reports** — summaries and Excel/CSV/PDF exports
- **Notifications** — in-app notification feed
- **Socket.IO** — realtime event reference

---

## 👥 Contributing

This is a **private repository** maintained by the **Yogen Infotech** team. It is not currently open to outside contributions.

For team members:
- Create a feature branch off `main` for any change (`feature/<short-description>` or `fix/<short-description>`).
- Keep commits focused and descriptive.
- Open a pull request into `main` for review before merging.
- Reach out to a project maintainer for repo access or questions.

---

## 📜 License

This project is **proprietary** and **all rights reserved** by Yogen Infotech. No license is granted for reuse, redistribution, or modification outside of work authorized by the project owner.
