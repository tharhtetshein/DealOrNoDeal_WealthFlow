// Rule Audit & Snapshot Logging - Phase 1
// Captures immutable rule evaluation snapshots on case records.

import { evaluateCaseRules, getActiveRulesForEvaluation } from './ruleEvaluation'

const MAX_SNAPSHOTS_PER_CASE = 50

export async function buildRuleSnapshot(caseFile, options = {}) {
  if (!caseFile) return null
  const rules = await getActiveRulesForEvaluation()
  const activeRuleVersions = rules.map((r) => ({ id: r.id, version: r.version }))

  const evaluation = await evaluateCaseRules(caseFile, options)
  if (!evaluation) return null

  const snapshot = {
    snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    triggeredAt: options.triggeredBy || 'auto',
    triggeredBy: options.triggeredBy || 'system',
    evaluatedBy: options.evaluatedBy || 'system',
    evaluatedAt: evaluation.evaluatedAt,
    ruleSetVersion: evaluation.ruleSetVersion,
    activeRuleVersions,
    facts: evaluation.facts,
    triggeredRules: evaluation.triggeredRules.map((t) => ({
      ruleId: t.rule.id,
      ruleVersion: t.rule.version,
      ruleName: t.rule.name,
      policyReference: t.rule.policyReference,
      matchedConditions: t.matchedConditions,
      actionsApplied: (t.actions || []).map((a) => ({ type: a.type, target: a.target || a.key, reason: a.reason })),
    })),
    aggregatedActions: evaluation.aggregatedActions,
    computedMetrics: evaluation.computedMetrics,
  }

  return snapshot
}

export function appendRuleSnapshot(caseFile, snapshot) {
  if (!caseFile || !snapshot) return caseFile
  const existing = Array.isArray(caseFile.ruleSnapshots) ? caseFile.ruleSnapshots : []
  const next = [...existing, snapshot]
  // Trim to max
  if (next.length > MAX_SNAPSHOTS_PER_CASE) {
    next.splice(0, next.length - MAX_SNAPSHOTS_PER_CASE)
  }
  return {
    ...caseFile,
    ruleSnapshots: next,
    _lastRuleSnapshot: snapshot,
  }
}

export function getLatestRuleSnapshot(caseFile) {
  if (!caseFile) return null
  return caseFile._lastRuleSnapshot || null
}

export function getRuleSnapshots(caseFile) {
  return Array.isArray(caseFile?.ruleSnapshots) ? caseFile.ruleSnapshots : []
}

export function logRuleEvaluationEvent(auditLogEntry) {
  // Future: push to audit trail collection
  // Phase 1: console log for debugging
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[RuleEngine] Audit:', auditLogEntry)
  }
}
