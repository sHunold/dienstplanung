function easterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function shift(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function getNRWHolidays(year: number): Record<string, string> {
  const easter = easterDate(year)

  return {
    [`${year}-01-01`]: 'Neujahr',
    [fmt(shift(easter, -2))]: 'Karfreitag',
    [fmt(easter)]: 'Ostersonntag',
    [fmt(shift(easter, 1))]: 'Ostermontag',
    [`${year}-05-01`]: 'Tag der Arbeit',
    [fmt(shift(easter, 39))]: 'Christi Himmelfahrt',
    [fmt(shift(easter, 49))]: 'Pfingstsonntag',
    [fmt(shift(easter, 50))]: 'Pfingstmontag',
    [fmt(shift(easter, 60))]: 'Fronleichnam',
    [`${year}-10-03`]: 'Tag der Deutschen Einheit',
    [`${year}-11-01`]: 'Allerheiligen',
    [`${year}-12-25`]: '1. Weihnachtstag',
    [`${year}-12-26`]: '2. Weihnachtstag',
  }
}
