import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const todayStr = () => new Date().toISOString().split('T')[0]
const DAILY_GOAL = 25
const INTERSTITIAL_EVERY = 3
const LS_KEY = `li_connections_${new Date().toDateString()}`

function getDailyCount() {
  try { return parseInt(localStorage.getItem(LS_KEY) || '0', 10) } catch { return 0 }
}
function incDailyCount() {
  try { localStorage.setItem(LS_KEY, getDailyCount() + 1) } catch {}
}

export default function LinkedInConnections() {
  const [queue, setQueue]       = useState([])
  const [idx, setIdx]           = useState(0)
  const [loading, setLoading]   = useState(true)
  const [dailySent, setDailySent] = useState(getDailyCount)
  const [sessionSent, setSessionSent] = useState(0)
  const [showInterstitial, setShowInterstitial] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const { data: compData } = await supabase.from('companies').select('id, name')
    const companyMap = Object.fromEntries((compData || []).map(c => [c.id, c]))

    const { data } = await supabase
      .from('people')
      .select('*')
      .or('dnc.is.null,dnc.eq.false')
      .not('connection_status', 'in', '("Connection request sent","Cannot send connection request","Connected")')
      .not('prospect_source', 'is', null)
      .is('outreach_status', null)
      .order('score', { ascending: false })

    setQueue(
      (data || [])
        .filter(p => p.prospect_source != null && p.prospect_source !== '')
        .map(p => ({ ...p, companies: p.company_id ? (companyMap[p.company_id] ?? null) : null }))
    )
    setLoading(false)
  }

  const person = queue[idx]

  async function sendRequest() {
    await supabase.from('people').update({
      connection_status: 'Connection request sent',
      connection_requested_date: todayStr(),
    }).eq('id', person.id)

    const newSession = sessionSent + 1
    const newDaily   = dailySent + 1
    incDailyCount()
    setSessionSent(newSession)
    setDailySent(newDaily)
    setIdx(i => i + 1)
    if (newSession % INTERSTITIAL_EVERY === 0) setShowInterstitial(true)
  }

  function skip() { setIdx(i => i + 1) }

  if (loading) return <PageShell><p className="text-slate-500">Loading…</p></PageShell>

  if (showInterstitial) return (
    <PageShell>
      <div className="max-w-md bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
        <p className="text-2xl mb-3">✋</p>
        <h2 className="font-semibold text-slate-900 text-lg mb-2">Take a quick break</h2>
        <p className="text-slate-600 mb-6">
          Go leave <strong>5 comments</strong> in Magic Post, then come back.
        </p>
        <button
          onClick={() => setShowInterstitial(false)}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          Done, continue
        </button>
      </div>
    </PageShell>
  )

  if (!person || dailySent >= DAILY_GOAL) return (
    <PageShell>
      <p className="text-slate-500">
        {dailySent >= DAILY_GOAL
          ? `Daily goal of ${DAILY_GOAL} reached. Come back tomorrow!`
          : `Queue empty. ${dailySent} sent today.`}
      </p>
    </PageShell>
  )

  const remaining = Math.max(0, Math.min(DAILY_GOAL - dailySent, queue.length - idx))

  return (
    <PageShell>
      <div className="flex items-center gap-4 mb-6">
        <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden max-w-xs">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${Math.min((dailySent / DAILY_GOAL) * 100, 100)}%` }}
          />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{dailySent} / {DAILY_GOAL} today</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-lg">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900 text-lg">{person.name}</h2>
          <p className="text-slate-500 text-sm">{person.job_title} · {person.companies?.name}</p>
        </div>
        <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 mb-2">
          <dt className="font-medium text-slate-400">Tier</dt>
          <dd>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              person.tier === 'A' ? 'bg-green-100 text-green-700' :
              person.tier === 'B' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-600'
            }`}>{person.tier}</span>
          </dd>
          <dt className="font-medium text-slate-400">Score</dt>
          <dd>{person.score ?? '—'}</dd>
          <dt className="font-medium text-slate-400">LinkedIn</dt>
          <dd>
            {person.linkedin_url
              ? <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate block max-w-[160px]">View profile</a>
              : '—'}
          </dd>
        </dl>
        <p className="text-xs text-slate-400 mb-5">{remaining} left in queue today</p>
        <div className="flex gap-3">
          <button onClick={sendRequest} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition">
            Request sent
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
      <h1 className="text-xl font-semibold text-slate-900 mb-6">LinkedIn connection requests</h1>
      {children}
    </div>
  )
}
