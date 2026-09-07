# A4 SAOA Driver Screening Certificate

`SAOA_FINAL_cleaned.pdf` is the canonical, print-aligned certificate template.
Do not overwrite it when generating completed certificates.

Run `python generate_certificate.py` to create `SAOA_Print_Test.pdf` from the
approved template. The patient and optometrist web forms will use the same
template as the background for the final printable certificate.

## WhatsApp patient workflow

The application does not host a patient questionnaire or send patient data to
a vendor. The practice enters the preprinted certificate number and the
patient's cellphone number, then generates an encoded `wa.me` questionnaire
and sends it manually from WhatsApp. The patient replies in WhatsApp; the
practice copies the reply into **Import WhatsApp reply**, reviews the local
labelled-field parsing, and confirms the import.

South African numbers such as `064 871 9691`, `+27 64 871 9691`, and
`27648719691` normalize to `27648719691`. Certificate mismatches are warned
about and cannot be imported silently. No patient reply is sent to a vendor.

The optometrist dashboard is the third view of the local application. The
optional `backend/app.py` service provides embedded SQLite persistence; it is
not required to generate or send the WhatsApp questionnaire.
