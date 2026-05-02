import {
  createCaseFile as createFirebaseCaseFile,
  getCaseFile as getFirebaseCaseFile,
  listCaseFiles as listFirebaseCaseFiles,
  removeCaseFile as removeFirebaseCaseFile,
  updateCaseFile as updateFirebaseCaseFile,
} from './firebaseCases'
import { hasFirebaseConfig, removeCaseDocumentFile } from './firebase'
import { evaluateCaseRules } from './ruleEvaluation'
import { buildRuleSnapshot, appendRuleSnapshot, logRuleEvaluationEvent } from './ruleAudit'
import { STANDARD_CHECKLIST_ITEMS } from './ruleEngine'

const CASES_STORAGE_KEY = 'wealthflow.caseFiles'
const ACTIVE_CASE_STORAGE_KEY = 'wealthflow.activeCaseId'
const CASE_COUNTER_STORAGE_KEY = 'wealthflow.caseCounter'

export const CASE_STATUS = Object.freeze({
  DRAFT: 'Draft',
  MISSING_DOCUMENTS: 'Missing Documents',
  PENDING_REVIEW: 'Pending Review',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  ACTION_REQUIRED: 'Action Required',
  REJECTED: 'Rejected',
  ESCALATED: 'Escalated',
  READY_FOR_REVIEW: 'Pending Review',
  IN_REVIEW: 'Under Review',
  COMPLIANCE_APPROVED: 'Approved',
})

const ALLOWED_CASE_STATUSES = new Set(Object.values(CASE_STATUS))

export const CLIENT_PROFILE_TYPE = Object.freeze({
  BUSINESS_OWNER: 'Business Owner',
  SALARIED_EMPLOYEE: 'Salaried Employee',
  INVESTOR: 'Investor',
})

const DOCUMENT_DEFINITIONS = [
  { key: 'passport_id', label: 'Passport / ID', category: 'KYC Documents', alwaysRequired: true, reason: 'Identity verification is mandatory for KYC onboarding.' },
  { key: 'address_proof', label: 'Address Proof', category: 'KYC Documents', alwaysRequired: true, reason: 'Address verification is required for customer due diligence.' },
  { key: 'tax_residency', label: 'Tax Residency', category: 'Tax Documents', alwaysRequired: true, reason: 'CRS/FATCA tax residency evidence is required.' },
  { key: 'sow_declaration', label: 'SoW Declaration', category: 'SoW / SoF Documents', alwaysRequired: true, reason: 'Source of Wealth declaration is mandatory.' },
  { key: 'bank_statements_sof', label: 'Bank Statements (Source of Funds)', category: 'SoW / SoF Documents', alwaysRequired: true, reason: 'Bank statements are required to evidence Source of Funds.' },

  { key: 'business_registry_extract', label: 'Business Registry Extract', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },
  { key: 'shareholding_structure', label: 'Shareholding Structure', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },
  { key: 'company_financial_statements', label: 'Company Financial Statements', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },
  { key: 'dividend_statements', label: 'Dividend Statements', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },

  { key: 'payslips', label: 'Payslips', category: 'Employment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE], reason: 'Payslips are required because profile indicates Salaried Employee.' },
  { key: 'employment_contract', label: 'Employment Contract', category: 'Employment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE], reason: 'Employment contract is required because profile indicates Salaried Employee.' },

  { key: 'investment_portfolio_statements', label: 'Investment Portfolio Statements', category: 'Investment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.INVESTOR], reason: 'Required because profile indicates Investor.' },
  { key: 'trade_confirmations', label: 'Trade Confirmations', category: 'Investment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.INVESTOR], reason: 'Required because profile indicates Investor.' },
]

const SYSTEM_EDITABLE_STATUSES = new Set([
  CASE_STATUS.DRAFT,
  CASE_STATUS.MISSING_DOCUMENTS,
  CASE_STATUS.PENDING_REVIEW,
  CASE_STATUS.ACTION_REQUIRED,
])

function normalizeCategory(category) {
  const normalized = String(category || '').trim()

  const legacyMap = {
    'Passport / ID': 'Passport / ID',
    Passport: 'Passport / ID',
    'National ID': 'Passport / ID',
    'Utility Bill': 'Address Proof',
    'Utility Bill (<=3 months)': 'Address Proof',
    'Bank Statement with Address': 'Address Proof',
    'Government-Issued Address Letter': 'Address Proof',
    'Tax Residency Bill': 'Tax Residency',
    'Tax Residency Certificate': 'Tax Residency',
    'Tax Residency Self-Certification': 'Tax Residency',
    'Tax Identification Number (TIN) Evidence': 'Tax Residency',
    'FATCA Declaration': 'Tax Residency',
    'Source of Wealth (SoW)': 'SoW Declaration',
    'SoW Declaration': 'SoW Declaration',
    'Bank Statements': 'Bank Statements (Source of Funds)',
    'Recent Bank Statements (3-6 months)': 'Bank Statements (Source of Funds)',
    'Transfer / Liquidity Proof': 'Bank Statements (Source of Funds)',
    'Business Registry Extract': 'Business Registry Extract',
    'Shareholding Structure': 'Shareholding Structure',
    'Company Financial Statements': 'Company Financial Statements',
    'Dividend Statements': 'Dividend Statements',
    'Payslips': 'Payslips',
    'Employment Contract': 'Employment Contract',
    'Investment Portfolio Statements': 'Investment Portfolio Statements',
    'Trade Confirmations': 'Trade Confirmations',
  }

  return legacyMap[normalized] || normalized
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function getCurrentCaseDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function normalizeDateValue(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return null
}

function normalizeCaseFile(caseFile) {
  if (!caseFile) return null

  const statusAliases = {
    'Ready for Review': CASE_STATUS.PENDING_REVIEW,
    'In Review': CASE_STATUS.UNDER_REVIEW,
    'Compliance Approved': CASE_STATUS.APPROVED,
  }
  const statusValue = statusAliases[caseFile.status] || caseFile.status
  const normalizedStatus = ALLOWED_CASE_STATUSES.has(statusValue) ? statusValue : CASE_STATUS.DRAFT
  const rawStatusHistory = Array.isArray(caseFile.statusHistory) ? caseFile.statusHistory : []
  const rawDocuments = Array.isArray(caseFile.documents) ? caseFile.documents : []
  const rawComments = Array.isArray(caseFile.comments) ? caseFile.comments : []

  return {
    ...caseFile,
    status: normalizedStatus,
    createdAt: normalizeDateValue(caseFile.createdAt),
    updatedAt: normalizeDateValue(caseFile.updatedAt),
    submittedAt: normalizeDateValue(caseFile.submittedAt),
    statusHistory: rawStatusHistory.map((entry) => ({
      ...entry,
      timestamp: normalizeDateValue(entry.timestamp) || entry.timestamp || null,
    })),
    documents: rawDocuments.map((document) => ({
      ...document,
      uploadedAt: normalizeDateValue(document.uploadedAt) || document.uploadedAt || null,
    })),
    comments: rawComments.map((comment) => ({
      ...comment,
      createdAt: normalizeDateValue(comment.createdAt) || comment.createdAt || null,
    })),
  }
}

function attachRuleSnapshot(caseFile, options = {}) {
  if (!caseFile || !caseFile.id) return caseFile
  const snapshot = buildRuleSnapshot(caseFile, {
    triggeredBy: options.triggeredBy || 'system',
    evaluatedBy: options.evaluatedBy || 'system',
  })
  if (!snapshot) return caseFile
  const enriched = appendRuleSnapshot(caseFile, snapshot)
  enriched._ruleEvaluation = evaluateCaseRules(caseFile)
  logRuleEvaluationEvent({
    caseId: caseFile.id,
    snapshotId: snapshot.snapshotId,
    triggeredAt: snapshot.triggeredAt,
    triggeredBy: snapshot.triggeredBy,
    ruleSetVersion: snapshot.ruleSetVersion,
    triggeredRules: snapshot.triggeredRules.length,
    activeRules: snapshot.activeRuleVersions.length,
  })
  return enriched
}

function getRuleDecisionSnapshot(caseFile) {
  return caseFile?._lastRuleSnapshot
    || (Array.isArray(caseFile?.ruleSnapshots) ? caseFile.ruleSnapshots[caseFile.ruleSnapshots.length - 1] : null)
    || null
}

function persistRuleSnapshot(caseFile, options = {}) {
  return upsertLocalCaseFile(attachRuleSnapshot(caseFile, options))
}

export async function rerunRuleEvaluation(caseId, options = {}) {
  const existing = getLocalCaseFileById(caseId) || normalizeCaseFile(await getFirebaseCaseFile(caseId))
  if (!existing) return { ok: false, reason: 'Case not found' }

  const updated = persistRuleSnapshot(existing, {
    triggeredBy: options.triggeredBy || 'manual-rerun',
    evaluatedBy: options.evaluatedBy || 'Compliance Officer',
  })

  if (hasFirebaseConfig) {
    try {
      await updateFirebaseCaseFile(caseId, {
        ruleSnapshots: updated.ruleSnapshots,
        _lastRuleSnapshot: updated._lastRuleSnapshot,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn('Unable to persist rule snapshot to Firebase:', error)
    }
  }

  return { ok: true, caseFile: updated, snapshot: updated._lastRuleSnapshot }
}

function hasNoDocuments(caseFile) {
  return (caseFile?.documents || []).length === 0
}

export function getClientProfileType(caseFile) {
  const occupation = String(caseFile?.occupation || '').toLowerCase()
  if (/\bbusiness owner\b|\bowner\b|\bfounder\b|\bentrepreneur\b/.test(occupation)) {
    return CLIENT_PROFILE_TYPE.BUSINESS_OWNER
  }

  if (/\binvestor\b|\btrader\b|\bportfolio\b|\bfund\b/.test(occupation)) {
    return CLIENT_PROFILE_TYPE.INVESTOR
  }

  return CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE
}

function getRequiredDocumentDefinitions(caseFile) {
  const snapshot = getRuleDecisionSnapshot(caseFile)
  const ruleRequired = snapshot?.aggregatedActions?.requiredDocuments || caseFile?._ruleEvaluation?.aggregatedActions?.requiredDocuments || []
  if (ruleRequired.length > 0) {
    return ruleRequired.map((item) => ({
      key: String(item.target || item.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      label: item.target || item.label,
      category: item.category || 'Rule Required Documents',
      alwaysRequired: true,
      reason: item.reason || item.sources?.[0]?.ruleName || 'Required by active compliance rule.',
      ruleDriven: true,
      sources: item.sources || [],
    }))
  }

  const profileType = getClientProfileType(caseFile)
  return DOCUMENT_DEFINITIONS.filter((definition) => {
    if (definition.alwaysRequired) return true
    return (definition.profileTypes || []).includes(profileType)
  })
}

function isFatcaApplicable(caseFile) {
  const nationality = String(caseFile?.nationality || '').toLowerCase()
  const residence = String(caseFile?.residence || '').toLowerCase()
  return nationality.includes('united states') || nationality.includes('u.s.') || residence.includes('united states')
}

function getDocumentsByNormalizedCategory(caseFile) {
  const documents = Array.isArray(caseFile?.documents) ? caseFile.documents : []
  return documents.reduce((map, doc) => {
    const category = normalizeCategory(doc?.category)
    if (!category) return map
    if (!map.has(category)) map.set(category, [])
    map.get(category).push(doc)
    return map
  }, new Map())
}

function createChecklistEntry({
  id,
  label,
  required,
  state,
  isSatisfied,
  missingItems = [],
  details = '',
  critical = false,
}) {
  return {
    id,
    label,
    required,
    state,
    isSatisfied,
    missingItems,
    details,
    critical,
  }
}

export function getDocumentCompletionSummary(caseFile) {
  const profileType = getClientProfileType(caseFile)
  const requiredDefinitions = getRequiredDocumentDefinitions(caseFile)
  const byCategory = getDocumentsByNormalizedCategory(caseFile)
  const requiredLabelSet = new Set(requiredDefinitions.map((definition) => definition.label))
  const documents = Array.isArray(caseFile?.documents) ? caseFile.documents : []

  const requiredDocuments = requiredDefinitions.map((definition) => {
    const linkedDocs = byCategory.get(definition.label) || []
    const hasUpload = linkedDocs.length > 0
    const hasInvalid = linkedDocs.some((doc) => String(doc?.validationStatus || '').toLowerCase() === 'invalid')
    const hasUnextractable = hasUpload && linkedDocs.every((doc) => String(doc?.extractedText || '').trim().length === 0)
    const state = !hasUpload ? 'missing' : (hasInvalid || hasUnextractable) ? 'needs_review' : 'uploaded'

    return {
      ...definition,
      required: true,
      documents: linkedDocs,
      status: state,
      isSatisfied: state === 'uploaded',
      missingReason: definition.reason,
      ruleDriven: Boolean(definition.ruleDriven),
      sources: definition.sources || [],
    }
  })

  const extraDocuments = documents
    .filter((doc) => !requiredLabelSet.has(normalizeCategory(doc.category)))
    .map((doc) => ({
      ...doc,
      normalizedCategory: normalizeCategory(doc.category),
      status: 'extra',
    }))

  const groupedRequiredDocuments = requiredDocuments.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const entries = Object.entries(groupedRequiredDocuments).map(([category, items]) => {
    const missingCount = items.filter((item) => item.status === 'missing').length
    const reviewCount = items.filter((item) => item.status === 'needs_review').length
    const uploadedCount = items.filter((item) => item.status === 'uploaded').length
    const state = missingCount > 0 ? 'missing' : reviewCount > 0 ? 'partial' : 'complete'
    return createChecklistEntry({
      id: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: category,
      required: true,
      state,
      isSatisfied: missingCount === 0 && reviewCount === 0,
      missingItems: items.filter((item) => item.status !== 'uploaded').map((item) => item.label),
      details: `${uploadedCount}/${items.length} uploaded`,
      critical: missingCount > 0,
    })
  })

  const requiredEntries = entries
  const missingEntries = requiredEntries.filter((entry) => !entry.isSatisfied)
  const partialEntries = requiredEntries.filter((entry) => entry.state === 'partial')
  const missingRequiredDocuments = requiredDocuments.filter((item) => item.status === 'missing')
  const needsReviewDocuments = requiredDocuments.filter((item) => item.status === 'needs_review')
  const uploadedRequiredDocuments = requiredDocuments.filter((item) => item.status !== 'missing')
  const invalidRequiredDocuments = requiredDocuments.filter((item) => item.status === 'needs_review')

  return {
    profileType,
    entries,
    requiredEntries,
    requiredDocuments,
    groupedRequiredDocuments,
    missingEntries,
    partialEntries,
    missingRequiredDocuments,
    needsReviewDocuments,
    uploadedRequiredDocuments,
    invalidRequiredDocuments,
    extraDocuments,
    requiredTotal: requiredDocuments.length,
    requiredCompletedCount: requiredDocuments.filter((item) => item.status === 'uploaded').length,
    uploadedRequiredCount: uploadedRequiredDocuments.length,
    missingRequiredCount: missingRequiredDocuments.length,
    needsReviewCount: needsReviewDocuments.length,
    missingCategoryLabels: missingEntries.map((entry) => entry.label),
    allRequiredComplete: missingRequiredDocuments.length === 0 && needsReviewDocuments.length === 0,
    hasCriticalMissing: missingRequiredDocuments.length > 0,
  }
}

function hasCriticalIssues(caseFile) {
  const explicitRiskFlags = Array.isArray(caseFile?.riskFlags) ? caseFile.riskFlags : []
  const aiRiskFlags = Array.isArray(caseFile?.aiAnalysis?.riskFlags)
    ? caseFile.aiAnalysis.riskFlags
    : Array.isArray(caseFile?.aiAnalysis?.risks)
      ? caseFile.aiAnalysis.risks
      : []

  return [...explicitRiskFlags, ...aiRiskFlags].some((risk) => {
    const severity = String(risk?.severity || '').toLowerCase()
    return severity === 'high' || severity === 'critical'
  })
}

function formatAnalysisText(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatAnalysisText).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return [
      value.priority,
      value.severity,
      value.action,
      value.recommendation,
      value.nextAction,
      value.description,
      value.issue,
      value.reason,
      value.title,
      value.document,
      value.rationale,
    ].map(formatAnalysisText).filter(Boolean).join(' ')
  }
  return ''
}

function getAiActionPriority(value) {
  const text = formatAnalysisText(value).toLowerCase()

  if (/\b(low[- ]risk status|record .*low[- ]risk|retain .*regular review|regular review due to high net worth|periodic|annual monitoring|ongoing consistency|document .*findings|retain .*supporting evidence)\b/.test(text)) {
    return 'Medium'
  }

  if (/\b(sanctions? hit|pep match|positive match|adverse media|fraud|source of wealth cannot be verified|unverified source of wealth|escalat|critical|blocker)\b/.test(text)
    || /\b(high|must|mandatory|required|missing)\b/.test(text) && !/\bhigh net worth\b/.test(text)) {
    return 'High'
  }

  if (/\b(request|obtain|collect|provide|upload|verify|validate|confirm|document|statement|report|grant|vesting|dividend|net.?worth|source.?of.?funds|evidence)\b/.test(text)) {
    return 'Medium'
  }
  return 'Low'
}

function getHighPriorityAiFollowUps(caseFile) {
  const analysis = caseFile?.aiAnalysis || {}
  const suggestedActions = Array.isArray(analysis.suggestedActions)
    ? analysis.suggestedActions
    : Array.isArray(analysis.recommendations)
      ? analysis.recommendations
      : []
  const missingEvidence = Array.isArray(analysis.missingOrInsufficientDocuments)
    ? analysis.missingOrInsufficientDocuments
    : []

  return [...suggestedActions, ...missingEvidence].filter((item) => getAiActionPriority(item) === 'High')
}

export function hasCompletedAiAnalysis(caseFile) {
  const analysis = caseFile?.aiAnalysis
  if (!analysis || typeof analysis !== 'object') return false
  if (analysis.updatedAt) return true

  const hasStructuredSignals = Array.isArray(analysis.mismatches)
    || Array.isArray(analysis.riskFlags)
    || Array.isArray(analysis.risks)
    || Boolean(analysis.sourceOfWealthDraft)

  return hasStructuredSignals
}

export function hasFreshAiAnalysis(caseFile) {
  if (!hasCompletedAiAnalysis(caseFile)) return false

  const analysisUpdatedAt = Date.parse(caseFile?.aiAnalysis?.updatedAt || '')
  if (Number.isNaN(analysisUpdatedAt)) return false

  const latestDocumentUploadAt = (caseFile?.documents || []).reduce((latest, doc) => {
    const parsed = Date.parse(doc?.uploadedAt || '')
    if (Number.isNaN(parsed)) return latest
    return Math.max(latest, parsed)
  }, 0)

  return analysisUpdatedAt >= latestDocumentUploadAt
}

export function calculateReadinessScore(caseFile) {
  const normalized = normalizeCaseFile(caseFile)
  const completionSummary = getDocumentCompletionSummary(normalized)
  const profileComplete = hasRequiredFields(normalized)
  const highPriorityFollowUps = getHighPriorityAiFollowUps(normalized)
  const riskCleared = hasFreshAiAnalysis(normalized)
    && !hasCriticalIssues(normalized)
    && highPriorityFollowUps.length === 0

  const totalItems = 1 + completionSummary.requiredTotal + 1
  const completedItems = (profileComplete ? 1 : 0)
    + completionSummary.requiredCompletedCount
    + (riskCleared ? 1 : 0)
  const baselinePercentage = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100)
  const snapshot = getRuleDecisionSnapshot(normalized)
  const percentage = snapshot?.computedMetrics?.finalReadiness ?? baselinePercentage
  const ruleRisk = snapshot?.computedMetrics?.finalRiskLevel || null

  return {
    percentage,
    completedItems,
    totalItems,
    profile: {
      complete: profileComplete,
      status: profileComplete ? 'Complete' : 'Incomplete',
    },
    documents: {
      completed: completionSummary.requiredCompletedCount,
      total: completionSummary.requiredTotal,
      complete: completionSummary.allRequiredComplete,
      missing: completionSummary.missingRequiredDocuments.map((item) => item.label),
      needsReview: completionSummary.needsReviewDocuments.map((item) => item.label),
    },
    risk: {
      cleared: riskCleared,
      status: riskCleared ? 'Cleared' : 'Pending',
      aiAnalysisCompleted: hasFreshAiAnalysis(normalized),
      hasHighOrCriticalRisk: hasCriticalIssues(normalized),
      highPriorityFollowUps: highPriorityFollowUps.length,
      ruleAdjustedRisk: ruleRisk,
    },
    rules: snapshot ? {
      ruleSetVersion: snapshot.ruleSetVersion,
      evaluatedAt: snapshot.evaluatedAt,
      triggeredRuleCount: snapshot.triggeredRules?.length || 0,
      readinessPenalty: snapshot.computedMetrics?.readinessPenalty || 0,
      riskLevel: ruleRisk,
      blockers: snapshot.aggregatedActions?.blockers || [],
    } : null,
  }
}

export async function getReadinessScore(caseId) {
  const caseFile = await getCaseFileById(caseId)
  if (!caseFile) {
    return null
  }

  return calculateReadinessScore(caseFile)
}

function derivePreReviewStatus(caseFile) {
  if (hasNoDocuments(caseFile)) {
    return CASE_STATUS.DRAFT
  }

  if (!hasRequiredDocuments(caseFile)) {
    return CASE_STATUS.MISSING_DOCUMENTS
  }

  if (!hasRequiredFields(caseFile)) {
    return CASE_STATUS.DRAFT
  }

  if (hasCriticalIssues(caseFile)) {
    return CASE_STATUS.DRAFT
  }

  return CASE_STATUS.PENDING_REVIEW
}

function canTransitionStatus(previousStatus, nextStatus) {
  if (previousStatus === nextStatus) return true
  if (!ALLOWED_CASE_STATUSES.has(previousStatus) || !ALLOWED_CASE_STATUSES.has(nextStatus)) return false

  const allowed = {
    [CASE_STATUS.DRAFT]: new Set([CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.PENDING_REVIEW]),
    [CASE_STATUS.MISSING_DOCUMENTS]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.PENDING_REVIEW]),
    [CASE_STATUS.PENDING_REVIEW]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.ACTION_REQUIRED]),
    [CASE_STATUS.UNDER_REVIEW]: new Set([CASE_STATUS.APPROVED, CASE_STATUS.ACTION_REQUIRED, CASE_STATUS.REJECTED, CASE_STATUS.ESCALATED, CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS]),
    [CASE_STATUS.APPROVED]: new Set([]),
    [CASE_STATUS.ACTION_REQUIRED]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.PENDING_REVIEW]),
    [CASE_STATUS.REJECTED]: new Set([]),
    [CASE_STATUS.ESCALATED]: new Set([CASE_STATUS.UNDER_REVIEW, CASE_STATUS.ACTION_REQUIRED, CASE_STATUS.REJECTED]),
  }

  return allowed[previousStatus]?.has(nextStatus) || false
}

function appendStatusHistoryEntries(caseFile, nextStatus, actor = 'System', reason = 'Status recalculated') {
  const normalized = normalizeCaseFile(caseFile)
  const previousStatus = normalized?.status || CASE_STATUS.DRAFT
  const next = ALLOWED_CASE_STATUSES.has(nextStatus) ? nextStatus : previousStatus

  if (previousStatus === next) {
    return { status: previousStatus, statusHistory: normalized?.statusHistory || [] }
  }

  if (!canTransitionStatus(previousStatus, next)) {
    return { status: previousStatus, statusHistory: normalized?.statusHistory || [] }
  }

  const entry = {
    timestamp: new Date().toISOString(),
    actor,
    from: previousStatus,
    to: next,
    reason,
  }

  return {
    status: next,
    statusHistory: [...(normalized?.statusHistory || []), entry],
  }
}

function applySystemDerivedStatus(caseFile, reason) {
  const normalized = normalizeCaseFile(caseFile)
  if (!normalized) return normalized

  if (!SYSTEM_EDITABLE_STATUSES.has(normalized.status)) {
    return normalized
  }

  const targetStatus = derivePreReviewStatus(normalized)
  const transition = appendStatusHistoryEntries(normalized, targetStatus, 'System', reason)

  return {
    ...normalized,
    status: transition.status,
    statusHistory: transition.statusHistory,
  }
}

function withStatusTransition(caseFile, targetStatus, actor, reason) {
  const normalized = normalizeCaseFile(caseFile)
  if (!normalized) return normalized

  const transition = appendStatusHistoryEntries(normalized, targetStatus, actor, reason)
  return {
    ...normalized,
    status: transition.status,
    statusHistory: transition.statusHistory,
  }
}

function getLocalCaseFiles() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(CASES_STORAGE_KEY)
  const cases = raw ? safeParse(raw, []) : []
  return cases.map(normalizeCaseFile)
}

function saveLocalCaseFiles(cases) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases))
}

function getLocalCaseFileById(caseId) {
  const cases = getLocalCaseFiles()
  return cases.find((item) => item.id === caseId) || null
}

function upsertLocalCaseFile(caseFile) {
  const normalizedCaseFile = normalizeCaseFile(caseFile)
  const cases = getLocalCaseFiles()
  const existingIndex = cases.findIndex((item) => item.id === normalizedCaseFile.id)

  if (existingIndex >= 0) {
    cases[existingIndex] = normalizedCaseFile
  } else {
    cases.unshift(normalizedCaseFile)
  }

  saveLocalCaseFiles(cases)
  return normalizedCaseFile
}

function deleteLocalCaseFile(caseId) {
  const cases = getLocalCaseFiles().filter((item) => item.id !== caseId)
  saveLocalCaseFiles(cases)

  if (getActiveCaseId() === caseId) {
    clearActiveCaseId()
  }
}

function createLocalDraftCase(formData) {
  const now = new Date().toISOString()
  const id = generateLocalCaseId()
  const caseFile = {
    id,
    clientName: formData.clientName || 'Unnamed Client',
    nationality: formData.nationality || '',
    residence: formData.residence || '',
    occupation: formData.occupation || '',
    netWorth: formData.netWorth || '',
    purpose: formData.purpose || '',
    status: CASE_STATUS.DRAFT,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    statusHistory: [{
      timestamp: now,
      actor: 'System',
      from: null,
      to: CASE_STATUS.DRAFT,
      reason: 'Case created',
    }],
    documents: [],
  }

  return upsertLocalCaseFile(caseFile)
}

function generateLocalCaseId() {
  if (typeof window === 'undefined') {
    return `WF-${getCurrentCaseDate()}-0001`
  }

  const dateKey = getCurrentCaseDate()
  const rawCounter = window.localStorage.getItem(CASE_COUNTER_STORAGE_KEY)
  const parsedCounter = rawCounter ? safeParse(rawCounter, {}) : {}
  const nextSequence = Number(parsedCounter[dateKey] || 0) + 1

  parsedCounter[dateKey] = nextSequence
  window.localStorage.setItem(CASE_COUNTER_STORAGE_KEY, JSON.stringify(parsedCounter))

  return `WF-${dateKey}-${String(nextSequence).padStart(4, '0')}`
}

async function withStorageFallback(operation, fallback) {
  if (!hasFirebaseConfig) {
    return fallback()
  }

  try {
    return await operation()
  } catch (error) {
    console.warn('Falling back to local case storage:', error)
    return fallback()
  }
}

export async function getAllCaseFiles() {
  return withStorageFallback(
    async () => {
      const cases = (await listFirebaseCaseFiles()).map(normalizeCaseFile)
      saveLocalCaseFiles(cases)
      return cases
    },
    async () => getLocalCaseFiles(),
  )
}

export async function getCaseFileById(caseId) {
  return withStorageFallback(
    async () => {
      const caseFile = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (caseFile) upsertLocalCaseFile(caseFile)
      return caseFile
    },
    async () => {
      const caseFile = getLocalCaseFileById(caseId)
      return caseFile || null
    },
  )
}

export function getAllLocalCaseFiles() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(CASES_STORAGE_KEY)
  const cases = raw ? safeParse(raw, []) : []
  return cases.map(normalizeCaseFile)
}

export function setActiveCaseId(caseId) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_CASE_STORAGE_KEY, caseId)
}

export function getActiveCaseId() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_CASE_STORAGE_KEY)
}

export function clearActiveCaseId() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACTIVE_CASE_STORAGE_KEY)
}

export async function createDraftCase(formData) {
  return withStorageFallback(
    async () => {
      const now = new Date().toISOString()
      const payload = {
        clientName: formData.clientName || 'Unnamed Client',
        nationality: formData.nationality || '',
        residence: formData.residence || '',
        occupation: formData.occupation || '',
        netWorth: formData.netWorth || '',
        purpose: formData.purpose || '',
        status: CASE_STATUS.DRAFT,
        statusHistory: [{
          timestamp: now,
          actor: 'System',
          from: null,
          to: CASE_STATUS.DRAFT,
          reason: 'Case created',
        }],
        submittedAt: null,
        documents: [],
      }

      const id = await createFirebaseCaseFile(payload)
      const caseFile = normalizeCaseFile(await getFirebaseCaseFile(id))
      return caseFile ? persistRuleSnapshot(caseFile, { triggeredBy: 'createCase' }) : null
    },
    async () => persistRuleSnapshot(createLocalDraftCase(formData), { triggeredBy: 'createCase' }),
  )
}

export async function updateCaseCore(caseId, formData) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      const merged = normalizeCaseFile({
        ...existing,
        clientName: formData.clientName || existing.clientName,
        nationality: formData.nationality || existing.nationality,
        residence: formData.residence || existing.residence,
        occupation: formData.occupation || existing.occupation,
        netWorth: formData.netWorth || existing.netWorth,
        purpose: formData.purpose || existing.purpose,
      })

      const withDerivedStatus = applySystemDerivedStatus(merged, 'Profile updated')

      await updateFirebaseCaseFile(caseId, {
        clientName: withDerivedStatus.clientName,
        nationality: withDerivedStatus.nationality,
        residence: withDerivedStatus.residence,
        occupation: withDerivedStatus.occupation,
        netWorth: withDerivedStatus.netWorth,
        purpose: withDerivedStatus.purpose,
        status: withDerivedStatus.status,
        statusHistory: withDerivedStatus.statusHistory,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      return updated ? persistRuleSnapshot(updated, { triggeredBy: 'profile-save' }) : null
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const merged = {
        ...existing,
        clientName: formData.clientName || existing.clientName,
        nationality: formData.nationality || existing.nationality,
        residence: formData.residence || existing.residence,
        occupation: formData.occupation || existing.occupation,
        netWorth: formData.netWorth || existing.netWorth,
        purpose: formData.purpose || existing.purpose,
        updatedAt: new Date().toISOString(),
      }

      return persistRuleSnapshot(applySystemDerivedStatus(merged, 'Profile updated'), { triggeredBy: 'profile-save' })
    },
  )
}

export async function updateCaseData(caseId, payload) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      const base = normalizeCaseFile(existing)
      let merged = normalizeCaseFile({
        ...base,
        ...payload,
      })

      if (payload?.status && ALLOWED_CASE_STATUSES.has(payload.status)) {
        const transitionCase = withStatusTransition(
          base,
          payload.status,
          'System',
          'Manual status update',
        )
        merged = normalizeCaseFile({
          ...merged,
          status: transitionCase.status,
          statusHistory: transitionCase.statusHistory,
        })
      } else {
        merged = applySystemDerivedStatus(merged, 'Case data updated')
      }

      await updateFirebaseCaseFile(caseId, merged)

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      return updated ? persistRuleSnapshot(updated, { triggeredBy: 'updateCaseData' }) : null
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const base = normalizeCaseFile(existing)
      let nextCase = {
        ...base,
        ...payload,
        updatedAt: new Date().toISOString(),
      }

      if (payload?.status && ALLOWED_CASE_STATUSES.has(payload.status)) {
        const transitionCase = withStatusTransition(
          base,
          payload.status,
          'System',
          'Manual status update',
        )
        nextCase = {
          ...nextCase,
          status: transitionCase.status,
          statusHistory: transitionCase.statusHistory,
        }
      } else {
        nextCase = applySystemDerivedStatus(nextCase, 'Case data updated')
      }

      return persistRuleSnapshot(nextCase, { triggeredBy: 'updateCaseData' })
    },
  )
}

export async function deleteCaseFile(caseId) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      const storagePaths = Array.from(new Set(
        (existing?.documents || [])
          .map((document) => document?.storagePath)
          .filter(Boolean),
      ))

      for (const storagePath of storagePaths) {
        try {
          await removeCaseDocumentFile(storagePath)
        } catch (error) {
          console.warn('Unable to remove case document from Firebase Storage:', storagePath, error)
        }
      }

      await removeFirebaseCaseFile(caseId)
      deleteLocalCaseFile(caseId)
    },
    async () => {
      deleteLocalCaseFile(caseId)
    },
  )
}

export async function addDocumentToCase(caseId, documentMeta) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      const merged = normalizeCaseFile({
        ...existing,
        documents: [...(existing.documents || []), documentMeta],
        submittedAt: null,
      })

      const nextCase = applySystemDerivedStatus(merged, 'Document added')

      await updateFirebaseCaseFile(caseId, {
        documents: nextCase.documents,
        status: nextCase.status,
        statusHistory: nextCase.statusHistory,
        submittedAt: null,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      return updated ? persistRuleSnapshot(updated, { triggeredBy: 'addDocument' }) : null
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const merged = {
        ...existing,
        documents: [...(existing.documents || []), documentMeta],
        submittedAt: null,
        updatedAt: new Date().toISOString(),
      }

      const nextCase = applySystemDerivedStatus(merged, 'Document added')

      return persistRuleSnapshot(nextCase, { triggeredBy: 'addDocument' })
    },
  )
}

export async function removeDocumentFromCase(caseId, documentId) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      const removedDocument = (existing.documents || []).find((doc) => doc.id === documentId) || null
      const nextDocuments = (existing.documents || []).filter((doc) => doc.id !== documentId)
      const mergedCase = normalizeCaseFile({
        ...existing,
        documents: nextDocuments,
        submittedAt: null,
      })

      const nextCase = applySystemDerivedStatus(mergedCase, 'Document removed')

      await updateFirebaseCaseFile(caseId, {
        documents: nextDocuments,
        status: nextCase.status,
        statusHistory: nextCase.statusHistory,
        submittedAt: null,
      })

      if (removedDocument?.storagePath) {
        try {
          await removeCaseDocumentFile(removedDocument.storagePath)
        } catch (error) {
          console.warn('Unable to remove document from Firebase Storage:', error)
        }
      }

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      return updated ? persistRuleSnapshot(updated, { triggeredBy: 'removeDocument' }) : null
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const nextCase = {
        ...existing,
        documents: (existing.documents || []).filter((doc) => doc.id !== documentId),
        submittedAt: null,
        updatedAt: new Date().toISOString(),
      }

      return persistRuleSnapshot(applySystemDerivedStatus(nextCase, 'Document removed'), { triggeredBy: 'removeDocument' })
    },
  )
}

export function hasRequiredFields(caseFile) {
  if (!caseFile) return false
  const netWorthValue = Number(String(caseFile.netWorth || '').replace(/,/g, ''))
  return Boolean(caseFile.clientName) && netWorthValue >= 3000000
}

export function hasRequiredDocuments(caseFile) {
  return getDocumentCompletionSummary(caseFile).allRequiredComplete
}

export async function markReadyForReview(caseId) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      if (hasCriticalIssues(existing)) {
        return { ok: false, reason: 'Critical risk flags must be resolved before marking ready for review' }
      }

      const nextCase = withStatusTransition(
        existing,
        CASE_STATUS.PENDING_REVIEW,
        'RM',
        'Submitted to Compliance queue',
      )

      if (nextCase.status !== CASE_STATUS.PENDING_REVIEW) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Pending Review` }
      }

      await updateFirebaseCaseFile(caseId, {
        status: CASE_STATUS.PENDING_REVIEW,
        statusHistory: nextCase.statusHistory,
        submittedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }

      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      if (hasCriticalIssues(existing)) {
        return { ok: false, reason: 'Critical risk flags must be resolved before marking ready for review' }
      }

      const nextCase = withStatusTransition(
        existing,
        CASE_STATUS.PENDING_REVIEW,
        'RM',
        'Submitted to Compliance queue',
      )

      if (nextCase.status !== CASE_STATUS.PENDING_REVIEW) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Pending Review` }
      }

      const updated = upsertLocalCaseFile({
        ...existing,
        status: CASE_STATUS.PENDING_REVIEW,
        statusHistory: nextCase.statusHistory,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export async function submitCaseForCompliance(caseId, payload = {}) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      if (existing.status === CASE_STATUS.ESCALATED) {
        return { ok: false, reason: 'Escalated cases must be resolved by Compliance before resubmission.' }
      }

      const merged = normalizeCaseFile({
        ...existing,
        ...payload,
      })

      if (!hasFreshAiAnalysis(merged)) {
        return { ok: false, reason: 'Run AI analysis after the latest document upload before compliance submission.' }
      }

      if (hasCriticalIssues(merged)) {
        return { ok: false, reason: 'Critical risk flags detected. Resolve or escalate before compliance submission.' }
      }

      const nextCase = withStatusTransition(
        merged,
        CASE_STATUS.PENDING_REVIEW,
        'RM',
        'Submitted to Compliance queue',
      )

      if (nextCase.status !== CASE_STATUS.PENDING_REVIEW) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Pending Review` }
      }

      await updateFirebaseCaseFile(caseId, {
        ...payload,
        status: CASE_STATUS.PENDING_REVIEW,
        statusHistory: nextCase.statusHistory,
        submittedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }

      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      if (existing.status === CASE_STATUS.ESCALATED) {
        return { ok: false, reason: 'Escalated cases must be resolved by Compliance before resubmission.' }
      }

      const merged = {
        ...existing,
        ...payload,
      }

      if (!hasFreshAiAnalysis(merged)) {
        return { ok: false, reason: 'Run AI analysis after the latest document upload before compliance submission.' }
      }

      if (hasCriticalIssues(merged)) {
        return { ok: false, reason: 'Critical risk flags detected. Resolve or escalate before compliance submission.' }
      }

      const nextCase = withStatusTransition(
        merged,
        CASE_STATUS.PENDING_REVIEW,
        'RM',
        'Submitted to Compliance queue',
      )

      if (nextCase.status !== CASE_STATUS.PENDING_REVIEW) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Pending Review` }
      }

      const updated = upsertLocalCaseFile({
        ...nextCase,
        status: CASE_STATUS.PENDING_REVIEW,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export function getRequiredDocumentCategories() {
  return Array.from(new Set(DOCUMENT_DEFINITIONS.map((item) => item.category)))
}

export function getRequiredDocumentCategoriesForCase(caseFile) {
  return getDocumentCompletionSummary(caseFile).requiredDocuments.map((item) => item.label)
}

export function getDocumentTypeOptions(caseFile = null) {
  if (!caseFile) {
    return DOCUMENT_DEFINITIONS.map((item) => item.label)
  }
  return getRequiredDocumentDefinitions(caseFile).map((item) => item.label)
}

export function getDocumentTypeGroups(caseFile = null) {
  const source = caseFile ? getRequiredDocumentDefinitions(caseFile) : DOCUMENT_DEFINITIONS
  const grouped = source.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item.label)
    return acc
  }, {})

  return Object.entries(grouped).map(([label, options]) => ({ label, options }))
}

export async function approveCaseByCompliance(caseId) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const nextCase = withStatusTransition(existing, CASE_STATUS.APPROVED, 'Compliance', 'Compliance approved case')
      if (nextCase.status !== CASE_STATUS.APPROVED) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Approved` }
      }

      await updateFirebaseCaseFile(caseId, {
        status: CASE_STATUS.APPROVED,
        statusHistory: nextCase.statusHistory,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const nextCase = withStatusTransition(existing, CASE_STATUS.APPROVED, 'Compliance', 'Compliance approved case')
      if (nextCase.status !== CASE_STATUS.APPROVED) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Approved` }
      }

      const updated = upsertLocalCaseFile({
        ...nextCase,
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export async function escalateCaseByCompliance(caseId) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const nextCase = withStatusTransition(existing, CASE_STATUS.ESCALATED, 'Compliance', 'Compliance escalated case')
      if (nextCase.status !== CASE_STATUS.ESCALATED) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Escalated` }
      }

      await updateFirebaseCaseFile(caseId, {
        status: CASE_STATUS.ESCALATED,
        statusHistory: nextCase.statusHistory,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const nextCase = withStatusTransition(existing, CASE_STATUS.ESCALATED, 'Compliance', 'Compliance escalated case')
      if (nextCase.status !== CASE_STATUS.ESCALATED) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to Escalated` }
      }

      const updated = upsertLocalCaseFile({
        ...nextCase,
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export async function requestMoreInfoFromCompliance(caseId) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const targetStatus = derivePreReviewStatus(existing)
      const nextCase = withStatusTransition(existing, targetStatus, 'Compliance', 'Compliance requested more information')
      if (nextCase.status !== targetStatus) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to ${targetStatus}` }
      }

      await updateFirebaseCaseFile(caseId, {
        status: targetStatus,
        statusHistory: nextCase.statusHistory,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const targetStatus = derivePreReviewStatus(existing)
      const nextCase = withStatusTransition(existing, targetStatus, 'Compliance', 'Compliance requested more information')
      if (nextCase.status !== targetStatus) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to ${targetStatus}` }
      }

      const updated = upsertLocalCaseFile({
        ...nextCase,
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export async function addComplianceComment(caseId, comment) {
  const trimmed = String(comment?.text || '').trim()
  if (!trimmed) return { ok: false, reason: 'Comment cannot be empty' }

  const entry = {
    id: `comment-${Date.now()}`,
    author: comment.author || 'Compliance Officer',
    audience: comment.audience || 'Internal',
    text: trimmed,
    createdAt: new Date().toISOString(),
  }

  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const comments = [...(existing.comments || []), entry]
      await updateFirebaseCaseFile(caseId, {
        comments,
        updatedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated, comment: entry }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const updated = upsertLocalCaseFile({
        ...existing,
        comments: [...(existing.comments || []), entry],
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated, comment: entry }
    },
  )
}

export async function submitComplianceDecision(caseId, decision, payload = {}) {
  const normalizedDecision = String(decision || '').toLowerCase()
  const decisionConfig = {
    approve: {
      status: CASE_STATUS.APPROVED,
      reason: 'Compliance approved case',
      note: payload.note || 'Compliance approved the case for Operations processing.',
    },
    request_info: {
      status: CASE_STATUS.ACTION_REQUIRED,
      reason: 'Compliance requested more information',
      note: payload.note || 'Compliance requested additional information from RM.',
    },
    reject: {
      status: CASE_STATUS.REJECTED,
      reason: 'Compliance rejected case',
      note: payload.note || 'Compliance rejected the case.',
    },
  }[normalizedDecision]

  if (!decisionConfig) return { ok: false, reason: 'Unknown compliance decision' }

  const makeDecisionComment = () => ({
    id: `decision-${Date.now()}`,
    author: 'Compliance Officer',
    audience: normalizedDecision === 'request_info' ? 'RM Feedback' : 'Internal',
    text: decisionConfig.note,
    decision: normalizedDecision,
    createdAt: new Date().toISOString(),
  })

  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const nextCase = withStatusTransition(existing, decisionConfig.status, 'Compliance', decisionConfig.reason)
      if (nextCase.status !== decisionConfig.status) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to ${decisionConfig.status}` }
      }

      const decisionEntry = makeDecisionComment()
      await updateFirebaseCaseFile(caseId, {
        status: decisionConfig.status,
        statusHistory: nextCase.statusHistory,
        comments: [...(existing.comments || []), decisionEntry],
        complianceDecision: {
          decision: normalizedDecision,
          decidedAt: decisionEntry.createdAt,
          decidedBy: 'Compliance Officer',
          note: decisionConfig.note,
        },
        updatedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const nextCase = withStatusTransition(existing, decisionConfig.status, 'Compliance', decisionConfig.reason)
      if (nextCase.status !== decisionConfig.status) {
        return { ok: false, reason: `Invalid status transition from ${existing.status} to ${decisionConfig.status}` }
      }

      const decisionEntry = makeDecisionComment()
      const updated = upsertLocalCaseFile({
        ...nextCase,
        comments: [...(existing.comments || []), decisionEntry],
        complianceDecision: {
          decision: normalizedDecision,
          decidedAt: decisionEntry.createdAt,
          decidedBy: 'Compliance Officer',
          note: decisionConfig.note,
        },
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export function isFirebaseEnabled() {
  return hasFirebaseConfig
}

// Document Review Actions for Compliance
export async function reviewDocument(caseId, documentId, reviewAction, comment = '') {
  const validActions = ['accept', 'needs_clarification', 'reject', 'comment']
  if (!validActions.includes(reviewAction)) {
    return { ok: false, reason: 'Invalid review action' }
  }

  const isCommentOnly = reviewAction === 'comment'
  const reviewEntry = {
    id: `doc-review-${Date.now()}`,
    documentId,
    action: reviewAction,
    comment: String(comment || '').trim(),
    reviewedBy: 'Compliance Officer',
    reviewedAt: new Date().toISOString(),
  }

  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const documentReviews = [...(existing.documentReviews || []), reviewEntry]
      const documents = (existing.documents || []).map((doc) => {
        if (doc.id !== documentId) return doc
        if (isCommentOnly) {
          return { ...doc, reviewComment: comment }
        }
        return { ...doc, reviewStatus: reviewAction, reviewComment: comment }
      })

      await updateFirebaseCaseFile(caseId, {
        documentReviews,
        documents,
        updatedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated, review: reviewEntry }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const documents = (existing.documents || []).map((doc) => {
        if (doc.id !== documentId) return doc
        if (isCommentOnly) {
          return { ...doc, reviewComment: comment }
        }
        return { ...doc, reviewStatus: reviewAction, reviewComment: comment }
      })

      const updated = upsertLocalCaseFile({
        ...existing,
        documentReviews: [...(existing.documentReviews || []), reviewEntry],
        documents,
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated, review: reviewEntry }
    },
  )
}

// Compliance Checklist Management
export const COMPLIANCE_CHECKLIST_ITEMS = STANDARD_CHECKLIST_ITEMS

export async function updateComplianceChecklist(caseId, checklistUpdates) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const currentChecklist = existing.complianceChecklist || {}
      const updatedChecklist = { ...currentChecklist }

      Object.entries(checklistUpdates).forEach(([key, value]) => {
        if (value.checked !== undefined) {
          updatedChecklist[key] = {
            checked: value.checked,
            checkedAt: value.checked ? new Date().toISOString() : null,
            checkedBy: value.checked ? 'Compliance Officer' : null,
            note: value.note || '',
            overrideReason: value.overrideReason || '',
            overridePolicyReference: value.overridePolicyReference || '',
          }
        }
      })
      const overrideEntries = Object.entries(checklistUpdates)
        .filter(([, value]) => value.overrideReason || value.overridePolicyReference)
        .map(([key, value]) => ({
          id: `override-${Date.now()}-${key}`,
          type: 'checklist',
          key,
          reason: value.overrideReason || '',
          policyReference: value.overridePolicyReference || '',
          createdAt: new Date().toISOString(),
          createdBy: 'Compliance Officer',
        }))

      await updateFirebaseCaseFile(caseId, {
        complianceChecklist: updatedChecklist,
        complianceOverrides: [...(existing.complianceOverrides || []), ...overrideEntries],
        updatedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated, checklist: updatedChecklist }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const currentChecklist = existing.complianceChecklist || {}
      const updatedChecklist = { ...currentChecklist }

      Object.entries(checklistUpdates).forEach(([key, value]) => {
        if (value.checked !== undefined) {
          updatedChecklist[key] = {
            checked: value.checked,
            checkedAt: value.checked ? new Date().toISOString() : null,
            checkedBy: value.checked ? 'Compliance Officer' : null,
            note: value.note || '',
            overrideReason: value.overrideReason || '',
            overridePolicyReference: value.overridePolicyReference || '',
          }
        }
      })
      const overrideEntries = Object.entries(checklistUpdates)
        .filter(([, value]) => value.overrideReason || value.overridePolicyReference)
        .map(([key, value]) => ({
          id: `override-${Date.now()}-${key}`,
          type: 'checklist',
          key,
          reason: value.overrideReason || '',
          policyReference: value.overridePolicyReference || '',
          createdAt: new Date().toISOString(),
          createdBy: 'Compliance Officer',
        }))

      const updated = upsertLocalCaseFile({
        ...existing,
        complianceChecklist: updatedChecklist,
        complianceOverrides: [...(existing.complianceOverrides || []), ...overrideEntries],
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated, checklist: updatedChecklist }
    },
  )
}

export function getComplianceChecklistStatus(caseFile) {
  const checklist = caseFile?.complianceChecklist || {}
  const snapshot = getRuleDecisionSnapshot(caseFile)
  const dynamicItems = snapshot?.aggregatedActions?.checklistItems || []
  const itemMap = new Map(COMPLIANCE_CHECKLIST_ITEMS.map((item) => [item.key, { ...item, ruleDriven: false }]))
  dynamicItems.forEach((item) => {
    itemMap.set(item.key, {
      key: item.key,
      label: item.label,
      category: item.category || 'Rule-Driven',
      ruleDriven: true,
      policyReference: item.policyRef,
      sources: item.sources || [],
      reason: item.reason,
    })
  })
  ;(snapshot?.aggregatedActions?.removedChecklistKeys || []).forEach((key) => itemMap.delete(key))
  const items = Array.from(itemMap.values()).map((item) => ({
    ...item,
    ...checklist[item.key],
  }))
  const total = items.length
  const completed = items.filter((item) => item.checked).length
  const allComplete = completed === total

  return {
    total,
    completed,
    allComplete,
    items,
  }
}

// AI Risk Status Management
export async function updateRiskStatus(caseId, riskId, status, note = '') {
  const validStatuses = ['accepted', 'false_positive', 'needs_followup', 'escalated']
  if (!validStatuses.includes(status)) {
    return { ok: false, reason: 'Invalid risk status' }
  }

  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) return { ok: false, reason: 'Case not found' }

      const riskStatuses = {
        ...(existing.riskStatuses || {}),
        [riskId]: {
          status,
          note: String(note || '').trim(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'Compliance Officer',
        },
      }

      await updateFirebaseCaseFile(caseId, {
        riskStatuses,
        updatedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) upsertLocalCaseFile(updated)
      return { ok: true, caseFile: updated, riskStatuses }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return { ok: false, reason: 'Case not found' }

      const updated = upsertLocalCaseFile({
        ...existing,
        riskStatuses: {
          ...(existing.riskStatuses || {}),
          [riskId]: {
            status,
            note: String(note || '').trim(),
            updatedAt: new Date().toISOString(),
            updatedBy: 'Compliance Officer',
          },
        },
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated, riskStatuses: updated.riskStatuses }
    },
  )
}

export function getDocumentReviewStatus(caseFile, documentId) {
  const doc = caseFile?.documents?.find((d) => d.id === documentId)
  return doc?.reviewStatus || null
}
