"""Embedded SAOA certificate API using only Python standard library + SQLite."""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
import csv, hashlib, io, json, secrets, sqlite3, sys
from pathlib import Path

# Ensure the backend folder is on sys.path even when run from a shell that does not add it.
sys.path.insert(0, str(Path(__file__).parent))

from database import backup, connect

DB = Path(__file__).with_name("saoa.sqlite3")
CONSENT_VERSION = "2026-09-07"


@contextmanager
def open_db():
    """Open the SQLite database, ensure the schema exists, commit on success, and close on exit."""
    db = connect(DB)
    try:
        yield db
        db.commit()
    finally:
        db.close()


def init_db():
    with open_db() as db:
        db.execute("UPDATE certificates SET status='DRAFT' WHERE status='patient_pending'")


def digest(token): return hashlib.sha256(token.encode()).hexdigest()


EXPORTS = {
    "/api/export/certificates": (
        ["certificate_number", "status", "patient_name", "marketing_accepted", "terms_accepted", "created_at", "updated_at"],
        """SELECT c.certificate_number, c.status, COALESCE(p.first_name || ' ' || p.surname, ''), c.marketing_accepted, c.terms_accepted, c.created_at, c.updated_at
           FROM certificates c LEFT JOIN patients p ON p.id = c.patient_id ORDER BY c.updated_at DESC""",
    ),
    "/api/export/patients": (
        ["id", "first_name", "surname", "id_number", "cellphone", "postal_address", "recall_allowed", "marketing_allowed", "preferred_contact", "next_recall_date", "created_at"],
        "SELECT id, first_name, surname, id_number, cellphone, postal_address, recall_allowed, marketing_allowed, preferred_contact, next_recall_date, created_at FROM patients ORDER BY surname, first_name",
    ),
    "/api/export/screenings": (
        ["screening_id", "patient_name", "certificate_number", "screening_date", "right_unaided_va", "left_unaided_va", "right_corrected_va", "left_corrected_va", "right_field", "left_field", "correction_required", "outcome", "clinician"],
        """SELECT s.id, COALESCE(p.first_name || ' ' || p.surname, ''), c.certificate_number, s.screening_date, s.right_unaided_va, s.left_unaided_va, s.right_corrected_va, s.left_corrected_va, s.right_field, s.left_field, s.correction_required, s.outcome, s.clinician
           FROM screenings s LEFT JOIN patients p ON p.id = s.patient_id LEFT JOIN certificates c ON c.id = s.certificate_id ORDER BY s.screening_date DESC""",
    ),
}


class API(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def send_headers(self, status, headers):
        self.send_response(status)
        for key, value in headers:
            self.send_header(key, value)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_headers(status, [("Content-Type", "application/json"), ("Content-Length", str(len(body)))])
        self.wfile.write(body)

    def send_csv(self, status, filename, headers, rows):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        body = output.getvalue().encode("utf-8-sig")
        self.send_headers(status, [
            ("Content-Type", "text/csv; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Content-Disposition", f'attachment; filename="{filename}"'),
        ])
        self.wfile.write(body)

    def send_file(self, status, path, filename):
        body = path.read_bytes()
        self.send_headers(status, [
            ("Content-Type", "application/x-sqlite3"),
            ("Content-Length", str(len(body))),
            ("Content-Disposition", f'attachment; filename="{filename}"'),
        ])
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def do_OPTIONS(self):
        self.send_json(204, {})

    def do_POST(self):
        if self.path != "/api/certificates":
            self.send_json(404, {"error": "not found"})
            return
        try:
            data = self.read_json()
            number = str(data.get("certificateNumber", "")).strip()
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "invalid JSON"})
            return
        if not number:
            self.send_json(400, {"error": "certificate number is required"})
            return
        token = secrets.token_urlsafe(32)
        try:
            with open_db() as db:
                db.execute("INSERT INTO certificates (certificate_number, patient_token_hash) VALUES (?,?)", (number, digest(token)))
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "certificate number already exists"})
            return
        self.send_json(201, {
            "certificateNumber": number,
            "patientLink": f"/patient/{token}",
            "whatsappText": f"Hello. Please complete your driver vision certificate here: /patient/{token}",
        })

    def do_GET(self):
        if self.path.startswith("/api/recall"):
            with open_db() as db:
                rows = db.execute("""SELECT p.id,p.first_name,p.surname,p.cellphone,p.next_recall_date,p.marketing_allowed,MAX(s.screening_date)
                                     FROM patients p
                                     LEFT JOIN screenings s ON s.patient_id=p.id
                                     WHERE (p.recall_allowed=1 OR p.marketing_allowed=1)
                                     GROUP BY p.id
                                     ORDER BY COALESCE(p.next_recall_date,'9999-12-31')""").fetchall()
            self.send_json(200, {"patients": [
                {"id": r[0], "name": f"{r[1]} {r[2]}".strip(), "cellphone": r[3], "nextRecallDate": r[4], "marketingAllowed": bool(r[5]), "lastScreening": r[6]}
                for r in rows
            ]})
            return

        if self.path.startswith("/api/patient/"):
            token = self.path.removeprefix("/api/patient/").split("?", 1)[0]
            with open_db() as db:
                row = db.execute("SELECT certificate_number, status, patient_json FROM certificates WHERE patient_token_hash=?", (digest(token),)).fetchone()
            if not row:
                self.send_json(404, {"error": "link expired or invalid"})
                return
            self.send_json(200, {"certificateNumber": row[0], "status": row[1], "patient": json.loads(row[2])})
            return

        if self.path.startswith("/api/dashboard"):
            with open_db() as db:
                rows = db.execute("""SELECT c.certificate_number,c.status,c.marketing_accepted,c.created_at,COALESCE(p.first_name||' '||p.surname,'')
                                     FROM certificates c
                                     LEFT JOIN patients p ON p.id=c.patient_id
                                     ORDER BY c.updated_at DESC LIMIT 50""").fetchall()
                counts = {status: db.execute("SELECT count(*) FROM certificates WHERE status=?", (status,)).fetchone()[0]
                          for status in ('DRAFT', 'AWAITING_PATIENT_DETAILS', 'READY_FOR_SCREENING', 'COMPLETED')}
                counts['COMPLETED_TODAY'] = db.execute("SELECT count(*) FROM certificates WHERE status='COMPLETED' AND date(completion_date)=date('now','localtime')").fetchone()[0]
            self.send_json(200, {
                "counts": counts,
                "certificates": [
                    {"certificateNumber": r[0], "status": r[1], "marketingAccepted": bool(r[2]), "createdAt": r[3], "patientName": r[4]}
                    for r in rows
                ],
            })
            return

        if self.path in EXPORTS:
            headers, sql = EXPORTS[self.path]
            with open_db() as db:
                rows = db.execute(sql).fetchall()
            filename = Path(self.path).name + ".csv"
            self.send_csv(200, filename, headers, rows)
            return

        if self.path.startswith("/api/backup"):
            target = backup(DB, Path(__file__).with_name("backups"))
            self.send_file(200, target, target.name)
            return

        self.send_json(404, {"error": "not found"})

    def do_PUT(self):
        if not self.path.startswith("/api/patient/"):
            self.send_json(404, {"error": "not found"})
            return
        token = self.path.removeprefix("/api/patient/").split("?", 1)[0]
        try:
            data = self.read_json()
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "invalid JSON"})
            return
        if not data.get("termsAccepted"):
            self.send_json(422, {"error": "POPIA terms must be accepted"})
            return
        with open_db() as db:
            row = db.execute("SELECT id FROM certificates WHERE patient_token_hash=?", (digest(token),)).fetchone()
            if not row:
                self.send_json(404, {"error": "link expired or invalid"})
                return
            db.execute("""UPDATE certificates
                          SET patient_json=?, terms_accepted=1, marketing_accepted=?, consent_version=?,
                              status='patient_submitted', updated_at=CURRENT_TIMESTAMP
                          WHERE id=?""",
                       (json.dumps(data), int(bool(data.get("marketingAccepted"))), CONSENT_VERSION, row[0]))
        self.send_json(200, {"status": "patient_submitted"})


if __name__ == "__main__":
    init_db()
    print("SAOA backend listening on http://localhost:8000")
    HTTPServer(("127.0.0.1", 8000), API).serve_forever()
