# QRTimeClock 2

A clean, Firebase-ready rebuild of the temp staffing timeclock.

This repository is separate from `ZaspDragon/QRTimeclock`. No legacy production data is connected or modified.

## Current phase

The repository now contains a mobile-first staging foundation with:

- Clock In, Start Lunch, End Lunch, and Clock Out
- punch-sequence validation
- duplicate-tap/idempotency protection
- OH01/OHC branch locking support
- staffing-agency scope fields
- complete punch schema fields
- read-only worker time lookup
- daily and weekly hour calculations
- regular and overtime summaries
- manager attendance metrics
- Firebase configuration template
- starter Firestore security rules

Until Firebase is connected, punches are stored only in the current browser's `localStorage` as demo data. This is intentional so no old production records are reused.

## GitHub Pages

Enable GitHub Pages for the `main` branch and root folder. Branch-specific QR routes are designed as:

- `/clock/OH01`
- `/clock/OHC`

For static GitHub Pages, a redirect/rewrite layer or query-based fallback may be added during Firebase connection.

## Firebase setup

1. Create a brand-new Firebase project for QRTimeClock 2.
2. Enable Firebase Authentication with Email/Password for managers and agency admins.
3. Create Firestore in production mode.
4. Copy `firebase-config.example.js` to `firebase-config.js`.
5. Replace the placeholder values with the new project's web configuration.
6. Deploy `firestore.rules` after reviewing the final production schema.
7. Add required composite indexes as the manager dashboards and exports are implemented.
8. Never connect the old QRTimeclock collections directly. Use the future migration preview tool.

## Planned collections

- `users`
- `workers`
- `punches`
- `punchEdits`
- `correctionRequests`
- `weeklyTimecards`
- `agencies`
- `branches`
- `auditLogs`
- `migrationJobs`

## Safety

- Punches are soft-deleted only.
- Names are display fields, not canonical IDs.
- Every punch carries company, agency, branch, worker, date, week, timestamp, source, and audit fields.
- Agency admins will be restricted to their own agency.
- OH01 and OHC remain isolated unless an authorized account explicitly selects both.
- The old repository and old Firestore data remain untouched.

## Rollback

The previous `TIMECLOCK` repository state is preserved on:

`backup/pre-qrtimeclock2-import-2026-08-05`

To restore it, move `main` back to that branch's commit.

## Next implementation phases

1. Firebase services and canonical worker registration
2. Manager authentication and permissions
3. Edit punches, missing punches, and audit history
4. Live Agency Export, CSV, PDF, and Excel output
5. Duplicate review, merge rollback, diagnostics, and migration preview
6. Vitest and Playwright coverage
