// Rule Storage
// Uses Firestore when configured, with localStorage as the fast/offline cache.

import { RULE_STATUS, getDefaultRules, normalizeRule, validateRule, evaluateCondition } from './ruleEngine'
import {
  deleteFirebaseRule,
  hasFirebaseConfig,
  listFirebaseRules,
  replaceFirebaseRules,
  saveFirebaseRule,
} from './firebaseRules'

const RULES_STORAGE_KEY = 'wealthflow.complianceRules'

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

function hydrateSystemRules(sourceRules) {
  let rules = (sourceRules || []).map(normalizeRule)
  const defaultsById = new Map(getDefaultRules().map((rule) => [rule.id, normalizeRule(rule)]))
  rules = rules.map((rule) => {
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
  defaultsById.forEach((defaultRule, id) => {
    if (!rules.some((rule) => rule.id === id)) {
      rules.push(defaultRule)
    }
  })
  return rules
}

export function loadRules() {
  const rules = hydrateSystemRules(getLocalRules())
  saveLocalRules(rules)
  return rules
}

export async function loadRulesAsync() {
  const localRules = loadRules()
  if (!hasFirebaseConfig) return localRules

  try {
    const firebaseRules = (await listFirebaseRules()).map(normalizeRule)
    if (firebaseRules.length === 0) {
      saveLocalRules(localRules)
      await replaceFirebaseRules(localRules)
      return localRules
    }

    const firebaseKeys = new Set(firebaseRules.map((rule) => `${rule.id}:${rule.version}`))
    const localOnlyRules = localRules.filter((rule) => !firebaseKeys.has(`${rule.id}:${rule.version}`))
    const rules = hydrateSystemRules([...firebaseRules, ...localOnlyRules])
    saveLocalRules(rules)

    const missingRules = rules.filter((rule) => !firebaseKeys.has(`${rule.id}:${rule.version}`))
    await Promise.all(missingRules.map((rule) => saveFirebaseRule(rule)))

    return rules
  } catch (error) {
    console.warn('Unable to load rules from Firebase; using local cache:', error)
    return localRules
  }
}

export function listRules(filter = {}) {
  let rules = hydrateSystemRules(getLocalRules())
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

export function getActivePublishedRules() {
  const now = new Date()
  return hydrateSystemRules(getLocalRules())
    .filter((r) => r.status === RULE_STATUS.PUBLISHED)
    .filter((r) => {
      const ed = r.effectiveDate ? new Date(r.effectiveDate) : null
      const ex = r.expiryDate ? new Date(r.expiryDate) : null
      return (!ed || now >= ed) && (!ex || now <= ex)
    })
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
}

export function getRuleById(id) {
  return getLocalRules().map(normalizeRule).find((r) => r.id === id) || null
}

export function getRuleVersions(id) {
  const all = getLocalRules().map(normalizeRule).filter((r) => r.id === id)
  return all.sort((a, b) => (b.version || 0) - (a.version || 0))
}

export function upsertRule(rule) {
  const rules = getLocalRules().map(normalizeRule)
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
    return draft
  }
  const enriched = { ...rule, status: rule.status || RULE_STATUS.DRAFT, updatedAt: now }
  if (idx >= 0) {
    rules[idx] = enriched
  } else {
    rules.push(enriched)
  }
  saveLocalRules(rules)
  return enriched
}

export async function upsertRuleAsync(rule) {
  const savedRule = upsertRule(rule)
  if (hasFirebaseConfig) {
    try {
      await saveFirebaseRule(savedRule)
    } catch (error) {
      console.warn('Unable to save rule to Firebase:', error)
    }
  }
  return savedRule
}

export function createRuleDraft(draft) {
  const rules = getLocalRules().map(normalizeRule)
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
  return rule
}

export async function createRuleDraftAsync(draft) {
  const rule = createRuleDraft(draft)
  if (hasFirebaseConfig) {
    try {
      await saveFirebaseRule(rule)
    } catch (error) {
      console.warn('Unable to save draft rule to Firebase:', error)
    }
  }
  return rule
}

export function publishRule(id, author = 'system') {
  const rules = getLocalRules().map(normalizeRule)
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
  return { ok: true, rule: draft }
}

export async function publishRuleAsync(id, author = 'system') {
  const result = publishRule(id, author)
  if (result?.ok && hasFirebaseConfig) {
    try {
      await replaceFirebaseRules(getLocalRules().map(normalizeRule))
    } catch (error) {
      console.warn('Unable to publish rule to Firebase:', error)
    }
  }
  return result
}

export function archiveRule(id, version) {
  const rules = getLocalRules()
  const rule = rules.find((r) => r.id === id && r.version === version)
  if (!rule) return null
  rule.status = RULE_STATUS.ARCHIVED
  rule.archivedAt = new Date().toISOString()
  rule.updatedAt = new Date().toISOString()
  saveLocalRules(rules)
  return rule
}

export async function archiveRuleAsync(id, version) {
  const rule = archiveRule(id, version)
  if (rule && hasFirebaseConfig) {
    try {
      await saveFirebaseRule(normalizeRule(rule))
    } catch (error) {
      console.warn('Unable to archive rule in Firebase:', error)
    }
  }
  return rule
}

export function deleteRule(id, version) {
  const existing = getLocalRules().map(normalizeRule).find((r) => r.id === id && r.version === version)
  if (existing?.status === RULE_STATUS.PUBLISHED) return { ok: false, reason: 'Published rules must be archived, not deleted.' }
  const rules = getLocalRules().map(normalizeRule).filter((r) => !(r.id === id && r.version === version))
  saveLocalRules(rules)
  return { ok: true }
}

export async function deleteRuleAsync(id, version) {
  const result = deleteRule(id, version)
  if (result?.ok && hasFirebaseConfig) {
    try {
      await deleteFirebaseRule(id, version)
    } catch (error) {
      console.warn('Unable to delete rule from Firebase:', error)
    }
  }
  return result
}

export function resetToDefaultRules() {
  saveLocalRules(getDefaultRules())
}

export async function resetToDefaultRulesAsync() {
  const rules = getDefaultRules().map(normalizeRule)
  saveLocalRules(rules)
  if (hasFirebaseConfig) {
    try {
      await replaceFirebaseRules(rules)
    } catch (error) {
      console.warn('Unable to reset Firebase rules:', error)
    }
  }
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
