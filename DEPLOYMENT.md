# Automated Deployment & Facility Importer Guide

This document describes the automated server deployment pipeline and the Excel Facility Importer for the Hostel Management System (HMS).

---

## 1. Automated Server Update on Git Push

Every time you push code to `main` or `feat/security-hardening-and-fee-management`, the server can be automatically updated.

We support **two automatic deployment methods**:

### Option A: GitHub Actions CI/CD (Cloud VPS / Dedicated Server with SSH)

Configured in [deploy.yml](file:///.github/workflows/deploy.yml).

1. In your GitHub repository: Go to **Settings > Secrets and variables > Actions > New repository secret**.
2. Add the following secrets:
   - `SERVER_HOST`: Public IP address or domain of the production server (e.g., `192.0.2.1`).
   - `SERVER_USER`: SSH username (e.g., `ubuntu` or `root`).
   - `SERVER_SSH_KEY`: Private SSH key (`~/.ssh/id_rsa` or `id_ed25519`).
   - `DEPLOY_PATH`: Directory path on the server where the repository is cloned (e.g., `/var/www/hms`).
   - `SERVER_PORT`: (Optional, default `22`).
3. Whenever you execute `git push`, GitHub Actions will:
   - Run type checks, linting, and compile backend & frontend bundles.
   - SSH directly into your server.
   - Perform `git reset --hard origin/<branch>`.
   - Run Prisma database schema migration (`npx prisma db push`).
   - Auto-import blocks/rooms/facilities if `HMS_Hostel_Facility_Setup_Template.xlsx` is present.
   - Perform a zero-downtime reload via PM2 (`pm2 reload ecosystem.config.js`).

---

### Option B: GitHub Webhook Listener (College Intranet / Firewall / Windows / Linux)

If your campus server cannot accept inbound SSH connections from GitHub Actions, use the built-in webhook listener:

1. On the college server, run the webhook service with PM2:
   ```bash
   node scripts/webhook-deploy-server.js
   # Or via PM2:
   pm2 start scripts/webhook-deploy-server.js --name "hms-webhook"
   ```
2. In your GitHub Repository:
   - Go to **Settings > Webhooks > Add webhook**.
   - **Payload URL**: `http://<your-server-ip>:9000/webhook`
   - **Content type**: `application/json`
   - **Which events**: "Just the `push` event"
3. On every `git push`, GitHub notifies the listener, which immediately runs `scripts/deploy.sh` (or `deploy.ps1` on Windows) to pull, migrate, build, and reload the application!

---

## 2. Excel Facility Importer

The Facility Importer automatically populates Hostel Blocks, Rooms, Beds, Academic Sessions, Mess Meal Slots, and Biometric Scanner Gates from the standardized Excel template into the PostgreSQL database.

### Running via CLI:
```bash
npm run import:facility
```
Or with a custom Excel file path:
```bash
npx tsx backend/src/scripts/import-facility-excel.ts "path/to/my-template.xlsx"
```

### Running via REST API Endpoint (from Management Portal UI):
```http
POST /api/management/blocks/import-excel
Content-Type: multipart/form-data
Authorization: Bearer <ADMIN_OR_WARDEN_JWT>

file: <HMS_Hostel_Facility_Setup_Template.xlsx>
```

### Supported Sheets & Upsert Logic:
1. `1_Hostel_Blocks`: Block codes, names, total floors, gender types (BOYS / GIRLS / COED), and capacities.
2. `2_Rooms_and_Beds`: Room numbers, floor levels, room types (SINGLE, DOUBLE, TRIPLE, FOUR_SHARING, DORMITORY), monthly rent, and automatic creation of individual bed slots.
3. `3_Academic_Session`: Academic year labels, start dates, end dates, active status.
4. `4_Mess_Meal_Schedule`: Meal types (BREAKFAST, LUNCH, SNACKS, DINNER) with timing windows.
5. `5_Gates_and_Scanners`: Biometric scanner device IDs, locations, IP addresses, direction (ENTRY, EXIT, BOTH).

All imports run with transactional deduplication and emit audit logs under the administrative actor.
