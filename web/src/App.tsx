import { useEffect, useState } from 'react'
import { Check, Download, Eye, FileText, ShieldCheck, Stethoscope, Trash2, UserRound, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { parseWhatsAppReply, whatsappUrl } from './whatsapp'
import './App.css'

type View = 'patient' | 'practitioner' | 'dashboard' | 'recall'
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
  const [patientPhone, setPatientPhone] = useState('')
  const [patientLink, setPatientLink] = useState('')
  const [dashboardRows, setDashboardRows] = useState<{ certificateNumber: string, status: string, marketingAccepted: boolean, patientName?: string }[]>([])
  const [dashboardCounts, setDashboardCounts] = useState<Record<string, number>>({})
  const [recallRows, setRecallRows] = useState<{ id: number, name: string, cellphone: string, nextRecallDate?: string, marketingAllowed: boolean, lastScreening?: string }[]>([])
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<ReturnType<typeof parseWhatsAppReply> | null>(null)

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

  const generatePatientLink = async () => {
    setPdfError('')
    try {
      const whatsapp = whatsappUrl(patientPhone, data.certificateNumber || 'to be confirmed')
      setPatientLink(whatsapp)
      try { await navigator.clipboard?.writeText(whatsapp) } catch {
        const helper = window.document.createElement('textarea'); helper.value = whatsapp; helper.style.position = 'fixed'; helper.style.opacity = '0'; window.document.body.appendChild(helper); helper.select(); window.document.execCommand('copy'); helper.remove()
      }
      setPdfError('WhatsApp questionnaire link copied. Open it or paste it into WhatsApp and send manually.')
    } catch (error) { setPdfError(error instanceof Error ? error.message : 'Could not create patient link.') }
  }

  const previewImport = () => setImportPreview(parseWhatsAppReply(importText, data.certificateNumber))
  const confirmImport = () => { if (!importPreview || importPreview.warning?.includes('mismatch')) return; const p = importPreview.parsed; setData(current => ({ ...current, patientName: p.patientName || current.patientName, patientId: p.patientId || current.patientId, postalAddress: p.postalAddress || current.postalAddress })) ; setImportPreview(null); setImportText('') }

  const loadDashboard = async () => {
    try { const response = await fetch('http://127.0.0.1:8000/api/dashboard'); const result = await response.json() as { certificates?: typeof dashboardRows, counts?: Record<string, number> }; setDashboardRows(result.certificates || []); setDashboardCounts(result.counts || {}); setView('dashboard') }
    catch { setDashboardRows([]); setDashboardCounts({}); setView('dashboard'); setPdfError('Dashboard opened in local mode; the optional API service is unavailable.') }
  }
  const loadRecall = async () => { try { const response = await fetch('http://127.0.0.1:8000/api/recall'); const result = await response.json() as { patients?: typeof recallRows }; setRecallRows(result.patients || []); setView('recall') } catch { setRecallRows([]); setView('recall'); setPdfError('Recall opened in local mode; the optional API service is unavailable.') } }

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
          <button className="clear-button" type="button" onClick={() => void loadDashboard()}><FileText size={17} /> Optometrist dashboard</button>
          <button className="clear-button" type="button" onClick={() => void loadRecall()}>Recall &amp; Marketing</button>
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
        <button className={view === 'dashboard' ? 'active' : ''} type="button" onClick={() => void loadDashboard()}><span className="step-icon"><FileText size={18} /></span><span><b>Dashboard</b><small>Practice follow-up</small></span></button>
        <button className={view === 'recall' ? 'active' : ''} type="button" onClick={() => void loadRecall()}><span className="step-icon"><ShieldCheck size={18} /></span><span><b>Recall &amp; Marketing</b><small>Permission-aware queue</small></span></button>
      </nav>

      <main>
        <section className="intro">
          <p className="eyebrow">{view === 'patient' ? 'Patient details' : 'Clinical screening'}</p>
          <h1>{view === 'patient' ? 'Your certificate starts here' : 'Record the screening results'}</h1>
          <p>{view === 'patient' ? 'Enter the details exactly as they appear on the patient’s identification.' : `Completing certificate for ${data.patientName || 'the patient'}.`}</p>
        </section>

        {view === 'dashboard' ? <Dashboard rows={dashboardRows} counts={dashboardCounts} /> : view === 'recall' ? <Recall rows={recallRows} /> : view === 'patient' ? (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setView('practitioner') }}>
            <Field number="1" label="Full name and surname" value={data.patientName} onChange={(value) => update('patientName', value)} autoComplete="name" />
            <Field number="2" label="Postal address" value={data.postalAddress} onChange={(value) => update('postalAddress', value)} />
            <Field number="2b" label="Postal address (line 2)" value={data.postalAddress2} onChange={(value) => update('postalAddress2', value)} />
            <Field number="3" label="South African ID or passport number" value={data.patientId} onChange={(value) => update('patientId', value)} />
            <Field number="4" label="Typed signature" value={data.patientSignature} onChange={(value) => update('patientSignature', value)} />
            <Field number="C" label="Preprinted certificate number (practice)" value={data.certificateNumber} onChange={(value) => update('certificateNumber', value)} />
            <label className="field"><span><i>☎</i>Patient WhatsApp/cell number (practice use)</span><input value={patientPhone} onChange={(event) => setPatientPhone(event.target.value)} type="tel" placeholder="+27..." /></label>
            <Consent onTerms={(value) => setData((current) => ({ ...current, termsAccepted: value }))} onMarketing={(value) => setData((current) => ({ ...current, marketingAccepted: value }))} terms={data.termsAccepted} marketing={data.marketingAccepted} />
            <div className="form-actions"><span><ShieldCheck size={17} /> Patient details stay with the practice.</span><button type="button" className="secondary" onClick={() => void generatePatientLink()} disabled={!patientPhone || !data.certificateNumber}>WhatsApp patient details</button><button type="button" className="secondary" onClick={() => setImportPreview({ parsed: { certificateNumber: data.certificateNumber }, missing: [] })}>Import WhatsApp reply</button><button type="submit" disabled={!patientComplete}>Continue to optometrist</button></div>
            {patientLink && <p className="generated-link">Patient link: <code>{patientLink}</code></p>}
            {importPreview && <div className="import-panel"><h3>Import WhatsApp reply</h3><textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste the patient's completed WhatsApp reply here" /><button type="button" onClick={previewImport} disabled={!importText}>Preview recognised values</button>{importPreview.parsed.patientName !== undefined && <div className="import-result"><p>Full name: {importPreview.parsed.patientName || 'not recognised'}</p><p>ID number: {importPreview.parsed.patientId || 'not recognised'}</p><p>Postal address: {importPreview.parsed.postalAddress || 'not recognised'}</p>{importPreview.warning && <strong className="field-warning">{importPreview.warning}</strong>}<button type="button" onClick={confirmImport} disabled={Boolean(importPreview.warning)}>Confirm import</button><button type="button" className="secondary" onClick={() => setImportPreview(null)}>Cancel</button></div>}</div>}
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

function Dashboard({ rows, counts }: { rows: { certificateNumber: string, status: string, marketingAccepted: boolean, patientName?: string }[], counts: Record<string, number> }) {
  const cards = [['DRAFT','Draft'],['AWAITING_PATIENT_DETAILS','Awaiting patient'],['READY_FOR_SCREENING','Ready for screening'],['COMPLETED_TODAY','Completed today']]
  return <section className="dashboard-panel"><p className="eyebrow">Practice intelligence</p><h2>Certificate follow-up dashboard</h2><p>Live status counts from the local practice database.</p><div className="dashboard-stats">{cards.map(([key,label]) => <strong key={key}>{counts[key] || 0}<small>{label}</small></strong>)}</div><div className="dashboard-table">{rows.length ? rows.map((row) => <div className="dashboard-row" key={row.certificateNumber}><b>{row.patientName || 'Patient details pending'}<small>{row.certificateNumber}</small></b><span>{row.status}</span><span>{row.marketingAccepted ? 'WhatsApp permitted' : 'No marketing consent'}</span></div>) : <p>No certificates have been created yet.</p>}</div></section>
}

function Recall({ rows }: { rows: { id: number, name: string, cellphone: string, nextRecallDate?: string, marketingAllowed: boolean, lastScreening?: string }[] }) {
  return <section className="dashboard-panel"><p className="eyebrow">Local patient communications</p><h2>Recall &amp; Marketing</h2><p>Only patients with explicit recall or marketing permission appear here. Messages are opened in WhatsApp and sent manually.</p><div className="dashboard-table">{rows.length ? rows.map(row => <div className="dashboard-row" key={row.id}><b>{row.name}<small>{row.cellphone || 'No cellphone recorded'}</small></b><span>Last screening: {row.lastScreening || 'Not recorded'}</span><span>{row.marketingAllowed ? 'Marketing permitted' : 'Recall only'}</span></div>) : <p>No permissioned patients are currently due for follow-up.</p>}</div></section>
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
  const acuity = options.length > 5
  const stateClass = value ? (acuity && Number.parseFloat(value.replace('6/', '')) <= 0.5 ? 'result-fail' : !acuity ? 'result-field' : 'result-pass') : ''
  return <label className="field"><span><i>{number}</i>{label}</span><select className={stateClass} value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select result</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>{!acuity && value === 'second' && <small className="field-warning">Enter the actual horizontal degree measurement before printing.</small>}</label>
}

export default App
