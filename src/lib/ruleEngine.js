// Rule Engine Core
export const RULE_STATUS = Object.freeze({ DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' })
export const RULE_ACTION_TYPES = Object.freeze({
  REQUIRE_DOCUMENT: 'requireDocument',
  MODIFY_RISK: 'modifyRisk',
  APPLY_READINESS_PENALTY: 'applyReadinessPenalty',
  ADD_CHECKLIST: 'addChecklist',
  REMOVE_CHECKLIST: 'removeChecklist',
  BLOCK_SUBMISSION: 'blockSubmission',
  SET_FLAG: 'setFlag',
})
export const CONDITION_OPS = Object.freeze({ EQ: '==', NEQ: '!=', GT: '>', LT: '<', GTE: '>=', LTE: '<=', IN: 'in', NOT_IN: 'not_in', CONTAINS: 'contains', EXISTS: 'exists' })
const MAX_DEPTH = 3
const MAX_ACTIONS = 10

const NET_WORTH_USD_RATES = {
  USD: 1,
  SGD: 0.74,
  CHF: 1.1,
  GBP: 1.25,
  EUR: 1.08,
}

function getNetWorthUsdValue(caseFile) {
  const amount = Number(String(caseFile?.netWorth || '').replace(/,/g, ''))
  const rate = NET_WORTH_USD_RATES[caseFile?.netWorthCurrency || 'USD'] || NET_WORTH_USD_RATES.USD
  return amount * rate
}

export const STANDARD_CHECKLIST_ITEMS = [
  { key: 'identity_verified', label: 'Identity verified', category: 'KYC' },
  { key: 'address_proof_checked', label: 'Address proof checked', category: 'KYC' },
  { key: 'tax_residency_checked', label: 'Tax residency checked', category: 'Tax' },
  { key: 'sow_reviewed', label: 'Source of Wealth reviewed', category: 'SoW' },
  { key: 'bank_statements_reviewed', label: 'Bank statements reviewed', category: 'SoF' },
  { key: 'ai_risks_reviewed', label: 'AI risks reviewed', category: 'Risk' },
  { key: 'mismatches_resolved', label: 'Mismatches resolved', category: 'Risk' },
]

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'draft') return RULE_STATUS.DRAFT
  if (value === 'published') return RULE_STATUS.PUBLISHED
  if (value === 'archived') return RULE_STATUS.ARCHIVED
  return status || RULE_STATUS.DRAFT
}

function stableRuleKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeCondition(condition) {
  if (!condition) return null
  const clauses = Array.isArray(condition.clauses)
    ? condition.clauses
    : Array.isArray(condition.conditions)
      ? condition.conditions
      : null
  if ((condition.operator === 'AND' || condition.operator === 'OR') && clauses) {
    return {
      operator: condition.operator,
      clauses: clauses.map(normalizeCondition).filter(Boolean),
    }
  }
  return {
    field: condition.field,
    operator: condition.operator,
    value: condition.value,
  }
}

export function normalizeAction(action = {}) {
  const params = action.params || {}
  switch (action.type) {
    case 'requireDocument':
      return {
        type: RULE_ACTION_TYPES.REQUIRE_DOCUMENT,
        target: action.target || params.label || params.documentKey,
        reason: action.reason || params.reason,
      }
    case 'modifyRisk':
      return {
        type: RULE_ACTION_TYPES.MODIFY_RISK,
        modifier: action.modifier || params.riskLevel || (params.riskDelta ? `${Number(params.riskDelta) > 0 ? '+' : ''}${params.riskDelta}` : '+0'),
        reason: action.reason || params.reason,
      }
    case 'modifyReadiness':
    case 'applyReadinessPenalty':
      return {
        type: RULE_ACTION_TYPES.APPLY_READINESS_PENALTY,
        value: action.value ?? params.readinessDelta ?? params.value ?? 0,
        reason: action.reason || params.reason,
      }
    case 'addChecklistItem':
    case 'addChecklist':
      return {
        type: RULE_ACTION_TYPES.ADD_CHECKLIST,
        key: action.key || params.key || stableRuleKey(params.item || action.item),
        item: action.item || params.item,
        category: action.category || params.category || 'Rule-Driven',
        reason: action.reason || params.reason,
      }
    case 'blockSubmission':
      return {
        type: RULE_ACTION_TYPES.BLOCK_SUBMISSION,
        reason: action.reason || params.reason,
        until: action.until || params.until,
      }
    default:
      return action
  }
}

export function normalizeRule(rule = {}) {
  const effectiveDate = rule.effectiveDate || rule.effectiveFrom || null
  const expiryDate = rule.expiryDate || rule.effectiveTo || null
  return {
    ...rule,
    status: normalizeStatus(rule.status),
    effectiveDate,
    expiryDate,
    conditions: normalizeCondition(rule.conditions),
    actions: Array.isArray(rule.actions) ? rule.actions.map(normalizeAction).filter((action) => action?.type) : [],
  }
}

export function extractFacts(caseFile) {
  const docs = Array.isArray(caseFile?.documents) ? caseFile.documents : []
  const ai = caseFile?.aiAnalysis || {}
  const risks = Array.isArray(ai.risks) ? ai.risks : []
  const rawMismatches = Array.isArray(ai.mismatches) ? ai.mismatches : []
  const mm = rawMismatches.filter((mismatch) => {
    const evidenceCategory = getEvidenceCategoryForText(mismatch)
    return !hasUploadedEvidenceForCategory(caseFile, evidenceCategory)
  })
  const checklist = caseFile?.complianceChecklist || {}
  const docStatus = {}
  docs.forEach((d) => { const c = String(d?.category || '').trim(); if (!c) return; if (!docStatus[c]) docStatus[c] = []; let s = d.reviewStatus === 'accept' ? 'accepted' : d.reviewStatus || (d.extractedText ? 'uploaded' : 'uploaded'); docStatus[c].push(s) })
  const catStatus = {}
  Object.entries(docStatus).forEach(([c, s]) => { if (s.includes('accepted')) catStatus[c] = 'accepted'; else if (s.includes('uploaded')) catStatus[c] = 'uploaded'; else if (s.includes('needs_clarification')) catStatus[c] = 'needs_clarification'; else if (s.includes('rejected')) catStatus[c] = 'rejected'; else catStatus[c] = 'missing' })
  const maxSev = risks.reduce((m, r) => { const v = { critical: 4, high: 3, medium: 2, low: 1 }[String(r?.severity || r?.priority || '').toLowerCase()] || 0; return Math.max(m, v) }, 0)
  const sevMap = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' }
  const netWorthUsd = getNetWorthUsdValue(caseFile)
  const facts = {
    'client.name': caseFile?.clientName || caseFile?.fullName || '',
    'client.occupation': caseFile?.occupation || '',
    'client.nationality': caseFile?.nationality || '',
    'client.residence': caseFile?.residence || '',
    'client.netWorth': netWorthUsd,
    'client.netWorthOriginal': Number(caseFile?.netWorth || 0),
    'client.netWorthCurrency': caseFile?.netWorthCurrency || 'USD',
    clientProfileType: '',
    netWorth: netWorthUsd,
    riskAppetite: caseFile?.riskAppetite || '',
    usPerson: /united states|u\.s\./i.test(String(caseFile?.nationality || '') + ' ' + String(caseFile?.residence || '')),
    pep: Boolean(caseFile?.pep),
    'client.purpose': caseFile?.purpose || '',
    'case.status': caseFile?.status || 'Draft',
    status: caseFile?.status || 'Draft',
    'documents.totalCount': docs.length,
    documentCount: docs.length,
    'aiAnalysis.riskCount': risks.length,
    aiRiskCount: risks.length,
    'aiAnalysis.maxRiskSeverity': sevMap[maxSev],
    'aiAnalysis.hasCriticalRisk': maxSev >= 4,
    'aiAnalysis.hasHighRisk': maxSev >= 3,
    'aiAnalysis.mismatchCount': mm.length,
    aiMismatchCount: mm.length,
    'aiAnalysis.hasMismatches': mm.length > 0,
    'checklist.completedCount': Object.values(checklist).filter((i) => i?.checked).length,
    'checklist.allComplete': Object.values(checklist).filter((i) => i?.checked).length === 7,
    'derived.isBusinessOwner': /\bbusiness owner\b|\bowner\b|\bfounder\b|\bentrepreneur\b/i.test(String(caseFile?.occupation || '')),
    'derived.isInvestor': /\binvestor\b|\btrader\b|\bportfolio\b|\bfund\b/i.test(String(caseFile?.occupation || '')),
    'derived.isSalaried': /\bemployee\b|\bsalaried\b/i.test(String(caseFile?.occupation || '')),
    'derived.isUSPerson': /united states|u\.s\./i.test(String(caseFile?.nationality || '') + ' ' + String(caseFile?.residence || '')),
    'derived.netWorthCategory': (v => { const n = Number(v || 0); if (n >= 10000000) return 'Ultra HNW'; if (n >= 5000000) return 'HNW'; if (n >= 1000000) return 'Affluent'; return 'Standard' })(netWorthUsd),
  }
  facts.clientProfileType = facts['derived.isBusinessOwner'] ? 'Business Owner' : facts['derived.isInvestor'] ? 'Investor' : 'Salaried Employee'
  Object.entries(catStatus).forEach(([c, s]) => { facts[`documents.category.${c}.status`] = s; facts[`documents.category.${c}.exists`] = s !== 'missing' })
  facts.hasPassportOrID = Boolean(facts['documents.category.Passport / ID.exists'])
  facts.hasAddressProof = Boolean(facts['documents.category.Address Proof.exists'])
  facts.hasTaxResidency = Boolean(facts['documents.category.Tax Residency.exists'])
  facts.hasSoWDeclaration = Boolean(facts['documents.category.SoW Declaration.exists'])
  facts.hasBankStatements = Boolean(facts['documents.category.Bank Statements (Source of Funds).exists'])
  facts.hasEmploymentDocs = Boolean(facts['documents.category.Payslips.exists'] || facts['documents.category.Employment Contract.exists'])
  facts.hasBusinessDocs = Boolean(facts['documents.category.Business Registry Extract.exists'] || facts['documents.category.Shareholding Structure.exists'])
  facts.hasInvestmentDocs = Boolean(facts['documents.category.Investment Portfolio Statements.exists'] || facts['documents.category.Trade Confirmations.exists'])
  const chkItems = ['identity_verified', 'address_proof_checked', 'tax_residency_checked', 'sow_reviewed', 'bank_statements_reviewed', 'ai_risks_reviewed', 'mismatches_resolved']
  chkItems.forEach((k) => { facts[`checklist.${k}.checked`] = !!checklist[k]?.checked })
  return facts
}

function formatFactText(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatFactText).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return [
      value.evidenceCategory,
      value.category,
      value.name,
      value.suggestedActionText,
      value.extractedText,
      value.field,
      value.label,
      value.declared,
      value.detected,
      value.source,
      value.description,
      value.issue,
      value.reason,
      value.title,
      value.document,
    ].map(formatFactText).filter(Boolean).join(' ')
  }
  return ''
}

function getEvidenceCategoryForText(value) {
  const text = formatFactText(value).toLowerCase()
  if (!text) return null

  if (/\b(form 1040|us individual tax return|w-?2|us tax return)\b/.test(text)) return 'us_tax_return'
  if (/\b(w-?9|fatca|self.?certification|specified us person|us person.*tax|taxpayer identification number|tin provided)\b/.test(text)) return 'fatca_documentation'
  if (/\b(singapore.*tax|iras|dual tax residency|tax residency certificate|tax residency documentation|tax residency letter|residency notice)\b/.test(text)) return 'singapore_tax_residency'
  if (/\b(rsu|restricted stock|stock compensation|stock plan|vesting|vested|grant)\b/.test(text)) return 'rsu_portfolio_support'
  if (/\b(portfolio growth|brokerage|investment portfolio|portfolio statement|listed securities)\b/.test(text)) return 'rsu_portfolio_support'
  if (/\b(bank statement|source of funds|sof|salary transfer|bonus transfer|cash balance|liquidity|savings account)\b/.test(text)) return 'bank_statement'
  if (/\b(source of wealth|sow|wealth verification|net worth|net-worth|asset statement|asset valuation|asset breakdown|property deed|financial statement|net-worth certification|conversion rationale|conversion methodology|currency conversion|single currency)\b/.test(text)) return 'source_of_wealth'
  if (/\b(employment|employer|salary|payslip|bonus|income letter|employment contract)\b/.test(text)) return 'employment_income'
  if (/\b(company ownership|shareholding|business registry|company registration|employer registration|registry extract)\b/.test(text)) return 'company_ownership'
  if (/\b(dividend|distribution)\b/.test(text)) return 'dividend_income'
  if (/\b(address proof|residential proof|residence proof|utility bill|lease|driver.?s licence|driver.?s license)\b/.test(text)) return 'address_proof'
  if (/\b(passport|identity document|id document|national id)\b/.test(text)) return 'identity_document'
  if (/\b(sanctions?|pep|adverse media|screening)\b/.test(text)) return 'screening'
  if (/\b(enhanced due.?diligence|\bedd\b)\b/.test(text)) return 'enhanced_due_diligence'
  return null
}

function hasUploadedEvidenceForCategory(caseFile, evidenceCategory) {
  if (!evidenceCategory) return false
  return (caseFile?.documents || []).some((document) => (
    document.evidenceCategory === evidenceCategory
    || getEvidenceCategoryForText(document) === evidenceCategory
  ))
}

function compare(actual, op, expected) {
  if (op === 'exists') return actual !== undefined && actual !== null && actual !== ''
  if (actual === undefined || actual === null) return ['!=', 'not_in'].includes(op)
  const sa = String(actual).toLowerCase(), se = String(expected).toLowerCase()
  switch (op) {
    case '==': return sa === se
    case '!=': return sa !== se
    case '>': return Number(actual) > Number(expected)
    case '<': return Number(actual) < Number(expected)
    case '>=': return Number(actual) >= Number(expected)
    case '<=': return Number(actual) <= Number(expected)
    case 'in': return Array.isArray(expected) ? expected.some((e) => String(e).toLowerCase() === sa) : se.includes(sa)
    case 'not_in': return Array.isArray(expected) ? !expected.some((e) => String(e).toLowerCase() === sa) : !se.includes(sa)
    case 'contains': return sa.includes(se)
    default: return false
  }
}

export function evaluateCondition(condition, facts) {
  condition = normalizeCondition(condition)
  if (!condition) return { match: true, reason: 'empty' }
  if (condition.operator === 'AND' || condition.operator === 'OR') {
    const clauses = Array.isArray(condition.clauses) ? condition.clauses : []
    const results = clauses.map((c) => evaluateCondition(c, facts))
    const isAnd = condition.operator === 'AND'
    const match = isAnd ? results.every((r) => r.match) : results.some((r) => r.match)
    return { match, reason: `${condition.operator}: ${match ? 'met' : isAnd ? 'failed' : 'none met'}`, detail: results }
  }
  const { field, operator, value } = condition
  if (!field || !operator) return { match: false, reason: 'incomplete' }
  const res = compare(facts[field], operator, value)
  return { match: res, reason: `${field} ${operator} ${JSON.stringify(value)} => ${JSON.stringify(facts[field])} = ${res}`, actualValue: facts[field], expectedValue: value }
}

export function isRuleEffective(rule) {
  rule = normalizeRule(rule)
  if (!rule || rule.status !== RULE_STATUS.PUBLISHED) return false
  const now = new Date()
  const ed = rule.effectiveDate ? new Date(rule.effectiveDate) : null
  const ex = rule.expiryDate ? new Date(rule.expiryDate) : null
  if (ed && now < ed) return false
  if (ex && now > ex) return false
  return true
}

export function aggregateActions(triggered) {
  const reqDocs = new Map(), riskMods = [], readPen = [], chkItems = new Map(), blockers = [], flags = new Map()
  for (const { rule, actions } of triggered) {
    for (const rawAction of (actions || [])) {
      const a = normalizeAction(rawAction)
      if (!a?.type) continue
      const src = { ruleId: rule.id, ruleVersion: rule.version, ruleName: rule.name, policyReference: rule.policyReference }
      switch (a.type) {
        case 'requireDocument':
          if (!reqDocs.has(a.target)) reqDocs.set(a.target, { target: a.target, reason: a.reason || `Required by ${rule.name}`, sources: [] })
          reqDocs.get(a.target).sources.push(src)
          break
        case 'modifyRisk':
          riskMods.push({ modifier: a.modifier || '+0', reason: a.reason || `From ${rule.name}`, source: src })
          break
        case 'applyReadinessPenalty':
          readPen.push({ value: Number(a.value || 0), reason: a.reason || `From ${rule.name}`, source: src })
          break
        case 'addChecklist':
          if (a.item) { const k = a.key || `rule-${rule.id}-${a.item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; chkItems.set(k, { key: k, label: a.item, category: a.category || 'Rule-Driven', reason: a.reason || `From ${rule.name}`, ruleDriven: true, policyRef: rule.policyReference, sources: [...(chkItems.get(k)?.sources || []), src] }) }
          break
        case 'removeChecklist':
          if (a.target) chkItems.set(a.target, null)
          break
        case 'blockSubmission':
          blockers.push({ reason: a.reason || `Blocked by ${rule.name}`, until: a.until || 'conditionsResolved', source: src })
          break
        case 'setFlag':
          if (a.key) flags.set(a.key, { key: a.key, value: a.value, severity: a.severity || 'Medium', reason: a.reason || `From ${rule.name}`, source: src })
          break
      }
    }
  }
  return {
    requiredDocuments: Array.from(reqDocs.values()),
    riskModifiers: riskMods,
    readinessPenalties: readPen,
    checklistItems: Array.from(chkItems.entries()).filter(([, v]) => v !== null).map(([, v]) => v),
    removedChecklistKeys: Array.from(chkItems.entries()).filter(([, v]) => v === null).map(([k]) => k),
    blockers,
    flags: Array.from(flags.values()),
  }
}

export function computeAdjustedRisk(baseline, modifiers) {
  const order = ['Low', 'Medium', 'High', 'Critical']
  let idx = order.indexOf(baseline)
  if (idx === -1) idx = 0
  for (const m of modifiers) {
    const s = String(m.modifier).trim()
    if (s.startsWith('+')) { const steps = Number(s.replace('+', '')) || 1; idx = Math.min(idx + steps, order.length - 1) }
    else if (s.startsWith('-')) { const steps = Number(s.replace('-', '')) || 1; idx = Math.max(idx - steps, 0) }
    else if (order.includes(s)) idx = order.indexOf(s)
  }
  return { baseline, adjusted: order[idx], modifiers, changed: baseline !== order[idx] }
}

export function computeAdjustedReadiness(baseline, penalties) {
  const total = penalties.reduce((s, p) => s + (Number(p.value) || 0), 0)
  const adj = Math.max(0, Math.min(100, baseline - total))
  return { baseline, adjusted: adj, totalPenalty: total, penalties, changed: baseline !== adj }
}

export function evaluateRules(caseFile, activeRules, options = {}) {
  const facts = extractFacts(caseFile)
  const rules = (activeRules || []).map(normalizeRule).filter(isRuleEffective).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  const triggered = []
  for (const rule of rules) {
    const res = evaluateCondition(rule.conditions, facts)
    if (res.match) triggered.push({ rule: { id: rule.id, version: rule.version, name: rule.name, policyReference: rule.policyReference, description: rule.description }, matchedConditions: res, actions: rule.actions || [] })
  }
  const aggregated = aggregateActions(triggered)
  const br = options.baselineRisk || 'Low'
  const brr = options.baselineReadiness ?? 0
  const riskRes = computeAdjustedRisk(br, aggregated.riskModifiers)
  const readyRes = computeAdjustedReadiness(brr, aggregated.readinessPenalties)
  return {
    evaluatedAt: new Date().toISOString(),
    ruleSetVersion: computeRuleSetVersion(rules),
    activeRuleCount: rules.length,
    triggeredRuleCount: triggered.length,
    facts,
    triggeredRules: triggered,
    aggregatedActions: aggregated,
    computedMetrics: {
      baselineReadiness: brr,
      baselineRisk: br,
      ruleAdjustedReadiness: readyRes.adjusted,
      ruleAdjustedRisk: riskRes.adjusted,
      finalReadiness: readyRes.adjusted,
      finalRiskLevel: riskRes.adjusted,
      readinessPenalty: readyRes.totalPenalty,
      riskModifierCount: aggregated.riskModifiers.length,
      hasBlockers: aggregated.blockers.length > 0,
    },
    raw: { riskResult: riskRes, readinessResult: readyRes },
  }
}

function computeRuleSetVersion(rules) {
  const sigs = (rules || []).sort((a, b) => String(a.id).localeCompare(String(b.id))).map((r) => `${r.id}:v${r.version || 1}`)
  let h = 0
  for (const sig of sigs) for (let i = 0; i < sig.length; i++) { h = ((h << 5) - h) + sig.charCodeAt(i); h |= 0 }
  return `rs-${Math.abs(h).toString(36)}-${sigs.length}`
}

export function evaluateRule(rule, facts) {
  rule = normalizeRule(rule)
  if (!rule || !rule.conditions) return { match: false, reason: 'invalid rule' }
  const res = evaluateCondition(rule.conditions, facts)
  return { match: res.match, reason: res.reason, matchedConditions: res }
}

export function validateRule(rule) {
  rule = normalizeRule(rule)
  const errors = []
  if (!rule.id) errors.push('Rule ID required')
  if (!rule.name) errors.push('Rule name required')
  if (!rule.conditions) errors.push('Conditions required')
  if (!Array.isArray(rule.actions)) errors.push('Actions must be array')
  if ((rule.actions || []).length > MAX_ACTIONS) errors.push(`Max ${MAX_ACTIONS} actions`)
  if (!rule.policyReference) errors.push('Policy reference required')
  if (!rule.effectiveDate) errors.push('Effective date required')
  const depth = getDepth(rule.conditions)
  if (depth > MAX_DEPTH) errors.push(`Max depth ${MAX_DEPTH}, found ${depth}`)
  return { valid: errors.length === 0, errors }
}

function getDepth(c, d = 0) {
  c = normalizeCondition(c)
  if (!c || !c.clauses || !Array.isArray(c.clauses) || c.clauses.length === 0) return d
  return Math.max(...c.clauses.map((x) => getDepth(x, d + 1)))
}

// Default rules that mirror current hardcoded behavior
export function getDefaultRules() {
  const now = new Date().toISOString()
  return [
    { id: 'rule-kyc-mandatory', version: 1, status: RULE_STATUS.PUBLISHED, name: 'KYC Documents Mandatory', description: 'Passport/ID and Address Proof are required for all clients.', effectiveDate: now, expiryDate: null, policyReference: 'POL-KYC-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 1000, conditions: { operator: 'AND', clauses: [] }, actions: [{ type: 'requireDocument', target: 'Passport / ID', reason: 'Identity verification is mandatory' }, { type: 'requireDocument', target: 'Address Proof', reason: 'Address verification is mandatory' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-tax-mandatory', version: 1, status: RULE_STATUS.PUBLISHED, name: 'Tax Residency Mandatory', description: 'Tax residency documentation is required for CRS/FATCA compliance.', effectiveDate: now, expiryDate: null, policyReference: 'POL-TAX-2026-001', regulatoryFramework: 'CRS/FATCA', priority: 1000, conditions: { operator: 'AND', clauses: [] }, actions: [{ type: 'requireDocument', target: 'Tax Residency', reason: 'CRS/FATCA tax residency evidence required' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-sow-mandatory', version: 1, status: RULE_STATUS.PUBLISHED, name: 'SoW Declaration Mandatory', description: 'Source of Wealth declaration is required for all onboarding clients.', effectiveDate: now, expiryDate: null, policyReference: 'POL-SOW-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 1000, conditions: { operator: 'AND', clauses: [] }, actions: [{ type: 'requireDocument', target: 'SoW Declaration', reason: 'Source of Wealth declaration is mandatory' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-bank-mandatory', version: 1, status: RULE_STATUS.PUBLISHED, name: 'Bank Statements for SoF', description: 'Bank statements are required to evidence Source of Funds.', effectiveDate: now, expiryDate: null, policyReference: 'POL-SOF-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 1000, conditions: { operator: 'AND', clauses: [] }, actions: [{ type: 'requireDocument', target: 'Bank Statements (Source of Funds)', reason: 'Bank statements required for SoF evidence' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-bo-docs', version: 1, status: RULE_STATUS.PUBLISHED, name: 'Business Owner Extended Docs', description: 'Business owners require additional corporate documentation.', effectiveDate: now, expiryDate: null, policyReference: 'POL-BO-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 900, conditions: { operator: 'AND', clauses: [{ field: 'derived.isBusinessOwner', operator: '==', value: true }] }, actions: [{ type: 'requireDocument', target: 'Business Registry Extract', reason: 'Business Owner profile' }, { type: 'requireDocument', target: 'Shareholding Structure', reason: 'Business Owner profile' }, { type: 'requireDocument', target: 'Company Financial Statements', reason: 'Business Owner profile' }, { type: 'requireDocument', target: 'Dividend Statements', reason: 'Business Owner profile' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-emp-docs', version: 1, status: RULE_STATUS.PUBLISHED, name: 'Salaried Employee Docs', description: 'Salaried employees require employment evidence.', effectiveDate: now, expiryDate: null, policyReference: 'POL-EMP-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 900, conditions: { operator: 'AND', clauses: [{ field: 'derived.isSalaried', operator: '==', value: true }] }, actions: [{ type: 'requireDocument', target: 'Payslips', reason: 'Salaried Employee profile' }, { type: 'requireDocument', target: 'Employment Contract', reason: 'Salaried Employee profile' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-inv-docs', version: 1, status: RULE_STATUS.PUBLISHED, name: 'Investor Portfolio Docs', description: 'Investors require portfolio and trading evidence.', effectiveDate: now, expiryDate: null, policyReference: 'POL-INV-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 900, conditions: { operator: 'AND', clauses: [{ field: 'derived.isInvestor', operator: '==', value: true }] }, actions: [{ type: 'requireDocument', target: 'Investment Portfolio Statements', reason: 'Investor profile' }, { type: 'requireDocument', target: 'Trade Confirmations', reason: 'Investor profile' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-risk-high', version: 1, status: RULE_STATUS.PUBLISHED, name: 'High/Critical Risk Elevation', description: 'Any high or critical AI risk finding elevates case risk level.', effectiveDate: now, expiryDate: null, policyReference: 'POL-RISK-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 500, conditions: { operator: 'AND', clauses: [{ field: 'aiAnalysis.hasHighRisk', operator: '==', value: true }] }, actions: [{ type: 'modifyRisk', modifier: 'High', reason: 'High/Critical AI risk detected' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-missing-docs-penalty', version: 1, status: RULE_STATUS.PUBLISHED, name: 'Missing Documents Readiness Penalty', description: 'Incomplete documents reduce readiness score.', effectiveDate: now, expiryDate: null, policyReference: 'POL-READ-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 400, conditions: { operator: 'AND', clauses: [{ field: 'documents.totalCount', operator: '<', value: 1 }] }, actions: [{ type: 'applyReadinessPenalty', value: 100, reason: 'No documents uploaded' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-hnw-enhanced', version: 1, status: RULE_STATUS.PUBLISHED, name: 'HNW Enhanced Due Diligence', description: 'High net worth clients require enhanced KYC checks.', effectiveDate: now, expiryDate: null, policyReference: 'POL-EDD-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 800, conditions: { operator: 'AND', clauses: [{ field: 'derived.netWorthCategory', operator: 'in', value: ['HNW', 'Ultra HNW'] }] }, actions: [{ type: 'addChecklist', item: 'Enhanced KYC verification completed', category: 'Enhanced KYC', key: 'enhanced_kyc', reason: 'HNW tier client' }, { type: 'modifyRisk', modifier: '+1', reason: 'Elevated wealth tier requires enhanced DD' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-us-person-fatca', version: 1, status: RULE_STATUS.PUBLISHED, name: 'US Person FATCA Requirements', description: 'US persons require additional FATCA documentation.', effectiveDate: now, expiryDate: null, policyReference: 'POL-FATCA-2026-001', regulatoryFramework: 'FATCA', priority: 850, conditions: { operator: 'AND', clauses: [{ field: 'derived.isUSPerson', operator: '==', value: true }] }, actions: [{ type: 'requireDocument', target: 'W-9 Form', reason: 'US Person identified - FATCA compliance' }, { type: 'addChecklist', item: 'FATCA reporting reviewed', category: 'Tax', key: 'fatca_reviewed', reason: 'US Person requires FATCA review' }, { type: 'modifyRisk', modifier: '+1', reason: 'US Person increases compliance complexity' }], author: 'system', createdAt: now, updatedAt: now },
    { id: 'rule-mismatch-penalty', version: 1, status: RULE_STATUS.PUBLISHED, name: 'AI Mismatch Readiness Penalty', description: 'Detected mismatches between declared and extracted values reduce readiness.', effectiveDate: now, expiryDate: null, policyReference: 'POL-MIS-2026-001', regulatoryFramework: 'MAS Notice 626', priority: 450, conditions: { operator: 'AND', clauses: [{ field: 'aiAnalysis.hasMismatches', operator: '==', value: true }] }, actions: [{ type: 'applyReadinessPenalty', value: 15, reason: 'AI detected mismatches requiring review' }], author: 'system', createdAt: now, updatedAt: now },
  ]
}
