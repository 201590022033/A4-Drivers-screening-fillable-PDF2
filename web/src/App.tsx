import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Eye, FileText, MessageCircle, ShieldCheck, Stethoscope, Trash2, UserRound, X } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { acuityOptions, acuityToDecimal, repairMalformedVisualField, visualAcuityPasses } from './clinical'
import { parseWhatsAppReply, recallMessage, recallUrl, whatsappUrl } from './whatsapp'
import './App.css'

type View = 'patient' | 'practitioner' | 'dashboard' | 'recall'
type CertificateData = {
  patientName: string
  postalAddress: string
  postalAddress2: string
  patientId: string
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
  screeningDate: string
  certificateNumber: string
  termsAccepted: boolean
  marketingAccepted: boolean
}

type PracticeDefaults = Pick<CertificateData, 'practitionerName' | 'practiceAddress' | 'practicePostalCode' | 'telephone' | 'hpcsaNumber' | 'practiceNumber'>
type RecallRow = { id: number, name: string, cellphone: string, nextRecallDate?: string, marketingAllowed: boolean, lastScreening?: string }
type DashboardRow = { certificateNumber: string, status: string, marketingAccepted: boolean, patientName?: string }

const API_BASE = 'http://127.0.0.1:8000'
const STORAGE_KEY = 'saoa-certificate-data'
const PRACTICE_KEY = 'saoa-practice-defaults'
const initialData: CertificateData = {
  patientName: '', postalAddress: '', postalAddress2: '', patientId: '',
  practitionerName: '', practiceAddress: '', practicePostalCode: '', telephone: '', hpcsaNumber: '', practiceNumber: '',
  rightWith: '', rightWithout: '', rightTemporal: '', rightTotal: '',
  leftWith: '', leftWithout: '', leftTemporal: '', leftTotal: '',
  screeningDate: '', certificateNumber: '', termsAccepted: false, marketingAccepted: false,
}
const emptyPracticeDefaults: PracticeDefaults = {
  practitionerName: '', practiceAddress: '', practicePostalCode: '', telephone: '', hpcsaNumber: '', practiceNumber: '',
}

function loadData() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<CertificateData>
    // Old dropdown values ('first'/'second') are not real degrees; clear them so the optometrist re-enters actual measurements.
    for (const key of ['rightTemporal', 'rightTotal', 'leftTemporal', 'leftTotal'] as const) {
      if (saved[key] === 'first' || saved[key] === 'second') saved[key] = ''
    }
    return { ...initialData, ...saved }
  } catch {
    return initialData
  }
}

function loadPracticeDefaults(): PracticeDefaults {
  try {
    return { ...emptyPracticeDefaults, ...JSON.parse(localStorage.getItem(PRACTICE_KEY) ?? '{}') }
  } catch {
    return emptyPracticeDefaults
  }
}

function savePracticeDefaults(defaults: PracticeDefaults) {
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(defaults))
}

function downloadFromUrl(url: string, filename?: string) {
  const link = window.document.createElement('a')
  link.href = url
  if (filename) link.download = filename
  link.target = '_blank'
  window.document.body.appendChild(link)
  link.click()
  link.remove()
}

function App() {
  const [view, setView] = useState<View>('patient')
  const [data, setData] = useState<CertificateData>(loadData)
  const [practiceDefaults, setPracticeDefaults] = useState<PracticeDefaults>(loadPracticeDefaults)
  const [previewUrl, setPreviewUrl] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [patientPhone, setPatientPhone] = useState('')
  const [patientLink, setPatientLink] = useState('')
  const [dashboardRows, setDashboardRows] = useState<DashboardRow[]>([])
  const [dashboardCounts, setDashboardCounts] = useState<Record<string, number>>({})
  const [recallRows, setRecallRows] = useState<RecallRow[]>([])
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<ReturnType<typeof parseWhatsAppReply> | null>(null)
  const [recallPracticeName, setRecallPracticeName] = useState('')
  const [sequentialIndex, setSequentialIndex] = useState<number | null>(null)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    savePracticeDefaults(practiceDefaults)
  }, [practiceDefaults])

  // Merge practice defaults into the current certificate for display/PDF without mutating certificate state.
  const effectiveData = useMemo(() => ({
    ...data,
    practitionerName: data.practitionerName || practiceDefaults.practitionerName,
    practiceAddress: data.practiceAddress || practiceDefaults.practiceAddress,
    practicePostalCode: data.practicePostalCode || practiceDefaults.practicePostalCode,
    telephone: data.telephone || practiceDefaults.telephone,
    hpcsaNumber: data.hpcsaNumber || practiceDefaults.hpcsaNumber,
    practiceNumber: data.practiceNumber || practiceDefaults.practiceNumber,
  }), [data, practiceDefaults])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const update = (field: keyof CertificateData, value: string) => {
    setData((current) => ({ ...current, [field]: value }))
  }

  const updatePracticeDefault = (field: keyof PracticeDefaults, value: string) => {
    setPracticeDefaults((current) => ({ ...current, [field]: value }))
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
  const confirmImport = () => {
    if (!importPreview || importPreview.warning?.includes('mismatch')) return
    const p = importPreview.parsed
    setData(current => ({
      ...current,
      patientName: p.patientName?.trim() ?? current.patientName,
      patientId: p.patientId?.trim() ?? current.patientId,
      postalAddress: p.postalAddress?.trim() ?? current.postalAddress,
    }))
    setImportPreview(null)
    setImportText('')
    setView('practitioner')
  }

  const loadDashboard = async () => {
    try { const response = await fetch(`${API_BASE}/api/dashboard`); const result = await response.json() as { certificates?: DashboardRow[], counts?: Record<string, number> }; setDashboardRows(result.certificates || []); setDashboardCounts(result.counts || {}); setView('dashboard') }
    catch { setDashboardRows([]); setDashboardCounts({}); setView('dashboard'); setPdfError('Dashboard opened in local mode; the optional API service is unavailable.') }
  }
  const loadRecall = async () => { try { const response = await fetch(`${API_BASE}/api/recall`); const result = await response.json() as { patients?: RecallRow[] }; setRecallRows(result.patients || []); setView('recall') } catch { setRecallRows([]); setView('recall'); setPdfError('Recall opened in local mode; the optional API service is unavailable.') } }

  const clearCertificate = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setData(initialData)
    setView('patient')
    setPreviewUrl('')
    setPdfError('')
  }

  const patientComplete = Boolean(data.patientName && data.postalAddress && data.patientId && data.termsAccepted)
  const practitionerComplete = Boolean(
    effectiveData.practitionerName && effectiveData.practiceAddress && effectiveData.practicePostalCode && effectiveData.hpcsaNumber && effectiveData.practiceNumber && data.certificateNumber &&
    data.rightWith && data.rightWithout && data.rightTemporal && data.rightTotal &&
    data.leftWith && data.leftWithout && data.leftTemporal && data.leftTotal &&
    data.screeningDate,
  )

  const createPdf = async () => {
    const response = await fetch('/SAOA_TEMPLATE_SANITIZED.pdf')
    if (!response.ok) throw new Error('The certificate template could not be loaded.')
    const template = await response.arrayBuffer()
    const pdfDocument = await PDFDocument.load(template)
    const form = pdfDocument.getForm()
    repairMalformedVisualField(form)
    const text = (name: string, value: string) => { if (value) form.getTextField(name).setText(value) }
    text("Patient's full name and surname", data.patientName)
    text("Patient's postal address 1", data.postalAddress)
    text("Patient's postal address 2", data.postalAddress2)
    text("Patient's ID number", data.patientId)
    text("Dispensing Optician/Optometrist's full name and surname", effectiveData.practitionerName)
    text('Practice physical address', effectiveData.practiceAddress)
    text('Practice Postal Code', effectiveData.practicePostalCode)
    text('HPCSA registration number', effectiveData.hpcsaNumber)
    text('Tel Nr', effectiveData.telephone)
    text('Practice Nr', effectiveData.practiceNumber)
    text('Certificate Number', data.certificateNumber)
    text('Date of screening', data.screeningDate)
    const check = (prefix: string, eye: string, value: string) => {
      const decimal = acuityToDecimal[value]
      if (decimal) form.getCheckBox(`${prefix} ${eye} ${decimal}`).check()
    }
    check('Acuity With glasses/contact lenses', 'R', data.rightWith)
    check('Acuity Without glasses/contact lenses', 'R', data.rightWithout)
    check('Acuity With glasses/contact lenses', 'L', data.leftWith)
    check('Acuity Without glasses/contact lenses', 'L', data.leftWithout)

    const fillDegree = (name: string, value: string, highName?: string) => {
      const num = Number.parseFloat(value)
      if (Number.isNaN(num)) return
      const isHigh = name.includes('temporal') ? num >= 70 : num >= 115
      const fieldName = isHigh
        ? `${highName ?? name} 70+ degrees`
        : `${name} 0 to 69 degrees`
      try {
        form.getTextField(fieldName).setText('X')
      } catch {
        // Some high-degree fields are missing from this PDF template; skip them rather than crash.
      }
    }
    fillDegree('R Actual horizontal temporal field', data.rightTemporal)
    fillDegree('R Actual horizontal total field', data.rightTotal)
    fillDegree('L Actual horizontal temporal field', data.leftTemporal)
    fillDegree('L Actual horizontal total field', data.leftTotal)
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

  const recallRowsWithPhones = useMemo(() => recallRows.filter(row => row.cellphone), [recallRows])

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
          <p className="eyebrow">{view === 'patient' ? 'Patient details' : view === 'practitioner' ? 'Clinical screening' : view === 'dashboard' ? 'Practice intelligence' : 'Local patient communications'}</p>
          <h1>{view === 'patient' ? 'Your certificate starts here' : view === 'practitioner' ? 'Record the screening results' : view === 'dashboard' ? 'Certificate follow-up dashboard' : 'Recall & Marketing'}</h1>
          <p>{view === 'patient' ? 'Enter the details exactly as they appear on the patient’s identification.' : view === 'practitioner' ? `Completing certificate for ${effectiveData.patientName || 'the patient'}.` : view === 'dashboard' ? 'Live status counts and data exports from the local practice database.' : 'Only patients with explicit recall or marketing permission appear here. Messages are opened in WhatsApp and sent manually, one at a time.'}</p>
        </section>

        {view === 'dashboard' ? <Dashboard rows={dashboardRows} counts={dashboardCounts} practiceDefaults={practiceDefaults} onPracticeChange={updatePracticeDefault} /> : view === 'recall' ? (
          <Recall rows={recallRows} practiceName={recallPracticeName} onPracticeNameChange={setRecallPracticeName} onSendOne={(index) => setSequentialIndex(index)} onSendAll={() => setSequentialIndex(0)} />
        ) : view === 'patient' ? (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setView('practitioner') }}>
            <Field number="1" label="Full name and surname" value={data.patientName} onChange={(value) => update('patientName', value)} autoComplete="name" />
            <Field number="2" label="Postal address" value={data.postalAddress} onChange={(value) => update('postalAddress', value)} />
            <Field number="2b" label="Postal address (line 2)" value={data.postalAddress2} onChange={(value) => update('postalAddress2', value)} />
            <Field number="3" label="South African ID or passport number" value={data.patientId} onChange={(value) => update('patientId', value)} />
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
              <Field number="5" label="Full name and surname" value={effectiveData.practitionerName} onChange={(value) => update('practitionerName', value)} />
              <Field number="6" label="Practice physical address" value={effectiveData.practiceAddress} onChange={(value) => update('practiceAddress', value)} />
              <Field number="6b" label="Practice postal code" value={effectiveData.practicePostalCode} onChange={(value) => update('practicePostalCode', value)} />
              <Field number="7" label="Telephone number" value={effectiveData.telephone} onChange={(value) => update('telephone', value)} type="tel" />
              <Field number="8" label="HPCSA registration number" value={effectiveData.hpcsaNumber} onChange={(value) => update('hpcsaNumber', value)} />
              <Field number="9" label="Practice number" value={effectiveData.practiceNumber} onChange={(value) => update('practiceNumber', value)} />
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
              <Field number="22" label="Date of screening" value={data.screeningDate} onChange={(value) => update('screeningDate', value)} type="date" />
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
      {sequentialIndex !== null && (
        <SequentialWhatsApp
          key={recallRowsWithPhones[sequentialIndex]?.id}
          rows={recallRowsWithPhones}
          startIndex={sequentialIndex}
          practiceName={recallPracticeName}
          onClose={() => setSequentialIndex(null)}
          onIndexChange={setSequentialIndex}
        />
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

function Dashboard({ rows, counts, practiceDefaults, onPracticeChange }: { rows: DashboardRow[], counts: Record<string, number>, practiceDefaults: PracticeDefaults, onPracticeChange: (field: keyof PracticeDefaults, value: string) => void }) {
  const cards = [['DRAFT','Draft'],['AWAITING_PATIENT_DETAILS','Awaiting patient'],['READY_FOR_SCREENING','Ready for screening'],['COMPLETED_TODAY','Completed today']]
  return (
    <section className="dashboard-panel">
      <p className="eyebrow">Practice intelligence</p>
      <h2>Certificate follow-up dashboard</h2>
      <p>Live status counts from the local practice database.</p>
      <div className="dashboard-stats">{cards.map(([key,label]) => <strong key={key}>{counts[key] || 0}<small>{label}</small></strong>)}</div>
      <div className="dashboard-table">{rows.length ? rows.map((row) => <div className="dashboard-row" key={row.certificateNumber}><b>{row.patientName || 'Patient details pending'}<small>{row.certificateNumber}</small></b><span>{row.status}</span><span>{row.marketingAccepted ? 'WhatsApp permitted' : 'No marketing consent'}</span></div>) : <p>No certificates have been created yet.</p>}</div>

      <div className="practice-setup-panel">
        <h3>Practice setup</h3>
        <p>These details are saved on this computer and auto-filled into every new certificate.</p>
        <div className="form-grid compact">
          <label className="field"><span>Practitioner name</span><input value={practiceDefaults.practitionerName} onChange={(event) => onPracticeChange('practitionerName', event.target.value)} type="text" /></label>
          <label className="field"><span>Practice physical address</span><input value={practiceDefaults.practiceAddress} onChange={(event) => onPracticeChange('practiceAddress', event.target.value)} type="text" /></label>
          <label className="field"><span>Practice postal code</span><input value={practiceDefaults.practicePostalCode} onChange={(event) => onPracticeChange('practicePostalCode', event.target.value)} type="text" /></label>
          <label className="field"><span>Telephone number</span><input value={practiceDefaults.telephone} onChange={(event) => onPracticeChange('telephone', event.target.value)} type="tel" /></label>
          <label className="field"><span>HPCSA registration number</span><input value={practiceDefaults.hpcsaNumber} onChange={(event) => onPracticeChange('hpcsaNumber', event.target.value)} type="text" /></label>
          <label className="field"><span>Practice number</span><input value={practiceDefaults.practiceNumber} onChange={(event) => onPracticeChange('practiceNumber', event.target.value)} type="text" /></label>
        </div>
      </div>

      <div className="export-panel">
        <h3>Data &amp; backups</h3>
        <p>Download local copies of the practice data. All files stay on this computer.</p>
        <div className="export-actions">
          <button type="button" className="secondary" onClick={() => downloadFromUrl(`${API_BASE}/api/export/certificates`, 'certificates.csv')}><Download size={16} /> Certificates CSV</button>
          <button type="button" className="secondary" onClick={() => downloadFromUrl(`${API_BASE}/api/export/patients`, 'patients.csv')}><Download size={16} /> Patients CSV</button>
          <button type="button" className="secondary" onClick={() => downloadFromUrl(`${API_BASE}/api/export/screenings`, 'screenings.csv')}><Download size={16} /> Screenings CSV</button>
          <button type="button" className="secondary" onClick={() => downloadFromUrl(`${API_BASE}/api/backup`)}><Download size={16} /> Database backup</button>
        </div>
      </div>
    </section>
  )
}

function Recall({ rows, practiceName, onPracticeNameChange, onSendOne, onSendAll }: { rows: RecallRow[], practiceName: string, onPracticeNameChange: (value: string) => void, onSendOne: (index: number) => void, onSendAll: () => void }) {
  const rowsWithPhones = rows.filter(row => row.cellphone)
  const rowsWithoutPhones = rows.filter(row => !row.cellphone)
  return (
    <section className="dashboard-panel">
      <p className="eyebrow">Local patient communications</p>
      <h2>Recall &amp; Marketing</h2>
      <p>Only patients with explicit recall or marketing permission appear here. Messages are opened in WhatsApp and sent manually.</p>

      <label className="field practice-name"><span><i>🏥</i>Practice name for recall messages</span><input value={practiceName} onChange={(event) => onPracticeNameChange(event.target.value)} type="text" placeholder="e.g. Vision Plus Optometry" /></label>

      {rowsWithPhones.length > 0 && (
        <div className="recall-actions">
          <button type="button" onClick={onSendAll}><MessageCircle size={16} /> Send all sequentially ({rowsWithPhones.length})</button>
        </div>
      )}

      <div className="dashboard-table">
        {rowsWithPhones.length ? rowsWithPhones.map((row, index) => (
          <div className="dashboard-row" key={row.id}>
            <b>{row.name}<small>{row.cellphone}</small></b>
            <span>Last screening: {row.lastScreening || 'Not recorded'}</span>
            <span>{row.marketingAllowed ? 'Marketing permitted' : 'Recall only'}</span>
            <button type="button" className="secondary" onClick={() => onSendOne(index)}><MessageCircle size={14} /> Send WhatsApp</button>
          </div>
        )) : <p>No permissioned patients with a cellphone are currently due for follow-up.</p>}
      </div>

      {rowsWithoutPhones.length > 0 && (
        <div className="dashboard-table muted-table">
          <p><strong>Patients without a recorded cellphone</strong> ({rowsWithoutPhones.length}) — update their record before sending WhatsApp.</p>
          {rowsWithoutPhones.map(row => (
            <div className="dashboard-row" key={row.id}>
              <b>{row.name}<small>No cellphone recorded</small></b>
              <span>Last screening: {row.lastScreening || 'Not recorded'}</span>
              <span>{row.marketingAllowed ? 'Marketing permitted' : 'Recall only'}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SequentialWhatsApp({ rows, startIndex, practiceName, onClose, onIndexChange }: { rows: RecallRow[], startIndex: number, practiceName: string, onClose: () => void, onIndexChange: (index: number) => void }) {
  const [index, setIndex] = useState(startIndex)
  const row = rows[index]
  const [message, setMessage] = useState(() => row ? recallMessage(row.name, practiceName, row.nextRecallDate) : '')

  useEffect(() => {
    onIndexChange(index)
  }, [index, onIndexChange])

  if (!row) return null

  const url = recallUrl(row.cellphone, message)
  const openWhatsApp = () => window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <div className="preview-backdrop" role="presentation">
      <section className="preview-dialog whatsapp-dialog" role="dialog" aria-modal="true" aria-labelledby="whatsapp-title">
        <header>
          <div>
            <p>Patient {index + 1} of {rows.length}</p>
            <h2 id="whatsapp-title">Send recall WhatsApp</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Close" aria-label="Close"><X size={20} /></button>
        </header>

        <div className="whatsapp-content">
          <p className="preview-guidance"><MessageCircle size={17} /> Review the message, then open WhatsApp and send it manually. Click <strong>Next patient</strong> only after sending.</p>

          <label className="field"><span>To</span><input value={`${row.name} — ${row.cellphone}`} readOnly /></label>
          <label className="field"><span>Message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} /></label>

          <div className="generated-link">Link: <code>{url}</code></div>
        </div>

        <footer>
          <button type="button" className="secondary" onClick={onClose}>Done</button>
          <div className="nav-buttons">
            <button type="button" className="secondary" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>Previous</button>
            <button type="button" onClick={openWhatsApp}><MessageCircle size={16} /> Open WhatsApp</button>
            <button type="button" onClick={() => setIndex(i => Math.min(rows.length - 1, i + 1))} disabled={index === rows.length - 1}>Next patient</button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function EyeTests({ title, start, values, onChange }: { title: string, start: number, values: string[], onChange: ((value: string) => void)[] }) {
  return <fieldset className="eye-tests"><legend>{title}</legend><div className="test-grid">
    <Select number={start} label="Acuity with correction (decimal)" value={values[0]} options={acuityOptions} onChange={onChange[0]} hint="0.5 or more passes" />
    <Select number={start + 1} label="Acuity without correction (decimal)" value={values[1]} options={acuityOptions} onChange={onChange[1]} hint="0.5 or more passes" />
    <DegreeField number={start + 2} label="Actual temporal field (degrees)" value={values[2]} onChange={onChange[2]} hint="70° or more passes" />
    <DegreeField number={start + 3} label="Actual total horizontal field (degrees)" value={values[3]} onChange={onChange[3]} hint="115° or more passes" />
  </div></fieldset>
}

function DegreeField({ number, label, value, onChange, hint }: { number: number | string, label: string, value: string, onChange: (value: string) => void, hint: string }) {
  const num = Number.parseFloat(value)
  const passes = !Number.isNaN(num) && num >= 0
  return <label className="field"><span><i>{number}</i>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} type="number" min="0" max="180" step="1" placeholder="e.g. 85" required /><small className={passes ? 'field-hint' : 'field-warning'}>{hint}</small></label>
}

function Select({ number, label, value, options, onChange, hint }: { number: number | string, label: string, value: string, options: string[][], onChange: (value: string) => void, hint: string }) {
  const stateClass = value ? (visualAcuityPasses(value) ? 'result-pass' : 'result-fail') : ''
  return <label className="field"><span><i>{number}</i>{label}</span><select className={stateClass} value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select result</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select><small className="field-hint">{hint}</small></label>
}

export default App
