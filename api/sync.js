// Attio ↔ Supabase bidirectional sync
// Deployed as a Vercel serverless function, called every 15 min via cron.

import { createClient } from '@supabase/supabase-js'

const ATTIO_BASE = 'https://api.attio.com/v2'

function supabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

// ── Attio HTTP helper ─────────────────────────────────────────────────────────

async function attio(method, path, body) {
  const res = await fetch(`${ATTIO_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.ATTIO_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Attio ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

// Fetch every page from an Attio object, optionally filtered to records
// modified after `sinceISO` (ISO-8601 string). Falls back to all records
// if Attio rejects the filter.
async function attioAll(objectSlug, sinceISO) {
  const records = []
  let offset = 0
  while (true) {
    const body = { limit: 500, offset }
    if (sinceISO) {
      body.filter = {
        attribute: { slug: 'updated_at' },
        condition: 'after',
        value: sinceISO,
      }
    }
    let data
    try {
      ;({ data } = await attio('POST', `/objects/${objectSlug}/records/query`, body))
    } catch (e) {
      if (sinceISO && e.message.includes('400')) {
        // Filter not supported for this object — fall back to all
        ;({ data } = await attio('POST', `/objects/${objectSlug}/records/query`, { limit: 500, offset }))
      } else throw e
    }
    records.push(...(data ?? []))
    if (!data || data.length < 500) break
    offset += data.length
  }
  return records
}

// ── Value extraction from Attio's nested value arrays ─────────────────────────

function val(values, ...slugs) {
  for (const slug of slugs) {
    const arr = values?.[slug]
    if (!arr?.length) continue
    const v = arr[0]
    // Person name
    if (v.full_name !== undefined) return v.full_name
    if (v.first_name !== undefined) return [v.first_name, v.last_name].filter(Boolean).join(' ')
    // Email
    if (v.email_address !== undefined) return v.email_address
    // Domain
    if (v.domain !== undefined) return v.domain
    // Relationship
    if (v.target_record_id !== undefined) return v.target_record_id
    // Status / option selects
    if (v.status?.title !== undefined) return v.status.title
    if (v.option?.title !== undefined) return v.option.title
    // Currency
    if (v.currency_value !== undefined) return v.currency_value.value_in_cents / 100
    // Plain value (text, date, number, boolean)
    if (v.value !== undefined) return v.value
  }
  return null
}

// ── Attio → Supabase mappers ───────────────────────────────────────────────────

function mapCompany(r) {
  const { id, values } = r
  return {
    attio_record_id:  id.record_id,
    name:             val(values, 'name'),
    domain:           val(values, 'domains', 'primary_domain', 'website', 'domain'),
    linkedin_url:     val(values, 'linkedin_url', 'linkedin', 'linkedin_profile_url'),
    employee_range:   val(values, 'employee_range', 'team_size', 'headcount', 'employees'),
    estimated_arr:    val(values, 'estimated_arr', 'arr', 'annual_revenue'),
    kind_of_business: val(values, 'kind_of_business', 'business_type', 'type'),
    saas_or_agency:   val(values, 'saas_or_agency', 'company_type', 'category'),
    tier:             val(values, 'tier'),
    outbound:         toBool(val(values, 'outbound')) ?? false,
  }
}

function mapDeal(r, companyMap) {
  const { id, values } = r
  const attioCo = val(values, 'company', 'companies', 'associated_company', 'associated_companies')
  return {
    attio_record_id: id.record_id,
    deal_name:       val(values, 'name'),
    deal_stage:      val(values, 'stage', 'deal_stage', 'status'),
    deal_value:      val(values, 'value', 'deal_value', 'amount'),
    company_id:      attioCo ? (companyMap[attioCo] ?? null) : null,
    notes:           val(values, 'notes', 'description', 'note'),
  }
}

function mapPerson(r, companyMap, dealMap) {
  const { id, values } = r
  const attioCo   = val(values, 'company', 'companies', 'primary_company')
  const attioDeal = val(values, 'deal', 'deals', 'associated_deal')
  return {
    attio_record_id:    id.record_id,
    name:               val(values, 'name'),
    email:              val(values, 'email_addresses', 'email', 'primary_email_address'),
    linkedin_url:       val(values, 'linkedin_url', 'linkedin', 'linkedin_profile_url'),
    job_title:          val(values, 'job_title', 'title', 'position'),
    company_id:         attioCo   ? (companyMap[attioCo]   ?? null) : null,
    deal_id:            attioDeal ? (dealMap[attioDeal]     ?? null) : null,
    tier:               val(values, 'tier'),
    score:              val(values, 'score'),
    prospect_source:    val(values, 'prospect_source', 'source', 'lead_source'),
    channel:            val(values, 'channel', 'outreach_channel'),
    personalization_type: val(values, 'personalization_type'),
    // Outreach fields (present if user created them in Attio)
    connection_status:         val(values, 'connection_status'),
    connection_requested_date: val(values, 'connection_requested_date'),
    connected_on:              val(values, 'connected_on'),
    outreach_status:           val(values, 'outreach_status'),
    last_outreach_date:        val(values, 'last_outreach_date'),
    first_dm_date:             val(values, 'first_dm_date'),
    second_dm_date:            val(values, 'second_dm_date'),
    third_dm_date:             val(values, 'third_dm_date'),
    first_email_date:          val(values, 'first_email_date'),
    second_email_date:         val(values, 'second_email_date'),
    third_email_date:          val(values, 'third_email_date'),
    ongoing_dms_tally:         val(values, 'ongoing_dms_tally'),
    ongoing_emails_tally:      val(values, 'ongoing_emails_tally'),
    reply_status:              val(values, 'reply_status'),
    next_due_task:             val(values, 'next_due_task'),
    dnc:                       toBool(val(values, 'dnc')),
    ai_draft_message:          val(values, 'ai_draft_message'),
    edited_message:            val(values, 'edited_message'),
  }
}

// Coerce Attio boolean-ish values (selects like "DNC", "Yes", "true") to real booleans
function toBool(v) {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase().trim()
  if (s === 'true' || s === 'yes' || s === '1') return true
  if (s === 'false' || s === 'no'  || s === '0' || s === '') return false
  // Non-empty option string means the flag is set (e.g. "DNC" option selected)
  return true
}

// Strip null values so we don't clobber existing data unnecessarily
function stripNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined))
}

// ── Attio → Supabase ───────────────────────────────────────────────────────────

const CHUNK = 200

async function chunkUpsert(db, table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' })
    if (error) return error
  }
  return null
}

// Upsert without requiring a UNIQUE constraint on attio_record_id:
// fetch existing {id, attio_record_id} pairs, inject the PK for known records,
// then upsert on the primary key (which always has a unique constraint).
async function upsertByAttioId(db, table, rows) {
  if (!rows.length) return { count: 0, error: null }

  const { data: existing } = await db.from(table).select('id, attio_record_id').not('attio_record_id', 'is', null)
  const idMap = {}
  ;(existing ?? []).forEach(r => { idMap[r.attio_record_id] = r.id })

  const merged = rows.map(row => {
    const sbId = idMap[row.attio_record_id]
    return sbId ? { ...row, id: sbId } : row
  })

  const error = await chunkUpsert(db, table, merged)
  return { count: error ? 0 : merged.length, error }
}

async function syncAttioToSupabase(db, sinceISO) {
  const log = { companies: 0, deals: 0, people: 0, errors: [], mode: sinceISO ? 'incremental' : 'full' }

  // 1. Companies
  try {
    const records = await attioAll('companies', sinceISO)
    const rows = records.map(r => stripNulls(mapCompany(r))).filter(r => r.attio_record_id)
    const { count, error } = await upsertByAttioId(db, 'companies', rows)
    if (error) log.errors.push(`companies: ${error.message}`)
    else log.companies = count
  } catch (e) { log.errors.push(`companies fetch: ${e.message}`) }

  // Build Attio→Supabase ID maps (only need IDs touched in this run + existing)
  const companyMap = {}
  const { data: coRows } = await db.from('companies').select('id, attio_record_id')
  ;(coRows ?? []).forEach(r => { companyMap[r.attio_record_id] = r.id })

  // 2. Deals
  try {
    const records = await attioAll('deals', sinceISO)
    const rows = records.map(r => stripNulls(mapDeal(r, companyMap))).filter(r => r.attio_record_id)
    const { count, error } = await upsertByAttioId(db, 'deals', rows)
    if (error) log.errors.push(`deals: ${error.message}`)
    else log.deals = count
  } catch (e) { log.errors.push(`deals fetch: ${e.message}`) }

  const dealMap = {}
  const { data: dlRows } = await db.from('deals').select('id, attio_record_id')
  ;(dlRows ?? []).forEach(r => { dealMap[r.attio_record_id] = r.id })

  // 3. People (last — depends on companies + deals)
  try {
    const records = await attioAll('people', sinceISO)
    const rows = records
      .map(r => stripNulls(mapPerson(r, companyMap, dealMap)))
      .filter(r => r.attio_record_id)
    const { count, error } = await upsertByAttioId(db, 'people', rows)
    if (error) log.errors.push(`people: ${error.message}`)
    else log.people = count
  } catch (e) { log.errors.push(`people fetch: ${e.message}`) }

  return log
}

// ── Supabase → Attio ───────────────────────────────────────────────────────────

// Map Supabase column → Attio attribute slug and value format
const PUSH_FIELDS = [
  // [supabase_col, attio_slug, type]
  ['connection_status',         'connection_status',         'text'],
  ['connection_requested_date', 'connection_requested_date', 'date'],
  ['connected_on',              'connected_on',              'date'],
  ['outreach_status',           'outreach_status',           'text'],
  ['last_outreach_date',        'last_outreach_date',        'date'],
  ['reply_status',              'reply_status',              'text'],
  ['next_due_task',             'next_due_task',             'date'],
  ['first_dm_date',             'first_dm_date',             'date'],
  ['second_dm_date',            'second_dm_date',            'date'],
  ['third_dm_date',             'third_dm_date',             'date'],
  ['first_email_date',          'first_email_date',          'date'],
  ['second_email_date',         'second_email_date',         'date'],
  ['third_email_date',          'third_email_date',          'date'],
  ['ongoing_dms_tally',         'ongoing_dms_tally',         'number'],
  ['ongoing_emails_tally',      'ongoing_emails_tally',      'number'],
  ['score',                     'score',                     'number'],
  ['dnc',                       'dnc',                       'boolean'],
  ['ai_draft_message',          'ai_draft_message',          'text'],
  ['edited_message',            'edited_message',            'text'],
]

function toAttioValues(person) {
  const values = {}
  for (const [col, slug] of PUSH_FIELDS) {
    const v = person[col]
    if (v == null) continue
    values[slug] = [{ value: v }]
  }
  return values
}

async function syncSupabaseToAttio(db) {
  const log = { pushed: 0, skipped: 0, errors: [] }

  // Only push people who have been actively worked — skip untouched records
  const { data: people, error } = await db
    .from('people')
    .select('*')
    .not('attio_record_id', 'is', null)
    .or('connection_status.neq.Not sent,outreach_status.neq.Not started,first_dm_date.not.is.null,first_email_date.not.is.null,reply_status.not.is.null')

  if (error) { log.errors.push(error.message); return log }

  for (const person of people ?? []) {
    const values = toAttioValues(person)
    if (!Object.keys(values).length) { log.skipped++; continue }

    try {
      await attio('PATCH', `/objects/people/records/${person.attio_record_id}`, {
        data: { values },
      })
      log.pushed++
    } catch (e) {
      // 404 = attribute doesn't exist in Attio yet — not fatal
      const msg = e.message
      if (msg.includes('404') || msg.includes('not_found')) {
        log.skipped++
      } else {
        log.errors.push(`${person.attio_record_id}: ${msg.slice(0, 120)}`)
      }
    }

    // Respect Attio's ~10 req/s rate limit
    await new Promise(r => setTimeout(r, 120))
  }

  return log
}

// ── Vercel handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Protect the endpoint — Vercel injects CRON_SECRET automatically for cron invocations
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization ?? ''
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const ts = new Date().toISOString()
  console.log(`[sync] start ${ts}`)

  const db = supabaseClient()
  const results = {}

  // ?full=1 → sync everything; default (cron) → only last 20 minutes
  const full = req.query?.full === '1' || req.query?.full === 'true'
  const sinceISO = full ? null : new Date(Date.now() - 20 * 60 * 1000).toISOString()
  console.log(`[sync] mode=${full ? 'full' : 'incremental'} since=${sinceISO ?? 'all'}`)

  results.attioToSupabase = await syncAttioToSupabase(db, sinceISO)
  console.log('[sync] Attio→Supabase', results.attioToSupabase)

  results.supabaseToAttio = await syncSupabaseToAttio(db)
  console.log('[sync] Supabase→Attio', results.supabaseToAttio)

  console.log(`[sync] done ${new Date().toISOString()}`)

  return res.status(200).json({ success: true, timestamp: ts, results })
}
