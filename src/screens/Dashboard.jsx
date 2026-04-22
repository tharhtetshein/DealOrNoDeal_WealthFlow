import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Clock3
} from 'lucide-react'

const stats = [
  { 
    id: 'total', 
    label: 'TOTAL CASES', 
    value: '1,402', 
    change: '+12%', 
    changeLabel: 'vs last month',
    trend: 'up',
    icon: TrendingUp,
    bgColor: 'bg-surface-container-lowest'
  },
  { 
    id: 'ready', 
    label: 'READY FOR REVIEW', 
    value: '24', 
    sublabel: '4 High priority',
    icon: CheckCircle2,
    bgColor: 'bg-surface-container-lowest'
  },
  { 
    id: 'missing', 
    label: 'MISSING DOCS', 
    value: '18', 
    warning: 'Critical delay',
    icon: AlertTriangle,
    bgColor: 'bg-surface-container-lowest'
  },
  { 
    id: 'escalated', 
    label: 'ESCALATED', 
    value: '07', 
    sublabel: 'Action required',
    icon: Clock,
    bgColor: 'bg-surface-container-lowest'
  },
]

const recentCases = [
  { name: 'Alexandra Rothschild', type: 'Asset Diversification', updated: '2h ago', risk: 'LOW RISK', status: 'Pending' },
  { name: 'Marcus Sterling', type: 'Estate Planning', updated: '5h ago', risk: 'HIGH RISK', status: 'Review' },
  { name: 'Elena Vance', type: 'Tax Optimization', updated: 'Yesterday', risk: 'MEDIUM', status: 'Archived' },
  { name: 'Julian Thorne', type: 'Private Equity', updated: 'Oct 24, 2023', risk: 'LOW RISK', status: 'Urgent' },
]

const activityFeed = [
  { type: 'compliance', title: 'Compliance check passed', description: 'Case #WF-8821 (Sterling Portfolio)', time: '12 MINUTES AGO', icon: CheckCircle2, color: 'success' },
  { type: 'document', title: 'Document Uploaded', description: 'Proof of Identity: Elena Vance', time: '2 HOURS AGO', icon: Clock3, color: 'muted' },
  { type: 'account', title: 'New Account Linked', description: 'Morgan Stanley Institutional Vault', time: '4 HOURS AGO', icon: TrendingUp, color: 'tertiary' },
  { type: 'alert', title: 'Missing Signature Alert', description: 'Julian Thorne: Trust Agreement', time: '6 HOURS AGO', icon: AlertTriangle, color: 'error' },
]

export default function Dashboard() {
  const getRiskBadgeClass = (risk) => {
    switch(risk) {
      case 'LOW RISK': return 'bg-tertiary/10 text-tertiary'
      case 'HIGH RISK': return 'bg-error/10 text-error'
      case 'MEDIUM': return 'bg-warning/10 text-warning'
      default: return 'bg-surface-container-high text-on-surface-variant'
    }
  }

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Pending': return 'bg-surface-container-high text-on-surface'
      case 'Review': return 'bg-primary text-white'
      case 'Urgent': return 'bg-error/20 text-error'
      case 'Archived': return 'bg-tertiary/10 text-tertiary'
      default: return 'bg-surface-container-high text-on-surface'
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Welcome Section */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold text-on-surface mb-2">
              Executive <span className="text-primary">Overview</span>
            </h1>
            <p className="text-on-surface-variant max-w-xl">
              Welcome back. Your vault is secured. There are 4 cases requiring immediate regulatory review.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - Stats & Cases */}
        <div className="col-span-8 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.id} className={`${stat.bgColor} rounded-xl p-5 shadow-ambient`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.id === 'total' ? 'bg-primary/10' : stat.id === 'ready' ? 'bg-success/10' : stat.id === 'missing' ? 'bg-error/10' : 'bg-warning/10'} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${stat.id === 'total' ? 'text-primary' : stat.id === 'ready' ? 'text-success' : stat.id === 'missing' ? 'text-error' : 'text-warning'}`} />
                    </div>
                    {stat.trend === 'up' && (
                      <div className="flex items-center gap-1 text-success text-xs">
                        <ArrowUpRight className="w-3 h-3" />
                        {stat.change}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider mb-1">{stat.label}</p>
                  <p className="font-display text-3xl font-bold text-on-surface mb-1">{stat.value}</p>
                  {stat.changeLabel && <p className="text-xs text-tertiary">{stat.changeLabel}</p>}
                  {stat.sublabel && <p className="text-xs text-on-surface-variant">{stat.sublabel}</p>}
                  {stat.warning && (
                    <div className="flex items-center gap-1 text-error text-xs mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      {stat.warning}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Recent Cases */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-on-surface">Recent Wealth Cases</h2>
              <button className="text-primary text-sm font-medium flex items-center gap-1 hover:underline">
                View all cases <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Client Name</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Case Type</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Last Updated</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Risk Level</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((caseItem, idx) => (
                  <tr key={idx} className="border-t border-outline/5">
                    <td className="py-4 text-sm font-medium text-on-surface">{caseItem.name}</td>
                    <td className="py-4 text-sm text-on-surface-variant">{caseItem.type}</td>
                    <td className="py-4 text-sm text-on-surface-variant">{caseItem.updated}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase ${getRiskBadgeClass(caseItem.risk)}`}>
                        {caseItem.risk}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadgeClass(caseItem.status)}`}>
                        {caseItem.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column - AUM & Activity */}
        <div className="col-span-4 space-y-6">
          {/* AUM Card */}
          <div className="rounded-xl gradient-primary p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-white/70 text-xs mb-2">Assets Under Management</p>
              <p className="font-display text-4xl font-bold mb-4">$4.2B</p>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/20 rounded text-xs">+1.4% (24h)</span>
                <span className="px-2 py-1 bg-white/20 rounded text-xs">Stable</span>
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-on-surface">Activity Feed</h2>
              <button className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                <Clock3 className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            
            <div className="space-y-5">
              {activityFeed.map((activity, idx) => {
                const Icon = activity.icon
                return (
                  <div key={idx} className="flex gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      activity.color === 'success' ? 'bg-success' : 
                      activity.color === 'error' ? 'bg-error' : 
                      activity.color === 'tertiary' ? 'bg-tertiary' : 
                      'bg-surface-container-highest'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${activity.color === 'error' ? 'text-error' : 'text-on-surface'}`}>
                        {activity.title}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">{activity.description}</p>
                      <p className="text-[10px] text-on-surface-variant/70 mt-1 uppercase tracking-wider">{activity.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <button className="w-full mt-6 py-3 text-sm font-medium text-on-surface-variant bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors">
              VIEW FULL AUDIT TRAIL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
