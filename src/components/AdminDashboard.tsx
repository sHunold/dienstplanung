import { useEffect, useState, useCallback } from 'react'
import ExcelJS from 'exceljs'
import {
  supabase,
  type Employee,
  type AvailabilityEntry,
  type Status,
  STATUS_SHORT,
  STATUS_LABELS,
  STATUS_EXCEL_COLOR,
  daysInMonth,
  formatMonthLabel,
  getAvailableMonths,
  getWeekday,
} from '../lib/supabase'
import MonthlyTable from './MonthlyTable'
import EmployeeManager from './EmployeeManager'
import DeadlineManager from './DeadlineManager'


export default function AdminDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<AvailabilityEntry[]>([])
  const [month, setMonth] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
  const [loading, setLoading] = useState(true)
  const [showManager, setShowManager] = useState(false)
  const [showDeadlines, setShowDeadlines] = useState(false)
  const [exporting, setExporting] = useState(false)

  const availableMonths = getAvailableMonths()

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('last_name')
    setEmployees((data ?? []) as Employee[])
  }, [])

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from('availability_entries')
      .select('*')
      .eq('month', month)
    setEntries((data ?? []) as AvailabilityEntry[])
  }, [month])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadEmployees(), loadEntries()]).finally(() =>
      setLoading(false),
    )
  }, [loadEmployees, loadEntries])

  // Build lookup for stats
  const lookup: Record<string, Record<number, AvailabilityEntry>> = {}
  for (const e of entries) {
    if (!lookup[e.employee_id]) lookup[e.employee_id] = {}
    lookup[e.employee_id][e.day] = e
  }

  const submittedCount = employees.filter(
    emp => Object.keys(lookup[emp.id] ?? {}).length > 0,
  ).length

  async function exportExcel() {
    setExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Dienstplanung'
      const sheet = workbook.addWorksheet(formatMonthLabel(month))

      const count = daysInMonth(month)
      const days = Array.from({ length: count }, (_, i) => i + 1)

      const sortedEmployees = [...employees].sort((a, b) =>
        a.last_name.localeCompare(b.last_name, 'de'),
      )

      // Header row
      const headerRow = sheet.addRow([
        'Mitarbeiter',
        ...days.map(d => `${d}\n${getWeekday(month, d)}`),
      ])
      headerRow.height = 30
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        }
      })
      // Name column left-aligned
      headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

      // Data rows
      for (const emp of sortedEmployees) {
        const cells: (string | number)[] = [
          `${emp.last_name}, ${emp.first_name}`,
        ]
        for (const d of days) {
          const entry = lookup[emp.id]?.[d]
          cells.push(entry ? STATUS_SHORT[entry.status] : '–')
        }

        const row = sheet.addRow(cells)
        row.height = 18

        // Style name cell
        row.getCell(1).font = { bold: true }
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

        // Style day cells
        for (let i = 0; i < days.length; i++) {
          const cell = row.getCell(i + 2)
          const entry = lookup[emp.id]?.[days[i]]
          const colorKey: Status | 'none' = entry ? entry.status : 'none'
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: STATUS_EXCEL_COLOR[colorKey] },
          }
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          }
          if (entry?.notes) {
            cell.note = { texts: [{ text: entry.notes }] }
          }
        }
      }

      // Legend
      sheet.addRow([])
      const legendRow = sheet.addRow(['Legende:'])
      legendRow.getCell(1).font = { bold: true }
      const legendStatuses: Status[] = ['available','preferred_off','part_time_off','vacation','training','overtime_off','no_shift','no_late_shift','late_shift','preferred_shift']
      legendStatuses.forEach((s, i) => {
        const cell = legendRow.getCell(i + 2)
        cell.value = `${STATUS_SHORT[s]} = ${STATUS_LABELS[s]}`
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_EXCEL_COLOR[s] } }
      })

      // Column widths
      sheet.getColumn(1).width = 24
      for (let i = 2; i <= days.length + 1; i++) {
        sheet.getColumn(i).width = 5
      }

      // Download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Dienstplan_${month}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  // Stats
  const _totalDays = daysInMonth(month); void _totalDays

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-800 text-white px-4 py-3 no-print">
        <div className="max-w-screen-xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Dienstplan-Verwaltung</h1>
            <p className="text-gray-400 text-sm">Admin-Dashboard</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-60 flex items-center gap-1"
            >
              📊 {exporting ? 'Exportiere …' : 'Als Excel exportieren'}
            </button>
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1"
            >
              🖨️ Als PDF drucken
            </button>
            <button
              onClick={() => { setShowDeadlines(false); setShowManager(m => !m) }}
              className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-500 transition"
            >
              👥 Mitarbeiter
            </button>
            <button
              onClick={() => { setShowManager(false); setShowDeadlines(d => !d) }}
              className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700 transition"
            >
              ⏳ Fristen
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-4 space-y-4">
        {/* Print title (only visible when printing) */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">
            Dienstplan – {formatMonthLabel(month)}
          </h1>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          <StatCard
            label="Mitarbeiter"
            value={`${submittedCount} / ${employees.length}`}
            sub="haben eingereicht"
            color="blue"
          />
        </div>

        {/* Employee manager (collapsible) */}
        {showManager && (
          <div className="no-print">
            <EmployeeManager
              employees={employees}
              onRefresh={async () => {
                await loadEmployees()
                await loadEntries()
              }}
            />
          </div>
        )}

        {/* Deadline manager (collapsible) */}
        {showDeadlines && (
          <div className="no-print">
            <DeadlineManager />
          </div>
        )}

        {/* Legend */}
        <div className="no-print bg-white rounded-xl shadow p-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            <span className="text-gray-500 font-bold w-full">Legende:</span>
            {(['available','preferred_off','part_time_off','vacation','training','overtime_off',
              'no_shift','no_late_shift','late_shift','preferred_shift'] as Status[]).map(s => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`w-3 h-3 rounded-sm inline-block`}
                  style={{ backgroundColor: `#${STATUS_EXCEL_COLOR[s].slice(2)}` }} />
                <span className="font-mono text-gray-400">{STATUS_SHORT[s]}</span>
                = {STATUS_LABELS[s]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> – = Keine Eingabe
            </span>
            <span className="text-gray-400">* = Anmerkung (Hover)</span>
          </div>
        </div>

        {/* Main table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Lade Daten …</div>
        ) : (
          <MonthlyTable employees={employees} entries={entries} month={month} />
        )}
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub: string
  color: 'blue' | 'green' | 'red' | 'yellow'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-60">{sub}</p>
    </div>
  )
}
