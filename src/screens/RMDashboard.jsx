import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileWarning,
  FolderOpen,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { CASE_STATUS, calculateReadinessScore, clearActiveCaseId, getAllCaseFiles, getDocumentCompletionSummary, setActiveCaseId } from '../lib/caseFiles'

const statusOrder = [CASE_STATUS.DRAFT, CASE_STATUS.MISSING_DOCUMENTS, CASE_STATUS.READY_FOR_REVIEW, CASE_STATUS.PENDING_REVIEW, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.ESCALATED, CASE_STATUS.ACTION_REQUIRED, CASE_STATUS.REJECTED, CASE_STATUS.APPROVED]

const demoCases = [
  {
    id: 'WF-1102',
    clientName: 'Ariella Tan',
    status: CASE_STATUS.DRAFT,
    readinessScore: 34,
    lastUpdated: '4/21/2026',
    nextAction: 'Complete intake profile',
    issues: 'Client profile incomplete and 3 required documents missing',
  },
  {
    id: 'WF-1108',
    clientName: 'Marcus Lee',
    status: CASE_STATUS.UNDER_REVIEW,
    readinessScore: 76,
    lastUpdated: '4/23/2026',
    nextAction: 'Review ownership structure and validate bank statements',
    issues: 'One ownership proof pending',
  },
  {
    id: 'WF-1113',
    clientName: 'Isabelle Wong',
    status: CASE_STATUS.PENDING_REVIEW,
    readinessScore: 92,
    lastUpdated: '4/22/2026',
    nextAction: 'Review and submit for compliance',
    issues: 'No blockers identified',
  },
  {
    id: 'WF-1116',
    clientName: 'Daniel Koh',
    status: CASE_STATUS.MISSING_DOCUMENTS,
    readinessScore: 48,
    lastUpdated: '4/24/2026',
    nextAction: 'Upload utility bill and tax residency bill',
    issues: 'Required documents are incomplete',
  },
  {
    id: 'WF-1119',
    clientName: 'Nadia Aziz',
    status: CASE_STATUS.ESCALATED,
    readinessScore: 63,
    lastUpdated: '4/20/2026',
    nextAction: 'Review sanctions screening note with compliance',
    issues: 'Potential sanctions match flagged',
  },
  {
    id: 'WF-1124',
    clientName: 'Celine Ong',
    status: CASE_STATUS.APPROVED,
    readinessScore: 100,
    lastUpdated: '4/18/2026',
    nextAction: 'No action required',
    issues: 'Case approved and archived',
  },
]

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

function getStatusStyle(status) {
  switch (status) {
    case CASE_STATUS.DRAFT:
      return 'bg-secondary text-secondary-foreground'
    case CASE_STATUS.MISSING_DOCUMENTS:
      return 'bg-warning/15 text-warning'
    case CASE_STATUS.READY_FOR_REVIEW:
      return 'bg-success/12 text-success'
    case CASE_STATUS.UNDER_REVIEW:
      return 'bg-tertiary/12 text-tertiary'
    case CASE_STATUS.PENDING_REVIEW:
      return 'bg-success/12 text-success'
    case CASE_STATUS.ACTION_REQUIRED:
      return 'bg-warning/15 text-warning'
    case CASE_STATUS.REJECTED:
      return 'bg-error/10 text-error'
    case CASE_STATUS.ESCALATED:
      return 'bg-error/10 text-error'
    case CASE_STATUS.APPROVED:
      return 'bg-success/20 text-success'
    default:
      return 'bg-surface-container-high text-on-surface-variant'
  }
}

function getReadinessStyle(score) {
  if (score > 80) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-error'
}

function getReadinessBarStyle(score) {
  if (score > 80) return 'bg-success'
  if (score >= 50) return 'bg-warning'
  return 'bg-error'
}

function deriveNextAction(status, missingCategoriesCount) {
  if (status === CASE_STATUS.DRAFT) return 'Complete intake profile'
  if (status === CASE_STATUS.MISSING_DOCUMENTS) return missingCategoriesCount > 0 ? `Upload ${missingCategoriesCount} remaining required document${missingCategoriesCount > 1 ? 's' : ''}` : 'Upload required documents'
  if (status === CASE_STATUS.READY_FOR_REVIEW) return 'Submit for compliance review'
  if (status === CASE_STATUS.PENDING_REVIEW) return 'Waiting for Compliance to start review'
  if (status === CASE_STATUS.UNDER_REVIEW) return 'Compliance review in progress'
  if (status === CASE_STATUS.ACTION_REQUIRED) return 'Resolve Compliance feedback'
  if (status === CASE_STATUS.REJECTED) return 'Review rejection reason'
  if (status === CASE_STATUS.ESCALATED) return 'Address flagged issues with compliance'
  if (status === CASE_STATUS.APPROVED) return 'No action required'
  return 'Open case and review'
}

function deriveIssues(status, missingCategories) {
  if (status === CASE_STATUS.ESCALATED) return 'High-priority issue flagged for RM follow-up'
  if (missingCategories.length > 0) return `Missing: ${missingCategories.slice(0, 2).join(', ')}${missingCategories.length > 2 ? ` +${missingCategories.length - 2} more` : ''}`
  if (status === CASE_STATUS.READY_FOR_REVIEW) return 'Ready to submit to Compliance'
  if (status === CASE_STATUS.PENDING_REVIEW) return 'Documentation complete and waiting in Compliance queue'
  if (status === CASE_STATUS.UNDER_REVIEW) return 'Compliance review in progress'
  if (status === CASE_STATUS.ACTION_REQUIRED) return 'Compliance requested additional information'
  if (status === CASE_STATUS.REJECTED) return 'Case rejected by Compliance'
  if (status === CASE_STATUS.APPROVED) return 'Case approved and archived'
  return 'No blockers identified'
}

export default function RMDashboard({ onNavigate }) {
  const [activeStatus, setActiveStatus] = useState('All')
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedCaseId, setCopiedCaseId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const handleCopyCaseId = async (caseId) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(caseId)
    setCopiedCaseId(caseId)
    window.setTimeout(() => setCopiedCaseId(''), 1500)
  }

  const handleCreateNewCase = () => {
    clearActiveCaseId()
    onNavigate?.('new-case')
  }

  useEffect(() => {
    let isMounted = true

    const loadCases = async () => {
      const storedCases = await getAllCaseFiles()
      if (!isMounted) return

      const mappedCases = await Promise.all(storedCases.map(async (item) => {
        const completionSummary = getDocumentCompletionSummary(item)
        const missingCategories = completionSummary.missingCategoryLabels
        const readiness = calculateReadinessScore(item)

        return {
          id: item.id,
          clientName: item.clientName,
          status: item.status,
          readinessScore: readiness?.percentage ?? 0,
          lastUpdated: formatDateTime(item.updatedAt),
          nextAction: deriveNextAction(item.status, missingCategories.length),
          issues: deriveIssues(item.status, missingCategories),
        }
      }))

      const mergedCases = [...mappedCases]
      demoCases.forEach((demoItem) => {
        if (!mergedCases.some((item) => item.id === demoItem.id)) {
          mergedCases.push(demoItem)
        }
      })

      setCases(mergedCases)
      setLoading(false)
    }

    loadCases()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchesStatus = activeStatus === 'All' || item.status === activeStatus
      const matchesQuery = `${item.clientName} ${item.id}`.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesQuery
    })
  }, [cases, activeStatus, searchQuery])

  const metrics = useMemo(() => {
    const total = cases.length
    const draft = cases.filter((c) => c.status === CASE_STATUS.DRAFT).length
    const missingDocs = cases.filter((c) => c.status === CASE_STATUS.MISSING_DOCUMENTS || c.readinessScore < 50).length
    const underReview = cases.filter((c) => c.status === CASE_STATUS.UNDER_REVIEW).length
    const submittedReview = cases.filter((c) => c.status === CASE_STATUS.PENDING_REVIEW).length
    const escalated = cases.filter((c) => c.status === CASE_STATUS.ESCALATED).length

    return [
      { label: 'Total Cases', value: total, icon: Briefcase, tone: 'text-on-surface', iconTone: 'bg-surface-container text-on-surface' },
      { label: 'Draft Cases', value: draft, icon: Clock3, tone: 'text-on-surface', iconTone: 'bg-secondary text-secondary-foreground' },
      { label: 'Cases Missing Documents', value: missingDocs, icon: FileWarning, tone: 'text-warning', iconTone: 'bg-warning/15 text-warning' },
      { label: 'Submitted for Review', value: submittedReview, icon: CheckCircle2, tone: 'text-success', iconTone: 'bg-success/12 text-success' },
      { label: 'In Review', value: underReview, icon: FolderOpen, tone: 'text-tertiary', iconTone: 'bg-tertiary/12 text-tertiary' },
      { label: 'Escalated Cases', value: escalated, icon: ShieldAlert, tone: 'text-error', iconTone: 'bg-error/10 text-error' },
    ]
  }, [cases])

  const hasStatusFilter = activeStatus !== 'All'
  const hasSearchFilter = searchQuery.trim().length > 0
  const emptyStateTitle = hasStatusFilter
    ? `No cases with status "${activeStatus}".`
    : hasSearchFilter
      ? 'No cases match your search.'
      : 'No onboarding cases yet. Create a new case to begin.'
  const emptyStateDescription = hasStatusFilter
    ? hasSearchFilter
      ? `No ${activeStatus} cases match "${searchQuery.trim()}".`
      : `There are no onboarding cases currently marked as ${activeStatus}.`
    : hasSearchFilter
      ? `No cases match "${searchQuery.trim()}". Try a different client name or case ID.`
      : 'Start a new client onboarding workflow from this dashboard.'
  const showCreateEmptyAction = !hasStatusFilter && !hasSearchFilter

  return (
    <div className="min-h-screen bg-surface p-8 pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-2">Relationship Manager Workspace</p>
            <h1 className="font-display text-4xl font-bold text-on-surface">Client Onboarding Overview</h1>
            <p className="text-on-surface-variant mt-2">Track onboarding progress from case initiation to approval.</p>
          </div>

          <button
            onClick={handleCreateNewCase}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-ambient hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Case
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className="rounded-2xl border border-outline/10 bg-surface-container-lowest p-4 shadow-ambient">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${metric.iconTone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className={`font-display text-2xl font-bold leading-none ${metric.tone}`}>{metric.value}</p>
                <p className="mt-2 text-sm leading-5 text-on-surface-variant">{metric.label}</p>
              </div>
            )
          })}
        </div>

        <div className="rounded-3xl border border-outline/10 bg-surface-container-lowest shadow-ambient">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline/10 px-6 py-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-on-surface">Case List</h2>
              <p className="text-sm text-on-surface-variant">A focused view of onboarding status and next required actions.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline/10 px-6 py-5">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by client name or case ID"
                className="w-full rounded-xl border border-outline/15 bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {['All', ...statusOrder].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    activeStatus === status
                      ? 'bg-primary text-white'
                      : 'bg-surface text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12">
              <p className="text-sm text-on-surface-variant">Loading onboarding cases...</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-surface">
                <FolderOpen className="w-8 h-8 text-on-surface-variant" />
              </div>
              <h3 className="font-display text-xl font-bold text-on-surface mb-2">{emptyStateTitle}</h3>
              <p className={`text-sm text-on-surface-variant ${showCreateEmptyAction ? 'mb-6' : ''}`}>
                {emptyStateDescription}
              </p>
              {showCreateEmptyAction ? (
                <button
                  onClick={handleCreateNewCase}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Case
                </button>
              ) : null}
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {filteredCases.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-outline/10 bg-surface p-5 shadow-sm transition-colors hover:border-primary/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-on-surface">{item.clientName}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{item.id}</p>
                        <button
                          onClick={() => handleCopyCaseId(item.id)}
                          className="rounded-lg border border-outline/15 bg-surface px-2 py-0.5 text-[11px] font-medium text-on-surface-variant hover:text-on-surface"
                        >
                          {copiedCaseId === item.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(item.status)}`}>
                        {item.status}
                      </span>
                      <button
                        onClick={() => {
                          setActiveCaseId(item.id)
                          onNavigate?.('case-detail')
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        Open Case
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[180px_140px_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl bg-surface-container-lowest border border-outline/10 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Readiness Score</p>
                      <p className={`mt-3 text-2xl font-bold ${getReadinessStyle(item.readinessScore)}`}>{item.readinessScore}%</p>
                      <div className="mt-3 h-2 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getReadinessBarStyle(item.readinessScore)}`}
                          style={{ width: `${item.readinessScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-surface-container-lowest border border-outline/10 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Last Updated</p>
                      <p className="mt-3 text-sm font-medium text-on-surface">{item.lastUpdated}</p>
                    </div>

                    <div className="rounded-2xl bg-surface-container-lowest border border-outline/10 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Next Required Action</p>
                      <p className="mt-3 text-sm leading-6 text-on-surface">{item.nextAction}</p>
                    </div>

                    <div className="rounded-2xl bg-surface-container-lowest border border-outline/10 p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${item.readinessScore > 80 ? 'text-success' : item.readinessScore >= 50 ? 'text-warning' : 'text-error'}`} />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">System Issues / Missing Items</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-on-surface-variant">{item.issues}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
