import {
  type Employee,
  type AvailabilityEntry,
  type Status,
  STATUS_SHORT,
  STATUS_LABELS,
  daysInMonth,
  getWeekday,
} from '../lib/supabase'

interface Props {
  employees: Employee[]
  entries: AvailabilityEntry[]
  month: string
}

// Print-safe inline style colors (Tailwind print colors don't always work)
const PRINT_COLORS: Record<Status | 'none', string> = {
  available:       '#86efac',
  preferred_off:   '#fde68a',
  part_time_off:   '#fcd34d',
  vacation:        '#fb923c',
  training:        '#7dd3fc',
  overtime_off:    '#c4b5fd',
  no_shift:        '#fca5a5',
  no_late_shift:   '#fda4af',
  normal:          '#6ee7b7',
  preferred_shift: '#5eead4',
  none:            '#e5e7eb',
}

export default function MonthlyTable({ employees, entries, month }: Props) {
  const count = daysInMonth(month)
  const days = Array.from({ length: count }, (_, i) => i + 1)

  const lookup: Record<string, Record<number, AvailabilityEntry>> = {}
  for (const e of entries) {
    if (!lookup[e.employee_id]) lookup[e.employee_id] = {}
    lookup[e.employee_id][e.day] = e
  }

  const sorted = [...employees].sort((a, b) => a.last_name.localeCompare(b.last_name, 'de'))

  return (
    <div className="overflow-x-auto rounded-xl shadow">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="sticky left-0 bg-gray-800 z-10 px-3 py-2 text-left font-semibold min-w-[140px]">
              Mitarbeiter
            </th>
            {days.map(d => {
              const wd = getWeekday(month, d)
              const isWeekend = wd === 'Sa' || wd === 'So'
              return (
                <th key={d} className={`px-0.5 py-1 text-center font-medium min-w-[36px] ${isWeekend ? 'bg-gray-600' : 'bg-gray-800'}`}>
                  <div className="text-[10px]">{wd}</div>
                  <div>{d}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((emp, i) => (
            <tr key={emp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium text-gray-800 border-r border-gray-200 text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                {emp.last_name}, {emp.first_name}
              </td>
              {days.map(d => {
                const entry = lookup[emp.id]?.[d]
                const status: Status | 'none' = entry?.status ?? 'none'
                const color = PRINT_COLORS[status]
                return (
                  <td key={d}
                    style={{ backgroundColor: color, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                    className="text-center px-0.5 py-1 border border-white cursor-default"
                    title={entry
                      ? `${STATUS_LABELS[entry.status]}${entry.priority_points ? ` ⭐${entry.priority_points}` : ''}${entry.notes ? ` – ${entry.notes}` : ''}`
                      : 'Keine Eingabe'}>
                    <span className="font-bold text-gray-800 text-[10px] leading-tight block">
                      {entry ? STATUS_SHORT[entry.status] : '–'}
                      {entry?.notes && !entry?.priority_points && <span className="opacity-50">*</span>}
                    </span>
                    {entry?.priority_points ? (
                      <span className="text-[8px] font-bold text-amber-700 leading-none">⭐{entry.priority_points}</span>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={count + 1} className="py-8 text-center text-gray-400">Keine Mitarbeiter vorhanden.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
