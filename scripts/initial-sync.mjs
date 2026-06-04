// One-time full sync: run locally with `node scripts/initial-sync.mjs`
// No timeout constraints. Safe to re-run — all upserts are idempotent.

// Credentials are read from environment variables.
// Set them before running:
//   export SUPABASE_URL=https://xxx.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
//   export ATTIO_API_TOKEN=...
// Or add them to a local .env file and source it first.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ATTIO_API_TOKEN) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ATTIO_API_TOKEN')
  process.exit(1)
}

// Dynamically import the sync handler and call syncAttioToSupabase directly
import { createClient } from '@supabase/supabase-js'

const ATTIO_BASE = 'https://api.attio.com/v2'
const CHUNK = 200

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function attio(method, path, body) {
  const res = await fetch(`${ATTIO_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.ATTIO_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Attio ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function attioAll(slug) {
  const records = []
  let offset = 0
  while (true) {
    const { data } = await attio('POST', `/objects/${slug}/records/query`, { limit: 500, offset })
    records.push(...(data ?? []))
    process.stdout.write(`\r  ${slug}: fetched ${records.length}...`)
    if (!data || data.length < 500) break
    offset += data.length
  }
  console.log()
  return records
}

function val(values, ...slugs) {
  for (const slug of slugs) {
    const arr = values?.[slug]
    if (!arr?.length) continue
    const v = arr[0]
    if (v.full_name !== undefined) return v.full_name
    if (v.first_name !== undefined) return [v.first_name, v.last_name].filter(Boolean).join(' ')
    if (v.email_address !== undefined) return v.email_address
    if (v.domain !== undefined) return v.domain
    if (v.target_record_id !== undefined) return v.target_record_id
    if (v.status?.title !== undefined) return v.status.title
    if (v.option?.title !== undefined) return v.option.title
    if (v.currency_value !== undefined) return v.currency_value.value_in_cents / 100
    if (v.value !== undefined) return v.value
  }
  return null
}

function toBool(v) {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase().trim()
  if (['true','yes','1'].includes(s)) return true
  if (['false','no','0',''].includes(s)) return false
  return true
}

function stripNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([,v]) => v !== null && v !== undefined))
}

function mapCompany(r) {
  const { id, values } = r
  return stripNulls({
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
  })
}

function mapDeal(r, companyMap) {
  const { id, values } = r
  const attioCo = val(values, 'company', 'companies', 'associated_company', 'associated_companies')
  const valueArr = values?.value?.[0]
  let dealValue = null
  if (valueArr?.currency_value) dealValue = valueArr.currency_value.value_in_cents / 100
  else if (valueArr?.value !== undefined) dealValue = valueArr.value
  return stripNulls({
    attio_record_id: id.record_id,
    deal_name:       val(values, 'name'),
    deal_stage:      val(values, 'stage', 'deal_stage', 'status'),
    deal_value:      dealValue,
    company_id:      attioCo ? (companyMap[attioCo] ?? null) : null,
    notes:           val(values, 'notes', 'description', 'note'),
  })
}

function mapPerson(r, companyMap, dealMap) {
  const { id, values } = r
  const attioCo   = val(values, 'company', 'companies', 'primary_company')
  const attioDeal = val(values, 'deal', 'deals', 'associated_deal')
  return stripNulls({
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
  })
}

async function upsertByAttioId(supabase, table, rows) {
  if (!rows.length) return 0
  const { data: existing } = await supabase.from(table).select('id, attio_record_id').not('attio_record_id', 'is', null)
  const idMap = {}
  ;(existing ?? []).forEach(r => { idMap[r.attio_record_id] = r.id })

  const toInsert = [], toUpdate = []
  for (const row of rows) {
    const sbId = idMap[row.attio_record_id]
    sbId ? toUpdate.push({ ...row, id: sbId }) : toInsert.push(row)
  }

  let total = 0
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) { console.error(`\n  ✗ insert error (${table}): ${error.message}`); continue }
    total += chunk.length
    process.stdout.write(`\r  ${table}: ${total}/${rows.length} (${toInsert.length} new, ${toUpdate.length} update)...`)
  }
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' })
    if (error) { console.error(`\n  ✗ update error (${table}): ${error.message}`); continue }
    total += chunk.length
    process.stdout.write(`\r  ${table}: ${total}/${rows.length} (${toInsert.length} new, ${toUpdate.length} update)...`)
  }
  console.log()
  return total
}

async function run() {
  const supabase = db()
  console.log('\n=== Initial full sync: Attio → Supabase ===\n')

  // Companies
  console.log('Fetching companies from Attio...')
  const attioCompanies = await attioAll('companies')
  const companyRows = attioCompanies.map(mapCompany).filter(r => r.attio_record_id)
  console.log(`Upserting ${companyRows.length} companies...`)
  const nCompanies = await upsertByAttioId(supabase, 'companies', companyRows)

  const companyMap = {}
  const { data: coRows } = await supabase.from('companies').select('id, attio_record_id')
  ;(coRows ?? []).forEach(r => { companyMap[r.attio_record_id] = r.id })

  // Deals
  console.log('Fetching deals from Attio...')
  const attioDeals = await attioAll('deals')
  const dealRows = attioDeals.map(r => mapDeal(r, companyMap)).filter(r => r.attio_record_id)
  console.log(`Upserting ${dealRows.length} deals...`)
  const nDeals = await upsertByAttioId(supabase, 'deals', dealRows)

  const dealMap = {}
  const { data: dlRows } = await supabase.from('deals').select('id, attio_record_id')
  ;(dlRows ?? []).forEach(r => { dealMap[r.attio_record_id] = r.id })

  // People
  console.log('Fetching people from Attio...')
  const attioPeople = await attioAll('people')
  const peopleRows = attioPeople.map(r => mapPerson(r, companyMap, dealMap)).filter(r => r.attio_record_id)
  console.log(`Upserting ${peopleRows.length} people...`)
  const nPeople = await upsertByAttioId(supabase, 'people', peopleRows)

  console.log('\n=== Done ===')
  console.log(`  Companies: ${nCompanies}`)
  console.log(`  Deals:     ${nDeals}`)
  console.log(`  People:    ${nPeople}`)
}

run().catch(console.error)
