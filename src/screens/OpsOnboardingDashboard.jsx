import { useMemo, useState } from 'react'
import {
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Edit2,
  RefreshCw,
  Flag,
  Plus,
  AlertCircle,
  Zap,
  Eye,
  Download,
  Save,
  X,
  Clock,
} from 'lucide-react'

const cases = [
  {
    id: 'WF-1102',
    clientName: 'Ariella Tan',
    status: 'Draft',
    readinessScore: 45,
    missingDocs: ['Passport', 'Tax Returns 2024'],
    dataIssues: ['Income source unclear'],
    lastUpdated: '2026-04-21',
    priority: 'high',
  },
  {
    id: 'WF-1108',
    clientName: 'Marcus Lee',
    status: 'In Review',
    readinessScore: 78,
    missingDocs: [],
    dataIssues: ['Business registration date mismatch'],
    lastUpdated: '2026-04-23',
    priority: 'high',
  },
  {
    id: 'WF-1113',
    clientName: 'Isabelle Wong',
    status: 'Ready for Review',
    readinessScore: 95,
    missingDocs: [],
    dataIssues: [],
    lastUpdated: '2026-04-22',
    priority: 'normal',
  },
  {
    id: 'WF-1116',
    clientName: 'Daniel Koh',
    status: 'Escalated',
    readinessScore: 72,
    missingDocs: [],
    dataIssues: ['Wealth source narrative incomplete'],
    lastUpdated: '2026-04-23',
    priority: 'high',
  },
  {
    id: 'WF-1120',
    clientName: 'Richard Lim',
    status: 'Draft',
    readinessScore: 35,
    missingDocs: ['Payslips', 'Bank Statements'],
    dataIssues: ['Employment history incomplete', 'Income inconsistency'],
    lastUpdated: '2026-04-20',
    priority: 'high',
  },
  {
    id: 'WF-1124',
    clientName: 'Celine Ong',
    status: 'In Review',
    readinessScore: 88,
    missingDocs: [],
    dataIssues: [],
    lastUpdated: '2026-04-23',
    priority: 'normal',
  },
]

const documentChecklist = {
  'WF-1102': [
    { name: 'Passport / ID Document', uploaded: false, required: true },
    { name: 'Recent Payslips - 3 months', uploaded: true, required: true },
    { name: 'Tax Returns - 2 years', uploaded: false, required: true },
    { name: 'Bank Statements - 6 months', uploaded: true, required: true },
    { name: 'Bank Reference Letter', uploaded: false, required: true },
    { name: 'CV / Resume', uploaded: true, required: true },
  ],
  'WF-1108': [
    { name: 'Passport / ID Document', uploaded: true, required: true },
    { name: 'Recent Payslips - 3 months', uploaded: true, required: true },
    { name: 'Tax Returns - 2 years', uploaded: true, required: true },
    { name: 'Bank Statements - 6 months', uploaded: true, required: true },
    { name: 'Bank Reference Letter', uploaded: true, required: true },
    { name: 'Business Registration', uploaded: true, required: false },
  ],
}

const extractedData = {
  'WF-1102': {
    fullName: 'Ariella Tan',
    occupation: 'Software Engineer',
    nationality: 'Singaporean',
    estimatedWealth: 'SGD 500,000',
    primarySourceOfWealth: 'Employment - Technology Sector',
    employmentHistory: '2018-Present: ABC Tech Pte Ltd',
  },
  'WF-1108': {
    fullName: 'Marcus Lee',
    occupation: 'Business Owner',
    nationality: 'Malaysian',
    estimatedWealth: 'SGD 1,200,000',
    primarySourceOfWealth: 'Self-Employment - Trading Business',
    employmentHistory: '2015-Present: Marcus Lee Trading Corp',
    businessRegDate: '2014-12-15',
  },
}

// Helper Functions

function getStatusBadge(status) {
  const badges = {
    Draft: 'bg-surface-100 text-surface-700',
    'In Review': 'bg-primary-100 text-primary-700',
    'Ready for Review': 'bg-success-100 text-success-700',
    Escalated: 'bg-error-100 text-error-700',
  }
  return badges[status] || 'bg-surface-100 text-surface-700'
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

// Metric Card Component

function MetricCard({ label, value, icon, color }) {
  const bgColors = {
    error: 'bg-error-50',
    warning: 'bg-warning-50',
    success: 'bg-success-50',
    primary: 'bg-primary-50',
  }

  return (
    <div className={`${bgColors[color]} rounded-lg border border-surface-200 p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-surface-600 font-medium">{label}</p>
          <p className="text-3xl font-bold text-surface-900 mt-2">{value}</p>
        </div>
        <div className="p-3 bg-surface-100 rounded-lg">{icon}</div>
      </div>
    </div>
  )
}

// Main Component

export default function OpsOnboardingDashboard() {
  const [selectedCaseId, setSelectedCaseId] = useState('WF-1102')
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)

  const selectedCase = cases.find((c) => c.id === selectedCaseId)
  const caseDocChecklist = documentChecklist[selectedCaseId] || []
  const caseExtractedData = extractedData[selectedCaseId] || {}

  // Compute metrics
  const metrics = useMemo(() => {
    const withMissingDocs = cases.filter((c) => c.missingDocs.length > 0).length
    const withDataIssues = cases.filter((c) => c.dataIssues.length > 0).length
    const notReady = cases.filter((c) => c.readinessScore < 75).length
    const avgReadiness = Math.round(cases.reduce((sum, c) => sum + c.readinessScore, 0) / cases.length)

    return {
      casesWithMissingDocs: withMissingDocs,
      casesWithDataIssues: withDataIssues,
      casesNotReady: notReady,
      averageReadiness: avgReadiness,
    }
  }, [])

  // Filter cases
  const filteredCases = useMemo(() => {
    let result = cases

    if (statusFilter !== 'All') {
      result = result.filter((c) => c.status === statusFilter)
    }

    if (searchQuery) {
      result = result.filter((c) => c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.includes(searchQuery))
    }

    // Prioritize cases with issues
    return result.sort((a, b) => {
      const aIssues = a.missingDocs.length + a.dataIssues.length
      const bIssues = b.missingDocs.length + b.dataIssues.length
      return bIssues - aIssues
    })
  }, [statusFilter, searchQuery])

  const handleEditClick = () => {
    setEditData({ ...caseExtractedData })
    setEditMode(true)
  }

  const handleSaveEdits = () => {
    // In real app, would call API to save
    console.log('Saving extracted data:', editData)
    setEditMode(false)
    setEditData(null)
  }

  const handleCancelEdits = () => {
    setEditMode(false)
    setEditData(null)
  }

  const handleRegenSoW = () => {
    // In real app, would call API to regenerate SoW
    console.log('Regenerating SoW for case:', selectedCaseId)
  }

  const handleMarkReady = () => {
    // In real app, would update case status
    console.log('Marking case as ready:', selectedCaseId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-surface-950">Onboarding Quality & Issue Resolution</h1>
        <p className="text-surface-600 mt-2">Identify and resolve issues preventing cases from compliance readiness</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Cases with Missing Docs"
          value={metrics.casesWithMissingDocs}
          icon={<Upload className="text-error-500" size={24} />}
          color="error"
        />
        <MetricCard
          label="Cases with Data Issues"
          value={metrics.casesWithDataIssues}
          icon={<AlertTriangle className="text-warning-500" size={24} />}
          color="warning"
        />
        <MetricCard
          label="Cases Not Ready (<75%)"
          value={metrics.casesNotReady}
          icon={<AlertCircle className="text-warning-600" size={24} />}
          color="warning"
        />
        <MetricCard
          label="Average Readiness"
          value={`${metrics.averageReadiness}%`}
          icon={<CheckCircle2 className="text-success-500" size={24} />}
          color="success"
        />
      </div>

      {/* Main Content - Case List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case List */}
        <div className="lg:col-span-1">
          <div className="bg-surface-0 rounded-lg border border-surface-200 overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-surface-200">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-surface-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by name or ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-surface-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="p-4 border-b border-surface-200 flex flex-wrap gap-2">
              {['All', 'Draft', 'In Review', 'Ready for Review'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Case Items */}
            <div className="overflow-y-auto max-h-[500px]">
              {filteredCases.map((caseItem) => {
                const issueCount = caseItem.missingDocs.length + caseItem.dataIssues.length
                return (
                  <button
                    key={caseItem.id}
                    onClick={() => setSelectedCaseId(caseItem.id)}
                    className={`w-full text-left p-4 border-b border-surface-100 transition-colors hover:bg-surface-50 ${
                      selectedCaseId === caseItem.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-surface-900">{caseItem.clientName}</p>
                        <p className="text-xs text-surface-500">{caseItem.id}</p>
                      </div>
                      {caseItem.priority === 'high' && <Flag className="text-error-500" size={16} />}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusBadge(caseItem.status)}`}>
                        {caseItem.status}
                      </span>
                      <span className="text-xs text-surface-600">{caseItem.readinessScore}%</span>
                    </div>
                    {issueCount > 0 && (
                      <div className="flex items-center text-xs text-error-600">
                        <AlertTriangle size={14} className="mr-1" />
                        {issueCount} issue{issueCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Case Detail Panel */}
        {selectedCase && (
          <div className="lg:col-span-2 space-y-6">
            {/* Case Header */}
            <div className="bg-surface-0 rounded-lg border border-surface-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-surface-900">{selectedCase.clientName}</h2>
                  <p className="text-surface-600 text-sm mt-1">{selectedCase.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary-600">{selectedCase.readinessScore}%</p>
                  <p className="text-xs text-surface-600">Readiness Score</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-surface-200">
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${getStatusBadge(selectedCase.status)}`}>
                  {selectedCase.status}
                </span>
                <div className="flex gap-2">
                  {selectedCase.status !== 'Escalated' && selectedCase.readinessScore >= 75 && (
                    <button
                      onClick={handleMarkReady}
                      className="flex items-center gap-2 px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors text-sm font-medium"
                    >
                      <CheckCircle2 size={16} />
                      Mark as Ready
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Document Checklist */}
            <div className="bg-surface-0 rounded-lg border border-surface-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
                  <FileText size={20} />
                  Document Checklist
                </h3>
                <span className="text-xs font-medium text-surface-600">
                  {caseDocChecklist.filter((d) => d.uploaded).length}/{caseDocChecklist.length}
                </span>
              </div>
              <div className="space-y-3">
                {caseDocChecklist.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg border border-surface-100">
                    <div className="flex items-center gap-3 flex-1">
                      {doc.uploaded ? (
                        <CheckCircle2 className="text-success-500 flex-shrink-0" size={18} />
                      ) : (
                        <div className="w-5 h-5 border-2 border-surface-300 rounded flex-shrink-0" />
                      )}
                      <span className={`text-sm ${doc.uploaded ? 'text-surface-700' : 'text-surface-600'}`}>
                        {doc.name}
                        {doc.required && <span className="text-error-500 ml-1">*</span>}
                      </span>
                    </div>
                    {!doc.uploaded && (
                      <button className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                        <Upload size={14} />
                        Upload
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Extracted Data */}
            <div className="bg-surface-0 rounded-lg border border-surface-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
                  <Eye size={20} />
                  Extracted Client Data
                </h3>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <button
                        onClick={handleSaveEdits}
                        className="flex items-center gap-1 text-xs text-success-600 hover:text-success-700 font-medium"
                      >
                        <Save size={14} />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdits}
                        className="flex items-center gap-1 text-xs text-surface-600 hover:text-surface-700 font-medium"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEditClick}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editMode && editData ? (
                <div className="space-y-3">
                  {Object.entries(editData).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-surface-700 uppercase">{formatLabel(key)}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(caseExtractedData).map(([key, value]) => (
                    <div key={key} className="p-3 bg-surface-50 rounded-lg border border-surface-100">
                      <p className="text-xs font-medium text-surface-600 uppercase mb-1">{formatLabel(key)}</p>
                      <p className="text-sm text-surface-900">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data Issues */}
            {selectedCase.dataIssues.length > 0 && (
              <div className="bg-surface-0 rounded-lg border border-error-200 p-6">
                <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2 mb-4">
                  <AlertCircle className="text-error-500" size={20} />
                  Data Issues Found
                </h3>
                <div className="space-y-3">
                  {selectedCase.dataIssues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-error-50 rounded-lg border border-error-200">
                      <AlertTriangle className="text-error-500 flex-shrink-0 mt-0.5" size={18} />
                      <div className="flex-1">
                        <p className="text-sm text-error-900 font-medium">{issue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleRegenSoW}
                className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors text-sm font-medium"
              >
                <RefreshCw size={16} />
                Regenerate SoW Draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
