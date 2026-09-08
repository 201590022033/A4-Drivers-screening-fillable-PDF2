export type ImportedPatient = { certificateNumber: string, patientName?: string, patientId?: string, postalAddress?: string, phone?: string }

const LABELS = {
  certificate: ['Certificate', 'Certificate number', 'Cert', 'Cert no', 'Cert #'],
  patientName: ['Full name and surname', 'Full name', 'Name and surname', 'Name'],
  patientId: ['ID number', 'ID no', 'ID', 'Identity number', 'South African ID'],
  postalAddress: ['Postal address', 'Address', 'Residential address', 'Home address'],
  phone: ['Cell number', 'Cellphone', 'Cell', 'Mobile', 'WhatsApp number', 'Contact number'],
}

export function normalizeSouthAfricanPhone(input: string): string {
  const raw = input.trim(); if (!raw) throw new Error('Enter a cellphone number.')
  const digits = raw.replace(/\D/g, '')
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits.startsWith('0') ? `27${digits.slice(1)}` : digits
  if (!/^27(6|7|8)\d{8}$/.test(normalized)) throw new Error('Enter a valid South African cellphone number, for example 064 871 9691.')
  return normalized
}

export function questionnaire(certificateNumber: string) {
  return `Hello. Please complete the details below for Driver Vision Certificate #${certificateNumber} and send this message back to us.\n\nCertificate: ${certificateNumber}\n\nFull name and surname:\nID number:\nPostal address:\nCell number:\n\nPlease check that the information is correct before sending.`
}

export function whatsappUrl(phone: string, certificateNumber: string) {
  return `https://wa.me/${normalizeSouthAfricanPhone(phone)}?text=${encodeURIComponent(questionnaire(certificateNumber))}`
}

export function recallMessage(patientName: string, practiceName: string, nextRecallDate?: string) {
  const datePart = nextRecallDate ? ` on or before ${nextRecallDate}` : ''
  return `Hello ${patientName}. This is a reminder from ${practiceName || 'the practice'} to book your next driver vision screening${datePart}. Reply to this message or call us to arrange an appointment.`
}

export function recallUrl(phone: string, message: string) {
  return `https://wa.me/${normalizeSouthAfricanPhone(phone)}?text=${encodeURIComponent(message)}`
}

function findLabelLine(lines: string[], labels: string[]) {
  return lines.findIndex(line => labels.some(label => new RegExp(`^\\s*${escapeRegex(label)}\\s*[-:]\\s*`, 'i').test(line)))
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractValue(lines: string[], labels: string[], multiline = false) {
  const index = findLabelLine(lines, labels)
  if (index < 0) return ''
  const current = lines[index].replace(/^.*?[-:]\s*/, '').trim()
  if (current && !multiline) return current

  // Collect following lines until the next known label or blank line
  const nextLines: string[] = current ? [current] : []
  for (let i = index + 1; i < lines.length && nextLines.length < 4; i++) {
    const line = lines[i].trim()
    if (!line) break
    if (isAnyLabel(line)) break
    nextLines.push(line)
  }
  return nextLines.join(', ')
}

function isAnyLabel(line: string) {
  return Object.values(LABELS).some(group => group.some(label => new RegExp(`^\\s*${escapeRegex(label)}\\s*[-:]\\s*`, 'i').test(line)))
}

export function parseWhatsAppReply(input: string, expectedCertificate: string): { parsed: ImportedPatient, missing: string[], warning?: string } {
  // Normalise WhatsApp quoted-reply formatting: remove leading "> " markers and collapse blank runs
  const cleaned = input
    .replace(/^>\s?/gm, '')
    .replace(/\r/g, '')
  const lines = cleaned.split('\n').map(line => line.trim()).filter((line, index, arr) => {
    // Keep the line if non-empty, or if it is a single blank separator between potential values
    if (line) return true
    return index > 0 && arr[index - 1] !== ''
  })

  const cert = extractValue(lines, LABELS.certificate)
  const parsed: ImportedPatient = {
    certificateNumber: cert,
    patientName: extractValue(lines, LABELS.patientName),
    patientId: extractValue(lines, LABELS.patientId),
    postalAddress: extractValue(lines, LABELS.postalAddress, true),
    phone: extractValue(lines, LABELS.phone),
  }
  const missing = ['patientName', 'patientId', 'postalAddress'].filter(key => !parsed[key as keyof ImportedPatient]?.trim())
  const warning = !cert.trim()
    ? 'No certificate number was recognised.'
    : cert.trim() !== expectedCertificate.trim()
      ? `Certificate mismatch: reply is for ${cert.trim()}, current certificate is ${expectedCertificate.trim()}.`
      : undefined
  return { parsed, missing, warning }
}
