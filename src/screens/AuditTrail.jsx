import { 
  Search, 
  Calendar, 
  Download, 
  X, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react'

const auditEntries = [
  {
    date: 'Oct 24, 2023',
    time: '14:22:15 GMT',
    user: 'Elena Vance',
    role: 'Chief Compliance Officer',
    action: 'ESCALATED',
    actionType: 'escalation',
    notes: 'Case #8291 flagged for enhanced due diligence after suspicious cross-border liquidity shift.',
  },
  {
    date: 'Oct 24, 2023',
    time: '11:05:42 GMT',
    user: 'Marcus Thorne',
    role: 'Senior Wealth Lead',
    action: 'EDITED DRAFT',
    actionType: 'edit',
    notes: 'Adjusted risk profile from Conservative to Balanced per Client review meeting.',
  },
  {
    date: 'Oct 23, 2023',
    time: '09:15:00 GMT',
    user: 'System Process',
    role: 'Automated Vault Agent',
    action: 'AUTO-ARCHIVED',
    actionType: 'system',
    notes: 'Legacy statement batch from Q3-2022 moved to permanent deep storage.',
  },
  {
    date: 'Oct 22, 2023',
    time: '17:50:33 GMT',
    user: 'Sarah Jenkins',
    role: 'Portfolio Manager',
    action: 'APPROVED',
    actionType: 'approval',
    notes: 'Final sign-off on 10-year growth strategy for the "Sterling Family Trust".',
  },
]

const actionColors = {
  escalation: 'bg-error/10 text-error border border-error/20',
  edit: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
  system: 'bg-surface-container-high text-on-surface-variant',
  approval: 'bg-success/10 text-success border border-success/20',
}

export default function AuditTrail() {
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header Section */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold text-on-surface mb-2">Audit Trail</h1>
            <p className="text-on-surface-variant max-w-xl">
              A definitive ledger of case interactions, modifications, and high-level escalations within the private vault.
            </p>
          </div>
          
          <button className="px-6 py-3 gradient-primary text-white rounded-lg font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-ambient">
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 mb-6">
        <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-4">
          {/* Filter by Professional */}
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
              Filter by Professional
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Name, role, or ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          
          {/* Date Range */}
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
              Date Range
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value="Oct 01, 2023 - Oct 31, 2023"
                readOnly
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm text-on-surface"
              />
            </div>
          </div>
          
          {/* Quick Actions */}
          <div>
            <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
              Quick Actions
            </label>
            <div className="flex gap-2">
              <button className="px-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button className="px-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2">
                <X className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="px-8">
        <div className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-container-low border-b border-outline/5">
            <div className="col-span-2">
              <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Timestamp</span>
            </div>
            <div className="col-span-3">
              <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">User</span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Action Taken</span>
            </div>
            <div className="col-span-4">
              <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Notes</span>
            </div>
            <div className="col-span-1 text-right">
              <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Reference</span>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-outline/5">
            {auditEntries.map((entry, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-4 px-6 py-5 hover:bg-surface-container-low/50 transition-colors">
                {/* Timestamp */}
                <div className="col-span-2">
                  <p className="text-sm font-medium text-on-surface">{entry.date}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{entry.time}</p>
                </div>
                
                {/* User */}
                <div className="col-span-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-on-surface">
                      {entry.user.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{entry.user}</p>
                    <p className="text-[10px] text-error uppercase tracking-wider mt-0.5">{entry.role}</p>
                  </div>
                </div>
                
                {/* Action */}
                <div className="col-span-2">
                  <span className={`inline-block px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-wider ${actionColors[entry.actionType]}`}>
                    {entry.action}
                  </span>
                </div>
                
                {/* Notes */}
                <div className="col-span-4">
                  <p className="text-sm text-on-surface-variant leading-relaxed">{entry.notes}</p>
                </div>
                
                {/* Reference */}
                <div className="col-span-1 flex justify-end">
                  <button className="p-2 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline/5 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">Showing 1-10 of 254 entries</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-lg gradient-primary text-white text-sm font-medium">1</button>
              <button className="w-8 h-8 rounded-lg hover:bg-surface-container-high transition-colors text-sm text-on-surface-variant">2</button>
              <button className="w-8 h-8 rounded-lg hover:bg-surface-container-high transition-colors text-sm text-on-surface-variant">3</button>
              <button className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
