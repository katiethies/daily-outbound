import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

function cutoff21() {
  const d = new Date()
  d.setDate(d.getDate() - 21)
  return d.toISOString().split('T')[0]
}

function daysAgo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export default function RemoveOldRequests() {
  const [people, setPeople]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('people')
      .select('*, companies(name)')
      .eq('connection_status', 'Requested')
      .lt('connection_requested_date', cutoff21())
      .order('connection_requested_date', { ascending: true })
    setPeople(data || [])
    setLoading(false)
  }

  async function markRemoved(id) {
    setSaving(s => ({ ...s, [id]: true }))
    await supabase.from('people').update({ connection_status: 'Removed' }).eq('id', id)
    setSaving(s => ({ ...s, [id]: false }))
    setPeople(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Remove old pending requests</h1>
      <p className="text-sm text-slate-500 mb-6">
        Go to your LinkedIn pending requests and withdraw these (sent more than 21 days ago).
      </p>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-slate-500">No overdue pending requests.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">LinkedIn</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Days pending</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-5 py-3">
                    {p.linkedin_url
                      ? <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View profile</a>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-red-600 font-medium">{daysAgo(p.connection_requested_date)}d</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => markRemoved(p.id)}
                      disabled={saving[p.id]}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 disabled:opacity-40 transition"
                    >
                      Removed
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
