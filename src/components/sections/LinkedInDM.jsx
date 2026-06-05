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

const EXCLUDED_SOURCE_DM = [
  'LI connections: outbound',
  'LI connections: Qualified SaaS (not outbound)',
  'LI connections: Qualified agencies (not outbound)',
  'LI connections: Not SaaS/Agency',
]
const EXCLUDED_TIERS_DM = [
  'Tier A [ghostwriting agency/solo]',
  'Tier A [inbound-led outbound]',
  'Not qualified',
]
const EXCLUDED_PITCH_TYPES_DM = [
  'not qualified',
  'colleagues intro',
  'linkedin intro DM',
  'linkedin intro DM - personalize',
  'linkedin DM - inbound-led outbound',
  'Voice note DM pitch - inbound-led outbound',
  'comment + voice note - inbound-led outbound',
  'linkedin question DM, personalize - inbound-led outbound',
  'linkedin question DM, segment - inbound-led outbound',
]

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
    const c5 = cutoff5()

    // Group A part 1: Connected, never contacted, qualified source + tier
    const { data: a1 } = await supabase
      .from('people')
      .select('*, companies(name, tier)')
      .eq('connection_status', 'Connected')
      .is('outreach_status', null)
      .not('prospect_source', 'is', null)
      .not('prospect_source', 'in', `(${EXCLUDED_SOURCE_DM.map(s => `"${s}"`).join(',')})`)
      .order('connected_on', { ascending: true })

    // Group A part 2: Ready for DM override
    const { data: a2 } = await supabase
      .from('people')
      .select('*, companies(name, tier)')
      .eq('outreach_status', 'Ready for DM')

    // Combine Group A — tier filter client-side, deduplicate
    const seenA = new Set()
    const groupA = []
    for (const p of [...(a1 || []), ...(a2 || [])]) {
      if (seenA.has(p.id)) continue
      if (EXCLUDED_TIERS_DM.includes(p.companies?.tier)) continue
      seenA.add(p.id)
      groupA.push({ ...p, _group: 'A' })
    }

    // Group B: follow-up DMs (5+ days since last contact)
    const { data: b } = await supabase
      .from('people')
      .select('*, companies(name, tier)')
      .or('dnc.is.null,dnc.eq.false')
      .is('reply_status', null)
      .not('personalization_type', 'is', null)
      .not('personalization_type', 'in', `(${EXCLUDED_PITCH_TYPES_DM.map(s => `"${s}"`).join(',')})`)
      .in('outreach_status', ['First DM', 'Second DM', 'Ongoing DMs', 'Third DM'])
      .or(`last_outreach_date.is.null,last_outreach_date.lt.${c5},first_dm_date.lt.${c5},second_dm_date.lt.${c5},third_dm_date.lt.${c5}`)
      .order('last_outreach_date', { ascending: true, nullsFirst: true })

    const groupB = (b || []).map(p => ({ ...p, _group: 'B' }))

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
      edited_message:    draft,
      last_outreach_date: d,
      ongoing_dms_tally: (person.ongoing_dms_tally || 0) + 1,
    }
    if (person._group === 'A') {
      update.first_dm_date   = d
      update.outreach_status = 'First DM'
    } else if (person.outreach_status === 'First DM') {
      update.second_dm_date  = d
      update.outreach_status = 'Second DM'
    } else if (person.outreach_status === 'Second DM') {
      update.third_dm_date   = d
      update.outreach_status = 'Third DM'
    } else {
      update.outreach_status = 'Ongoing DMs'
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
        {sent > 0 ? `${sent} DM${sent !== 1 ? 's' : ''} sent this session.` : 'No DMs to send right now.'}
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
            isGroupA ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isGroupA ? 'First DM' : `Follow-up · ${person.outreach_status}`}
          </span>
        </div>
        <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 mb-5">
          {isGroupA ? (
            <>
              <dt className="font-medium text-slate-400">Connected on</dt>
              <dd>{fmt(person.connected_on)}</dd>
              <dt className="font-medium text-slate-400">Source</dt>
              <dd>{person.prospect_source || '—'}</dd>
            </>
          ) : (
            <>
              <dt className="font-medium text-slate-400">Last outreach</dt>
              <dd>{fmt(person.last_outreach_date)}</dd>
              <dt className="font-medium text-slate-400">Stage</dt>
              <dd>{person.outreach_status}</dd>
            </>
          )}
          <dt className="font-medium text-slate-400">LinkedIn</dt>
          <dd>
            {person.linkedin_url
              ? <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View profile</a>
              : '—'}
          </dd>
        </dl>

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
