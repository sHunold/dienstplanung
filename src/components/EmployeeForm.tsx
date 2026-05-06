import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  supabase,
  type Status,
  type Employee,
  type MonthDeadline,
  STATUS_LABELS,
  daysInMonth,
  formatMonthLabel,
  getVisibleMonths,
  isDeadlinePassed,
} from '../lib/supabase'
import { getNRWHolidays } from '../lib/holidays'

type DayData = { status: Status; notes: string }
type Step = 'identify' | 'month-select' | 'availability' | 'submitting'

interface MonthInfo {
  month: string
  hasSubmission: boolean
  isLocked: boolean
  deadline: string | null
}

const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const STATUS_BG: Record<Status, string> = {
  available: 'bg-green-400',
  unavailable: 'bg-red-400',
  preferred_off: 'bg-yellow-300',
}
const STATUS_ACTIVE_RING: Record<Status, string> = {
  available: 'ring-green-600',
  unavailable: 'ring-red-600',
  preferred_off: 'ring-yellow-500',
}
const CYCLE: Status[] = ['available', 'unavailable', 'preferred_off']

function buildDefaultDays(month: string): Record<number, DayData> {
  const count = daysInMonth(month)
  const days: Record<number, DayData> = {}
  for (let d = 1; d <= count; d++) days[d] = { status: 'available', notes: '' }
  return days
}

function buildWeeks(month: string): (number | null)[][] {
  const [year, m] = month.split('-').map(Number)
  const count = daysInMonth(month)
  const firstDay = new Date(year, m - 1, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= count; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

function dateKey(month: string, day: number): string {
  const [y, m] = month.split('-')
  return `${y}-${m}-${String(day).padStart(2, '0')}`
}

function formatDeadline(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

const VISIBLE_MONTHS = getVisibleMonths()

export default function EmployeeForm() {
  const [step, setStep] = useState<Step>('identify')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [monthInfos, setMonthInfos] = useState<MonthInfo[]>([])
  const [loadingMonths, setLoadingMonths] = useState(false)
  const [currentMonth, setCurrentMonth] = useState('')
  const [days, setDays] = useState<Record<number, DayData>>({})
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [successMonth, setSuccessMonth] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Load month overview data ─────────────────────────────────
  const loadMonthInfos = useCallback(async (emp: Employee) => {
    setLoadingMonths(true)
    const [{ data: deadlines }, { data: entries }] = await Promise.all([
      supabase.from('month_deadlines').select('*'),
      supabase
        .from('availability_entries')
        .select('month')
        .eq('employee_id', emp.id),
    ])

    const deadlineMap: Record<string, string> = {}
    for (const d of (deadlines ?? []) as MonthDeadline[]) {
      deadlineMap[d.month] = d.deadline
    }
    const submittedMonths = new Set((entries ?? []).map((e: { month: string }) => e.month))

    setMonthInfos(
      VISIBLE_MONTHS.map(m => ({
        month: m,
        hasSubmission: submittedMonths.has(m),
        isLocked: isDeadlinePassed(deadlineMap[m] ?? null),
        deadline: deadlineMap[m] ?? null,
      })),
    )
    setLoadingMonths(false)
  }, [])

  // ── Load calendar entries for a specific month ───────────────
  const loadCalendar = useCallback(async (emp: Employee, month: string) => {
    setLoadingCalendar(true)
    setSelectedDay(null)

    const [{ data: entries }, { data: deadlines }] = await Promise.all([
      supabase
        .from('availability_entries')
        .select('*')
        .eq('employee_id', emp.id)
        .eq('month', month),
      supabase
        .from('month_deadlines')
        .select('*')
        .eq('month', month)
        .maybeSingle(),
    ])

    const dl = (deadlines as MonthDeadline | null)?.deadline ?? null
    setDeadline(dl)
    setIsLocked(isDeadlinePassed(dl))

    const base = buildDefaultDays(month)
    for (const entry of (entries ?? []) as {
      day: number; status: Status; notes: string | null
    }[]) {
      base[entry.day] = { status: entry.status, notes: entry.notes ?? '' }
    }
    setDays(base)
    setLoadingCalendar(false)
  }, [])

  // ── Identification ───────────────────────────────────────────
  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('first_name', firstName.trim())
      .eq('last_name', lastName.trim())
      .eq('date_of_birth', dob)
      .single()

    if (error || !data) {
      setErrorMsg('Name nicht gefunden – bitte wende dich an das Sekretariat.')
      return
    }
    const emp = data as Employee
    setEmployee(emp)
    await loadMonthInfos(emp)
    setStep('month-select')
  }

  // ── Open a month from the selection screen ───────────────────
  async function openMonth(month: string) {
    if (!employee) return
    setCurrentMonth(month)
    setStep('availability')
    await loadCalendar(employee, month)
  }

  // ── Navigate prev / next month in calendar ───────────────────
  async function navigateMonth(direction: -1 | 1) {
    if (!employee) return
    const idx = VISIBLE_MONTHS.indexOf(currentMonth)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= VISIBLE_MONTHS.length) return
    const newMonth = VISIBLE_MONTHS[newIdx]
    setCurrentMonth(newMonth)
    await loadCalendar(employee, newMonth)
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (!employee || isLocked) return
    setStep('submitting')

    await supabase
      .from('availability_entries')
      .delete()
      .eq('employee_id', employee.id)
      .eq('month', currentMonth)

    const count = daysInMonth(currentMonth)
    const entries = []
    for (let d = 1; d <= count; d++) {
      const day = days[d]
      entries.push({
        employee_id: employee.id,
        month: currentMonth,
        day: d,
        status: day.status,
        notes: day.notes.trim() || null,
      })
    }

    const { error } = await supabase.from('availability_entries').insert(entries)
    if (error) {
      setErrorMsg('Fehler beim Speichern. Bitte versuche es erneut.')
      setStep('availability')
      return
    }

    setSuccessMonth(currentMonth)
    await loadMonthInfos(employee)
    setStep('month-select')
  }

  // ── Day interactions ─────────────────────────────────────────
  function cycleStatus(day: number) {
    if (isLocked) return
    setDays(prev => {
      const current = prev[day]?.status ?? 'available'
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
      return { ...prev, [day]: { ...prev[day], status: next } }
    })
  }
  function setNotes(day: number, notes: string) {
    setDays(prev => ({ ...prev, [day]: { ...prev[day], notes } }))
  }

  // ── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const count = daysInMonth(currentMonth || VISIBLE_MONTHS[0])
    let v = 0, w = 0, n = 0
    for (let d = 1; d <= count; d++) {
      const s = days[d]?.status ?? 'available'
      if (s === 'available') v++
      else if (s === 'preferred_off') w++
      else n++
    }
    return { v, w, n }
  }, [days, currentMonth])

  const holidays = useMemo(() => {
    if (!currentMonth) return {}
    const [year] = currentMonth.split('-').map(Number)
    return getNRWHolidays(year)
  }, [currentMonth])

  const weeks = useMemo(
    () => (currentMonth ? buildWeeks(currentMonth) : []),
    [currentMonth],
  )

  const currentIdx = VISIBLE_MONTHS.indexOf(currentMonth)

  // Auto-clear success flash after 4 s
  useEffect(() => {
    if (!successMonth) return
    const t = setTimeout(() => setSuccessMonth(null), 4000)
    return () => clearTimeout(t)
  }, [successMonth])

  // ════════════════════════════════════════════════════════════
  // Identify step
  // ════════════════════════════════════════════════════════════
  if (step === 'identify') {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-blue-800">Dienstplanung</h1>
            <p className="text-gray-500 text-sm mt-1">Verfügbarkeit eintragen</p>
          </div>
          <form onSubmit={handleIdentify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
              <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Max" autoComplete="given-name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nachname</label>
              <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Mustermann" autoComplete="family-name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
              <input type="date" required value={dob} onChange={e => setDob(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{errorMsg}</div>
            )}
            <button type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-lg">
              Weiter →
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // Month selection step
  // ════════════════════════════════════════════════════════════
  if (step === 'month-select') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-blue-700 text-white px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">{employee?.first_name} {employee?.last_name}</p>
              <p className="text-blue-200 text-sm">Welchen Monat möchtest du bearbeiten?</p>
            </div>
            <button onClick={() => { setStep('identify'); setEmployee(null); setSuccessMonth(null) }}
              className="text-blue-200 hover:text-white text-sm underline">
              Abmelden
            </button>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-3">
          {/* Success flash */}
          {successMonth && (
            <div className="bg-green-100 border border-green-300 text-green-800 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span className="font-medium">
                {formatMonthLabel(successMonth)} wurde gespeichert!
              </span>
            </div>
          )}

          {loadingMonths ? (
            <div className="text-center py-12 text-gray-400">Lade Monate …</div>
          ) : (
            monthInfos.map(info => (
              <button
                key={info.month}
                onClick={() => openMonth(info.month)}
                className={`w-full text-left bg-white rounded-xl shadow-sm border px-4 py-4 flex items-center justify-between transition hover:shadow-md ${
                  info.isLocked ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-blue-300'
                } ${successMonth === info.month ? 'ring-2 ring-green-400' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    info.isLocked ? 'bg-gray-100' : info.hasSubmission ? 'bg-green-100' : 'bg-blue-50'
                  }`}>
                    {info.isLocked ? '🔒' : info.hasSubmission ? '✅' : '📅'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{formatMonthLabel(info.month)}</p>
                    {info.isLocked ? (
                      <p className="text-xs text-gray-400">
                        Gesperrt seit {formatDeadline(info.deadline!)}
                      </p>
                    ) : info.deadline ? (
                      <p className="text-xs text-orange-500">
                        Frist: {formatDeadline(info.deadline)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">
                        {info.hasSubmission ? 'Eingereicht – noch änderbar' : 'Noch nicht eingereicht'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {info.hasSubmission && !info.isLocked && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Eingereicht
                    </span>
                  )}
                  {info.isLocked && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Nur lesen
                    </span>
                  )}
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // Availability calendar step
  // ════════════════════════════════════════════════════════════
  const selData = selectedDay ? (days[selectedDay] ?? { status: 'available', notes: '' }) : null
  const holidayName = selectedDay ? (holidays[dateKey(currentMonth, selectedDay)] ?? null) : null

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header with month navigation */}
      <div className="bg-blue-700 text-white sticky top-0 z-20 shadow">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">{employee?.first_name} {employee?.last_name}</p>
            <button onClick={() => { setStep('month-select'); setSelectedDay(null) }}
              className="text-blue-200 hover:text-white text-sm underline">
              ← Monatsübersicht
            </button>
          </div>
          {/* Month navigation row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth(-1)}
              disabled={currentIdx <= 0}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-blue-600 disabled:opacity-30 transition text-lg"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="font-bold text-lg leading-tight">{formatMonthLabel(currentMonth)}</p>
              {isLocked && (
                <p className="text-yellow-300 text-xs">🔒 Gesperrt – nur Ansicht</p>
              )}
              {!isLocked && deadline && (
                <p className="text-orange-300 text-xs">Frist: {formatDeadline(deadline)}</p>
              )}
            </div>
            <button
              onClick={() => navigateMonth(1)}
              disabled={currentIdx >= VISIBLE_MONTHS.length - 1}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-blue-600 disabled:opacity-30 transition text-lg"
            >
              ›
            </button>
          </div>
        </div>

        {/* Month dots nav */}
        <div className="flex justify-center gap-1.5 pb-2">
          {VISIBLE_MONTHS.map(m => {
            const info = monthInfos.find(mi => mi.month === m)
            return (
              <button
                key={m}
                onClick={() => openMonth(m)}
                className={`w-2 h-2 rounded-full transition-all ${
                  m === currentMonth
                    ? 'bg-white scale-125'
                    : info?.isLocked
                    ? 'bg-yellow-400 opacity-70'
                    : info?.hasSubmission
                    ? 'bg-green-400 opacity-80'
                    : 'bg-blue-400'
                }`}
                title={formatMonthLabel(m)}
              />
            )
          })}
        </div>
      </div>

      {/* Lock banner */}
      {isLocked && (
        <div className="max-w-lg mx-auto px-3 pt-3">
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <span className="text-lg shrink-0">🔒</span>
            <span>
              Die Abgabefrist für diesen Monat war der{' '}
              <strong>{formatDeadline(deadline!)}</strong>. Du kannst deine
              Einträge nur noch ansehen, aber nicht mehr ändern.
            </span>
          </div>
        </div>
      )}

      {loadingCalendar ? (
        <div className="text-center py-16 text-gray-400">Lade Kalender …</div>
      ) : (
        <div className="max-w-lg mx-auto px-3 pt-4 space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-100 border border-green-300 rounded-xl py-2">
              <p className="text-2xl font-bold text-green-700">{stats.v}</p>
              <p className="text-xs text-green-600 font-medium">Verfügbar</p>
            </div>
            <div className="bg-yellow-100 border border-yellow-300 rounded-xl py-2">
              <p className="text-2xl font-bold text-yellow-700">{stats.w}</p>
              <p className="text-xs text-yellow-600 font-medium">Wunschfrei</p>
            </div>
            <div className="bg-red-100 border border-red-300 rounded-xl py-2">
              <p className="text-2xl font-bold text-red-700">{stats.n}</p>
              <p className="text-xs text-red-600 font-medium">Nicht verfügbar</p>
            </div>
          </div>

          {!isLocked && (
            <p className="text-center text-xs text-gray-400">
              Antippen → auswählen · nochmal antippen → Status wechseln
            </p>
          )}

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-800">
              {WEEKDAY_HEADERS.map(h => (
                <div key={h} className={`text-center py-2 text-xs font-bold ${
                  h === 'Sa' || h === 'So' ? 'text-blue-300' : 'text-white'
                }`}>{h}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-t border-gray-100">
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="bg-gray-50 aspect-square" />
                  const key = dateKey(currentMonth, day)
                  const isWeekend = di >= 5
                  const isHoliday = key in holidays
                  const data = days[day] ?? { status: 'available', notes: '' }
                  const isSelected = selectedDay === day
                  const hasNote = data.notes.trim().length > 0
                  return (
                    <button
                      key={di}
                      type="button"
                      disabled={isLocked && !isSelected}
                      onClick={() => {
                        if (isLocked) { setSelectedDay(day); return }
                        if (isSelected) cycleStatus(day)
                        else setSelectedDay(day)
                      }}
                      className={`
                        relative flex flex-col items-center justify-center aspect-square transition-all select-none
                        ${isLocked ? 'opacity-90 cursor-default' : ''}
                        ${STATUS_BG[data.status]}
                        ${isSelected ? `ring-2 ring-inset ${STATUS_ACTIVE_RING[data.status]}` : ''}
                        ${isWeekend ? 'opacity-75' : ''}
                      `}
                    >
                      {isHoliday && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-purple-600" />}
                      {hasNote && <span className="absolute top-0.5 left-0.5 text-[8px] leading-none">✏️</span>}
                      <span className="font-bold text-sm leading-none text-gray-900">{day}</span>
                      {isHoliday && (
                        <span className="text-[7px] leading-tight text-purple-800 font-medium text-center px-0.5 mt-0.5 max-w-full truncate">
                          {holidays[key].split(' ')[0]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Selected day detail panel */}
          {selectedDay && selData && (
            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">
                    {selectedDay}. {formatMonthLabel(currentMonth).split(' ')[0]}
                    {holidayName && <span className="ml-2 text-purple-600 text-sm font-normal">🎉 {holidayName}</span>}
                  </p>
                  {isLocked
                    ? <p className="text-xs text-gray-400">Nur Ansicht</p>
                    : <p className="text-xs text-gray-400">Antippen zum Wechseln</p>}
                </div>
                <button type="button" onClick={() => setSelectedDay(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['available', 'unavailable', 'preferred_off'] as Status[]).map(s => (
                  <button
                    key={s} type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && setDays(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], status: s } }))}
                    className={`py-2 rounded-lg text-sm font-medium transition border-2 ${
                      selData.status === s
                        ? `${STATUS_BG[s]} border-transparent text-gray-900 shadow-sm`
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    } ${isLocked ? 'cursor-default' : ''}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {!isLocked && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Anmerkung (optional)</label>
                  <input type="text" value={selData.notes} onChange={e => setNotes(selectedDay, e.target.value)}
                    placeholder="z. B. Urlaub, Fortbildung …"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              )}
              {isLocked && selData.notes && (
                <p className="text-sm text-gray-500 italic">„{selData.notes}"</p>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-3 text-xs text-gray-400 justify-center flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Verfügbar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Nicht verfügbar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-300 inline-block" /> Wunschfrei</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" /> Feiertag (NRW)</span>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{errorMsg}</div>
          )}

          {/* Submit */}
          {!isLocked && (
            <button type="button" onClick={handleSubmit}
              disabled={step === 'submitting'}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition disabled:opacity-60">
              {step === 'submitting' ? 'Wird gespeichert …' : 'Verfügbarkeit absenden ✓'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
