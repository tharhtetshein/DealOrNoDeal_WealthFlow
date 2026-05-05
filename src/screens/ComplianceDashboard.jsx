import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Shield, CheckCircle, Clock, AlertTriangle, FileText, User, ArrowLeft, Download, Send } from 'lucide-react'

export default function ComplianceDashboard({ onBack, clientData, documents, sowData }) {
  const missingDocs = generateMissingDocs(documents)
  const riskFlags = generateRiskFlags(clientData, documents)
  const overallStatus = determineStatus(missingDocs, riskFlags)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SoW Copilot</h1>
          <p className="text-gray-600">Private Banking Onboarding Assistant</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Client</span>
              </div>
              <p className="font-semibold">{clientData?.clientName || 'Not specified'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Documents</span>
              </div>
              <p className="font-semibold">{Object.keys(documents || {}).length} uploaded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-gray-600">Risk Flags</span>
              </div>
              <p className="font-semibold">{riskFlags.length} identified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">Status</span>
              </div>
              <p className="font-semibold text-sm">{overallStatus}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-blue-600" />
                  Compliance Review Summary
                </CardTitle>
                <CardDescription>
                  Final review before submission to compliance team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-white border rounded-lg">
                    <h4 className="font-semibold mb-2">Client Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>
                        <span className="ml-2 font-medium">{clientData?.clientName || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Type:</span>
                        <span className="ml-2 font-medium capitalize">{clientData?.clientType || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Nationality:</span>
                        <span className="ml-2 font-medium">{clientData?.nationality || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Risk Profile:</span>
                        <span className="ml-2 font-medium capitalize">{clientData?.riskProfile || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Est. Net Worth:</span>
                        <span className="ml-2 font-medium">SGD {clientData?.estimatedWealth || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Primary Source:</span>
                        <span className="ml-2 font-medium capitalize">{clientData?.primarySource?.replace('_', ' ') || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white border rounded-lg">
                    <h4 className="font-semibold mb-2">Document Checklist</h4>
                    <div className="space-y-2">
                      {[
                        { id: 'passport', name: 'Passport / ID' },
                        { id: 'payslip', name: 'Payslips (3 months)' },
                        { id: 'tax_return', name: 'Tax Returns (2 years)' },
                        { id: 'bank_statement', name: 'Bank Statements (6 months)' },
                        { id: 'reference_letter', name: 'Bank Reference Letter' },
                        { id: 'cv_resume', name: 'CV / Resume' },
                      ].map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between text-sm">
                          <span>{doc.name}</span>
                          {documents?.[doc.id] ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-white border rounded-lg">
                    <h4 className="font-semibold mb-2">Risk Assessment</h4>
                    <div className="space-y-2">
                      {riskFlags.length === 0 ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">No risk flags identified</span>
                        </div>
                      ) : (
                        riskFlags.map((flag) => (
                          <div key={flag.id} className={`flex items-start gap-2 text-sm ${flag.severity === 'high' ? 'text-red-700' : 'text-amber-700'}`}>
                            {flag.severity === 'high' ? (
                              <AlertTriangle className="w-4 h-4 mt-0.5" />
                            ) : (
                              <Clock className="w-4 h-4 mt-0.5" />
                            )}
                            <span>{flag.title}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Source of Wealth Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold">Client Overview:</span>
                    <p className="text-gray-700 mt-1">{sowData?.clientOverview || 'Not generated'}</p>
                  </div>
                  <div>
                    <span className="font-semibold">Primary Source:</span>
                    <p className="text-gray-700 mt-1">{sowData?.primarySource || 'Not generated'}</p>
                  </div>
                  <div>
                    <span className="font-semibold">Risk Summary:</span>
                    <p className="text-gray-700 mt-1">{sowData?.riskSummary || 'Not generated'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full flex items-center gap-2" disabled={overallStatus === 'Need More Documents'}>
                  <Send className="w-4 h-4" />
                  Submit to Compliance
                </Button>
                <Button variant="outline" className="w-full flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
                <Button variant="outline" className="w-full flex items-center gap-2" onClick={onBack}>
                  <ArrowLeft className="w-4 h-4" />
                  Edit Case
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Case Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Client Intake Completed</p>
                      <p className="text-xs text-gray-500">Step 1 of 5</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Documents Uploaded</p>
                      <p className="text-xs text-gray-500">Step 2 of 5</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">SoW Draft Generated</p>
                      <p className="text-xs text-gray-500">Step 3 of 5</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Risk Review Completed</p>
                      <p className="text-xs text-gray-500">Step 4 of 5</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Compliance Review</p>
                      <p className="text-xs text-gray-500">Step 5 of 5 - Current</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {overallStatus === 'Need More Documents' && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900 text-sm">Request More Information</p>
                      <p className="text-xs text-red-700 mt-1">
                        Critical documents are missing. Please complete document upload before submission.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
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
