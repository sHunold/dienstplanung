import { useState } from 'react'
import { supabase, type Employee } from '../lib/supabase'

interface Props {
  employees: Employee[]
  onRefresh: () => void
}

export default function EmployeeManager({ employees, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('employees').insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dob,
    })
    setFirstName('')
    setLastName('')
    setDob('')
    setSaving(false)
    setShowForm(false)
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Mitarbeiter und alle Einträge löschen?')) return
    setDeletingId(id)
    await supabase.from('availability_entries').delete().eq('employee_id', id)
    await supabase.from('employees').delete().eq('id', id)
    setDeletingId(null)
    onRefresh()
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">
          Mitarbeiterliste ({employees.length})
        </h2>
        <button
          onClick={() => setShowForm(f => !f)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? 'Abbrechen' : '+ Hinzufügen'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 p-3 bg-blue-50 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              placeholder="Vorname"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="text"
              required
              placeholder="Nachname"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <input
            type="date"
            required
            value={dob}
            onChange={e => setDob(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 text-white py-1.5 rounded text-sm font-medium hover:bg-green-700 transition disabled:opacity-60"
          >
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {employees.map(emp => (
          <div key={emp.id} className="flex items-center justify-between py-2">
            <div>
              <span className="font-medium text-gray-800 text-sm">
                {emp.last_name}, {emp.first_name}
              </span>
              <span className="text-gray-400 text-xs ml-2">
                *{new Date(emp.date_of_birth).toLocaleDateString('de-DE')}
              </span>
            </div>
            <button
              onClick={() => handleDelete(emp.id)}
              disabled={deletingId === emp.id}
              className="text-red-500 hover:text-red-700 text-sm px-2 py-0.5 rounded hover:bg-red-50 transition"
            >
              {deletingId === emp.id ? '…' : 'Entfernen'}
            </button>
          </div>
        ))}
        {employees.length === 0 && (
          <p className="text-gray-400 text-sm py-3 text-center">
            Noch keine Mitarbeiter eingetragen.
          </p>
        )}
      </div>
    </div>
  )
}
