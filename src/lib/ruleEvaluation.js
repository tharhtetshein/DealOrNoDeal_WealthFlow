// Rule Evaluation Integration - Phase 1
// Bridges caseFiles.js with the rule engine. Computes snapshots.

import { evaluateRules, isRuleEffective, extractFacts } from './ruleEngine'
import { getActivePublishedRules } from './ruleStorage'

const RULE_ENGINE_ENABLED = false // Feature flag: Phase 1 runs in shadow mode only

export function shouldEvaluateRules() {
  return RULE_ENGINE_ENABLED || true // Always evaluate for shadow logging in Phase 1
}

export function getActiveRulesForEvaluation() {
  return getActivePublishedRules()
}

export function evaluateCaseRules(caseFile, options = {}) {
  if (!caseFile) return null
  const rules = getActiveRulesForEvaluation()
  // For shadow mode, compute baselines from existing logic
  const baselineRisk = options.baselineRisk || 'Low'
  const baselineReadiness = options.baselineReadiness ?? 0

  const result = evaluateRules(caseFile, rules, { baselineRisk, baselineReadiness })

  // Always return result for Phase 1 (shadow logging)
  return result
}

export function getRuleRequiredDocuments(caseFile) {
  if (!caseFile?._ruleEvaluation) return []
  return caseFile._ruleEvaluation.aggregatedActions?.requiredDocuments || []
}

export function getRuleAdjustedReadiness(caseFile) {
  if (!caseFile?._ruleEvaluation) return null
  return caseFile._ruleEvaluation.computedMetrics?.ruleAdjustedReadiness ?? null
}

export function getRuleAdjustedRisk(caseFile) {
  if (!caseFile?._ruleEvaluation) return null
  return caseFile._ruleEvaluation.computedMetrics?.ruleAdjustedRisk ?? null
}

export function getRuleBlockers(caseFile) {
  if (!caseFile?._ruleEvaluation) return []
  return caseFile._ruleEvaluation.aggregatedActions?.blockers || []
}

export function getRuleDrivenChecklistItems(caseFile) {
  if (!caseFile?._ruleEvaluation) return []
  return caseFile._ruleEvaluation.aggregatedActions?.checklistItems || []
}

export function getRuleFlags(caseFile) {
  if (!caseFile?._ruleEvaluation) return []
  return caseFile._ruleEvaluation.aggregatedActions?.flags || []
}
