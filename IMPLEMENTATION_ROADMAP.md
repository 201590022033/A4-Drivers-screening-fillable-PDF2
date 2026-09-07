# Implementation Roadmap and Test Gates

## Milestone 1 — Authoritative PDF mapping

- Extract and catalogue all 70 field rectangles from `Data Fields PDF.pdf`.
- Add missing address lines, postal code and certificate number.
- Replace manual coordinate drawing with PDF field filling.
- Produce `SAOA_Print_Test.pdf` from a clearly labelled test record.

Test gate: every field name maps once; generated PDF opens; text and marks remain inside the source rectangles at 100% print scale; no sample certificate number remains in the template background.

## Milestone 2 — Form and visual redesign

- Keep patient and optometrist workflows distinct.
- Add certificate-number setup to the practice workflow.
- Add the sanitized certificate as a faded optometrist alignment background.
- Add accessible validation, mobile layout, and optometrist-oriented visual language.

Test gate: keyboard navigation, mobile viewport, required-field errors, alignment screenshot review, and browser PDF preview/download smoke test.

## Milestone 3 — Embedded backend and secure patient link

- Add a small API service and SQLite database; SQLite is embedded and needs no SQL server installation.
- Store only hashed patient-link tokens; expire and revoke tokens.
- Validate certificate-number uniqueness per practice.
- Add patient submit status and optometrist retrieval.

Test gate: token cannot be guessed from certificate number; expired/revoked links fail; duplicate certificate numbers are rejected; patient cannot access another record.

## Milestone 4 — Consent and audit

- Add required acceptance of terms and POPIA privacy notice.
- Add separate optional marketing consent: “I agree that the practice may send me WhatsApp messages related to my eye health and offers.”
- Record consent version, timestamp and record status; allow withdrawal.

Test gate: submission is blocked without required consent; marketing filters exclude non-opted-in patients; withdrawal removes the patient from future marketing results.

## Milestone 5 — Dashboard and manual WhatsApp sharing

- Add filters for unaided VA, corrected VA, eye and threshold such as `< 0.7`.
- Add consent-aware custom message composition.
- Generate a `wa.me` URL; staff confirms and sends the message manually.

Test gate: generated message contains only the secure link; no patient ID or certificate number is exposed; non-consenting patients cannot be selected for marketing.

## Milestone 6 — Release hardening

- Backup/restore procedure, retention rules, audit review and deployment configuration.
- PDF regression fixtures and end-to-end tests.

Test gate: clean build, lint, API tests, PDF fixture comparison, consent audit and print verification signed off by the practice.

