import {
  type Employee,
  type AvailabilityEntry,
  type Status,
  STATUS_SHORT,
  daysInMonth,
  getWeekday,
} from '../lib/supabase'

interface Props {
  employees: Employee[]
  entries: AvailabilityEntry[]
  month: string
}

const CELL_BG: Record<Status, string> = {
  available: 'bg-green-200 print-green',
  unavailable: 'bg-red-200 print-red',
  preferred_off: 'bg-yellow-200 print-yellow',
}

const CELL_TEXT: Record<Status, string> = {
  available: 'text-green-800',
  unavailable: 'text-red-800',
  preferred_off: 'text-yellow-800',
}

export default function MonthlyTable({ employees, entries, month }: Props) {
  const count = daysInMonth(month)
  const days = Array.from({ length: count }, (_, i) => i + 1)

  // Build lookup: employeeId → day → entry
  const lookup: Record<string, Record<number, AvailabilityEntry>> = {}
  for (const e of entries) {
    if (!lookup[e.employee_id]) lookup[e.employee_id] = {}
    lookup[e.employee_id][e.day] = e
  }

  const sortedEmployees = [...employees].sort((a, b) =>
    a.last_name.localeCompare(b.last_name, 'de'),
  )

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
                <th
                  key={d}
                  className={`px-1 py-1 text-center font-medium min-w-[32px] ${
                    isWeekend ? 'bg-gray-600' : 'bg-gray-800'
                  }`}
                >
                  <div>{wd}</div>
                  <div>{d}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp, i) => (
            <tr key={emp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium text-gray-800 border-r border-gray-200 ${
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}>
                {emp.last_name}, {emp.first_name}
              </td>
              {days.map(d => {
                const entry = lookup[emp.id]?.[d]
                if (!entry) {
                  return (
                    <td
                      key={d}
                      className="bg-gray-200 print-grey text-center px-0.5 py-1 border border-white"
                      title="Keine Eingabe"
                    >
                      <span className="text-gray-500">–</span>
                    </td>
                  )
                }
                return (
                  <td
                    key={d}
                    className={`text-center px-0.5 py-1 border border-white cursor-default ${CELL_BG[entry.status]}`}
                    title={
                      entry.notes
                        ? `${STATUS_SHORT[entry.status]}: ${entry.notes}`
                        : STATUS_SHORT[entry.status]
                    }
                  >
                    <span className={`font-bold ${CELL_TEXT[entry.status]}`}>
                      {STATUS_SHORT[entry.status]}
                      {entry.notes && (
                        <span className="ml-0.5 opacity-60">*</span>
                      )}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
          {sortedEmployees.length === 0 && (
            <tr>
              <td
                colSpan={count + 1}
                className="py-8 text-center text-gray-400"
              >
                Keine Mitarbeiter vorhanden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
