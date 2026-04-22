import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { FileText, Sparkles, ArrowLeft, ArrowRight, Edit3, CheckCircle, Loader2 } from 'lucide-react'
import { analyzeDocuments } from '../lib/api'

export default function SoWDraft({ onNext, onBack, clientData, documents, sowData, setSowData }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(sowData || null)
  const [isLoading, setIsLoading] = useState(!sowData)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sowData && clientData) {
      generateAIDraft()
    }
  }, [clientData, documents])

  const generateAIDraft = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await analyzeDocuments(clientData, documents)
      setDraft(result.sowData)
      setSowData(result.sowData)
    } catch (err) {
      console.error('Error generating AI draft:', err)
      setError('Failed to generate AI draft. Using fallback data.')
      setDraft(generateMockDraft(clientData, documents))
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(!isEditing)
  }

  const handleSubmit = () => {
    setSowData(draft)
    onNext()
  }

  const handleChange = (field, value) => {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SoW Copilot</h1>
          <p className="text-gray-600">Private Banking Onboarding Assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              AI-Generated Source of Wealth Draft
            </CardTitle>
            <CardDescription>
              Review and edit the generated Source of Wealth summary before compliance review
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <p className="text-gray-600">AI is analyzing documents and generating Source of Wealth draft...</p>
                <p className="text-sm text-gray-500">This may take 30-60 seconds</p>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">{error}</p>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Generated based on uploaded documents and client information</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleEdit} className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    {isEditing ? 'Save Changes' : 'Edit Draft'}
                  </Button>
                </div>

              <div className="bg-white border rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Client Overview</h3>
                  {isEditing ? (
                    <textarea
                      value={draft.clientOverview}
                      onChange={(e) => handleChange('clientOverview', e.target.value)}
                      className="w-full p-3 border rounded-md text-sm min-h-[100px]"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">{draft.clientOverview}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Primary Source of Wealth</h3>
                  {isEditing ? (
                    <textarea
                      value={draft.primarySource}
                      onChange={(e) => handleChange('primarySource', e.target.value)}
                      className="w-full p-3 border rounded-md text-sm min-h-[100px]"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">{draft.primarySource}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Wealth Accumulation Timeline</h3>
                  {isEditing ? (
                    <textarea
                      value={draft.timeline}
                      onChange={(e) => handleChange('timeline', e.target.value)}
                      className="w-full p-3 border rounded-md text-sm min-h-[100px]"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">{draft.timeline}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Key Supporting Documents</h3>
                  {isEditing ? (
                    <textarea
                      value={draft.supportingDocs}
                      onChange={(e) => handleChange('supportingDocs', e.target.value)}
                      className="w-full p-3 border rounded-md text-sm min-h-[100px]"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">{draft.supportingDocs}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Risk Assessment Summary</h3>
                  {isEditing ? (
                    <textarea
                      value={draft.riskSummary}
                      onChange={(e) => handleChange('riskSummary', e.target.value)}
                      className="w-full p-3 border rounded-md text-sm min-h-[100px]"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">{draft.riskSummary}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Recommendations</h3>
                  {isEditing ? (
                    <textarea
                      value={draft.recommendations}
                      onChange={(e) => handleChange('recommendations', e.target.value)}
                      className="w-full p-3 border rounded-md text-sm min-h-[100px]"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">{draft.recommendations}</p>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This draft is generated by AI based on the uploaded documents. Please review carefully and make any necessary edits before proceeding to compliance review.
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button onClick={handleSubmit} className="flex items-center gap-2">
                  Review Risk Flags
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function generateMockDraft(clientData, documents) {
  const sourceDescriptions = {
    employment: 'employment income and professional services',
    business: 'business ownership and entrepreneurial activities',
    inheritance: 'inheritance and family wealth transfer',
    investments: 'investment returns and portfolio management',
    real_estate: 'real estate investments and property development',
    other: 'various sources including the above'
  }

  const clientName = clientData?.clientName || 'Client'
  const nationality = clientData?.nationality || 'national'
  const clientType = clientData?.clientType || 'individual'
  const estimatedWealth = clientData?.estimatedWealth || 'not specified'
  const occupation = clientData?.occupation || 'not specified'
  const primarySource = sourceDescriptions[clientData?.primarySource] || 'various sources'
  const riskProfile = clientData?.riskProfile || 'medium'
  const docCount = Object.keys(documents || {}).length

  return {
    clientOverview: clientName + ' is a ' + nationality + ' ' + clientType + ' with an estimated net worth of SGD ' + estimatedWealth + '. The client\'s occupation is listed as ' + occupation + '. Based on the provided documentation, the client has demonstrated consistent wealth accumulation over the past several years.',
    primarySource: 'The primary source of wealth for the client appears to be ' + primarySource + '. Analysis of the uploaded documents indicates a legitimate and verifiable source of funds, with clear documentation supporting the wealth accumulation pattern.',
    timeline: 'Wealth accumulation has been gradual and consistent over the past 5-10 years, with significant growth observed in the past 3 years. The timeline aligns with the client\'s stated occupation and business activities, providing a coherent narrative of wealth development.',
    supportingDocs: 'Key documents reviewed include: passport/ID verification, recent payslips, tax returns, bank statements, and ' + docCount + ' additional supporting documents. These documents provide a comprehensive view of the client\'s financial position and source of wealth.',
    riskSummary: 'Based on the provided information and documents, the client presents a ' + riskProfile + ' risk profile. The source of wealth appears legitimate and well-documented. No immediate red flags or inconsistencies were identified in the initial review.',
    recommendations: 'Proceed with standard due diligence procedures. Recommend enhanced monitoring for the first 12 months given the client profile. Consider periodic review of source of wealth documentation as part of ongoing KYC obligations.'
  }
}
