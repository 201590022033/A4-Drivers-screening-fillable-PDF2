export type ImportedPatient = { certificateNumber: string, patientName?: string, patientId?: string, postalAddress?: string, phone?: string }

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

function value(lines: string[], labels: string[]) {
  const index = lines.findIndex(line => labels.some(label => new RegExp(`^\\s*${label}\\s*:\\s*`, 'i').test(line)))
  if (index < 0) return ''
  const first = lines[index].replace(/^.*?:\s*/, '').trim(); if (first) return first
  const next = lines[index + 1]?.trim(); return next && !next.includes(':') ? next : ''
}

export function parseWhatsAppReply(input: string, expectedCertificate: string): { parsed: ImportedPatient, missing: string[], warning?: string } {
  const lines = input.replace(/\r/g, '').split('\n')
  const cert = value(lines, ['Certificate', 'Certificate number', 'Driver Vision Certificate'])
  const parsed: ImportedPatient = { certificateNumber: cert, patientName: value(lines, ['Full name and surname', 'Full name']), patientId: value(lines, ['ID number', 'ID']), postalAddress: value(lines, ['Postal address', 'Address']), phone: value(lines, ['Cell number', 'Cellphone', 'WhatsApp number']) }
  const missing = ['patientName', 'patientId', 'postalAddress'].filter(key => !parsed[key as keyof ImportedPatient])
  const warning = !cert ? 'No certificate number was recognised.' : cert !== expectedCertificate ? `Certificate mismatch: reply is for ${cert}, current certificate is ${expectedCertificate}.` : undefined
  return { parsed, missing, warning }
}
