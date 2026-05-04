import { evaluateRules } from './ruleEngine'
import { getActivePublishedRules } from './ruleStorage'

export function shouldEvaluateRules() {
  return true
}

export async function getActiveRulesForEvaluation() {
  return getActivePublishedRules()
}

export async function evaluateCaseRules(caseFile, options = {}) {
  if (!caseFile) return null
  const rules = await getActiveRulesForEvaluation()
  const baselineRisk = options.baselineRisk || 'Low'
  const baselineReadiness = options.baselineReadiness ?? 0

  return evaluateRules(caseFile, rules, { baselineRisk, baselineReadiness })
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
