import type { PDFForm } from 'pdf-lib'

export const acuityToDecimal: Record<string, string> = {
  '<6/60': '0.1', '6/36': '0.2', '6/24': '0.3', '6/18': '0.4', '6/12': '0.5',
  '6/9': '0.7', '6/9+': '0.8', '6/7.5': '0.8', '6/7.5+': '0.9',
  '6/6': '1.0', '6/6+': '1.1', '6/5+': '1.2',
}

export const acuityOptions = Object.entries(acuityToDecimal)

export function visualAcuityPasses(value: string): boolean {
  const decimal = acuityToDecimal[value]
  return Boolean(decimal) && Number.parseFloat(decimal) >= 0.5
}

export function repairMalformedVisualField(form: PDFForm): void {
  const malformedField = form.getFields().find(
    (field) => field.getName() === 'undefined.R Actual horizontal total field 70+ degrees',
  )
  malformedField?.acroField.setParent(undefined)
}
