import { useEffect, useState } from 'react'
import { Check, Download, FileText, Stethoscope, UserRound } from 'lucide-react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import './App.css'

type View = 'patient' | 'practitioner'
type CertificateData = {
  patientName: string
  postalAddress: string
  patientId: string
  patientSignature: string
  practitionerName: string
  practiceAddress: string
  telephone: string
  hpcsaNumber: string
  practiceNumber: string
  rightWith: string
  rightWithout: string
  rightTemporal: string
  rightTotal: string
  leftWith: string
  leftWithout: string
  leftTemporal: string
  leftTotal: string
  practitionerSignature: string
  screeningDate: string
}

const STORAGE_KEY = 'saoa-certificate-data'
const acuityOptions = ['<6/60', '6/36', '6/24', '6/18', '6/12', '6/9', '6/9+', '6/7.5', '6/7.5+', '6/6', '6/6+', '6/5+']
const initialData: CertificateData = {
  patientName: '', postalAddress: '', patientId: '', patientSignature: '',
  practitionerName: '', practiceAddress: '', telephone: '', hpcsaNumber: '', practiceNumber: '',
  rightWith: '', rightWithout: '', rightTemporal: '', rightTotal: '',
  leftWith: '', leftWithout: '', leftTemporal: '', leftTotal: '',
  practitionerSignature: '', screeningDate: '',
}

function loadData() {
  try {
    return { ...initialData, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return initialData
  }
}

function App() {
  const [view, setView] = useState<View>('patient')
  const [data, setData] = useState<CertificateData>(loadData)
  const [status, setStatus] = useState('Saved on this device')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setStatus('Saved on this device')
  }, [data])

  const update = (field: keyof CertificateData, value: string) => {
    setStatus('Saving...')
    setData((current) => ({ ...current, [field]: value }))
  }

  const patientComplete = Boolean(data.patientName && data.postalAddress && data.patientId && data.patientSignature)
  const practitionerComplete = Boolean(
    data.practitionerName && data.practiceAddress && data.hpcsaNumber && data.practiceNumber &&
    data.rightWith && data.rightWithout && data.rightTemporal && data.rightTotal &&
    data.leftWith && data.leftWithout && data.leftTemporal && data.leftTotal &&
    data.practitionerSignature && data.screeningDate,
  )

  const downloadPdf = async () => {
    const template = await fetch('/SAOA_FINAL_cleaned.pdf').then((response) => response.arrayBuffer())
    const pdfDocument = await PDFDocument.load(template)
    const page = pdfDocument.getPage(0)
    const font = await pdfDocument.embedFont(StandardFonts.Helvetica)
    const ink = rgb(0.08, 0.12, 0.24)
    const write = (value: string, x: number, y: number, size = 9, maxWidth = 300) => {
      page.drawText(value, { x, y, size, font, color: ink, maxWidth, lineHeight: size + 2 })
    }
    const markAcuity = (value: string, y: number) => {
      const index = acuityOptions.indexOf(value)
      if (index >= 0) write('X', 165 + index * 34.2, y, 10, 12)
    }
    const markChoice = (value: string, first: [number, number], second: [number, number]) => {
      if (value) write('X', ...(value === 'first' ? first : second), 10, 12)
    }

    write(data.patientName, 258, 697)
    write(data.postalAddress, 258, 654)
    write(data.patientId, 258, 611, 9, 150)
    write(data.patientSignature, 478, 611, 9, 90)
    write(data.practitionerName, 258, 561)
    write(data.practiceAddress, 258, 515, 8, 160)
    write(data.telephone, 430, 515, 8, 130)
    write(data.hpcsaNumber, 258, 474, 8, 100)
    write(data.practiceNumber, 430, 474, 8, 130)
    markAcuity(data.rightWith, 367)
    markAcuity(data.rightWithout, 338)
    markChoice(data.rightTemporal, [271, 312], [271, 291])
    markChoice(data.rightTotal, [548, 312], [548, 291])
    markAcuity(data.leftWith, 199)
    markAcuity(data.leftWithout, 179)
    markChoice(data.leftTemporal, [271, 145], [271, 124])
    markChoice(data.leftTotal, [548, 145], [548, 124])
    write(data.practitionerSignature, 262, 90, 9, 130)
    write(data.screeningDate, 425, 90, 9, 120)

    const bytes = await pdfDocument.save()
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = pdfDocument.createElement('a')
    link.href = url
    link.download = `SAOA-certificate-${data.patientId || 'draft'}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><span>SA</span><span>OA</span></div>
        <div><strong>Driver Vision Certificate</strong><small>{status}</small></div>
        <button className="download-button" type="button" onClick={downloadPdf} disabled={!patientComplete || !practitionerComplete}>
          <Download size={18} /> Download PDF
        </button>
      </header>

      <nav className="workflow" aria-label="Certificate workflow">
        <button className={view === 'patient' ? 'active' : ''} type="button" onClick={() => setView('patient')}>
          <span className="step-icon"><UserRound size={18} /></span><span><b>Patient</b><small>Fields 1-4</small></span>{patientComplete && <Check size={17} />}
        </button>
        <div className="connector" />
        <button className={view === 'practitioner' ? 'active' : ''} type="button" onClick={() => setView('practitioner')}>
          <span className="step-icon"><Stethoscope size={18} /></span><span><b>Optometrist</b><small>Fields 5-23</small></span>{practitionerComplete && <Check size={17} />}
        </button>
      </nav>

      <main>
        <section className="intro">
          <p className="eyebrow">{view === 'patient' ? 'Patient details' : 'Clinical screening'}</p>
          <h1>{view === 'patient' ? 'Your certificate starts here' : 'Record the screening results'}</h1>
          <p>{view === 'patient' ? 'Enter the details exactly as they appear on the patient’s identification.' : `Completing certificate for ${data.patientName || 'the patient'}.`}</p>
        </section>

        {view === 'patient' ? (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setView('practitioner') }}>
            <Field number="1" label="Full name and surname" value={data.patientName} onChange={(value) => update('patientName', value)} autoComplete="name" />
            <Field number="2" label="Postal address" value={data.postalAddress} onChange={(value) => update('postalAddress', value)} multiline />
            <Field number="3" label="South African ID or passport number" value={data.patientId} onChange={(value) => update('patientId', value)} />
            <Field number="4" label="Typed signature" value={data.patientSignature} onChange={(value) => update('patientSignature', value)} />
            <div className="form-actions"><span><FileText size={17} /> Details remain on this device.</span><button type="submit" disabled={!patientComplete}>Continue to optometrist</button></div>
          </form>
        ) : (
          <form className="clinical-form" onSubmit={(event) => { event.preventDefault(); void downloadPdf() }}>
            <div className="form-grid compact">
              <Field number="5" label="Full name and surname" value={data.practitionerName} onChange={(value) => update('practitionerName', value)} />
              <Field number="6" label="Practice physical address" value={data.practiceAddress} onChange={(value) => update('practiceAddress', value)} multiline />
              <Field number="7" label="Telephone number" value={data.telephone} onChange={(value) => update('telephone', value)} type="tel" />
              <Field number="8" label="HPCSA registration number" value={data.hpcsaNumber} onChange={(value) => update('hpcsaNumber', value)} />
              <Field number="9" label="Practice number" value={data.practiceNumber} onChange={(value) => update('practiceNumber', value)} />
            </div>
            <EyeTests title="Right eye" start={10} values={[data.rightWith, data.rightWithout, data.rightTemporal, data.rightTotal]} onChange={[
              (value) => update('rightWith', value), (value) => update('rightWithout', value),
              (value) => update('rightTemporal', value), (value) => update('rightTotal', value),
            ]} />
            <EyeTests title="Left eye" start={16} values={[data.leftWith, data.leftWithout, data.leftTemporal, data.leftTotal]} onChange={[
              (value) => update('leftWith', value), (value) => update('leftWithout', value),
              (value) => update('leftTemporal', value), (value) => update('leftTotal', value),
            ]} />
            <div className="form-grid compact final-fields">
              <Field number="22" label="Practitioner typed signature" value={data.practitionerSignature} onChange={(value) => update('practitionerSignature', value)} />
              <Field number="23" label="Date of screening" value={data.screeningDate} onChange={(value) => update('screeningDate', value)} type="date" />
            </div>
            <div className="form-actions"><button type="button" className="secondary" onClick={() => setView('patient')}>Back to patient</button><button type="submit" disabled={!patientComplete || !practitionerComplete}><Download size={18} /> Generate printable PDF</button></div>
          </form>
        )}
      </main>
    </div>
  )
}

function Field({ number, label, value, onChange, multiline = false, type = 'text', autoComplete }: { number: string, label: string, value: string, onChange: (value: string) => void, multiline?: boolean, type?: string, autoComplete?: string }) {
  const id = `field-${number}`
  return <label className={multiline ? 'field wide' : 'field'} htmlFor={id}><span><i>{number}</i>{label}</span>{multiline ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} required rows={2} /> : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} type={type} autoComplete={autoComplete} required />}</label>
}

function EyeTests({ title, start, values, onChange }: { title: string, start: number, values: string[], onChange: ((value: string) => void)[] }) {
  return <fieldset className="eye-tests"><legend>{title}</legend><div className="test-grid">
    <Select number={start} label="Acuity with correction" value={values[0]} options={acuityOptions.map((item) => [item, item])} onChange={onChange[0]} />
    <Select number={start + 1} label="Acuity without correction" value={values[1]} options={acuityOptions.map((item) => [item, item])} onChange={onChange[1]} />
    <Select number={`${start + 2}-${start + 3}`} label="Temporal field" value={values[2]} options={[["first", '0° to 69°'], ["second", '70° or more']]} onChange={onChange[2]} />
    <Select number={`${start + 4}-${start + 5}`} label="Total horizontal field" value={values[3]} options={[["first", 'Less than 115°'], ["second", '115° or more']]} onChange={onChange[3]} />
  </div></fieldset>
}

function Select({ number, label, value, options, onChange }: { number: number | string, label: string, value: string, options: string[][], onChange: (value: string) => void }) {
  return <label className="field"><span><i>{number}</i>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select result</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}

export default App
