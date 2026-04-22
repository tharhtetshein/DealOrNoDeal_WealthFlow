import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { AlertTriangle, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, FileText, Loader2, Shield, Mail, BookOpen, ExternalLink, Copy, Building, Globe, Newspaper } from 'lucide-react'
import { detectRisks, checkMissingDocs, verifyEntity, generateFollowUpEmail, getRegulatoryUpdates, checkComplianceStatus } from '../lib/api'

export default function RiskFlags({ onNext, onBack, clientData, documents }) {
  const [missingDocs, setMissingDocs] = useState([])
  const [riskFlags, setRiskFlags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  // New feature states
  const [verificationData, setVerificationData] = useState(null)
  const [emailData, setEmailData] = useState(null)
  const [regulatoryData, setRegulatoryData] = useState(null)
  const [complianceStatus, setComplianceStatus] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)

  useEffect(() => {
    loadRiskData()
    loadNewFeatures()
  }, [clientData, documents])

  const loadRiskData = async () => {
    setIsLoading(true)
    try {
      const [missingResult, riskResult] = await Promise.all([
        checkMissingDocs(documents),
        detectRisks(clientData, documents)
      ])
      setMissingDocs(missingResult.missingDocs)
      setRiskFlags(riskResult.riskFlags)
    } catch (error) {
      console.error('Error loading risk data:', error)
      setMissingDocs(generateMissingDocs(documents))
      setRiskFlags(generateRiskFlags(clientData, documents))
    } finally {
      setIsLoading(false)
    }
  }

  const loadNewFeatures = async () => {
    try {
      const [verifyResult, regResult, complianceResult] = await Promise.all([
        verifyEntity(clientData, documents),
        getRegulatoryUpdates(),
        checkComplianceStatus(clientData, documents)
      ])
      setVerificationData(verifyResult.verification)
      setRegulatoryData(regResult.updates)
      setComplianceStatus(complianceResult.compliance)
    } catch (error) {
      console.error('Error loading new features:', error)
    }
  }

  const handleGenerateEmail = async () => {
    if (missingDocs.length === 0) return
    setIsGeneratingEmail(true)
    try {
      const result = await generateFollowUpEmail(clientData, missingDocs, 'professional')
      setEmailData(result.email)
    } catch (error) {
      console.error('Error generating email:', error)
    } finally {
      setIsGeneratingEmail(false)
    }
  }

  const copyEmailToClipboard = () => {
    if (emailData?.content) {
      navigator.clipboard.writeText(emailData.content)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    }
  }

  const overallStatus = determineStatus(missingDocs, riskFlags)
  const needsReReview = complianceStatus?.needsReReview

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SoW Copilot</h1>
          <p className="text-gray-600">Private Banking Onboarding Assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              Risk Flags & Missing Documents
            </CardTitle>
            <CardDescription>
              Review identified risks, verification results, and compliance status before submission
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <p className="text-gray-600">AI is analyzing documents and detecting risk flags...</p>
                <p className="text-sm text-gray-500">This may take 30-60 seconds</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className={`p-4 rounded-lg border ${getStatusColor(overallStatus)} ${needsReReview ? 'ring-2 ring-purple-500' : ''}`}>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(overallStatus)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">Case Status: {overallStatus}</h3>
                      <p className="text-sm opacity-80">{getStatusDescription(overallStatus)}</p>
                      {needsReReview && (
                        <p className="text-sm mt-1 font-medium text-purple-700">
                          ⚠️ Regulatory update requires re-review: {complianceStatus?.reReviewReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-gray-200 pb-2">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      activeTab === 'overview' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('verification')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                      activeTab === 'verification' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Verification
                    {verificationData?.overallRisk === 'high' && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                  </button>
                  <button
                    onClick={() => setActiveTab('followup')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                      activeTab === 'followup' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Smart Follow-up
                  </button>
                  <button
                    onClick={() => setActiveTab('regulatory')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                      activeTab === 'regulatory' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Regulatory
                    {regulatoryData?.some(u => u.impactLevel === 'high') && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Missing Documents ({missingDocs.length})
                        </h3>
                        <div className="space-y-3">
                          {missingDocs.length === 0 ? (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="text-green-800">All required documents uploaded</span>
                            </div>
                          ) : (
                            missingDocs.map((doc) => (
                              <div key={doc.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="font-medium text-amber-900">{doc.name}</p>
                                <p className="text-sm text-amber-700">{doc.reason}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          Risk Flags ({riskFlags.length})
                        </h3>
                        <div className="space-y-3">
                          {riskFlags.length === 0 ? (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="text-green-800">No risk flags identified</span>
                            </div>
                          ) : (
                            riskFlags.map((flag) => (
                              <div key={flag.id} className={`p-3 border rounded-lg ${flag.severity === 'high' ? 'bg-red-50 border-red-200' : flag.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                                <div className="flex items-start gap-2">
                                  {flag.severity === 'high' ? (
                                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                                  )}
                                  <div>
                                    <p className={`font-medium ${flag.severity === 'high' ? 'text-red-900' : 'text-amber-900'}`}>{flag.title}</p>
                                    <p className={`text-sm ${flag.severity === 'high' ? 'text-red-700' : 'text-amber-700'}`}>{flag.description}</p>
                                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-white border capitalize">{flag.severity} Severity</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">Recommendations</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {missingDocs.length > 0 && <li>• Request missing documents from client before proceeding</li>}
                        {riskFlags.filter(f => f.severity === 'high').length > 0 && <li>• Escalate high-severity flags to senior compliance officer</li>}
                        {riskFlags.filter(f => f.severity === 'medium').length > 0 && <li>• Conduct additional due diligence for medium-severity flags</li>}
                        {verificationData?.pepSanctions?.length > 0 && <li>• Review PEP/Sanctions screening results immediately</li>}
                        {complianceStatus?.typologyMatches?.length > 0 && <li>• Enhanced due diligence required - typology match detected</li>}
                        {missingDocs.length === 0 && riskFlags.length === 0 && <li>• Case is ready for compliance review</li>}
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'verification' && verificationData && (
                  <div className="space-y-6">
                    {/* ACRA Verification */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <Building className="w-5 h-5 text-blue-600" />
                        ACRA Company Registry Check
                      </h4>
                      {verificationData.acra?.length > 0 ? (
                        <div className="space-y-2">
                          {verificationData.acra.map((result, idx) => (
                            <div key={idx} className={`p-3 rounded-lg ${result.verified ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{result.entityName}</p>
                                  <p className="text-sm text-gray-600">UEN: {result.uen} | Status: {result.status}</p>
                                  <p className="text-sm text-gray-600">Directors: {result.directors.join(', ')}</p>
                                </div>
                                {result.riskFlag && (
                                  <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">{result.riskFlag}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No company matches found in ACRA database.</p>
                      )}
                    </div>

                    {/* PEP & Sanctions */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-amber-600" />
                        PEP & Sanctions Screening
                      </h4>
                      {verificationData.pepSanctions?.length > 0 ? (
                        <div className="space-y-2">
                          {verificationData.pepSanctions.map((result, idx) => (
                            <div key={idx} className={`p-3 rounded-lg ${result.type === 'Sanctions' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className={`font-medium ${result.type === 'Sanctions' ? 'text-red-900' : 'text-amber-900'}`}>
                                    {result.type}: {result.name}
                                  </p>
                                  {result.type === 'PEP' && (
                                    <p className="text-sm text-gray-600">{result.position} ({result.level} level)</p>
                                  )}
                                  {result.type === 'Sanctions' && (
                                    <p className="text-sm text-gray-600">List: {result.list} | {result.reason}</p>
                                  )}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${result.type === 'Sanctions' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {result.alert}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No PEP or sanctions matches found.</p>
                      )}
                    </div>

                    {/* News Monitoring */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <Newspaper className="w-5 h-5 text-purple-600" />
                        News Monitoring
                      </h4>
                      {verificationData.news?.length > 0 ? (
                        <div className="space-y-2">
                          {verificationData.news.map((result, idx) => (
                            <div key={idx} className={`p-3 rounded-lg border ${result.sentiment === 'negative' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                              <p className="font-medium text-sm">{result.headline}</p>
                              <p className="text-xs text-gray-600">{result.source} | {result.date}</p>
                              {result.riskFlag && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded mt-1 inline-block">{result.riskFlag}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No news mentions found for this client.</p>
                      )}
                    </div>

                    {/* Overall Risk */}
                    <div className={`p-4 rounded-lg ${verificationData.overallRisk === 'high' ? 'bg-red-50 border border-red-200' : verificationData.overallRisk === 'medium' ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                      <p className="font-semibold">
                        Overall Verification Risk: <span className="capitalize">{verificationData.overallRisk}</span>
                      </p>
                      <p className="text-sm text-gray-600">Last verified: {new Date(verificationData.lastVerified).toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'followup' && (
                  <div className="space-y-6">
                    {missingDocs.length === 0 ? (
                      <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                        <h4 className="font-semibold text-green-900">No Missing Documents</h4>
                        <p className="text-green-700">All required documents have been uploaded. No follow-up needed.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">AI-Powered Follow-up Email</h4>
                            <p className="text-sm text-gray-600">Generate a personalized email requesting missing documents</p>
                          </div>
                          <Button 
                            onClick={handleGenerateEmail} 
                            disabled={isGeneratingEmail}
                            className="flex items-center gap-2"
                          >
                            {isGeneratingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            {isGeneratingEmail ? 'Generating...' : 'Generate Email'}
                          </Button>
                        </div>

                        {emailData && (
                          <div className="space-y-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Subject: {emailData.subject}</p>
                                  <p className="text-xs text-gray-500">Generated at: {new Date(emailData.generatedAt).toLocaleString()}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={copyEmailToClipboard} className="flex items-center gap-2">
                                  {emailCopied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                  {emailCopied ? 'Copied!' : 'Copy'}
                                </Button>
                              </div>
                              <div className="bg-white border border-gray-200 rounded p-3 whitespace-pre-wrap text-sm">
                                {emailData.content}
                              </div>
                            </div>

                            {/* Alternative Documents */}
                            <div className="border rounded-lg p-4">
                              <h5 className="font-medium mb-3">Alternative Document Suggestions</h5>
                              <div className="space-y-2">
                                {emailData.suggestions?.map((suggestion, idx) => (
                                  <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                                    <p className="font-medium text-sm">{suggestion.docName}</p>
                                    <p className="text-xs text-gray-600 mb-1">{suggestion.rationale}</p>
                                    {suggestion.alternatives.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {suggestion.alternatives.map((alt, altIdx) => (
                                          <span key={altIdx} className="text-xs px-2 py-0.5 bg-white border rounded">{alt}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'regulatory' && (
                  <div className="space-y-6">
                    {/* Compliance Status */}
                    {complianceStatus && (
                      <div className={`p-4 rounded-lg border ${complianceStatus.overallComplianceStatus === 'compliant' ? 'bg-green-50 border-green-200' : complianceStatus.overallComplianceStatus === 'enhanced_due_diligence' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <Shield className="w-5 h-5" />
                          Compliance Status: {complianceStatus.overallComplianceStatus.replace(/_/g, ' ').toUpperCase()}
                        </h4>
                        {complianceStatus.typologyMatches?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Typology Matches:</p>
                            <div className="space-y-2">
                              {complianceStatus.typologyMatches.map((match, idx) => (
                                <div key={idx} className="p-2 bg-white rounded border">
                                  <p className="font-medium text-sm">{match.typology} ({match.riskLevel} risk)</p>
                                  <p className="text-xs text-gray-600">{match.description}</p>
                                  <p className="text-xs text-gray-500">Matched indicators: {match.matchedIndicators.join(', ')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Regulatory Updates */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        Recent Regulatory Updates (MAS)
                      </h4>
                      <div className="space-y-3">
                        {regulatoryData?.map((update) => (
                          <div key={update.id} className={`p-3 rounded-lg border ${update.impactLevel === 'high' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{update.title}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded ${update.impactLevel === 'high' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {update.impactLevel} impact
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">{update.summary}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Effective: {update.effectiveDate} | Action: {update.actionRequired}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4 border-t border-gray-200">
                  <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button onClick={onNext} className="flex items-center gap-2">
                    Proceed to Compliance Review
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

function generateMissingDocs(documents) {
  const requiredDocs = [
    { id: 'passport', name: 'Passport / ID Document' },
    { id: 'payslip', name: 'Recent Payslips (3 months)' },
    { id: 'tax_return', name: 'Tax Returns (2 years)' },
    { id: 'bank_statement', name: 'Bank Statements (6 months)' },
    { id: 'reference_letter', name: 'Bank Reference Letter' },
    { id: 'cv_resume', name: 'CV / Resume' },
  ]

  return requiredDocs
    .filter(doc => !documents || !documents[doc.id])
    .map(doc => ({
      ...doc,
      reason: 'Required for KYC and Source of Wealth verification'
    }))
}

function generateRiskFlags(clientData, documents) {
  const flags = []

  if (!documents || !documents['tax_return']) {
    flags.push({
      id: 'missing_tax',
      title: 'Missing Tax Returns',
      description: 'Tax returns are critical for verifying income sources and wealth accumulation',
      severity: 'high'
    })
  }

  if (!documents || !documents['bank_statement']) {
    flags.push({
      id: 'missing_bank',
      title: 'Missing Bank Statements',
      description: 'Bank statements provide transaction history and fund flow verification',
      severity: 'high'
    })
  }

  if (clientData?.estimatedWealth && parseInt(clientData.estimatedWealth.replace(/,/g, '')) > 10000000) {
    flags.push({
      id: 'high_wealth',
      title: 'High Net Worth Individual',
      description: 'Client exceeds SGD 10M threshold - requires enhanced due diligence',
      severity: 'medium'
    })
  }

  if (clientData?.riskProfile === 'high') {
    flags.push({
      id: 'high_risk_profile',
      title: 'High Risk Profile Indicated',
      description: 'Client flagged as high risk - requires additional scrutiny',
      severity: 'medium'
    })
  }

  if (!documents || !documents['business_docs']) {
    flags.push({
      id: 'missing_business',
      title: 'Missing Business Documentation',
      description: 'Business ownership documents recommended for source of wealth verification',
      severity: 'low'
    })
  }

  return flags
}

function determineStatus(missingDocs, riskFlags) {
  const highSeverityFlags = riskFlags.filter(f => f.severity === 'high').length
  const criticalMissing = missingDocs.filter(d => d.id === 'tax_return' || d.id === 'bank_statement').length

  if (highSeverityFlags > 0 || criticalMissing > 0) {
    return 'Need More Documents'
  }

  if (missingDocs.length > 0 || riskFlags.length > 0) {
    return 'Needs Review'
  }

  return 'Ready for Review'
}

function getStatusColor(status) {
  switch (status) {
    case 'Ready for Review':
      return 'bg-green-100 border-green-300 text-green-900'
    case 'Needs Review':
      return 'bg-amber-100 border-amber-300 text-amber-900'
    case 'Need More Documents':
      return 'bg-red-100 border-red-300 text-red-900'
    default:
      return 'bg-gray-100 border-gray-300 text-gray-900'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'Ready for Review':
      return <CheckCircle className="w-6 h-6 text-green-600" />
    case 'Needs Review':
      return <AlertCircle className="w-6 h-6 text-amber-600" />
    case 'Need More Documents':
      return <AlertTriangle className="w-6 h-6 text-red-600" />
    default:
      return <FileText className="w-6 h-6 text-gray-600" />
  }
}

function getStatusDescription(status) {
  switch (status) {
    case 'Ready for Review':
      return 'All required documents uploaded and no critical risk flags identified'
    case 'Needs Review':
      return 'Some documents or risk flags require attention before final approval'
    case 'Need More Documents':
      return 'Critical documents missing or high-severity flags identified - action required'
    default:
      return 'Status unknown'
  }
}
