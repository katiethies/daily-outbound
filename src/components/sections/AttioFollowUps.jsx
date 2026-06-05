import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

function fmt(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(dateStr) {
  return dateStr && new Date(dateStr + 'T00:00:00') <= new Date()
}

export default function AttioFollowUps() {
  const [needsTask, setNeedsTask] = useState([])
  const [hasTask, setHasTask]     = useState([])
  const [datePicks, setDatePicks] = useState({})
  const [saving, setSaving]       = useState({})
  const [skipped, setSkipped]     = useState(new Set())
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // Fetch active deals (no embeds — PostgREST FK cache unreliable)
    const { data: dealsRaw } = await supabase
      .from('deals')
      .select('*')
      .not('deal_stage', 'in', '("Won","Lost","Dormant")')

    const deals = dealsRaw || []
    if (!deals.length) { setLoading(false); return }

    // Fetch companies and people in parallel, join client-side
    const companyIds = [...new Set(deals.map(d => d.company_id).filter(Boolean))]
    const dealIds    = deals.map(d => d.id)

    const [{ data: compData }, { data: peopleData }] = await Promise.all([
      companyIds.length
        ? supabase.from('companies').select('id, name').in('id', companyIds)
        : Promise.resolve({ data: [] }),
      supabase.from('people').select('name, job_title, deal_id').in('deal_id', dealIds),
    ])

    const companyMap = Object.fromEntries((compData || []).map(c => [c.id, c]))
    const dealPersonMap = {}
    for (const p of peopleData || []) {
      if (p.deal_id && !dealPersonMap[p.deal_id]) dealPersonMap[p.deal_id] = p
    }

    const assembled = deals.map(d => ({
      ...d,
      companies: d.company_id ? (companyMap[d.company_id] ?? null) : null,
      people:    dealPersonMap[d.id] ? [dealPersonMap[d.id]] : [],
    }))

    setNeedsTask(assembled.filter(d => !d.next_due_task))
    setHasTask(
      assembled
        .filter(d => d.next_due_task)
        .sort((a, b) => a.next_due_task.localeCompare(b.next_due_task))
    )
    setLoading(false)
  }

  async function saveTask(deal) {
    const date = datePicks[deal.id]
    if (!date) return
    setSaving(s => ({ ...s, [deal.id]: true }))
    await supabase.from('deals').update({ next_due_task: date }).eq('id', deal.id)
    setSaving(s => ({ ...s, [deal.id]: false }))
    setDatePicks(p => ({ ...p, [deal.id]: '' }))
    // Move deal from needsTask → hasTask (or update existing hasTask entry)
    const updated = { ...deal, next_due_task: date }
    setNeedsTask(prev => prev.filter(d => d.id !== deal.id))
    setHasTask(prev => {
      const without = prev.filter(d => d.id !== deal.id)
      return [...without, updated].sort((a, b) => a.next_due_task.localeCompare(b.next_due_task))
    })
  }

  function skip(id) { setSkipped(s => new Set([...s, id])) }

  const visNeedsTask = needsTask.filter(d => !skipped.has(d.id))
  const visHasTask   = hasTask.filter(d => !skipped.has(d.id))

  if (loading) return <PageShell><p className="text-slate-500">Loading…</p></PageShell>
  if (!visNeedsTask.length && !visHasTask.length) return (
    <PageShell><p className="text-slate-500">No active pipeline deals to follow up on.</p></PageShell>
  )

  return (
    <PageShell>
      {visNeedsTask.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">
            Needs a task — {visNeedsTask.length}
          </h2>
          <div className="space-y-3">
            {visNeedsTask.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                datePick={datePicks[deal.id] || ''}
                saving={!!saving[deal.id]}
                onDateChange={v => setDatePicks(p => ({ ...p, [deal.id]: v }))}
                onSave={() => saveTask(deal)}
                onSkip={() => skip(deal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {visHasTask.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Has task · sorted by due date — {visHasTask.length}
          </h2>
          <div className="space-y-3">
            {visHasTask.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                datePick={datePicks[deal.id] || ''}
                saving={!!saving[deal.id]}
                onDateChange={v => setDatePicks(p => ({ ...p, [deal.id]: v }))}
                onSave={() => saveTask(deal)}
                onSkip={() => skip(deal.id)}
              />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}

function DealCard({ deal, datePick, saving, onDateChange, onSave, onSkip }) {
  const person = deal.people?.[0]
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 max-w-2xl">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-900">{person?.name || '—'}</p>
          <p className="text-sm text-slate-500">
            {[person?.job_title, deal.companies?.name || deal.deal_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
          {deal.deal_stage}
        </span>
      </div>

      <p className="text-sm text-slate-600 mb-1">
        <span className="font-medium text-slate-400">Deal: </span>{deal.deal_name || '—'}
      </p>
      <p className="text-sm text-slate-600 mb-4">
        <span className="font-medium text-slate-400">Due: </span>
        {deal.next_due_task
          ? <span className={isOverdue(deal.next_due_task) ? 'text-red-600 font-medium' : ''}>
              {fmt(deal.next_due_task)}
            </span>
          : <span className="text-amber-600">No task set</span>}
      </p>

      <div className="flex items-center gap-3">
        <input
          type="date"
          value={datePick}
          onChange={e => onDateChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={onSave}
          disabled={!datePick || saving}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          Done — set next task
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

function PageShell({ children }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Attio pipeline follow-ups</h1>
      {children}
    </div>
  )
}
