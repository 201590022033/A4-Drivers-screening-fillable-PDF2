import { useEffect, useState } from 'react'
import { Check, Download, Eye, FileText, ShieldCheck, Stethoscope, Trash2, UserRound, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import './App.css'

type View = 'patient' | 'practitioner'
type CertificateData = {
  patientName: string
  postalAddress: string
  postalAddress2: string
  patientId: string
  patientSignature: string
  practitionerName: string
  practiceAddress: string
  practicePostalCode: string
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
  certificateNumber: string
  termsAccepted: boolean
  marketingAccepted: boolean
}

const STORAGE_KEY = 'saoa-certificate-data'
const acuityOptions = ['<6/60', '6/36', '6/24', '6/18', '6/12', '6/9', '6/9+', '6/7.5', '6/7.5+', '6/6', '6/6+', '6/5+']
const initialData: CertificateData = {
  patientName: '', postalAddress: '', postalAddress2: '', patientId: '', patientSignature: '',
  practitionerName: '', practiceAddress: '', practicePostalCode: '', telephone: '', hpcsaNumber: '', practiceNumber: '',
  rightWith: '', rightWithout: '', rightTemporal: '', rightTotal: '',
  leftWith: '', leftWithout: '', leftTemporal: '', leftTotal: '',
  practitionerSignature: '', screeningDate: '', certificateNumber: '', termsAccepted: false, marketingAccepted: false,
}

function loadData() {
  try {
    return { ...initialData, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return initialData
  }
}

function App() {
  const [view, setView] = useState<View>('patient')
  const [data, setData] = useState<CertificateData>(loadData)
  const [previewUrl, setPreviewUrl] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const update = (field: keyof CertificateData, value: string) => {
    setData((current) => ({ ...current, [field]: value }))
  }

  const clearCertificate = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setData(initialData)
    setView('patient')
    setPreviewUrl('')
    setPdfError('')
  }

  const patientComplete = Boolean(data.patientName && data.postalAddress && data.patientId && data.patientSignature && data.termsAccepted)
  const practitionerComplete = Boolean(
    data.practitionerName && data.practiceAddress && data.practicePostalCode && data.hpcsaNumber && data.practiceNumber && data.certificateNumber &&
    data.rightWith && data.rightWithout && data.rightTemporal && data.rightTotal &&
    data.leftWith && data.leftWithout && data.leftTemporal && data.leftTotal &&
    data.practitionerSignature && data.screeningDate,
  )

  const createPdf = async () => {
    const response = await fetch('/SAOA_TEMPLATE_SANITIZED.pdf')
    if (!response.ok) throw new Error('The certificate template could not be loaded.')
    const template = await response.arrayBuffer()
    const pdfDocument = await PDFDocument.load(template)
    const form = pdfDocument.getForm()
    const text = (name: string, value: string) => { if (value) form.getTextField(name).setText(value) }
    text("Patient's full name and surname", data.patientName)
    text("Patient's postal address 1", data.postalAddress)
    text("Patient's postal address 2", data.postalAddress2)
    text("Patient's ID number", data.patientId)
    text("Patient's signature", data.patientSignature)
    text("Dispensing Optician/Optometrist's full name and surname", data.practitionerName)
    text('Practice physical address', data.practiceAddress)
    text('Practice Postal Code', data.practicePostalCode)
    text('HPCSA registration number', data.hpcsaNumber)
    text('Tel Nr', data.telephone)
    text('Practice Nr', data.practiceNumber)
    text('Optometrist Signature', data.practitionerSignature)
    text('Certificate Number', data.certificateNumber)
    text('Date of screening', data.screeningDate)
    const check = (prefix: string, eye: string, value: string) => { if (value) form.getCheckBox(`${prefix} ${eye} ${value}`).check() }
    check('Acuity With glasses/contact lenses', 'R', data.rightWith)
    check('Acuity Without glasses/contact lenses', 'R', data.rightWithout)
    check('Acuity With glasses/contact lenses', 'L', data.leftWith)
    check('Acuity Without glasses/contact lenses', 'L', data.leftWithout)
    const choice = (name: string, value: string, secondName = name) => { if (value) form.getTextField(`${value === 'first' ? name : secondName} ${value === 'first' ? '0 to 69 degrees' : '70+ degrees'}`).setText('X') }
    choice('R Actual horizontal temporal field', data.rightTemporal)
    choice('R Actual horizontal total field', data.rightTotal)
    choice('L Actual horizontal temporal field', data.leftTemporal)
    choice('L Actual horizontal total field', data.leftTotal, 'undefined.R Actual horizontal total field')
    form.flatten()
    return new Uint8Array(await pdfDocument.save())
  }

  const previewPdf = async () => {
    setIsGenerating(true)
    setPdfError('')
    try {
      const bytes = await createPdf()
      setPreviewUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })))
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'The PDF could not be generated.')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadPreview = () => {
    if (!previewUrl) return
    const link = window.document.createElement('a')
    link.href = previewUrl
    link.download = `SAOA-certificate-${data.patientId || 'draft'}.pdf`
    link.click()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><span>SA</span><span>OA</span></div>
        <div><strong>Driver Vision Certificate</strong><small>Cleared automatically when this tab closes</small></div>
        <div className="topbar-actions">
          <button className="clear-button" type="button" onClick={clearCertificate} disabled={!patientComplete && !data.practitionerName} title="Erase certificate data">
            <Trash2 size={17} /> Clear
          </button>
          <button className="download-button" type="button" onClick={() => void previewPdf()} disabled={!patientComplete || !practitionerComplete || isGenerating}>
            <Eye size={18} /> {isGenerating ? 'Preparing...' : 'Preview PDF'}
          </button>
        </div>
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
            <Field number="2" label="Postal address" value={data.postalAddress} onChange={(value) => update('postalAddress', value)} />
            <Field number="2b" label="Postal address (line 2)" value={data.postalAddress2} onChange={(value) => update('postalAddress2', value)} />
            <Field number="3" label="South African ID or passport number" value={data.patientId} onChange={(value) => update('patientId', value)} />
            <Field number="4" label="Typed signature" value={data.patientSignature} onChange={(value) => update('patientSignature', value)} />
            <Consent onTerms={(value) => setData((current) => ({ ...current, termsAccepted: value }))} onMarketing={(value) => setData((current) => ({ ...current, marketingAccepted: value }))} terms={data.termsAccepted} marketing={data.marketingAccepted} />
            <div className="form-actions"><span><ShieldCheck size={17} /> Details exist only in this browser tab.</span><button type="submit" disabled={!patientComplete}>Continue to optometrist</button></div>
          </form>
        ) : (
          <form className="clinical-form" onSubmit={(event) => { event.preventDefault(); void previewPdf() }}>
            <div className="form-grid compact">
              <Field number="5" label="Full name and surname" value={data.practitionerName} onChange={(value) => update('practitionerName', value)} />
              <Field number="6" label="Practice physical address" value={data.practiceAddress} onChange={(value) => update('practiceAddress', value)} />
              <Field number="6b" label="Practice postal code" value={data.practicePostalCode} onChange={(value) => update('practicePostalCode', value)} />
              <Field number="7" label="Telephone number" value={data.telephone} onChange={(value) => update('telephone', value)} type="tel" />
              <Field number="8" label="HPCSA registration number" value={data.hpcsaNumber} onChange={(value) => update('hpcsaNumber', value)} />
              <Field number="9" label="Practice number" value={data.practiceNumber} onChange={(value) => update('practiceNumber', value)} />
              <Field number="C" label="Preprinted certificate number" value={data.certificateNumber} onChange={(value) => update('certificateNumber', value)} />
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
            <div className="form-actions"><button type="button" className="secondary" onClick={() => setView('patient')}>Back to patient</button><button type="submit" disabled={!patientComplete || !practitionerComplete || isGenerating}><Eye size={18} /> {isGenerating ? 'Preparing...' : 'Preview printable PDF'}</button></div>
          </form>
        )}
        {pdfError && <div className="error-message" role="alert">{pdfError}</div>}
      </main>
      {previewUrl && (
        <div className="preview-backdrop" role="presentation">
          <section className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <header>
              <div><p>Alignment check</p><h2 id="preview-title">Printable certificate preview</h2></div>
              <button className="icon-button" type="button" onClick={() => setPreviewUrl('')} title="Close preview" aria-label="Close preview"><X size={20} /></button>
            </header>
            <p className="preview-guidance"><FileText size={17} /> Confirm every value sits inside its intended certificate field before downloading.</p>
            <iframe src={previewUrl} title="Completed driver vision certificate" />
            <footer>
              <button className="secondary" type="button" onClick={() => setPreviewUrl('')}>Return to form</button>
              <button type="button" onClick={downloadPreview}><Download size={18} /> Download PDF</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

function Field({ number, label, value, onChange, type = 'text', autoComplete }: { number: string, label: string, value: string, onChange: (value: string) => void, type?: string, autoComplete?: string }) {
  const id = `field-${number}`
  return <label className="field" htmlFor={id}><span><i>{number}</i>{label}</span><input id={id} value={value} onChange={(event) => onChange(event.target.value)} type={type} autoComplete={autoComplete} required /></label>
}

function Consent({ terms, marketing, onTerms, onMarketing }: { terms: boolean, marketing: boolean, onTerms: (value: boolean) => void, onMarketing: (value: boolean) => void }) {
  return <fieldset className="consent-box">
    <legend>Patient authorisation</legend>
    <label><input type="checkbox" checked={terms} onChange={(e) => onTerms(e.target.checked)} required /> I accept the practice terms and conditions and acknowledge the POPIA privacy notice. I consent to my information being shared with the optometrist for this driver-vision certificate.</label>
    <label><input type="checkbox" checked={marketing} onChange={(e) => onMarketing(e.target.checked)} /> I agree that the practice may send me WhatsApp messages related to my eye health, eye tests and relevant offers. (Optional)</label>
  </fieldset>
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
