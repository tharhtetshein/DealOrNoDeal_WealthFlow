import { RULE_STATUS, getDefaultRules, normalizeRule, validateRule, evaluateCondition } from './ruleEngine'
import { db, hasFirebaseConfig } from './firebase'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'

const RULES_STORAGE_KEY = 'wealthflow.complianceRules'
const RULES_COLLECTION = 'complianceRules'

function getRuleDocId(rule) {
  return `${rule.id}__v${rule.version || 1}`
}

function ensureFirebaseReady() {
  if (!hasFirebaseConfig || !db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values in .env')
  }
}

function getLocalRules() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(RULES_STORAGE_KEY)
  if (!raw) return getDefaultRules()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultRules()
    return parsed
  } catch {
    return getDefaultRules()
  }
}

function saveLocalRules(rules) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules.map(normalizeRule)))
}

function normalizeRuleSet(rules) {
  let nextRules = (rules || []).map(normalizeRule)
  const defaultsById = new Map(getDefaultRules().map((rule) => [rule.id, normalizeRule(rule)]))
  nextRules = nextRules.map((rule) => {
    const defaultRule = defaultsById.get(rule.id)
    if (!defaultRule || rule.author !== 'system') return rule
    return {
      ...rule,
      conditions: defaultRule.conditions,
      actions: defaultRule.actions,
      policyReference: defaultRule.policyReference,
      regulatoryFramework: defaultRule.regulatoryFramework,
    }
  })
  return nextRules
}

async function listFirebaseRules() {
  ensureFirebaseReady()
  const q = query(collection(db, RULES_COLLECTION), orderBy('priority', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => normalizeRule(item.data()))
}

async function saveFirebaseRule(rule) {
  ensureFirebaseReady()
  const normalized = normalizeRule(rule)
  await setDoc(doc(db, RULES_COLLECTION, getRuleDocId(normalized)), normalized, { merge: false })
  return normalized
}

async function saveFirebaseRuleSet(rules) {
  ensureFirebaseReady()
  const batch = writeBatch(db)
  rules.map(normalizeRule).forEach((rule) => {
    batch.set(doc(db, RULES_COLLECTION, getRuleDocId(rule)), rule, { merge: false })
  })
  await batch.commit()
}

async function withRuleStorage(operation, fallback) {
  if (!hasFirebaseConfig) return fallback()
  try {
    return await operation()
  } catch (error) {
    console.warn('Falling back to local rule storage:', error)
    return fallback()
  }
}

export async function loadRules() {
  return withRuleStorage(
    async () => {
      let rules = normalizeRuleSet(await listFirebaseRules())
      if (rules.length === 0) {
        rules = normalizeRuleSet(getDefaultRules())
        await saveFirebaseRuleSet(rules)
      }
      saveLocalRules(rules)
      return rules
    },
    async () => {
      const rules = normalizeRuleSet(getLocalRules())
      saveLocalRules(rules)
      return rules
    },
  )
}

export async function listRules(filter = {}) {
  let rules = await loadRules()
  if (filter.status) {
    const s = Array.isArray(filter.status) ? filter.status : [filter.status]
    rules = rules.filter((r) => s.includes(r.status))
  }
  if (filter.effective !== undefined) {
    const now = new Date()
    rules = rules.filter((r) => {
      const ed = r.effectiveDate ? new Date(r.effectiveDate) : null
      const ex = r.expiryDate ? new Date(r.expiryDate) : null
      const effective = (!ed || now >= ed) && (!ex || now <= ex)
      return filter.effective ? effective : !effective
    })
  }
  return rules.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
}

export async function getActivePublishedRules() {
  const now = new Date()
  return (await loadRules())
    .filter((r) => r.status === RULE_STATUS.PUBLISHED)
    .filter((r) => {
      const ed = r.effectiveDate ? new Date(r.effectiveDate) : null
      const ex = r.expiryDate ? new Date(r.expiryDate) : null
      return (!ed || now >= ed) && (!ex || now <= ex)
    })
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
}

export async function getRuleById(id) {
  return (await loadRules()).find((r) => r.id === id) || null
}

export async function getRuleVersions(id) {
  const all = (await loadRules()).filter((r) => r.id === id)
  return all.sort((a, b) => (b.version || 0) - (a.version || 0))
}

export async function upsertRule(rule) {
  const rules = await loadRules()
  rule = normalizeRule(rule)
  const idx = rules.findIndex((r) => r.id === rule.id && r.version === rule.version)
  const now = new Date().toISOString()
  const existing = idx >= 0 ? rules[idx] : null
  if (existing?.status === RULE_STATUS.PUBLISHED || existing?.status === RULE_STATUS.ARCHIVED) {
    const nextVersion = Math.max(...rules.filter((r) => r.id === rule.id).map((r) => Number(r.version || 0)), 0) + 1
    const draft = {
      ...rule,
      version: nextVersion,
      status: RULE_STATUS.DRAFT,
      createdAt: now,
      updatedAt: now,
      author: rule.author || existing.author || 'admin',
      basedOnVersion: existing.version,
    }
    rules.push(draft)
    saveLocalRules(rules)
    await withRuleStorage(async () => saveFirebaseRule(draft), async () => draft)
    return draft
  }
  const enriched = { ...rule, status: rule.status || RULE_STATUS.DRAFT, updatedAt: now }
  if (idx >= 0) {
    rules[idx] = enriched
  } else {
    rules.push(enriched)
  }
  saveLocalRules(rules)
  await withRuleStorage(async () => saveFirebaseRule(enriched), async () => enriched)
  return enriched
}

export async function createRuleDraft(draft) {
  const rules = await loadRules()
  const now = new Date().toISOString()
  const id = draft.id || `rule-${now.replace(/[:.]/g, '-').slice(0, 19)}`
  const existing = rules.filter((r) => r.id === id)
  const version = existing.length > 0 ? Math.max(...existing.map((r) => r.version || 0)) + 1 : 1
  const rule = {
    ...draft,
    id,
    version,
    status: RULE_STATUS.DRAFT,
    createdAt: now,
    updatedAt: now,
    author: draft.author || 'system',
  }
  rules.push(rule)
  saveLocalRules(rules)
  await withRuleStorage(async () => saveFirebaseRule(rule), async () => rule)
  return rule
}

export async function publishRule(id, author = 'system') {
  const rules = await loadRules()
  const draft = rules.find((r) => r.id === id && r.status === RULE_STATUS.DRAFT)
  if (!draft) return null
  const validation = validateRule(draft)
  if (!validation.valid) {
    return { ok: false, errors: validation.errors }
  }
  const conflicts = detectRuleConflicts(draft, rules).filter((item) => item.severity === 'warning')
  if (conflicts.length > 0) {
    return { ok: false, errors: conflicts.map((item) => item.message), conflicts }
  }
  // Archive existing published version
  const existingPublished = rules.find((r) => r.id === id && r.status === RULE_STATUS.PUBLISHED)
  if (existingPublished) {
    existingPublished.status = RULE_STATUS.ARCHIVED
    existingPublished.archivedAt = new Date().toISOString()
  }
  draft.status = RULE_STATUS.PUBLISHED
  draft.publishedAt = new Date().toISOString()
  draft.publishedBy = author
  draft.updatedAt = new Date().toISOString()
  saveLocalRules(rules)
  await withRuleStorage(async () => saveFirebaseRuleSet(rules.filter((r) => r.id === id)), async () => rules)
  return { ok: true, rule: draft }
}

export async function archiveRule(id, version) {
  const rules = await loadRules()
  const rule = rules.find((r) => r.id === id && r.version === version)
  if (!rule) return null
  rule.status = RULE_STATUS.ARCHIVED
  rule.archivedAt = new Date().toISOString()
  rule.updatedAt = new Date().toISOString()
  saveLocalRules(rules)
  await withRuleStorage(async () => saveFirebaseRule(rule), async () => rule)
  return rule
}

export async function deleteRule(id, version) {
  const existing = (await loadRules()).find((r) => r.id === id && r.version === version)
  if (existing?.status === RULE_STATUS.PUBLISHED) return { ok: false, reason: 'Published rules must be archived, not deleted.' }
  const rules = (await loadRules()).filter((r) => !(r.id === id && r.version === version))
  saveLocalRules(rules)
  await withRuleStorage(
    async () => deleteDoc(doc(db, RULES_COLLECTION, `${id}__v${version}`)),
    async () => null,
  )
  return { ok: true }
}

export async function resetToDefaultRules() {
  const defaults = normalizeRuleSet(getDefaultRules())
  saveLocalRules(defaults)
  await withRuleStorage(async () => saveFirebaseRuleSet(defaults), async () => defaults)
  return defaults
}

function actionSignature(action) {
  return `${action.type}:${action.target || action.key || action.item || ''}`
}

export function detectRuleConflicts(candidate, allRules = getLocalRules()) {
  const normalizedCandidate = normalizeRule(candidate)
  const active = (allRules || [])
    .map(normalizeRule)
    .filter((rule) => rule.id !== normalizedCandidate.id || rule.version !== normalizedCandidate.version)
    .filter((rule) => rule.status === RULE_STATUS.PUBLISHED)

  const candidateActions = new Set((normalizedCandidate.actions || []).map(actionSignature))
  return active.flatMap((rule) => {
    const overlapsAction = (rule.actions || []).some((action) => candidateActions.has(actionSignature(action)))
    const samePolicy = rule.policyReference && rule.policyReference === normalizedCandidate.policyReference
    const samePriority = Number(rule.priority || 0) === Number(normalizedCandidate.priority || 0)
    const bothAlways = evaluateCondition(normalizedCandidate.conditions, {})?.match && evaluateCondition(rule.conditions, {})?.match
    if (!overlapsAction && !samePolicy && !bothAlways) return []
    return [{
      severity: bothAlways && overlapsAction ? 'warning' : 'info',
      ruleId: rule.id,
      ruleVersion: rule.version,
      message: `${normalizedCandidate.name || normalizedCandidate.id} overlaps with ${rule.name || rule.id}${samePriority ? ' at the same priority' : ''}.`,
    }]
  })
}
