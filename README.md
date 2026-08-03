# GeoSafe

Geolocation-based disaster reporting and emergency assistance system with real-time alerts.

## Tech Stack

- **Frontend:** HTML, Tailwind CSS, vanilla JavaScript, installable PWA (no offline caching)
- **Backend:** Node.js, Express.js, REST API
- **Database:** MySQL
- **Real-time:** Socket.io
- **Auth:** JWT + RBAC (resident, admin, responder)

## Project Structure

```
geosafe/
├── frontend/          # PWA UI (landing + role dashboards)
├── backend/           # Express API + Socket.io
└── database/          # MySQL schema
```

## Quick Start

### 1. MySQL

Create the database and tables:

```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials and JWT_SECRET

npm install
node scripts/generate-icons.js
npm run seed
npm start
```

Server runs at **http://localhost:3000**

### 3. Default Accounts (after seed)

| Role      | Email                    | Password      |
|-----------|--------------------------|---------------|
| Admin     | admin@geosafe.local      | admin123      |
| Responder | responder@geosafe.local  | responder123  |

Residents self-register on the landing page.

## API Endpoints

| Method | Endpoint                    | Access              |
|--------|-----------------------------|---------------------|
| POST   | /api/register               | Public              |
| POST   | /api/login                  | Public              |
| POST   | /api/reports                | Resident            |
| GET    | /api/reports                | All (filtered)      |
| GET    | /api/reports/:id            | Authenticated       |
| PUT    | /api/reports/:id/status     | Admin, Responder    |
| POST   | /api/alerts                 | Admin               |
| GET    | /api/alerts                 | Authenticated       |
| GET    | /api/users                  | Admin               |

## Socket.io Events

- `new-report` — emitted when a resident submits a report
- `alert-broadcast` — emitted when admin broadcasts an alert
- `status-update` — emitted when report status changes

## Family Tracker (Residents)

Residents can create or join **one** family group only.

| Action | Who |
|--------|-----|
| Create family | Resident (not already in a group) |
| Join with invite code / QR | Resident (must leave current group first) |
| Remove members, settings, transfer head | **Family Head only** |
| Update safety status & location | Any member |

**Safety statuses:** Safe (green), Need Help (red), Injured (orange), No Response (gray)

**Page:** `/family.html` — link from Resident dashboard

**Migrate existing DB:**
```bash
mysql -u root -p geosafe < database/migration_family.sql
```

## Report Lifecycle

`pending` → `verified` → `responding` → `on_site` → `resolved`

- **Admin:** verify severity, assign responder, dispatch
- **Responder:** update status to responding / on_site / resolved

## PWA Install

Open the app in Chrome/Edge, use **Install app** from the browser menu. The service worker does **not** cache assets — network is always required.

## Development

```bash
cd backend
npm run dev   # auto-restart on file changes (Node 18+)
```
