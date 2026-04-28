import { Trash2, Play, Plus, FolderOpen, Send, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  clearActiveCaseId,
  deleteCaseFile,
  getAllCaseFiles,
  markReadyForReview,
  setActiveCaseId,
} from '../lib/caseFiles'

const statusPill = {
  Draft: 'bg-surface-container-high text-on-surface-variant rounded-2xl px-4 py-1.5',
  'Missing Documents': 'bg-error/10 text-error',
  'Pending Review': 'bg-warning/20 text-warning',
  'Under Review': 'bg-tertiary/15 text-tertiary',
  Approved: 'bg-success/15 text-success',
  Escalated: 'bg-error/20 text-error',
}

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString()
}

export default function SavedCaseFiles({ onNavigate }) {
  const [savedCases, setSavedCases] = useState([])
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const loadSavedCases = async () => {
    setSavedCases(await getAllCaseFiles())
  }

  useEffect(() => {
    loadSavedCases()
  }, [])

  const handleResume = (caseId) => {
    setActiveCaseId(caseId)
    onNavigate?.('new-case')
  }

  const handleManageDocuments = (caseId) => {
    setActiveCaseId(caseId)
    onNavigate?.('documents')
  }

  const handleDelete = async (caseId) => {
    await deleteCaseFile(caseId)
    await loadSavedCases()
  }

  const handleSubmitForReview = async (caseId) => {
    const result = await markReadyForReview(caseId)
    if (!result.ok) {
      setMessage(result.reason)
      return
    }

    setMessage('Case submitted. Status updated to Pending Review.')
    await loadSavedCases()
  }

  const handleNewCase = () => {
    clearActiveCaseId()
    onNavigate?.('new-case')
  }

  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return savedCases

    return savedCases.filter((caseFile) =>
      String(caseFile.clientName || '').toLowerCase().includes(query),
    )
  }, [savedCases, searchQuery])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">Case Files</h1>
          <p className="text-on-surface-variant">Draft first, upload documents progressively, then submit when complete.</p>
        </div>
        <button
          onClick={handleNewCase}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          New Case File
        </button>
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-surface-container text-sm text-on-surface-variant border border-outline/20">
          {message}
        </div>
      )}

      {savedCases.length > 0 ? (
        <div className="bg-surface-container rounded-lg border border-outline/20 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline/10 bg-surface-container-lowest">
                <th colSpan={6} className="px-6 py-4">
                  <div className="relative max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by client name"
                      className="w-full rounded-lg border border-outline/15 bg-surface pl-10 pr-4 py-2.5 text-sm font-normal text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </th>
              </tr>
              <tr className="border-b border-outline/20 bg-surface-container-lowest">
                <th className="text-left px-6 py-4 text-sm font-semibold text-on-surface">Client Name</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-on-surface">Net Worth</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-on-surface">Documents</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-on-surface">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-on-surface">Updated</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-on-surface">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((caseFile) => (
                <tr key={caseFile.id} className="border-b border-outline/10 hover:bg-surface-container-lowest transition-colors">
                  <td className="px-6 py-4 text-sm text-on-surface font-medium">{caseFile.clientName}</td>
                  <td className="px-6 py-4 text-sm text-on-surface">{caseFile.netWorth || 'Not specified'}</td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{(caseFile.documents || []).length} file(s)</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusPill[caseFile.status] || 'bg-surface-container-high text-on-surface'}`}>
                      {caseFile.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(caseFile.updatedAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleResume(caseFile.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-on-primary rounded hover:bg-primary/90 transition-colors text-xs font-medium"
                      >
                        <Play className="w-3 h-3" />
                        Edit Case
                      </button>
                      <button
                        onClick={() => handleManageDocuments(caseFile.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-surface-container-high text-on-surface rounded hover:bg-surface-container-highest transition-colors text-xs font-medium"
                      >
                        <FolderOpen className="w-3 h-3" />
                        Documents
                      </button>
                      <button
                        onClick={() => handleSubmitForReview(caseFile.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-tertiary/15 text-tertiary rounded hover:bg-tertiary/25 transition-colors text-xs font-medium"
                      >
                        <Send className="w-3 h-3" />
                        Submit
                      </button>
                      <button
                        onClick={() => handleDelete(caseFile.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-error/10 text-error rounded hover:bg-error/20 transition-colors text-xs font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCases.length === 0 && (
            <div className="px-6 py-8 text-sm text-on-surface-variant">
              No cases match that client name.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-container rounded-lg border border-outline/20 p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-2">No Case Files Yet</h3>
          <p className="text-on-surface-variant mb-6">Create a case first as Draft. Upload documents later from the Documents screen.</p>
          <button
            onClick={handleNewCase}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create New Case
          </button>
        </div>
      )}
    </div>
  )
}
