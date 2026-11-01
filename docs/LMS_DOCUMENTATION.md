# Enterprise Learning Management System — Documentation

[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%207.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Real--Time-Socket.IO%204.8-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![Bootstrap 5.3](https://img.shields.io/badge/UI-Bootstrap%205.3%20%7C%20CSS%20Tokens-7952B3?logo=bootstrap&logoColor=white)](https://getbootstrap.com)
[![WCAG AA](https://img.shields.io/badge/Accessibility-WCAG%20AA%20Compliant-blue)](#7-design-system--theme-tokens)

A modern, full-stack educational SaaS platform designed for high-concurrency learning management, automated assessments, real-time presence telemetry, and live lecture attendance tracking.

---

## Table of Contents

1. [Architecture & Technology Stack](#1-architecture--technology-stack)
2. [Getting Started](#2-getting-started)
   - [Prerequisites](#prerequisites)
   - [Backend Setup](#backend-setup)
   - [Frontend Setup](#frontend-setup)
   - [Running Tests](#running-tests)
3. [Database Configuration](#3-database-configuration)
   - [Choosing a Mode](#choosing-a-mode-local-vs-atlas)
   - [Windows Local Setup](#windows-local-setup)
   - [MongoDB Atlas (Cloud)](#mongodb-atlas-cloud)
   - [Health Checks](#health-checks)
   - [Backup & Restore](#backup--restore)
4. [Seeded Demo Accounts](#4-seeded-demo-accounts)
5. [Production Curricula](#5-production-curricula)
6. [Core Platform Capabilities](#6-core-platform-capabilities)
7. [Design System & Theme Tokens](#7-design-system--theme-tokens)
8. [API Reference](#8-api-reference)
   - [Authentication](#81-authentication)
   - [Users](#82-users)
   - [Courses](#83-courses)
   - [Modules & Lessons](#84-modules--lessons)
   - [Enrollment](#85-enrollment)
   - [Uploads & File Access](#86-uploads--file-access)
   - [Progress & Certificates](#87-progress--certificates)
   - [Assignments](#88-assignments)
   - [Quizzes & Examinations](#89-quizzes--examinations)
   - [Results](#810-results)
   - [Attendance](#811-attendance)
   - [Tracking & Analytics](#812-tracking--analytics)
   - [Notifications](#813-notifications)
   - [Discussions](#814-discussions)
   - [Direct Messages](#815-direct-messages)
   - [Account & Privacy](#816-account--privacy)
   - [Health](#817-health)
9. [Real-Time Events (Socket.IO)](#9-real-time-events-socketio)
10. [Real-Time Tracking & Privacy](#10-real-time-tracking--privacy)
11. [File Storage](#11-file-storage)
12. [Security Notes](#12-security-notes)
13. [License](#13-license)

---

## 1. Architecture & Technology Stack

```
learning-management-system/
├── backend/                 # Node.js + Express + Socket.IO + Mongoose
│   ├── src/
│   │   ├── config/          # Environment, database, Multer upload configuration
│   │   ├── controllers/     # Business logic & request validation (Joi)
│   │   ├── middleware/      # JWT auth, RBAC guards, rate limiters, sanitizers
│   │   ├── models/          # 14 Mongoose document schemas & indexing strategies
│   │   ├── realtime/        # Socket.IO presence, event buses, telemetry
│   │   ├── routes/          # RESTful API routing endpoints
│   │   └── seed.js          # Production-grade dataset generator & cleaner
│   └── tests/               # 128 automated integration test suites (Jest + Supertest)
├── frontend/                # React 18 + Vite 5 + Bootstrap 5.3
│   ├── src/
│   │   ├── components/      # Design system components (ThemeToggle, Icon, Kpi, ProgressBar)
│   │   ├── context/         # AuthContext & RealtimeContext (Socket.IO client)
│   │   ├── layouts/         # AppLayout with grouped navigation & responsive offcanvas
│   │   ├── pages/           # Dashboard, Courses, LessonPlayer, Quizzes, Attendance, etc.
│   │   └── styles/          # theme.css (tokens), components.css, motion.css
└── docs/                    # Full platform documentation
```

---

## 2. Getting Started

### Prerequisites

| Requirement | Minimum Version |
|---|---|
| **Node.js** | 18.x or newer |
| **MongoDB** | 6.0+ (local Community Server **or** MongoDB Atlas connection string) |

### Backend Setup

```bash
cd backend && npm install
cp .env.example .env
```

Edit `backend/.env` and configure the following variables:

| Variable | Description | Example |
|---|---|---|
| `DB_MODE` | `local` (default) or `atlas` | `local` |
| `LOCAL_MONGO_URI` | Local MongoDB connection string | `mongodb://127.0.0.1:27017/lms_database` |
| `ATLAS_URI` | Atlas connection string (only when `DB_MODE=atlas`) | `mongodb+srv://user:pass@cluster/lms_database` |
| `DB_TIMEOUT_MS` | Database connection timeout in ms | `10000` |
| `JWT_SECRET` | Random string, 32+ characters (see command below) | — |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `CLIENT_ORIGIN` | Allowed web app origin(s), comma-separated | `http://localhost:5173` |
| `SEED_PASSWORD` | Password for all demo accounts (8+ chars, letter + number) | `Password123` |
| `UPLOAD_DIR` | Custom upload directory (optional) | — |
| `UPLOAD_MAX_MB` | Max lesson file size in MB | `100` |
| `SUBMISSION_MAX_MB` | Max assignment submission size in MB | `10` |

Generate a secure `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Seed the database and start the server:

```bash
npm run seed     # ⚠ Wipes every collection and recreates demo data
npm run dev      # Starts API server on http://localhost:5000
```

> [!WARNING]
> `npm run seed` **destroys all existing data**. It refuses to run when `NODE_ENV=production` or `DB_MODE=atlas` unless `ALLOW_SEED=true` is explicitly set. Never run it against a database you care about.

### Frontend Setup

```bash
cd frontend && npm install
cp .env.example .env       # Leave VITE_API_URL empty; Vite proxies /api in dev
npm run dev                # Starts Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** and log in with any [seeded account](#4-seeded-demo-accounts).

For production, set `VITE_API_URL` to the API origin and run `npm run build`.

### Running Tests

```bash
cd backend && npm test
```

Runs **128 comprehensive integration tests** covering:

- Authentication & JWT revocation
- Role-based permissions & admin audit trails
- Course authoring, modules, and lesson locking
- File uploads and signature validation
- Lesson progress tracking & certificate generation
- Assignment submissions, late penalty rules, and grading
- Timed quiz attempt limits and scoring
- Socket.IO authenticated presence and live tracking

---

## 3. Database Configuration

The backend supports two database modes. You choose one in `backend/.env` — the application **never switches automatically**, so nobody ends up working in a different dataset by accident. If the chosen database is unreachable, the server stops with a clear error message.

### Choosing a Mode (Local vs Atlas)

**Local (default)**

```env
DB_MODE=local
LOCAL_MONGO_URI=mongodb://127.0.0.1:27017/lms_database
```

**Atlas (cloud)**

```env
DB_MODE=atlas
ATLAS_URI=mongodb+srv://<user>:<password>@<cluster-url>/lms_database
```

The Atlas URI lives only in `backend/.env` (never in the frontend, never committed). Older `.env` files that use `MONGO_URI` keep working in local mode.

### Windows Local Setup

1. Install **MongoDB Community Server** (choose "Run as a Service") and **MongoDB Database Tools** (for `mongodump`/`mongorestore`).
2. Confirm the service is running: `services.msc` → *MongoDB Server*.
3. In two terminals:
   ```bash
   cd backend  && npm install && copy .env.example .env   # then set JWT_SECRET
   npm run dev

   cd frontend && npm install && npm run dev
   ```
4. Open http://localhost:5173. Data is stored by MongoDB on disk and survives restarts. Starting the backend never deletes or overwrites data (only `npm run seed` does).

### MongoDB Atlas (Cloud)

- Create a database user and add your IP under *Network Access* in the Atlas console.
- Enable **Cloud Backup** (M10+ clusters) or use Atlas scheduled snapshots; restore from *Backup → Restore* in the Atlas console.
- Connection failures display: *"Check ATLAS_URI, the user/password, and that your IP is allowed."*

### Health Checks

| Endpoint | Description |
|---|---|
| `GET /api/health` | Returns `200 ok` when the database is connected, `503 degraded` otherwise |
| `GET /api/health/db` | Pings MongoDB and reports mode, database, host, latency, and collection count. Open in development; **admin login required in production** |

### Backup & Restore

```bash
# Backup (creates a folder with one file per collection)
mongodump --uri="mongodb://127.0.0.1:27017/lms_database" --out="D:\lms-backups\2026-11-02"

# Restore (existing documents with the same _id are skipped)
mongorestore --uri="mongodb://127.0.0.1:27017" --nsInclude="lms_database.*" "D:\lms-backups\2026-11-02"

# Full replace (drops each collection first) — only when you truly need to roll back
mongorestore --uri="mongodb://127.0.0.1:27017" --drop --nsInclude="lms_database.*" "D:\lms-backups\2026-11-02"
```

> [!IMPORTANT]
> Also copy `backend/uploads/` — uploaded files are **not** stored inside MongoDB. A database backup alone is incomplete. Keep backups on a separate drive and restrict access; they contain password hashes and student records.

---

## 4. Seeded Demo Accounts

All seeded accounts use the password configured in `SEED_PASSWORD` (default: `Password123`).

| Role | Name | Email | Permissions / Features |
|---|---|---|---|
| **System Administrator** | Alex Vance | `admin@lms.io` | User governance, audit logs, system-wide analytics, course instructor assignment |
| **Lead Instructor** | Dr. Marcus Chen | `marcus.chen@lms.io` | Course authoring, assignment grading, attendance sessions, live student tracking |
| **Lead Instructor** | Sarah Jenkins | `sarah.jenkins@lms.io` | Cloud curriculum authoring, quiz evaluations, attendance rosters |
| **Active Student** | Elena Rostova | `elena.rostova@student.lms.io` | Course progress, lesson viewer, assignment submissions, timed quizzes |
| **Active Student** | Sophia Martinez | `sophia.martinez@student.lms.io` | Enrolled in all curricula, live session attendance, graded results |
| **Student** | David Kim | `david.kim@student.lms.io` | Enrolled learner, attendance records |
| **Student** | Maya Patel | `maya.patel@student.lms.io` | Enrolled learner |
| **Student** | Liam O'Connor | `liam.o-connor@student.lms.io` | Enrolled learner |
| **Parent / Guardian** | Robert Martinez | `robert.martinez@family.lms.io` | Linked to Sophia Martinez: monitors progress, attendance, and exam grades |

---

## 5. Production Curricula

The seed script creates three complete courses with modules, lessons, assignments, and quizzes:

### 1. Enterprise Full-Stack Architecture: React, Node.js & Scalable Systems
- **Level:** Intermediate · **Duration:** 32 hours
- **Curriculum:** Distributed topologies, JWT revocation lifecycles, OWASP defensive API design, React 18 concurrent rendering, and real-time Socket.IO synchronization.
- **Evaluation:** Complete Architectural Blueprint assignment and a timed certification quiz.

### 2. Database Engineering & Query Optimization with MongoDB
- **Level:** Advanced · **Duration:** 24 hours
- **Curriculum:** WiredTiger storage mechanics, compound index design via the ESR rule, covered queries, and multi-stage `$facet` analytics pipelines.
- **Evaluation:** High-volume query optimization challenge and technical exam.

### 3. Cloud Infrastructure, Containers & DevOps Automation
- **Level:** Beginner · **Duration:** 20 hours
- **Curriculum:** Docker layer caching, multi-stage distroless images, automated CI regression testing gates, and structured observability telemetry.
- **Evaluation:** CI/CD pipeline implementation assignment and container fundamentals quiz.

---

## 6. Core Platform Capabilities

### Authentication & Security
- Stateless JWT with server-side token revocation and blacklist validation on critical operations.
- Role-Based Access Control (RBAC): `admin`, `instructor`, `student`, and `parent`.
- Rate limiting: 300 requests / 15 min (general API), 10 attempts / 15 min (login endpoint).
- Strict input sanitization with Joi schema validation and MongoDB query injection defenses.

### Learning & Course Player
- Content locking: lessons remain protected until a student is enrolled.
- Video and text lesson player with server-verified watch time and automatic progress checkpoints.
- Course completion certificates issued with verifiable cryptographic IDs (`/verify/:id`).

### Assignments & Grading
- Configurable submission deadlines, grace periods, and late penalty percentage deductions.
- Instructor grading interface with numeric scores, detailed written feedback, and student notifications.

### Timed Quizzes & Examinations
- Configurable time limits, attempt thresholds, randomized questions, and exam mode badges.
- Instant scoring for multiple-choice questions; manual grading workflow for written responses.

### Live Presence & Attendance Telemetry
- Real-time student presence tracking via Socket.IO (memory-only presence, zero persistent surveillance).
- Instructor-controlled live attendance sessions with automated sign-out upon disconnect and absence alerts.
- Student privacy controls: toggle live status visibility inside platform settings.

### Reports & Analytics
- Daily, weekly, and monthly activity aggregates utilizing MongoDB `$dateTrunc` bucketing.
- Course completion percentages, attendance rates, and interactive Recharts visualizations.

---

## 7. Design System & Theme Tokens

> Single source of truth for the LMS design system. All values live as CSS custom properties on `:root` in `src/styles/theme.css`.

### Colour Palette

#### Light Theme

| Token | Value | Usage |
|---|---|---|
| `--lms-primary` | `#1d4ed8` | Links, primary buttons, active states |
| `--lms-primary-hover` | `#1e40af` | Primary button hover |
| `--lms-primary-active` | `#1e3a8a` | Primary button active/pressed |
| `--lms-primary-tint` | `#eff6ff` | Hover backgrounds, active nav items |
| `--lms-accent` | `#0f9d6b` | Progress bars, success accents, brand mark |
| `--lms-accent-tint` | `#ecfdf5` | Accent hover backgrounds |
| `--lms-bg` | `#f5f7fa` | Page background |
| `--lms-surface` | `#ffffff` | Card and modal backgrounds |
| `--lms-border` | `#e3e8ef` | Dividers, input borders |
| `--lms-text` | `#111827` | Primary text — contrast ratio ≥ 7:1 on white |
| `--lms-text-muted` | `#6b7280` | Secondary text — 4.6:1 on white (AA) |
| `--lms-text-subtle` | `#9ca3af` | Placeholders, disabled labels |

#### Dark Theme

| Token | Value | Usage |
|---|---|---|
| `--lms-primary` | `#60a5fa` | Links, primary buttons, active states |
| `--lms-accent` | `#34d399` | Progress bars, success accents |
| `--lms-bg` | `#0b1220` | Page background |
| `--lms-surface` | `#111a2e` | Card backgrounds |
| `--lms-surface-raised` | `#162035` | Elevated surfaces, dropdown backgrounds |
| `--lms-border` | `#1e2d45` | Dividers |
| `--lms-text` | `#f1f5f9` | Primary text — 16:1 contrast on `#0b1220` |
| `--lms-text-muted` | `#94a3b8` | Secondary text — 4.6:1 on dark surface (AA) |

> [!IMPORTANT]
> All colour combinations meet WCAG AA (4.5:1) for normal text and WCAG AAA (7:1) for primary body text. Verify changes with a contrast checker before shipping.

### Border Radii

| Token | Value | Usage |
|---|---|---|
| `--lms-radius-sm` | `8px` | Buttons, inputs, small badges |
| `--lms-radius-md` | `12px` | Cards, dropdowns, modals |
| `--lms-radius-lg` | `16px` | Large panels |
| `--lms-radius-xl` | `24px` | Hero blocks |
| `--lms-radius-pill` | `9999px` | Badges, pills, progress bars |

### Shadows

| Token | Value | Usage |
|---|---|---|
| `--lms-shadow-sm` | `0 1px 2px rgba(16,24,40,.05)` | Subtle card resting state |
| `--lms-shadow-md` | `0 4px 12px … 0 1px 3px …` | Dropdowns, tooltips |
| `--lms-shadow-lg` | `0 12px 32px … 0 4px 8px …` | Modals, toasts |
| `--lms-card-shadow` | Same as `sm` | Card resting |
| `--lms-card-shadow-hover` | `0 8px 24px rgba(16,24,40,.12)` | Card lifted state on hover |

### Spacing Scale

Base unit: **4 px**

| Token | Value |
|---|---|
| `--lms-space-1` | 4 px |
| `--lms-space-2` | 8 px |
| `--lms-space-3` | 12 px |
| `--lms-space-4` | 16 px |
| `--lms-space-5` | 20 px |
| `--lms-space-6` | 24 px |
| `--lms-space-8` | 32 px |
| `--lms-space-10` | 40 px |
| `--lms-space-12` | 48 px |

### Typography

**Font:** Inter Variable (`@fontsource-variable/inter`) — self-hosted, no CDN.
**Body line-height:** 1.55. Numeric contexts use `font-variant-numeric: tabular-nums`.

| Token | Size | Usage |
|---|---|---|
| `--lms-text-xs` | 12 px | Table headers, helper text, group labels |
| `--lms-text-sm` | 14 px | Body copy, nav links, form labels |
| `--lms-text-base` | 16 px | Default body font size |
| `--lms-text-lg` | 18 px | Section sub-headings |
| `--lms-text-xl` | 20 px | Page headings (small) |
| `--lms-text-2xl` | 24 px | KPI values |
| `--lms-text-3xl` | 30 px | Hero headings |

### Motion

| Token | Value | Usage |
|---|---|---|
| `--lms-dur-fast` | 120 ms | Hover fills, icon scales |
| `--lms-dur-base` | 200 ms | Transitions (sidebar active bar, cards) |
| `--lms-dur-slow` | 300 ms | Page transitions, stagger entrances |
| `--lms-ease` | `cubic-bezier(.4,0,.2,1)` | Standard ease |
| `--lms-ease-out` | `cubic-bezier(0,0,.2,1)` | Entrances |
| `--lms-ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Bouncy micro-interactions (badge pop) |

> [!NOTE]
> All animations are disabled when `prefers-reduced-motion: reduce` is active, via a single blanket override in `motion.css`.

### Icon System

**Bootstrap Icons** — offline-bundled, standardized size scale:

| Context | Size | Class |
|---|---|---|
| Buttons, lists | 16 px | `.bi-sz-sm` |
| Sidebar links | 20 px | `.bi-sz-md` |
| Card headers, KPI tiles | 24 px | `.bi-sz-lg` |
| Empty states | 40 px | `.bi-sz-xl` |

<details>
<summary><strong>Icon Map</strong></summary>

| Area | Bootstrap Icon Class |
|---|---|
| Dashboard | `bi-speedometer2` |
| Courses | `bi-journal-text` |
| My Courses | `bi-bookmark-check` |
| Live Activity | `bi-activity` |
| Attendance | `bi-person-check` |
| Assignments | `bi-pencil-square` |
| Quizzes | `bi-patch-question` |
| Results | `bi-graph-up` |
| Reports | `bi-bar-chart-line` |
| Notifications | `bi-bell` |
| Users | `bi-people` |
| Settings | `bi-gear` |
| Theme Toggle (Light) | `bi-moon-stars` |
| Theme Toggle (Dark) | `bi-sun` |
| Menu (Mobile) | `bi-list` |
| Completed | `bi-check-circle-fill` |
| Locked | `bi-lock` |
| Download | `bi-download` |
| Add / New | `bi-plus-lg` |

</details>

### UI/UX Highlights

- **Theme Engine (Light & Dark):** Seamless zero-flash theme initialization via inline script prior to React render. Theme preference persisted in `localStorage` with system preference (`prefers-color-scheme`) fallback.
- **Micro-Interactions:** Subtle card lifts (`translateY(-2px)`), animated 3 px sidebar active indicator, notification bell shake animation, staggered entrance animations on cards and KPI tiles.

---

## 8. API Reference

**Base URL:** `/api`
**Authentication:** Authenticated routes require `Authorization: Bearer <token>`.
**Error format:** `{ "message": "...", "details": [{ "field": "...", "message": "..." }] }`

### 8.1 Authentication

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | `name, email, password, role` (`student` or `parent` only). Returns `{ user, token }` |
| `POST` | `/auth/login` | Public | `email, password`. Returns `{ user, token }`. 403 if suspended |
| `POST` | `/auth/logout` | Any user | Revokes all of the user's tokens |
| `GET` | `/auth/me` | Any user | Returns `{ user }` |

**Password requirements:** 8–72 characters with at least one letter and one number.

### 8.2 Users

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/users` | Admin | Query: `page, limit (≤100), role, q`. Returns paginated results |
| `POST` | `/users` | Admin | Create a user of any role |
| `GET` | `/users/:id` | Admin, self, or parent of linked student | — |
| `PATCH` | `/users/:id` | Admin or self | Admin: name, email, role, status, phone, linkedStudents, password reset. Self: name, phone. Role/status/password changes revoke tokens. Admins cannot change their own role or status |
| `DELETE` | `/users/:id` | Admin | Admins cannot delete themselves. Returns `204` |

Admin actions (`user.create`, `user.update`, `user.delete`) are written to `activitylogs` with `isAudit: true` and kept indefinitely. Routine activity logs expire after 90 days.

### 8.3 Courses

A "manager" is an admin, or an instructor assigned to the course. Draft courses are visible to managers only (others get 404).

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/courses` | Any user | Query: `page, limit (≤100), q, category, level, sort (newest/oldest/title)`; staff also `status, mine`. Each course includes `lessonCount, enrollmentCount, isEnrolled, canManage` |
| `POST` | `/courses` | Admin, instructor | Always created as `draft`. Instructors are auto-assigned; only admin may pass `instructors` |
| `GET` | `/courses/:id` | Any user | Returns `{ course, modules[{ lessons[] }], access }`. Non-members get outline only (lessons marked `locked`, no content or file URLs) |
| `PATCH` | `/courses/:id` | Manager | Publishing requires ≥ 1 lesson and ≥ 1 instructor. Only admin may change `instructors` |
| `DELETE` | `/courses/:id` | Admin | Removes modules, lessons, progress, enrollments, assignments, quizzes, attendance, and certificates |
| `GET` | `/courses/:id/enrollments` | Manager | Paginated |

### 8.4 Modules & Lessons

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/courses/:courseId/modules` | Manager | `title`. Appended to the end |
| `PATCH` / `DELETE` | `/modules/:id` | Manager | Delete also removes the module's lessons |
| `POST` | `/modules/:moduleId/lessons` | Manager | `title, type (text/video/pdf/document/image)`, plus `content` for text or `resourceUrl` for others, optional `durationSec` |
| `PATCH` / `DELETE` | `/lessons/:id` | Manager | — |
| `GET` | `/lessons/:id/access` | Manager or enrolled student (published course) | Returns the lesson with `url`. Uploaded files get a signed link valid for 6 hours |

### 8.5 Enrollment

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/enrollments` | Student (self) or admin (`studentId`) | `courseId`. Published courses only. 409 if already enrolled; re-enrolling after dropping reactivates |
| `GET` | `/enrollments/my-courses` | Student | Includes `progress: { total, completed, percent }` |
| `PATCH` | `/enrollments/:id` | Owner or admin | `{ "status": "dropped" }` |

### 8.6 Uploads & File Access

Send `multipart/form-data` with one `file` field. Admin and instructor only.

| Method | Path | Description |
|---|---|---|
| `POST` | `/uploads/resource` | mp4, webm, pdf, png, jpg, jpeg, webp, gif, doc, docx, ppt, pptx. Limit: `UPLOAD_MAX_MB` (default 100). Returns `{ url, type, originalName, size }` |
| `POST` | `/uploads/thumbnail` | png, jpg, jpeg, webp, up to 2 MB. Returns `{ url }` |
| `GET` | `/thumbnails/:name` | Public (used in `<img>` tags) |
| `GET` | `/files/:name?token=` | Requires the signed token from `/lessons/:id/access` |

Every upload is stored under a random name, and its first bytes must match its extension (a script renamed to `.pdf` is rejected and deleted).

### 8.7 Progress & Certificates

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/progress/lessons/:lessonId` | Enrolled student | Body (all optional): `watchedSec, positionSec, completed`. Sending `{}` starts the lesson's clock |
| `GET` | `/progress/:courseId` | Student (self); manager or linked parent with `?studentId=` | `{ total, completed, percent, lessons[], lastLessonId, enrollmentStatus }` |
| `GET` | `/instructor/courses/:courseId/progress` | Manager | Per-student progress. Paginated |
| `GET` | `/certificates/my` | Student | — |
| `GET` | `/certificates/verify/:verificationId` | Public | `{ valid, student, course, issuedAt }` or 404 |

**Server-side progress rules:**

- Watch time never decreases, cannot exceed the lesson length, and cannot grow faster than 2.5× real elapsed time plus 5 seconds between reports (so 2× playback works, but fabricated progress is rejected).
- A video with a set length requires ≥ 90 % watched before it can be completed. Other lessons can be marked complete directly.
- When every lesson is complete, the enrollment becomes `completed` and a certificate with a random verification ID is issued once. If a lesson is added later, the enrollment returns to `active`; the certificate stays.

### 8.8 Assignments

Parents have no access to assignment routes.

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/assignments` | Student, instructor, admin | Query: `courseId, page, limit`. Students see state (`pending`, `submitted`, `graded`, `overdue`, `closed`). Staff see `submissionCount` and `ungradedCount` |
| `POST` | `/assignments` | Manager | `courseId, title, description, dueAt (future), maxMarks, allowLate, latePenaltyPercent` |
| `GET` / `PATCH` / `DELETE` | `/assignments/:id` | Enrolled student or manager | PATCH and DELETE: manager only. DELETE also removes submissions and files |
| `GET` | `/assignments/:id/submissions` | Manager | Paginated |
| `POST` | `/assignments/:id/submit` | Enrolled student | JSON `{ answerText }` or `multipart/form-data` with `answerText` and a `file` (pdf, doc, docx, png, jpg, zip; `SUBMISSION_MAX_MB`). Requires text or a file |
| `PATCH` | `/submissions/:id/grade` | Manager | `marks (≤ maxMarks), feedback`. `finalMarks` applies the late penalty |
| `GET` | `/submissions/:id/file` | Owner or manager | Download |

**Deadline rules:** After the deadline, a submission is refused unless `allowLate` is enabled, in which case one late submission is accepted and flagged. Submissions cannot be changed after the deadline or once graded (409).

### 8.9 Quizzes & Examinations

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/quizzes` | Student, instructor, admin | Query: `courseId, page, limit`. Students get `attemptsUsed, bestPercent`; staff get `attemptCount, pendingReviewCount` |
| `POST` | `/quizzes` | Manager | `courseId, title, timeLimitMin, maxAttempts, isExam, questions[]`. MC questions need 2–6 options with exactly one correct. Descriptive questions have no options |
| `GET` | `/quizzes/:id` | Enrolled student or manager | Managers get questions with answers. Students get rules and attempts only, never the questions |
| `PATCH` / `DELETE` | `/quizzes/:id` | Manager | Questions cannot be changed once anyone has attempted (409) |
| `POST` | `/quizzes/:id/attempts` | Enrolled student | Starts or resumes an unexpired attempt. Returns questions (without answers) + `expiresAt` + `draft` (for resumed) |
| `PUT` | `/quizzes/:id/attempts/:attemptId/answers` | Owner | Autosave: stored as draft until submitted. Rejected after time expires |
| `POST` | `/quizzes/:id/attempts/:attemptId/submit` | Owner | `answers: [{ question, selectedOption }]` or `[{ question, text }]` |
| `GET` | `/quizzes/:id/attempts` | Student (own) or manager (all) | Paginated |
| `GET` | `/quiz-attempts/:id` | Owner or manager | Managers also get answers for review |
| `PATCH` | `/quiz-attempts/:id/grade` | Manager | `grades: [{ question, marks }]` for written questions only |

**Timing:** The server owns the clock. A submission > 15 seconds after the time limit is rejected and the attempt is closed with no answers. Expired attempts still count toward the limit. MC answers are scored on the server; written answers remain `submitted` until manually graded.

### 8.10 Results

`GET /results` returns graded assignments and quiz attempts, newest first, with `averagePercent`.

| Query Parameter | Description |
|---|---|
| `courseId` | Filter by course |
| `studentId` | Filter by student (parent must use linked student) |
| `type` | `assignment` or `quiz` |
| `page, limit` | Pagination |

**Access rules:** Students see only their own results. Parents must pass a linked `studentId`. Instructors see results for courses they teach. Admins see everything. Each source reads up to 500 rows before merging — use `courseId` or `studentId` filters for large courses.

### 8.11 Attendance

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/attendance/sessions` | Manager | `courseId, title, open (default true)`. Opening notifies enrolled students |
| `PATCH` | `/attendance/sessions/:id` | Manager | `{ "action": "open" }` or `{ "action": "close" }`. Closing ends open segments and alerts absent students and their linked parents |
| `GET` | `/attendance/sessions` | Student, instructor, admin | Query: `courseId, status, page, limit`. Students see own status; staff see `presentCount, enrolledCount, joinedNow` |
| `GET` | `/attendance/sessions/:id` | Manager | Roster with durations and absent list (once closed) |
| `POST` | `/attendance/sessions/:id/join` | Enrolled student | Idempotent. Server records the time |
| `POST` | `/attendance/sessions/:id/leave` | Student | Server computes the duration |
| `GET` | `/attendance/reports` | Student, parent (`studentId`), instructor, admin | Per-course sessions, attended, percentage, and minutes. Staff get per-student rows. Pre-enrollment sessions are excluded |

A student whose connection drops during a live session is signed out after `ATTENDANCE_DISCONNECT_GRACE_MS`, with the actual departure time recorded.

### 8.12 Tracking & Analytics

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/tracking/active-students` | Instructor (own courses), admin | Online students with current course and lesson. Hidden-status students appear only in `hiddenCount` |
| `GET` | `/tracking/activity` | Instructor, admin | Recent learning events, paginated. Lesson-open events are hidden for opted-out students; completions and submissions remain visible |
| `GET` | `/tracking/reports` | Student (own), instructor, admin | Query: `period (daily/weekly/monthly), courseId, tzOffset` (minutes east of UTC). Buckets of `lessonsCompleted, submissions, quizAttempts, attendanceJoins, activeStudents`. Built from stored records |
| `GET` | `/tracking/dashboard` | Role-specific | **Staff:** totals, active students, completion per course, today's attendance, assignments awaiting grading, recent activity, 7-day chart (add `allCourses=true` for full list). **Student:** own progress, assignments to do, attendance, recent completions. **Parent:** same as student with `?studentId=` for a linked student |

### 8.13 Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | Own notifications, newest first. Query: `unread, page, limit`. Includes `unreadCount` |
| `PATCH` | `/notifications/:id/read` | Own only |
| `POST` | `/notifications/read-all` | Mark all as read |
| `POST` | `/notifications/announcements` | Instructor (a course they teach) or admin (a course, or everyone). `courseId, title, body` |

Notifications are also created automatically for new assignments, grades, attendance sessions opening, and missed sessions.

### 8.14 Discussions

Course boards — members only (managers + enrolled students; parents are not members). Bodies are plain text.

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/discussions?courseId=` | Members | Pinned first, then latest activity. Paginated |
| `POST` | `/discussions` | Members | `{ courseId, title, body }`. Notifies course instructors when a student posts |
| `GET` | `/discussions/:id` | Members | Thread plus replies, `canModerate`, `canDelete` |
| `POST` | `/discussions/:id/replies` | Members | `{ body }`. Blocked for students when thread is locked. Notifies thread author |
| `PATCH` | `/discussions/:id` | Managers | `{ pinned?, locked? }` |
| `DELETE` | `/discussions/:id` | Author or manager | Also removes replies. Manager deletions of others' threads are audit-logged |
| `DELETE` | `/discussions/:id/replies/:replyId` | Author or manager | — |

Socket events: `discussion:new`, `discussion:reply` (course members and staff).

### 8.15 Direct Messages

**Messaging rules:** Students → instructors of enrolled courses. Instructors → their students, students' parents, and co-instructors. Parents → instructors of linked students' courses. Everyone → admins. Admins → anyone. Students **cannot** message each other.

| Method | Path | Description |
|---|---|---|
| `GET` | `/messages/contacts?q=` | People you are allowed to message (max 50) |
| `GET` | `/messages/conversations` | One row per person, newest first, with `unread` |
| `GET` | `/messages/unread-count` | `{ unread }` |
| `GET` | `/messages/with/:userId` | Messages with that person (`before`, `limit`). Marks theirs as read |
| `POST` | `/messages` | `{ to, body }` (max 2000 chars). 403 if not allowed |

Socket event: `message:new` to the recipient.

### 8.16 Account & Privacy

| Method | Path | Description |
|---|---|---|
| `PATCH` | `/users/:id` (self) | Students can also send `shareLiveActivity` (boolean). Turning it off removes them from instructors' live views immediately |
| `POST` | `/auth/change-password` | `currentPassword, newPassword`. Signs out every other session and live connection. Returns a fresh `token` |

### 8.17 Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ "status": "ok" }` |
| `GET` | `/health/db` | Detailed database status (see [Health Checks](#health-checks)) |

---

## 9. Real-Time Events (Socket.IO)

Connect to the API origin with `io(url, { auth: { token } })`. The same JWT as the REST API is required; a revoked or expired token is refused, and logging out, changing the password, or an admin changing the user's role/status disconnects live sockets.

Wait for the `ready` event (`{ userId, role, liveTracking, shareLiveActivity }`) before sending anything.

### Rooms

Rooms are chosen by the server from the database — clients cannot subscribe to arbitrary rooms.

| Room | Members |
|---|---|
| `user:<id>` | Everyone (own notifications, messages) |
| `course:<id>` | Enrolled students + course instructors |
| `course:<id>:staff` | Course instructors only |
| `staff:all` | Admins |

`course:join` is validated against enrollment or teaching assignments.

### Client → Server Events

Each takes an optional acknowledgement `{ ok, message }`.

| Event | Payload | Description |
|---|---|---|
| `course:join` | `{ courseId }` | Use after enrolling elsewhere; enrolling via API auto-adds connected students |
| `lesson:start` | `{ lessonId }` | Students only; enrollment is checked |
| `lesson:stop` | — | — |

### Server → Client Events

| Event | Sent To | Description |
|---|---|---|
| `ready` | Connecting user | Connection confirmed |
| `user:online` / `user:offline` | Course instructors + admins | Only for students sharing live status. `offline` sent after `PRESENCE_GRACE_MS` |
| `course:joined` / `lesson:started` / `lesson:stopped` | Course instructors + admins | Only for students sharing live status |
| `lesson:progress` | Course instructors + admins | Sent after server validates a REST progress report. Throttled to 1 per student per lesson every 5 s |
| `lesson:completed` | Course instructors + admins | Learning record: sent even if student hides live status |
| `assignment:submitted` / `quiz:submitted` / `enrollment:created` | Course instructors + admins | — |
| `attendance:opened` | Everyone in the course | — |
| `attendance:joined` / `attendance:left` | Course instructors + admins | — |
| `attendance:closed` | Course instructors, admins, and the course | — |
| `notification:new` | Recipient | — |
| `dashboard:updated` | Course instructors + admins | `{ courseId }`. Bursts are merged; refetch `/tracking/dashboard` |
| `discussion:new` / `discussion:reply` | Course members + staff | — |
| `message:new` | Recipient | — |
| `rate:limited` | Sender | > 30 events in 10 s are dropped |

> [!NOTE]
> Completion percentages, watch time, and attendance durations are never taken from socket messages — they come from REST requests the server validates or from the server's own clock. After a reconnect, clients should reload data from REST endpoints (the web app does this on every `ready`).

---

## 10. Real-Time Tracking & Privacy

The API server runs Socket.IO on the same port — there is nothing extra to start. In development, Vite proxies `/socket.io` to the API.

| Aspect | Details |
|---|---|
| **What is tracked** | Whether a student is connected, which course and lesson they have open, and learning events (lesson completed, assignment submitted, quiz finished, session joined). Nothing outside the LMS, and no location data. |
| **What is stored** | Progress, submissions, quiz results, and attendance are saved as records. Presence ("online now") is kept in memory only and is never written to the database. Routine activity-log entries expire after 90 days; audit entries are kept. |
| **Student controls** | Students see a notice that live tracking is on and can switch off sharing of their live status in Settings. Progress, submissions, and attendance are still recorded as part of the course record. |

### Tuning Parameters

| Variable | Default | Description |
|---|---|---|
| `PRESENCE_GRACE_MS` | `8000` | How long to wait before calling someone offline (prevents flicker on page reload) |
| `ATTENDANCE_DISCONNECT_GRACE_MS` | `60000` | How long a student can be disconnected before being signed out of a live session |
| `DASHBOARD_DEBOUNCE_MS` | `1500` | Debounce interval for dashboard update events |

> [!WARNING]
> **Running more than one server:** Presence is held in one process's memory. Before running multiple instances, add the Socket.IO Redis adapter and move presence to a shared store (planned for Phase 8). Until then, run a single instance.

Reports use `$dateTrunc`, so MongoDB 5 or newer is required (6+ recommended).

---

## 11. File Storage

Uploads are written to `backend/uploads/` (ignored by git):

| Subdirectory | Content |
|---|---|
| `resources/` | Lesson files (video, PDF, documents, images) |
| `thumbnails/` | Course cover images |
| `submissions/` | Student assignment uploads |

This is suitable for development and a single server. For production, put the folder on a persistent volume or move lesson media to object storage with a CDN (planned for Phase 8). Files that are replaced or removed from a lesson are not yet deleted from disk.

---

## 12. Security Notes

> [!CAUTION]
> - **Never commit `.env`.** Use HTTPS in production and set `NODE_ENV=production`.
> - The web app keeps the JWT in `localStorage`. Logout and role/status changes revoke tokens on the server. If you later need stronger XSS resistance, move to an httpOnly cookie with CSRF protection.
> - **Rate limits:** 10 login attempts per 15 minutes per IP, 300 API requests per 15 minutes.
> - Uploaded files are validated by magic bytes — a script renamed to `.pdf` is rejected and deleted.
> - Atlas URIs must never appear in frontend code or be committed to version control.
> - Backups contain password hashes and student records — store them securely and restrict access.

---

## 13. License

This project is licensed under the **MIT License**.

