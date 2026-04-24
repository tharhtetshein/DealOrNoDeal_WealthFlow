import { useMemo, useState } from 'react'
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquare,
  Clock,
  ThumbsUp,
  Flag,
  ChevronRight,
  Eye,
  MessageCircle,
  Download,
  ArrowRight,
} from 'lucide-react'

const reviewQueueCases = [
  {
    id: 'WF-1113',
    clientName: 'Isabelle Wong',
    status: 'Ready for Review',
    readinessScore: 95,
    riskFlags: 0,
    sowCompleteness: 100,
    lastAction: 'Ops marked as ready',
    lastActionTime: '2 hours ago',
    priority: 'normal',
  },
  {
    id: 'WF-1116',
    clientName: 'Daniel Koh',
    status: 'Escalated',
    readinessScore: 72,
    riskFlags: 2,
    sowCompleteness: 85,
    lastAction: 'System flagged potential sanctions match',
    lastActionTime: '3 hours ago',
    priority: 'high',
  },
  {
    id: 'WF-1124',
    clientName: 'Celine Ong',
    status: 'Ready for Review',
    readinessScore: 88,
    riskFlags: 1,
    sowCompleteness: 95,
    lastAction: 'Documents verified by Ops',
    lastActionTime: '1 hour ago',
    priority: 'normal',
  },
  {
    id: 'WF-1108',
    clientName: 'Marcus Lee',
    status: 'Escalated',
    readinessScore: 80,
    riskFlags: 1,
    sowCompleteness: 90,
    lastAction: 'Pending clarification response',
    lastActionTime: '6 hours ago',
    priority: 'high',
  },
]

const approvedCases = [
  {
    id: 'WF-1097',
    clientName: 'Nadia Aziz',
    approvedDate: '2026-04-18',
    approvalNote: 'All documents verified, no risks identified',
  },
  {
    id: 'WF-1091',
    clientName: 'James Peterson',
    approvedDate: '2026-04-17',
    approvalNote: 'Passed enhanced due diligence',
  },
]

const riskFlagDetails = {
  'WF-1116': [
    { id: 1, title: 'Potential Sanctions Match', severity: 'high', description: 'Name match in international sanctions list requires verification' },
    { id: 2, title: 'Unusual Wealth Source', severity: 'medium', description: 'Source of funds narrative lacks specific transaction details' },
  ],
  'WF-1124': [
    { id: 1, title: 'Incomplete Employment History', severity: 'medium', description: 'Gap in employment record from 2018-2019' },
  ],
  'WF-1108': [
    { id: 1, title: 'Missing Business Registration', severity: 'medium', description: 'Self-employment income declared but no business registration provided' },
  ],
}

const caseDocuments = {
  'WF-1113': ['Passport.pdf', 'Tax_Returns_2024-2025.pdf', 'Bank_Statements.pdf', 'Employment_Letter.pdf'],
  'WF-1116': ['Passport.pdf', 'Tax_Returns.pdf', 'Bank_Statements.pdf', 'POF_Letter.pdf', 'Property_Deed.pdf'],
  'WF-1124': ['ID.pdf', 'Payslips_3mo.pdf', 'Tax_Return_2025.pdf', 'Bank_Statements_6mo.pdf'],
  'WF-1108': ['Passport.pdf', 'Business_Certificate.pdf', 'Tax_Returns_2024-2025.pdf', 'Bank_Statements.pdf'],
}

export default function ComplianceReviewerDashboard() {
  const [query, setQuery] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')

  const filteredCases = useMemo(() => {
    return reviewQueueCases.filter((item) => {
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesQuery = item.clientName.toLowerCase().includes(query.toLowerCase())
      return matchesStatus && matchesQuery
    })
  }, [statusFilter, query])

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ready for Review':
        return 'bg-success/10 text-success'
      case 'Escalated':
        return 'bg-error/10 text-error'
      case 'Approved':
        return 'bg-tertiary/10 text-tertiary'
      default:
        return 'bg-surface-container-high text-on-surface-variant'
    }
  }

  const getPriorityBadge = (priority) => {
    return priority === 'high' ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface-variant'
  }

  const getRiskSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-error/10 text-error'
      case 'medium':
        return 'bg-warning/10 text-warning'
      case 'low':
        return 'bg-tertiary/10 text-tertiary'
      default:
        return 'bg-surface-container-high text-on-surface-variant'
    }
  }

  const currentCaseDetail = selectedCase ? reviewQueueCases.find((c) => c.id === selectedCase) : null

  return (
    <div className="min-h-screen bg-surface p-8 pb-10 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Compliance Reviewer</p>
        <h1 className="font-display text-3xl font-bold text-on-surface">Review Queue & Approvals</h1>
        <p className="text-on-surface-variant mt-1">Review cases marked "Ready for Review" or escalated for enhanced assessment.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Review Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-on-surface">Review Queue</h2>
              <span className="text-xs font-semibold px-2.5 py-1 bg-error/10 text-error rounded-full">
                {filteredCases.filter((c) => c.priority === 'high').length} High Priority
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {['All', 'Ready for Review', 'Escalated'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary text-white'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by client name"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-3">
              {filteredCases.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedCase(item.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedCase === item.id
                      ? 'border-primary bg-primary/5'
                      : 'border-outline/10 bg-surface-container hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-on-surface">{item.clientName}</p>
                      <p className="text-xs text-on-surface-variant">{item.id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs mb-2">
                    <div className="flex items-center gap-1">
                      <span className="text-on-surface-variant">Readiness:</span>
                      <span className="font-semibold text-on-surface">{item.readinessScore}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Flag className="w-3 h-3 text-error" />
                      <span className="font-semibold text-on-surface">{item.riskFlags}</span>
                      <span className="text-on-surface-variant">risk flags</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-on-surface-variant">SoW:</span>
                      <span className="font-semibold text-on-surface">{item.sowCompleteness}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-on-surface-variant">{item.lastAction}</p>
                    <span className={`px-2 py-1 rounded text-[10px] font-semibold ${getPriorityBadge(item.priority)}`}>
                      {item.priority === 'high' ? 'High' : 'Normal'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Approved Cases */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
            <h2 className="font-display text-lg font-bold text-on-surface mb-4">Recently Approved</h2>
            <div className="space-y-3">
              {approvedCases.map((item) => (
                <div key={item.id} className="p-4 rounded-lg bg-surface-container border border-tertiary/20">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-semibold text-on-surface">{item.clientName}</p>
                      <p className="text-xs text-on-surface-variant">{item.id}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-tertiary" />
                  </div>
                  <p className="text-sm text-on-surface-variant mt-2">{item.approvalNote}</p>
                  <p className="text-xs text-on-surface-variant mt-2">Approved: {item.approvedDate}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Case Details */}
        <div className="lg:col-span-1">
          {currentCaseDetail ? (
            <div className="space-y-4">
              {/* Case Header */}
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-2">Case Details</p>
                <h3 className="font-display text-xl font-bold text-on-surface mb-1">{currentCaseDetail.clientName}</h3>
                <p className="text-sm text-on-surface-variant mb-4">{currentCaseDetail.id}</p>

                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Readiness Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${currentCaseDetail.readinessScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-on-surface">{currentCaseDetail.readinessScore}%</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">SoW Completeness</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-tertiary transition-all"
                          style={{ width: `${currentCaseDetail.sowCompleteness}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-on-surface">{currentCaseDetail.sowCompleteness}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pb-4 border-b border-outline/10">
                  <div>
                    <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Status</p>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${getStatusColor(currentCaseDetail.status)}`}>
                      {currentCaseDetail.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Last Action</p>
                    <p className="text-sm text-on-surface">{currentCaseDetail.lastAction}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{currentCaseDetail.lastActionTime}</p>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <button className="w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    View SoW Draft
                  </button>
                  <button className="w-full px-4 py-2.5 rounded-lg border border-outline/20 text-on-surface text-sm font-medium hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Docs
                  </button>
                  <button className="w-full px-4 py-2.5 rounded-lg border border-outline/20 text-on-surface text-sm font-medium hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />
                    Audit Trail
                  </button>
                </div>
              </div>

              {/* Risk Flags */}
              {riskFlagDetails[currentCaseDetail.id] && riskFlagDetails[currentCaseDetail.id].length > 0 && (
                <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-error" />
                    <h4 className="font-semibold text-on-surface">Risk Flags ({riskFlagDetails[currentCaseDetail.id].length})</h4>
                  </div>

                  <div className="space-y-3">
                    {riskFlagDetails[currentCaseDetail.id].map((flag) => (
                      <div key={flag.id} className={`p-3 rounded-lg ${getRiskSeverityColor(flag.severity)}`}>
                        <p className="text-sm font-semibold">{flag.title}</p>
                        <p className="text-xs mt-1 opacity-90">{flag.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Supporting Documents
                </h4>
                <div className="space-y-2">
                  {caseDocuments[currentCaseDetail.id]?.map((doc, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm text-on-surface">{doc}</span>
                      <ArrowRight className="w-4 h-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Actions */}
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient space-y-2">
                <button className="w-full px-4 py-2.5 rounded-lg bg-tertiary text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <ThumbsUp className="w-4 h-4" />
                  Approve Case
                </button>
                <button className="w-full px-4 py-2.5 rounded-lg border border-error/20 text-error text-sm font-medium hover:bg-error/5 transition-colors flex items-center justify-center gap-2">
                  <Flag className="w-4 h-4" />
                  Escalate
                </button>
                <button className="w-full px-4 py-2.5 rounded-lg border border-outline/20 text-on-surface text-sm font-medium hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Add Comment
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl p-8 shadow-ambient flex items-center justify-center h-96">
              <div className="text-center">
                <Eye className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="text-on-surface-variant">Select a case to review details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
