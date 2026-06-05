import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const todayStr = () => new Date().toISOString().split('T')[0]

function cutoff5() {
  const d = new Date()
  d.setDate(d.getDate() - 5)
  return d.toISOString().split('T')[0]
}

function fmt(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Sub-group 1 excludes 'Not qualified' in addition to the Tier A variants
const EXCLUDED_TIERS_SG1 = [
  'Not qualified',
  'Tier A [ghostwriting agency/solo]',
  'Tier A [inbound-led outbound]',
]
const EXCLUDED_TIERS_SG23 = [
  'Tier A [ghostwriting agency/solo]',
  'Tier A [inbound-led outbound]',
]
const EXCLUDED_PITCH_TYPES_EMAIL = [
  'sent email pitch - outbound',
  'colleagues intro',
  'not qualified',
  'segmented email - linkedin ghostwriter',
]

export default function EmailSection() {
  const [queue, setQueue]     = useState([])
  const [idx, setIdx]         = useState(0)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [sent, setSent]       = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const today = todayStr()
    const c5    = cutoff5()

    const [r1, r2, r3, r4, rB] = await Promise.all([
      // Sub-group 1: cannot send LI connection → go email
      supabase.from('people').select('*, companies(name, tier)')
        .eq('connection_status', 'Cannot send connection request')
        .is('outreach_status', null)
        .not('prospect_source', 'is', null)
        .not('email', 'is', null),

      // Sub-group 2: LI request expired (status null, date is set and before today)
      supabase.from('people').select('*, companies(name, tier)')
        .is('connection_status', null)
        .not('connection_requested_date', 'is', null)
        .lt('connection_requested_date', today)
        .not('prospect_source', 'is', null)
        .is('last_outreach_date', null)
        .is('outreach_status', null)
        .not('email', 'is', null),

      // Sub-group 3: connection request sent but no date recorded
      supabase.from('people').select('*, companies(name, tier)')
        .eq('connection_status', 'Connection request sent')
        .is('connection_requested_date', null)
        .not('prospect_source', 'is', null)
        .is('last_outreach_date', null)
        .is('outreach_status', null)
        .not('email', 'is', null),

      // Sub-group 4: explicitly flagged ready for email
      supabase.from('people').select('*, companies(name, tier)')
        .eq('outreach_status', 'Ready for Email')
        .not('email', 'is', null),

      // Group B: follow-up emails (5+ days since last contact)
      supabase.from('people').select('*, companies(name, tier)')
        .or('dnc.is.null,dnc.eq.false')
        .not('personalization_type', 'is', null)
        .not('personalization_type', 'in', `(${EXCLUDED_PITCH_TYPES_EMAIL.map(s => `"${s}"`).join(',')})`)
        .in('outreach_status', ['First email', 'Second Email', 'Ongoing Emails', 'Third Email'])
        .or(`last_outreach_date.is.null,last_outreach_date.lt.${c5},first_email_date.lt.${c5},second_email_date.lt.${c5},third_email_date.lt.${c5}`)
        .order('last_outreach_date', { ascending: true, nullsFirst: true }),
    ])

    // Build Group A — client-side tier filter then dedup
    const seenA = new Set()
    const groupA = []
    const sg1  = (r1.data || []).filter(p => !EXCLUDED_TIERS_SG1.includes(p.companies?.tier))
    const sg23 = [
      ...(r2.data || []).filter(p => !EXCLUDED_TIERS_SG23.includes(p.companies?.tier)),
      ...(r3.data || []).filter(p => !EXCLUDED_TIERS_SG23.includes(p.companies?.tier)),
    ]
    for (const p of [...sg1, ...sg23, ...(r4.data || [])]) {
      if (seenA.has(p.id)) continue
      seenA.add(p.id)
      groupA.push({ ...p, _group: 'A' })
    }

    const groupB = (rB.data || []).map(p => ({ ...p, _group: 'B' }))

    setQueue([...groupA, ...groupB])
    setLoading(false)
  }

  const person = queue[idx]

  useEffect(() => {
    if (person) setDraft(person.ai_draft_message || '')
  }, [idx, queue])

  async function markSent() {
    setSaving(true)
    const d = todayStr()
    const update = {
      edited_message:       draft,
      last_outreach_date:   d,
      ongoing_emails_tally: (person.ongoing_emails_tally || 0) + 1,
    }
    if (person._group === 'A') {
      update.first_email_date = d
      update.outreach_status  = 'First email'
    } else if (person.outreach_status === 'First email') {
      update.second_email_date = d
      update.outreach_status   = 'Second Email'
    } else if (person.outreach_status === 'Second Email') {
      update.third_email_date = d
      update.outreach_status  = 'Third Email'
    } else {
      update.outreach_status = 'Ongoing Emails'
    }
    await supabase.from('people').update(update).eq('id', person.id)
    setSaving(false)
    setSent(s => s + 1)
    setIdx(i => i + 1)
  }

  function skip() { setIdx(i => i + 1) }

  if (loading) return <PageShell><p className="text-slate-500">Loading…</p></PageShell>
  if (!person) return (
    <PageShell>
      <p className="text-slate-500">
        {sent > 0 ? `${sent} email${sent !== 1 ? 's' : ''} sent this session.` : 'No emails to send right now.'}
      </p>
    </PageShell>
  )

  const remaining = queue.length - idx
  const isGroupA  = person._group === 'A'

  return (
    <PageShell>
      <p className="text-sm text-slate-500 mb-6">{remaining} remaining · {sent} sent this session</p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">{person.name}</h2>
            <p className="text-slate-500 text-sm">{person.job_title} · {person.companies?.name}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            isGroupA ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isGroupA ? 'First email' : `Follow-up · ${person.outreach_status}`}
          </span>
        </div>
        <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 mb-5">
          <dt className="font-medium text-slate-400">Email</dt>
          <dd><a href={`mailto:${person.email}`} className="text-indigo-600 hover:underline">{person.email}</a></dd>
          {isGroupA ? (
            <>
              <dt className="font-medium text-slate-400">Source</dt>
              <dd>{person.prospect_source || '—'}</dd>
              <dt className="font-medium text-slate-400">Connection status</dt>
              <dd>{person.connection_status || '—'}</dd>
            </>
          ) : (
            <>
              <dt className="font-medium text-slate-400">Last outreach</dt>
              <dd>{fmt(person.last_outreach_date)}</dd>
              <dt className="font-medium text-slate-400">Stage</dt>
              <dd>{person.outreach_status}</dd>
            </>
          )}
        </dl>

        <label className="block text-xs font-medium text-slate-500 mb-1.5">Email body</label>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={7}
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
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Email</h1>
      {children}
    </div>
  )
}
