import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const todayStr = () => new Date().toISOString().split('T')[0]

function StatCard({ label, value, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    green:  'bg-green-50  text-green-700  border-green-200',
    blue:   'bg-blue-50   text-blue-700   border-blue-200',
    amber:  'bg-amber-50  text-amber-700  border-amber-200',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  )
}

function replyBadge(status) {
  const map = {
    'Replied positive': 'bg-green-100 text-green-700',
    'Replied negative': 'bg-red-100 text-red-700',
    'Replied neutral':  'bg-slate-100 text-slate-600',
  }
  return map[status] || 'bg-slate-100 text-slate-600'
}

export default function DailySummary() {
  const [stats, setStats]     = useState({ connections: 0, dms: 0, emails: 0, followups: 0 })
  const [replied, setReplied] = useState([])
  const [loading, setLoading] = useState(true)
  const today = todayStr()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [connR, dmsR, emailsR, repliedR] = await Promise.all([
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('connection_requested_date', today),
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('first_dm_date', today),
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('first_email_date', today),
      supabase.from('people').select('*, companies(name)').not('reply_status', 'is', null).neq('reply_status', 'No reply'),
    ])
    setStats({
      connections: connR.count || 0,
      dms:         dmsR.count  || 0,
      emails:      emailsR.count || 0,
    })
    setReplied(repliedR.data || [])
    setLoading(false)
  }

  if (loading) return <div className="p-8"><p className="text-slate-500">Loading…</p></div>

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Daily summary</h1>
      <p className="text-sm text-slate-500 mb-8">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 max-w-3xl">
        <StatCard label="Connection requests sent" value={stats.connections} color="indigo" />
        <StatCard label="DMs sent"                  value={stats.dms}         color="blue"   />
        <StatCard label="Emails sent"               value={stats.emails}      color="green"  />
        <StatCard label="Follow-ups done"           value={stats.followups}   color="amber"  />
      </div>

      <h2 className="text-base font-semibold text-slate-900 mb-4">Replies received</h2>
      {replied.length === 0 ? (
        <p className="text-slate-500 text-sm">No replies recorded yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Company</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Reply</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Channel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {replied.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-5 py-3 text-slate-600">{p.companies?.name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${replyBadge(p.reply_status)}`}>
                      {p.reply_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.channel || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
