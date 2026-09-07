# Implementation Roadmap and Test Gates

## Completed — Milestones 1–2 foundations

- Uploaded PDF field mapping, sanitized certificate template and PDF filling.
- Missing patient/practice fields, consent controls and clinical styling.
- WhatsApp questionnaire, South African phone normalization, deterministic local reply import, mismatch warning and confirmation preview.
- Initial optometrist dashboard view and embedded SQLite schema foundation.

## Milestone 3 — Dashboard and Patients

- Connect status cards and recent certificates to real SQLite records.
- Add patient search, patient detail, screening history and certificate history.
- Persist workflow states without breaking existing certificate output.

Test gate: counts derive from fixtures; partial matching works; historical screenings are never overwritten; PDF regression passes.

## Milestone 4 — Recall & Marketing

- Add local filters for screening age, due recall, correction required, unaided/corrected VA and explicit recall/marketing permissions.
- Add editable local templates and manual `wa.me` actions.
- Record Generated, Marked Sent, Skipped and Cancelled communications; never claim delivery.

Test gate: non-consenting patients are excluded; phone URLs encode correctly; communications history records user actions.

## Milestone 5 — Analytics

- Add local cards for screenings this month, recall due, correction required and completed certificates.
- Add structured VA ordering/filtering and pass/fail statistics.
- Add explicit local CSV export.

Test gate: date-range and VA fixtures produce expected counts; no patient data leaves the application.

## Milestone 6 — Backup, Restore and Release

- Add Backup Now using SQLite's safe backup API, configurable local directory and retention guidance.
- Add safety-backup-first restore confirmation.
- Add settings, migration fixtures, deployment documentation and full print verification.

Test gate: backup opens as valid SQLite; live data is unchanged; restore cannot silently overwrite; build, lint and all tests pass.
