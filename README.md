# TANSIDCO - Staff Attendance & Leave Management System
### Tamil Nadu Small Industries Development Corporation Limited (Govt. of Tamil Nadu)

An official, enterprise-grade attendance and leave management system built specifically for TANSIDCO branch offices, administrative units, and industrial estate field stations across Tamil Nadu.

---

## 🏛️ Key Features

- **Master Staff Roster Management**:
  - Preloaded with the official 25-member TANSIDCO staff hierarchy (Branch Manager, Assistant Engineers, Superintendents, Typists, Office Assistants, etc.).
  - CSV / Excel bulk import with duplicate detection and real-time field validation.
  - Active / Inactive employee lifecycle status tracking.

- **Daily Attendance Marking**:
  - One-click bulk status marking (`Present`, `Absent`, `Casual Leave`, `Earned Leave`, `Medical Leave`, `Half Day`, `Holiday`, `Weekly Off`).
  - Strict date selection and lock prevention.
  - Offline sync queue for intermittent connectivity with automatic re-syncing.

- **Atomic Leave Management & Balances**:
  - Automated leave quotas for Casual Leave (CL: 12 days), Earned Leave (EL: 30 days), Medical Leave (ML: 180 days), Maternity Leave (180 days), and Special Casual Leave (15 days).
  - Synchronized leave deductions upon approval with automated attendance record updates.
  - Verification tracking for Medical Leave document submissions.
  - Overlap and duplicate entry prevention.

- **Official Government-Standard PDF Export Suite**:
  - **Form-I**: Daily Muster Roll / Attendance Sheet.
  - **Form-II**: Monthly Attendance & Working Days Abstract Register.
  - **Form-II(B)**: Monthly Absence & Leave Summary Abstract.
  - **Form-IV**: Staff Individual Cumulative Leave Ledger.
  - **Form-V**: Government Holiday Calendar Schedule.
  - **Form-VI**: Comprehensive System Security Audit Log.

- **Local LAN Office Network Deployment**:
  - Built-in network broadcaster to display the local IP address (e.g., `http://192.168.1.100:3000`) for LAN access across office computers and tablets.
  - Atomic database transactions with automated daily/weekly backup rotation.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 1. Installation
```bash
git clone https://github.com/your-org/tansidco-attendance-system.git
cd tansidco-attendance-system
npm install
```

### 2. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Default parameters in `.env`:
```env
PORT=3000
NODE_ENV=production
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin
SESSION_SECRET=tansidco-secure-session-key-change-in-production
```

### 3. Development Mode
Run the unified Vite + Express development server:
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### 4. Production Build & Deployment
Build the optimized client bundle and bundled Express backend:
```bash
npm run build
npm start
```

---

## 🔒 Security & Data Privacy

- **No Sensitive Office Data Committed**: The database is stored locally in `data/office_attendance.json` and backup archives in `data/backups/`, both of which are excluded by `.gitignore`.
- **Pre-loaded Initial Schema**: If no database file is detected on startup, the system automatically initializes with clean default schemas and optional demo roster loading.
- **Audit Logging**: Every create, update, delete, approval, and restore action is recorded in an immutable audit ledger.

---

## 📱 Mobile & PWA Support

The application is fully responsive and touch-optimized:
- Can be added to Home Screen as a Progressive Web Application (PWA).
- Prepared for Capacitor / Android packaging for on-site field officers.

---

## 📜 License
Government of Tamil Nadu / TANSIDCO - Proprietary internal office utility.
