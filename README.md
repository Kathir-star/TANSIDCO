# TANSIDCO
### Staff Attendance & Leave Management System
**Tamil Nadu Small Industries Development Corporation Limited (Govt. of Tamil Nadu)**

An official, enterprise-grade attendance and leave management system built specifically for TANSIDCO branch offices, administrative units, and industrial estate field stations across Tamil Nadu.

---

## Technology

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Node.js, Express
- **Package Manager**: npm
- **Database / Persistence**:
  - **Local Office Mode**: Atomic JSON/SQLite-compatible filesystem persistence (`data/office_attendance.json`) with automated JSON backups and LAN distribution.
  - **Vercel Cloud Mode**: Compatible with Vercel Serverless Functions (`/api/*`) with ephemeral/cloud-compatible database adapter.

---

## Development

```bash
# 1. Install dependencies
npm install

# 2. Start unified development server
npm run dev
```

The dev server will start on `http://localhost:3000`.

---

## Production Build

```bash
# Full build (Client + Server)
npm run build

# Or build client only
npm run build:client

# Or build server only
npm run build:server

# Start production server
npm start
```

Outputs:
- Frontend assets: `dist/` (`index.html`, `assets/`, etc.)
- Server bundle: `server-dist/server.cjs`

---

## Vercel Deployment

This project is pre-configured for one-click deployment on Vercel:

1. Push the repository to GitHub: `git push origin main`
2. In Vercel, click **Add New Project** and select your GitHub repository.
3. Vercel automatically detects the configuration from `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist`
   - **Serverless API**: Handled via `api/index.ts`
4. If you have a separate backend server URL, configure `VITE_API_URL` under **Project Settings > Environment Variables** in the Vercel Dashboard.

---

## Local Office Deployment (LAN / Windows Server)

For government office deployment inside a local area network (LAN) without internet access:

1. Clone or copy the repository onto the office computer/server.
2. Run:
   ```bash
   npm install
   npm run build
   npm start
   ```
3. The server will bind to `0.0.0.0:3000`. Other computers and tablets on the office Wi-Fi/LAN can access the app via `http://<OFFICE_PC_IP>:3000`.

---

## Environment Variables

See `.env.example` for all configurable variables:

```env
# Optional remote backend API URL (defaults to same-origin /api if left blank)
VITE_API_URL=

# Directory for local database and backups (defaults to ./data)
DATA_DIR=
```

---

## Database

- In **Local Office Mode**, all attendance records, staff profiles, leave allocations, and audit logs are stored securely in `data/office_attendance.json` and rotated in `data/backups/`.
- **Important**: Local database files (`*.db`, `*.sqlite`, `*.json` with real records, and `data/backups/`) should **NOT** be committed to public GitHub repositories.

---

## Security & Data Privacy

To protect employee privacy and government data integrity:
- **Never upload or commit**:
  - Employee attendance registers or personal records
  - Leave application details or medical certificates
  - Production database backups
  - Administrative passwords or API secrets
- All medical leave verification documents and password hashes are strictly managed locally.

---

## CI / CD

GitHub Actions workflow is configured in `.github/workflows/build.yml` to automatically verify linting, type checks (`tsc --noEmit`), and production builds on every push to `main`.
