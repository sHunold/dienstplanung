import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Status = 'available' | 'unavailable' | 'preferred_off'

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
  submitted_at: string
}

export const STATUS_LABELS: Record<Status, string> = {
  available: 'Verfügbar',
  unavailable: 'Nicht verfügbar',
  preferred_off: 'Wunschfrei',
}

export const STATUS_SHORT: Record<Status, string> = {
  available: 'V',
  unavailable: 'N',
  preferred_off: 'W',
}

export const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

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
