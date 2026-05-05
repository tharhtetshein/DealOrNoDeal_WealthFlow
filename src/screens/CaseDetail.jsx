import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCheck,
  CheckCircle2,
  Download,
  FileBadge2,
  FileText,
  Globe2,
  History,
  Loader2,
  PencilLine,
  ScanSearch,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react'
import {
  addDocumentToCase,
  CASE_STATUS,
  CLIENT_PROFILE_TYPE,
  getDocumentCompletionSummary,
  getDocumentTypeGroups,
  getActiveCaseId,
  getCaseFileById,
  getClientProfileType,
  calculateReadinessScore,
  getReadinessScore,
  hasFreshAiAnalysis,
  hasRequiredDocuments,
  hasRequiredFields,
  removeDocumentFromCase,
  rerunRuleEvaluation,
  submitCaseForCompliance,
  updateCaseData,
} from '../lib/caseFiles'
import { analyzeCaseDocuments, extractDocumentText } from '../lib/api'
import { hasFirebaseConfig, uploadCaseDocumentFile } from '../lib/firebase'
import { getActivePublishedRules } from '../lib/ruleStorage'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'sow-draft', label: 'SoW Draft' },
  { id: 'applied-rules', label: 'Applied Rules', complianceOnly: true },
  { id: 'risk-issues', label: 'Risk & Issues' },
  { id: 'audit-trail', label: 'Audit Trail' },
]

const RULE_DOCUMENT_UX_VERSION = 2

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value) {
  if (!value) return '--'
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrencyLikeNumber(value) {
  if (!value && value !== 0) return '--'
  const digits = String(value).replace(/[^\d.-]/g, '')
  if (!digits) return String(value)
  const numericValue = Number(digits)
  if (Number.isNaN(numericValue)) return String(value)
  return numericValue.toLocaleString('en-US')
}

function getStatusBadge(status) {
  switch (status) {
    case CASE_STATUS.DRAFT:
      return 'bg-surface-container-high text-on-surface-variant'
    case CASE_STATUS.MISSING_DOCUMENTS:
      return 'bg-error/10 text-error'
    case CASE_STATUS.READY_FOR_REVIEW:
      return 'bg-success/12 text-success'
    case CASE_STATUS.PENDING_REVIEW:
      return 'bg-warning/20 text-warning'
    case CASE_STATUS.UNDER_REVIEW:
      return 'bg-tertiary/12 text-tertiary'
    case CASE_STATUS.ACTION_REQUIRED:
      return 'bg-warning/15 text-warning'
    case CASE_STATUS.REJECTED:
      return 'bg-error/10 text-error'
    case CASE_STATUS.ESCALATED:
      return 'bg-error/20 text-error'
    case CASE_STATUS.APPROVED:
      return 'bg-success/15 text-success'
    default:
      return 'bg-surface-container text-on-surface-variant'
  }
}

function getStatusOwner(caseFile) {
  switch (caseFile?.status) {
    case CASE_STATUS.DRAFT:
    case CASE_STATUS.MISSING_DOCUMENTS:
    case CASE_STATUS.READY_FOR_REVIEW:
    case CASE_STATUS.ACTION_REQUIRED:
      return 'RM'
    case CASE_STATUS.PENDING_REVIEW:
      return 'Compliance Queue'
    case CASE_STATUS.UNDER_REVIEW:
      return caseFile?.assignedComplianceOfficer || 'Compliance Reviewer'
    case CASE_STATUS.ESCALATED:
      return caseFile?.seniorComplianceOwner || 'Senior Compliance'
    case CASE_STATUS.APPROVED:
    case CASE_STATUS.REJECTED:
      return 'Completed'
    default:
      return 'System'
  }
}

const STATUS_TIMELINE = [
  CASE_STATUS.DRAFT,
  CASE_STATUS.MISSING_DOCUMENTS,
  CASE_STATUS.READY_FOR_REVIEW,
  CASE_STATUS.PENDING_REVIEW,
  CASE_STATUS.UNDER_REVIEW,
  CASE_STATUS.APPROVED,
]

function getStatusTimelineIndex(status) {
  if (status === CASE_STATUS.REJECTED || status === CASE_STATUS.ESCALATED) return STATUS_TIMELINE.indexOf(CASE_STATUS.UNDER_REVIEW)
  if (status === CASE_STATUS.ACTION_REQUIRED) return STATUS_TIMELINE.indexOf(CASE_STATUS.MISSING_DOCUMENTS)
  const index = STATUS_TIMELINE.indexOf(status)
  return index >= 0 ? index : 0
}

function getProgressTone(score) {
  if (score >= 85) return 'bg-success'
  if (score >= 50) return 'bg-warning'
  return 'bg-error'
}

function getRiskTone(level) {
  if (level === 'High') return 'bg-error/10 text-error'
  if (level === 'Medium') return 'bg-warning/15 text-warning'
  return 'bg-success/15 text-success'
}

function getConfidenceTone(level) {
  if (level === 'High') return 'bg-success/12 text-success'
  if (level === 'Medium') return 'bg-warning/15 text-warning'
  return 'bg-error/10 text-error'
}

function getSeverityTone(level) {
  if (level === 'High') return 'bg-error/10 text-error'
  if (level === 'Medium') return 'bg-warning/15 text-warning'
  return 'bg-success/12 text-success'
}

function getDocumentNameByCategory(caseFile, category) {
  const match = (caseFile?.documents || []).find((document) => document.category === category)
  return match?.name || null
}

function normalizeUploadedCategory(category) {
  const legacyMap = {
    Passport: 'Passport / ID',
    'National ID': 'Passport / ID',
    'Utility Bill': 'Address Proof',
    'Utility Bill (<=3 months)': 'Address Proof',
    'Bank Statement with Address': 'Address Proof',
    'Government-Issued Address Letter': 'Address Proof',
    'Tax Residency Bill': 'Tax Residency',
    'Tax Residency Self-Certification': 'Tax Residency',
    'Tax Identification Number (TIN) Evidence': 'Tax Residency',
    'FATCA Declaration': 'Tax Residency',
    'Source of Wealth (SoW)': 'SoW Declaration',
    'Bank Statements': 'Bank Statements (Source of Funds)',
    'Recent Bank Statements (3-6 months)': 'Bank Statements (Source of Funds)',
    'Transfer / Liquidity Proof': 'Bank Statements (Source of Funds)',
  }
  return legacyMap[String(category || '').trim()] || String(category || '').trim()
}

function buildMockExtraction(caseFile) {
  const declaredOccupation = caseFile.occupation || 'Salaried'
  const detectedOccupation = declaredOccupation.toLowerCase().includes('founder') || declaredOccupation.toLowerCase().includes('director')
    ? declaredOccupation
    : 'Company Director'

  const mismatches = [
    {
      label: 'Occupation classification',
      declared: declaredOccupation || 'Salaried',
      detected: detectedOccupation,
      source: getDocumentNameByCategory(caseFile, 'Source of Wealth (SoW)') || getDocumentNameByCategory(caseFile, 'Bank Statements') || 'source_of_wealth.pdf',
    },
    {
      label: 'Countries involved',
      declared: caseFile.residence || 'Singapore',
      detected: `${caseFile.residence || 'Singapore'} / Hong Kong`,
      source: getDocumentNameByCategory(caseFile, 'Bank Statements') || getDocumentNameByCategory(caseFile, 'Utility Bill') || 'bank_statement.pdf',
    },
  ].filter((item) => {
    const declared = String(item.declared || '').trim().toLowerCase()
    const detected = String(item.detected || '').trim().toLowerCase()
    return declared !== detected
  })

  return {
    occupation: detectedOccupation,
    employer: caseFile.occupation?.toLowerCase().includes('business') ? 'Sterling Global Holdings' : 'Private Investment Office',
    ownershipPercentage: caseFile.netWorth && Number(String(caseFile.netWorth).replace(/,/g, '')) > 10000000 ? '67%' : '42%',
    countriesInvolved: [caseFile.residence || 'Singapore', caseFile.nationality || 'United Kingdom', 'Hong Kong'],
    mismatches,
  }
}

function buildSowDraft(caseFile) {
  const clientName = caseFile.clientName || 'Client'
  const occupation = caseFile.occupation || 'private investor'
  const residence = caseFile.residence || 'Singapore'
  const netWorth = caseFile.netWorth || 'Undisclosed'

  return {
    primarySource: `Primary wealth accumulation appears to be derived from ${occupation.toLowerCase()} income and long-term asset appreciation.`,
    supportingEvidence: `Supporting evidence includes identity documentation, banking records, utility proof, and source-of-wealth materials linked to ${clientName}.`,
    narrativeSummary: `${clientName} is presented as a ${occupation.toLowerCase()} based in ${residence}. Current onboarding materials support a declared net worth of ${netWorth} and indicate a broadly traceable source of funds with additional verification needed for final compliance handoff.`,
    confidence: hasRequiredDocuments(caseFile) ? 'High' : 'Medium',
  }
}

function buildRiskFlags(caseFile, missingCategories, extraction) {
  const flags = []

  if (missingCategories.length > 0) {
    flags.push({
      title: 'Missing required documents',
      description: `Outstanding categories: ${missingCategories.join(', ')}.`,
      nextAction: 'Obtain and upload all required documents before submission.',
      severity: 'High',
    })
  }

  if (extraction.mismatches.length > 0) {
    flags.push({
      title: 'Detected data inconsistency',
      description: `${extraction.mismatches[0].label}: declared "${extraction.mismatches[0].declared}" versus detected "${extraction.mismatches[0].detected}".`,
      nextAction: 'Review extracted data and confirm the final client disclosure.',
      severity: 'Medium',
    })
  }

  if ((caseFile.nationality || '').toLowerCase().includes('united states')) {
    flags.push({
      title: 'High-attention geography',
      description: 'Cross-border onboarding may require additional tax residency and reporting checks.',
      nextAction: 'Validate CRS/FATCA documentation before handoff.',
      severity: 'Medium',
    })
  }

  return flags
}

function assessAnalysisConfidence(missingCategories = [], mismatches = [], riskFlags = []) {
  const missingKeyEvidence = [
    'Identity Verification (KYC)',
    'Source of Wealth (SoW)',
    'Source of Wealth Supporting Documents',
    'Source of Funds (SoF)',
  ]
    .some((category) => missingCategories.includes(category))
  const hasHighSeverityRisk = riskFlags.some((risk) => risk.severity === 'High')
  const hasMajorMismatch = mismatches.length > 1
    || mismatches.some((item) => /income|ownership|country|countries/i.test(item.label || ''))

  if (missingKeyEvidence || hasHighSeverityRisk || hasMajorMismatch) {
    return {
      level: 'Low',
      message: missingKeyEvidence
        ? 'Key supporting documents are missing, so the extracted data is not yet fully reliable.'
        : 'Some inconsistencies detected in supporting documents require closer review.',
    }
  }

  if (mismatches.length > 0 || missingCategories.length > 0 || riskFlags.length > 0) {
    return {
      level: 'Medium',
      message: mismatches.length > 0
        ? 'Data is mostly consistent with minor discrepancies.'
        : 'Supporting evidence is mostly complete but still needs follow-up review.',
    }
  }

  return {
    level: 'High',
    message: 'Data is consistent across submitted documents with strong supporting evidence.',
  }
}

function getMismatchPenalty(mismatches = []) {
  return mismatches.reduce((total, mismatch) => {
    const severity = String(mismatch.severity || '').toLowerCase()
    const label = String(mismatch.label || '').toLowerCase()

    if (severity === 'high') return total + 18
    if (severity === 'medium') return total + 10
    if (severity === 'low') return total + 5
    if (/net.?worth|income|ownership|source.?of.?wealth|country|countries|residence/i.test(label)) {
      return total + 12
    }
    return total + 8
  }, 0)
}

function deriveRiskLevel({ missingCategories = [], mismatches = [], riskFlags = [], readiness = 0 }) {
  const hasHighRiskFlag = riskFlags.some((risk) => String(risk.severity || '').toLowerCase() === 'high')
  const hasHighMismatch = mismatches.some((mismatch) => String(mismatch.severity || '').toLowerCase() === 'high')
  const mismatchPenalty = getMismatchPenalty(mismatches)

  if (hasHighRiskFlag || hasHighMismatch || mismatchPenalty >= 20 || readiness < 60) {
    return 'High'
  }

  if (missingCategories.length > 0 || mismatches.length > 0 || riskFlags.length > 0 || readiness < 85) {
    return 'Medium'
  }

  return 'Low'
}

function formatAnalysisFieldValue(value) {
  return formatAiText(value, '--')
}

function formatAiText(value, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const text = value.map((item) => formatAiText(item, '')).filter(Boolean).join(', ')
    return text || fallback
  }
  if (typeof value === 'object') {
    const candidate = value.action
      || value.recommendation
      || value.nextAction
      || value.description
      || value.issue
      || value.title
      || value.rationale
    if (candidate) return formatAiText(candidate, fallback)
    return JSON.stringify(value)
  }
  return fallback
}

function makeStableKey(value, fallback) {
  return formatAiText(value, fallback).replace(/\s+/g, '-').toLowerCase()
}

function shouldShowExtractedField(fieldKey, profileType) {
  if (fieldKey === 'ownershipPercentage') {
    return profileType === CLIENT_PROFILE_TYPE.BUSINESS_OWNER
  }
  return true
}

const DECLARED_CASE_FIELD_KEYS = new Set([
  'name',
  'clientname',
  'occupation',
  'nationality',
  'residence',
  'countryofresidence',
  'networth',
  'purpose',
])

const EXTRACTED_EVIDENCE_LABELS = {
  sourceofwealth: 'Source of Wealth indicators',
  sourceofwealthindicators: 'Source of Wealth indicators',
  sourceoffunds: 'Source of Funds indicators',
  incomeindicators: 'Income indicators',
}

function normalizeFieldKey(value) {
  return formatAiText(value, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isUndeclaredValue(value) {
  const normalized = formatAiText(value, '').trim().toLowerCase()
  return !normalized || normalized === '--' || normalized === 'not declared' || normalized === 'not provided' || normalized === 'n/a'
}

function prettifyFieldLabel(value) {
  return formatAiText(value, 'Evidence')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getConfidenceRank(level) {
  const normalized = formatAiText(level, '').toLowerCase()
  if (normalized.includes('high')) return 3
  if (normalized.includes('medium')) return 2
  if (normalized.includes('low')) return 1
  return 0
}

function normalizeConfidence(value, fallback = 'Low') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const items = Object.entries(value).map(([key, rawValue]) => {
      const text = formatAiText(rawValue, 'Low')
      const match = text.match(/\b(high|medium|low)\b/i)
      const level = match ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() : 'Low'
      const detail = text.replace(/\b(high|medium|low)\b\s*[:,-]?\s*/i, '').trim()

      return {
        label: prettifyFieldLabel(key),
        level,
        detail,
      }
    })
    const ranks = items.map((item) => getConfidenceRank(item.level)).filter(Boolean)
    const lowestRank = ranks.length > 0 ? Math.min(...ranks) : getConfidenceRank(fallback)
    const overall = lowestRank >= 3 ? 'High' : lowestRank === 2 ? 'Medium' : 'Low'

    return {
      level: overall,
      items,
    }
  }

  const text = formatAiText(value, fallback)
  const match = text.match(/\b(high|medium|low)\b/i)
  const level = match ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() : formatAiText(fallback, 'Low')
  return {
    level,
    items: [],
  }
}

function getActionPriority(actionText) {
  const text = formatAiText(actionText, '').toLowerCase()

  if (/\b(low[- ]risk status|record .*low[- ]risk|retain .*regular review|regular review due to high net worth|periodic|annual monitoring|ongoing consistency|document .*findings|retain .*supporting evidence)\b/.test(text)) {
    return 'Medium'
  }

  if (/\b(sanctions? hit|pep match|positive match|adverse media|fraud|cannot be verified|unverified source of wealth|escalat|critical|blocker)\b/.test(text)
    || /\b(high|must|mandatory|required|missing)\b/.test(text) && !/\bhigh net worth\b/.test(text)) {
    return 'High'
  }

  if (/\b(request|obtain|collect|provide|upload|verify|validate|confirm|document|statement|report|grant|vesting|dividend|net.?worth|source.?of.?funds|evidence)\b/.test(text)) {
    return 'Medium'
  }
  return 'Low'
}

function getPriorityTone(priority) {
  if (priority === 'High') return 'bg-error/10 text-error'
  if (priority === 'Medium') return 'bg-warning/15 text-warning'
  return 'bg-surface-container text-on-surface-variant'
}

function getUploadTypeForAction(actionText) {
  const text = formatAiText(actionText, '').toLowerCase()
  if (!/\b(request|obtain|collect|provide|upload|statement|report|letter|schedule|document|evidence|run|perform|screening|monitoring|implement)\b/.test(text)) {
    return null
  }
  if (/sanctions?|pep|adverse media|screening/.test(text)) return 'Full Sanctions, PEP, and Adverse Media Screening'
  if (/ongoing monitoring|periodic review|monitoring|ownership structure/.test(text)) return 'Enhanced Ongoing Monitoring Plan'
  if (/enhanced due.?diligence|\bedd\b|cross-border employment/.test(text)) return 'Enhanced Due Diligence Screening'
  if (/singapore.*tax|iras|dual tax residency|tax residency certificate|tax residency documentation|residency letter/.test(text)) return 'Singapore Tax Residency Evidence'
  if (/w-?9|fatca|self.?certification|us person.*tax/.test(text)) return 'W-9 / FATCA Documentation'
  if (/form 1040|us individual tax return|taxable income/.test(text)) return 'US Tax Return / Form 1040'
  if (/share.?sale|cash proceeds|transaction confirmation|secondary share/.test(text)) return 'Certified Share-Sale Proceeds Confirmation'
  if (/address|utility/.test(text)) return 'Address Proof'
  if (/employment contract/.test(text)) return 'Employment Contract'
  if (/payslip|salary/.test(text)) return 'Payslips'
  if (/rsu|restricted stock|stock compensation|equity|grant|vesting|brokerage|investment portfolio|portfolio growth/.test(text)) return 'RSU / Portfolio Growth Support'
  if (/dividend/.test(text)) return 'Dividend Statements'
  if (/net.?worth|wealth statement|asset.?valuation/.test(text)) return 'Net Worth / Asset Valuation'
  if (/source.?of.?funds|sof|bank|liquidity|balance/.test(text)) return 'Source of Funds Supporting Documents'
  return 'Additional Supporting Evidence'
}

const EVIDENCE_CATEGORY_DEFINITIONS = {
  singapore_tax_residency: {
    label: 'Singapore Tax Residency Evidence',
    uploadType: 'Singapore Tax Residency Evidence',
    match: /\b(singapore.*tax|iras|tax residency certificate|tax residency documentation|tax residency letter|dual tax residency|residency certificate|residency notice)\b/i,
  },
  fatca_documentation: {
    label: 'W-9 / FATCA Documentation',
    uploadType: 'W-9 / FATCA Documentation',
    match: /\b(w-?9|fatca|self.?certification|specified us person|us person.*tax|taxpayer identification number|tin provided)\b/i,
  },
  rsu_portfolio_support: {
    label: 'RSU / Portfolio Growth Support',
    uploadType: 'RSU / Portfolio Growth Support',
    match: /\b(rsu|restricted stock|stock compensation|stock plan|vesting|vested|grant|brokerage|investment portfolio|portfolio growth|listed securities|equity compensation)\b/i,
  },
  brokerage_statement: {
    label: 'Brokerage / Investment Statement',
    uploadType: 'Brokerage / Investment Statement',
    match: /\b(brokerage statement|investment statement|portfolio statement|securities account)\b/i,
  },
  bank_statement: {
    label: 'Bank Statement Evidence',
    uploadType: 'Bank Statements (Source of Funds)',
    match: /\b(bank statement|source of funds|sof|salary transfer|bonus transfer|cash balance|liquidity)\b/i,
  },
  source_of_wealth: {
    label: 'Source Of Wealth Evidence',
    uploadType: 'Source of Wealth Supporting Documents',
    match: /\b(source of wealth|sow|wealth verification|net worth|net-worth|asset statement|asset valuation|asset breakdown|property deed|financial statement|conversion rationale|conversion methodology|currency conversion|single currency)\b/i,
  },
  employment_income: {
    label: 'Employment Income Evidence',
    uploadType: 'Employment Evidence',
    match: /\b(employment|employer|salary|payslip|bonus|income letter|employment contract)\b/i,
  },
  company_ownership: {
    label: 'Company Ownership Evidence',
    uploadType: 'Business Registry Extract',
    match: /\b(company ownership|shareholding|business registry|company registration|employer registration|registry extract)\b/i,
  },
  dividend_income: {
    label: 'Dividend Income Evidence',
    uploadType: 'Dividend Statements',
    match: /\b(dividend|distribution)\b/i,
  },
  address_proof: {
    label: 'Address Proof',
    uploadType: 'Address Proof',
    match: /\b(address proof|residential proof|residence proof|utility bill|lease|driver.?s licence|driver.?s license)\b/i,
  },
  identity_document: {
    label: 'Identity Document',
    uploadType: 'Passport / ID',
    match: /\b(passport|identity document|id document|national id)\b/i,
  },
}

function getEvidenceCategoryForText(value) {
  const text = formatAiText(value, '').toLowerCase()
  if (!text) return null

  if (/\b(form 1040|us individual tax return|w-?2|us tax return)\b/.test(text)) return 'us_tax_return'
  if (/\b(w-?9|fatca|self.?certification|specified us person|us person.*tax|taxpayer identification number|tin provided)\b/.test(text)) return 'fatca_documentation'
  if (/\b(singapore.*tax|iras|dual tax residency|tax residency certificate|tax residency documentation|tax residency letter|residency notice)\b/.test(text)) return 'singapore_tax_residency'
  if (/\b(rsu|restricted stock|stock compensation|stock plan|vesting|vested|grant)\b/.test(text)) return 'rsu_portfolio_support'
  if (/\b(portfolio growth|brokerage|investment portfolio|portfolio statement|listed securities)\b/.test(text)) return 'rsu_portfolio_support'
  if (/\b(bank statement|source of funds|sof|salary transfer|bonus transfer|cash balance|liquidity)\b/.test(text)) return 'bank_statement'
  if (/\b(sanctions?|pep|adverse media|screening)\b/.test(text)) return 'screening'
  if (/\b(enhanced due.?diligence|\bedd\b|sector concentration|high net worth us person)\b/.test(text)) return 'enhanced_due_diligence'
  if (/\b(ongoing transaction monitoring|transaction monitoring|periodic review|annual review|ongoing monitoring|review of source-of-wealth|tax residency status)\b/.test(text)) return 'ongoing_monitoring'
  if (/\b(source of wealth|sow|wealth verification|net worth|net-worth|asset statement|asset valuation|asset breakdown|property deed|financial statement|conversion rationale|conversion methodology|currency conversion|single currency)\b/.test(text)) return 'source_of_wealth'
  if (/\b(employment|employer|salary|payslip|bonus|income letter|employment contract)\b/.test(text)) return 'employment_income'
  if (/\b(company ownership|shareholding|business registry|company registration|employer registration|registry extract)\b/.test(text)) return 'company_ownership'
  if (/\b(dividend|distribution)\b/.test(text)) return 'dividend_income'
  if (/\b(address proof|residential proof|residence proof|utility bill|lease|driver.?s licence|driver.?s license)\b/.test(text)) return 'address_proof'
  if (/\b(passport|identity document|id document|national id)\b/.test(text)) return 'identity_document'
  return null
}

function getEvidenceDefinition(category, fallbackText = '') {
  if (category === 'us_tax_return') {
    return { label: 'US Tax Return / Form 1040', uploadType: 'US Tax Return / Form 1040' }
  }
  if (category === 'fatca_documentation') {
    return { label: 'W-9 / FATCA Documentation', uploadType: 'W-9 / FATCA Documentation' }
  }
  if (category === 'screening') {
    return { label: 'Screening Evidence', uploadType: 'Full Sanctions, PEP, and Adverse Media Screening' }
  }
  if (category === 'enhanced_due_diligence') {
    return { label: 'Enhanced Due Diligence Evidence', uploadType: 'Enhanced Due Diligence Screening' }
  }
  if (category === 'ongoing_monitoring') {
    return { label: 'Ongoing Monitoring Plan', uploadType: 'Enhanced Ongoing Monitoring Plan' }
  }
  return EVIDENCE_CATEGORY_DEFINITIONS[category]
    || { label: formatAiText(fallbackText, 'Additional Supporting Evidence'), uploadType: getUploadTypeForAction(fallbackText) || 'Additional Supporting Evidence' }
}

function getUploadedEvidenceForCategory(caseFile, evidenceCategory) {
  if (!evidenceCategory) return []
  const matches = (caseFile?.documents || []).filter((document) => {
    const haystack = [
      document.evidenceCategory,
      document.category,
      document.name,
      document.suggestedActionText,
      document.extractedText,
    ].join(' ')
    return document.evidenceCategory === evidenceCategory || getEvidenceCategoryForText(haystack) === evidenceCategory
  })
  return Array.from(new Map(matches.map((document) => [
    String(document.id || document.name || document.category || '').toLowerCase(),
    document,
  ])).values())
}

function getUniqueEvidenceFileNames(documents = []) {
  return Array.from(new Set(
    documents
      .map((document) => document.name || document.category || 'uploaded evidence')
      .filter(Boolean),
  ))
}

function getFriendlyAiErrorMessage(error) {
  const message = String(error?.message || '')
  if (/temporarily unavailable|daily AI token limit|rate limit|tokens per day|tokens per minute|429|try again/i.test(message)) {
    const retryMatch = message.match(/about\s+(\d+)\s+minute/i) || message.match(/try again in\s+(\d+)m/i)
    return retryMatch
      ? `AI analysis is temporarily unavailable. Try again in about ${retryMatch[1]} minute(s).`
      : 'AI analysis is temporarily unavailable because the daily AI token limit was reached. Please try again later.'
  }

  if (/groq|organization|service tier|billing|api key|openai\/gpt/i.test(message)) {
    return 'AI analysis is temporarily unavailable. Please try again later.'
  }

  return message || 'AI analysis failed. Check that the backend is running and try again.'
}

function escapeHtml(value) {
  return formatAiText(value, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildNormalizedSuggestedActions(suggestions = [], caseFile) {
  const priorityRank = { High: 3, Medium: 2, Low: 1 }
  const grouped = new Map()

  suggestions.forEach((suggestion, index) => {
    const text = formatAiText(suggestion, '').trim()
    if (!text) return
    const priority = getActionPriority(text)
    if (priority === 'Low') return
    const evidenceCategory = getEvidenceCategoryForText(text) || `action_${buildSuggestedActionId(text, index, 'category')}`
    const definition = getEvidenceDefinition(evidenceCategory, text)
    const existing = grouped.get(evidenceCategory)
    const candidate = {
      text,
      priority,
      uploadType: definition.uploadType || getUploadTypeForAction(text),
      evidenceCategory,
      relatedSuggestions: [text],
    }

    if (!existing) {
      grouped.set(evidenceCategory, candidate)
      return
    }

    existing.relatedSuggestions.push(text)
    if ((priorityRank[priority] || 0) > (priorityRank[existing.priority] || 0)) {
      existing.priority = priority
    }
    if (text.length < existing.text.length || /\b(obtain|request|collect|provide|confirm|clarify)\b/i.test(text)) {
      existing.text = text
    }
  })

  return Array.from(grouped.values()).map((action) => {
    const definition = getEvidenceDefinition(action.evidenceCategory, action.text)
    const coveredDocuments = getUploadedEvidenceForCategory(caseFile, action.evidenceCategory)
    return {
      ...action,
      title: definition.label || action.text,
      uploadType: definition.uploadType || action.uploadType,
      suggestedActionId: `suggestion_${action.evidenceCategory}`,
      coveredDocuments,
      uploadedCount: coveredDocuments.length,
      evidenceLabel: coveredDocuments.length > 0 ? 'Covered by uploaded evidence' : action.priority === 'High' ? 'Evidence needed' : 'Recommended',
    }
  })
}

function buildSuggestedActionId(actionText, index = 0, prefix = 'suggestion') {
  const source = formatAiText(actionText, '').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i)
    hash |= 0
  }
  return `${prefix}_${index + 1}_${Math.abs(hash).toString(36)}`
}

function getRuleVersionSignature(items = []) {
  return [...items]
    .map((item) => `${item.id}:v${item.version || 1}`)
    .sort()
    .join('|')
}

function shouldAutoRunRulesForCase(caseFile) {
  if (!caseFile?.id) return false
  const latestSnapshot = caseFile._lastRuleSnapshot
    || (Array.isArray(caseFile.ruleSnapshots) ? caseFile.ruleSnapshots[caseFile.ruleSnapshots.length - 1] : null)
  const activeRules = getActivePublishedRules()
  if (activeRules.length === 0) return false
  if (!latestSnapshot) return true
  if (latestSnapshot.ruleDocumentUxVersion !== RULE_DOCUMENT_UX_VERSION) return true

  const activeSignature = getRuleVersionSignature(activeRules)
  const snapshotSignature = getRuleVersionSignature(latestSnapshot.activeRuleVersions || [])
  return activeSignature !== snapshotSignature
}

function getUploadedEvidenceCount(caseFile, uploadType, suggestedActionId = null) {
  if (suggestedActionId) {
    return (caseFile?.documents || []).filter((document) => (
      document.uploadedForSuggestion === true
      && document.suggestedActionId === suggestedActionId
    )).length
  }

  if (!uploadType) return 0
  const target = normalizeUploadedCategory(uploadType).toLowerCase()
  const targetMatchers = [
    target,
    ...(
      /sanctions?|pep|adverse media|screening/.test(target)
        ? ['sanctions', 'pep', 'adverse media', 'screening']
        : []
    ),
    ...(
      /monitoring|periodic review/.test(target)
        ? ['monitoring', 'periodic review']
        : []
    ),
    ...(
      /share.?sale|cash proceeds|transaction/.test(target)
        ? ['share-sale', 'share sale', 'cash proceeds', 'transaction confirmation', 'secondary share']
        : []
    ),
  ]
  return (caseFile?.documents || []).filter((document) => (
    normalizeUploadedCategory(document.category).toLowerCase() === target
    || targetMatchers.some((matcher) => {
      const haystack = `${document.category || ''} ${document.name || ''} ${document.extractedText || ''}`.toLowerCase()
      return matcher && haystack.includes(matcher)
    })
  )).length
}

function isUsefulMissingEvidence(item) {
  const document = formatAiText(item.document, '').trim().toLowerCase()
  const issue = formatAiText(item.issue, '').trim().toLowerCase()
  const reason = formatAiText(item.reason, '').trim()
  const isGeneric = (!document || document === 'supporting evidence')
    && (!issue || issue === 'insufficient evidence')
    && !reason

  return !isGeneric
}

function normalizeAiAnalysisPayload(payload = {}, fallback = {}) {
  const extractedData = payload.extractedData || {}
  const profileType = fallback.profileType || CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE
  const extractedFields = [
    ['name', 'Name'],
    ['occupation', 'Occupation'],
    ['employerOrBusiness', 'Employer / Business Name'],
    ['sourceOfWealthIndicators', 'Source of Wealth indicators'],
    ['ownershipPercentage', 'Ownership Percentage'],
    ['incomeIndicators', 'Income indicators'],
    ['countriesInvolved', 'Countries Involved'],
    ['keyDatesAndAmounts', 'Key dates and amounts'],
  ].filter(([key]) => shouldShowExtractedField(key, profileType))
    .map(([key, label]) => {
    const field = extractedData[key]
    if (!field) return null

    const rawValue = typeof field === 'object' && field !== null && !Array.isArray(field)
      ? field.value
      : field
    const source = typeof field === 'object' && field !== null && !Array.isArray(field)
      ? field.sourceDocument
      : null

    return {
      label,
      value: formatAnalysisFieldValue(rawValue),
      source: formatAiText(source, '--'),
    }
  }).filter(Boolean)

  const evidenceFromMismatches = []
  const mismatches = (payload.mismatches || []).map((item, index) => {
    const fieldKey = normalizeFieldKey(item.field || item.label)
    const declared = formatAiText(item.declaredValue || item.declared, 'Not declared')
    const detected = formatAiText(item.detectedValue || item.detected, 'Not detected')
    const source = formatAiText(item.sourceDocument || item.source, '--')

    if (!DECLARED_CASE_FIELD_KEYS.has(fieldKey) || isUndeclaredValue(declared)) {
      evidenceFromMismatches.push({
        label: EXTRACTED_EVIDENCE_LABELS[fieldKey] || formatAiText(item.field || item.label, 'Document finding'),
        value: detected,
        source,
      })
      return null
    }

    return {
      id: item.id || `${makeStableKey(item.field || item.label, 'mismatch')}-${index}`,
      label: formatAiText(item.field || item.label, 'Detected mismatch'),
      declared,
      detected,
      issue: formatAiText(item.issue, ''),
      source,
      severity: formatAiText(item.severity, 'Medium'),
    }
  }).filter(Boolean)

  const risks = (payload.riskFlags || payload.risks || fallback.risks || []).map((risk, index) => ({
    id: risk.id || `risk-${index}`,
    title: formatAiText(risk.title, 'Risk flag'),
    severity: formatAiText(risk.severity, 'Medium'),
    description: formatAiText(risk.description || risk.rationale, ''),
    rationale: formatAiText(risk.rationale || risk.description, ''),
    nextAction: formatAiText(risk.nextAction, ''),
  }))
  const missingSupportingEvidence = (payload.missingOrInsufficientDocuments || []).map((item, index) => ({
    id: item.id || `missing-evidence-${index}`,
    document: formatAiText(item.document || item.name, 'Supporting evidence'),
    issue: formatAiText(item.issue, 'Insufficient evidence'),
    reason: formatAiText(item.reason, ''),
  })).filter(isUsefulMissingEvidence)

  const fallbackAssessment = assessAnalysisConfidence(
    fallback.missingCategories || [],
    mismatches,
    risks,
  )

  const rawConfidence = payload.confidence
    || payload.sourceOfWealthDraft?.confidence
    || fallbackAssessment.level
  const confidence = normalizeConfidence(rawConfidence, fallbackAssessment.level)
  const sourceOfWealthDraft = payload.sourceOfWealthDraft
    ? {
      primarySourceOfWealth: formatAiText(payload.sourceOfWealthDraft.primarySourceOfWealth, ''),
      supportingEvidence: formatAiText(payload.sourceOfWealthDraft.supportingEvidence, ''),
      narrativeExplanation: formatAiText(payload.sourceOfWealthDraft.narrativeExplanation, ''),
      confidence: normalizeConfidence(payload.sourceOfWealthDraft.confidence, confidence.level).level,
    }
    : null

  return {
    extractedFields: [...extractedFields, ...evidenceFromMismatches],
    mismatches,
    risks,
    missingSupportingEvidence,
    suggestions: (payload.suggestedActions || payload.recommendations || fallback.suggestions || [])
      .map((suggestion) => formatAiText(suggestion, 'Review case before submission')),
    confidence: confidence.level,
    confidenceItems: confidence.items,
    confidenceExplanation: formatAiText(payload.confidenceExplanation, fallbackAssessment.message),
    updatedAt: payload.updatedAt || fallback.updatedAt || null,
    beforeReadiness: payload.beforeReadiness ?? fallback.beforeReadiness ?? 0,
    afterReadiness: payload.afterReadiness ?? fallback.afterReadiness ?? 0,
    sourceOfWealthDraft,
  }
}

function buildAuditEntries(caseFile) {
  const statusHistory = Array.isArray(caseFile?.statusHistory) ? caseFile.statusHistory : []
  const statusEntries = statusHistory.map((entry) => ({
    timestampRaw: entry.timestamp,
    timestamp: formatDateTime(entry.timestamp),
    actor: entry.actor || 'System',
    action: entry.from
      ? `Status changed from ${entry.from} to ${entry.to}.${entry.reason ? ` ${entry.reason}` : ''}`
      : `Status initialized to ${entry.to}.${entry.reason ? ` ${entry.reason}` : ''}`,
  }))

  const documentEntries = (caseFile?.documents || [])
    .filter((document) => document.uploadedAt)
    .map((document) => ({
      timestampRaw: document.uploadedAt,
      timestamp: formatDateTime(document.uploadedAt),
      actor: 'RM',
      action: `Uploaded ${document.name || 'document'} as ${normalizeUploadedCategory(document.category) || 'supporting evidence'}.`,
    }))

  const analysisEntry = caseFile?.aiAnalysis?.updatedAt
    ? [{
      timestampRaw: caseFile.aiAnalysis.updatedAt,
      timestamp: formatDateTime(caseFile.aiAnalysis.updatedAt),
      actor: 'AI Analysis',
      action: 'Completed document analysis and refreshed extracted insights.',
    }]
    : []

  const submissionEntry = caseFile?.submittedAt
    ? [{
      timestampRaw: caseFile.submittedAt,
      timestamp: formatDateTime(caseFile.submittedAt),
      actor: 'RM',
      action: 'Submitted case for compliance review.',
    }]
    : []

  const ruleEntries = (caseFile?.ruleSnapshots || []).map((snapshot) => ({
    timestampRaw: snapshot.evaluatedAt,
    timestamp: formatDateTime(snapshot.evaluatedAt),
    actor: 'Rule Engine',
    action: `Evaluated ${snapshot.activeRuleVersions?.length || 0} active rule(s); ${snapshot.triggeredRules?.length || 0} triggered. Rule set ${snapshot.ruleSetVersion}.`,
  }))

  const ruleSnapshots = Array.isArray(caseFile?.ruleSnapshots) ? caseFile.ruleSnapshots : []
  const sortedRuleSnapshots = [...ruleSnapshots].sort((a, b) => Date.parse(a.evaluatedAt || '') - Date.parse(b.evaluatedAt || ''))
  const resolvedBlockerEntries = sortedRuleSnapshots.flatMap((snapshot, index) => {
    const previous = sortedRuleSnapshots[index - 1]
    if (!previous) return []
    const previousBlockers = previous.aggregatedActions?.blockers || []
    const currentBlockers = snapshot.aggregatedActions?.blockers || []
    if (previousBlockers.length === 0 || currentBlockers.length > 0) return []
    return [{
      timestampRaw: snapshot.evaluatedAt,
      timestamp: formatDateTime(snapshot.evaluatedAt),
      actor: 'Rule Engine',
      action: 'Resolved rule-created submission blockers.',
    }]
  })

  const ruleDetailEntries = ruleSnapshots.flatMap((snapshot) => {
    const triggeredEntries = (snapshot.triggeredRules || []).map((rule) => ({
      timestampRaw: snapshot.evaluatedAt,
      timestamp: formatDateTime(snapshot.evaluatedAt),
      actor: 'Rule Engine',
      action: `Triggered ${rule.ruleName || rule.ruleId}${rule.policyReference ? ` (${rule.policyReference})` : ''}.`,
    }))
    const requiredDocEntries = (snapshot.aggregatedActions?.requiredDocuments || []).map((document) => ({
      timestampRaw: snapshot.evaluatedAt,
      timestamp: formatDateTime(snapshot.evaluatedAt),
      actor: 'Rule Engine',
      action: `Added rule-required document: ${document.target || document.label || 'supporting evidence'}.`,
    }))
    const blockerEntries = (snapshot.aggregatedActions?.blockers || []).map((blocker) => ({
      timestampRaw: snapshot.evaluatedAt,
      timestamp: formatDateTime(snapshot.evaluatedAt),
      actor: 'Rule Engine',
      action: `Created submission blocker: ${blocker.reason || 'Rule conditions must be resolved.'}`,
    }))
    const riskEntry = snapshot.computedMetrics?.baselineRisk !== snapshot.computedMetrics?.finalRiskLevel
      ? [{
        timestampRaw: snapshot.evaluatedAt,
        timestamp: formatDateTime(snapshot.evaluatedAt),
        actor: 'Rule Engine',
        action: `Risk level changed from ${snapshot.computedMetrics?.baselineRisk} to ${snapshot.computedMetrics?.finalRiskLevel}.`,
      }]
      : []
    const readinessEntry = snapshot.computedMetrics?.readinessPenalty > 0
      ? [{
        timestampRaw: snapshot.evaluatedAt,
        timestamp: formatDateTime(snapshot.evaluatedAt),
        actor: 'Rule Engine',
        action: `Readiness adjusted by rule penalty of ${snapshot.computedMetrics.readinessPenalty} point(s).`,
      }]
      : []

    return [...triggeredEntries, ...requiredDocEntries, ...blockerEntries, ...riskEntry, ...readinessEntry]
  })

  const ruleDocumentUploadEntries = (caseFile?.documents || [])
    .filter((document) => document.uploadedAt && document.uploadedForRuleRequirement)
    .map((document) => ({
      timestampRaw: document.uploadedAt,
      timestamp: formatDateTime(document.uploadedAt),
      actor: 'RM',
      action: `Uploaded rule-required document ${normalizeUploadedCategory(document.category) || document.name}.`,
    }))

  return [...statusEntries, ...documentEntries, ...ruleDocumentUploadEntries, ...analysisEntry, ...submissionEntry, ...ruleEntries, ...ruleDetailEntries, ...resolvedBlockerEntries]
    .filter((entry) => entry.timestampRaw)
    .sort((a, b) => Date.parse(b.timestampRaw || '') - Date.parse(a.timestampRaw || ''))
}

function SectionCard({ title, description, icon: Icon, children, action }) {
  return (
    <section className="rounded-[30px] border border-outline/10 bg-surface-container-lowest/95 shadow-ambient p-6 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10">
              <Icon className="w-5 h-5" />
            </div>
          ) : null}
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-on-surface">{title}</h2>
            {description ? <p className="text-sm text-on-surface-variant mt-1">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function CaseDetail({ onNavigate, role = 'ops' }) {
  const [caseFile, setCaseFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [uploadTargetType, setUploadTargetType] = useState('')
  const [uploadSuggestionContext, setUploadSuggestionContext] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sowDraftText, setSowDraftText] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState('not-run')
  const [analysisUpdatedAt, setAnalysisUpdatedAt] = useState(null)
  const [analysisSnapshot, setAnalysisSnapshot] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(false)
  const [readinessSummary, setReadinessSummary] = useState(null)
  const documentInputRef = useRef(null)
  const uploadSuggestionContextRef = useRef(null)
  const autoRuleRunCaseRef = useRef(null)

  const requiredDocumentGroups = useMemo(() => getDocumentTypeGroups(caseFile), [caseFile?.occupation, caseFile?.id])
  const requiredDocumentOptions = useMemo(
    () => requiredDocumentGroups.flatMap((group) => group.options),
    [requiredDocumentGroups],
  )
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => role !== 'rm' || !tab.complianceOnly),
    [role],
  )

  useEffect(() => {
    if (role === 'rm' && activeTab === 'applied-rules') {
      setActiveTab('overview')
    }
  }, [role, activeTab])

  const handleCopyCaseId = async () => {
    if (!caseFile?.id || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(caseFile.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const refreshCase = async () => {
    const caseId = getActiveCaseId()
    const activeCase = caseId ? await getCaseFileById(caseId) : null
    const nextReadinessSummary = activeCase?.id ? await getReadinessScore(activeCase.id) : null
    setCaseFile(activeCase)
    setReadinessSummary(nextReadinessSummary)
    setLoading(false)
    return activeCase
  }

  useEffect(() => {
    let isMounted = true

    const loadCase = async () => {
      let activeCase = await refreshCase()
      if (!isMounted) return

      if (activeCase?.id && autoRuleRunCaseRef.current !== activeCase.id && shouldAutoRunRulesForCase(activeCase)) {
        autoRuleRunCaseRef.current = activeCase.id
        const result = await rerunRuleEvaluation(activeCase.id, {
          triggeredBy: 'case-open-auto',
          evaluatedBy: 'Rule Engine',
        })
        if (!isMounted) return
        if (result.ok && result.caseFile) {
          activeCase = result.caseFile
          setCaseFile(result.caseFile)
          setReadinessSummary(calculateReadinessScore(result.caseFile))
          setMessage('Compliance rules refreshed automatically for this case.')
        }
      }

      const initialDraft = formatAiText(
        activeCase?.sowDraft?.narrativeSummary,
        buildSowDraft(activeCase || {}).narrativeSummary,
      )
      setSowDraftText(initialDraft)

      if (activeCase?.aiAnalysis) {
        setAnalysisStatus('completed')
        setAnalysisUpdatedAt(activeCase.aiAnalysis.updatedAt || activeCase.updatedAt || null)
        setAnalysisSnapshot(activeCase.aiAnalysis)
      }
    }

    loadCase()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (requiredDocumentOptions.length === 0) {
      setSelectedCategory('')
      return
    }

    if (!requiredDocumentOptions.includes(selectedCategory)) {
      setSelectedCategory(requiredDocumentOptions[0])
    }
  }, [requiredDocumentOptions, selectedCategory])

  const derived = useMemo(() => {
    if (!caseFile) {
      return {
        readiness: 0,
        readinessBreakdown: {
          profile: { status: 'Incomplete', complete: false },
          documents: { completed: 0, total: 0, complete: false },
          risk: { status: 'Pending', cleared: false, aiAnalysisCompleted: false, hasHighOrCriticalRisk: false },
        },
        nextAction: 'Select a case from the dashboard.',
        completedCategories: 0,
        totalCategories: 0,
        missingCategories: [],
        checklistEntries: [],
        requiredDocuments: [],
        groupedRequiredDocuments: {},
        extraDocuments: [],
        missingRequiredDocuments: [],
        needsReviewDocuments: [],
        ruleRequiredDocuments: [],
        missingRuleRequiredDocuments: [],
        ruleBlockers: [],
        submissionBlockers: ['Select a case from the dashboard.'],
        statusLabel: 'Draft',
        uploadedRequiredCount: 0,
        missingRequiredCount: 0,
        needsReviewCount: 0,
        extraction: buildMockExtraction({}),
        sowDraft: buildSowDraft({}),
        riskFlags: [],
        clientType: 'Individual',
        riskLevel: 'Low',
        riskClearanceReason: 'AI analysis has not been run.',
        profileType: CLIENT_PROFILE_TYPE.SALARIED_EMPLOYEE,
        auditEntries: [],
        analysisData: {
          extractedFields: [],
          mismatches: [],
        risks: [],
        missingSupportingEvidence: [],
        suggestions: [],
          confidence: 'Low',
          confidenceItems: [],
          updatedAt: null,
          beforeReadiness: 0,
          afterReadiness: 0,
        },
      }
    }

    const completionSummary = getDocumentCompletionSummary(caseFile)
    const ruleSnapshot = caseFile._lastRuleSnapshot || caseFile.ruleSnapshots?.[caseFile.ruleSnapshots.length - 1] || null
    const profileType = getClientProfileType(caseFile)
    const completedCategories = readinessSummary?.documents?.completed ?? completionSummary.requiredCompletedCount
    const missingCategories = completionSummary.missingCategoryLabels
    const readiness = readinessSummary?.percentage ?? 0
    const baseReadiness = readiness

    const extraction = buildMockExtraction(caseFile)
    const activeAnalysis = analysisSnapshot || caseFile.aiAnalysis || null
    const savedSowDraft = caseFile.sowDraft || {}
    const defaultSowDraft = buildSowDraft(caseFile)
    const sowDraft = {
      primarySource: formatAiText(savedSowDraft.primarySource, defaultSowDraft.primarySource),
      supportingEvidence: formatAiText(savedSowDraft.supportingEvidence, defaultSowDraft.supportingEvidence),
      narrativeSummary: formatAiText(sowDraftText || savedSowDraft.narrativeSummary, defaultSowDraft.narrativeSummary),
      confidence: formatAiText(savedSowDraft.confidence, defaultSowDraft.confidence),
    }

    const riskFlags = buildRiskFlags(caseFile, missingCategories, extraction)
    const confidenceAssessment = assessAnalysisConfidence(missingCategories, extraction.mismatches, riskFlags)
    const fallbackAnalysisData = {
      extractedFields: [
        { label: 'Occupation', value: extraction.occupation, source: 'employment_letter.pdf' },
        { label: 'Employer / Business Name', value: extraction.employer, source: 'bank_statement.pdf' },
        { label: 'Source of Wealth indicators', value: 'Salary income, investment proceeds, retained business distributions', source: 'source_of_wealth.pdf' },
        profileType === CLIENT_PROFILE_TYPE.BUSINESS_OWNER
          ? { label: 'Ownership Percentage', value: extraction.ownershipPercentage, source: 'company_registry_extract.pdf' }
          : null,
        { label: 'Countries Involved', value: extraction.countriesInvolved.join(', '), source: 'bank_statement.pdf' },
        { label: 'Key financial indicators', value: `Declared net worth ${caseFile.netWorth || '--'}`, source: 'bank_statement.pdf' },
      ].filter(Boolean),
      mismatches: extraction.mismatches,
      risks: riskFlags,
      missingSupportingEvidence: [],
      suggestions: [
        missingCategories.length > 0 ? `Upload ${missingCategories[0]}${missingCategories.length > 1 ? ' and remaining required documents' : ''}` : 'Validate all uploaded supporting documents',
        extraction.mismatches.length > 0 ? `Verify ${extraction.mismatches[0].label.toLowerCase()}` : 'Confirm extracted data aligns with intake declarations',
        'Review AI extracted data before compliance handoff',
      ],
      confidence: confidenceAssessment.level,
      confidenceItems: [],
      confidenceExplanation: confidenceAssessment.message,
      updatedAt: analysisUpdatedAt,
      beforeReadiness: Math.max(baseReadiness - (missingCategories.length > 0 ? 20 : 10), 0),
      afterReadiness: missingCategories.length > 0 ? Math.max(baseReadiness, 95) : baseReadiness,
    }
    const normalizedAnalysisData = activeAnalysis
      ? normalizeAiAnalysisPayload(activeAnalysis, {
        missingCategories,
        profileType,
        risks: riskFlags,
        suggestions: fallbackAnalysisData.suggestions,
        updatedAt: analysisUpdatedAt,
        beforeReadiness: fallbackAnalysisData.beforeReadiness,
        afterReadiness: fallbackAnalysisData.afterReadiness,
      })
      : fallbackAnalysisData

    const openNormalizedActions = buildNormalizedSuggestedActions(normalizedAnalysisData.suggestions, caseFile)
    const openHighMissingEvidence = normalizedAnalysisData.missingSupportingEvidence.some((item) => {
      const actionText = `${item.document} ${item.issue} ${item.reason}`
      const evidenceCategory = getEvidenceCategoryForText(actionText)
      const isCovered = evidenceCategory ? getUploadedEvidenceForCategory(caseFile, evidenceCategory).length > 0 : false
      return getActionPriority(actionText) === 'High' && !isCovered
    })
    const openMismatches = normalizedAnalysisData.mismatches.filter((mismatch) => {
      const evidenceCategory = getEvidenceCategoryForText(mismatch)
      return !getUploadedEvidenceForCategory(caseFile, evidenceCategory).length
    })
    const hasHighSeverityIssue = normalizedAnalysisData.risks.some((risk) => String(risk.severity || '').toLowerCase() === 'high')
      || normalizedAnalysisData.risks.some((risk) => String(risk.severity || '').toLowerCase() === 'critical')
      || openMismatches.some((mismatch) => String(mismatch.severity || '').toLowerCase() === 'high')
    const hasHighPriorityFollowUp = openNormalizedActions.some((action) => action.priority === 'High' && action.uploadedCount === 0)
      || openHighMissingEvidence
    const riskLevel = readinessSummary?.rules?.riskLevel || ruleSnapshot?.computedMetrics?.finalRiskLevel || deriveRiskLevel({
      missingCategories,
      mismatches: openMismatches,
      riskFlags: hasHighPriorityFollowUp
        ? [...normalizedAnalysisData.risks, { title: 'High-priority follow-up evidence required', severity: 'High' }]
        : normalizedAnalysisData.risks,
      readiness,
    })
    let nextAction = 'Review case details and proceed with the next workflow step.'
    if (missingCategories.length > 0) nextAction = 'Resolve missing documents before compliance handoff.'
    else if (hasHighSeverityIssue || hasHighPriorityFollowUp || openMismatches.length > 0) nextAction = 'Resolve high-priority AI findings before submission.'
    else if (readiness < 100) nextAction = 'Review extracted data and finalize the SoW draft.'
    else nextAction = 'Submit for compliance review.'
    let riskClearanceReason = 'Risk checks are cleared.'
    if (!hasFreshAiAnalysis(caseFile)) {
      riskClearanceReason = 'Run AI analysis after the latest document upload.'
    } else if (hasHighSeverityIssue) {
      riskClearanceReason = 'High or critical risk findings need review.'
    } else if (hasHighPriorityFollowUp) {
      riskClearanceReason = 'High-priority AI follow-up is still open.'
    }
    const clientType = Number(String(caseFile.netWorth || '').replace(/,/g, '')) >= 10000000 ? 'UHNWI' : 'HNWI'
    const analysisData = {
      ...normalizedAnalysisData,
      beforeReadiness: readiness,
      afterReadiness: Math.max(baseReadiness, readiness),
    }

    return {
      readiness,
      readinessBreakdown: readinessSummary || {
        profile: {
          complete: hasRequiredFields(caseFile),
          status: hasRequiredFields(caseFile) ? 'Complete' : 'Incomplete',
        },
        documents: {
          completed: completionSummary.requiredCompletedCount,
          total: completionSummary.requiredTotal,
          complete: completionSummary.allRequiredComplete,
        },
        risk: {
          cleared: hasFreshAiAnalysis(caseFile) && !hasHighSeverityIssue && !hasHighPriorityFollowUp,
          status: hasFreshAiAnalysis(caseFile) && !hasHighSeverityIssue && !hasHighPriorityFollowUp ? 'Cleared' : 'Pending',
          aiAnalysisCompleted: hasFreshAiAnalysis(caseFile),
          hasHighOrCriticalRisk: hasHighSeverityIssue || hasHighPriorityFollowUp,
        },
      },
      nextAction,
      completedCategories,
      totalCategories: readinessSummary?.documents?.total ?? completionSummary.requiredTotal,
      missingCategories,
      checklistEntries: completionSummary.entries,
      requiredDocuments: completionSummary.requiredDocuments,
      groupedRequiredDocuments: completionSummary.groupedRequiredDocuments,
      extraDocuments: completionSummary.extraDocuments,
      missingRequiredDocuments: completionSummary.missingRequiredDocuments,
      needsReviewDocuments: completionSummary.needsReviewDocuments,
      ruleRequiredDocuments: completionSummary.ruleRequiredDocuments,
      missingRuleRequiredDocuments: completionSummary.missingRuleRequiredDocuments,
      ruleBlockers: readinessSummary?.rules?.blockers || ruleSnapshot?.aggregatedActions?.blockers || [],
      submissionBlockers: readinessSummary?.submissionBlockers || [],
      statusLabel: readinessSummary?.statusLabel || caseFile.status,
      uploadedRequiredCount: completionSummary.uploadedRequiredCount,
      missingRequiredCount: completionSummary.missingRequiredCount,
      needsReviewCount: completionSummary.needsReviewCount,
      extraction,
      sowDraft,
      riskFlags,
      analysisData,
      clientType,
      riskLevel,
      riskClearanceReason,
      profileType,
      ruleSnapshot,
      auditEntries: buildAuditEntries(caseFile),
    }
  }, [caseFile, sowDraftText, analysisSnapshot, analysisUpdatedAt, readinessSummary])

  const hasCriticalRiskFlags = derived.riskFlags.some((risk) => {
    const severity = String(risk.severity || '').toLowerCase()
    return severity === 'high' || severity === 'critical'
  })
    || derived.analysisData.risks.some((risk) => {
      const severity = String(risk.severity || '').toLowerCase()
      return severity === 'high' || severity === 'critical'
    })
  const aiAnalysisCompleted = hasFreshAiAnalysis(caseFile)
  const hasRuleBlockers = derived.ruleBlockers.length > 0
  const canSubmit = Boolean(caseFile)
    && derived.readinessBreakdown?.canSubmit === true
    && !hasRuleBlockers
  const handleSubmit = async () => {
    if (!caseFile || !canSubmit) return

    setSubmitting(true)
    setMessage('')

    const result = await submitCaseForCompliance(caseFile.id, {
      sowDraft: {
        primarySource: derived.sowDraft.primarySource,
        supportingEvidence: derived.sowDraft.supportingEvidence,
        narrativeSummary: sowDraftText,
        confidence: derived.sowDraft.confidence,
      },
      extractedData: derived.extraction,
      riskFlags: derived.riskFlags,
      aiAnalysis: analysisSnapshot || derived.analysisData,
    })

    if (!result.ok) {
      setMessage(result.reason)
      setSubmitting(false)
      return
    }

    setCaseFile(result.caseFile)
    setReadinessSummary(calculateReadinessScore(result.caseFile))
    setMessage('Case submitted successfully. Status updated to Submitted for Review.')
    setSubmitting(false)
  }

  const handleDownloadSowDocument = () => {
    if (!caseFile) return

    const fileStem = `${caseFile.clientName || 'client'}-source-of-wealth`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const generatedAt = new Date().toLocaleDateString()
    const documentHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Source of Wealth - ${escapeHtml(caseFile.clientName)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f1b16; line-height: 1.55; margin: 48px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin: 28px 0 8px; color: #6f4a3a; }
    p { font-size: 12px; margin: 0 0 12px; }
    .meta { color: #6f625b; font-size: 11px; margin-bottom: 24px; }
    .box { border: 1px solid #e5ded9; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Source of Wealth Summary</h1>
  <p class="meta">Client: ${escapeHtml(caseFile.clientName || 'Client')} | Case ID: ${escapeHtml(caseFile.id || '')} | Generated: ${escapeHtml(generatedAt)}</p>
  <div class="box">
    <h2>Primary Source of Wealth</h2>
    <p>${escapeHtml(derived.sowDraft.primarySource)}</p>
  </div>
  <div class="box">
    <h2>Supporting Evidence</h2>
    <p>${escapeHtml(derived.sowDraft.supportingEvidence)}</p>
  </div>
  <div class="box">
    <h2>Narrative Summary</h2>
    <p>${escapeHtml(sowDraftText || derived.sowDraft.narrativeSummary)}</p>
  </div>
  <p class="meta">Confidence: ${escapeHtml(derived.sowDraft.confidence)} | Prepared for Compliance review.</p>
</body>
</html>`
    const blob = new Blob(['\ufeff', documentHtml], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileStem || 'source-of-wealth'}.doc`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRerunRules = async () => {
    if (!caseFile?.id) return
    const result = await rerunRuleEvaluation(caseFile.id, { triggeredBy: 'manual-rerun', evaluatedBy: 'Compliance Officer' })
    if (!result.ok) {
      setMessage(result.reason || 'Rule evaluation failed.')
      return
    }
    setCaseFile(result.caseFile)
    setReadinessSummary(calculateReadinessScore(result.caseFile))
    setMessage('Rule evaluation snapshot refreshed.')
  }

  const triggerUploadForType = (documentType, suggestionContext = null) => {
    if (!documentType) return
    setUploadTargetType(documentType)
    uploadSuggestionContextRef.current = suggestionContext
    setUploadSuggestionContext(suggestionContext)
    if (documentInputRef.current) {
      documentInputRef.current.click()
    }
  }

  const handleFileInput = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!caseFile || files.length === 0) return
    const targetCategory = uploadTargetType || selectedCategory
    if (!targetCategory) return

    setUploading(true)
    setMessage('')

    try {
      const activeSuggestionContext = uploadSuggestionContextRef.current || uploadSuggestionContext
      const targetRequiredDocument = derived.requiredDocuments.find((item) => item.label === targetCategory)
      let extractedDocuments = []
      try {
        const extractionResult = await extractDocumentText(files)
        extractedDocuments = extractionResult.documents || []
      } catch (error) {
        console.warn('Unable to extract document text during upload:', error)
      }

      for (const [index, file] of files.entries()) {
        const extracted = extractedDocuments[index] || {}
        const documentId = `${file.name}-${file.size}-${file.lastModified}`
        let storageMeta = {}

        if (hasFirebaseConfig) {
          try {
            storageMeta = await uploadCaseDocumentFile(caseFile.id, documentId, file)
          } catch (error) {
            console.error('Error uploading document to Firebase Storage:', error)
            setMessage(`Unable to upload ${file.name} to Firebase Storage. Check your Firebase Storage setup.`)
            return
          }
        }

        await addDocumentToCase(caseFile.id, {
          id: documentId,
          caseId: caseFile.id,
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          category: targetCategory,
          uploader: 'RM Uploaded',
          extractedText: extracted.text || '',
          mimeType: extracted.mimeType || file.type || '',
          storagePath: storageMeta.storagePath || null,
          downloadURL: storageMeta.downloadURL || null,
          suggestedActionId: activeSuggestionContext?.suggestedActionId || null,
          suggestedActionText: activeSuggestionContext?.text || null,
          evidenceCategory: activeSuggestionContext?.evidenceCategory
            || getEvidenceCategoryForText(`${targetCategory} ${file.name} ${extracted.text || ''}`),
          uploadedForSuggestion: Boolean(activeSuggestionContext?.suggestedActionId),
          uploadedForRuleRequirement: Boolean(targetRequiredDocument?.ruleDriven),
          ruleRequirementSource: targetRequiredDocument?.sources?.[0]?.ruleName || targetRequiredDocument?.reason || null,
          uploadedAt: new Date().toISOString(),
        })
      }

      const updated = await refreshCase()
      if (updated) setCaseFile(updated)
      setAnalysisStatus((current) => (current === 'completed' ? 'not-run' : current))
      setMessage('Documents uploaded and case readiness refreshed.')
    } catch (error) {
      console.error('Document upload flow failed:', error)
      setMessage(error?.message ? `Upload failed: ${error.message}` : 'Upload failed unexpectedly. Check backend/Firebase logs.')
    } finally {
      setUploadTargetType('')
      uploadSuggestionContextRef.current = null
      setUploadSuggestionContext(null)
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleRemoveDocument = async (documentId) => {
    if (!caseFile) return

    await removeDocumentFromCase(caseFile.id, documentId)
    const updated = await refreshCase()
    if (updated) setCaseFile(updated)
    setAnalysisStatus((current) => (current === 'completed' ? 'not-run' : current))
    setMessage('Document removed from the case.')
  }

  const handleRunAiAnalysis = async () => {
    if (!caseFile) return

    setAnalysisStatus('processing')
    setMessage('')
    const documentsForAnalysis = (caseFile.documents || [])
      .filter((document) => String(document.extractedText || '').trim().length > 0)
      .map((document) => ({
        filename: document.name,
        category: document.category,
        text: document.extractedText,
      }))

    if (documentsForAnalysis.length === 0) {
      setAnalysisStatus('not-run')
      setMessage('No extractable document text is available yet. Re-upload the documents after the Groq backend is running.')
      return
    }

    try {
      const response = await analyzeCaseDocuments({
        clientName: caseFile.clientName,
        nationality: caseFile.nationality,
        residence: caseFile.residence,
        occupation: caseFile.occupation,
        netWorth: caseFile.netWorth,
        purpose: caseFile.purpose,
        clientType: derived.clientType,
      }, documentsForAnalysis)

      const aiPayload = {
        ...(response.sowData || {}),
        updatedAt: new Date().toISOString(),
      }
      const normalizedAnalysis = normalizeAiAnalysisPayload(aiPayload, {
        missingCategories: derived.missingCategories,
        risks: derived.riskFlags,
        suggestions: [
          derived.missingCategories.length > 0 ? `Upload ${derived.missingCategories.join(', ')}` : 'No document gaps detected',
          'Review extracted values against the onboarding form',
          'Review AI extracted data before compliance handoff',
        ],
        updatedAt: aiPayload.updatedAt,
        profileType: derived.profileType,
        beforeReadiness: Math.max(derived.readiness - (derived.riskFlags.length > 0 ? 15 : 5), 0),
        afterReadiness: derived.missingCategories.length === 0 ? Math.max(derived.readiness, 95) : Math.max(derived.readiness, 85),
      })

      const nextSowDraft = normalizedAnalysis.sourceOfWealthDraft
      ? {
          primarySource: formatAiText(normalizedAnalysis.sourceOfWealthDraft.primarySourceOfWealth, derived.sowDraft.primarySource),
          supportingEvidence: formatAiText(normalizedAnalysis.sourceOfWealthDraft.supportingEvidence, derived.sowDraft.supportingEvidence),
          narrativeSummary: formatAiText(normalizedAnalysis.sourceOfWealthDraft.narrativeExplanation, sowDraftText),
          confidence: formatAiText(normalizedAnalysis.sourceOfWealthDraft.confidence, normalizedAnalysis.confidence),
        }
        : null

      const updated = await updateCaseData(caseFile.id, {
        aiAnalysis: {
          ...aiPayload,
          confidence: normalizedAnalysis.confidence,
          confidenceItems: normalizedAnalysis.confidenceItems,
          confidenceExplanation: normalizedAnalysis.confidenceExplanation,
          beforeReadiness: normalizedAnalysis.beforeReadiness,
          afterReadiness: normalizedAnalysis.afterReadiness,
        },
        ...(nextSowDraft ? { sowDraft: nextSowDraft } : {}),
      })

      if (updated) {
        setCaseFile(updated)
        setReadinessSummary(calculateReadinessScore(updated))
        setAnalysisSnapshot({
          ...aiPayload,
          confidence: normalizedAnalysis.confidence,
          confidenceItems: normalizedAnalysis.confidenceItems,
          confidenceExplanation: normalizedAnalysis.confidenceExplanation,
          beforeReadiness: normalizedAnalysis.beforeReadiness,
          afterReadiness: normalizedAnalysis.afterReadiness,
        })
        setAnalysisUpdatedAt(aiPayload.updatedAt)
        if (nextSowDraft?.narrativeSummary) {
          setSowDraftText(nextSowDraft.narrativeSummary)
        }
      }

      setAnalysisStatus('completed')
      setMessage('AI analysis completed using the uploaded document text. Review extracted insights and suggested actions.')
    } catch (error) {
      console.error('Error running AI analysis:', error)
      const hasPreviousAnalysis = Boolean(analysisSnapshot || caseFile?.aiAnalysis)
      setAnalysisStatus(hasPreviousAnalysis ? 'completed' : 'failed')
      const friendlyMessage = getFriendlyAiErrorMessage(error)
      setMessage(
        `Latest AI analysis failed: ${friendlyMessage}${hasPreviousAnalysis ? ' Previous completed analysis is still shown.' : ''}`,
      )
    }
  }

  const analysisStatusTone = analysisStatus === 'processing'
    ? 'bg-warning/15 text-warning'
    : analysisStatus === 'completed'
      ? 'bg-success/12 text-success'
      : analysisStatus === 'failed'
        ? 'bg-error/10 text-error'
        : 'bg-surface text-on-surface-variant'

  if (loading) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <div className="bg-surface-container-lowest rounded-3xl shadow-ambient border border-outline/10 p-8">
          <p className="text-sm text-on-surface-variant">Loading case workspace...</p>
        </div>
      </div>
    )
  }

  if (!caseFile) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <div className="bg-surface-container-lowest rounded-3xl shadow-ambient border border-outline/10 p-10 text-center">
          <h1 className="font-display text-3xl font-bold text-on-surface mb-3">Case not found</h1>
          <p className="text-on-surface-variant mb-6">Return to the dashboard and select a client case to continue.</p>
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const renderOverview = () => (
    <SectionCard title="Case Overview" description="Summary of onboarding progress and client profile." icon={ShieldCheck}>
      <div className="rounded-[26px] border border-outline/10 bg-gradient-to-b from-surface to-surface-container-lowest p-5 md:p-6">
        <div className="rounded-3xl border border-outline/10 bg-surface px-4 py-4 md:px-5 md:py-5">
          <div className="space-y-5">
            <div className="rounded-2xl bg-surface-container-low px-4 py-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-medium text-on-surface">Progress to compliance handoff</p>
                <span className="text-sm font-semibold text-on-surface">{derived.readiness}%</span>
              </div>
              <div className="h-3 rounded-full bg-surface-container overflow-hidden">
                <div className={`h-full rounded-full ${getProgressTone(derived.readiness)}`} style={{ width: `${derived.readiness}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                ['Client Profile', derived.readinessBreakdown.profile?.points, 20, derived.readinessBreakdown.profile?.status],
                ['Documents', derived.readinessBreakdown.documents?.points, 30, `${derived.readinessBreakdown.documents.completed} / ${derived.readinessBreakdown.documents.total}`],
                ['AI Extraction', derived.readinessBreakdown.aiExtraction?.points, 15, derived.readinessBreakdown.aiExtraction?.status || 'Pending'],
                ['Source of Wealth', derived.readinessBreakdown.sourceOfWealth?.points, 15, derived.readinessBreakdown.sourceOfWealth?.status || 'Pending'],
                ['Risk Resolution', derived.readinessBreakdown.risk?.points, 20, derived.readinessBreakdown.risk?.status],
              ].map(([label, points, maxPoints, status]) => (
                <div key={label} className="rounded-2xl bg-surface-container-low px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">{label}</p>
                  <p className="text-sm font-semibold text-on-surface">{points ?? 0}/{maxPoints}</p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">{status}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-surface-container-low px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Next Required Action</p>
              <p className="text-sm leading-6 text-on-surface">{derived.readinessBreakdown.nextBestAction || derived.nextAction}</p>
            </div>

            <div className="border-t border-outline/10 pt-5">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-4">Client Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  { label: 'Client Name', value: caseFile.clientName || '--', icon: UserRound },
                  { label: 'Nationality', value: caseFile.nationality || '--', icon: Globe2 },
                  { label: 'Country of Residence', value: caseFile.residence || '--', icon: Globe2 },
                  { label: 'Occupation', value: caseFile.occupation || '--', icon: Briefcase },
                  { label: 'Net Worth', value: `${caseFile.netWorthCurrency || 'USD'} ${formatCurrencyLikeNumber(caseFile.netWorth)}`, icon: Building2 },
                  { label: 'Risk Level', value: derived.riskLevel, icon: ShieldAlert, tone: getRiskTone(derived.riskLevel) },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-2xl bg-surface-container-low px-4 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container text-on-surface">
                          <Icon className="w-4 h-4" />
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">{item.label}</p>
                      </div>
                      {item.tone ? (
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${item.tone}`}>
                          {item.value}
                        </span>
                      ) : (
                        <p className="text-sm font-semibold text-on-surface md:text-base break-words">{item.value}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )

    const renderDocuments = () => {
    const requiredDocSet = new Set(derived.requiredDocuments.map((item) => item.label))
    const hasRuleRequiredDocuments = derived.ruleRequiredDocuments.length > 0
    const hasMissingRuleRequiredDocuments = derived.missingRuleRequiredDocuments.length > 0
    const hasRuleBlockers = derived.ruleBlockers.length > 0
    const uploadedDocuments = (caseFile.documents || []).map((doc) => {
      const normalizedCategory = normalizeUploadedCategory(doc.category)
      const requiredDoc = derived.requiredDocuments.find((item) => item.label === normalizedCategory)
      const isExtra = !requiredDocSet.has(normalizedCategory)
      let status = 'Uploaded'
      if (isExtra) status = 'Extra / Not Required for Current Profile'
      else if (requiredDoc?.status === 'needs_review') status = 'Needs Review'

      return {
        ...doc,
        normalizedCategory,
        status,
      }
    })

    const statusTone = (status) => {
      if (status === 'Uploaded') return 'bg-success/12 text-success'
      if (status === 'Needs Review') return 'bg-warning/20 text-warning'
      if (status === 'Missing') return 'bg-error/10 text-error'
      return 'bg-surface-container text-on-surface-variant'
    }

    return (
      <SectionCard title="Documents" description="Upload files, review evidence, and check required categories." icon={FileText}>
        {hasRuleRequiredDocuments ? (
          <div className="mb-4 rounded-2xl border border-warning/20 bg-warning/5 px-4 py-3">
            <p className="text-sm font-semibold text-on-surface">Additional documents are required due to compliance rules.</p>
            {hasRuleBlockers || hasMissingRuleRequiredDocuments ? (
              <p className="mt-1 text-sm text-warning">Submission is blocked until all rule-required documents are uploaded.</p>
            ) : (
              <p className="mt-1 text-sm text-on-surface-variant">All rule-required documents have evidence uploaded.</p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Required Documents</p>
            <p className="mt-2 text-xl font-bold text-on-surface">{derived.totalCategories}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {derived.completedCategories} / {derived.totalCategories} required documents uploaded
            </p>
          </div>
          <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Uploaded Documents</p>
            <p className="mt-2 text-xl font-bold text-success">{derived.uploadedRequiredCount}</p>
            <p className="text-xs text-on-surface-variant mt-1">required documents with uploads</p>
          </div>
          <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Missing Documents</p>
            <p className="mt-2 text-xl font-bold text-error">{derived.missingRequiredCount}</p>
            <p className="text-xs text-on-surface-variant mt-1">{derived.needsReviewCount} need review</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <p className="text-sm font-semibold text-on-surface mb-4">Required Documents Checklist ({derived.profileType})</p>
            <div className="space-y-5">
              {Object.entries(derived.groupedRequiredDocuments).map(([groupLabel, items]) => (
                <div key={groupLabel}>
                  <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant mb-2">{groupLabel}</p>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const badge = item.status === 'uploaded' ? 'Uploaded' : item.status === 'needs_review' ? 'Needs Review' : 'Missing'
                      return (
                        <div key={item.key} className="rounded-xl border border-outline/10 bg-surface-container-lowest px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-on-surface">{item.label}</p>
                              <p className="text-xs text-on-surface-variant">{item.category}</p>
                              {item.ruleDriven ? (
                                <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                                  <p><span className="font-semibold text-on-surface">Source:</span> {item.sourceLabel || 'Rule-Based Compliance Engine'}</p>
                                  <p><span className="font-semibold text-on-surface">Reason:</span> {item.sources?.[0]?.ruleName || item.reason || 'Required by active compliance rule.'}</p>
                                  {item.policyReference ? <p><span className="font-semibold text-on-surface">Policy:</span> {item.policyReference}</p> : null}
                                </div>
                              ) : null}
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(badge)}`}>
                              {badge}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            {item.status === 'missing' ? (
                              <button
                                onClick={() => triggerUploadForType(item.label)}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                              >
                                Upload
                              </button>
                            ) : (
                              <button
                                onClick={() => triggerUploadForType(item.label)}
                                className="rounded-lg border border-outline/20 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/30"
                              >
                                Replace
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-outline/10 bg-surface p-4">
              <p className="text-sm font-semibold text-on-surface mb-4">Uploaded Documents</p>
              {uploadedDocuments.length > 0 ? (
                <div className="space-y-3">
                  {uploadedDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-xl border border-outline/10 bg-surface-container-lowest p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-on-surface">{doc.name}</p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(doc.status)}`}>
                          {doc.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant">{doc.normalizedCategory} • {doc.uploader} • {formatDate(doc.uploadedAt)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        {!doc.status.startsWith('Extra') ? (
                          <button
                            onClick={() => triggerUploadForType(doc.normalizedCategory)}
                            className="rounded-lg border border-outline/20 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/30"
                          >
                            Replace
                          </button>
                        ) : null}
                        <button onClick={() => handleRemoveDocument(doc.id)} className="text-xs font-medium text-error hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">No documents uploaded yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-outline/10 bg-surface p-4">
              <p className="text-sm font-semibold text-on-surface mb-4">Missing Documents</p>
              {derived.missingRequiredDocuments.length > 0 ? (
                <div className="space-y-3">
                  {derived.missingRequiredDocuments.map((item) => (
                    <div key={item.key} className="rounded-xl border border-error/20 bg-error/5 p-3">
                      <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{item.missingReason}</p>
                      {item.ruleDriven ? (
                        <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                          <p><span className="font-semibold text-on-surface">Source:</span> {item.sourceLabel || 'Rule-Based Compliance Engine'}</p>
                          <p><span className="font-semibold text-on-surface">Reason:</span> {item.sources?.[0]?.ruleName || item.reason || 'Required by active compliance rule.'}</p>
                        </div>
                      ) : null}
                      <button
                        onClick={() => triggerUploadForType(item.label)}
                        className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                      >
                        Upload
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-success">All required documents are uploaded.</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    )
  }
  const renderAiInsights = () => (
    <SectionCard
      title="AI Insights"
      description="Run analysis to extract structured signals, mismatches, and suggested actions."
      icon={ScanSearch}
      action={(
        <button
          onClick={handleRunAiAnalysis}
          disabled={analysisStatus === 'processing'}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {analysisStatus === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Run AI Analysis
        </button>
      )}
    >
      {(() => {
        const aiHasRun = Boolean(analysisSnapshot || caseFile?.aiAnalysis)
        if (!aiHasRun) {
          return (
            <>
              <div className="mb-6 rounded-2xl border border-outline/10 bg-surface p-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
                    <div className="rounded-xl bg-surface-container-lowest px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-2">Status</p>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${analysisStatusTone}`}>
                        {analysisStatus === 'processing' ? 'Processing' : analysisStatus === 'failed' ? 'Failed' : 'Not Run'}
                      </span>
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-2">Last Analyzed</p>
                      <p className="text-sm font-semibold text-on-surface">--</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-container-lowest px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-2">Evidence Confidence</p>
                    <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
                      AI confidence will appear after analysis runs on uploaded document text.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-outline/10 bg-surface p-6">
                <p className="text-sm font-semibold text-on-surface">No AI analysis yet.</p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Run AI Analysis to extract document data, detect mismatches, and generate suggested follow-up actions.
                </p>
              </div>
            </>
          )
        }

        const visibleActions = buildNormalizedSuggestedActions(derived.analysisData.suggestions, caseFile)

        return (
          <>
      <div className="mb-6 rounded-2xl border border-outline/10 bg-surface p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <div className="rounded-xl bg-surface-container-lowest px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-2">Status</p>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${analysisStatusTone}`}>
                {analysisStatus === 'not-run' ? 'Not Run' : analysisStatus === 'processing' ? 'Processing' : analysisStatus === 'failed' ? 'Failed' : 'Completed'}
              </span>
            </div>
            <div className="rounded-xl bg-surface-container-lowest px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-2">Last Analyzed</p>
              <p className="text-sm font-semibold text-on-surface">{derived.analysisData.updatedAt ? formatDateTime(derived.analysisData.updatedAt) : '--'}</p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-lowest px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-2">Evidence Confidence</p>
                <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
                  {derived.analysisData.confidenceExplanation || 'Confidence will update after AI analysis runs.'}
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getConfidenceTone(derived.analysisData.confidence || 'Low')}`}>
                Overall: {derived.analysisData.confidence || 'Low'}
              </span>
            </div>

            {derived.analysisData.confidenceItems?.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                {derived.analysisData.confidenceItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-outline/10 bg-surface px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getConfidenceTone(item.level)}`}>
                        {item.level}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="mt-2 text-xs leading-5 text-on-surface-variant">{item.detail}</p>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-on-surface-variant">Supported by uploaded evidence.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileBadge2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-on-surface">Extracted Data</h3>
            </div>
            <div className="space-y-3">
              {derived.analysisData.extractedFields.map((field) => (
                <div key={field.label} className="rounded-xl bg-surface-container-lowest px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-on-surface">{field.label}</p>
                    <span className="text-xs text-on-surface-variant">From {field.source}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-semibold text-on-surface">Mismatch Detection</h3>
            </div>
            <div className="space-y-3">
              {derived.analysisData.mismatches.map((item) => (
                <div key={item.label} className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                  <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                    Detected from: {item.source || 'bank_statement.pdf'}
                  </p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant mb-1">Declared</p>
                      <p className="text-sm text-on-surface">{item.declared}</p>
                    </div>
                    <div className="rounded-xl bg-error/5 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant mb-1">Detected</p>
                      <p className="text-sm text-error">{item.detected}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCheck className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-on-surface">Suggested Actions</h3>
            </div>
            <div className="space-y-3">
              {visibleActions.length > 0 ? visibleActions.map((action) => (
                <div
                  key={action.suggestedActionId}
                  className={`rounded-xl border px-4 py-3 ${
                    action.uploadedCount > 0
                      ? 'border-success/15 bg-success/5'
                      : 'border-transparent bg-surface-container-lowest'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 ${action.uploadedCount > 0 ? 'text-success' : 'text-primary'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityTone(action.priority)}`}>
                          {action.priority}
                        </span>
                        {action.uploadType ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            action.uploadedCount > 0 ? 'bg-success/12 text-success' : 'bg-surface text-on-surface-variant'
                          }`}>
                            {action.evidenceLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-on-surface">{action.title}</p>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{action.text}</p>
                      {action.coveredDocuments?.length > 0 ? (
                        <div className="mt-2 rounded-lg border border-success/10 bg-success/5 px-3 py-2">
                          <p className="text-xs font-semibold text-success">Covered by uploaded evidence</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            File: {getUniqueEvidenceFileNames(action.coveredDocuments).join(', ')}
                          </p>
                        </div>
                      ) : null}
                      {action.relatedSuggestions?.length > 1 ? (
                        <p className="mt-2 text-xs text-on-surface-variant">
                          Merged {action.relatedSuggestions.length} similar AI suggestions for this evidence.
                        </p>
                      ) : null}
                      {action.uploadType ? (
                        <button
                          onClick={() => triggerUploadForType(action.uploadType, {
                            suggestedActionId: action.suggestedActionId,
                            text: action.text,
                            evidenceCategory: action.evidenceCategory,
                          })}
                          disabled={action.uploadedCount > 0}
                          className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            action.uploadedCount > 0
                              ? 'cursor-not-allowed border border-success/15 bg-success/5 text-success'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {action.uploadedCount > 0 ? 'Evidence already uploaded' : action.priority === 'High' ? 'Upload evidence' : 'Upload optional evidence'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl bg-success/5 border border-success/10 px-4 py-3">
                  <p className="text-sm text-success">No medium or high priority follow-up actions.</p>
                </div>
              )}
              {derived.analysisData.missingSupportingEvidence
                .filter((item) => getActionPriority(`${item.document} ${item.issue} ${item.reason}`) === 'High')
                .map((item, index) => (
                (() => {
                  const actionText = `${item.document} ${item.issue} ${item.reason}`
                  const evidenceCategory = getEvidenceCategoryForText(actionText)
                  const coveredDocuments = getUploadedEvidenceForCategory(caseFile, evidenceCategory)
                  const suggestedActionId = evidenceCategory
                    ? `missing_evidence_${evidenceCategory}`
                    : buildSuggestedActionId(actionText, index, 'missing_evidence')
                  const uploadedCount = evidenceCategory
                    ? coveredDocuments.length
                    : getUploadedEvidenceCount(caseFile, item.document, suggestedActionId)
                  const priority = getActionPriority(actionText)
                  return (
                <div key={item.id} className={`rounded-xl border px-4 py-3 ${uploadedCount > 0 ? 'border-success/15 bg-success/5' : 'border-warning/20 bg-warning/5'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{item.document}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityTone(priority)}`}>
                          {priority}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${uploadedCount > 0 ? 'bg-success/12 text-success' : 'bg-surface text-on-surface-variant'}`}>
                          {uploadedCount > 0 ? `Uploaded (${uploadedCount})` : 'Evidence needed'}
                        </span>
                      </div>
                      {coveredDocuments.length > 0 ? (
                        <div className="mt-2 rounded-lg border border-success/10 bg-success/5 px-3 py-2">
                          <p className="text-xs font-semibold text-success">Covered by uploaded evidence</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            File: {getUniqueEvidenceFileNames(coveredDocuments).join(', ')}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => triggerUploadForType(item.document, {
                        suggestedActionId,
                        text: actionText,
                        evidenceCategory,
                      })}
                      disabled={uploadedCount > 0}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        uploadedCount > 0
                          ? 'cursor-not-allowed border border-success/15 bg-success/5 text-success'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {uploadedCount > 0 ? 'Evidence already uploaded' : 'Upload evidence'}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.issue}</p>
                  {item.reason ? <p className="mt-1 text-xs text-on-surface-variant">{item.reason}</p> : null}
                </div>
                  )
                })()
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-success" />
              <h3 className="text-sm font-semibold text-on-surface">Impact on Readiness Score</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-container-lowest px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant mb-2">Before</p>
                <p className="text-2xl font-bold text-warning">{derived.analysisData.beforeReadiness}%</p>
              </div>
              <div className="rounded-xl bg-surface-container-lowest px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant mb-2">After Resolving Issues</p>
                <p className="text-2xl font-bold text-success">{derived.analysisData.afterReadiness}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
          </>
        )
      })()}
    </SectionCard>
  )

  const renderSowDraft = () => {
    const aiHasRun = Boolean(analysisSnapshot || caseFile?.aiAnalysis)

    return (
      <SectionCard
        title="SoW Draft"
        description="Review and refine the source of wealth summary."
        icon={PencilLine}
        action={aiHasRun ? (
          <button
            onClick={handleDownloadSowDocument}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
          >
            <Download className="w-4 h-4" />
            Download SoW Document
          </button>
        ) : null}
      >
        {!aiHasRun ? (
          <div className="rounded-2xl border border-outline/10 bg-surface p-6">
            <p className="text-sm font-semibold text-on-surface">No SoW draft yet.</p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Run AI Analysis to generate a source-of-wealth draft from uploaded document evidence.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-outline/10 bg-surface p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Primary Source of Wealth</p>
              <p className="text-base font-medium leading-7 text-on-surface">{derived.sowDraft.primarySource}</p>
            </div>
            <div className="rounded-2xl border border-outline/10 bg-surface p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Supporting Evidence</p>
              <p className="text-sm leading-7 text-on-surface">{derived.sowDraft.supportingEvidence}</p>
            </div>
            <div className="rounded-2xl border border-outline/10 bg-surface p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Narrative Summary</p>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getConfidenceTone(derived.sowDraft.confidence)}`}>
                  {derived.sowDraft.confidence} Confidence
                </span>
              </div>
              <textarea
                value={sowDraftText}
                onChange={(event) => setSowDraftText(event.target.value)}
                rows={12}
                className="w-full rounded-2xl border border-outline/15 bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </SectionCard>
    )
  }

  const renderAppliedRules = () => {
    const snapshot = derived.ruleSnapshot
    const triggeredRules = snapshot?.triggeredRules || []
    const actions = snapshot?.aggregatedActions || {}

    return (
      <SectionCard
        title="Applied Rules"
        description="Rule snapshot retained on the case record."
        icon={FileBadge2}
        action={(
          <button
            onClick={handleRerunRules}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
          >
            <ScanSearch className="w-4 h-4" />
            Re-run Rules
          </button>
        )}
      >
        {!snapshot ? (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
            <p className="text-sm font-semibold text-on-surface">No rule snapshot on this case.</p>
            <p className="mt-1 text-sm text-on-surface-variant">Use Re-run Rules to attach a deterministic snapshot using the current active published rules.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                ['Rule Set', snapshot.ruleSetVersion],
                ['Evaluated', formatDateTime(snapshot.evaluatedAt)],
                ['Triggered', triggeredRules.length],
                ['Risk / Readiness', `${snapshot.computedMetrics?.finalRiskLevel || 'Low'} / ${snapshot.computedMetrics?.finalReadiness ?? 0}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
              <div className="space-y-3">
                {triggeredRules.length > 0 ? triggeredRules.map((rule) => (
                  <div key={`${rule.ruleId}-${rule.ruleVersion}`} className="rounded-2xl border border-outline/10 bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-on-surface">{rule.ruleName}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">ID {rule.ruleId} v{rule.ruleVersion}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {rule.policyReference}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-on-surface-variant">
                      {rule.matchedConditions?.reason || 'Conditions matched.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(rule.actionsApplied || []).map((action, index) => (
                        <span key={`${action.type}-${index}`} className="rounded-full bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant">
                          {action.type}{action.target ? `: ${action.target}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-outline/10 bg-surface p-4 text-sm text-on-surface-variant">
                    No rules triggered for this snapshot.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-outline/10 bg-surface p-4">
                  <p className="text-sm font-semibold text-on-surface mb-3">Aggregated Actions</p>
                  <div className="space-y-2 text-xs text-on-surface-variant">
                    <p>Required documents: {(actions.requiredDocuments || []).length}</p>
                    <p>Risk modifiers: {(actions.riskModifiers || []).length}</p>
                    <p>Readiness penalties: {(actions.readinessPenalties || []).length}</p>
                    <p>Checklist items: {(actions.checklistItems || []).length}</p>
                    <p>Submission blockers: {(actions.blockers || []).length}</p>
                  </div>
                </div>
                {(actions.blockers || []).map((blocker, index) => (
                  <div key={index} className="rounded-2xl border border-error/15 bg-error/5 p-4">
                    <p className="text-sm font-semibold text-error">Blocker</p>
                    <p className="mt-2 text-sm text-on-surface-variant">{blocker.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    )
  }

  const renderRiskIssues = () => {
    const aiHasRun = Boolean(analysisSnapshot || caseFile?.aiAnalysis)
    const aiIsFresh = hasFreshAiAnalysis(caseFile)
    const highRisks = aiHasRun
      ? derived.analysisData.risks.filter((risk) => ['high', 'critical'].includes(String(risk.severity || '').toLowerCase()))
      : []
    const realMismatches = aiHasRun ? derived.analysisData.mismatches : []
    const highPriorityActions = aiHasRun
      ? buildNormalizedSuggestedActions(derived.analysisData.suggestions, caseFile)
        .filter((action) => action.text && action.priority === 'High' && action.uploadedCount === 0)
      : []
    const blockers = [
      ...derived.missingRequiredDocuments.map((item) => ({
        title: item.label,
        severity: 'High',
        description: item.missingReason || 'Required document is missing.',
        action: 'Upload required document.',
        uploadType: item.label,
      })),
      ...(!aiHasRun ? [{
        title: 'AI analysis not run',
        severity: 'High',
        description: 'Risk clearance requires AI analysis on the uploaded case documents.',
        action: 'Run AI Analysis.',
      }] : []),
      ...(aiHasRun && !aiIsFresh ? [{
        title: 'AI analysis is stale',
        severity: 'High',
        description: 'Documents changed after the last analysis, so risk clearance needs a fresh run.',
        action: 'Run AI Analysis again.',
      }] : []),
      ...highRisks.map((risk) => ({
        title: risk.title,
        severity: risk.severity,
        description: risk.description || risk.rationale || 'High-priority risk requires review.',
        action: risk.nextAction || 'Review and resolve this risk before submission.',
      })),
      ...highPriorityActions.map((action) => ({
        title: action.title || 'High-priority AI follow-up',
        severity: 'High',
        description: action.text,
        action: action.uploadType ? 'Upload requested evidence.' : 'Resolve this follow-up before submission.',
        uploadType: action.uploadType,
        suggestedActionId: action.suggestedActionId,
        evidenceCategory: action.evidenceCategory,
      })),
      ...(derived.readinessBreakdown.risk?.issues || [])
        .filter((issue) => !/critical|high/i.test(String(issue.severity || '')))
        .map((issue) => ({
          title: issue.title || 'Minor risk observation',
          severity: issue.severity || 'Low',
          description: issue.description || 'A low-priority risk observation is still open.',
          action: 'Review or upload supporting evidence if needed.',
          uploadType: issue.evidenceCategory ? getEvidenceDefinition(issue.evidenceCategory, issue.title).uploadType : null,
          evidenceCategory: issue.evidenceCategory,
        })),
      ...derived.submissionBlockers
        .filter((reason) => !derived.missingRequiredDocuments.some((item) => reason.includes(item.label)))
        .map((reason) => ({
          title: 'Readiness blocker',
          severity: /critical|high|below USD/i.test(reason) ? 'High' : 'Medium',
          description: reason,
          action: 'Resolve this item before submission.',
        })),
    ]

    return (
      <SectionCard title="Risk & Issues" description="Submission blockers and compliance-critical findings." icon={ShieldAlert}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-on-surface">Submission Blockers</h3>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${blockers.length > 0 ? 'bg-error/10 text-error' : 'bg-success/12 text-success'}`}>
                {blockers.length > 0 ? `${blockers.length} open` : 'Clear'}
              </span>
            </div>
            <div className="space-y-3">
              {blockers.length > 0 ? blockers.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-error/15 bg-error/5 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getSeverityTone(item.severity)}`}>
                        {item.severity}
                      </span>
                    </div>
                    {item.uploadType ? (
                      <button
                        onClick={() => triggerUploadForType(item.uploadType, item.suggestedActionId ? {
                          suggestedActionId: item.suggestedActionId,
                          text: item.description,
                          evidenceCategory: item.evidenceCategory,
                        } : null)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                      >
                        Upload
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">{item.description}</p>
                  <p className="mt-2 text-xs font-medium text-primary">{item.action}</p>
                </div>
              )) : (
                <div className="rounded-xl bg-success/5 border border-success/10 px-4 py-4">
                  <p className="text-sm font-semibold text-success">No submission blockers.</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Required documents are complete and no high-priority risk findings are open.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-outline/10 bg-surface p-4">
              <h3 className="text-sm font-semibold text-on-surface mb-4">Risk Clearance</h3>
              <div className="rounded-xl bg-surface-container-lowest px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={`text-sm font-semibold ${derived.readinessBreakdown.risk.cleared ? 'text-success' : 'text-warning'}`}>
                    {derived.readinessBreakdown.risk.status}
                  </p>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRiskTone(derived.riskLevel)}`}>
                    {derived.riskLevel} severity
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{derived.riskClearanceReason}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-outline/10 bg-surface p-4">
              <h3 className="text-sm font-semibold text-on-surface mb-4">AI Inconsistencies</h3>
              <div className="space-y-3">
                {realMismatches.length > 0 ? realMismatches.map((item) => (
                  <div key={item.label} className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                    <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                      Detected from: {item.source || 'bank_statement.pdf'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      Declared: <span className="font-medium text-on-surface">{item.declared}</span> | Detected: <span className="font-medium text-warning">{item.detected}</span>
                    </p>
                  </div>
                )) : (
                  <div className="rounded-xl bg-success/5 border border-success/10 px-4 py-4">
                    <p className="text-sm text-success">{aiHasRun ? 'No AI inconsistencies found.' : 'Run AI Analysis to check inconsistencies.'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    )
  }

  const renderAuditTrail = () => (
    <SectionCard title="Audit Trail" description="Timeline of key actions for this case." icon={History}>
      <div className="relative pl-3">
        <div className="absolute left-[1.45rem] top-2 bottom-2 w-px bg-outline/30" />
        {derived.auditEntries.length > 0 ? derived.auditEntries.map((entry, index) => (
          <div key={`${entry.timestamp}-${entry.actor}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline/10 bg-surface-container-lowest shadow-sm">
              <History className="w-4 h-4 text-on-surface" />
            </div>
            <div className="flex-1 rounded-2xl border border-outline/10 bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-on-surface">{entry.actor}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">{entry.timestamp}</p>
              </div>
              <p className="text-sm leading-6 text-on-surface-variant">{entry.action}</p>
            </div>
          </div>
        )) : (
          <div className="relative flex gap-4">
            <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline/10 bg-surface-container-lowest shadow-sm">
              <History className="w-4 h-4 text-on-surface" />
            </div>
            <div className="flex-1 rounded-2xl border border-outline/10 bg-surface p-4">
              <p className="text-sm text-on-surface-variant">No recorded audit events yet.</p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(202,12,26,0.08),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,247,245,1))] p-6 md:p-8 pb-12">
      <input
        ref={documentInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInput}
      />
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-[30px] border border-outline/10 bg-surface-container-lowest/95 shadow-ambient overflow-hidden">
          <div className="h-1 gradient-primary" />
          <div className="p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                onClick={() => onNavigate?.('dashboard')}
                className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-1.5">Open Case Workspace</p>
              <h1 className="font-display text-3xl md:text-[3rem] font-bold tracking-tight text-on-surface">{caseFile.clientName}</h1>
              <div className="mt-1.5 flex items-center gap-3">
                <p className="text-sm text-on-surface-variant">Case ID: {caseFile.id}</p>
                <button
                  onClick={handleCopyCaseId}
                  className="rounded-lg border border-outline/15 bg-surface px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-end gap-2.5">
              <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-2.5 min-w-[120px]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Status</p>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(caseFile.status)}`}>
                  {derived.statusLabel || caseFile.status}
                </span>
                <p className="mt-2 text-[11px] leading-4 text-on-surface-variant">
                  Owner: <span className="font-semibold text-on-surface">{getStatusOwner(caseFile)}</span>
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                title={!canSubmit ? (derived.submissionBlockers[0] || 'Complete readiness checks before submission.') : 'Submit for Compliance Review'}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit for Compliance Review
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">Readiness Score</p>
              <p className={`text-[1.75rem] font-bold ${derived.readiness >= 85 ? 'text-success' : derived.readiness >= 50 ? 'text-warning' : 'text-error'}`}>{derived.readiness}%</p>
              <div className="mt-2 h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div className={`h-full rounded-full ${getProgressTone(derived.readiness)}`} style={{ width: `${derived.readiness}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">Documents</p>
              <p className="text-[1.75rem] font-bold text-on-surface">{derived.completedCategories}/{derived.totalCategories}</p>
            </div>
            <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">Risk Level</p>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getRiskTone(derived.riskLevel)}`}>
                {derived.riskLevel}
              </span>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                Clearance: <span className={derived.readinessBreakdown.risk.cleared ? 'text-success' : 'text-warning'}>{derived.readinessBreakdown.risk.status}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">Updated</p>
              <p className="text-base font-semibold text-on-surface">{formatDate(caseFile.updatedAt)}</p>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-outline/10 bg-surface px-4 py-3 text-sm text-on-surface-variant">
              {message}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-outline/10 bg-surface px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Status Timeline</p>
              <p className="text-xs text-on-surface-variant">Current owner: <span className="font-semibold text-on-surface">{getStatusOwner(caseFile)}</span></p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-6">
              {STATUS_TIMELINE.map((status, index) => {
                const currentIndex = getStatusTimelineIndex(caseFile.status)
                const isCurrent = status === caseFile.status
                const isDone = index < currentIndex
                return (
                  <div
                    key={status}
                    className={`rounded-xl border px-3 py-3 ${
                      isCurrent
                        ? 'border-primary/25 bg-primary/10 text-primary'
                        : isDone
                          ? 'border-success/15 bg-success/5 text-success'
                          : 'border-outline/10 bg-surface-container-lowest text-on-surface-variant'
                    }`}
                  >
                    <p className="text-xs font-semibold">{status}</p>
                  </div>
                )
              })}
            </div>
            {caseFile.status === CASE_STATUS.ACTION_REQUIRED ? (
              <p className="mt-3 text-xs text-warning">Returned to RM for missing documents, rejected evidence, clarifications, AI follow-up, or unresolved rule blockers.</p>
            ) : null}
            {caseFile.status === CASE_STATUS.ESCALATED ? (
              <div className="mt-3 rounded-xl bg-error/5 px-3 py-3 text-xs text-on-surface-variant">
                <p><span className="font-semibold text-on-surface">Escalation reason:</span> {caseFile.escalationReason || 'Not recorded'}</p>
                <p><span className="font-semibold text-on-surface">Escalated by:</span> {caseFile.escalatedBy || 'Compliance'}</p>
                <p><span className="font-semibold text-on-surface">Escalated time:</span> {formatDateTime(caseFile.escalatedAt)}</p>
                <p><span className="font-semibold text-on-surface">Senior owner:</span> {caseFile.seniorComplianceOwner || 'Senior Compliance'}</p>
              </div>
            ) : null}
            {caseFile.status === CASE_STATUS.REJECTED ? (
              <p className="mt-3 text-xs text-error">Rejected: {caseFile.complianceDecision?.note || 'Decision notes required by Compliance.'}</p>
            ) : null}
          </div>
          </div>
        </div>

        <div className="sticky top-20 z-20 rounded-[28px] border border-outline/10 bg-surface-container-lowest/95 backdrop-blur shadow-ambient p-3">
          <div className="flex flex-wrap gap-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'documents' ? renderDocuments() : null}
        {activeTab === 'ai-insights' ? renderAiInsights() : null}
        {activeTab === 'sow-draft' ? renderSowDraft() : null}
        {activeTab === 'applied-rules' ? renderAppliedRules() : null}
        {activeTab === 'risk-issues' ? renderRiskIssues() : null}
        {activeTab === 'audit-trail' ? renderAuditTrail() : null}
      </div>
    </div>
  )
}


