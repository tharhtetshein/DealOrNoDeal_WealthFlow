import { useState } from 'react'
import { 
  Sparkles, 
  ChevronRight, 
  Copy, 
  Send,
  Edit3,
  ArrowRightLeft,
  Building,
  FileText,
  CheckCircle2,
  AlertCircle,
  Mail,
  Clock,
  Zap,
  Loader2
} from 'lucide-react'
import { generateFollowUpEmail } from '../lib/api'

export default function FollowUp({ clientData, missingDocs }) {
  const [emailContent, setEmailContent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateEmail = async () => {
    setLoading(true)
    try {
      const result = await generateFollowUpEmail(
        clientData || { clientName: 'Alexander von Rothschild' },
        missingDocs || [{ id: 'payslip', name: 'Standard Payslip', reason: 'Proof of liquidity' }],
        'professional'
      )
      setEmailContent(result.email)
    } catch (error) {
      console.error('Email generation error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (emailContent?.content) {
      navigator.clipboard.writeText(emailContent.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSend = () => {
    // Open mailto link with the generated email
    if (emailContent) {
      const subject = encodeURIComponent(emailContent.subject)
      const body = encodeURIComponent(emailContent.content)
      window.open(`mailto:a.rothschild@example.com?subject=${subject}&body=${body}`)
    }
  }
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary/10 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-tertiary" />
            <span className="text-xs font-semibold text-tertiary">Smart Intelligence Active</span>
          </div>
        </div>
        <h1 className="font-display text-4xl font-bold text-on-surface mb-2">Follow-up Automation</h1>
        <p className="text-on-surface-variant max-w-2xl">
          Review and dispatch personalized requisition correspondence based on current regulatory shortfalls and accepted strategic alternatives.
        </p>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - Email Draft */}
        <div className="col-span-8">
          <div className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden">
            {/* Email Header */}
            <div className="p-6 border-b border-outline/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-on-surface">
                    {emailContent ? 'Requisition Draft' : 'Generate Follow-up'}
                  </h2>
                  <span className="text-sm text-on-surface-variant">
                    {emailContent ? 'Generated for Case File #CR-8824 • ' + new Date(emailContent.generatedAt).toLocaleString() : 'AI will draft personalized correspondence'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!emailContent && (
                    <button
                      onClick={generateEmail}
                      disabled={loading}
                      className="px-4 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-4 h-4" /> Generate with AI</>
                      )}
                    </button>
                  )}
                  {emailContent && (
                    <>
                      <span className="px-2 py-1 bg-surface-container rounded text-xs text-on-surface-variant">AI</span>
                      <span className="px-2 py-1 bg-surface-container rounded text-xs text-on-surface-variant">You</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Email Meta */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-on-surface-variant w-12">To:</span>
                  <div className="flex-1 bg-surface-container-low rounded-lg px-4 py-2">
                    <span className="text-sm text-on-surface font-medium">Alexander von Rothschild</span>
                    <span className="text-sm text-on-surface-variant ml-2">&lt;a.rothschild@example.com&gt;</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-on-surface-variant w-12">Subject:</span>
                  <div className="flex-1">
                    <span className="text-sm text-on-surface font-medium">
                      {emailContent?.subject || 'Click "Generate with AI" to create email'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Email Body */}
            <div className="p-8">
              <div className="prose prose-sm max-w-none">
                {emailContent ? (
                  <div className="whitespace-pre-wrap text-on-surface-variant leading-relaxed">
                    {emailContent.content}
                  </div>
                ) : (
                  <div className="text-center py-12 text-on-surface-variant">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary/30" />
                    <p className="text-lg font-medium mb-2">No email generated yet</p>
                    <p className="text-sm">Click "Generate with AI" to create a personalized follow-up email based on missing documents and client profile.</p>
                    {emailContent?.suggestions && (
                      <div className="mt-6 p-4 bg-surface-container-low rounded-lg text-left">
                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Alternative Documents Suggested:</p>
                        {emailContent.suggestions.map((s, i) => (
                          <div key={i} className="text-sm text-on-surface mb-1">
                            • {s.docName}: {s.alternatives.slice(0, 2).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="px-6 py-4 bg-surface-container-low border-t border-outline/10 flex items-center justify-between">
              <button className="flex items-center gap-2 text-primary text-sm font-medium hover:underline">
                <Edit3 className="w-4 h-4" />
                Edit Draft
              </button>
              <div className="flex items-center gap-3">
                {emailContent && (
                  <>
                    <button 
                      onClick={handleCopy}
                      className="px-5 py-2.5 bg-surface-container rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                    <button 
                      onClick={handleSend}
                      className="px-6 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-ambient"
                    >
                      <Send className="w-4 h-4" />
                      Send via Outlook
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Client Info & Strategic Alternatives */}
        <div className="col-span-4 space-y-6">
          {/* Client Profile */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center">
                <span className="font-display text-xl font-bold text-on-surface-variant">AR</span>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-on-surface">Alexander von Rothschild</h3>
                <p className="text-sm text-on-surface-variant">Tier 1 • European Equities</p>
              </div>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-outline/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Account Status</span>
                <span className="px-2 py-1 bg-error/10 text-error text-xs font-semibold rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Restricted
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Last Contact</span>
                <span className="text-sm font-medium text-on-surface">14 Days Ago</span>
              </div>
            </div>
          </div>
          
          {/* Strategic Alternatives */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center gap-2 mb-6">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-bold text-on-surface">Strategic Alternatives</h2>
            </div>
            
            {/* Primary Requirement */}
            <div className="mb-6">
              <p className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-3">Primary Requirement (Missing)</p>
              <div className="bg-surface-container-low rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
                    <FileText className="w-5 h-5 text-on-surface-variant" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-on-surface">Standard Payslip</p>
                    <p className="text-xs text-on-surface-variant mt-1">Not suitable for current asset structure.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Approved Substitute */}
            <div>
              <p className="text-[10px] font-semibold text-primary tracking-wider uppercase mb-3 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Approved Substitute
              </p>
              <div className="bg-tertiary/5 border border-tertiary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center">
                    <Building className="w-5 h-5 text-tertiary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface">Bank Reference Letter</p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Must specify account standing over the preceding 24 months.
                    </p>
                    <p className="text-xs text-success mt-2">
                      Instantly satisfies liquidity check.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
