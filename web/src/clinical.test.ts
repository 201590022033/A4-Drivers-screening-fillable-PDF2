import type { PDFForm } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { acuityOptions, repairMalformedVisualField, visualAcuityPasses } from './clinical'

describe('clinical display values', () => {
  it('shows decimal visual-acuity labels while retaining the existing stored values', () => {
    expect(acuityOptions).toContainEqual(['6/12', '0.5'])
    expect(acuityOptions).toContainEqual(['6/6', '1.0'])
  })

  it('treats the stated 0.5 boundary as passing', () => {
    expect(visualAcuityPasses('6/12')).toBe(true)
    expect(visualAcuityPasses('6/18')).toBe(false)
  })
})

describe('PDF visual-field repair', () => {
  it('detaches the malformed right total field from its invalid parent', () => {
    const setParent = vi.fn()
    const form = {
      getFields: () => [{
        getName: () => 'undefined.R Actual horizontal total field 70+ degrees',
        acroField: { setParent },
      }],
    } as unknown as PDFForm
    repairMalformedVisualField(form)
    expect(setParent).toHaveBeenCalledWith(undefined)
  })
})
