import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Upload, CheckCircle, AlertCircle, FileText, ArrowRight, ArrowLeft } from 'lucide-react'

export default function DocumentUpload({ onNext, onBack, documents, setDocuments }) {
  const [uploadedFiles, setUploadedFiles] = useState(documents || [])

  const requiredDocuments = [
    { id: 'passport', name: 'Passport / ID Document', category: 'identity', required: true },
    { id: 'payslip', name: 'Recent Payslips (3 months)', category: 'income', required: true },
    { id: 'tax_return', name: 'Tax Returns (2 years)', category: 'income', required: true },
    { id: 'bank_statement', name: 'Bank Statements (6 months)', category: 'income', required: true },
    { id: 'business_docs', name: 'Business Registration / Ownership', category: 'business', required: false },
    { id: 'investment_portfolio', name: 'Investment Portfolio Statement', category: 'wealth', required: false },
    { id: 'property_docs', name: 'Property Ownership Documents', category: 'wealth', required: false },
    { id: 'inheritance_docs', name: 'Inheritance / Gift Documents', category: 'wealth', required: false },
    { id: 'reference_letter', name: 'Bank Reference Letter', category: 'reference', required: true },
    { id: 'cv_resume', name: 'CV / Resume', category: 'background', required: true },
  ]

  const handleFileUpload = (docId, file) => {
    setUploadedFiles(prev => ({
      ...prev,
      [docId]: file
    }))
  }

  const handleSubmit = () => {
    setDocuments(uploadedFiles)
    onNext()
  }

  const uploadedCount = Object.keys(uploadedFiles).length
  const requiredCount = requiredDocuments.filter(d => d.required).length
  const requiredUploaded = requiredDocuments.filter(d => d.required && uploadedFiles[d.id]).length
  const isReadyToProceed = requiredUploaded >= Math.ceil(requiredCount * 0.7)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SoW Copilot</h1>
          <p className="text-gray-600">Private Banking Onboarding Assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-6 h-6" />
              Document Upload
            </CardTitle>
            <CardDescription>
              Upload client documents for Source of Wealth analysis
              <div className="mt-2 text-sm">
                <span className="font-semibold">Progress:</span> {requiredUploaded} of {requiredCount} required documents uploaded
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requiredDocuments.map((doc) => {
                const isUploaded = !!uploadedFiles[doc.id]
                return (
                  <div
                    key={doc.id}
                    className={`p-4 border rounded-lg ${isUploaded ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isUploaded ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : doc.required ? (
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-500 capitalize">{doc.category} {doc.required ? '• Required' : '• Optional'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isUploaded && (
                          <span className="text-sm text-green-600 font-medium">
                            {uploadedFiles[doc.id].name}
                          </span>
                        )}
                        <input
                          type="file"
                          id={`file-${doc.id}`}
                          className="hidden"
                          onChange={(e) => handleFileUpload(doc.id, e.target.files[0])}
                        />
                        <label
                          htmlFor={`file-${doc.id}`}
                          className="cursor-pointer px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          {isUploaded ? 'Replace' : 'Upload'}
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Upload at least 70% of required documents to proceed. The system will identify any missing information in the next step.
              </p>
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isReadyToProceed}
                className="flex items-center gap-2"
              >
                Generate SoW Analysis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
