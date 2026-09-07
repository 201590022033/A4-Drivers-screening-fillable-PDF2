"""Local-first SQLite storage and safe backup primitives."""
from datetime import datetime
from pathlib import Path
import sqlite3, shutil

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY, first_name TEXT NOT NULL DEFAULT '', surname TEXT NOT NULL DEFAULT '', id_number TEXT NOT NULL DEFAULT '', cellphone TEXT NOT NULL DEFAULT '', postal_address TEXT NOT NULL DEFAULT '', recall_allowed INTEGER NOT NULL DEFAULT 0, marketing_allowed INTEGER NOT NULL DEFAULT 0, preferred_contact TEXT NOT NULL DEFAULT 'none', next_recall_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(surname, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_id ON patients(id_number);
CREATE INDEX IF NOT EXISTS idx_patients_cell ON patients(cellphone);
CREATE TABLE IF NOT EXISTS certificates (id INTEGER PRIMARY KEY, patient_id INTEGER REFERENCES patients(id), certificate_number TEXT UNIQUE NOT NULL, patient_token_hash TEXT UNIQUE, patient_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'DRAFT', terms_accepted INTEGER NOT NULL DEFAULT 0, marketing_accepted INTEGER NOT NULL DEFAULT 0, consent_version TEXT, issue_date TEXT, completion_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_cert_status ON certificates(status, updated_at);
CREATE TABLE IF NOT EXISTS screenings (id INTEGER PRIMARY KEY, patient_id INTEGER NOT NULL REFERENCES patients(id), certificate_id INTEGER REFERENCES certificates(id), screening_date TEXT, right_unaided_va TEXT, left_unaided_va TEXT, right_corrected_va TEXT, left_corrected_va TEXT, right_field TEXT, left_field TEXT, correction_required INTEGER NOT NULL DEFAULT 0, outcome TEXT, clinician TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_screen_date ON screenings(screening_date);
CREATE TABLE IF NOT EXISTS communications (id INTEGER PRIMARY KEY, patient_id INTEGER NOT NULL REFERENCES patients(id), certificate_id INTEGER REFERENCES certificates(id), type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'GENERATED', method TEXT NOT NULL DEFAULT 'WHATSAPP', generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT);
CREATE INDEX IF NOT EXISTS idx_comm_status ON communications(status, generated_at);
"""

def connect(path: Path):
    db = sqlite3.connect(path); db.execute('PRAGMA foreign_keys=ON'); db.executescript(SCHEMA)
    existing = {row[1] for row in db.execute('PRAGMA table_info(certificates)')}
    migrations = {'patient_id':'INTEGER','patient_token_hash':'TEXT','patient_json':"TEXT NOT NULL DEFAULT '{}'",'terms_accepted':'INTEGER NOT NULL DEFAULT 0','marketing_accepted':'INTEGER NOT NULL DEFAULT 0','consent_version':'TEXT','issue_date':'TEXT','completion_date':'TEXT'}
    for name, definition in migrations.items():
        if name not in existing: db.execute(f'ALTER TABLE certificates ADD COLUMN {name} {definition}')
    db.commit(); return db

def backup(source: Path, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f"driver-vision-backup-{datetime.now():%Y-%m-%d-%H%M%S}.sqlite"
    with connect(source) as src, sqlite3.connect(target) as dst: src.backup(dst)
    return target
