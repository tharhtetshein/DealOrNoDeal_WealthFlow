import { 
  ChevronRight, 
  Download, 
  CheckCircle2,
  FileText,
  Building,
  Home,
  BarChart3,
  Check,
  Calendar,
  Shield,
  AlertCircle
} from 'lucide-react'

const sowSections = [
  {
    title: 'Business Dividends',
    subtitle: 'Zenith Dynamics Equity Distribution',
    amount: '$8,450,000',
    verified: '03/2024',
    icon: Building,
    description: 'Documented dividend payouts spanning from 2018 to present. Audited financial statements from Price-Waterhouse align with direct bank deposits into the subject\'s Private Wealth accounts. Tax filings from jurisdictions HK-22 and SG-4 confirm lawful declaration and settlement of capital gains.'
  },
  {
    title: 'Property Yields',
    subtitle: 'Commercial Real Estate Income',
    amount: '$3,200,000',
    verified: '04/2024',
    icon: Home,
    description: 'Annual yield reports from Vanguard Realty Group indicate consistent performance of the London-based commercial portfolio. Acquisitions were traced to an initial capital seed provided by the liquidation of tech startup stock options in 2012.'
  }
]

const evidenceDocs = [
  { name: 'FY2023 Tax Return.pdf', type: 'Regulatory Filing', date: 'Oct 12, 2023', status: 'verified' },
  { name: 'Dividend_Statement_Zenith.xlsx', type: 'Bank Record', date: 'Mar 04, 2024', status: 'verified' },
  { name: 'Purchase_Agreement_E14.pdf', type: 'Legal Asset', date: 'Jun 22, 2012', status: 'verified' },
]

const readinessChecks = [
  { label: 'KYC verification complete', status: 'complete' },
  { label: 'Adverse media screening: Clear', status: 'complete' },
  { label: 'Bank statements cross-referenced', status: 'complete' },
  { label: 'Final signatory approval pending', status: 'pending' },
]

export default function WealthReview() {
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-on-surface-variant">
              <span className="text-xs font-medium">CASES</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-xs font-medium">SOW-2024-089</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-xs text-primary font-medium">DRAFT REVIEW</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-on-surface">Wealth Source Review</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2 border border-outline/10">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button className="px-5 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-ambient">
              <CheckCircle2 className="w-4 h-4" />
              Submit for Review
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - Executive Summary & SoW */}
        <div className="col-span-8 space-y-6">
          {/* Executive Summary Card */}
          <div className="rounded-xl gradient-primary p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-semibold text-white/70 tracking-widest uppercase">The Narrative Anchor</span>
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-white/80">Draft Version 1.4</span>
              </div>
              
              <h2 className="font-display text-2xl font-bold mb-4">Executive Summary</h2>
              
              <p className="text-white/90 leading-relaxed italic text-lg mb-8 max-w-3xl">
                "The subject's primary wealth generation stems from a 15-year tenure as Chief Financial Officer at Zenith Dynamics. Accumulated capital was strategically diversified into commercial real estate and a portfolio of high-yield dividend-paying corporate bonds. No significant anomalies were detected during the automated multi-vector screening process."
              </p>
              
              <div className="grid grid-cols-3 gap-8 pt-6 border-t border-white/20">
                <div>
                  <p className="text-[10px] font-semibold text-white/70 tracking-wider uppercase mb-1">Total Verified SoW</p>
                  <p className="font-display text-2xl font-bold">$14.2M</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white/70 tracking-wider uppercase mb-1">Risk Rating</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="font-display text-2xl font-bold">Low</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white/70 tracking-wider uppercase mb-1">Compliance Score</p>
                  <p className="font-display text-2xl font-bold">98%</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Primary SoW Section */}
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant tracking-widest uppercase text-center mb-4">Primary SoW</p>
            
            {sowSections.slice(0, 1).map((section, idx) => {
              const Icon = section.icon
              return (
                <div key={idx} className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient mb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-error" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-bold text-on-surface">{section.title}</h3>
                        <p className="text-sm text-on-surface-variant">{section.subtitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-on-surface">{section.amount}</p>
                      <p className="text-xs text-tertiary">VERIFIED {section.verified}</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{section.description}</p>
                </div>
              )
            })}
          </div>
          
          {/* Secondary SoW Section */}
          <div>
            <p className="text-[10px] font-semibold text-on-surface-variant tracking-widest uppercase text-center mb-4">Secondary SoW</p>
            
            {sowSections.slice(1).map((section, idx) => {
              const Icon = section.icon
              return (
                <div key={idx} className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-error" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-bold text-on-surface">{section.title}</h3>
                        <p className="text-sm text-on-surface-variant">{section.subtitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-on-surface">{section.amount}</p>
                      <p className="text-xs text-tertiary">VERIFIED {section.verified}</p>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{section.description}</p>
                </div>
              )
            })}
          </div>
          
          {/* Evidence Repository */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <p className="text-[10px] font-semibold text-on-surface-variant tracking-widest uppercase mb-4">Evidence Repository</p>
            
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-outline/10">
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Document Name</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Type</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Verification Date</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {evidenceDocs.map((doc, idx) => (
                  <tr key={idx} className="border-b border-outline/5 last:border-0">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
                          <FileText className="w-4 h-4 text-on-surface-variant" />
                        </div>
                        <span className="text-sm font-medium text-on-surface">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-on-surface-variant">{doc.type}</td>
                    <td className="py-4 text-sm text-on-surface-variant">{doc.date}</td>
                    <td className="py-4 text-center">
                      <span className="text-xs font-semibold text-success uppercase tracking-wider">V Sc</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column - Analyst Notes & Readiness */}
        <div className="col-span-4 space-y-6">
          {/* Analyst Notes */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-on-surface flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Analyst Notes
              </h2>
            </div>
            
            <div className="space-y-5">
              <div className="border-l-2 border-primary pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-semibold text-primary tracking-wider uppercase">MARCH 28, 14:20</span>
                </div>
                <p className="text-sm text-on-surface leading-relaxed">
                  "Confirmed bank trail for 2023 dividends. Transaction codes match known payroll entities for Zenith Dynamics."
                </p>
                <p className="text-xs text-on-surface-variant mt-2">Marcus Thorne, Senior Analyst</p>
              </div>
              
              <div className="border-l-2 border-tertiary pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-tertiary" />
                  <span className="text-[10px] font-semibold text-tertiary tracking-wider uppercase">APRIL 02, 09:15</span>
                </div>
                <p className="text-sm text-on-surface leading-relaxed">
                  "Initial red flag on property yield jurisdiction was cleared after reviewing the double-taxation treaty documentation."
                </p>
                <p className="text-xs text-on-surface-variant mt-2">Elena Rossi, Compliance Officer</p>
              </div>
            </div>
            
            {/* Add Note */}
            <div className="mt-6 pt-4 border-t border-outline/10">
              <p className="text-xs text-on-surface-variant mb-2">Add Internal Note</p>
              <textarea
                placeholder="Type observation..."
                rows={3}
                className="w-full px-3 py-2 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <button className="w-full mt-2 py-2 bg-surface-container-high rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container transition-colors">
                Save Annotation
              </button>
            </div>
          </div>
          
          {/* Submission Readiness */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <p className="text-[10px] font-semibold text-on-surface-variant tracking-widest uppercase mb-4">Submission Readiness</p>
            
            <div className="space-y-3">
              {readinessChecks.map((check, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    check.status === 'complete' ? 'bg-success/10' : 'bg-surface-container-high'
                  }`}>
                    {check.status === 'complete' ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-surface-container-highest" />
                    )}
                  </div>
                  <span className={`text-sm ${check.status === 'complete' ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
