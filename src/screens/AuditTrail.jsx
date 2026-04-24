import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Pencil,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'

const auditEntries = [
  {
    timestamp: 'Apr 25, 2026 09:30',
    caseId: 'WF-20260424-0001',
    clientName: 'Mr Bean',
    user: 'Compliance',
    role: 'Compliance',
    action: 'Approved Case',
    actionType: 'approve',
    description: 'Compliance reviewer approved the case after verifying SoW evidence and document completeness.',
  },
  {
    timestamp: 'Apr 24, 2026 10:25',
    caseId: 'WF-20260424-0001',
    clientName: 'Mr Bean',
    user: 'RM',
    role: 'RM',
    action: 'Submitted for Compliance Review',
    actionType: 'submit',
    description: 'Relationship Manager submitted the onboarding case for compliance review.',
  },
  {
    timestamp: 'Apr 24, 2026 10:12',
    caseId: 'WF-20260424-0001',
    clientName: 'Mr Bean',
    user: 'System',
    role: 'System',
    action: 'AI Analysis Completed',
    actionType: 'edit',
    description: 'System completed document extraction, mismatch detection, and readiness impact analysis.',
  },
  {
    timestamp: 'Apr 24, 2026 10:10',
    caseId: 'WF-20260424-0001',
    clientName: 'Mr Bean',
    user: 'RM',
    role: 'RM',
    action: 'Uploaded Passport',
    actionType: 'upload',
    description: 'RM uploaded passport / ID evidence to the case file.',
  },
  {
    timestamp: 'Apr 24, 2026 10:02',
    caseId: 'WF-20260424-0001',
    clientName: 'Mr Bean',
    user: 'RM',
    role: 'RM',
    action: 'Created Case',
    actionType: 'create',
    description: 'New onboarding case was created from the dashboard.',
  },
  {
    timestamp: 'Apr 24, 2026 16:40',
    caseId: 'WF-20260424-0004',
    clientName: 'Nadia Aziz',
    user: 'Compliance',
    role: 'Compliance',
    action: 'Escalated Case',
    actionType: 'escalate',
    description: 'Case escalated for enhanced due diligence due to sanctions-screening concerns.',
  },
]

const actionOptions = ['All', 'Create', 'Upload', 'Edit', 'Submit', 'Approve', 'Escalate']
const roleOptions = ['All', 'RM', 'System', 'Compliance']
const dateRangeOptions = ['All Dates', 'Today', 'Last 7 Days', 'Last 30 Days']

const actionStyles = {
  create: {
    icon: ClipboardList,
    badge: 'bg-surface-container text-on-surface',
  },
  upload: {
    icon: FileUp,
    badge: 'bg-tertiary/12 text-tertiary',
  },
  edit: {
    icon: Pencil,
    badge: 'bg-warning/15 text-warning',
  },
  submit: {
    icon: Send,
    badge: 'bg-primary/10 text-primary',
  },
  approve: {
    icon: CheckCircle2,
    badge: 'bg-success/12 text-success',
  },
  escalate: {
    icon: AlertTriangle,
    badge: 'bg-error/10 text-error',
  },
}

export default function AuditTrail({ onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [dateRangeFilter, setDateRangeFilter] = useState('All Dates')

  const filteredEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      const query = searchQuery.trim().toLowerCase()
      const matchesQuery = !query || `${entry.caseId} ${entry.user} ${entry.action} ${entry.clientName}`.toLowerCase().includes(query)
      const matchesAction = actionFilter === 'All' || entry.action.toLowerCase().includes(actionFilter.toLowerCase())
      const matchesRole = roleFilter === 'All' || entry.role === roleFilter

      let matchesDateRange = true
      if (dateRangeFilter === 'Today') {
        matchesDateRange = entry.timestamp.startsWith('Apr 25, 2026')
      }

      return matchesQuery && matchesAction && matchesRole && matchesDateRange
    })
  }, [searchQuery, actionFilter, roleFilter, dateRangeFilter])

  return (
    <div className="min-h-screen bg-surface p-8 pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary mb-2">Global Monitoring</p>
          <h1 className="font-display text-4xl font-bold text-on-surface">System Audit Log</h1>
          <p className="text-on-surface-variant mt-2">Track all activities across onboarding cases.</p>
        </div>

        <div className="rounded-3xl border border-outline/10 bg-surface-container-lowest shadow-ambient p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_180px] xl:grid-cols-[minmax(0,1fr)_180px_180px_180px] gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by case ID, user, or action..."
                className="w-full rounded-xl border border-outline/15 bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface"
            >
              {actionOptions.map((option) => (
                <option key={option} value={option}>{option === 'All' ? 'Action Type: All' : option}</option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>{option === 'All' ? 'User Role: All' : option}</option>
              ))}
            </select>

            <select
              value={dateRangeFilter}
              onChange={(event) => setDateRangeFilter(event.target.value)}
              className="rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface"
            >
              {dateRangeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-3xl border border-outline/10 bg-surface-container-lowest shadow-ambient overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/10 px-6 py-4 bg-surface-container-lowest">
            <div>
              <h2 className="font-display text-xl font-bold text-on-surface">Activity Entries</h2>
              <p className="text-sm text-on-surface-variant">Centralized audit visibility across all onboarding cases.</p>
            </div>
            <div className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-on-surface">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>

          <div className="max-h-[680px] overflow-y-auto px-6 py-5 space-y-4">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry, index) => {
                const actionStyle = actionStyles[entry.actionType]
                const Icon = actionStyle.icon

                return (
                  <div
                    key={`${entry.caseId}-${entry.timestamp}-${index}`}
                    className={`rounded-2xl border border-outline/10 p-5 ${
                      index % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-1">Timestamp</p>
                        <p className="text-sm font-medium text-on-surface">{entry.timestamp}</p>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${actionStyle.badge}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {entry.action}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[170px_180px_160px_minmax(0,1fr)] gap-4 items-start">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-1">Case ID</p>
                        <button
                          onClick={() => onNavigate?.('case-detail')}
                          className="text-left text-sm font-medium text-primary hover:underline"
                        >
                          {entry.caseId}
                        </button>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-1">Client Name</p>
                        <p className="text-sm text-on-surface">{entry.clientName}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-1">User</p>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-on-surface">{entry.user}</p>
                            <p className="text-xs text-on-surface-variant">{entry.role}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-1">Description</p>
                        <p className="text-sm leading-6 text-on-surface-variant">{entry.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-on-surface-variant">No audit entries match the current filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
