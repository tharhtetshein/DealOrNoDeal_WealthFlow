import { 
  AlertTriangle, 
  Info, 
  Sparkles,
  Mail,
  CheckSquare,
  ArrowRight,
  Clock,
  FileSearch,
  CheckCircle2,
  MoreHorizontal,
  Send,
  Play,
  Image as ImageIcon
} from 'lucide-react'

const timelineEvents = [
  { step: '01', title: 'Vault Initialization', date: 'Oct 12, 09:12 AM', status: 'completed' },
  { step: '02', title: 'AI Analysis Phase', date: 'Oct 12, 10:35 AM', status: 'completed' },
  { step: '03', title: 'Risk Flagging', date: 'Oct 12, 02:22 PM', status: 'completed' },
  { step: '04', title: 'Final Verification', date: 'Pending completion', status: 'pending' },
]

const mismatches = [
  {
    severity: 'critical',
    title: 'Missing proof of wealth',
    description: 'Tax filing for FY 2022-23 is missing official digital signature or stamp.',
    icon: AlertTriangle
  },
  {
    severity: 'moderate',
    title: 'Occupation mismatch',
    description: 'Self-reported role "Director" conflicts with LinkedIn record "Senior Advisor".',
    icon: Info
  }
]

const nextActions = [
  { title: 'Request Digital Tax Signature', description: 'Automated email request to Client Representative', action: 'Send Email', icon: Mail },
  { title: 'Override Occupational Conflict', description: 'Confirm job title manual verification from KYC file', action: 'Execute', icon: CheckSquare },
]

export default function RiskReadiness() {
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-primary tracking-wider uppercase">Analytical Audit</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-on-surface mb-2">Risk & Readiness</h1>
            <p className="text-on-surface-variant max-w-xl">
              A real-time evaluation of Source of Wealth (SoW) integrity for the Blackwood Trust Portfolio.
            </p>
          </div>
          
          <div className="bg-surface-container-lowest rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase text-center">Case ID</p>
            <p className="font-display font-bold text-on-surface">#WF-9921-BK</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-4 space-y-6">
          {/* Verification Health */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-error via-warning to-success" />
            
            <h2 className="font-display text-lg font-bold text-on-surface mb-6">Verification Health</h2>
            
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-40 h-40">
                <svg className="w-40 h-40 -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="hsl(var(--surface-container-high))" strokeWidth="8" fill="none" />
                  <circle cx="80" cy="80" r="70" stroke="hsl(var(--error))" strokeWidth="8" fill="none" 
                    strokeDasharray={`${0.85 * 2 * Math.PI * 70} ${2 * Math.PI * 70}`} 
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-bold text-on-surface">85%</span>
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider">Readiness</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline/10">
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-on-surface">142</p>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider">Data Points</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-tertiary">121</p>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider">Verified</p>
              </div>
            </div>
          </div>
          
          {/* Critical Mismatches */}
          <div className="space-y-4">
            {mismatches.map((mismatch, idx) => {
              const Icon = mismatch.icon
              return (
                <div key={idx} className={`rounded-xl p-5 shadow-ambient ${
                  mismatch.severity === 'critical' ? 'bg-error/5' : 'bg-surface-container-lowest'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      mismatch.severity === 'critical' ? 'bg-error/10' : 'bg-warning/10'
                    }`}>
                      <Icon className={`w-5 h-5 ${mismatch.severity === 'critical' ? 'text-error' : 'text-warning'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          mismatch.severity === 'critical' ? 'bg-error text-white' : 'bg-surface-container-high text-on-surface-variant'
                        }`}>
                          {mismatch.severity}
                        </span>
                      </div>
                      <h3 className={`font-display text-base font-bold ${mismatch.severity === 'critical' ? 'text-error' : 'text-on-surface'}`}>
                        {mismatch.title}
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-1">{mismatch.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Middle Column - Next Actions */}
        <div className="col-span-4">
          <div className="bg-surface-container-low rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Next Best Actions
            </h2>
            
            <div className="space-y-3">
              {nextActions.map((action, idx) => {
                const Icon = action.icon
                return (
                  <div key={idx} className="bg-surface-container-lowest rounded-lg p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-on-surface-variant" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-on-surface">{action.title}</h3>
                        <p className="text-xs text-on-surface-variant mt-1">{action.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                        idx === 0 
                          ? 'gradient-primary text-white' 
                          : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                      }`}>
                        {idx === 0 && <Send className="w-3 h-3" />}
                        {idx === 1 && <Play className="w-3 h-3" />}
                        {action.action}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Timeline & Advisory */}
        <div className="col-span-4 space-y-6">
          {/* Case Timeline */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <h2 className="font-display text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">Case Timeline</h2>
            
            <div className="space-y-4">
              {timelineEvents.map((event, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      event.status === 'completed' 
                        ? 'bg-primary text-white' 
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {event.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : event.step}
                    </div>
                    {idx !== timelineEvents.length - 1 && (
                      <div className="w-px flex-1 bg-outline/20 my-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-semibold ${event.status === 'completed' ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                      {event.title}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Complex Asset Advisory */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-ambient">
            <div className="h-32 relative">
              <img 
                src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=150&fit=crop" 
                alt="Asset Structure"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest to-transparent" />
            </div>
            <div className="p-5">
              <span className="text-[10px] font-semibold text-error tracking-wider uppercase">Vault Advisory</span>
              <h3 className="font-display text-base font-bold text-on-surface mt-1 mb-2">Complex Asset Structures Detected</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                The Blackwood Trust incorporates several off-shore holding companies. While currently classified as "Low Risk," these will require additional jurisdictional transparency checks during the final audit phase.
              </p>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-surface-container rounded-lg text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors">
                  Review Structure
                </button>
                <button className="text-primary text-xs font-medium flex items-center gap-1 hover:underline">
                  View Map <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
