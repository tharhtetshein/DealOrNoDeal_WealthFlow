import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Circle,
  Download,
  Eye,
  FileText,
  MessageCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import {
  addComplianceComment,
  CASE_STATUS,
  calculateReadinessScore,
  getActiveCaseId,
  getCaseFileById,
  getComplianceChecklistStatus,
  getDocumentCompletionSummary,
  reviewDocument,
  submitComplianceDecision,
  updateCaseData,
  updateComplianceChecklist,
  COMPLIANCE_CHECKLIST_ITEMS,
} from '../lib/caseFiles'

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

function statusTone(status) {
  if (/approved/i.test(status)) return 'bg-success/12 text-success'
  if (/rejected|escalated/i.test(status)) return 'bg-error/10 text-error'
  if (/action required/i.test(status)) return 'bg-warning/15 text-warning'
  return 'bg-tertiary/12 text-tertiary'
}

function riskTone(risk) {
  if (risk === 'High') return 'bg-error/10 text-error'
  if (risk === 'Medium') return 'bg-warning/15 text-warning'
  return 'bg-success/12 text-success'
}

function docStatusTone(status) {
  if (status === 'uploaded') return 'bg-success/12 text-success'
  if (status === 'needs_review') return 'bg-warning/15 text-warning'
  return 'bg-error/10 text-error'
}

function getDocumentValidation(documentItem) {
  if (documentItem.status === 'missing') return { label: 'Needs Check', tone: 'bg-error/10 text-error' }
  if (documentItem.status === 'needs_review') return { label: 'Needs Check', tone: 'bg-warning/15 text-warning' }
  const documents = documentItem.documents || []
  const suspicious = documents.some((document) => /invalid|suspicious/i.test(String(document.validationStatus || '')))
  if (suspicious) return { label: 'Suspicious', tone: 'bg-error/10 text-error' }
  return { label: 'Valid', tone: 'bg-success/12 text-success' }
}

function getRiskLevel(caseFile, readiness) {
  const snapshot = caseFile?._lastRuleSnapshot || caseFile?.ruleSnapshots?.[caseFile.ruleSnapshots.length - 1]
  if (snapshot?.computedMetrics?.finalRiskLevel) return snapshot.computedMetrics.finalRiskLevel
  const risks = caseFile?.aiAnalysis?.risks || []
  const high = risks.some((risk) => /high|critical/i.test(String(risk.severity || risk.priority || '')))
  const medium = risks.some((risk) => /medium/i.test(String(risk.severity || risk.priority || '')))
  if (high) return 'High'
  if (medium || readiness < 100) return 'Medium'
  return 'Low'
}

function getRiskFlags(caseFile, completion) {
  const aiRisks = (caseFile?.aiAnalysis?.risks || []).map((risk, index) => ({
    id: risk.id || `risk-${index}`,
    title: risk.title || risk.description || 'AI risk finding',
    severity: risk.severity || risk.priority || 'Medium',
    description: risk.description || risk.nextAction || '',
  }))

  const mismatches = (caseFile?.aiAnalysis?.mismatches || []).map((item, index) => ({
    id: item.id || `mismatch-${index}`,
    title: item.field || item.label || 'Detected inconsistency',
    severity: item.severity || 'Medium',
    description: item.issue || `${item.declaredValue || item.declared || 'Declared value'} differs from ${item.detectedValue || item.detected || 'detected value'}.`,
  }))

  const missingDocs = completion.missingRequiredDocuments.map((item) => ({
    id: `missing-${item.key || item.label}`,
    title: `Missing ${item.label}`,
    severity: 'High',
    description: item.missingReason || 'Required document is not uploaded.',
  }))

  // Add readiness-based flags to explain Medium risk when readiness < 100
  const readinessFlags = []
  if (!completion?.allRequiredComplete) {
    const incompleteCount = completion?.entries?.filter((e) => e.required && e.state !== 'complete').length || 0
    readinessFlags.push({
      id: 'readiness-documents',
      title: 'Document Completeness',
      severity: 'Medium',
      description: incompleteCount > 0
        ? `${incompleteCount} required document categories are incomplete.`
        : 'Required documents are not fully complete.',
    })
  }
  if (caseFile?.status === CASE_STATUS.ACTION_REQUIRED) {
    readinessFlags.push({
      id: 'readiness-action-required',
      title: 'Request More Information from RM',
      severity: 'Medium',
      description: 'Compliance previously requested more information. Awaiting RM response.',
    })
  }

  return [...missingDocs, ...aiRisks, ...mismatches, ...readinessFlags]
}

function getSourceOfWealth(caseFile) {
  return caseFile?.sowDraft?.primarySource
    || caseFile?.aiAnalysis?.sowDraft?.primarySource
    || caseFile?.aiAnalysis?.extractedData?.sourceOfWealthIndicators?.value
    || caseFile?.purpose
    || 'Not available'
}

function getSowNarrative(caseFile) {
  return caseFile?.sowDraft?.narrativeSummary
    || caseFile?.aiAnalysis?.sourceOfWealthDraft?.narrativeExplanation
    || caseFile?.aiAnalysis?.sowDraft?.narrativeSummary
    || ''
}

function getSowSupportingEvidence(caseFile) {
  return caseFile?.sowDraft?.supportingEvidence
    || caseFile?.aiAnalysis?.sourceOfWealthDraft?.supportingEvidence
    || ''
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function ComplianceCaseReview({ onNavigate }) {
  const [caseFile, setCaseFile] = useState(null)
  const [readiness, setReadiness] = useState(null)
  const [completion, setCompletion] = useState(null)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentAudience, setCommentAudience] = useState('Internal')
  const [decisionNote, setDecisionNote] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [checklist, setChecklist] = useState(null)
  const [documentCommentModal, setDocumentCommentModal] = useState(null)
  const [documentCommentText, setDocumentCommentText] = useState('')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const renderDocumentControls = (document) => {
    const currentReviewStatus = document.reviewStatus
    return (
      <div key={document.id || document.name} className="rounded-xl border border-outline/10 bg-surface-container-lowest px-3 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-xs font-semibold text-on-surface">
            {document.name || document.category || 'Uploaded document'}
          </p>
          {currentReviewStatus ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              currentReviewStatus === 'accept' ? 'bg-success/12 text-success' :
              currentReviewStatus === 'needs_clarification' ? 'bg-warning/15 text-warning' :
              'bg-error/10 text-error'
            }`}>
              {currentReviewStatus === 'accept' ? 'Accepted' : currentReviewStatus === 'needs_clarification' ? 'Needs Clarification' : 'Rejected'}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleViewDocument(document)}
            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
          >
            <Eye className="h-3 w-3" />
            Open Full Document
          </button>
          <button
            onClick={() => setSelectedDocument(document)}
            className="inline-flex items-center gap-1 rounded-full border border-outline/20 bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface hover:border-primary/30"
          >
            <FileText className="h-3 w-3" />
            Preview
          </button>
          <button
            onClick={() => handleDocumentReview(document.id, 'accept')}
            disabled={currentReviewStatus === 'accept'}
            className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/15 disabled:opacity-50"
          >
            <ThumbsUp className="h-3 w-3" />
            Accept
          </button>
          <button
            onClick={() => handleDocumentReview(document.id, 'needs_clarification')}
            disabled={currentReviewStatus === 'needs_clarification'}
            className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning hover:bg-warning/15 disabled:opacity-50"
          >
            <AlertTriangle className="h-3 w-3" />
            Needs Clarification
          </button>
          <button
            onClick={() => handleDocumentReview(document.id, 'reject')}
            disabled={currentReviewStatus === 'reject'}
            className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2.5 py-1 text-xs font-semibold text-error hover:bg-error/15 disabled:opacity-50"
          >
            <ThumbsDown className="h-3 w-3" />
            Reject
          </button>
          <button
            onClick={() => setDocumentCommentModal({ documentId: document.id, action: 'comment', existingComment: document.reviewComment })}
            className="inline-flex items-center gap-1 rounded-full border border-outline/20 bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface hover:border-primary/30"
          >
            <MessageSquare className="h-3 w-3" />
            {document.reviewComment ? 'Edit Comment' : 'Add Comment'}
          </button>
        </div>
      </div>
    )
  }

  const loadCase = async () => {
    setLoading(true)
    const caseId = getActiveCaseId()
    let nextCase = caseId ? await getCaseFileById(caseId) : null
    if (nextCase?.status === CASE_STATUS.PENDING_REVIEW) {
      const result = await updateCaseData(nextCase.id, {
        status: CASE_STATUS.UNDER_REVIEW,
        assignedComplianceOfficer: 'Compliance Officer',
        reviewStartedAt: nextCase.reviewStartedAt || new Date().toISOString(),
      })
      if (result) {
        nextCase = result
        setMessage(`Case auto-transitioned to In Review. Status: ${result.status}`)
      } else {
        setMessage(`Failed to transition case status from Submitted for Review`)
      }
    }
    const nextReadiness = nextCase ? calculateReadinessScore(nextCase) : null
    setCaseFile(nextCase)
    setReadiness(nextReadiness)
    setCompletion(nextCase ? getDocumentCompletionSummary(nextCase) : null)
    setChecklist(nextCase ? getComplianceChecklistStatus(nextCase) : null)
    setLoading(false)
  }

  const handleDocumentReview = async (documentId, action) => {
    if (!caseFile) return
    if (action === 'needs_clarification' || action === 'reject') {
      setDocumentCommentModal({ documentId, action })
      return
    }
    const result = await reviewDocument(caseFile.id, documentId, action)
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setMessage(`Document marked as ${action.replace('_', ' ')}.`)
    await loadCase()
  }

  const handleDocumentReviewWithComment = async () => {
    if (!caseFile || !documentCommentModal) return
    const { documentId, action } = documentCommentModal
    const result = await reviewDocument(caseFile.id, documentId, action, documentCommentText)
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setDocumentCommentModal(null)
    setDocumentCommentText('')
    setMessage(`Document marked as ${action.replace('_', ' ')}.`)
    await loadCase()
  }

  const handleChecklistToggle = async (key, checked) => {
    if (!caseFile) return
    const item = checklist?.items.find((entry) => entry.key === key)
    const overrideReason = item?.ruleDriven && !checked
      ? window.prompt('Reason for overriding this rule-driven checklist item?')
      : ''
    if (item?.ruleDriven && !checked && !String(overrideReason || '').trim()) {
      setMessage('Rule-driven overrides require a reason.')
      return
    }
    const overridePolicyReference = item?.ruleDriven && !checked
      ? window.prompt('Policy reference for this override?')
      : ''
    if (item?.ruleDriven && !checked && !String(overridePolicyReference || '').trim()) {
      setMessage('Rule-driven overrides require a policy reference.')
      return
    }
    const result = await updateComplianceChecklist(caseFile.id, {
      [key]: { checked, overrideReason, overridePolicyReference },
    })
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setChecklist(getComplianceChecklistStatus(result.caseFile))
    setMessage('Checklist updated.')
  }

  useEffect(() => {
    loadCase()
  }, [])

  const readinessScore = readiness?.percentage ?? 0
  const riskLevel = useMemo(() => getRiskLevel(caseFile, readinessScore), [caseFile, readinessScore])
  const riskFlags = useMemo(() => getRiskFlags(caseFile, completion || { missingRequiredDocuments: [] }), [caseFile, completion])
  const decisionNoteMissing = !String(decisionNote || '').trim()
  const approvalIssues = [
    !completion?.allRequiredComplete ? 'Required documents are not complete.' : '',
    riskFlags.some((flag) => /high|critical/i.test(String(flag.severity || ''))) ? 'High or critical risk items remain open.' : '',
    !checklist?.allComplete ? 'Compliance checklist is not complete.' : '',
    decisionNoteMissing ? 'Decision note is required.' : '',
  ].filter(Boolean)
  const approveDisabled = approvalIssues.length > 0
  const anyDecisionDisabled = decisionNoteMissing
  const comments = [...(caseFile?.comments || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const handleAddComment = async () => {
    if (!caseFile) return
    const result = await addComplianceComment(caseFile.id, {
      text: commentText,
      audience: commentAudience,
    })
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setCommentText('')
    setMessage('Comment added.')
    await loadCase()
  }

  const handleDecision = async (decision) => {
    if (!caseFile) return
    const trimmedNote = String(decisionNote || '').trim()
    if (decision === 'approve' && approvalIssues.length > 0) {
      setAttemptedSubmit(true)
      setMessage(`Cannot approve yet: ${approvalIssues.join(' ')}`)
      return
    }
    if (!trimmedNote) {
      setAttemptedSubmit(true)
      setMessage('Decision note is required before submitting.')
      return
    }
    setAttemptedSubmit(false)
    const result = await submitComplianceDecision(caseFile.id, decision, {
      note: trimmedNote,
    })
    if (!result.ok) {
      setMessage(`Approval failed: ${result.reason}`)
      return
    }
    setDecisionNote('')
    setMessage(decision === 'approve' ? 'Case approved and sent to Operations.' : decision === 'request_info' ? 'Case returned to RM as Request More Information.' : 'Case rejected and locked.')
    await loadCase()
  }

  const handleViewDocument = (document) => {
    if (!document) return

    if (document.downloadURL) {
      window.open(document.downloadURL, '_blank', 'noopener,noreferrer')
      return
    }

    const documentWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!documentWindow) {
      setMessage('Popup blocked. Allow popups to view the document in a new window.')
      return
    }

    const title = escapeHtml(document.name || document.category || 'Uploaded document')
    const body = escapeHtml(document.extractedText || 'No extracted document text is available for this uploaded file.')
    documentWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #171212; line-height: 1.6; }
            .meta { color: #7b5147; margin-bottom: 24px; }
            pre { white-space: pre-wrap; word-wrap: break-word; background: #f7f4f3; border: 1px solid #eee2df; border-radius: 12px; padding: 20px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">
            <div><strong>Category:</strong> ${escapeHtml(document.category || '--')}</div>
            <div><strong>Uploaded:</strong> ${escapeHtml(formatDateTime(document.uploadedAt))}</div>
          </div>
          <pre>${body}</pre>
        </body>
      </html>
    `)
    documentWindow.document.close()
  }

  const handleDownloadSowDocument = () => {
    if (!caseFile) return
    const fileStem = `${caseFile.clientName || 'client'}-source-of-wealth`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
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
  <p class="meta">Client: ${escapeHtml(caseFile.clientName || 'Client')} | Case ID: ${escapeHtml(caseFile.id || '')} | Generated: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
  <div class="box"><h2>Primary Source of Wealth</h2><p>${escapeHtml(getSourceOfWealth(caseFile))}</p></div>
  <div class="box"><h2>Supporting Evidence</h2><p>${escapeHtml(getSowSupportingEvidence(caseFile) || 'Not available')}</p></div>
  <div class="box"><h2>Narrative Summary</h2><p>${escapeHtml(getSowNarrative(caseFile) || getSourceOfWealth(caseFile))}</p></div>
  <p class="meta">Prepared for Compliance review.</p>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <p className="text-sm text-on-surface-variant">Loading compliance review...</p>
      </div>
    )
  }

  if (!caseFile) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <button onClick={() => onNavigate?.('dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to Compliance Queue
        </button>
        <div className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-8 shadow-ambient">
          <p className="text-sm text-on-surface-variant">No active case selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface p-8 pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <button onClick={() => onNavigate?.('dashboard')} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to Compliance Queue
        </button>

        <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Compliance Case Review</p>
              <h1 className="font-display text-4xl font-bold text-on-surface">{caseFile.clientName || 'Unnamed Client'}</h1>
              <p className="mt-2 text-sm text-on-surface-variant">Case ID: {caseFile.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Status</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(caseFile.status)}`}>{caseFile.status}</span>
              </div>
              <div className="rounded-2xl bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Readiness</p>
                <p className="mt-2 text-2xl font-bold text-success">{readinessScore}%</p>
              </div>
              <div className="rounded-2xl bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Risk</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${riskTone(riskLevel)}`}>{riskLevel}</span>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-5 py-3 text-sm text-on-surface-variant shadow-ambient">
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
              <div className="mb-5 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl font-bold text-on-surface">Client Profile</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ['Name', caseFile.clientName],
                  ['Nationality', caseFile.nationality],
                  ['Occupation', caseFile.occupation],
                  ['Risk Level', riskLevel],
                  ['Source of Wealth', getSourceOfWealth(caseFile), 'md:col-span-2'],
                ].map(([label, value, spanClass = '']) => (
                  <div key={label} className={`rounded-2xl bg-surface p-4 ${spanClass}`}>
                    <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
                    <p className={`mt-3 text-sm leading-6 text-on-surface ${label === 'Source of Wealth' ? 'font-medium max-w-4xl' : 'font-semibold'}`}>{value || '--'}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleDownloadSowDocument}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
                >
                  <Download className="h-4 w-4" />
                  Download SoW Document
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
              <div className="mb-5 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl font-bold text-on-surface">Document Review</h2>
              </div>
              <div className="space-y-3">
                {(completion?.requiredDocuments || []).map((item) => {
                  const validation = getDocumentValidation(item)
                  const linkedDocuments = item.documents || []
                  const firstDoc = item.documents?.[0] || null
                  const docReviewStatus = firstDoc?.reviewStatus
                  return (
                    <div key={item.label} className="rounded-2xl border border-outline/10 bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-on-surface">{item.label}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{item.category}</p>
                          {firstDoc?.reviewComment && (
                            <p className="mt-1 text-xs text-on-surface-variant italic">"{firstDoc.reviewComment}"</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${docStatusTone(item.status)}`}>
                            {item.status === 'uploaded' ? 'Uploaded' : item.status === 'needs_review' ? 'In Review' : 'Missing'}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${validation.tone}`}>{validation.label}</span>
                          {docReviewStatus && (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              docReviewStatus === 'accept' ? 'bg-success/12 text-success' :
                              docReviewStatus === 'needs_clarification' ? 'bg-warning/15 text-warning' :
                              'bg-error/10 text-error'
                            }`}>
                              {docReviewStatus === 'accept' ? 'Accepted' : docReviewStatus === 'needs_clarification' ? 'Needs Clarification' : 'Rejected'}
                            </span>
                          )}
                        </div>
                      </div>
                      {linkedDocuments.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-outline/10 pt-3">
                          {linkedDocuments.map((document) => renderDocumentControls(document))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {(() => {
                  const shownIds = new Set((completion?.requiredDocuments || []).flatMap((item) => (
                    item.documents || []
                  )).map((document) => document.id || document.name))
                  const additionalDocuments = (caseFile.documents || []).filter((document) => !shownIds.has(document.id || document.name))

                  if (additionalDocuments.length === 0) return null

                  return (
                    <div className="rounded-2xl border border-outline/10 bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-on-surface">Additional RM Uploaded Evidence</p>
                          <p className="mt-1 text-xs text-on-surface-variant">Optional evidence and supporting documents uploaded by the RM.</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {additionalDocuments.length} file{additionalDocuments.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 border-t border-outline/10 pt-3">
                        {additionalDocuments.map((document) => renderDocumentControls(document))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </section>

            <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl font-bold text-on-surface">Compliance Checklist</h2>
                </div>
                {checklist && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    checklist.allComplete ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning'
                  }`}>
                    {checklist.completed}/{checklist.total} Complete
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {checklist?.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-outline/10 bg-surface p-4 hover:bg-surface-container-low transition-colors"
                  >
                    <div className="mt-0.5">
                      {item.checked ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-on-surface-variant" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-on-surface">{item.label}</p>
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                          {item.ruleDriven ? 'Rule-driven' : item.category}
                        </span>
                      </div>
                      {item.ruleDriven ? (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {item.reason || 'Required by rule'} {item.policyReference ? `Policy: ${item.policyReference}` : ''}
                        </p>
                      ) : null}
                      {item.checked && item.checkedAt && (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Checked by {item.checkedBy} at {new Date(item.checkedAt).toLocaleString()}
                        </p>
                      )}
                      {item.overrideReason ? (
                        <p className="mt-1 text-xs text-warning">
                          Override: {item.overrideReason} ({item.overridePolicyReference})
                        </p>
                      ) : null}
                    </div>
                    <input
                      type="checkbox"
                      checked={!!item.checked}
                      onChange={(e) => handleChecklistToggle(item.key, e.target.checked)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
              {!checklist?.allComplete && (
                <p className="mt-4 rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">
                  All checklist items must be completed before approval.
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
              <div className="mb-5 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl font-bold text-on-surface">AI Risk Analysis</h2>
              </div>
              <div className="mb-4 rounded-2xl bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Risk Score</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${riskTone(riskLevel)}`}>{riskLevel}</span>
              </div>

              {/* Debug info - shows why risk is calculated */}
              <div className="mb-4 rounded-2xl bg-surface-container-high p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Risk Factors</p>
                <div className="space-y-1 text-xs">
                  <p className="text-on-surface">Documents Complete: <span className={completion?.allRequiredComplete ? 'text-success' : 'text-error'}>{completion?.allRequiredComplete ? 'Yes' : 'No'}</span></p>
                  <p className="text-on-surface">Readiness Score: <span className={readinessScore === 100 ? 'text-success' : 'text-warning'}>{readinessScore}%</span></p>
                  <p className="text-on-surface">AI Risks Count: <span className="text-on-surface-variant">{caseFile?.aiAnalysis?.risks?.length || 0}</span></p>
                  <p className="text-on-surface">Mismatches Count: <span className="text-on-surface-variant">{caseFile?.aiAnalysis?.mismatches?.length || 0}</span></p>
                  <p className="text-on-surface">Risk Flags Generated: <span className="text-on-surface-variant">{riskFlags.length}</span></p>
                </div>
              </div>

              <div className="space-y-3">
                {riskFlags.length > 0 ? riskFlags.map((flag) => (
                  <div key={flag.id} className={`rounded-2xl border p-4 ${/high|critical/i.test(String(flag.severity || '')) ? 'border-error/20 bg-error/5' : 'border-warning/20 bg-warning/5'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-on-surface">{flag.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskTone(/high|critical/i.test(String(flag.severity || '')) ? 'High' : 'Medium')}`}>
                        {flag.severity}
                      </span>
                    </div>
                    {flag.description ? <p className="mt-2 text-sm leading-6 text-on-surface-variant">{flag.description}</p> : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-success/10 bg-success/5 p-4">
                    <p className="text-sm font-semibold text-success">No AI risk flags detected.</p>
                  </div>
                )}
              </div>
            </section>

          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
              <div className="mb-5 flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-bold text-on-surface">Comments</h2>
              </div>
              <div className="space-y-3">
                <select
                  value={commentAudience}
                  onChange={(event) => setCommentAudience(event.target.value)}
                  className="w-full rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Internal">Internal note</option>
                  <option value="RM Feedback">Feedback for RM</option>
                </select>
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  rows={4}
                  placeholder="Add compliance note..."
                  className="w-full resize-none rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button onClick={handleAddComment} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
                  <Send className="h-4 w-4" />
                  Add Comment
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {comments.length > 0 ? comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface">{comment.author || 'Compliance Officer'}</p>
                      <span className="rounded-full bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface-variant">{comment.audience || 'Internal'}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">{comment.text}</p>
                    <p className="mt-2 text-xs text-on-surface-variant">{formatDateTime(comment.createdAt)}</p>
                  </div>
                )) : (
                  <p className="rounded-2xl bg-surface p-4 text-sm text-on-surface-variant">No comments yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Decision Panel</p>
                <h2 className="mt-2 font-display text-xl font-bold text-on-surface">Compliance Decision</h2>
              </div>
              <textarea
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                rows={3}
                placeholder="Decision note or RM feedback (required)..."
                className={`mb-3 w-full resize-none rounded-xl border px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 ${
                  decisionNoteMissing ? 'border-error/50 bg-error/5 focus:ring-error/20' : 'border-outline/15 bg-surface focus:ring-primary/20'
                }`}
              />
              {attemptedSubmit && decisionNoteMissing && (
                <p className="mb-3 rounded-xl bg-error/10 px-3 py-2 text-xs text-error">
                  Decision note is required before submitting any action.
                </p>
              )}
              {approvalIssues.length > 0 ? (
                <p className="mb-3 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                  Approve is unavailable: {approvalIssues.join(' ')}
                </p>
              ) : null}
              <div className="space-y-2">
                <button
                  onClick={() => handleDecision('approve')}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
                    approveDisabled ? 'bg-success/60 hover:bg-success/70' : 'bg-success hover:bg-success/90'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Case
                </button>
                <button
                  onClick={() => handleDecision('request_info')}
                  disabled={anyDecisionDisabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-warning hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Request More Information
                </button>
                <button
                  onClick={() => handleDecision('reject')}
                  disabled={anyDecisionDisabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Case
                </button>
              </div>
            </section>

            {selectedDocument ? (
              <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inline Preview</p>
                    <h2 className="mt-1 font-display text-xl font-bold text-on-surface">{selectedDocument.category || 'Document'}</h2>
                  </div>
                  <button onClick={() => setSelectedDocument(null)} className="rounded-full border border-outline/20 px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/30">
                    Close
                  </button>
                </div>
                <p className="text-sm font-semibold text-on-surface">{selectedDocument.name}</p>
                <p className="mt-1 text-xs text-on-surface-variant">Uploaded {formatDateTime(selectedDocument.uploadedAt)}</p>
                <div className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-surface p-4 text-xs leading-5 text-on-surface-variant">
                  {selectedDocument.extractedText || 'No extracted preview text available. Use View to open the original file if a stored file URL exists.'}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Document Comment Modal */}
      {documentCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
            <div className="mb-4">
              <h3 className="font-display text-lg font-bold text-on-surface">
                {documentCommentModal.action === 'needs_clarification' ? 'Request Clarification' :
                 documentCommentModal.action === 'reject' ? 'Reject Document' : 'Add Document Comment'}
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {documentCommentModal.action === 'needs_clarification' ? 'Explain what clarification is needed from the RM:' :
                 documentCommentModal.action === 'reject' ? 'Explain why this document is being rejected:' : 'Add a comment to this document:'}
              </p>
            </div>
            <textarea
              value={documentCommentText}
              onChange={(e) => setDocumentCommentText(e.target.value)}
              rows={4}
              placeholder="Enter your comment..."
              className="mb-4 w-full resize-none rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDocumentCommentModal(null)
                  setDocumentCommentText('')
                }}
                className="flex-1 rounded-xl border border-outline/20 bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={documentCommentModal.action === 'comment' ? handleDocumentReviewWithComment : handleDocumentReviewWithComment}
                disabled={!documentCommentText.trim() && documentCommentModal.action !== 'comment'}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {documentCommentModal.action === 'comment' ? (documentCommentModal.existingComment ? 'Update Comment' : 'Add Comment') :
                 documentCommentModal.action === 'needs_clarification' ? 'Request Clarification' : 'Reject Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
