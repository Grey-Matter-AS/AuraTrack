/** The colours that tell people apart. Each is dark enough for white letters (4.5:1 or more). */
export const PATIENT_COLORS = [
  { code: 'blue', hex: '#1d4ed8' },
  { code: 'teal', hex: '#0f766e' },
  { code: 'green', hex: '#15803d' },
  { code: 'amber', hex: '#b45309' },
  { code: 'red', hex: '#b91c1c' },
  { code: 'pink', hex: '#be185d' },
  { code: 'purple', hex: '#7e22ce' },
  { code: 'slate', hex: '#475569' },
] as const;

export const colorCodeOf = (hex: string): string => PATIENT_COLORS.find((c) => c.hex === hex)?.code ?? '';
export const colorHexOf = (code: string): string =>
  PATIENT_COLORS.find((c) => c.code === code)?.hex ?? PATIENT_COLORS[0].hex;
