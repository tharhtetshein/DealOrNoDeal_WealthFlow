import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  MessageCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  addComplianceComment,
  CASE_STATUS,
  getActiveCaseId,
  getCaseFileById,
  getDocumentCompletionSummary,
  getReadinessScore,
  submitComplianceDecision,
  updateCaseData,
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

  return [...missingDocs, ...aiRisks, ...mismatches]
}

function getSourceOfWealth(caseFile) {
  return caseFile?.sowDraft?.primarySource
    || caseFile?.aiAnalysis?.sowDraft?.primarySource
    || caseFile?.aiAnalysis?.extractedData?.sourceOfWealthIndicators?.value
    || caseFile?.purpose
    || 'Not available'
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

  const loadCase = async () => {
    setLoading(true)
    const caseId = getActiveCaseId()
    let nextCase = caseId ? await getCaseFileById(caseId) : null
    if (nextCase?.status === CASE_STATUS.PENDING_REVIEW) {
      nextCase = await updateCaseData(nextCase.id, {
        status: CASE_STATUS.UNDER_REVIEW,
        assignedComplianceOfficer: 'Compliance Officer',
        reviewStartedAt: nextCase.reviewStartedAt || new Date().toISOString(),
      })
    }
    const nextReadiness = caseId ? await getReadinessScore(caseId) : null
    setCaseFile(nextCase)
    setReadiness(nextReadiness)
    setCompletion(nextCase ? getDocumentCompletionSummary(nextCase) : null)
    setLoading(false)
  }

  useEffect(() => {
    loadCase()
  }, [])

  const readinessScore = readiness?.percentage ?? 0
  const riskLevel = useMemo(() => getRiskLevel(caseFile, readinessScore), [caseFile, readinessScore])
  const riskFlags = useMemo(() => getRiskFlags(caseFile, completion || { missingRequiredDocuments: [] }), [caseFile, completion])
  const approveDisabled = !completion?.allRequiredComplete || riskFlags.some((flag) => /high|critical/i.test(String(flag.severity || '')))
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
    const result = await submitComplianceDecision(caseFile.id, decision, {
      note: decisionNote,
    })
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setDecisionNote('')
    setMessage(decision === 'approve' ? 'Case approved and sent to Operations.' : decision === 'request_info' ? 'Case returned to RM as Action Required.' : 'Case rejected and locked.')
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
                  ['Source of Wealth', getSourceOfWealth(caseFile)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-on-surface">{value || '--'}</p>
                  </div>
                ))}
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
                  const firstDoc = item.documents?.[0] || null
                  return (
                    <div key={item.label} className="rounded-2xl border border-outline/10 bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-on-surface">{item.label}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{item.category}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${docStatusTone(item.status)}`}>
                            {item.status === 'uploaded' ? 'Uploaded' : item.status === 'needs_review' ? 'In Review' : 'Missing'}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${validation.tone}`}>{validation.label}</span>
                          <button
                            disabled={!firstDoc}
                            onClick={() => handleViewDocument(firstDoc)}
                            className="inline-flex items-center gap-1 rounded-full border border-outline/20 bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-on-surface hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                          <button
                            disabled={!firstDoc}
                            onClick={() => setSelectedDocument(firstDoc)}
                            className="inline-flex items-center gap-1 rounded-full border border-outline/20 bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-on-surface hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FileText className="h-3 w-3" />
                            Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                placeholder="Decision note or RM feedback..."
                className="mb-3 w-full resize-none rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {approveDisabled ? (
                <p className="mb-3 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                  Approve is disabled while critical documents or high-risk items remain.
                </p>
              ) : null}
              <div className="space-y-2">
                <button
                  onClick={() => handleDecision('approve')}
                  disabled={approveDisabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Case
                </button>
                <button onClick={() => handleDecision('request_info')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-warning hover:bg-warning/15">
                  <AlertTriangle className="h-4 w-4" />
                  Request More Information
                </button>
                <button onClick={() => handleDecision('reject')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/15">
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
    </div>
  )
}
