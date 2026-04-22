import { 
  Zap, 
  AlertTriangle, 
  ChevronRight, 
  ArrowLeft,
  ArrowRight,
  Filter,
  Download,
  Info,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  MoreHorizontal,
  Trash2,
  Check
} from 'lucide-react'

const extractionData = [
  { marker: 'Total Net Worth', disclosure: '$12,450,000', extracted: '$12,450,000', status: 'match', note: 'Cross-validated Aggregates' },
  { marker: 'Annual Passive Income', disclosure: '$840,000', extracted: '$612,400', status: 'mismatch', note: 'Dividends & Interest feeds' },
  { marker: 'Real Estate Assets', disclosure: '$4,200,000', extracted: '$4,185,000', status: 'info', note: 'Auto & Prop-Tech sync' },
  { marker: 'Art & Collectibles', disclosure: '$1,150,000', extracted: '$1,150,000', status: 'match', note: 'Manual appraisal upload' },
  { marker: 'Private Equity Commit', disclosure: '$3,500,000', extracted: '$3,500,000', status: 'match', note: 'K-1 Form Extraction' },
]

const mismatches = [
  {
    severity: 'high',
    title: 'Hedge Fund Valuation',
    description: 'Conflict between self-reported value and custodian feed.',
    details: { client: '$2.4M', extracted: '$1.95M' }
  },
  {
    severity: 'data',
    title: 'Beneficiary Address',
    description: 'Extracted OCR text contains unreadable characters in Zip Code.',
    action: 'MANUAL OVERRIDE'
  }
]

export default function Extraction() {
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-on-surface-variant">
              <span className="text-sm">Vault</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-sm">Client Extraction</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-sm text-primary font-medium">Smart Analysis #8842</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-on-surface mb-2">
              Smart <span className="text-primary">Extraction</span> Analysis
            </h1>
            <p className="text-on-surface-variant max-w-2xl">
              Comparing structured data points from Asset Statement V2 against manual client disclosures. Discrepancies highlighted in crimson require manual override or verification.
            </p>
          </div>
          
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm text-right">
            <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-1">Extraction Confidence</p>
            <p className="font-display text-3xl font-bold text-primary">98.4%</p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <span className="px-2 py-0.5 bg-surface-container-high rounded text-[10px] text-on-surface-variant flex items-center gap-1">
                <Zap className="w-3 h-3" /> AI OPTIMIZED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - Mismatches */}
        <div className="col-span-4 space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-error" />
              <h2 className="font-display text-lg font-bold text-error">CRITICAL MISMATCHES</h2>
            </div>
            
            <div className="space-y-4">
              {mismatches.map((mismatch, idx) => (
                <div key={idx} className={`rounded-lg p-4 border-l-4 ${
                  mismatch.severity === 'high' 
                    ? 'bg-error/5 border-error' 
                    : 'bg-surface-container-low border-on-surface-variant/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      mismatch.severity === 'high' 
                        ? 'bg-error/10 text-error' 
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {mismatch.severity === 'high' ? 'HIGH RISK' : 'DATA GAP'}
                    </span>
                  </div>
                  <h3 className={`font-display text-sm font-bold ${mismatch.severity === 'high' ? 'text-error' : 'text-on-surface'}`}>
                    {mismatch.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 mb-3">{mismatch.description}</p>
                  
                  {mismatch.details && (
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-on-surface-variant">Client:</span>
                        <span className="ml-1 text-error font-semibold">{mismatch.details.client}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-on-surface-variant" />
                      <div>
                        <span className="text-on-surface-variant">Extracted:</span>
                        <span className="ml-1 text-tertiary font-semibold">{mismatch.details.extracted}</span>
                      </div>
                    </div>
                  )}
                  
                  {mismatch.action && (
                    <div className="flex items-center gap-2 mt-3 text-error">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs font-semibold uppercase tracking-wider">{mismatch.action}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* AI Insights */}
          <div className="rounded-xl bg-tertiary p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <span className="font-display font-bold">AI Insights</span>
            </div>
            
            <p className="text-sm text-white/90 leading-relaxed mb-4">
              The 18% variance in liquid assets suggests potential <span className="font-semibold text-white underline">undisclosed offshore accounts</span> or a timing lag in the most recent quarterly report.
            </p>
            
            <div className="bg-white/10 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-white/80" />
                <span className="text-xs text-white/80">Flagged for Enhanced Due Diligence</span>
              </div>
            </div>
            
            <button className="w-full py-2.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors flex items-center justify-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Reconcile against Tax Returns
            </button>
          </div>
        </div>

        {/* Middle Column - Structured Extraction */}
        <div className="col-span-5">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-lg font-bold text-on-surface">Structured Extraction</h2>
                <p className="text-sm text-on-surface-variant">Comparing 24 key financial markers</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                  <Filter className="w-4 h-4 text-on-surface-variant" />
                </button>
                <button className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                  <Download className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            </div>
            
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-outline/10">
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Financial Marker</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Client Disclosure</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Smart Extraction</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {extractionData.map((row, idx) => (
                  <tr key={idx} className="border-b border-outline/5 last:border-0">
                    <td className="py-4">
                      <p className="text-sm font-medium text-on-surface">{row.marker}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{row.note}</p>
                    </td>
                    <td className="py-4 text-sm text-on-surface">{row.disclosure}</td>
                    <td className={`py-4 text-sm font-medium ${
                      row.status === 'mismatch' ? 'text-error' : 'text-on-surface'
                    }`}>
                      {row.extracted}
                    </td>
                    <td className="py-4 text-right">
                      {row.status === 'match' && <CheckCircle2 className="w-5 h-5 text-success inline" />}
                      {row.status === 'mismatch' && <AlertCircle className="w-5 h-5 text-error inline" />}
                      {row.status === 'info' && <Info className="w-5 h-5 text-tertiary inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <p className="text-xs text-on-surface-variant italic mt-4">
              "Document OCR source: JP Morgan Private Bank Q4 Statement.pdf"
            </p>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-outline/10">
              <button className="px-4 py-2.5 bg-surface-container rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Discard All Changes
              </button>
              <button className="px-6 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-ambient flex items-center gap-2">
                <Check className="w-4 h-4" />
                Confirm Data & Sync
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Document Preview */}
        <div className="col-span-3">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-bold text-on-surface-variant uppercase tracking-wider">View Raw Document</h2>
              <button className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                <MoreHorizontal className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Direct access to the source Statement of Wealth for side-by-side human auditing.
            </p>
            
            <div className="bg-surface-container rounded-lg p-4 text-center">
              <FileText className="w-12 h-12 text-on-surface-variant mx-auto mb-2" />
              <p className="text-xs text-on-surface-variant">JP Morgan Private Bank</p>
              <p className="text-xs text-on-surface-variant">Q4 Statement.pdf</p>
            </div>
            
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-2 h-2 rounded-full bg-error" />
              <div className="w-2 h-2 rounded-full bg-tertiary" />
              <div className="w-2 h-2 rounded-full bg-surface-container-high" />
              <ArrowRight className="w-3 h-3 text-on-surface-variant" />
            </div>
          </div>
          
          {/* Bottom Cards */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-on-surface-variant" />
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Source Verification</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">OCR Accuracy</span>
                  <span className="font-semibold text-on-surface">99.2%</span>
                </div>
                <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full w-[99%] bg-success rounded-full" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">Timestamp Integrity</span>
                  <span className="font-semibold text-success">VERIFIED</span>
                </div>
              </div>
            </div>
            
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-on-surface-variant" />
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Compliance Shield</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">KYC Match Score</span>
                  <span className="font-semibold text-on-surface">88/100</span>
                </div>
                <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full w-[88%] bg-tertiary rounded-full" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">AML Conflict</span>
                  <span className="font-semibold text-success">NONE FOUND</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Shield({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L2 4V7C2 11 5 14.5 8 15C11 14.5 14 11 14 7V4L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
