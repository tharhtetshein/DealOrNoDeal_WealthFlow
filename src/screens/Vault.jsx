import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Upload,
  FileText,
  AlertCircle,
  Shield,
  Loader2,
  Send,
  Trash2,
} from 'lucide-react'
import {
  addDocumentToCase,
  getActiveCaseId,
  getCaseFileById,
  getRequiredDocumentCategories,
  hasRequiredDocuments,
  markReadyForReview,
  removeDocumentFromCase,
} from '../lib/caseFiles'
import { extractDocumentText } from '../lib/api'
import { hasFirebaseConfig, uploadCaseDocumentFile } from '../lib/firebase'

const allCategories = [
  'Passport / ID',
  'Bank Statements',
  'Source of Wealth (SoW)',
  'Utility Bill',
  'Tax Residency Bill',
]

function getCategoryOptionLabel(category, documents = []) {
  const isUploaded = documents.some((document) => document.category === category)
  return `${category} — ${isUploaded ? 'Uploaded' : 'Not Uploaded'}`
}

export default function Vault({ onNavigate }) {
  const [activeCase, setActiveCase] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(allCategories[0])
  const [loadingCase, setLoadingCase] = useState(true)

  const requiredCategories = getRequiredDocumentCategories()

  const completeness = useMemo(() => {
    if (!activeCase) return 0
    const present = new Set((activeCase.documents || []).map((doc) => doc.category))
    const completed = requiredCategories.filter((category) => present.has(category)).length
    return Math.round((completed / requiredCategories.length) * 100)
  }, [activeCase, requiredCategories])

  const refreshActiveCase = async () => {
    const caseId = getActiveCaseId()
    const nextCase = caseId ? await getCaseFileById(caseId) : null
    setActiveCase(nextCase)
    setLoadingCase(false)
  }

  useEffect(() => {
    refreshActiveCase()
  }, [])

  const processFiles = async (files) => {
    if (!activeCase) {
      setMessage('Select a case from Case Files before uploading documents.')
      return
    }

    if (!files.length) {
      return
    }

    setUploading(true)

    let extractedDocuments = []
    try {
      const extractionResult = await extractDocumentText(files)
      extractedDocuments = extractionResult.documents || []
    } catch (error) {
      console.warn('Unable to extract document text during upload:', error)
    }

    for (const [index, file] of files.entries()) {
      const extracted = extractedDocuments[index] || {}
      const documentId = `${file.name}-${file.size}-${file.lastModified}`
      let storageMeta = {}

      if (hasFirebaseConfig) {
        try {
          storageMeta = await uploadCaseDocumentFile(activeCase.id, documentId, file)
        } catch (error) {
          console.error('Error uploading document to Firebase Storage:', error)
          setUploading(false)
          setMessage(`Unable to upload ${file.name} to Firebase Storage. Check your Firebase Storage setup.`)
          return
        }
      }

      await addDocumentToCase(activeCase.id, {
        id: documentId,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        category: selectedCategory,
        uploader: 'RM Uploaded',
        extractedText: extracted.text || '',
        mimeType: extracted.mimeType || file.type || '',
        storagePath: storageMeta.storagePath || null,
        downloadURL: storageMeta.downloadURL || null,
        uploadedAt: new Date().toISOString(),
      })
    }

    await refreshActiveCase()
    setUploading(false)
    setMessage('Document uploaded. Case status updated based on completeness.')
  }

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files || [])
    await processFiles(files)
    e.target.value = ''
  }

  const handleSubmitForReview = async () => {
    if (!activeCase) {
      setMessage('Select a case from Case Files first.')
      return
    }

    if (!hasRequiredDocuments(activeCase)) {
      setMessage('Required documents are incomplete. Redirecting to Case Files.')
      onNavigate?.('cases')
      return
    }

    const result = await markReadyForReview(activeCase.id)
    if (!result.ok) {
      setMessage(result.reason)
      onNavigate?.('cases')
      return
    }

    await refreshActiveCase()
    setMessage('Case submitted. Status is now Ready for Review.')
    onNavigate?.('dashboard')
  }

  const handleRemoveDocument = async (documentId) => {
    if (!activeCase) return

    await removeDocumentFromCase(activeCase.id, documentId)
    await refreshActiveCase()
    setMessage('Document removed. Completeness and case status updated.')
  }

  if (loadingCase) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <div className="max-w-3xl mx-auto bg-surface-container-lowest rounded-xl p-8 border border-outline/20">
          <h1 className="font-display text-3xl font-bold text-on-surface mb-3">Documents</h1>
          <p className="text-on-surface-variant">Loading active case data...</p>
        </div>
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="min-h-screen bg-surface p-8">
        <div className="max-w-3xl mx-auto bg-surface-container-lowest rounded-xl p-8 border border-outline/20">
          <h1 className="font-display text-3xl font-bold text-on-surface mb-3">Documents</h1>
          <p className="text-on-surface-variant mb-6">No active case selected. Open Case Files and choose a case first.</p>
          <button
            onClick={() => onNavigate?.('cases')}
            className="px-6 py-3 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          >
            Go to Case Files
          </button>
        </div>
      </div>
    )
  }

  const requiredReady = hasRequiredDocuments(activeCase)
  const selectedCategoryUploaded = (activeCase.documents || []).some((document) => document.category === selectedCategory)

  return (
    <div className="min-h-screen bg-surface pb-12">
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-tertiary" />
              <span className="text-[10px] font-semibold text-tertiary tracking-widest uppercase">Progressive Document Collection</span>
            </div>
            <h1 className="font-display text-4xl font-bold text-on-surface mb-2">Documents</h1>
            <p className="text-on-surface-variant">Case: <span className="font-medium text-on-surface">{activeCase.clientName}</span> ({activeCase.id})</p>
            <p className="text-on-surface-variant mt-1">Current Status: <span className="font-medium text-on-surface">{activeCase.status}</span></p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
            <p className="text-sm font-medium text-on-surface">Required Document Completeness</p>
            <p className="text-xs text-on-surface-variant mt-1">{completeness}% complete</p>
            <div className="w-48 h-2 bg-surface-container-high rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${completeness}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <h2 className="font-display text-lg font-bold text-on-surface mb-4">Required Categories</h2>
            <div className="space-y-3">
              {requiredCategories.map((category) => {
                const present = (activeCase.documents || []).some((doc) => doc.category === category)
                return (
                  <div key={category} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                    <span className="text-sm text-on-surface">{category}</span>
                    {present ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="w-4 h-4" /> Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-error">
                        <AlertCircle className="w-4 h-4" /> Missing
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="col-span-8 space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <h2 className="font-display text-lg font-bold text-on-surface mb-4">Upload Documents</h2>

            <div className="mb-4">
              <div>
                <label className="text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase mb-2 block">Document Category</label>
                <div className="space-y-3">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm text-on-surface transition-colors ${
                      selectedCategoryUploaded
                        ? 'bg-success/5 border border-success/35'
                        : 'bg-surface-container border border-warning/30'
                    }`}
                  >
                    {allCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((category) => {
                      const uploaded = (activeCase.documents || []).some((document) => document.category === category)
                      return (
                        <div
                          key={category}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                            uploaded
                              ? 'bg-success/10 text-success'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${uploaded ? 'bg-success' : 'bg-outline/50'}`} />
                          <span>{category}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <label className="w-full border-2 border-dashed border-outline/30 rounded-xl p-8 text-center cursor-pointer block hover:bg-surface-container-low transition-colors">
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                {uploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Upload className="w-6 h-6 text-primary" />}
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface mb-1">{uploading ? 'Uploading...' : 'Upload Files'}</h3>
              <p className="text-sm text-on-surface-variant">PDF, JPG, PNG, TXT</p>
            </label>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-on-surface">Uploaded Documents</h2>
              <button
                onClick={handleSubmitForReview}
                className="px-4 py-2 rounded-lg bg-tertiary/15 text-tertiary text-sm font-medium hover:bg-tertiary/25 transition-colors inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit for Review
              </button>
            </div>

            {message && <p className="mb-3 text-xs text-on-surface-variant">{message}</p>}

            {(activeCase.documents || []).length > 0 ? (
              <div className="space-y-2">
                {(activeCase.documents || []).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-on-surface-variant" />
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface truncate">{doc.name}</p>
                        <p className="text-xs text-on-surface-variant">{doc.category} • {doc.uploader} • {doc.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-on-surface-variant">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(doc.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-error hover:bg-error/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No documents uploaded yet. Case will remain Draft/Missing Documents until required docs are complete.</p>
            )}

            <p className={`mt-4 text-xs ${requiredReady ? 'text-success' : 'text-error'}`}>
              {requiredReady
                ? 'All required document categories are complete. You can submit the case for review.'
                : 'Required categories are still incomplete. Status cannot move to Ready for Review yet.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
