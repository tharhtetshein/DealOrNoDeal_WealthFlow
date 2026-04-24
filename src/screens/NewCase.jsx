import { useEffect, useState } from 'react'
import { 
  User, 
  Briefcase, 
  Trash2,
  Save,
  ArrowRight,
  Zap,
  Globe,
  MapPin,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Building
} from 'lucide-react'
import { clearActiveCaseId, createDraftCase, getActiveCaseId, getCaseFileById, setActiveCaseId, updateCaseCore } from '../lib/caseFiles'

const emptyFormData = {
  clientName: '',
  nationality: '',
  residence: '',
  occupation: '',
  netWorth: '',
  purpose: '',
}

export default function NewCase({ onNext, setClientData, setSowData, onNavigate }) {
  const [formData, setFormData] = useState(emptyFormData)
  const [aiInsight, setAiInsight] = useState(null)
  const [netWorthError, setNetWorthError] = useState('')
  const [submissionMessage, setSubmissionMessage] = useState('')
  const [loadingCase, setLoadingCase] = useState(true)
  const minimumNetWorth = 3000000

  useEffect(() => {
    let isMounted = true

    const loadActiveCase = async () => {
      const activeCaseId = getActiveCaseId()
      if (!activeCaseId) {
        if (isMounted) {
          setFormData(emptyFormData)
          setLoadingCase(false)
        }
        return
      }

      const activeCase = await getCaseFileById(activeCaseId)
      if (!isMounted) return

      if (activeCase) {
        const netWorthDigits = String(activeCase.netWorth || '').replace(/[^\d]/g, '')
        setFormData({
          clientName: activeCase.clientName || '',
          nationality: activeCase.nationality || '',
          residence: activeCase.residence || '',
          occupation: activeCase.occupation || '',
          netWorth: netWorthDigits ? Number(netWorthDigits).toLocaleString('en-US') : '',
          purpose: activeCase.purpose || '',
        })
      } else {
        setFormData(emptyFormData)
      }

      setLoadingCase(false)
    }

    loadActiveCase()

    return () => {
      isMounted = false
    }
  }, [])

  const saveCaseDraft = async (nextFormData) => {
    const normalizedFormData = {
      ...nextFormData,
      netWorth: String(nextFormData.netWorth || '').replace(/,/g, ''),
      estimatedWealth: String(nextFormData.netWorth || '').replace(/,/g, ''),
    }

    const activeCaseId = getActiveCaseId()
    const activeCase = activeCaseId ? await getCaseFileById(activeCaseId) : null

    let caseFile
    if (activeCase) {
      caseFile = await updateCaseCore(activeCase.id, normalizedFormData)
    } else {
      caseFile = await createDraftCase(normalizedFormData)
    }

    if (caseFile?.id) {
      setActiveCaseId(caseFile.id)
    }

    return caseFile
  }

  const handleInputChange = (field, value) => {
    if (field === 'netWorth') {
      const digitsOnly = value.replace(/[^\d]/g, '')
      const formattedValue = digitsOnly ? Number(digitsOnly).toLocaleString('en-US') : ''
      if (digitsOnly && Number(digitsOnly) < minimumNetWorth) {
        setNetWorthError('Minimum net worth is 3,000,000.')
      } else {
        setNetWorthError('')
      }
      setFormData((prev) => {
        return { ...prev, [field]: formattedValue }
      })
      return
    }

    setFormData((prev) => {
      return { ...prev, [field]: value }
    })
  }

  const handleSaveForLater = async () => {
    await saveCaseDraft(formData)
    setSubmissionMessage('Draft saved. You can continue later from Case Files.')
    onNavigate?.('cases')
  }

  const handleDiscard = () => {
    setFormData(emptyFormData)
    setAiInsight(null)
    setNetWorthError('')
    setSubmissionMessage('')
    clearActiveCaseId()
  }

  const handleSubmit = async () => {
    const netWorthValue = Number(formData.netWorth.replace(/,/g, '') || 0)
    if (netWorthValue < minimumNetWorth) {
      setNetWorthError('Minimum net worth is 3,000,000.')
      return
    }

    const normalizedFormData = {
      ...formData,
      netWorth: formData.netWorth.replace(/,/g, ''),
      estimatedWealth: formData.netWorth.replace(/,/g, ''),
    }

    const caseFile = await saveCaseDraft(normalizedFormData)

    if (caseFile?.id) {
      setActiveCaseId(caseFile.id)
    }

    setClientData(normalizedFormData)
    setSowData(null)
    setAiInsight(null)
    setSubmissionMessage('Case created as Draft. Upload documents in Documents to continue.')
    onNavigate?.('cases')
  }

  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <h1 className="font-display text-4xl font-bold text-on-surface mb-2">Initiate New Case</h1>
        <p className="text-on-surface-variant">Onboarding comprehensive due diligence for high-net-worth entity.</p>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-8">
        {/* Left Column - Forms */}
        <div className="col-span-8 space-y-6">
          {/* Client Identity Section */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-lg font-bold text-on-surface">Client Identity</h2>
            </div>
            
            <div className="space-y-5">
              {/* Full Legal Name */}
              <div>
                <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => handleInputChange('clientName', e.target.value)}
                  placeholder="e.g. Alexander Sterling"
                  disabled={loadingCase}
                  className="w-full px-4 py-3 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30 transition-all"
                />
              </div>
              
              {/* Nationality & Residence */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
                    Nationality
                  </label>
                  <div className="relative">
                    <select 
                      value={formData.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                      disabled={loadingCase}
                      className="w-full px-4 py-3 bg-surface-container rounded-lg text-sm text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30 transition-all">
                      <option value="">Select Country</option>
                      <option value="Switzerland">Switzerland</option>
                      <option value="Singapore">Singapore</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                    </select>
                    <Globe className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
                    Primary Residence
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={formData.residence}
                      onChange={(e) => handleInputChange('residence', e.target.value)}
                      placeholder="e.g. Zurich, Switzerland"
                      disabled={loadingCase}
                      className="w-full pl-11 pr-4 py-3 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Economic Profile Section */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-tertiary" />
              </div>
              <h2 className="font-display text-lg font-bold text-on-surface">Economic Profile</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-5 mb-5">
              {/* Principal Occupation */}
              <div>
                <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
                  Principal Occupation
                </label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                  placeholder="e.g. Tech Executive / Founder"
                  disabled={loadingCase}
                  className="w-full px-4 py-3 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30 transition-all"
                />
              </div>
              
              {/* Estimated Net Worth */}
              <div>
                <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
                  Estimated Net Worth
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={formData.netWorth}
                    onChange={(e) => handleInputChange('netWorth', e.target.value)}
                    placeholder="0.00"
                    disabled={loadingCase}
                    className={`w-full pl-11 pr-4 py-3 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 border transition-all ${
                      netWorthError ? 'border-error/50 focus:border-error/50' : 'border-transparent focus:border-primary/30'
                    }`}
                  />
                </div>
                  {netWorthError && <p className="mt-2 text-xs text-error">{netWorthError}</p>}
              </div>
            </div>
            
            {/* Primary Purpose */}
            <div>
              <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">
                Primary Purpose of Account
              </label>
              <textarea
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                placeholder="Describe the intended use for this private vault..."
                rows={4}
                disabled={loadingCase}
                className="w-full px-4 py-3 bg-surface-container rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30 transition-all resize-none"
              />
            </div>

            {submissionMessage && (
              <p className="mt-4 text-xs text-tertiary">{submissionMessage}</p>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              onClick={handleDiscard}
              disabled={loadingCase}
              className="px-5 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Discard Draft
            </button>
            <button
              onClick={handleSaveForLater}
              disabled={loadingCase}
              className="px-5 py-3 rounded-lg bg-surface-container text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save for Later
            </button>
            <button 
              onClick={handleSubmit}
              disabled={loadingCase || !formData.clientName || !!netWorthError}
              className="px-6 py-3 rounded-lg gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-ambient disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <>
                Create Case Draft
                <ArrowRight className="w-4 h-4" />
              </>
            </button>
          </div>
        </div>

        {/* Right Column - Copilot Insight */}
        <div className="col-span-4 space-y-6">
          {/* Copilot Insight Card */}
          <div className="rounded-xl gradient-primary p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" />
                <span className="text-[10px] font-semibold tracking-wider uppercase">Copilot Insight</span>
              </div>
              
              <div className="mb-4">
                <span className="text-[10px] font-semibold text-white/70 tracking-wider uppercase">Risk Projection</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-500"
                      style={{ width: aiInsight ? (aiInsight.risk === 'Low' ? '15%' : aiInsight.risk === 'Medium' ? '50%' : '85%') : '15%' }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{aiInsight?.risk || 'Low'}</span>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4 mb-4">
                <p className="text-sm text-white/90 leading-relaxed italic">
                  {aiInsight ? (
                    aiInsight.flags.length > 0 
                      ? `Identified ${aiInsight.flags.length} potential risk flag(s). Review recommended before proceeding.`
                      : "Profile aligns with standard compliance protocols. No significant risk indicators detected."
                  ) : (
                    "Based on the occupation and residence provided, this profile aligns with our Ultra-High tier protocols. Submit to get AI-powered risk assessment."
                  )}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-white/80" />
                  <span className="text-white/80">PEP Screening: {aiInsight ? (aiInsight.flags.some(f => f.title?.toLowerCase().includes('pep')) ? 'Flagged' : 'Cleared') : 'Pending'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-white/80" />
                  <span className="text-white/80">Adverse Media: {aiInsight ? (aiInsight.flags.some(f => f.title?.toLowerCase().includes('media')) ? 'Review' : 'No matches') : 'Pending'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className={`w-4 h-4 ${aiInsight && aiInsight.flags.length > 0 ? 'text-warning' : 'text-white/80'}`} />
                  <span className="text-white/80">
                    {aiInsight ? (aiInsight.flags.length > 0 ? `${aiInsight.flags.length} item(s) need attention` : 'All checks passed') : 'Missing: Document verification'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Vault Security Standards */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="w-full h-32 rounded-lg overflow-hidden mb-4 relative">
              <img 
                src="https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=400&h=200&fit=crop" 
                alt="Vault Security"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
            <h3 className="font-display text-sm font-bold text-on-surface mb-2">Vault Security Standards</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Ensure all residence documents are no more than 3 months old to meet Swiss Tier 1 banking requirements.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
