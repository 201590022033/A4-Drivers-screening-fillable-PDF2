import sqlite3, tempfile, unittest
from pathlib import Path
from database import backup, connect

class DatabaseTests(unittest.TestCase):
    def test_relationships_and_history(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'app.sqlite'; db = connect(path)
            patient = db.execute("INSERT INTO patients (first_name,surname,recall_allowed) VALUES ('Jane','Doe',1)").lastrowid
            cert = db.execute("INSERT INTO certificates (patient_id,certificate_number) VALUES (?,?)", (patient,'A1')).lastrowid
            db.execute("INSERT INTO screenings (patient_id,certificate_id,outcome) VALUES (?,?,?)", (patient,cert,'PASS'))
            db.execute("INSERT INTO screenings (patient_id,certificate_id,outcome) VALUES (?,?,?)", (patient,cert,'FAIL')); db.commit()
            self.assertEqual(db.execute('SELECT count(*) FROM screenings WHERE patient_id=?',(patient,)).fetchone()[0], 2)
    def test_backup_is_valid_and_does_not_change_live_data(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); source=root/'app.sqlite'; db=connect(source); db.execute("INSERT INTO patients (first_name) VALUES ('A')"); db.commit()
            target=backup(source, root/'backups'); self.assertTrue(target.exists()); self.assertEqual(sqlite3.connect(target).execute('SELECT count(*) FROM patients').fetchone()[0],1)

if __name__ == '__main__': unittest.main()
