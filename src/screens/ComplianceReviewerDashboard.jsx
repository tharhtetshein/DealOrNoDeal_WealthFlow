import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import {
  CASE_STATUS,
  getAllCaseFiles,
  getDocumentCompletionSummary,
  getReadinessScore,
  hasFreshAiAnalysis,
  setActiveCaseId,
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
  if (status === CASE_STATUS.APPROVED) return 'bg-success/12 text-success'
  if (status === CASE_STATUS.ACTION_REQUIRED) return 'bg-warning/15 text-warning'
  if (status === CASE_STATUS.REJECTED) return 'bg-error/12 text-error'
  if (status === CASE_STATUS.ESCALATED) return 'bg-error/12 text-error'
  if (status === CASE_STATUS.UNDER_REVIEW) return 'bg-tertiary/12 text-tertiary'
  if (status === CASE_STATUS.PENDING_REVIEW) return 'bg-warning/15 text-warning'
  return 'bg-surface-container-high text-on-surface-variant'
}

function riskTone(level) {
  if (level === 'High') return 'bg-error/10 text-error'
  if (level === 'Medium') return 'bg-warning/15 text-warning'
  return 'bg-success/12 text-success'
}

function getPriority(caseFile, readiness) {
  const analysis = caseFile.aiAnalysis || {}
  const risks = analysis.risks || []
  const hasHighRisk = risks.some((risk) => /high|critical/i.test(String(risk.severity || risk.priority || '')))
  if (caseFile.status === CASE_STATUS.ESCALATED || hasHighRisk) return 'High'
  if (caseFile.status === CASE_STATUS.PENDING_REVIEW) return 'Needs Attention'
  if (readiness < 100 || !hasFreshAiAnalysis(caseFile)) return 'Medium'
  return 'Normal'
}

function getRiskLevel(caseFile, readiness) {
  const analysis = caseFile.aiAnalysis || {}
  const risks = analysis.risks || []
  const hasHighRisk = risks.some((risk) => /high|critical/i.test(String(risk.severity || risk.priority || '')))
  const hasMediumRisk = risks.some((risk) => /medium/i.test(String(risk.severity || risk.priority || '')))
  if (hasHighRisk || caseFile.status === CASE_STATUS.ESCALATED) return 'High'
  if (hasMediumRisk || readiness < 100 || !hasFreshAiAnalysis(caseFile)) return 'Medium'
  return 'Low'
}

function getReviewNotes(caseFile, readiness, completion) {
  const notes = []
  if (completion.missingRequiredDocuments.length > 0) {
    notes.push(`${completion.missingRequiredDocuments.length} required document category still missing.`)
  }
  if (!hasFreshAiAnalysis(caseFile)) {
    notes.push('AI analysis is not current after latest upload.')
  }
  const risks = caseFile.aiAnalysis?.risks || []
  risks
    .filter((risk) => /high|critical|medium/i.test(String(risk.severity || risk.priority || '')))
    .forEach((risk) => notes.push(risk.title || risk.description || 'AI risk finding requires review.'))
  if (readiness === 100 && notes.length === 0) {
    notes.push('All required evidence is complete and no high-priority AI blockers are open.')
  }
  return notes
}

function MetricCard({ label, value, icon: Icon, tone = 'text-on-surface' }) {
  return (
    <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-5 shadow-ambient">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-surface">
        <Icon className={`h-5 w-5 ${tone}`} />
      </div>
      <p className={`font-display text-3xl font-bold ${tone}`}>{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{label}</p>
    </div>
  )
}

export default function ComplianceReviewerDashboard({ onNavigate }) {
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCases = async () => {
    setLoading(true)
    const records = await getAllCaseFiles()
    const enriched = await Promise.all(records.map(async (caseFile) => {
      const readiness = await getReadinessScore(caseFile.id)
      const completion = getDocumentCompletionSummary(caseFile)
      const percentage = readiness?.percentage ?? 0
      return {
        ...caseFile,
        readiness: percentage,
        completion,
        riskLevel: getRiskLevel(caseFile, percentage),
        priority: getPriority(caseFile, percentage),
        reviewNotes: getReviewNotes(caseFile, percentage, completion),
      }
    }))
    const reviewable = enriched.filter((caseFile) => [
      CASE_STATUS.PENDING_REVIEW,
      CASE_STATUS.UNDER_REVIEW,
      CASE_STATUS.ESCALATED,
      CASE_STATUS.APPROVED,
      CASE_STATUS.ACTION_REQUIRED,
      CASE_STATUS.REJECTED,
    ].includes(caseFile.status))
    setCases(reviewable)
    setSelectedCaseId((current) => current || reviewable.find((item) => item.status === CASE_STATUS.PENDING_REVIEW)?.id || reviewable.find((item) => item.status !== CASE_STATUS.APPROVED)?.id || reviewable[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => {
    loadCases()
  }, [])

  const filteredCases = useMemo(() => {
    const search = query.trim().toLowerCase()
    return cases
      .filter((caseFile) => statusFilter === 'All' || caseFile.status === statusFilter)
      .filter((caseFile) => !search
        || String(caseFile.clientName || '').toLowerCase().includes(search)
        || String(caseFile.id || '').toLowerCase().includes(search))
      .sort((a, b) => {
        const priorityScore = { High: 4, 'Needs Attention': 3, Medium: 2, Normal: 1 }
        return (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0)
          || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      })
  }, [cases, query, statusFilter])

  const selectedCase = cases.find((item) => item.id === selectedCaseId) || filteredCases[0] || null

  const metrics = useMemo(() => ({
    pendingReview: cases.filter((item) => item.status === CASE_STATUS.PENDING_REVIEW).length,
    underReview: cases.filter((item) => item.status === CASE_STATUS.UNDER_REVIEW).length,
    escalated: cases.filter((item) => item.status === CASE_STATUS.ESCALATED).length,
    approved: cases.filter((item) => item.status === CASE_STATUS.APPROVED).length,
  }), [cases])

  const handleOpenCase = (caseId) => {
    setActiveCaseId(caseId)
    onNavigate?.('compliance-case-review')
  }

  return (
    <div className="min-h-screen bg-surface p-8 pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Compliance Workspace</p>
          <h1 className="font-display text-4xl font-bold text-on-surface">Review Queue</h1>
          <p className="mt-2 text-on-surface-variant">Review submitted cases, approve clean files, or return issues for remediation.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard label="Submitted for Review" value={metrics.pendingReview} icon={Clock3} tone="text-warning" />
          <MetricCard label="In Review" value={metrics.underReview} icon={FileText} tone="text-tertiary" />
          <MetricCard label="Escalated" value={metrics.escalated} icon={ShieldX} tone="text-error" />
          <MetricCard label="Approved" value={metrics.approved} icon={ShieldCheck} tone="text-success" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest shadow-ambient">
            <div className="border-b border-outline/10 p-5">
              <h2 className="font-display text-xl font-bold text-on-surface">Cases for Compliance</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Only submitted, in-review, escalated, and approved cases appear here.</p>
            </div>

            <div className="space-y-4 border-b border-outline/10 p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search client or case ID"
                  className="w-full rounded-xl border border-outline/15 bg-surface py-2.5 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['All', CASE_STATUS.PENDING_REVIEW, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.ESCALATED, CASE_STATUS.ACTION_REQUIRED, CASE_STATUS.REJECTED, CASE_STATUS.APPROVED].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      statusFilter === status ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {loading ? (
                <p className="text-sm text-on-surface-variant">Loading review queue...</p>
              ) : filteredCases.length === 0 ? (
                <div className="rounded-2xl bg-surface p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
                  <p className="text-sm font-medium text-on-surface">No cases in this queue.</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Cases appear here after Ops/RM submits them for review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCases.map((caseFile) => (
                    <button
                      key={caseFile.id}
                      onClick={() => setSelectedCaseId(caseFile.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                        selectedCase?.id === caseFile.id ? 'border-primary/30 bg-primary/5' : 'border-outline/10 bg-surface hover:border-primary/20'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-on-surface">{caseFile.clientName || 'Unnamed Client'}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface-variant">{caseFile.id}</p>
                          {caseFile.status === CASE_STATUS.PENDING_REVIEW ? (
                            <p className="mt-2 inline-flex rounded-full bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning">Needs Attention</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(caseFile.status)}`}>{caseFile.status}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskTone(caseFile.riskLevel)}`}>{caseFile.riskLevel} Risk</span>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-on-surface-variant">Readiness</p>
                          <p className="font-semibold text-on-surface">{caseFile.readiness}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-on-surface-variant">Documents</p>
                          <p className="font-semibold text-on-surface">{caseFile.completion.requiredCompletedCount}/{caseFile.completion.requiredTotal}</p>
                        </div>
                        <div>
                          <p className="text-xs text-on-surface-variant">Priority</p>
                          <p className={caseFile.priority === 'High' ? 'font-semibold text-error' : 'font-semibold text-on-surface'}>{caseFile.priority}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-on-surface-variant">
                        {caseFile.status === CASE_STATUS.PENDING_REVIEW
                          ? `Waiting since ${formatDateTime(caseFile.submittedAt || caseFile.updatedAt)}`
                          : caseFile.status === CASE_STATUS.UNDER_REVIEW
                            ? `Assigned to ${caseFile.assignedComplianceOfficer || 'Compliance Officer'}`
                            : `Updated ${formatDateTime(caseFile.updatedAt)}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-5 shadow-ambient">
            {selectedCase ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Case Review</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-on-surface">{selectedCase.clientName || 'Unnamed Client'}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{selectedCase.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Status</p>
                    <p className="mt-3 text-sm font-semibold text-on-surface">{selectedCase.status}</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Risk</p>
                    <p className="mt-3 text-sm font-semibold text-on-surface">{selectedCase.riskLevel}</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Updated</p>
                    <p className="mt-3 text-sm font-semibold text-on-surface">{formatDateTime(selectedCase.updatedAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">AI</p>
                    <p className={`mt-3 text-sm font-semibold ${hasFreshAiAnalysis(selectedCase) ? 'text-success' : 'text-warning'}`}>
                      {hasFreshAiAnalysis(selectedCase) ? 'Current' : 'Needs refresh'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-outline/10 bg-surface p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <h3 className="text-sm font-semibold text-on-surface">Review Notes</h3>
                  </div>
                  <div className="space-y-2">
                    {selectedCase.reviewNotes.map((note) => (
                      <p key={note} className="rounded-xl bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant">{note}</p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-outline/10 bg-surface p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-on-surface">Supporting Documents</h3>
                  </div>
                  <div className="space-y-2">
                    {(selectedCase.documents || []).length > 0 ? (selectedCase.documents || []).slice(0, 6).map((document) => (
                      <div key={document.id || document.name} className="rounded-xl bg-surface-container-lowest px-3 py-2">
                        <p className="text-sm font-medium text-on-surface">{document.category || 'Supporting Evidence'}</p>
                        <p className="text-xs text-on-surface-variant">{document.name || 'Uploaded document'}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-on-surface-variant">No documents uploaded.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleOpenCase(selectedCase.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    <FileText className="h-4 w-4" />
                    Open Compliance Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-center">
                <div>
                  <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/40" />
                  <p className="text-sm text-on-surface-variant">Select a case to review.</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
