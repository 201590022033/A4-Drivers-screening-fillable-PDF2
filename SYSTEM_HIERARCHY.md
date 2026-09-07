# SAOA Driver Vision Certificate — System Hierarchy

## 1. User experiences

- Patient page: secure token link, patient details, consent, submit/withdraw status.
- Optometrist workspace: certificate setup, patient/clinical forms, alignment preview, print/download.
- Optometrist dashboard: certificate search, status tracking, visual-acuity filters, consent-aware marketing actions.

## 2. Application layers

- React frontend: responsive forms, validation, preview, dashboard and WhatsApp hand-off.
- API backend: token sessions, certificate-number validation, consent recording, filtering, PDF generation.
- Document layer: sanitized certificate template plus authoritative PDF field geometry.
- Data layer: file-backed embedded database (SQLite) for the first production version; no database server installation.
- Messaging hand-off: `wa.me` link with a prefilled message, sent manually by practice staff.

## 3. Core records

- Practice: name, contact number, staff accounts.
- Certificate: preprinted certificate number, status, timestamps, patient token hash.
- Patient details: name, address lines, ID/passport, patient signature.
- Screening: practitioner details, acuities, visual fields, signature, screening date.
- Consent event: terms version, POPIA acknowledgement, marketing opt-in, timestamp, IP/user-agent where lawful.
- Audit event: create, edit, submit, print, download and consent changes.

## Local database foundation

`backend/database.py` owns the SQLite schema for patients, certificates,
historical screenings and communications. It enables foreign keys and adds
indexes for common patient, certificate, screening-date and communication
queries. `backup()` uses SQLite's online backup API and creates timestamped
files without replacing the live database.

## 4. Trust boundaries

- Certificate number identifies the physical certificate but is not a secret.
- Patient URL uses an unguessable, expiring, revocable random token.
- Patient data is never put in the URL or WhatsApp message.
- Marketing is allowed only when a separate affirmative marketing opt-in exists; certificate processing consent is not marketing consent.

## 5. PDF flow

`Data Fields PDF.pdf` → extract widget names/rectangles → map frontend fields → fill fields → flatten/export → print-test PDF.

The visible preprinted certificate number in the background must be masked in the sanitized template. The practice-entered number is written into the correct certificate-number field.
