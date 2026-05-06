import { useState, useEffect } from 'react'
import { supabase, type MonthDeadline, formatMonthLabel, getAvailableMonths, isDeadlinePassed } from '../lib/supabase'

const MONTHS = getAvailableMonths()

export default function DeadlineManager() {
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('month_deadlines').select('*')
    const map: Record<string, string> = {}
    for (const d of (data ?? []) as MonthDeadline[]) map[d.month] = d.deadline
    setDeadlines(map)
    setDrafts({ ...map })
  }

  async function save(month: string) {
    const value = drafts[month]
    setSaving(month)

    if (!value) {
      await supabase.from('month_deadlines').delete().eq('month', month)
      const next = { ...deadlines }
      delete next[month]
      setDeadlines(next)
    } else {
      await supabase
        .from('month_deadlines')
        .upsert({ month, deadline: value }, { onConflict: 'month' })
      setDeadlines(prev => ({ ...prev, [month]: value }))
    }
    setSaving(null)
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h2 className="font-semibold text-gray-800 mb-1">Abgabefristen</h2>
      <p className="text-xs text-gray-400 mb-4">
        Nach diesem Datum können Mitarbeiter den jeweiligen Monat nicht mehr bearbeiten.
      </p>

      <div className="space-y-2">
        {MONTHS.map(month => {
          const saved = deadlines[month]
          const draft = drafts[month] ?? ''
          const locked = isDeadlinePassed(saved ?? null)
          const dirty = draft !== (saved ?? '')

          return (
            <div key={month}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                locked ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="min-w-[120px]">
                <p className="font-medium text-sm text-gray-800">{formatMonthLabel(month)}</p>
                <p className={`text-xs ${locked ? 'text-red-500' : saved ? 'text-orange-500' : 'text-gray-400'}`}>
                  {locked ? '🔒 Gesperrt' : saved ? '⏳ Frist aktiv' : 'Keine Frist'}
                </p>
              </div>

              <input
                type="date"
                value={draft}
                onChange={e => setDrafts(prev => ({ ...prev, [month]: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />

              <button
                onClick={() => save(month)}
                disabled={!dirty || saving === month}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  dirty
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                } disabled:opacity-60`}
              >
                {saving === month ? '…' : draft ? 'Speichern' : 'Entfernen'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
