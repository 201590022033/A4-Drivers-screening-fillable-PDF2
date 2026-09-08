import { describe, expect, it } from 'vitest'
import { normalizeSouthAfricanPhone, parseWhatsAppReply, recallMessage, recallUrl, whatsappUrl } from './whatsapp'

describe('WhatsApp questionnaire', () => {
  it.each([['0648719691','27648719691'],['064 871 9691','27648719691'],['+27 64 871 9691','27648719691'],['27648719691','27648719691']])('%s normalizes', (a,b) => expect(normalizeSouthAfricanPhone(a)).toBe(b))
  it('rejects invalid phones', () => expect(() => normalizeSouthAfricanPhone('123')).toThrow())
  it('encodes a questionnaire without local URLs', () => { const url = whatsappUrl('0648719691','ABC-1'); const decoded = decodeURIComponent(url); expect(url).toContain('wa.me/27648719691'); expect(decoded).toContain('ABC-1'); expect(decoded).toContain('Full name and surname:'); expect(decoded).not.toMatch(/localhost|127\.0\.0\.1|\/patient\//) })
  it('parses labelled replies and detects mismatch', () => { const result = parseWhatsAppReply('Hello\nCertificate: ABC-2\nFull name and surname: Jane Doe\nID number: 8001015009087\nPostal address: 12 Main Street\nCell number: 0821234567\nThanks', 'ABC-1'); expect(result.parsed.patientName).toBe('Jane Doe'); expect(result.warning).toContain('mismatch') })
  it('does not treat empty quoted prompts as values', () => expect(parseWhatsAppReply('Certificate: ABC-1\nFull name and surname:\nID number:\nPostal address:', 'ABC-1').missing).toHaveLength(3))
  it('captures multi-line addresses', () => {
    const reply = 'Certificate: ABC-1\nFull name and surname: Jane Doe\nID number: 8001015009087\nPostal address: 12 Main Street\nSprings\nGauteng\nCell number: 0821234567'
    const result = parseWhatsAppReply(reply, 'ABC-1')
    expect(result.parsed.postalAddress).toBe('12 Main Street, Springs, Gauteng')
    expect(result.missing).toHaveLength(0)
  })
  it('handles WhatsApp quoted formatting', () => {
    const reply = '> Certificate: ABC-1\n> Full name and surname: Jane Doe\n> ID: 8001015009087\n> Address: 12 Main Street\n> Cell: 0821234567'
    const result = parseWhatsAppReply(reply, 'ABC-1')
    expect(result.parsed.patientName).toBe('Jane Doe')
    expect(result.parsed.patientId).toBe('8001015009087')
    expect(result.parsed.postalAddress).toBe('12 Main Street')
  })
})

describe('WhatsApp recall', () => {
  it('builds a personalised recall message', () => {
    const text = recallMessage('Jane Doe', 'Vision Practice', '2026-03-15')
    expect(text).toContain('Hello Jane Doe')
    expect(text).toContain('Vision Practice')
    expect(text).toContain('2026-03-15')
  })
  it('builds a recall URL with encoded message', () => {
    const url = recallUrl('0648719691', recallMessage('Jane Doe', 'Vision Practice'))
    expect(url).toContain('wa.me/27648719691')
    expect(decodeURIComponent(url)).toContain('Hello Jane Doe')
  })
  it('rejects invalid phones for recall URLs', () => {
    expect(() => recallUrl('123', 'hello')).toThrow()
  })
})
