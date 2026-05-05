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

export const NET_WORTH_MINIMUM_USD = 5000000

export const NET_WORTH_USD_RATES = Object.freeze({
  USD: 1,
  SGD: 0.74,
  CHF: 1.1,
  GBP: 1.25,
  EUR: 1.08,
})

export function getNetWorthUsdValue(amount, currency = 'USD') {
  const numericAmount = Number(String(amount || '').replace(/,/g, ''))
  const rate = NET_WORTH_USD_RATES[currency || 'USD'] || NET_WORTH_USD_RATES.USD
  return numericAmount * rate
}

function getCaseNetWorthUsdValue(caseFile) {
  return getNetWorthUsdValue(caseFile?.estimatedAum || caseFile?.investableAssets || caseFile?.netWorth, caseFile?.assetCurrency || caseFile?.netWorthCurrency || 'USD')
}

export const CASE_STATUS = Object.freeze({
  DRAFT: 'Draft',
  MISSING_DOCUMENTS: 'Missing Documents',
  PENDING_REVIEW: 'Pending Review',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  ACTION_REQUIRED: 'Request More Information',
  REJECTED: 'Rejected',
  ESCALATED: 'Escalated',
  READY_FOR_REVIEW: 'Ready for Review',
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
  { key: 'passport_id', label: 'Passport / ID', evidenceCategory: 'identity_document', category: 'KYC Documents', alwaysRequired: true, reason: 'Identity verification is mandatory for KYC onboarding.' },
  { key: 'address_proof', label: 'Address Proof', evidenceCategory: 'address_proof', category: 'KYC Documents', alwaysRequired: true, reason: 'Address verification is required for customer due diligence.' },
  { key: 'tax_residency', label: 'Tax Residency', evidenceCategory: 'singapore_tax_residency', category: 'Tax Documents', alwaysRequired: true, reason: 'CRS/FATCA tax residency evidence is required.' },
  { key: 'sow_declaration', label: 'SoW Declaration', evidenceCategory: 'source_of_wealth_declaration', category: 'SoW / SoF Documents', alwaysRequired: true, reason: 'Source of Wealth declaration is mandatory.' },
  { key: 'bank_statements_sof', label: 'Bank Statements (Source of Funds)', evidenceCategory: 'bank_statement', category: 'SoW / SoF Documents', alwaysRequired: true, reason: 'Bank statements are required to evidence Source of Funds.' },

  { key: 'business_registry_extract', label: 'Business Registry Extract', evidenceCategory: 'business_registry', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },
  { key: 'shareholding_structure', label: 'Shareholding Structure', evidenceCategory: 'shareholding_structure', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },
  { key: 'company_financial_statements', label: 'Company Financial Statements', evidenceCategory: 'company_financial_statement', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], reason: 'Required because profile indicates Business Owner.' },
  { key: 'dividend_statements', label: 'Dividend Statements', evidenceCategory: 'dividend_statement', category: 'Business Evidence', profileTypes: [CLIENT_PROFILE_TYPE.BUSINESS_OWNER], condition: 'dividend_declared', reason: 'Required because dividend income is declared.' },

  { key: 'payslips', label: 'Payslips', evidenceCategory: 'payslip', category: 'Employment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE], reason: 'Payslips are required because profile indicates Salaried Employee.' },
  { key: 'employment_contract', label: 'Employment Contract', evidenceCategory: 'employment_contract', category: 'Employment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE], reason: 'Employment contract is required because profile indicates Salaried Employee.' },

  { key: 'investment_portfolio_statements', label: 'Investment Portfolio Statements', evidenceCategory: 'investment_portfolio', category: 'Investment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.INVESTOR], reason: 'Required because profile indicates Investor.' },
  { key: 'trade_confirmations', label: 'Trade Confirmations', evidenceCategory: 'trade_confirmation', category: 'Investment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.INVESTOR], reason: 'Required because profile indicates Investor.' },
  { key: 'rsu_stock_compensation', label: 'RSU / Stock Compensation Evidence', evidenceCategory: 'rsu_portfolio_support', category: 'Investment Evidence', profileTypes: [CLIENT_PROFILE_TYPE.INVESTOR, CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE], condition: 'rsu_declared', reason: 'Required because RSU or stock compensation is declared.' },
]

const SYSTEM_EDITABLE_STATUSES = new Set([
  CASE_STATUS.DRAFT,
  CASE_STATUS.MISSING_DOCUMENTS,
  CASE_STATUS.READY_FOR_REVIEW,
  CASE_STATUS.PENDING_REVIEW,
  CASE_STATUS.ACTION_REQUIRED,
])

const RM_SUBMITTABLE_STATUSES = new Set([
  CASE_STATUS.DRAFT,
  CASE_STATUS.MISSING_DOCUMENTS,
  CASE_STATUS.READY_FOR_REVIEW,
  CASE_STATUS.ACTION_REQUIRED,
])

function getRmSubmissionStatusBlocker(status) {
  if (RM_SUBMITTABLE_STATUSES.has(status)) return ''
  if (status === CASE_STATUS.PENDING_REVIEW || status === CASE_STATUS.UNDER_REVIEW) {
    return 'Case is already in Compliance review. RM can resubmit only if Compliance requests more information.'
  }
  if (status === CASE_STATUS.APPROVED) return 'Approved cases cannot be resubmitted.'
  if (status === CASE_STATUS.REJECTED) return 'Rejected cases cannot be resubmitted.'
  if (status === CASE_STATUS.ESCALATED) return 'Escalated cases must be resolved by Compliance before resubmission.'
  return 'Case status does not allow RM submission.'
}

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

function formatEvidenceText(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatEvidenceText).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return [
      value.evidenceCategory,
      value.aiDetectedDocumentType,
      value.detectedDocumentType,
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
      value.recommendation,
      value.action,
      value.nextAction,
    ].map(formatEvidenceText).filter(Boolean).join(' ')
  }
  return ''
}

export function getEvidenceCategoryForText(value) {
  const text = formatEvidenceText(value).toLowerCase()
  if (!text) return null

  if (/\b(passport|identity document|id document|national id)\b/.test(text)) return 'identity_document'
  if (/\b(address proof|residential proof|residence proof|utility bill|lease|driver.?s licence|driver.?s license)\b/.test(text)) return 'address_proof'
  if (/\b(singapore.*tax|iras|dual tax residency|tax residency|tax residency certificate|tax residency documentation|tax residency letter|residency certificate|residency notice)\b/.test(text)) return 'singapore_tax_residency'
  if (/\b(form 1040|us individual tax return|w-?2|us tax return)\b/.test(text)) return 'us_tax_return'
  if (/\b(w-?9|taxpayer identification number|tin provided)\b/.test(text)) return 'w9_form'
  if (/\b(fatca|self.?certification|specified us person|us person.*tax)\b/.test(text)) return 'fatca_self_certification'
  if (/\b(comprehensive net-worth|net worth statement|net-worth statement|asset breakdown|independent wealth verification|wealth verification|source of wealth declaration|sow declaration|declared source of wealth)\b/.test(text)) return 'source_of_wealth_declaration'
  if (/\b(source of wealth|sow|wealth verification|net worth|net-worth|asset statement|asset valuation|asset breakdown|property deed|financial statement|conversion rationale|conversion methodology|currency conversion|single currency)\b/.test(text)) return 'source_of_wealth_declaration'
  if (/\b(bank statement|source of funds|sof|salary transfer|bonus transfer|cash balance|liquidity|savings account)\b/.test(text)) return 'bank_statement'
  if (/\b(business registry|company registration|registry extract|company extract|acra)\b/.test(text)) return 'business_registry'
  if (/\b(shareholding|ownership structure|cap table|capitalisation table)\b/.test(text)) return 'shareholding_structure'
  if (/\b(company financial statement|audited financial|management account|financial statement)\b/.test(text)) return 'company_financial_statement'
  if (/\b(dividend|distribution)\b/.test(text)) return 'dividend_statement'
  if (/\b(payslip|pay slip|salary slip)\b/.test(text)) return 'payslip'
  if (/\b(employment contract|employment letter|employer letter|offer letter)\b/.test(text)) return 'employment_contract'
  if (/\b(rsu|restricted stock|stock compensation|stock plan|vesting|vested|grant|portfolio growth|brokerage|investment portfolio|portfolio statement|listed securities|equity compensation)\b/.test(text)) return 'rsu_portfolio_support'
  if (/\b(trade confirmation|contract note|brokerage confirmation)\b/.test(text)) return 'trade_confirmation'
  if (/\b(investment statement|securities account|custody statement)\b/.test(text)) return 'investment_portfolio'
  if (/\b(sanctions?|pep|adverse media|screening)\b/.test(text)) return 'screening'
  if (/\b(enhanced due.?diligence|\bedd\b)\b/.test(text)) return 'enhanced_due_diligence'
  return null
}

function getDocumentEvidenceCategory(document) {
  if (document?.evidenceCategory && document.evidenceCategory !== 'fatca_documentation') {
    return document.evidenceCategory
  }
  return getEvidenceCategoryForText({
    ...document,
    evidenceCategory: '',
  }) || document?.evidenceCategory || null
}

function getUploadedEvidenceForCategory(caseFile, evidenceCategory) {
  if (!evidenceCategory) return []
  return (caseFile?.documents || []).filter((document) => getDocumentEvidenceCategory(document) === evidenceCategory)
}

function hasDeclaredSignal(caseFile, pattern) {
  const analysis = caseFile?.aiAnalysis || {}
  const haystack = [
    caseFile?.occupation,
    caseFile?.purpose,
    caseFile?.primarySource,
    caseFile?.declaredSourceOfWealth,
    caseFile?.sourceOfWealthType,
    caseFile?.sowDraft?.primarySource,
    caseFile?.sowDraft?.narrativeSummary,
    analysis?.sourceOfWealthDraft?.primarySourceOfWealth,
    analysis?.sourceOfWealthDraft?.narrativeExplanation,
    analysis?.extractedData?.sourceOfWealthIndicators?.value,
  ].map(formatEvidenceText).join(' ').toLowerCase()
  return pattern.test(haystack)
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function removeUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep)
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (item !== undefined) {
        acc[key] = removeUndefinedDeep(item)
      }
      return acc
    }, {})
  }

  return value
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
    'Ready for Review': CASE_STATUS.READY_FOR_REVIEW,
    'In Review': CASE_STATUS.UNDER_REVIEW,
    'Action Required': CASE_STATUS.ACTION_REQUIRED,
    'Request More Information': CASE_STATUS.ACTION_REQUIRED,
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
    netWorthCurrency: caseFile.netWorthCurrency || 'USD',
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

async function attachRuleSnapshot(caseFile, options = {}) {
  if (!caseFile || !caseFile.id) return caseFile
  const baselineReadiness = options.baselineReadiness ?? getBaselineReadinessPercentage(caseFile)
  const snapshot = await buildRuleSnapshot(caseFile, {
    triggeredBy: options.triggeredBy || 'system',
    evaluatedBy: options.evaluatedBy || 'system',
    baselineReadiness,
  })
  if (!snapshot) return caseFile
  const enriched = appendRuleSnapshot(caseFile, snapshot)
  enriched._ruleEvaluation = await evaluateCaseRules(caseFile, { baselineReadiness })
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

async function persistRuleSnapshot(caseFile, options = {}) {
  return upsertLocalCaseFile(await attachRuleSnapshot(caseFile, options))
}

export async function rerunRuleEvaluation(caseId, options = {}) {
  const existing = getLocalCaseFileById(caseId) || normalizeCaseFile(await getFirebaseCaseFile(caseId))
  if (!existing) return { ok: false, reason: 'Case not found' }

  const updated = await persistRuleSnapshot(existing, {
    triggeredBy: options.triggeredBy || 'manual-rerun',
    evaluatedBy: options.evaluatedBy || 'Compliance Officer',
  })

  if (hasFirebaseConfig) {
    try {
      await updateFirebaseCaseFile(caseId, removeUndefinedDeep({
        ruleSnapshots: updated.ruleSnapshots,
        _lastRuleSnapshot: updated._lastRuleSnapshot,
        updatedAt: new Date().toISOString(),
      }))
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
  const profileType = getClientProfileType(caseFile)
  const baseRequired = DOCUMENT_DEFINITIONS.filter((definition) => {
    if (definition.alwaysRequired) return true
    if (!(definition.profileTypes || []).includes(profileType)) return false
    if (definition.condition === 'dividend_declared') return hasDeclaredSignal(caseFile, /\b(dividend|distribution)\b/)
    if (definition.condition === 'rsu_declared') return hasDeclaredSignal(caseFile, /\b(rsu|restricted stock|stock compensation|stock plan|vesting|vested|equity compensation)\b/)
    return true
  })
  const ruleDefinitions = ruleRequired.map((item) => ({
      key: String(item.target || item.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      label: item.target || item.label,
      evidenceCategory: getEvidenceCategoryForText(`${item.target || item.label || ''} ${item.reason || ''}`),
      category: item.category || 'Rule Required Documents',
      alwaysRequired: true,
      reason: item.reason || item.sources?.[0]?.ruleName || 'Required by active compliance rule.',
      ruleDriven: true,
      sources: item.sources || [],
  }))

  const merged = new Map()
  ;[...baseRequired, ...ruleDefinitions].forEach((definition) => {
    const key = definition.evidenceCategory || definition.label
    if (!key) return
    const existing = merged.get(key)
    merged.set(key, existing ? {
      ...existing,
      ruleDriven: existing.ruleDriven || definition.ruleDriven,
      sources: [...(existing.sources || []), ...(definition.sources || [])],
      reason: existing.reason || definition.reason,
    } : definition)
  })
  return Array.from(merged.values())
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
    const categoryDocs = byCategory.get(definition.label) || []
    const evidenceDocs = getUploadedEvidenceForCategory(caseFile, definition.evidenceCategory)
    const linkedDocs = Array.from(new Map([...categoryDocs, ...evidenceDocs].map((doc) => [
      String(doc.id || doc.name || doc.category || '').toLowerCase(),
      doc,
    ])).values())
    const hasUpload = linkedDocs.length > 0
    const hasInvalid = linkedDocs.some((doc) => String(doc?.validationStatus || '').toLowerCase() === 'invalid')
    const hasUnextractable = hasUpload && linkedDocs.every((doc) => String(doc?.extractedText || '').trim().length === 0)
    const state = !hasUpload ? 'missing' : (hasInvalid || hasUnextractable) ? 'needs_review' : 'uploaded'

    return {
      ...definition,
      required: true,
      documents: linkedDocs,
      evidenceCategory: definition.evidenceCategory || getEvidenceCategoryForText(definition.label),
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
  const ruleRequiredDocuments = requiredDocuments.filter((item) => item.ruleDriven)
  const missingRuleRequiredDocuments = ruleRequiredDocuments.filter((item) => item.status === 'missing')

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
    ruleRequiredDocuments,
    missingRuleRequiredDocuments,
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

function getBaselineReadinessPercentage(caseFile) {
  return calculateReadinessComponents(caseFile).score
}

function getEffectiveReadinessPenalty(caseFile, snapshot) {
  if (!snapshot) return 0

  const currentDocumentCount = (caseFile?.documents || []).length
  const penalties = snapshot.aggregatedActions?.readinessPenalties || snapshot.raw?.readinessResult?.penalties || []

  if (!Array.isArray(penalties) || penalties.length === 0) {
    const snapshotDocumentCount = Number(snapshot.facts?.['documents.totalCount'] ?? snapshot.facts?.documentCount)
    const snapshotMatchesCurrentDocuments = Number.isNaN(snapshotDocumentCount)
      || snapshotDocumentCount === currentDocumentCount
    return snapshotMatchesCurrentDocuments ? (snapshot.computedMetrics?.readinessPenalty || 0) : 0
  }

  return penalties.reduce((total, penalty) => {
    const ruleId = penalty.source?.ruleId || penalty.ruleId || ''
    const reason = String(penalty.reason || '').toLowerCase()
    const isNoDocumentPenalty = ruleId === 'rule-missing-docs-penalty'
      || reason.includes('no documents uploaded')

    if (isNoDocumentPenalty && currentDocumentCount > 0) {
      return total
    }

    return total + (Number(penalty.value) || 0)
  }, 0)
}

function getProfileReadiness(caseFile) {
  const normalized = normalizeCaseFile(caseFile)
  const usdEquivalent = getCaseNetWorthUsdValue(normalized)
  const requiredFields = [
    { key: 'clientName', label: 'Full name', complete: Boolean(normalized.clientName) },
    { key: 'nationality', label: 'Nationality', complete: Boolean(normalized.nationality) },
    { key: 'residence', label: 'Country of residence', complete: Boolean(normalized.residence) },
    { key: 'occupation', label: 'Occupation', complete: Boolean(normalized.occupation) },
    { key: 'employer', label: 'Employer / business name', complete: Boolean(normalized.employer || normalized.businessName || normalized.occupation) },
    { key: 'sourceOfWealthType', label: 'Source of wealth type', complete: Boolean(normalized.sourceOfWealthType || normalized.primarySource || normalized.declaredSourceOfWealth || normalized.purpose || normalized.occupation) },
    { key: 'netWorth', label: 'Estimated net worth', complete: Boolean(normalized.netWorth || normalized.estimatedAum || normalized.investableAssets) },
    { key: 'aum', label: 'Estimated AUM / investable assets', complete: Boolean(normalized.estimatedAum || normalized.investableAssets || normalized.netWorth) },
    { key: 'currency', label: 'Currency of assets', complete: Boolean(normalized.assetCurrency || normalized.netWorthCurrency) },
    { key: 'usdEquivalent', label: 'USD equivalent value', complete: usdEquivalent > 0 },
  ]
  const completed = requiredFields.filter((field) => field.complete).length
  const points = Math.round((completed / requiredFields.length) * 20)
  const missing = requiredFields.filter((field) => !field.complete).map((field) => field.label)
  const eligibilityWarning = usdEquivalent < NET_WORTH_MINIMUM_USD
    ? `AUM is below USD ${NET_WORTH_MINIMUM_USD.toLocaleString('en-US')} equivalent.`
    : ''

  return {
    points,
    maxPoints: 20,
    completed,
    total: requiredFields.length,
    complete: missing.length === 0 && !eligibilityWarning,
    status: missing.length === 0 ? 'Complete' : 'Incomplete',
    missing,
    usdEquivalent,
    eligibilityWarning,
  }
}

function getAiExtractionReadiness(caseFile) {
  const documents = caseFile?.documents || []
  const extractedCount = documents.filter((document) => String(document.extractedText || '').trim().length > 0).length
  const textExtractionComplete = documents.length > 0 && extractedCount === documents.length
  const aiAnalysisCompleted = hasCompletedAiAnalysis(caseFile)
  const extractedClientDetailsReviewed = Boolean(caseFile?.aiExtractionReview?.clientDetailsReviewed || caseFile?.aiReview?.extractedClientDetailsReviewed || aiAnalysisCompleted)
  const documentTypesConfirmed = Boolean(caseFile?.aiExtractionReview?.documentTypesConfirmed || caseFile?.aiReview?.documentTypesConfirmed || aiAnalysisCompleted)
  const extractedValuesConfirmed = Boolean(caseFile?.aiExtractionReview?.valuesConfirmed || caseFile?.aiReview?.valuesConfirmed || aiAnalysisCompleted)
  const checks = [
    { label: 'Text extraction completed', blocker: 'Extract text from all uploaded documents', complete: textExtractionComplete },
    { label: 'AI analysis completed', blocker: 'Run AI analysis', complete: aiAnalysisCompleted },
    { label: 'Extracted client details reviewed by RM', blocker: 'Review extracted client details', complete: extractedClientDetailsReviewed },
    { label: 'AI-detected document type confirmed', blocker: 'Confirm AI-detected document types', complete: documentTypesConfirmed },
    { label: 'AI-extracted values confirmed or corrected', blocker: 'Confirm or correct AI-extracted values', complete: extractedValuesConfirmed },
  ]
  const completed = checks.filter((item) => item.complete).length
  return {
    points: Math.round((completed / checks.length) * 15),
    maxPoints: 15,
    completed,
    total: checks.length,
    complete: completed === checks.length,
    status: completed === checks.length ? 'Complete' : 'Needs RM Review',
    missing: checks.filter((item) => !item.complete).map((item) => item.blocker),
  }
}

function getSowReadiness(caseFile) {
  const analysis = caseFile?.aiAnalysis || {}
  const draft = caseFile?.sowDraft || {}
  const narrative = formatEvidenceText(draft.narrativeSummary || analysis?.sourceOfWealthDraft?.narrativeExplanation || analysis?.sowDraft?.narrativeSummary || '')
  const primarySource = formatEvidenceText(draft.primarySource || analysis?.sourceOfWealthDraft?.primarySourceOfWealth || analysis?.extractedData?.sourceOfWealthIndicators?.value || caseFile?.primarySource || caseFile?.declaredSourceOfWealth || '')
  const supportingEvidenceText = formatEvidenceText(draft.supportingEvidence || analysis?.sourceOfWealthDraft?.supportingEvidence || '')
  const confidence = String(draft.confidence || analysis?.sourceOfWealthDraft?.confidence || analysis?.confidence || '').toLowerCase()
  const supportedCategories = [
    'source_of_wealth_declaration',
    'bank_statement',
    'employment_contract',
    'payslip',
    'business_registry',
    'shareholding_structure',
    'company_financial_statement',
    'dividend_statement',
    'investment_portfolio',
    'trade_confirmation',
    'rsu_portfolio_support',
  ].filter((category) => (
    getUploadedEvidenceForCategory(caseFile, category).length > 0
    || supportingEvidenceText.toLowerCase().includes(category.replace(/_/g, '-'))
  ))
  const mismatchText = formatEvidenceText([...(analysis.mismatches || []), ...(analysis.riskFlags || []), ...(analysis.risks || [])]).toLowerCase()
  const hasHighConfidenceDraft = confidence.includes('high')
    && narrative.trim().length >= 220
    && supportedCategories.length >= 4
  const checks = [
    { label: 'SoW narrative exists', complete: narrative.trim().length > 0 || primarySource.trim().length > 0 },
    { label: 'SoW narrative is specific', complete: narrative.trim().length >= 120 || primarySource.trim().length >= 80 },
    { label: 'SoW matches uploaded evidence', complete: supportedCategories.length >= 2 },
    { label: 'Wealth source is clear and realistic', complete: /\b(salary|bonus|business|dividend|investment|portfolio|rsu|stock|sale|income|employment)\b/i.test(`${narrative} ${primarySource}`) },
    { label: 'Major wealth events are supported by documents', complete: supportedCategories.length >= 3 || !hasDeclaredSignal(caseFile, /\b(rsu|dividend|business sale|share sale|portfolio|investment)\b/) },
    { label: 'Currency and amount are consistent with evidence', complete: !/\bcurrency|amount|net worth|aum|usd|sgd\b/.test(mismatchText) || getUploadedEvidenceForCategory(caseFile, 'source_of_wealth_declaration').length > 0 },
  ]
  const completed = hasHighConfidenceDraft ? checks.length : checks.filter((item) => item.complete).length
  return {
    points: Math.round((completed / checks.length) * 15),
    maxPoints: 15,
    completed,
    total: checks.length,
    complete: completed === checks.length,
    status: completed === checks.length ? 'Strong' : completed >= 3 ? 'Needs Review' : 'Weak',
    missing: hasHighConfidenceDraft ? [] : checks.filter((item) => !item.complete).map((item) => item.label),
    coveredEvidence: supportedCategories,
  }
}

function getRiskReadiness(caseFile) {
  const analysis = caseFile?.aiAnalysis || {}
  const risks = [...(analysis.riskFlags || []), ...(analysis.risks || [])]
  const mismatches = analysis.mismatches || []
  const issues = [...risks, ...mismatches]
    .map((item, index) => ({
      id: item.id || `risk-${index}`,
      title: formatEvidenceText(item.title || item.field || item.label || item.issue || 'Risk issue'),
      severity: formatEvidenceText(item.severity || item.priority || 'Medium'),
      description: formatEvidenceText(item.description || item.issue || item.rationale || ''),
      evidenceCategory: getEvidenceCategoryForText(item),
    }))
    .filter((item) => !item.evidenceCategory || getUploadedEvidenceForCategory(caseFile, item.evidenceCategory).length === 0)
  const aumBelowThreshold = getCaseNetWorthUsdValue(caseFile) < NET_WORTH_MINIMUM_USD
  if (aumBelowThreshold) {
    issues.push({
      id: 'aum-below-threshold',
      title: 'AUM below threshold',
      severity: 'Critical',
      description: `AUM is below USD ${NET_WORTH_MINIMUM_USD.toLocaleString('en-US')} equivalent.`,
      evidenceCategory: 'source_of_wealth_declaration',
    })
  }

  const penalty = issues.reduce((total, issue) => {
    const severity = String(issue.severity || '').toLowerCase()
    if (severity === 'critical') return total + 12
    if (severity === 'high') return total + 8
    if (severity === 'medium') return total + 4
    return total + 2
  }, 0)
  const points = Math.max(0, 20 - penalty)
  const hasCritical = issues.some((issue) => /critical/i.test(issue.severity))
  const hasHigh = issues.some((issue) => /high/i.test(issue.severity))

  return {
    points,
    maxPoints: 20,
    complete: issues.length === 0,
    cleared: issues.length === 0,
    status: hasCritical ? 'Blocked by Risk' : hasHigh ? 'High Risk Open' : issues.length > 0 ? 'Minor Issues Open' : 'Cleared',
    issues,
    hasCritical,
    hasHigh,
  }
}

function calculateReadinessComponents(caseFile) {
  const normalized = normalizeCaseFile(caseFile)
  const completionSummary = getDocumentCompletionSummary(normalized)
  const profile = getProfileReadiness(normalized)
  const documentPoints = completionSummary.requiredTotal === 0
    ? 0
    : Math.round((completionSummary.requiredCompletedCount / completionSummary.requiredTotal) * 30)
  const documents = {
    points: documentPoints,
    maxPoints: 30,
    completed: completionSummary.requiredCompletedCount,
    total: completionSummary.requiredTotal,
    complete: completionSummary.allRequiredComplete,
    status: completionSummary.allRequiredComplete ? 'Complete' : 'Missing Documents',
    missing: completionSummary.missingRequiredDocuments.map((item) => item.label),
    needsReview: completionSummary.needsReviewDocuments.map((item) => item.label),
  }
  const aiExtraction = getAiExtractionReadiness(normalized)
  const sow = getSowReadiness(normalized)
  const risk = getRiskReadiness(normalized)
  const score = profile.points + documents.points + aiExtraction.points + sow.points + risk.points

  return { score, profile, documents, aiExtraction, sow, risk }
}

export function calculateReadinessScore(caseFile) {
  const normalized = normalizeCaseFile(caseFile)
  const completionSummary = getDocumentCompletionSummary(normalized)
  const components = calculateReadinessComponents(normalized)
  const baselinePercentage = components.score
  const snapshot = getRuleDecisionSnapshot(normalized)
  const hasOpenReadinessIssue = !components.profile.complete
    || !components.documents.complete
    || !components.aiExtraction.complete
    || !components.sow.complete
    || components.risk.issues.length > 0
  const readinessPenalty = hasOpenReadinessIssue ? getEffectiveReadinessPenalty(normalized, snapshot) : 0
  const percentage = Math.max(0, Math.min(100, baselinePercentage - readinessPenalty))
  const ruleRisk = snapshot?.computedMetrics?.finalRiskLevel || null
  const allMandatoryDocumentsUploaded = completionSummary.allRequiredComplete
  const readinessGaps = [
    ...components.profile.missing.map((item) => `Missing profile field: ${item}`),
    components.profile.eligibilityWarning,
    ...components.documents.missing.map((item) => `Missing ${item}`),
    ...components.documents.needsReview.map((item) => `${item} needs review`),
    ...components.aiExtraction.missing,
    ...components.sow.missing.map((item) => `Source of Wealth: ${item}`),
    ...components.risk.issues
      .map((issue) => `Unresolved ${String(issue.severity).toLowerCase()} risk: ${issue.title}`),
  ].filter(Boolean)
  const canSubmit = RM_SUBMITTABLE_STATUSES.has(normalized.status)
    && percentage >= 80
    && allMandatoryDocumentsUploaded
    && components.aiExtraction.complete
    && components.sow.complete
    && !components.risk.hasCritical
    && !components.risk.hasHigh
    && components.profile.usdEquivalent >= NET_WORTH_MINIMUM_USD
  const statusLabel = normalized.status === CASE_STATUS.PENDING_REVIEW || normalized.status === CASE_STATUS.UNDER_REVIEW
    ? 'In Compliance Review'
    : components.risk.hasCritical || components.risk.hasHigh
      ? 'Blocked by Risk'
      : !allMandatoryDocumentsUploaded
        ? 'Missing Documents'
        : !components.aiExtraction.complete || !components.sow.complete
          ? 'Needs RM Review'
          : canSubmit
            ? 'Ready for Compliance'
            : 'Draft'
  const nextBestAction = getRmSubmissionStatusBlocker(normalized.status)
    || readinessGaps[0]
    || (canSubmit ? 'Submit for compliance review.' : 'Review case readiness.')

  return {
    percentage,
    completedItems: components.profile.completed + components.documents.completed + components.aiExtraction.completed + components.sow.completed + (components.risk.complete ? 1 : 0),
    totalItems: components.profile.total + components.documents.total + components.aiExtraction.total + components.sow.total + 1,
    statusLabel,
    canSubmit,
    submissionBlockers: [],
    readinessGaps,
    nextBestAction,
    components,
    profile: {
      ...components.profile,
    },
    documents: {
      ...components.documents,
      missing: completionSummary.missingRequiredDocuments.map((item) => item.label),
      needsReview: completionSummary.needsReviewDocuments.map((item) => item.label),
    },
    aiExtraction: components.aiExtraction,
    sourceOfWealth: components.sow,
    risk: {
      ...components.risk,
      aiAnalysisCompleted: hasFreshAiAnalysis(normalized),
      hasHighOrCriticalRisk: components.risk.hasCritical || components.risk.hasHigh,
      highPriorityFollowUps: getHighPriorityAiFollowUps(normalized).length,
      ruleAdjustedRisk: ruleRisk,
    },
    rules: snapshot ? {
      ruleSetVersion: snapshot.ruleSetVersion,
      evaluatedAt: snapshot.evaluatedAt,
      triggeredRuleCount: snapshot.triggeredRules?.length || 0,
      readinessPenalty,
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

  return CASE_STATUS.READY_FOR_REVIEW
}

function canTransitionStatus(previousStatus, nextStatus) {
  if (previousStatus === nextStatus) return true
  if (!ALLOWED_CASE_STATUSES.has(previousStatus) || !ALLOWED_CASE_STATUSES.has(nextStatus)) return false

  const allowed = {
    [CASE_STATUS.DRAFT]: new Set([CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.READY_FOR_REVIEW, CASE_STATUS.PENDING_REVIEW]),
    [CASE_STATUS.MISSING_DOCUMENTS]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.READY_FOR_REVIEW, CASE_STATUS.PENDING_REVIEW]),
    [CASE_STATUS.READY_FOR_REVIEW]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.PENDING_REVIEW]),
    [CASE_STATUS.PENDING_REVIEW]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.ACTION_REQUIRED]),
    [CASE_STATUS.UNDER_REVIEW]: new Set([CASE_STATUS.APPROVED, CASE_STATUS.ACTION_REQUIRED, CASE_STATUS.REJECTED, CASE_STATUS.ESCALATED, CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS]),
    [CASE_STATUS.APPROVED]: new Set([]),
    [CASE_STATUS.ACTION_REQUIRED]: new Set([CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.READY_FOR_REVIEW, CASE_STATUS.PENDING_REVIEW]),
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
    netWorthCurrency: formData.netWorthCurrency || 'USD',
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
        netWorthCurrency: formData.netWorthCurrency || 'USD',
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
      return caseFile ? await persistRuleSnapshot(caseFile, { triggeredBy: 'createCase' }) : null
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
        netWorthCurrency: formData.netWorthCurrency || existing.netWorthCurrency || 'USD',
        purpose: formData.purpose || existing.purpose,
      })

      const withDerivedStatus = applySystemDerivedStatus(merged, 'Profile updated')

      await updateFirebaseCaseFile(caseId, {
        clientName: withDerivedStatus.clientName,
        nationality: withDerivedStatus.nationality,
        residence: withDerivedStatus.residence,
        occupation: withDerivedStatus.occupation,
        netWorth: withDerivedStatus.netWorth,
        netWorthCurrency: withDerivedStatus.netWorthCurrency,
        purpose: withDerivedStatus.purpose,
        status: withDerivedStatus.status,
        statusHistory: withDerivedStatus.statusHistory,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      return updated ? await persistRuleSnapshot(updated, { triggeredBy: 'profile-save' }) : null
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
        netWorthCurrency: formData.netWorthCurrency || existing.netWorthCurrency || 'USD',
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
      return updated ? await persistRuleSnapshot(updated, { triggeredBy: 'updateCaseData' }) : null
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
      return updated ? await persistRuleSnapshot(updated, { triggeredBy: 'addDocument' }) : null
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
      return updated ? await persistRuleSnapshot(updated, { triggeredBy: 'removeDocument' }) : null
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
  const netWorthValue = getCaseNetWorthUsdValue(caseFile)
  return Boolean(caseFile.clientName) && netWorthValue >= NET_WORTH_MINIMUM_USD
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

      const statusBlocker = getRmSubmissionStatusBlocker(existing.status)
      if (statusBlocker) {
        return { ok: false, reason: statusBlocker }
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

      const statusBlocker = getRmSubmissionStatusBlocker(existing.status)
      if (statusBlocker) {
        return { ok: false, reason: statusBlocker }
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
