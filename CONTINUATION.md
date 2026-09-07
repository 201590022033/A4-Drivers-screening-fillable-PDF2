# Codex continuation handover

Date: 2026-09-07

## Product boundary

Local perpetual-license optometry workstation. Patient data stays on the
practice computer. WhatsApp uses manually sent `wa.me` links; there is no
WhatsApp API, cloud patient database, vendor telemetry, hosted patient form,
or patient localhost URL.

## Current state

- React/Vite app in `web/`.
- PDF field-layer filling uses `web/public/SAOA_TEMPLATE_SANITIZED.pdf`.
- Patient questionnaire, local deterministic reply parser, certificate mismatch
  warning and import preview are in `web/src/whatsapp.ts` and `App.tsx`.
- SQLite schema/backup foundation is in `backend/database.py`.
- HTTP API is in `backend/app.py`; it is optional and local-only.
- Dashboard is the third view. Recall & Marketing is now the fourth view and
  queries permissioned patients through `/api/recall`.

## Run

Terminal 1 from repository root: `PYTHONPATH=backend python backend/app.py`

Terminal 2: `cd web && npm run dev -- --host 127.0.0.1`

Open `http://127.0.0.1:5173/`.

## Verification

`PYTHONPATH=backend python -m unittest discover -s backend`

`cd web && npm test && npm run build && npm run lint`

All currently pass as of this handover. Vite may show a non-failing large
chunk warning.

## Next work

1. Debug manual PDF alignment and the embedded browser preview.
2. Persist the React certificate form into SQLite instead of only sessionStorage.
3. Add patient search/detail and historical screening screens.
4. Add real recall filters (screening age, due date, VA and permission) and
   communications Mark Sent/Skip records.
5. Add local analytics, CSV export and Backup Now UI.
6. Add numeric degree inputs for visual-field results marked 70° or more.

## Important limitation

The current recall queue is a foundation: it displays permissioned database
patients, but the certificate form does not yet create patient/screening rows
in SQLite. Do not treat an empty queue as a failed query until persistence is
wired.
