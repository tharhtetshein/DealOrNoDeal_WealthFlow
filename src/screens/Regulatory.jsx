import { useState, useEffect } from 'react'
import { 
  Download, 
  ChevronRight, 
  TrendingUp,
  AlertTriangle,
  Scale,
  Globe,
  ArrowUpRight,
  FileText,
  BarChart3,
  Filter,
  Loader2
} from 'lucide-react'
import { getRegulatoryUpdates, checkComplianceStatus } from '../lib/api'

const complianceMetrics = [
  { label: 'MAS Notice 626 (AML/CFT)', score: 92 },
  { label: 'FATF Travel Rule Compliance', score: 78 },
]

const typologies = [
  { name: 'Sudden Wealth Influx', description: 'Detecting rapid capital consolidation from...', risk: 'HIGH RISK', cases: '3 CASES' },
  { name: 'PEP Proxy Control', description: 'Identified overlapping directorships with...', risk: 'ELEVATED', cases: '1 CASE' },
]

const regulatoryUpdates = [
  {
    date: 'TODAY',
    tag: 'MAS GUIDANCE',
    tagColor: 'bg-primary/10 text-primary',
    time: '10:45 AM SGT',
    title: 'Revised Guidelines on Digital Asset Custody',
    summary: 'Monetary Authority of Singapore issued updated requirements for segregation of client assets and mandatory risk disclosures for digital payment token service providers.',
    actions: ['Read Briefing', 'Impact Analysis']
  },
  {
    date: 'OCT 24',
    tag: 'FATF ADVISORY',
    tagColor: 'bg-surface-container-high text-on-surface-variant',
    location: 'Paris, FR',
    title: 'Targeted Financial Sanctions Update',
    summary: 'Additions to the consolidated list of persons, groups and entities subject to financial sanctions regarding ongoing geopolitical developments.',
    actions: ['Update Screening Parameters']
  },
]

export default function Regulatory({ clientData }) {
  const [regulatoryData, setRegulatoryData] = useState(null)
  const [complianceData, setComplianceData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadRegulatoryData()
  }, [])

  const loadRegulatoryData = async () => {
    setLoading(true)
    try {
      const [updatesResult, complianceResult] = await Promise.all([
        getRegulatoryUpdates(),
        checkComplianceStatus(clientData || {}, {})
      ])
      setRegulatoryData(updatesResult.updates)
      setComplianceData(complianceResult.compliance)
    } catch (error) {
      console.error('Regulatory data error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold text-on-surface mb-2">Regulatory Intelligence</h1>
            <p className="text-on-surface-variant">Real-time surveillance & typology matching.</p>
          </div>
          
          <button className="px-4 py-2.5 bg-surface-container-lowest rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2 border border-outline/10">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - Compliance Posture */}
        <div className="col-span-8 space-y-6">
          {/* Portfolio Compliance Posture */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-lg font-bold text-on-surface">Portfolio Compliance Posture</h2>
                <p className="text-sm text-on-surface-variant">Aggregate alignment against active MAS & FATF guidelines.</p>
              </div>
              <span className="px-3 py-1.5 bg-tertiary/10 text-tertiary text-xs font-semibold rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Stable
              </span>
            </div>
            
            <div className="flex items-center gap-8">
              {/* Big Score */}
              <div className="text-center">
                <div className="font-display text-7xl font-bold text-primary mb-2">85<span className="text-4xl">%</span></div>
                <p className="text-sm text-on-surface-variant">Global Alignment Score</p>
              </div>
              
              {/* Metrics */}
              <div className="flex-1 space-y-4">
                {complianceMetrics.map((metric, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-on-surface">{metric.label}</span>
                      <span className="text-sm font-bold text-on-surface">{metric.score}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${idx === 0 ? 'bg-primary' : 'bg-tertiary'}`}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Regulatory Updates Feed */}
          <div className="bg-surface-container-low rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-on-surface">Regulatory Updates Feed</h2>
              <div className="flex items-center gap-4">
                <button className="text-sm font-medium text-primary border-b-2 border-primary pb-1">Global Updates</button>
                <button className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Internal Policy</button>
              </div>
            </div>
            
            <div className="space-y-6">
              {regulatoryUpdates.map((update, idx) => (
                <div key={idx} className="relative pl-24">
                  {/* Date Column */}
                  <div className="absolute left-0 top-0 w-16 text-right">
                    <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider">{update.date}</p>
                    {idx !== regulatoryUpdates.length - 1 && (
                      <div className="absolute right-0 top-6 w-px h-full bg-outline/20" />
                    )}
                  </div>
                  
                  {/* Content Card */}
                  <div className="bg-surface-container-lowest rounded-lg p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold ${update.tagColor}`}>
                        {update.tag}
                      </span>
                      <span className="text-xs text-on-surface-variant">{update.time || update.location}</span>
                    </div>
                    
                    <h3 className="font-display text-base font-bold text-on-surface mb-2">{update.title}</h3>
                    <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">{update.summary}</p>
                    
                    <div className="flex items-center gap-4">
                      {update.actions.map((action, aidx) => (
                        <button 
                          key={aidx}
                          className={`text-sm font-medium flex items-center gap-1 ${action.includes('Impact') ? 'text-tertiary' : 'text-primary'} hover:underline`}
                        >
                          {action}
                          {action.includes('Impact') && <BarChart3 className="w-4 h-4" />}
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Active Typologies */}
        <div className="col-span-4">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-on-surface">Active Typologies</h2>
              <button className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                <Filter className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            
            <div className="space-y-4">
              {typologies.map((typology, idx) => (
                <div key={idx} className="bg-surface-container-low rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      typology.risk === 'HIGH RISK' ? 'bg-error/10' : 'bg-surface-container-high'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${typology.risk === 'HIGH RISK' ? 'text-error' : 'text-on-surface-variant'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-on-surface">{typology.name}</p>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{typology.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      typology.risk === 'HIGH RISK' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
                    }`}>
                      {typology.risk}
                    </span>
                    <span className="px-2 py-0.5 bg-surface-container-high rounded text-[10px] font-semibold text-on-surface-variant">
                      {typology.cases}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-4 text-primary text-sm font-medium flex items-center justify-center gap-1 hover:underline">
              View Alert Matrix <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
