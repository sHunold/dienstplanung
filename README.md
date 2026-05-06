# Dienstplanung – Shift Availability App

A full-stack shift availability web app for hospital departments. Employees submit their availability for upcoming months via a mobile-optimized form; the department head reviews submissions in a password-protected admin dashboard and exports schedules as Excel or PDF.

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend / DB**: Supabase (Postgres)
- **Export**: ExcelJS (Excel), browser print (PDF)
- **Deployment**: Vercel

---

## 1. Supabase Setup

### 1.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Choose a region close to your users (e.g. `eu-central-1`).
3. Note down the **Project URL** and the **anon/public key** from  
   `Settings → API`.

### 1.2 Run the setup SQL

1. In your Supabase project, open **SQL Editor**.
2. Paste and run the contents of [`supabase_setup.sql`](./supabase_setup.sql).  
   This creates:
   - `employees` table
   - `availability_entries` table
   - Required indexes
   - Public Row Level Security (RLS) policies

### 1.3 (Optional) Seed 20 placeholder employees

After running the setup SQL, run the contents of [`seed.sql`](./seed.sql)  
in the SQL Editor to insert 20 example employees.

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL, e.g. `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to expose client-side) |
| `VITE_ADMIN_PASSWORD` | Password protecting the admin dashboard – choose a strong one |

> **Note**: All `VITE_` variables are bundled into the client-side JS.  
> Keep `VITE_ADMIN_PASSWORD` out of public repositories.  
> The admin password check is intentionally simple (no server auth), matching the low-security requirement for an internal hospital tool.

---

## 3. Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

- **Employee form**: `http://localhost:5173/`
- **Admin dashboard**: `http://localhost:5173/admin`

---

## 4. Vercel Deployment

### 4.1 Deploy via Vercel CLI

```bash
npm install -g vercel
vercel
```

### 4.2 Deploy via Vercel Dashboard

1. Push the project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New Project**.
3. Import the repository.
4. Set the **Framework Preset** to `Vite`.
5. Add the three environment variables under **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`
6. Click **Deploy**.

The `vercel.json` in the project root ensures SPA routing works correctly.

---

## 5. Usage

### Employee Form (`/`)

1. Employee enters **Vorname**, **Nachname**, **Geburtsdatum**.
2. Selects the **Monat** to submit availability for.
3. For each day: taps one of three buttons:
   - 🟢 **Verfügbar** – available for work
   - 🔴 **Nicht verfügbar** – not available
   - 🟡 **Wunschfrei** – prefers day off
4. Optionally adds a short note per day (e.g. "Urlaub", "Fortbildung").
5. Taps **Verfügbarkeit absenden** → confirmation screen.

Re-submitting the same name + DOB + month **overwrites** the previous entry.  
Employees not found in the database see a friendly error.

### Admin Dashboard (`/admin`)

1. Enter the admin password.
2. Use the **month dropdown** to switch between months.
3. The **monthly table** shows all employees × all days, color-coded:
   - 🟢 Green = Verfügbar
   - 🔴 Red = Nicht verfügbar
   - 🟡 Yellow = Wunschfrei
   - ⚪ Grey = Keine Eingabe
   - Hover over a cell with `*` to see the note.
4. **Als Excel exportieren** – downloads a colored `.xlsx` file.
5. **Als PDF drucken** – triggers browser print with clean table layout.
6. **Mitarbeiter** button toggles the employee manager:
   - Add employees (name + date of birth).
   - Remove employees (also deletes all their entries).

---

## 6. Database Schema

```sql
-- Enum
CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'preferred_off');

-- Tables
employees (
  id            UUID PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  created_at    TIMESTAMPTZ
)

availability_entries (
  id            UUID PRIMARY KEY,
  employee_id   UUID → employees.id (CASCADE DELETE),
  month         TEXT,        -- "2025-06"
  day           INT 1–31,
  status        availability_status,
  notes         TEXT nullable,
  submitted_at  TIMESTAMPTZ
)
```

---

## 7. Security Notes

- The admin password is a **client-side check** only. Anyone with browser devtools can inspect the value. For an internal hospital intranet tool this is acceptable; for public-internet deployment consider adding a server-side auth layer.
- Supabase RLS policies allow **public read/write** since employees are identified by name + date of birth, not by an auth token. This matches the no-login requirement.
- Never commit `.env` to git. It is already in `.gitignore`.
