import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const todayStr = () => new Date().toISOString().split('T')[0]

function daysAgo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function cutoff21() {
  const d = new Date()
  d.setDate(d.getDate() - 21)
  return d.toISOString().split('T')[0]
}

export default function UpdateAccepted() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('people')
      .select('*, companies(name)')
      .eq('connection_status', 'Requested')
      .gte('connection_requested_date', cutoff21())
      .order('connection_requested_date', { ascending: true })
    setPeople(data || [])
    setLoading(false)
  }

  async function markAccepted(id) {
    setSaving(s => ({ ...s, [id]: true }))
    await supabase.from('people').update({
      connection_status: 'Connected',
      connected_on: todayStr(),
    }).eq('id', id)
    setSaving(s => ({ ...s, [id]: false }))
    setPeople(p => p.filter(x => x.id !== id))
  }

  async function markRemoved(id) {
    setSaving(s => ({ ...s, [id + '_r']: true }))
    await supabase.from('people').update({ connection_status: 'Removed' }).eq('id', id)
    setSaving(s => ({ ...s, [id + '_r']: false }))
    setPeople(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Update accepted connections</h1>
      <p className="text-sm text-slate-500 mb-6">
        Check your LinkedIn pending requests and mark who has accepted below.
      </p>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-slate-500">No pending requests in the last 21 days.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Company</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Requested</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Days ago</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-5 py-3 text-slate-600">{p.companies?.name}</td>
                  <td className="px-5 py-3 text-slate-600">{p.connection_requested_date}</td>
                  <td className="px-5 py-3 text-slate-600">{daysAgo(p.connection_requested_date)}d</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => markAccepted(p.id)}
                        disabled={saving[p.id]}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
                      >
                        Accepted
                      </button>
                      <button
                        onClick={() => markRemoved(p.id)}
                        disabled={saving[p.id + '_r']}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 disabled:opacity-40 transition"
                      >
                        Remove
                      </button>
                    </div>
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
