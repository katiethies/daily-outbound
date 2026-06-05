import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const todayStr = () => new Date().toISOString().split('T')[0]

function fmt(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LinkedInDM() {
  const [queue, setQueue]     = useState([])
  const [idx, setIdx]         = useState(0)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [sent, setSent]       = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('people')
      .select('*, companies(name)')
      .or('connection_status.eq.Connected,connection_status.is.null')
      .is('first_dm_date', null)
      .order('connected_on', { ascending: true })
    setQueue(data || [])
    setLoading(false)
  }

  const person = queue[idx]

  useEffect(() => {
    if (person) setDraft(person.ai_draft_message || '')
  }, [idx, queue])

  async function markSent() {
    setSaving(true)
    await supabase.from('people').update({
      edited_message:    draft,
      first_dm_date:     todayStr(),
      ongoing_dms_tally: (person.ongoing_dms_tally || 0) + 1,
      last_outreach_date: todayStr(),
    }).eq('id', person.id)
    setSaving(false)
    setSent(s => s + 1)
    setIdx(i => i + 1)
  }

  function skip() { setIdx(i => i + 1) }

  if (loading) return <PageShell><p className="text-slate-500">Loading…</p></PageShell>
  if (!person) return (
    <PageShell>
      <p className="text-slate-500">{sent > 0 ? `${sent} DM${sent !== 1 ? 's' : ''} sent today.` : 'No connected people waiting for a first DM.'}</p>
    </PageShell>
  )

  const remaining = queue.length - idx

  return (
    <PageShell>
      <p className="text-sm text-slate-500 mb-6">{remaining} remaining · {sent} sent this session</p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900 text-lg">{person.name}</h2>
          <p className="text-slate-500 text-sm">{person.job_title} · {person.companies?.name}</p>
        </div>
        <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 mb-5">
          <dt className="font-medium text-slate-400">Connected on</dt>
          <dd>{fmt(person.connected_on)}</dd>
          <dt className="font-medium text-slate-400">LinkedIn</dt>
          <dd>
            {person.linkedin_url
              ? <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View profile</a>
              : '—'}
          </dd>
        </dl>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
          <strong>Instructions:</strong> Lorem ipsum — review the draft below, personalize the opening line with something specific to them (a recent post, announcement, or shared interest), then hit Sent.
        </div>

        <label className="block text-xs font-medium text-slate-500 mb-1.5">Message</label>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={6}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={markSent}
            disabled={saving || !draft.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            Sent
          </button>
          <button onClick={skip} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">
            Skip
          </button>
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ children }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">LinkedIn DM</h1>
      {children}
    </div>
  )
}
