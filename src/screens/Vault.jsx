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
  TestTube2,
} from 'lucide-react'
import {
  addDocumentToCase,
  getActiveCaseId,
  getCaseFileById,
  getDocumentCompletionSummary,
  getDocumentTypeGroups,
  hasRequiredDocuments,
  hasRequiredFields,
  markReadyForReview,
  removeDocumentFromCase,
} from '../lib/caseFiles'
import { extractDocumentText } from '../lib/api'
import { hasFirebaseConfig, uploadCaseDocumentFile } from '../lib/firebase'

function getCategoryOptionLabel(category, documents = []) {
  const uploadedCount = documents.filter((document) => document.category === category).length
  return uploadedCount > 0
    ? `${category} (Uploaded ${uploadedCount})`
    : `${category} (Not Uploaded)`
}

export default function Vault({ onNavigate }) {
  const [activeCase, setActiveCase] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loadingCase, setLoadingCase] = useState(true)
  const documentTypeGroups = useMemo(() => getDocumentTypeGroups(activeCase), [activeCase?.occupation, activeCase?.id])
  const allCategories = useMemo(() => documentTypeGroups.flatMap((group) => group.options), [documentTypeGroups])

  const checklistSummary = useMemo(() => {
    if (!activeCase) {
      return {
        entries: [],
        requiredTotal: 0,
        requiredCompletedCount: 0,
        allRequiredComplete: false,
      }
    }
    return getDocumentCompletionSummary(activeCase)
  }, [activeCase])

  const completeness = useMemo(() => {
    if (!activeCase || checklistSummary.requiredTotal === 0) return 0
    return Math.round((checklistSummary.requiredCompletedCount / checklistSummary.requiredTotal) * 100)
  }, [activeCase, checklistSummary])

  const refreshActiveCase = async () => {
    const caseId = getActiveCaseId()
    const nextCase = caseId ? await getCaseFileById(caseId) : null
    setActiveCase(nextCase)
    setLoadingCase(false)
  }

  useEffect(() => {
    refreshActiveCase()
  }, [])

  useEffect(() => {
    if (allCategories.length === 0) {
      setSelectedCategory('')
      return
    }
    if (!allCategories.includes(selectedCategory)) {
      setSelectedCategory(allCategories[0])
    }
  }, [allCategories, selectedCategory])

  const processFiles = async (files) => {
    if (!activeCase) {
      setMessage('Select a case from Case Files before uploading documents.')
      return
    }

    if (!files.length) {
      return
    }
    if (!selectedCategory) {
      setMessage('Select a required document type before uploading.')
      return
    }

    setUploading(true)

    try {
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
      setMessage('Document uploaded. Case status updated based on completeness.')
    } catch (error) {
      console.error('Document upload flow failed:', error)
      setMessage(error?.message ? `Upload failed: ${error.message}` : 'Upload failed unexpectedly. Check backend/Firebase logs.')
    } finally {
      setUploading(false)
    }
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

    if (!hasRequiredDocuments(activeCase) || !hasRequiredFields(activeCase)) {
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
    setMessage('Case submitted. Status is now Pending Review.')
    onNavigate?.('dashboard')
  }

  const handleRemoveDocument = async (documentId) => {
    if (!activeCase) return

    await removeDocumentFromCase(activeCase.id, documentId)
    await refreshActiveCase()
    setMessage('Document removed. Completeness and case status updated.')
  }

  // Test utility: Mock all required documents
  const handleMockAllDocuments = async () => {
    if (!activeCase) return

    setUploading(true)
    setMessage('Mocking all required documents...')

    const missingEntries = checklistSummary.entries?.filter((entry) => entry.required && entry.state !== 'complete') || []

    for (const entry of missingEntries) {
      const missingItems = entry.missingItems || [entry.label]
      for (const item of missingItems) {
        const documentId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        await addDocumentToCase(activeCase.id, {
          id: documentId,
          name: `Mock_${item.replace(/\s+/g, '_')}.pdf`,
          size: '1.2 MB',
          category: item,
          uploader: 'Test Upload',
          extractedText: `Mock extracted text for ${item}. This is a test document for compliance review workflow testing.`,
          mimeType: 'application/pdf',
          storagePath: null,
          downloadURL: null,
          uploadedAt: new Date().toISOString(),
        })
      }
    }

    await refreshActiveCase()
    setUploading(false)
    setMessage(`Mocked ${missingEntries.length} required document categories. Ready for testing compliance review.`)
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

  const requiredReady = checklistSummary.allRequiredComplete && hasRequiredFields(activeCase)
  const selectedCategoryUploaded = (activeCase.documents || []).some((document) => document.category === selectedCategory)
  const uploadedDocumentTypes = Array.from(new Set((activeCase.documents || []).map((document) => document.category)))
  const missingChecklistEntries = (checklistSummary.entries || []).filter((entry) => entry.required && entry.state !== 'complete')

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

          <button
            onClick={handleMockAllDocuments}
            disabled={uploading || checklistSummary.allRequiredComplete}
            className="px-4 py-3 rounded-xl bg-tertiary/10 text-tertiary text-sm font-medium hover:bg-tertiary/20 transition-colors inline-flex items-center gap-2 border border-tertiary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Test utility: Add mock documents for all required categories"
          >
            <TestTube2 className="w-4 h-4" />
            {uploading ? 'Mocking...' : 'Mock All Documents'}
          </button>
        </div>
      </div>

      <div className="px-8 grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <h2 className="font-display text-lg font-bold text-on-surface mb-4">Required Categories</h2>
            <div className="space-y-3">
              {checklistSummary.entries.map((entry) => {
                const tone = entry.state === 'complete'
                  ? 'text-success'
                  : entry.state === 'partial'
                    ? 'text-warning'
                    : 'text-error'
                const label = entry.state === 'complete'
                  ? 'Complete'
                  : entry.state === 'partial'
                    ? 'Partial'
                    : 'Missing'
                return (
                  <div key={entry.id} className="p-3 rounded-lg bg-surface-container-low">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-on-surface">{entry.label}</span>
                      <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
                        {entry.state === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {label}
                      </span>
                    </div>
                    {entry.critical && entry.state !== 'complete' ? (
                      <p className="mt-2 text-xs text-error">{entry.details}</p>
                    ) : null}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-error/20 bg-error/5 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-error mb-2">Still Needed</p>
                      {missingChecklistEntries.length > 0 ? (
                        <div className="space-y-2">
                          {missingChecklistEntries.slice(0, 4).map((entry) => (
                            <p key={entry.id} className="text-xs text-on-surface">
                              {entry.label}: {entry.missingItems?.[0] || 'Missing required evidence'}
                            </p>
                          ))}
                          {missingChecklistEntries.length > 4 ? (
                            <p className="text-xs text-on-surface-variant">+{missingChecklistEntries.length - 4} more required categories</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-success">All required categories are complete.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-success/20 bg-success/5 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success mb-2">Already Added</p>
                      {uploadedDocumentTypes.length > 0 ? (
                        <div className="space-y-2">
                          {uploadedDocumentTypes.slice(0, 4).map((category) => (
                            <p key={category} className="text-xs text-on-surface">{category}</p>
                          ))}
                          {uploadedDocumentTypes.length > 4 ? (
                            <p className="text-xs text-on-surface-variant">+{uploadedDocumentTypes.length - 4} more document types</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-on-surface-variant">No document types uploaded yet.</p>
                      )}
                    </div>
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm text-on-surface transition-colors ${
                      selectedCategoryUploaded
                        ? 'bg-success/5 border border-success/35'
                        : 'bg-surface-container border border-warning/30'
                    }`}
                  >
                    {documentTypeGroups.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((category) => (
                          <option key={category} value={category}>{getCategoryOptionLabel(category, activeCase.documents || [])}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="rounded-xl bg-surface-container-lowest px-3 py-2.5 text-xs text-on-surface-variant">
                    <p className="font-medium text-on-surface mb-2">Uploaded document types ({uploadedDocumentTypes.length})</p>
                    {uploadedDocumentTypes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {uploadedDocumentTypes.slice(0, 10).map((category) => (
                          <span key={category} className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
                            {category}
                          </span>
                        ))}
                        {uploadedDocumentTypes.length > 10 ? (
                          <span className="inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant">
                            +{uploadedDocumentTypes.length - 10} more
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p>No document types uploaded yet.</p>
                    )}
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
                : 'Required categories/profile are incomplete. Status cannot move to Pending Review yet.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
