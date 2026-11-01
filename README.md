<div align="center">

# 🎓 Enterprise Learning Management System

### A Modern Full-Stack Educational SaaS Platform

[![React 18](https://img.shields.io/badge/React-18.x-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)](https://getbootstrap.com)
[![WCAG AA](https://img.shields.io/badge/WCAG-AA%20Compliant-blue?style=for-the-badge)](#-accessibility)
[![Tests](https://img.shields.io/badge/Tests-128%20Passing-brightgreen?style=for-the-badge)](#-testing)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](#-license)

<br />

*High-concurrency learning management with automated assessments, real-time presence telemetry, and live lecture attendance tracking.*

<br />

[Quick Start](#-quick-start) · [Features](#-features) · [API Docs](docs/LMS_DOCUMENTATION.md#8-api-reference) · [Architecture](#-architecture) · [Demo Accounts](#-demo-accounts)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔐 Authentication & Security
- Stateless JWT with server-side token revocation
- Role-Based Access Control — `admin` · `instructor` · `student` · `parent`
- Brute-force protection (10 login attempts / 15 min)
- API rate limiting (300 requests / 15 min)
- Joi validation + MongoDB injection defense

</td>
<td width="50%">

### 📚 Course Management
- Multi-module course builder with drag-and-drop lessons
- Content types: text, video, PDF, documents, images
- Content locking until enrollment
- Server-verified watch time & progress checkpoints
- Auto-generated completion certificates with verification

</td>
</tr>
<tr>
<td width="50%">

### 📝 Assignments & Grading
- Configurable deadlines with late submission policies
- Automatic late-penalty calculation
- File upload support (PDF, DOCX, ZIP, images)
- Instructor feedback with grade notifications

</td>
<td width="50%">

### ⏱ Quizzes & Examinations
- Timed quizzes with server-owned clock
- Multiple-choice (auto-scored) + descriptive (manual grading)
- Configurable attempt limits & exam mode
- Answer autosave & resume on reconnect

</td>
</tr>
<tr>
<td width="50%">

### 📡 Real-Time Tracking
- Live student presence via Socket.IO
- In-memory presence (zero persistent surveillance)
- Instructor live activity dashboard
- Student privacy toggle for live status

</td>
<td width="50%">

### 📊 Attendance & Analytics
- Instructor-controlled live attendance sessions
- Auto sign-out on disconnect with grace period
- Daily / weekly / monthly activity reports
- Interactive Recharts visualizations

</td>
</tr>
<tr>
<td width="50%">

### 💬 Communication
- Course discussion boards with pin & lock
- Role-aware direct messaging
- Real-time notifications (bell + Socket.IO)
- Course announcements (instructor & admin)

</td>
<td width="50%">

### 👨‍👩‍👧 Parent Portal
- Linked student progress monitoring
- Attendance & exam grade visibility
- Absence alerts when sessions close
- Direct messaging with instructors

</td>
</tr>
</table>

---

## 🏗 Architecture

```
learning-management-system/
│
├── backend/                     Node.js · Express · Socket.IO · Mongoose
│   ├── src/
│   │   ├── config/              Environment, database, upload configuration
│   │   ├── controllers/         Business logic & Joi request validation
│   │   ├── middleware/          JWT auth, RBAC guards, rate limiters
│   │   ├── models/              14 Mongoose schemas with indexing strategies
│   │   ├── realtime/            Socket.IO presence, events, telemetry
│   │   ├── routes/              RESTful API endpoints
│   │   └── seed.js              Demo dataset generator
│   └── tests/                   128 integration tests (Jest + Supertest)
│
├── frontend/                    React 18 · Vite 5 · Bootstrap 5.3
│   ├── src/
│   │   ├── components/          Design system (ThemeToggle, KPI, ProgressBar)
│   │   ├── context/             AuthContext & RealtimeContext (Socket.IO)
│   │   ├── layouts/             Responsive sidebar with grouped navigation
│   │   ├── pages/               Dashboard, Courses, Player, Quizzes, etc.
│   │   └── styles/              CSS tokens, components, motion
│
└── docs/                        Complete platform documentation
```

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 5, Bootstrap 5.3 | SPA with CSS custom property design system |
| **Backend** | Node.js, Express 4 | RESTful API with Joi validation |
| **Database** | MongoDB 7 (Mongoose 8) | Document store with compound indexes |
| **Real-Time** | Socket.IO 4.8 | Presence, live tracking, notifications |
| **Auth** | JWT + bcrypt | Stateless tokens with server-side revocation |
| **Testing** | Jest + Supertest | 128 integration tests with in-memory MongoDB |
| **Font** | Inter Variable (self-hosted) | No external CDN dependencies |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or newer
- **MongoDB** 6.0+ (local) or a MongoDB Atlas connection string

### 1️⃣ Clone & Configure Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` with your configuration:

```env
PORT=5000
DB_MODE=local
LOCAL_MONGO_URI=mongodb://127.0.0.1:27017/lms_database
JWT_SECRET=<generate with command below>
CLIENT_ORIGIN=http://localhost:5173
SEED_PASSWORD=Password123
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2️⃣ Seed & Start Backend

```bash
npm run seed     # ⚠ Wipes all data and creates demo content
npm run dev      # API server → http://localhost:5000
```

### 3️⃣ Start Frontend

```bash
cd frontend
npm install
cp .env.example .env    # Leave VITE_API_URL empty for dev (Vite proxies /api)
npm run dev              # Dev server → http://localhost:5173
```

### 4️⃣ Open & Login

Navigate to **http://localhost:5173** and sign in with any [demo account](#-demo-accounts).

> [!TIP]
> For production, set `VITE_API_URL` to the API origin, `NODE_ENV=production`, and run `npm run build` in the frontend.

---

## 👥 Demo Accounts

All seeded accounts use the password configured in `SEED_PASSWORD` (default: **`Password123`**).

| Role | Name | Email |
|---|---|---|
| 🛡 **Admin** | Alex Vance | `admin@lms.io` |
| 👨‍🏫 **Instructor** | Dr. Marcus Chen | `marcus.chen@lms.io` |
| 👩‍🏫 **Instructor** | Sarah Jenkins | `sarah.jenkins@lms.io` |
| 🎓 **Student** | Elena Rostova | `elena.rostova@student.lms.io` |
| 🎓 **Student** | Sophia Martinez | `sophia.martinez@student.lms.io` |
| 🎓 **Student** | David Kim | `david.kim@student.lms.io` |
| 🎓 **Student** | Maya Patel | `maya.patel@student.lms.io` |
| 🎓 **Student** | Liam O'Connor | `liam.o-connor@student.lms.io` |
| 👨‍👩‍👧 **Parent** | Robert Martinez | `robert.martinez@family.lms.io` |

> Robert Martinez is linked to student Sophia Martinez, enabling parent-view access to her progress, attendance, and grades.

---

## 📖 Included Curricula

The seed script creates three production-grade courses with complete modules, lessons, assignments, and quizzes:

| # | Course | Level | Duration |
|---|---|---|---|
| 1 | **Enterprise Full-Stack Architecture:** React, Node.js & Scalable Systems | Intermediate | 32 hours |
| 2 | **Database Engineering & Query Optimization** with MongoDB | Advanced | 24 hours |
| 3 | **Cloud Infrastructure, Containers & DevOps Automation** | Beginner | 20 hours |

---

## 🎨 Design System

A modern educational SaaS design system powered by CSS custom properties:

| Feature | Details |
|---|---|
| **Themes** | Light + Dark with zero-flash initialization. Persisted in `localStorage` with `prefers-color-scheme` fallback |
| **Colors** | Royal blue primary (`#1d4ed8` / `#60a5fa`), emerald accent (`#0f9d6b` / `#34d399`) |
| **Typography** | Self-hosted Inter Variable with tabular numbers for data-heavy views |
| **Accessibility** | WCAG AA (4.5:1) for all text; AAA (7:1) for primary body text |
| **Motion** | Smooth card lifts, sidebar indicators, bell shake, staggered entrances. All disabled under `prefers-reduced-motion` |
| **Icons** | Bootstrap Icons — offline-bundled, 4-tier size scale (16 / 20 / 24 / 40 px) |

> Full token reference → [Design System & Theme Tokens](docs/LMS_DOCUMENTATION.md#7-design-system--theme-tokens)

---

## 🗄 Database

The application supports **two mutually exclusive database modes**, configured in `backend/.env`:

| Mode | Config | Use Case |
|---|---|---|
| **Local** (default) | `DB_MODE=local` + `LOCAL_MONGO_URI` | Development, single-server production |
| **Atlas** (cloud) | `DB_MODE=atlas` + `ATLAS_URI` | Managed cloud deployments |

The app **never switches modes automatically**. If the configured database is unreachable, the server exits with a clear diagnostic message.

### Health Checks

| Endpoint | Description |
|---|---|
| `GET /api/health` | `200 ok` / `503 degraded` |
| `GET /api/health/db` | Mode, host, latency, collection count (admin-only in production) |

### Backup & Restore

```bash
# Backup
mongodump --uri="mongodb://127.0.0.1:27017/lms_database" --out="./backups/2026-11-02"

# Restore (non-destructive)
mongorestore --uri="mongodb://127.0.0.1:27017" --nsInclude="lms_database.*" "./backups/2026-11-02"

# Full rollback (destructive)
mongorestore --uri="mongodb://127.0.0.1:27017" --drop --nsInclude="lms_database.*" "./backups/2026-11-02"
```

> [!IMPORTANT]
> Also back up `backend/uploads/` — files are stored on disk, not in MongoDB. Backups contain password hashes and student records; store them securely.

> Full database guide → [Database Configuration](docs/LMS_DOCUMENTATION.md#3-database-configuration)

---

## 🧪 Testing

```bash
cd backend && npm test
```

**128 integration tests** across:

| Category | Coverage |
|---|---|
| Authentication | Registration, login, logout, JWT revocation, suspended accounts |
| Authorization | Role permissions, ownership checks, parent access, admin audit logging |
| Courses | Creation rules, lesson locking, content management |
| Files | Upload validation, signed links, magic-byte verification |
| Progress | Watch-time rules, completion logic, certificate generation |
| Assignments | Deadline enforcement, late penalties, grading workflow |
| Quizzes | Timing, attempt limits, auto-scoring, manual grading |
| Real-Time | Socket.IO auth, presence tracking, event delivery |

---

## 🔒 Security

| Measure | Implementation |
|---|---|
| **Authentication** | bcrypt password hashing, JWT with server-side revocation list |
| **Authorization** | Middleware RBAC guards on every route |
| **Input Validation** | Joi schemas + `express-mongo-sanitize` |
| **Rate Limiting** | 10 login / 15 min per IP · 300 API / 15 min |
| **File Security** | Magic-byte validation — renamed scripts are rejected and deleted |
| **Headers** | Helmet.js security headers |
| **CORS** | Strict origin whitelist via `CLIENT_ORIGIN` |

> [!CAUTION]
> - Never commit `.env` files — they contain secrets and database credentials.
> - JWTs are stored in `localStorage`. For stronger XSS resistance, migrate to httpOnly cookies with CSRF protection.
> - Atlas URIs must never appear in frontend code.

---

## 📡 Real-Time (Socket.IO)

The API server runs Socket.IO on the same port. In development, Vite automatically proxies `/socket.io`.

| Capability | Details |
|---|---|
| **Presence** | Online / offline status (memory-only, never persisted) |
| **Live Tracking** | Current course & lesson per student |
| **Notifications** | Instant delivery of grades, announcements, attendance alerts |
| **Discussions** | Real-time thread and reply updates |
| **Direct Messages** | Instant message delivery |
| **Dashboard** | Debounced `dashboard:updated` events for live KPI refresh |
| **Privacy** | Students can opt out of live status sharing |

> [!WARNING]
> Presence is held in a single process's memory. Before scaling to multiple instances, add the Socket.IO Redis adapter (planned for Phase 8).

> Full event reference → [Real-Time Events](docs/LMS_DOCUMENTATION.md#9-real-time-events-socketio)

---

## 📁 File Storage

| Directory | Content | Limit |
|---|---|---|
| `backend/uploads/resources/` | Lesson files (video, PDF, docs, images) | `UPLOAD_MAX_MB` (100) |
| `backend/uploads/thumbnails/` | Course cover images | 2 MB |
| `backend/uploads/submissions/` | Student assignment uploads | `SUBMISSION_MAX_MB` (10) |

Suitable for development and single-server deployments. For production, mount a persistent volume or migrate to object storage with a CDN (planned for Phase 8).

---

## 📚 Documentation

| Document | Description |
|---|---|
| [**LMS_DOCUMENTATION.md**](docs/LMS_DOCUMENTATION.md) | Complete unified documentation — setup, API reference, database guide, design tokens |
| [**API Reference**](docs/LMS_DOCUMENTATION.md#8-api-reference) | All 17 endpoint groups with access rules, payloads, and behavior |
| [**Database Guide**](docs/LMS_DOCUMENTATION.md#3-database-configuration) | Local vs Atlas modes, health checks, backup & restore |
| [**Design Tokens**](docs/LMS_DOCUMENTATION.md#7-design-system--theme-tokens) | Full CSS custom property reference for themes, spacing, typography, motion |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using React, Node.js, MongoDB & Socket.IO**

</div>
