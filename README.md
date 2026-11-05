# GeoSafe — Geolocation-Based Disaster Reporting & Emergency Assistance System

**GeoSafe** is a progressive web application (PWA) and real-time emergency dispatch platform tailored for **Barangay Bayanan, Muntinlupa City (BDRRMC)**. It connects residents, field responders, and disaster command administrators through GPS-based hazard/SOS reporting, automated triage prioritization, pedestrian evacuation routing, real-time meteorological advisories, and a live family safety tracker.

---

## Key Features

- **1-Tap SOS & Hazard Reporting:** Residents transmit real-time GPS coordinates (`navigator.geolocation`) with reverse-geocoded street addresses for emergencies (`SOS`, `Flood`, `Fire`, `Medical`, `Earthquake`, `Storm`, `Other`).
- **Automated Severity Detection & Multi-Factor Rescue Triage:** Rule-based keyword NLP (`severityDetector.js`) and a composite prioritization engine (`prioritizer.js`) automatically score and rank incoming incidents into **Priority 1 (Critical)**, **Priority 2 (Urgent)**, and **Priority 3 (Standard)**.
- **Safe Haven Evacuation Routing:** Turn-by-turn pedestrian navigation to verified Barangay Bayanan evacuation centers using **Leaflet.js**, **OpenStreetMap**, and the **OSRM Foot Routing API**.
- **Family Safety Tracker:** Residents can create or join a Family Circle via an invite code to share live GPS locations, battery levels, and safety statuses (`Safe`, `Need Help`, `Injured`, `No Response`).
- **Live Meteorological & Flood Advisories:** Real-time weather telemetry powered by the **Open-Meteo API** with automated thunderstorm, rainfall, and heat-index warnings.
- **Multi-Channel Real-Time Broadcasts:** Instant BDRRMC emergency alerts and dispatch status updates via **Socket.IO**, **Firebase Cloud Firestore** snapshots, and **Server-Sent Events (`ntfy.sh`)** with Web Audio API alarm chimes.
- **3-Tier Hybrid Persistence:** Operates seamlessly across a primary **MySQL** relational database, **Google Firebase Cloud Firestore**, and a resilient client-side **`localStorage`** fallback for serverless/offline continuity.

---

## Tech Stack

### 1. Frontend & Progressive Web App (PWA)
- **Core:** HTML5, CSS3 (Custom Design System with Dark/Light Mode CSS Variables), Vanilla JavaScript (ES6+)
- **PWA:** Web App Manifest (`manifest.json`) & Service Worker (`sw.js`) for 1-tap mobile/desktop installation
- **Browser APIs:** HTML5 Geolocation API, Web Audio API (`AudioContext` emergency alarm synthesis), `BroadcastChannel` API, and `localStorage`
- **Typography:** Google Fonts (`Inter`, `Roboto`)

### 2. Backend & Security
- **Runtime & Framework:** Node.js, Express.js (`^4.21.0`)
- **Authentication & Authorization:** JSON Web Tokens (`jsonwebtoken` `^9.0.2`) + Role-Based Access Control (`resident`, `responder`, `admin`)
- **Password Cryptography:** `bcrypt` (`^5.1.1`) salted password hashing
- **Validation & Middleware:** `express-validator` (`^7.2.0`), `cors` (`^2.8.5`), `dotenv` (`^16.6.1`)

### 3. Databases & Hybrid Persistence
- **Primary Relational DB:** MySQL (`mysql2/promise` `^3.11.0` connection pool)
- **Cloud NoSQL Sync:** Google Firebase Cloud Firestore (`v10.12.0` — `users`, `reports`, `alerts`, `family_circles`)
- **Client Fallback:** Browser `localStorage` store in `frontend/app.js`

### 4. Real-Time Communication
- **WebSockets:** Socket.IO (`^4.7.5`) with role and family rooms (`role:*`, `family:*`, `broadcast`)
- **Cloud Snapshots:** Firestore real-time `onSnapshot` listeners
- **Server-Sent Events (SSE):** `ntfy.sh` pub/sub streams (`geosafe_bayanan_alerts_2026`, `geosafe_bayanan_reports_2026`)

### 5. GIS, Mapping & External APIs
- **Map Rendering:** Leaflet.js (`v1.9.4`) + OpenStreetMap (OSM) Tile Layer
- **Street Routing:** OSRM (Open Source Routing Machine) Foot Routing API (`router.project-osrm.org`)
- **Reverse Geocoding:** OpenStreetMap Nominatim API (`nominatim.openstreetmap.org`)
- **Weather Telemetry:** Open-Meteo Forecast API (`api.open-meteo.com`)

### 6. Deployment & Quality Assurance
- **Cloud Hosting:** Vercel (`@vercel/node` & `@vercel/static` via `vercel.json`)
- **Automated Testing:** ISO/IEC 25010 automated evaluation suite (`backend/scripts/test-iso25010.js`)

---

## Project Structure

```text
GEOSAFE-SYSTEM/
├── backend/
│   ├── controllers/
│   │   ├── alertController.js      # Emergency alert broadcast handlers
│   │   ├── authController.js       # Registration & JWT login handlers
│   │   ├── familyController.js     # Family circle CRUD & member status handlers
│   │   ├── reportController.js     # Incident reporting, triage & status updates
│   │   └── userController.js       # User directory & responder lookup
│   ├── middleware/
│   │   ├── auth.js                 # JWT bearer token verification
│   │   └── rbac.js                 # Role-Based Access Control (resident/responder/admin)
│   ├── models/
│   │   ├── db.js                   # MySQL connection pool (mysql2/promise)
│   │   └── userModel.js            # User data access helpers
│   ├── routes/
│   │   ├── alertRoutes.js          # /api/alerts endpoints
│   │   ├── authRoutes.js           # /api/register & /api/login endpoints
│   │   ├── familyRoutes.js         # /api/family endpoints
│   │   ├── reportRoutes.js         # /api/reports endpoints
│   │   └── userRoutes.js           # /api/users endpoints
│   ├── scripts/
│   │   ├── generate-icons.js       # PWA icon generator
│   │   ├── seed.js                 # Default admin & responder account seeder
│   │   └── test-iso25010.js        # ISO/IEC 25010 automated test suite
│   ├── utils/
│   │   ├── prioritizer.js          # Multi-factor rescue triage algorithm
│   │   └── severityDetector.js     # Keyword & negation-aware NLP severity detector
│   ├── server.js                   # Express & HTTP server entry point
│   ├── socket.js                   # Socket.IO server & real-time emitters
│   └── package.json
├── database/
│   ├── schema.sql                  # Full MySQL relational schema
│   └── migration_family.sql        # Family tracker schema migration
├── frontend/
│   ├── index.html                  # Authentication portal (Login / Registration)
│   ├── home.html                   # Resident dashboard (SOS, Weather, Hotlines, Alerts)
│   ├── report.html                 # Geolocation hazard & SOS submission page
│   ├── route.html                  # Evacuation safe haven map & walking directions
│   ├── family.html                 # Family Safety Tracker & live member map
│   ├── admin.html                  # BDRRMC Command Center & dispatch console
│   ├── responder.html              # Field responder mission & navigation console
│   ├── app.js                      # Shared client state, resilient API & auth helpers
│   ├── evacuation-routes.js        # Bayanan safe havens, OSRM routing & Nominatim geocoding
│   ├── firebase-config.js          # Firebase Cloud Firestore client adapter (GeoSafeDB)
│   ├── firebase-service.js         # Firestore real-time service helpers
│   ├── mobile-ui.css               # Core responsive UI & dark/light theme stylesheet
│   ├── critical.css                # Critical above-the-fold styles
│   ├── manifest.json               # PWA manifest configuration
│   └── sw.js                       # PWA service worker
└── vercel.json                     # Vercel full-stack routing & build config
```

---

## Triage & Prioritization Engine

When a resident submits an incident report, GeoSafe evaluates urgency in two stages:

1. **Severity Detection (`backend/utils/severityDetector.js`):**
   Combines incident category base scores (`SOS: 60`, `Medical: 45`, `Fire: 40`, `Earthquake: 35`, `Flood: 30`, `Storm: 25`, `Other: 15`) with affirmative keyword triggers (`HIGH_KEYWORDS`, `MEDIUM_KEYWORDS`, `LOW_KEYWORDS`) and negation filtering (e.g., `"no trapped residents"`) to classify severity as `high`, `medium`, or `low`.
2. **Multi-Factor Rescue Prioritization (`backend/utils/prioritizer.js`):**
   Computes a composite priority score (0–100) using:
   $$\text{Priority Score} = 0.40(\text{Severity}) + 0.25(\text{Vulnerability}) + 0.20(\text{Time Urgency}) + 0.15(\text{Proximity})$$
   - **Priority 1 (`P1` — Critical):** Score $\ge 70$, `high` severity, or `SOS`
   - **Priority 2 (`P2` — Urgent):** Score $\ge 40$ or `medium` severity
   - **Priority 3 (`P3` — Standard):** Routine verification queue

---

## Designated Evacuation Safe Havens (Barangay Bayanan)

| Safe Haven | Classification | Coordinates | Capacity |
| :--- | :--- | :--- | :--- |
| **Bayanan Baywalk Covered Court** | Primary Safe Haven (Lakeshore) | `14.4094644, 121.0486196` | 350 Persons |
| **Bayanan Elementary School - Unit 1** | Secondary Safe Haven (Inland) | `14.4117681, 121.0517064` | 500 Persons |
| **Pedro E. Diaz High School** | High Ground Evacuation Haven | `14.4145200, 121.0468000` | 600 Persons |
| **Barangay Bayanan Multi-Purpose Hall** | Command & Medical Relief Post | `14.4082000, 121.0498000` | 200 Persons |

---

## Getting Started

### 1. Database Setup (MySQL)

Import the relational schema into MySQL:

```bash
mysql -u root -p < database/schema.sql
```

*(Note: If MySQL is not running, the frontend automatically falls back to Firebase Cloud Firestore and `localStorage`.)*

### 2. Backend Configuration & Launch

```bash
cd backend
cp .env.example .env
# Update .env with your MySQL credentials (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) and JWT_SECRET

npm install
npm run seed
npm start
```

The server starts at **`http://localhost:3000`**. For development with auto-reload (Node 18+):

```bash
npm run dev
```

### 3. Default Accounts

| Role | Email | Password | Dashboard |
| :--- | :--- | :--- | :--- |
| **Admin (BDRRMC)** | `admin@geosafe.local` | `admin123` | `/admin.html` |
| **Field Responder** | `responder@geosafe.local` | `responder123` | `/responder.html` |
| **Rescue Boat Unit** | `boat@geosafe.local` | `responder123` | `/responder.html` |
| **Resident (Demo)** | `resident@geosafe.local` | `resident123` | `/home.html` |

---

## REST API Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Health check endpoint |
| `POST` | `/api/register` | Public | Register a new resident account |
| `POST` | `/api/login` | Public | Authenticate user & issue JWT |
| `GET` | `/api/reports` | Authenticated | List incident reports (sorted by triage priority) |
| `POST` | `/api/reports` | Resident | Submit a new hazard or SOS report |
| `GET` | `/api/reports/:id` | Authenticated | Get details for a specific report |
| `PUT` | `/api/reports/:id/status` | Admin, Responder | Update report status (`pending` → `verified` → `responding` → `on_site` → `resolved`), severity, or assigned responder |
| `GET` | `/api/alerts` | Authenticated | Fetch recent emergency broadcasts |
| `POST` | `/api/alerts` | Admin | Broadcast a new BDRRMC emergency alert |
| `GET` | `/api/users` | Admin | List registered users and responder units |
| `GET` | `/api/family` | Resident | Get current user's Family Circle & members |
| `POST` | `/api/family` | Resident | Create a new Family Circle |
| `POST` | `/api/family/join` | Resident | Join a Family Circle via invite code |
| `POST` | `/api/family/leave` | Resident | Leave current Family Circle |
| `PUT` | `/api/family/me` | Resident | Update own safety status, GPS location, or battery level |
| `PUT` | `/api/family/settings` | Family Head | Update Family Circle name & description |
| `PUT` | `/api/family/transfer-head` | Family Head | Transfer Family Head role to another member |
| `POST` | `/api/family/regenerate-invite` | Family Head | Generate a new invite code |
| `POST` | `/api/family/members` | Family Head | Add a member to the Family Circle |
| `DELETE` | `/api/family/members/:userId` | Family Head | Remove a member from the Family Circle |

---

## Automated Testing (ISO/IEC 25010)

Run the automated test suite covering Authentication, Geolocation Validation, Severity & Priority Triage Accuracy, Security (JWT/Bcrypt/RBAC), and Performance benchmarks:

```bash
cd backend
npm test
```
