import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const today = () => new Date().toISOString().split('T')[0]

function fmt(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AttioFollowUps() {
  const [queue, setQueue]     = useState([])
  const [idx, setIdx]         = useState(0)
  const [done, setDone]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [datePick, setDatePick] = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('people')
      .select('*, companies(name), deals(deal_stage)')
      .or(`next_due_task.is.null,next_due_task.lte.${today()}`)
      .order('next_due_task', { ascending: true, nullsFirst: true })
    if (!error) setQueue(data || [])
    setLoading(false)
  }

  const person = queue[idx]
  const remaining = queue.length - done

  async function markDone() {
    if (!datePick) return
    setSaving(true)
    await supabase.from('people').update({ next_due_task: datePick }).eq('id', person.id)
    setSaving(false)
    setDatePick('')
    setDone(d => d + 1)
    setIdx(i => i + 1)
  }

  function skip() {
    setIdx(i => i + 1)
  }

  if (loading) return <PageShell title="Attio pipeline follow-ups"><p className="text-slate-500">Loading…</p></PageShell>
  if (!person) return (
    <PageShell title="Attio pipeline follow-ups">
      <p className="text-slate-500">{done > 0 ? `All ${done} follow-up${done !== 1 ? 's' : ''} handled.` : 'No follow-ups due today.'}</p>
    </PageShell>
  )

  return (
    <PageShell title="Attio pipeline follow-ups">
      <p className="text-sm text-slate-500 mb-6">{remaining} remaining</p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">{person.name}</h2>
            <p className="text-slate-500 text-sm">{person.job_title} · {person.companies?.name}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            person.deals?.deal_stage === 'Won' ? 'bg-green-100 text-green-700' :
            person.deals?.deal_stage === 'Lost' ? 'bg-red-100 text-red-700' :
            'bg-indigo-100 text-indigo-700'
          }`}>
            {person.deals?.deal_stage || 'No deal'}
          </span>
        </div>
        <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 mb-6">
          <dt className="font-medium text-slate-400">Last outreach</dt>
          <dd>{fmt(person.last_outreach_date)}</dd>
          <dt className="font-medium text-slate-400">Due</dt>
          <dd>{person.next_due_task ? fmt(person.next_due_task) : <span className="text-amber-600">No task set</span>}</dd>
        </dl>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={datePick}
            onChange={e => setDatePick(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={markDone}
            disabled={!datePick || saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            Done — set next task
          </button>
          <button onClick={skip} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">
            Skip
          </button>
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ title, children }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">{title}</h1>
      {children}
    </div>
  )
}
