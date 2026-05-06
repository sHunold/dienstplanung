import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  supabase,
  type Status,
  type Employee,
  type MonthDeadline,
  STATUS_LABELS,
  STATUS_GROUPS,
  STATUS_BG_CLASS,
  STATUS_SHORT,
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
const VISIBLE_MONTHS = getVisibleMonths()

const STATUS_ACTIVE_RING: Record<Status, string> = {
  available:       'ring-green-600',
  preferred_off:   'ring-yellow-500',
  part_time_off:   'ring-amber-500',
  vacation:        'ring-orange-600',
  training:        'ring-sky-600',
  overtime_off:    'ring-violet-600',
  no_shift:        'ring-red-600',
  no_late_shift:   'ring-rose-500',
  normal:          'ring-emerald-500',
  preferred_shift: 'ring-teal-500',
}

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

  const loadMonthInfos = useCallback(async (emp: Employee) => {
    setLoadingMonths(true)
    const [{ data: deadlines }, { data: entries }] = await Promise.all([
      supabase.from('month_deadlines').select('*'),
      supabase.from('availability_entries').select('month').eq('employee_id', emp.id),
    ])
    const deadlineMap: Record<string, string> = {}
    for (const d of (deadlines ?? []) as MonthDeadline[]) deadlineMap[d.month] = d.deadline
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

  const loadCalendar = useCallback(async (emp: Employee, month: string) => {
    setLoadingCalendar(true)
    setSelectedDay(null)
    const [{ data: entries }, { data: dl }] = await Promise.all([
      supabase.from('availability_entries').select('*').eq('employee_id', emp.id).eq('month', month),
      supabase.from('month_deadlines').select('*').eq('month', month).maybeSingle(),
    ])
    const deadline = (dl as MonthDeadline | null)?.deadline ?? null
    setDeadline(deadline)
    setIsLocked(isDeadlinePassed(deadline))
    const base = buildDefaultDays(month)
    for (const e of (entries ?? []) as { day: number; status: Status; notes: string | null }[]) {
      base[e.day] = { status: e.status, notes: e.notes ?? '' }
    }
    setDays(base)
    setLoadingCalendar(false)
  }, [])

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const { data, error } = await supabase
      .from('employees').select('*')
      .eq('first_name', firstName.trim()).eq('last_name', lastName.trim())
      .eq('date_of_birth', dob).single()
    if (error || !data) {
      setErrorMsg('Name nicht gefunden – bitte wende dich an das Sekretariat.')
      return
    }
    const emp = data as Employee
    setEmployee(emp)
    await loadMonthInfos(emp)
    setStep('month-select')
  }

  async function openMonth(month: string) {
    if (!employee) return
    setCurrentMonth(month)
    setStep('availability')
    await loadCalendar(employee, month)
  }

  async function navigateMonth(direction: -1 | 1) {
    if (!employee) return
    const idx = VISIBLE_MONTHS.indexOf(currentMonth)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= VISIBLE_MONTHS.length) return
    const newMonth = VISIBLE_MONTHS[newIdx]
    setCurrentMonth(newMonth)
    await loadCalendar(employee, newMonth)
  }

  async function handleSubmit() {
    if (!employee || isLocked) return
    setStep('submitting')
    await supabase.from('availability_entries').delete()
      .eq('employee_id', employee.id).eq('month', currentMonth)
    const count = daysInMonth(currentMonth)
    const entries = []
    for (let d = 1; d <= count; d++) {
      const day = days[d]
      entries.push({ employee_id: employee.id, month: currentMonth, day: d, status: day.status, notes: day.notes.trim() || null })
    }
    const { error } = await supabase.from('availability_entries').insert(entries)
    if (error) { setErrorMsg('Fehler beim Speichern.'); setStep('availability'); return }
    setSuccessMonth(currentMonth)
    await loadMonthInfos(employee)
    setStep('month-select')
  }

  function setDayStatus(day: number, status: Status) {
    if (isLocked) return
    setDays(prev => ({ ...prev, [day]: { ...prev[day], status } }))
  }

  function setNotes(day: number, notes: string) {
    setDays(prev => ({ ...prev, [day]: { ...prev[day], notes } }))
  }

  // Stats: Verfügbar | Freizeit | Arbeitswünsche
  const stats = useMemo(() => {
    const count = daysInMonth(currentMonth || VISIBLE_MONTHS[2])
    let verfuegbar = 0, freizeit = 0, arbeit = 0
    const freizeitSet = new Set(['preferred_off', 'part_time_off', 'vacation', 'training', 'overtime_off'])
    for (let d = 1; d <= count; d++) {
      const s = days[d]?.status ?? 'available'
      if (s === 'available') verfuegbar++
      else if (freizeitSet.has(s)) freizeit++
      else arbeit++
    }
    return { verfuegbar, freizeit, arbeit }
  }, [days, currentMonth])

  const holidays = useMemo(() => {
    if (!currentMonth) return {}
    const [year] = currentMonth.split('-').map(Number)
    return getNRWHolidays(year)
  }, [currentMonth])

  const weeks = useMemo(() => currentMonth ? buildWeeks(currentMonth) : [], [currentMonth])
  const currentIdx = VISIBLE_MONTHS.indexOf(currentMonth)

  useEffect(() => {
    if (!successMonth) return
    const t = setTimeout(() => setSuccessMonth(null), 4000)
    return () => clearTimeout(t)
  }, [successMonth])

  const selData = selectedDay ? (days[selectedDay] ?? { status: 'available' as Status, notes: '' }) : null
  const holidayName = selectedDay ? (holidays[dateKey(currentMonth, selectedDay)] ?? null) : null

  const dayPanelRef = useRef<HTMLDivElement>(null)
  const totalDaysInMonth = currentMonth ? daysInMonth(currentMonth) : 31

  function navigateDay(direction: -1 | 1) {
    if (!selectedDay) return
    const next = selectedDay + direction
    if (next < 1 || next > totalDaysInMonth) return
    setSelectedDay(next)
    // Keep viewport at the panel after state update
    requestAnimationFrame(() => {
      dayPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  // ════════════════════════════════════════════════════════════
  // Identify
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
  // Month selection
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
              className="text-blue-200 hover:text-white text-sm underline">Abmelden</button>
          </div>
        </div>
        <div className="max-w-lg mx-auto p-4 space-y-3">
          {successMonth && (
            <div className="bg-green-100 border border-green-300 text-green-800 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span className="font-medium">{formatMonthLabel(successMonth)} wurde gespeichert!</span>
            </div>
          )}
          {loadingMonths ? (
            <div className="text-center py-12 text-gray-400">Lade Monate …</div>
          ) : monthInfos.map(info => (
            <button key={info.month} onClick={() => openMonth(info.month)}
              className={`w-full text-left bg-white rounded-xl shadow-sm border px-4 py-4 flex items-center justify-between transition hover:shadow-md ${
                info.isLocked ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-blue-300'
              } ${successMonth === info.month ? 'ring-2 ring-green-400' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  info.isLocked ? 'bg-gray-100' : info.hasSubmission ? 'bg-green-100' : 'bg-blue-50'
                }`}>
                  {info.isLocked ? '🔒' : info.hasSubmission ? '✅' : '📅'}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{formatMonthLabel(info.month)}</p>
                  {info.isLocked
                    ? <p className="text-xs text-gray-400">Gesperrt seit {formatDeadline(info.deadline!)}</p>
                    : info.deadline
                    ? <p className="text-xs text-orange-500">Frist: {formatDeadline(info.deadline)}</p>
                    : <p className="text-xs text-gray-400">{info.hasSubmission ? 'Eingereicht – noch änderbar' : 'Noch nicht eingereicht'}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {info.hasSubmission && !info.isLocked && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Eingereicht</span>
                )}
                {info.isLocked && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Nur lesen</span>
                )}
                <span className="text-gray-300 text-lg">›</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // Calendar
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-blue-700 text-white sticky top-0 z-20 shadow">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">{employee?.first_name} {employee?.last_name}</p>
            <button onClick={() => { setStep('month-select'); setSelectedDay(null) }}
              className="text-blue-200 hover:text-white text-sm underline">← Monatsübersicht</button>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => navigateMonth(-1)} disabled={currentIdx <= 0}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-blue-600 disabled:opacity-30 transition text-lg">‹</button>
            <div className="text-center">
              <p className="font-bold text-lg leading-tight">{formatMonthLabel(currentMonth)}</p>
              {isLocked
                ? <p className="text-yellow-300 text-xs">🔒 Gesperrt – nur Ansicht</p>
                : deadline
                ? <p className="text-orange-300 text-xs">Frist: {formatDeadline(deadline)}</p>
                : null}
            </div>
            <button onClick={() => navigateMonth(1)} disabled={currentIdx >= VISIBLE_MONTHS.length - 1}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-blue-600 disabled:opacity-30 transition text-lg">›</button>
          </div>
        </div>
        <div className="flex justify-center gap-1.5 pb-2">
          {VISIBLE_MONTHS.map(m => {
            const info = monthInfos.find(mi => mi.month === m)
            return (
              <button key={m} onClick={() => openMonth(m)}
                className={`w-2 h-2 rounded-full transition-all ${
                  m === currentMonth ? 'bg-white scale-125'
                  : info?.isLocked ? 'bg-yellow-400 opacity-70'
                  : info?.hasSubmission ? 'bg-green-400 opacity-80'
                  : 'bg-blue-400'
                }`} title={formatMonthLabel(m)} />
            )
          })}
        </div>
      </div>

      {isLocked && (
        <div className="max-w-lg mx-auto px-3 pt-3">
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <span className="text-lg shrink-0">🔒</span>
            <span>Die Abgabefrist war der <strong>{formatDeadline(deadline!)}</strong>. Nur Ansicht möglich.</span>
          </div>
        </div>
      )}

      {loadingCalendar ? (
        <div className="text-center py-16 text-gray-400">Lade Kalender …</div>
      ) : (
        <div className="max-w-lg mx-auto px-3 pt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-100 border border-green-300 rounded-xl py-2">
              <p className="text-2xl font-bold text-green-700">{stats.verfuegbar}</p>
              <p className="text-xs text-green-600 font-medium">Verfügbar</p>
            </div>
            <div className="bg-orange-100 border border-orange-300 rounded-xl py-2">
              <p className="text-2xl font-bold text-orange-700">{stats.freizeit}</p>
              <p className="text-xs text-orange-600 font-medium">Freizeit</p>
            </div>
            <div className="bg-blue-100 border border-blue-300 rounded-xl py-2">
              <p className="text-2xl font-bold text-blue-700">{stats.arbeit}</p>
              <p className="text-xs text-blue-600 font-medium">Arbeitswunsch</p>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-800">
              {WEEKDAY_HEADERS.map(h => (
                <div key={h} className={`text-center py-2 text-xs font-bold ${h === 'Sa' || h === 'So' ? 'text-blue-300' : 'text-white'}`}>{h}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-t border-gray-100">
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="bg-gray-50 aspect-square" />
                  const key = dateKey(currentMonth, day)
                  const isWeekend = di >= 5
                  const isHoliday = key in holidays
                  const data = days[day] ?? { status: 'available' as Status, notes: '' }
                  const isSelected = selectedDay === day
                  const hasNote = data.notes.trim().length > 0
                  return (
                    <button key={di} type="button"
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`
                        relative flex flex-col items-center justify-center aspect-square transition-all select-none
                        ${STATUS_BG_CLASS[data.status]}
                        ${isSelected ? `ring-2 ring-inset ${STATUS_ACTIVE_RING[data.status]}` : ''}
                        ${isWeekend ? 'opacity-75' : ''}
                      `}>
                      {isHoliday && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-purple-700" />}
                      {hasNote && <span className="absolute top-0.5 left-0.5 text-[8px] leading-none">✏️</span>}
                      <span className="font-bold text-xs leading-none text-gray-900">{day}</span>
                      <span className="text-[8px] leading-tight text-gray-700 font-medium mt-0.5">
                        {STATUS_SHORT[data.status]}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Selected day panel */}
          {selectedDay && selData && (
            <div ref={dayPanelRef} className="bg-white rounded-2xl shadow p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                {/* Prev day */}
                <button type="button" onClick={() => navigateDay(-1)}
                  disabled={selectedDay <= 1}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition text-gray-600 text-lg font-bold">
                  ‹
                </button>

                {/* Day info */}
                <div className="flex-1 text-center">
                  <p className="font-semibold text-gray-800">
                    {selectedDay}. {formatMonthLabel(currentMonth).split(' ')[0]}
                    {holidayName && <span className="ml-1 text-purple-600 text-sm font-normal">🎉 {holidayName}</span>}
                  </p>
                  <p className="text-xs text-gray-400">{isLocked ? 'Nur Ansicht' : 'Status auswählen'}</p>
                </div>

                {/* Next day */}
                <button type="button" onClick={() => navigateDay(1)}
                  disabled={selectedDay >= totalDaysInMonth}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition text-gray-600 text-lg font-bold">
                  ›
                </button>

                {/* Close */}
                <button type="button" onClick={() => setSelectedDay(null)}
                  className="w-7 h-7 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 text-base">
                  ✕
                </button>
              </div>

              {/* Default option */}
              <button type="button" disabled={isLocked}
                onClick={() => setDayStatus(selectedDay, 'available')}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                  selData.status === 'available'
                    ? 'bg-green-400 border-green-500 text-gray-900'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                } ${isLocked ? 'cursor-default' : ''}`}>
                ✅ Verfügbar (Standard)
              </button>

              {/* Grouped options */}
              {STATUS_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.statuses.map(s => (
                      <button key={s} type="button" disabled={isLocked}
                        onClick={() => setDayStatus(selectedDay, s)}
                        className={`py-2 px-3 rounded-xl text-sm font-medium border-2 transition text-left ${
                          selData.status === s
                            ? `${STATUS_BG_CLASS[s]} border-transparent text-gray-900 shadow-sm`
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                        } ${isLocked ? 'cursor-default' : ''}`}>
                        <span className="font-bold text-xs opacity-60 mr-1">[{STATUS_SHORT[s]}]</span>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Notes */}
              {!isLocked ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Anmerkung (optional)</label>
                  <input type="text" value={selData.notes} onChange={e => setNotes(selectedDay, e.target.value)}
                    placeholder="z. B. Details zum Urlaub …"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              ) : selData.notes ? (
                <p className="text-sm text-gray-500 italic">„{selData.notes}"</p>
              ) : null}
            </div>
          )}

          {/* Legend */}
          <div className="bg-white rounded-xl shadow p-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Legende</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(['available', 'preferred_off', 'part_time_off', 'vacation', 'training', 'overtime_off',
                'no_shift', 'no_late_shift', 'normal', 'preferred_shift'] as Status[]).map(s => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className={`w-3 h-3 rounded-sm shrink-0 ${STATUS_BG_CLASS[s]}`} />
                  <span className="font-mono text-gray-400 text-[10px]">{STATUS_SHORT[s]}</span>
                  <span>{STATUS_LABELS[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{errorMsg}</div>
          )}

          {!isLocked && (
            <button type="button" onClick={handleSubmit} disabled={step === 'submitting'}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition disabled:opacity-60">
              {step === 'submitting' ? 'Wird gespeichert …' : 'Verfügbarkeit absenden ✓'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
