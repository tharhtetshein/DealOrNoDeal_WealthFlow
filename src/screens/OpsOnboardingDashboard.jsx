import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  Search,
  Upload,
  UserCheck,
} from 'lucide-react'
import {
  CASE_STATUS,
  getAllCaseFiles,
  getDocumentCompletionSummary,
  getReadinessScore,
  hasFreshAiAnalysis,
  hasRequiredFields,
  markReadyForReview,
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
  if (status === CASE_STATUS.PENDING_REVIEW) return 'bg-success/12 text-success'
  if (status === CASE_STATUS.MISSING_DOCUMENTS) return 'bg-error/10 text-error'
  if (status === CASE_STATUS.UNDER_REVIEW) return 'bg-tertiary/12 text-tertiary'
  if (status === CASE_STATUS.ESCALATED) return 'bg-error/15 text-error'
  return 'bg-surface-container-high text-on-surface-variant'
}

function readinessTone(score) {
  if (score >= 85) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-error'
}

function getOpsIssues(caseFile, readiness, completion) {
  const issues = []
  if (!hasRequiredFields(caseFile)) issues.push('Profile is incomplete or below minimum net worth.')
  completion.missingRequiredDocuments.forEach((item) => {
    issues.push(`Missing ${item.label}.`)
  })
  completion.needsReviewDocuments.forEach((item) => {
    issues.push(`${item.label} needs review.`)
  })
  if ((caseFile.documents || []).length > 0 && !hasFreshAiAnalysis(caseFile)) {
    issues.push('AI analysis is not current after the latest upload.')
  }
  if (readiness < 100 && issues.length === 0) {
    issues.push('Case is not fully ready for compliance handoff.')
  }
  return issues
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

export default function OpsOnboardingDashboard({ onNavigate }) {
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadCases = async () => {
    setLoading(true)
    const records = await getAllCaseFiles()
    const enriched = await Promise.all(records.map(async (caseFile) => {
      const readiness = await getReadinessScore(caseFile.id)
      const completion = getDocumentCompletionSummary(caseFile)
      return {
        ...caseFile,
        readiness: readiness?.percentage ?? 0,
        readinessBreakdown: readiness,
        completion,
        opsIssues: getOpsIssues(caseFile, readiness?.percentage ?? 0, completion),
      }
    }))
    setCases(enriched)
    setSelectedCaseId((current) => current || enriched[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => {
    loadCases()
  }, [])

  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return cases
      .filter((caseFile) => statusFilter === 'All' || caseFile.status === statusFilter)
      .filter((caseFile) => !query
        || String(caseFile.clientName || '').toLowerCase().includes(query)
        || String(caseFile.id || '').toLowerCase().includes(query))
      .sort((a, b) => b.opsIssues.length - a.opsIssues.length || b.readiness - a.readiness)
  }, [cases, searchQuery, statusFilter])

  const selectedCase = cases.find((item) => item.id === selectedCaseId) || filteredCases[0] || null

  const metrics = useMemo(() => {
    const missingDocs = cases.filter((item) => item.completion.missingRequiredDocuments.length > 0).length
    const staleAi = cases.filter((item) => (item.documents || []).length > 0 && !hasFreshAiAnalysis(item)).length
    const ready = cases.filter((item) => item.readiness === 100).length
    const average = cases.length
      ? Math.round(cases.reduce((sum, item) => sum + item.readiness, 0) / cases.length)
      : 0

    return { missingDocs, staleAi, ready, average }
  }, [cases])

  const handleOpenDocuments = (caseId) => {
    setActiveCaseId(caseId)
    onNavigate?.('documents')
  }

  const handleOpenCase = (caseId) => {
    setActiveCaseId(caseId)
    onNavigate?.('case-detail')
  }

  const handleMarkReady = async (caseId) => {
    const result = await markReadyForReview(caseId)
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setMessage('Case moved to Pending Review.')
    await loadCases()
  }

  return (
    <div className="min-h-screen bg-surface p-8 pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Operations Workspace</p>
          <h1 className="font-display text-4xl font-bold text-on-surface">Case Readiness Control</h1>
          <p className="mt-2 text-on-surface-variant">Resolve profile, document, and AI freshness gaps before compliance review.</p>
        </div>

        {message ? (
          <div className="rounded-2xl border border-outline/10 bg-surface-container-lowest px-5 py-3 text-sm text-on-surface-variant shadow-ambient">
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard label="Missing Document Cases" value={metrics.missingDocs} icon={Upload} tone="text-error" />
          <MetricCard label="AI Refresh Needed" value={metrics.staleAi} icon={Clock3} tone="text-warning" />
          <MetricCard label="Ready for Handoff" value={metrics.ready} icon={CheckCircle2} tone="text-success" />
          <MetricCard label="Average Readiness" value={`${metrics.average}%`} icon={UserCheck} tone="text-primary" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest shadow-ambient">
            <div className="border-b border-outline/10 p-5">
              <h2 className="font-display text-xl font-bold text-on-surface">Work Queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Cases sorted by operational issues first.</p>
            </div>
            <div className="space-y-4 border-b border-outline/10 p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search client or case ID"
                  className="w-full rounded-xl border border-outline/15 bg-surface py-2.5 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['All', CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.PENDING_REVIEW, CASE_STATUS.UNDER_REVIEW].map((status) => (
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

            <div className="max-h-[620px] overflow-y-auto p-4">
              {loading ? (
                <p className="p-4 text-sm text-on-surface-variant">Loading cases...</p>
              ) : filteredCases.length === 0 ? (
                <p className="p-4 text-sm text-on-surface-variant">No cases match this filter.</p>
              ) : filteredCases.map((caseFile) => (
                <button
                  key={caseFile.id}
                  onClick={() => setSelectedCaseId(caseFile.id)}
                  className={`mb-3 w-full rounded-2xl border p-4 text-left transition-colors ${
                    selectedCase?.id === caseFile.id ? 'border-primary/30 bg-primary/5' : 'border-outline/10 bg-surface hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-on-surface">{caseFile.clientName || 'Unnamed Client'}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface-variant">{caseFile.id}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(caseFile.status)}`}>
                      {caseFile.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${caseFile.readiness}%` }} />
                    </div>
                    <span className={`text-sm font-bold ${readinessTone(caseFile.readiness)}`}>{caseFile.readiness}%</span>
                  </div>
                  <p className={`mt-3 text-xs font-medium ${caseFile.opsIssues.length ? 'text-warning' : 'text-success'}`}>
                    {caseFile.opsIssues.length ? `${caseFile.opsIssues.length} operational item${caseFile.opsIssues.length > 1 ? 's' : ''}` : 'Ready from Ops view'}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-outline/10 bg-surface-container-lowest p-6 shadow-ambient">
            {selectedCase ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Selected Case</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-on-surface">{selectedCase.clientName || 'Unnamed Client'}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{selectedCase.id} | Updated {formatDateTime(selectedCase.updatedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-4xl font-bold ${readinessTone(selectedCase.readiness)}`}>{selectedCase.readiness}%</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">Readiness</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Profile</p>
                    <p className={`mt-3 text-sm font-semibold ${hasRequiredFields(selectedCase) ? 'text-success' : 'text-error'}`}>
                      {hasRequiredFields(selectedCase) ? 'Complete' : 'Incomplete'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Documents</p>
                    <p className="mt-3 text-sm font-semibold text-on-surface">
                      {selectedCase.completion.requiredCompletedCount} / {selectedCase.completion.requiredTotal}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">AI Analysis</p>
                    <p className={`mt-3 text-sm font-semibold ${hasFreshAiAnalysis(selectedCase) ? 'text-success' : 'text-warning'}`}>
                      {hasFreshAiAnalysis(selectedCase) ? 'Current' : 'Needs refresh'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-outline/10 bg-surface p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-on-surface">Required Documents</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedCase.completion.requiredDocuments.map((doc) => (
                      <div key={doc.label} className="flex items-start gap-3 rounded-xl bg-surface-container-lowest p-3">
                        {doc.status === 'uploaded' ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-on-surface">{doc.label}</p>
                          <p className="text-xs text-on-surface-variant">{doc.status === 'uploaded' ? 'Uploaded' : doc.status === 'needs_review' ? 'Needs review' : 'Missing'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-outline/10 bg-surface p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <h3 className="font-semibold text-on-surface">Operations To Resolve</h3>
                  </div>
                  {selectedCase.opsIssues.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCase.opsIssues.map((issue) => (
                        <p key={issue} className="rounded-xl bg-warning/5 px-4 py-3 text-sm text-on-surface">{issue}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-success/5 px-4 py-3 text-sm font-medium text-success">No operational blockers. Case is ready for compliance handling.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleOpenDocuments(selectedCase.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Manage Documents
                  </button>
                  <button
                    onClick={() => handleOpenCase(selectedCase.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-outline/20 bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface hover:border-primary/30"
                  >
                    <FileText className="h-4 w-4" />
                    Open Case Workspace
                  </button>
                  <button
                    onClick={() => handleMarkReady(selectedCase.id)}
                    disabled={selectedCase.readiness < 100}
                    className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Move to Pending Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-center">
                <div>
                  <FileText className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/40" />
                  <p className="text-sm text-on-surface-variant">No case selected.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
