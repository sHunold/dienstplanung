import { useState } from 'react'
import AdminDashboard from './AdminDashboard'

export default function AdminRoute() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD as string
    if (password === adminPassword) {
      setAuthenticated(true)
    } else {
      setError(true)
      setPassword('')
    }
  }

  if (authenticated) return <AdminDashboard />

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-xl font-bold text-gray-800">Admin-Bereich</h1>
          <p className="text-gray-500 text-sm mt-1">Dienstplan-Verwaltung</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">
              Falsches Passwort.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition"
          >
            Anmelden
          </button>
        </form>
      </div>
    </div>
  )
}
