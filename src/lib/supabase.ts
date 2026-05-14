import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Status =
  | 'available'       // Normal (default)
  | 'preferred_off'   // Wunschfrei
  | 'part_time_off'   // Teilzeitfrei
  | 'vacation'        // Urlaub
  | 'training'        // Fortbildung
  | 'overtime_off'    // Freizeitausgleich (ÜSTD)
  | 'no_shift'        // Kein Dienst
  | 'no_late_shift'   // Kein Spätdienst
  | 'normal'          // (legacy)
  | 'preferred_shift' // Wunschdienst
  | 'late_shift'      // Spätdienst

export interface Employee {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  created_at: string
}

export interface MonthDeadline {
  month: string
  deadline: string // ISO date "2026-05-25"
  created_at: string
}

export interface AvailabilityEntry {
  id: string
  employee_id: string
  month: string
  day: number
  status: Status
  notes: string | null
  priority_points: number
  submitted_at: string
}

export const WEEKEND_PRIO_MAX = 7  // Fr + Sa + So
export const WEEKDAY_PRIO_MAX = 6  // Mo – Do

// Fr/Sa/So days in month (for prio assignment)
export function getWeekendPrioDays(monthStr: string): Set<number> {
  const [year, month] = monthStr.split('-').map(Number)
  const count = new Date(year, month, 0).getDate()
  const result = new Set<number>()
  for (let d = 1; d <= count; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 5 || dow === 6) result.add(d) // Sun / Fri / Sat
  }
  return result
}

export const STATUS_LABELS: Record<Status, string> = {
  available:       'Normal',
  preferred_off:   'Wunschfrei',
  part_time_off:   'Teilzeitfrei',
  vacation:        'Urlaub',
  training:        'Fortbildung',
  overtime_off:    'Freizeitausgleich',
  no_shift:        'Kein Dienst',
  no_late_shift:   'Kein Spätdienst',
  normal:          'Normal / Egal',
  preferred_shift: 'Wunschdienst',
  late_shift:      'Spätdienst',
}

export const STATUS_SHORT: Record<Status, string> = {
  available:       'N',
  preferred_off:   'WF',
  part_time_off:   'TZ',
  vacation:        'U',
  training:        'FB',
  overtime_off:    'ÜSTD',
  no_shift:        'KD',
  no_late_shift:   'KS',
  normal:          'N/E',
  preferred_shift: 'WD',
  late_shift:      'SD',
}

// Grouped for the employee form UI
export const STATUS_GROUPS = [
  {
    label: 'Freizeit',
    statuses: ['preferred_off', 'part_time_off', 'vacation', 'training', 'overtime_off'] as Status[],
  },
  {
    label: 'Arbeitsoptionen',
    statuses: ['no_shift', 'no_late_shift', 'late_shift', 'preferred_shift'] as Status[],
  },
]

// Tailwind bg classes for calendar cells
export const STATUS_BG_CLASS: Record<Status, string> = {
  available:       'bg-green-400',
  preferred_off:   'bg-yellow-300',
  part_time_off:   'bg-amber-300',
  vacation:        'bg-orange-400',
  training:        'bg-sky-400',
  overtime_off:    'bg-violet-400',
  no_shift:        'bg-red-400',
  no_late_shift:   'bg-rose-300',
  normal:          'bg-emerald-300',
  preferred_shift: 'bg-green-700',
  late_shift:      'bg-indigo-300',
}

// ARGB hex for Excel export
export const STATUS_EXCEL_COLOR: Record<Status | 'none', string> = {
  available:       'FF86EFAC',
  preferred_off:   'FFFDE68A',
  part_time_off:   'FFFCD34D',
  vacation:        'FFFB923C',
  training:        'FF7DD3FC',
  overtime_off:    'FFC4B5FD',
  no_shift:        'FFFCA5A5',
  no_late_shift:   'FFFDA4AF',
  normal:          'FF6EE7B7',
  preferred_shift: 'FF15803D',
  late_shift:      'FFA5B4FC',
  none:            'FFE5E7EB',
}

export const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
export const WEEKDAY_NAMES_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export function getWeekdayFull(monthStr: string, day: number): string {
  const [year, month] = monthStr.split('-').map(Number)
  return WEEKDAY_NAMES_FULL[new Date(year, month - 1, day).getDay()]
}

export function getWeekendDaysInMonth(monthStr: string): Set<number> {
  const [year, month] = monthStr.split('-').map(Number)
  const count = new Date(year, month, 0).getDate()
  const weekends = new Set<number>()
  for (let d = 1; d <= count; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) weekends.add(d)
  }
  return weekends
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function daysInMonth(monthStr: string): number {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function getWeekday(monthStr: string, day: number): string {
  const [year, month] = monthStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return WEEKDAY_NAMES[date.getDay()]
}

// Months shown to employees: 2 past + current + 3 future
export function getVisibleMonths(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = -2; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    months.push(`${y}-${m}`)
  }
  return months
}

// Months shown in admin dropdowns: 1 past + current + 4 future
export function getAvailableMonths(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = -1; i <= 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    months.push(`${y}-${m}`)
  }
  return months
}

export function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  const today = new Date().toISOString().split('T')[0]
  return today > deadline
}
