import { useState, useEffect } from 'react'
import { 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  ChevronRight,
  Building,
  Scale,
  Newspaper,
  Download,
  RefreshCw,
  Globe,
  Shield,
  Info,
  Loader2
} from 'lucide-react'
import { verifyEntity } from '../lib/api'

const acraData = {
  entityName: 'Stellar Dynamics Pte Ltd',
  uen: '201948291M',
  status: 'Live',
  incorporated: '12 Aug 2019',
  verified: true,
  confirmation: 'The entity is in good standing with the Accounting and Corporate Regulatory Authority (ACRA). All annual returns and statutory filings are up to date.'
}

const pepSanctions = [
  { name: 'OFAC Sanctions List', status: 'cleared', count: 'No matches found' },
  { name: 'UN Security Council', status: 'cleared', count: 'No matches found' },
  { name: 'EU Consolidated List', status: 'cleared', count: 'No matches found' },
  { name: 'Global PEP Register', status: 'attention', count: '1 potential partial match (Director). Review required.' },
]

const newsArticles = [
  {
    sentiment: 'positive',
    source: 'Bloomberg',
    time: '2d ago',
    headline: 'Stellar Dynamics Secures Series B Funding for Regional Expansion',
    summary: 'The Singapore-based tech firm announced a successful $45M funding round led by global...',
    indicator: 'Low Risk Indicator'
  },
  {
    sentiment: 'neutral',
    source: 'Business Times',
    time: '1w ago',
    headline: 'Tech Sector Faces Regulatory Adjustments in Q3',
    summary: 'Industry-wide analysis mentions Stellar Dynamics among several mid-sized firms adapting to the n...',
    indicator: 'Standard Monitoring'
  },
]

export default function Verification({ clientData }) {
  const [verificationData, setVerificationData] = useState(null)
  const [loading, setLoading] = useState(false)

  const runVerification = async () => {
    setLoading(true)
    try {
      const result = await verifyEntity(clientData || {
        clientName: 'Alexander Sterling',
        occupation: 'Tech Executive'
      }, {})
      setVerificationData(result.verification)
    } catch (error) {
      console.error('Verification error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runVerification()
  }, [])
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Client ID: WF-2024-0892</span>
              <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-semibold rounded-full flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> IN PROGRESS
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold text-on-surface mb-2">Multi-Source Verification</h1>
            <p className="text-on-surface-variant max-w-2xl">
              Comprehensive risk assessment integrating ACRA registry data, global sanctions screening, and real-time sentiment analysis.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2 border border-outline/10">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button 
              onClick={runVerification}
              disabled={loading}
              className="px-4 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-ambient disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {loading ? 'Running...' : 'Re-run Checks'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - ACRA & News */}
        <div className="col-span-8 space-y-6">
          {/* ACRA Company Registry */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
                  <Building className="w-5 h-5 text-on-surface-variant" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-on-surface">ACRA Company Registry Check</h2>
                  <p className="text-xs text-on-surface-variant">Last updated: 2 hours ago</p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-success/10 text-success text-xs font-semibold rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> VERIFIED
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-1">Entity Name</p>
                <p className="text-sm font-medium text-on-surface">{acraData.entityName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-1">UEN</p>
                <p className="text-sm font-medium text-on-surface">{acraData.uen}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-1">Status</p>
                <p className="text-sm font-medium text-success">{acraData.status}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-1">Incorporated</p>
                <p className="text-sm font-medium text-on-surface">{acraData.incorporated}</p>
              </div>
            </div>
            
            <div className="bg-surface-container-low rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 h-4 text-tertiary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface mb-1">Standing Confirmation</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{acraData.confirmation}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* News Monitoring */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-on-surface">News Monitoring & Sentiment</h2>
              <button className="text-primary text-sm font-medium flex items-center gap-1 hover:underline">
                View All Articles <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {newsArticles.map((article, idx) => (
                <div key={idx} className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase ${
                      article.sentiment === 'positive' 
                        ? 'bg-tertiary/10 text-tertiary' 
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {article.sentiment} Sentiment
                    </span>
                    <span className="text-xs text-on-surface-variant">{article.source} • {article.time}</span>
                  </div>
                  
                  <h3 className="font-display text-base font-bold text-on-surface mb-2 line-clamp-2">{article.headline}</h3>
                  <p className="text-sm text-on-surface-variant mb-4 line-clamp-2">{article.summary}</p>
                  
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUpIcon className={`w-3 h-3 ${article.sentiment === 'positive' ? 'text-tertiary' : 'text-on-surface-variant'}`} />
                    <span className={article.sentiment === 'positive' ? 'text-tertiary' : 'text-on-surface-variant'}>{article.indicator}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - PEP & Risk Rating */}
        <div className="col-span-4 space-y-6">
          {/* PEP & Sanctions */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-error" />
              </div>
              <h2 className="font-display text-lg font-bold text-on-surface">PEP & Sanctions</h2>
            </div>
            
            <div className="bg-surface-container-low rounded-lg p-4 mb-4">
              <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2">Databases Scanned</p>
              <p className="font-display text-3xl font-bold text-on-surface">14+</p>
            </div>
            
            <div className="space-y-3">
              {pepSanctions.map((check, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  {check.status === 'cleared' ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-on-surface">{check.name}</p>
                    <p className={`text-xs mt-0.5 ${check.status === 'cleared' ? 'text-on-surface-variant' : 'text-error'}`}>
                      {check.count}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Overall Risk Rating */}
          <div className="rounded-xl gradient-primary p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-4">Overall Risk Rating</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-display text-5xl font-bold">Low</span>
                <span className="text-white/80">Risk</span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                Based on aggregated data from current verification sources. Pending manual review of 1 PEP partial match.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendingUpIcon({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 3L6.5 7.5L4 5L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 3H11V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
