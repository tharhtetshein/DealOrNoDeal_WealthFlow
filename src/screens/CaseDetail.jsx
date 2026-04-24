import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCheck,
  CheckCircle2,
  FileBadge2,
  FileText,
  Globe2,
  History,
  Loader2,
  PencilLine,
  Save,
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
  getActiveCaseId,
  getCaseFileById,
  getRequiredDocumentCategories,
  hasRequiredDocuments,
  hasRequiredFields,
  removeDocumentFromCase,
  submitCaseForCompliance,
  updateCaseData,
} from '../lib/caseFiles'
import { analyzeCaseDocuments, extractDocumentText } from '../lib/api'
import { hasFirebaseConfig, uploadCaseDocumentFile } from '../lib/firebase'

const allCategories = [
  'Passport / ID',
  'Bank Statements',
  'Source of Wealth (SoW)',
  'Utility Bill',
  'Tax Residency Bill',
]

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'ai-insights', label: 'AI Insights' },
  { id: 'sow-draft', label: 'SoW Draft' },
  { id: 'risk-issues', label: 'Risk & Issues' },
  { id: 'audit-trail', label: 'Audit Trail' },
]

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString()
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
    case 'Draft':
      return 'bg-secondary text-secondary-foreground'
    case 'Missing Documents':
      return 'bg-warning/15 text-warning'
    case 'In Review':
      return 'bg-tertiary/12 text-tertiary'
    case 'Ready for Review':
      return 'bg-success/12 text-success'
    case 'Escalated':
      return 'bg-error/10 text-error'
    case 'Approved':
      return 'bg-success/15 text-success'
    default:
      return 'bg-surface-container text-on-surface-variant'
  }
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

function getCategoryOptionLabel(category, documents = []) {
  const isUploaded = documents.some((document) => document.category === category)
  return `${category} — ${isUploaded ? 'Uploaded' : 'Not Uploaded'}`
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
  const missingKeyEvidence = ['Passport / ID', 'Bank Statements', 'Source of Wealth (SoW)']
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
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '--'
  }
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  return String(value)
}

function normalizeAiAnalysisPayload(payload = {}, fallback = {}) {
  const extractedData = payload.extractedData || {}
  const extractedFields = [
    ['name', 'Name'],
    ['occupation', 'Occupation'],
    ['employerOrBusiness', 'Employer / Business Name'],
    ['sourceOfWealthIndicators', 'Source of Wealth indicators'],
    ['ownershipPercentage', 'Ownership Percentage'],
    ['incomeIndicators', 'Income indicators'],
    ['countriesInvolved', 'Countries Involved'],
    ['keyDatesAndAmounts', 'Key dates and amounts'],
  ].map(([key, label]) => {
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
      source: source || '--',
    }
  }).filter(Boolean)

  const mismatches = (payload.mismatches || []).map((item, index) => ({
    id: item.id || `${item.field || item.label || 'mismatch'}-${index}`,
    label: item.field || item.label || 'Detected mismatch',
    declared: item.declaredValue || item.declared || 'Not declared',
    detected: item.detectedValue || item.detected || 'Not detected',
    issue: item.issue || '',
    source: item.sourceDocument || item.source || '--',
    severity: item.severity || 'Medium',
  }))

  const risks = (payload.riskFlags || payload.risks || fallback.risks || []).map((risk, index) => ({
    id: risk.id || `risk-${index}`,
    title: risk.title || 'Risk flag',
    severity: risk.severity || 'Medium',
    description: risk.description || risk.rationale || '',
    rationale: risk.rationale || risk.description || '',
    nextAction: risk.nextAction || '',
  }))

  const fallbackAssessment = assessAnalysisConfidence(
    fallback.missingCategories || [],
    mismatches,
    risks,
  )

  const confidence = payload.confidence
    || payload.sourceOfWealthDraft?.confidence
    || fallbackAssessment.level

  return {
    extractedFields,
    mismatches,
    risks,
    suggestions: payload.suggestedActions || payload.recommendations || fallback.suggestions || [],
    confidence,
    confidenceExplanation: payload.confidenceExplanation || fallbackAssessment.message,
    updatedAt: payload.updatedAt || fallback.updatedAt || null,
    beforeReadiness: payload.beforeReadiness ?? fallback.beforeReadiness ?? 0,
    afterReadiness: payload.afterReadiness ?? fallback.afterReadiness ?? 0,
    sourceOfWealthDraft: payload.sourceOfWealthDraft || null,
  }
}

function buildAuditEntries(caseFile) {
  const entries = [
    {
      timestamp: formatDate(caseFile.updatedAt),
      actor: 'RM',
      action: 'Reviewed case workspace and updated onboarding details.',
    },
    {
      timestamp: formatDate(caseFile.updatedAt),
      actor: 'System',
      action: 'Generated extracted-data summary and SoW narrative draft.',
    },
  ]

  if ((caseFile.documents || []).length > 0) {
    entries.unshift({
      timestamp: formatDate(caseFile.documents?.[caseFile.documents.length - 1]?.uploadedAt),
      actor: 'RM',
      action: `Uploaded ${(caseFile.documents || []).length} document(s) to the case file.`,
    })
  }

  if (caseFile.submittedAt) {
    entries.unshift({
      timestamp: formatDate(caseFile.submittedAt),
      actor: 'RM',
      action: 'Submitted case for compliance review.',
    })
  }

  return entries
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

export default function CaseDetail({ onNavigate }) {
  const [caseFile, setCaseFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(allCategories[0])
  const [uploading, setUploading] = useState(false)
  const [sowDraftText, setSowDraftText] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState('not-run')
  const [analysisUpdatedAt, setAnalysisUpdatedAt] = useState(null)
  const [analysisSnapshot, setAnalysisSnapshot] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(false)

  const handleCopyCaseId = async () => {
    if (!caseFile?.id || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(caseFile.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const refreshCase = async () => {
    const caseId = getActiveCaseId()
    const activeCase = caseId ? await getCaseFileById(caseId) : null
    setCaseFile(activeCase)
    setLoading(false)
    return activeCase
  }

  useEffect(() => {
    let isMounted = true

    const loadCase = async () => {
      const activeCase = await refreshCase()
      if (!isMounted) return

      const initialDraft = activeCase?.sowDraft?.narrativeSummary || buildSowDraft(activeCase || {}).narrativeSummary
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

  const derived = useMemo(() => {
    if (!caseFile) {
      return {
        readiness: 0,
        nextAction: 'Select a case from the dashboard.',
        completedCategories: 0,
        totalCategories: getRequiredDocumentCategories().length,
        missingCategories: [],
        extraction: buildMockExtraction({}),
        sowDraft: buildSowDraft({}),
        riskFlags: [],
        clientType: 'Individual',
        riskLevel: 'Low',
        auditEntries: [],
        analysisData: {
          extractedFields: [],
          mismatches: [],
          risks: [],
          suggestions: [],
          confidence: 'Low',
          updatedAt: null,
          beforeReadiness: 0,
          afterReadiness: 0,
        },
      }
    }

    const requiredCategories = getRequiredDocumentCategories()
    const uploadedCategories = new Set((caseFile.documents || []).map((item) => item.category))
    const completedCategories = requiredCategories.filter((category) => uploadedCategories.has(category)).length
    const missingCategories = requiredCategories.filter((category) => !uploadedCategories.has(category))
    const docScore = requiredCategories.length === 0 ? 0 : (completedCategories / requiredCategories.length) * 60
    const profileScore = hasRequiredFields(caseFile) ? 20 : 0
    const sowScore = sowDraftText.trim().length > 80 ? 20 : 0
    const baseReadiness = Math.round(docScore + profileScore + sowScore)

    const extraction = buildMockExtraction(caseFile)
    const activeAnalysis = analysisSnapshot || caseFile.aiAnalysis || null
    const savedSowDraft = caseFile.sowDraft || {}
    const defaultSowDraft = buildSowDraft(caseFile)
    const sowDraft = {
      primarySource: savedSowDraft.primarySource || defaultSowDraft.primarySource,
      supportingEvidence: savedSowDraft.supportingEvidence || defaultSowDraft.supportingEvidence,
      narrativeSummary: sowDraftText || savedSowDraft.narrativeSummary || defaultSowDraft.narrativeSummary,
      confidence: savedSowDraft.confidence || defaultSowDraft.confidence,
    }

    const riskFlags = buildRiskFlags(caseFile, missingCategories, extraction)
    const confidenceAssessment = assessAnalysisConfidence(missingCategories, extraction.mismatches, riskFlags)
    const fallbackAnalysisData = {
      extractedFields: [
        { label: 'Occupation', value: extraction.occupation, source: 'employment_letter.pdf' },
        { label: 'Employer / Business Name', value: extraction.employer, source: 'bank_statement.pdf' },
        { label: 'Source of Wealth indicators', value: 'Salary income, investment proceeds, retained business distributions', source: 'source_of_wealth.pdf' },
        { label: 'Ownership Percentage', value: extraction.ownershipPercentage, source: 'company_registry_extract.pdf' },
        { label: 'Countries Involved', value: extraction.countriesInvolved.join(', '), source: 'bank_statement.pdf' },
        { label: 'Key financial indicators', value: `Declared net worth ${caseFile.netWorth || '--'}`, source: 'bank_statement.pdf' },
      ],
      mismatches: extraction.mismatches,
      risks: riskFlags,
      suggestions: [
        missingCategories.length > 0 ? `Upload ${missingCategories[0]}${missingCategories.length > 1 ? ' and remaining required documents' : ''}` : 'Validate all uploaded supporting documents',
        extraction.mismatches.length > 0 ? `Verify ${extraction.mismatches[0].label.toLowerCase()}` : 'Confirm extracted data aligns with intake declarations',
        'Review AI extracted data before compliance handoff',
      ],
      confidence: confidenceAssessment.level,
      confidenceExplanation: confidenceAssessment.message,
      updatedAt: analysisUpdatedAt,
      beforeReadiness: Math.max(baseReadiness - (missingCategories.length > 0 ? 20 : 10), 0),
      afterReadiness: missingCategories.length > 0 ? Math.max(baseReadiness, 95) : baseReadiness,
    }
    const normalizedAnalysisData = activeAnalysis
      ? normalizeAiAnalysisPayload(activeAnalysis, {
        missingCategories,
        risks: riskFlags,
        suggestions: fallbackAnalysisData.suggestions,
        updatedAt: analysisUpdatedAt,
        beforeReadiness: fallbackAnalysisData.beforeReadiness,
        afterReadiness: fallbackAnalysisData.afterReadiness,
      })
      : fallbackAnalysisData

    const mismatchPenalty = getMismatchPenalty(normalizedAnalysisData.mismatches)
    const riskPenalty = normalizedAnalysisData.risks.reduce((total, risk) => {
      const severity = String(risk.severity || '').toLowerCase()
      if (severity === 'high') return total + 20
      if (severity === 'medium') return total + 10
      if (severity === 'low') return total + 4
      return total + 8
    }, 0)
    const readiness = Math.max(0, Math.min(100, Math.round(baseReadiness - mismatchPenalty - riskPenalty)))
    const riskLevel = deriveRiskLevel({
      missingCategories,
      mismatches: normalizedAnalysisData.mismatches,
      riskFlags: normalizedAnalysisData.risks,
      readiness,
    })
    const hasHighSeverityIssue = normalizedAnalysisData.risks.some((risk) => String(risk.severity || '').toLowerCase() === 'high')
      || normalizedAnalysisData.mismatches.some((mismatch) => String(mismatch.severity || '').toLowerCase() === 'high')
    let nextAction = 'Review case details and proceed with the next workflow step.'
    if (missingCategories.length > 0) nextAction = 'Resolve missing documents before compliance handoff.'
    else if (hasHighSeverityIssue || normalizedAnalysisData.mismatches.length > 0) nextAction = 'Resolve AI-detected mismatches and risk issues before submission.'
    else if (readiness < 100) nextAction = 'Review extracted data and finalize the SoW draft.'
    else nextAction = 'Submit for compliance review.'
    const clientType = Number(String(caseFile.netWorth || '').replace(/,/g, '')) >= 10000000 ? 'UHNWI' : 'HNWI'
    const analysisData = {
      ...normalizedAnalysisData,
      beforeReadiness: readiness,
      afterReadiness: Math.max(baseReadiness, readiness),
    }

    return {
      readiness,
      nextAction,
      completedCategories,
      totalCategories: requiredCategories.length,
      missingCategories,
      extraction,
      sowDraft,
      riskFlags,
      analysisData,
      clientType,
      riskLevel,
      auditEntries: buildAuditEntries(caseFile),
    }
  }, [caseFile, sowDraftText, analysisSnapshot, analysisUpdatedAt])

  const canSubmit = Boolean(caseFile) && derived.readiness >= 100 && derived.missingCategories.length === 0
  const selectedCategoryUploaded = (caseFile?.documents || []).some((document) => document.category === selectedCategory)

  const handleSaveDraft = async () => {
    if (!caseFile) return

    setSaving(true)
    setMessage('')

    const nextSowDraft = {
      primarySource: derived.sowDraft.primarySource,
      supportingEvidence: derived.sowDraft.supportingEvidence,
      narrativeSummary: sowDraftText,
      confidence: derived.sowDraft.confidence,
    }

    const updated = await updateCaseData(caseFile.id, {
      sowDraft: nextSowDraft,
      extractedData: derived.extraction,
      riskFlags: derived.riskFlags,
      aiAnalysis: analysisSnapshot || derived.analysisData,
      status: caseFile.status === 'Approved' ? 'Approved' : 'Draft',
    })

    if (updated) {
      setCaseFile(updated)
      setMessage('Draft saved. Workspace updates are stored to the case file.')
    }

    setSaving(false)
  }

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
    setMessage('Case submitted successfully. Status updated to In Review.')
    setSubmitting(false)
  }

  const handleFileInput = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!caseFile || files.length === 0) return

    setUploading(true)
    setMessage('')

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
          setUploading(false)
          setMessage(`Unable to upload ${file.name} to Firebase Storage. Check your Firebase Storage setup.`)
          event.target.value = ''
          return
        }
      }

      await addDocumentToCase(caseFile.id, {
        id: documentId,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        category: selectedCategory,
        uploader: 'RM Uploaded',
        extractedText: extracted.text || '',
        mimeType: extracted.mimeType || file.type || '',
        storagePath: storageMeta.storagePath || null,
        downloadURL: storageMeta.downloadURL || null,
        uploadedAt: new Date().toISOString(),
      })
    }

    const updated = await refreshCase()
    if (updated) setCaseFile(updated)
    setAnalysisStatus((current) => (current === 'completed' ? 'not-run' : current))
    setUploading(false)
    setMessage('Documents uploaded and case readiness refreshed.')
    event.target.value = ''
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
        beforeReadiness: Math.max(derived.readiness - (derived.riskFlags.length > 0 ? 15 : 5), 0),
        afterReadiness: derived.missingCategories.length === 0 ? Math.max(derived.readiness, 95) : Math.max(derived.readiness, 85),
      })

      const nextSowDraft = normalizedAnalysis.sourceOfWealthDraft
        ? {
          primarySource: normalizedAnalysis.sourceOfWealthDraft.primarySourceOfWealth || derived.sowDraft.primarySource,
          supportingEvidence: normalizedAnalysis.sourceOfWealthDraft.supportingEvidence || derived.sowDraft.supportingEvidence,
          narrativeSummary: normalizedAnalysis.sourceOfWealthDraft.narrativeExplanation || sowDraftText,
          confidence: normalizedAnalysis.sourceOfWealthDraft.confidence || normalizedAnalysis.confidence,
        }
        : null

      const updated = await updateCaseData(caseFile.id, {
        aiAnalysis: {
          ...aiPayload,
          confidence: normalizedAnalysis.confidence,
          confidenceExplanation: normalizedAnalysis.confidenceExplanation,
          beforeReadiness: normalizedAnalysis.beforeReadiness,
          afterReadiness: normalizedAnalysis.afterReadiness,
        },
        ...(nextSowDraft ? { sowDraft: nextSowDraft } : {}),
      })

      if (updated) {
        setCaseFile(updated)
        setAnalysisSnapshot({
          ...aiPayload,
          confidence: normalizedAnalysis.confidence,
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
      setAnalysisStatus('not-run')
      setMessage('AI analysis failed. Check that the Groq backend is running and your GROQ_API_KEY is set.')
    }
  }

  const analysisStatusTone = analysisStatus === 'processing'
    ? 'bg-warning/15 text-warning'
    : analysisStatus === 'completed'
      ? 'bg-success/12 text-success'
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

            <div className="rounded-2xl bg-surface-container-low px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Next Required Action</p>
              <p className="text-sm leading-6 text-on-surface">{derived.nextAction}</p>
            </div>

            <div className="border-t border-outline/10 pt-5">
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-4">Client Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  { label: 'Client Name', value: caseFile.clientName || '--', icon: UserRound },
                  { label: 'Nationality', value: caseFile.nationality || '--', icon: Globe2 },
                  { label: 'Country of Residence', value: caseFile.residence || '--', icon: Globe2 },
                  { label: 'Occupation', value: caseFile.occupation || '--', icon: Briefcase },
                  { label: 'Net Worth', value: formatCurrencyLikeNumber(caseFile.netWorth), icon: Building2 },
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

  const renderDocuments = () => (
    <SectionCard title="Documents" description="Upload files, review evidence, and check required categories." icon={FileText}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-3">
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className={`rounded-xl border bg-surface px-3 py-2 text-sm text-on-surface transition-colors ${
                  selectedCategoryUploaded
                    ? 'border-success/40 shadow-[0_0_0_1px_rgba(34,197,94,0.08)]'
                    : 'border-warning/35 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]'
                }`}
              >
                {allCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((category) => {
                  const uploaded = (caseFile?.documents || []).some((document) => document.category === category)
                  return (
                    <div
                      key={category}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                        uploaded
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${uploaded ? 'bg-success' : 'bg-outline/50'}`} />
                      <span>{category}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <label className="block rounded-2xl border-2 border-dashed border-outline/20 bg-surface px-6 py-10 text-center cursor-pointer hover:border-primary/25 transition-colors">
            <input type="file" multiple className="hidden" onChange={handleFileInput} />
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>
            <p className="text-sm font-semibold text-on-surface">{uploading ? 'Uploading...' : 'Drag and drop or click to upload'}</p>
            <p className="mt-1 text-sm text-on-surface-variant">Upload onboarding evidence for this case.</p>
          </label>

          <div className="space-y-3">
            {(caseFile.documents || []).length > 0 ? (
              (caseFile.documents || []).map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline/10 bg-surface p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-on-surface-variant" />
                      <p className="text-sm font-medium text-on-surface truncate">{doc.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{doc.category} • {doc.uploader} • {doc.size || 'File added'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-variant">{formatDate(doc.uploadedAt)}</span>
                    <button onClick={() => handleRemoveDocument(doc.id)} className="text-xs font-medium text-error hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-outline/10 bg-surface p-4">
                <p className="text-sm text-on-surface-variant">No documents uploaded yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-outline/10 bg-surface p-4">
          <p className="text-sm font-semibold text-on-surface mb-4">Required Document Checklist</p>
          <div className="space-y-3">
            {getRequiredDocumentCategories().map((category) => {
              const present = (caseFile.documents || []).some((doc) => doc.category === category)
              return (
                <div key={category} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-lowest px-3 py-3">
                  <span className="text-sm text-on-surface">{category}</span>
                  {present ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-error">
                      <AlertCircle className="w-4 h-4" />
                      Missing
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  )

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
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1">Status</p>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${analysisStatusTone}`}>
            {analysisStatus === 'not-run' ? 'Not Run' : analysisStatus === 'processing' ? 'Processing' : 'Completed'}
          </span>
        </div>
        <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1">Last analyzed</p>
          <p className="text-sm font-medium text-on-surface">{derived.analysisData.updatedAt ? formatDate(derived.analysisData.updatedAt) : '--'}</p>
        </div>
        <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1">Confidence Level</p>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getConfidenceTone(derived.analysisData.confidence || 'Low')}`}>
            {derived.analysisData.confidence || 'Low'}
          </span>
          <p className="mt-2 max-w-[240px] text-xs leading-5 text-on-surface-variant">
            {derived.analysisData.confidenceExplanation || 'Confidence will update after AI analysis runs.'}
          </p>
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
              {derived.analysisData.suggestions.map((suggestion) => (
                <div key={suggestion} className="flex items-start gap-3 rounded-xl bg-surface-container-lowest px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                  <p className="text-sm leading-6 text-on-surface">{suggestion}</p>
                </div>
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
    </SectionCard>
  )

  const renderSowDraft = () => (
    <SectionCard title="SoW Draft" description="Review and refine the source of wealth summary." icon={PencilLine}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-outline/10 bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Primary Source of Wealth</p>
          <p className="text-sm leading-6 text-on-surface">{derived.sowDraft.primarySource}</p>
        </div>
        <div className="rounded-2xl border border-outline/10 bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Supporting Evidence</p>
          <p className="text-sm leading-6 text-on-surface">{derived.sowDraft.supportingEvidence}</p>
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
    </SectionCard>
  )

  const renderRiskIssues = () => (
    <SectionCard title="Risk & Issues" description="Severity-based flags, inconsistencies, and next actions." icon={ShieldAlert}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Risk Flags</h3>
            <div className="space-y-3">
              {derived.riskFlags.length > 0 ? derived.riskFlags.map((flag) => (
                <div key={flag.title} className="rounded-xl bg-surface-container-lowest px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-on-surface">{flag.title}</p>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getSeverityTone(flag.severity)}`}>
                      {flag.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">{flag.description}</p>
                </div>
              )) : (
                <div className="rounded-xl bg-success/5 border border-success/10 px-4 py-4">
                  <p className="text-sm text-on-surface">No active risk flags.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Detected Inconsistencies</h3>
            <div className="space-y-3">
              {derived.analysisData.mismatches.map((item) => (
                <div key={item.label} className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                  <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                    Detected from: {item.source || 'bank_statement.pdf'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    Declared: <span className="font-medium text-on-surface">{item.declared}</span> | Detected: <span className="font-medium text-warning">{item.detected}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline/10 bg-surface p-4">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Suggested Next Actions</h3>
            <div className="space-y-3">
              {derived.riskFlags.map((flag) => (
                <div key={flag.title} className="rounded-xl bg-surface-container-lowest px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-primary mb-2">{flag.title}</p>
                  <p className="text-sm leading-6 text-on-surface">{flag.nextAction}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )

  const renderAuditTrail = () => (
    <SectionCard title="Audit Trail" description="Timeline of key actions for this case." icon={History}>
      <div className="relative pl-3">
        <div className="absolute left-[1.45rem] top-2 bottom-2 w-px bg-outline/30" />
        {derived.auditEntries.map((entry, index) => (
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
        ))}
      </div>
    </SectionCard>
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(202,12,26,0.08),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,247,245,1))] p-6 md:p-8 pb-12">
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
                  {caseFile.status}
                </span>
              </div>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-outline/20 bg-surface px-4 py-2 text-sm font-semibold text-on-surface hover:border-primary/20 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit for Compliance Review
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-outline/10 bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant mb-1.5">Readiness</p>
              <p className="text-[1.75rem] font-bold text-on-surface">{derived.readiness}%</p>
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
          </div>
        </div>

        <div className="sticky top-20 z-20 rounded-[28px] border border-outline/10 bg-surface-container-lowest/95 backdrop-blur shadow-ambient p-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
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
        {activeTab === 'risk-issues' ? renderRiskIssues() : null}
        {activeTab === 'audit-trail' ? renderAuditTrail() : null}
      </div>
    </div>
  )
}
