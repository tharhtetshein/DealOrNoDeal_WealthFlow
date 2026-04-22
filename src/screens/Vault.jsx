import { useState, useCallback } from 'react'
import { 
  CheckCircle2, 
  ChevronRight, 
  Upload, 
  FileText, 
  AlertCircle,
  MoreHorizontal,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Shield,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { analyzeDocuments, checkMissingDocs } from '../lib/api'

const categories = [
  { id: 'passport', name: 'Passport / ID', status: 'complete', count: 1 },
  { id: 'bank', name: 'Bank Statements', status: 'complete', count: 2 },
  { id: 'sow', name: 'Source of Wealth (SoW)', status: 'required', count: 0 },
  { id: 'utility', name: 'Utility Bill', status: 'complete', count: 1 },
  { id: 'tax', name: 'Tax Residency Certificate', status: 'optional', count: 0 },
]

const documents = [
  { 
    name: 'A_Sterling_Passport_2024.pdf', 
    size: '3.2 MB', 
    category: 'Identity', 
    uploaded: 'Oct 12, 2023', 
    status: 'uploaded',
    type: 'pdf'
  },
  { 
    name: 'Property_Deed_Scan.jpg', 
    size: '12.5 MB', 
    category: 'SoW', 
    uploaded: 'Oct 14, 2023', 
    status: 'mismatch',
    type: 'image'
  },
  { 
    name: 'Q3_HSBC_Statement.pdf', 
    size: '1.8 MB', 
    category: 'Banking', 
    uploaded: 'Oct 15, 2023', 
    status: 'uploaded',
    type: 'pdf'
  },
  { 
    name: 'Missing Document...', 
    size: 'Tax Certification', 
    category: 'Tax', 
    uploaded: '--', 
    status: 'missing',
    type: 'missing'
  },
]

const statusConfig = {
  uploaded: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'UPLOADED' },
  mismatch: { icon: AlertCircle, color: 'text-error', bg: 'bg-error/10', label: 'MISMATCH' },
  missing: { icon: AlertCircle, color: 'text-error', bg: 'bg-error', label: 'MISSING' },
  processing: { icon: Loader2, color: 'text-tertiary', bg: 'bg-tertiary/10', label: 'PROCESSING' },
}

export default function Vault({ clientData }) {
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [completenessScore, setCompletenessScore] = useState(75)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
  }, [])

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files)
    await processFiles(files)
  }

  const processFiles = async (files) => {
    setUploading(true)
    
    const newFiles = files.map(file => ({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      category: 'Processing...',
      uploaded: new Date().toLocaleDateString(),
      status: 'processing',
      type: file.type.includes('pdf') ? 'pdf' : 'image',
      file: file
    }))
    
    setUploadedFiles(prev => [...newFiles, ...prev])
    
    try {
      // Upload and analyze with AI
      const result = await analyzeDocuments(clientData || {}, files)
      
      // Update files with analysis results
      setUploadedFiles(prev => prev.map(f => {
        const analyzed = newFiles.find(nf => nf.name === f.name)
        if (analyzed) {
          return {
            ...f,
            status: 'uploaded',
            category: result.documentsProcessed ? 'Verified' : 'Pending Review'
          }
        }
        return f
      }))
      
      // Update completeness score
      const checkResult = await checkMissingDocs({})
      const completed = checkResult.missingDocs ? (8 - checkResult.missingDocs.length) : 6
      setCompletenessScore(Math.round((completed / 8) * 100))
      
    } catch (error) {
      console.error('Upload error:', error)
      setUploadedFiles(prev => prev.map(f => 
        newFiles.find(nf => nf.name === f.name) ? { ...f, status: 'mismatch' } : f
      ))
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="min-h-screen bg-surface pb-12">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-tertiary" />
              <span className="text-[10px] font-semibold text-tertiary tracking-widest uppercase">Secure Document Repository</span>
            </div>
            <h1 className="font-display text-4xl font-bold text-on-surface mb-2">The Vault</h1>
            <p className="text-on-surface-variant">
              Securely manage mandatory compliance documentation for Client <span className="font-medium text-on-surface">#WF-99210</span> (Arthur Sterling).
            </p>
          </div>
          
          {/* Completeness Score */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="hsl(var(--surface-container-high))" strokeWidth="4" fill="none" />
                <circle cx="32" cy="32" r="28" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" 
                  strokeDasharray={`${(completenessScore / 100) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`} 
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-lg text-on-surface">{completenessScore}%</span>
            </div>
            <div>
              <p className="text-sm font-medium text-on-surface">Completeness Score</p>
              <p className="text-xs text-on-surface-variant">{Math.round((completenessScore / 100) * 8)} of 8 mandatory items</p>
              <span className="inline-block mt-2 px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-semibold rounded">{completenessScore > 80 ? 'HIGH' : completenessScore > 50 ? 'MEDIUM' : 'LOW'} CONFIDENCE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 grid grid-cols-12 gap-6">
        {/* Left Column - Categories & Upload */}
        <div className="col-span-4 space-y-6">
          {/* Mandatory Categories */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <h2 className="font-display text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="text-primary">✓</span>
              Mandatory Categories
            </h2>
            
            <div className="space-y-3">
              {categories.map((cat) => (
                <div 
                  key={cat.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    cat.status === 'required' 
                      ? 'bg-error/5 border border-error/20' 
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {cat.status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : cat.status === 'required' ? (
                      <AlertCircle className="w-5 h-5 text-error" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center">
                        <span className="text-[10px] text-on-surface-variant">···</span>
                      </div>
                    )}
                    <span className={`text-sm font-medium ${cat.status === 'required' ? 'text-error' : 'text-on-surface'}`}>
                      {cat.name}
                    </span>
                    {cat.status === 'required' && (
                      <span className="px-2 py-0.5 bg-error text-white text-[10px] font-semibold rounded">REQUIRED</span>
                    )}
                    {cat.status === 'optional' && (
                      <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-semibold rounded">OPTIONAL</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Security Card */}
          <div className="rounded-xl gradient-primary p-6 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 translate-x-1/2" />
            <Shield className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="font-display text-lg font-bold mb-2">Private Banking Security</h3>
            <p className="text-sm text-white/80 mb-4">
              Your documents are encrypted with AES-256 vault-grade protection and distributed across isolated storage clusters.
            </p>
            <button className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors">
              REVIEW LOGS
            </button>
          </div>
        </div>

        {/* Right Column - Upload & Document History */}
        <div className="col-span-8 space-y-6">
          {/* Upload Area */}
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload').click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-outline/30 bg-surface-container-low/50 hover:bg-surface-container-low'
            }`}
          >
            <input 
              id="file-upload" 
              type="file" 
              multiple 
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
              {uploading ? (
                <Loader2 className="w-6 h-6 text-error animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-error" />
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-on-surface mb-1">
              {uploading ? 'Processing Documents...' : 'Upload Compliance Documents'}
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Drag and drop files here, or click to browse local storage
            </p>
            <div className="flex items-center justify-center gap-2">
              {['PDF', 'JPG', 'PNG'].map((format) => (
                <span key={format} className="px-3 py-1 bg-surface-container rounded text-xs text-on-surface-variant">
                  {format}
                </span>
              ))}
            </div>
          </div>
          
          {/* Document History */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-ambient">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-on-surface">Document History</h2>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                  <Filter className="w-4 h-4 text-on-surface-variant" />
                </button>
                <button className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                  <RefreshCw className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            </div>
            
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Document Name</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Category</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase">Uploaded</th>
                  <th className="pb-3 text-[10px] font-semibold text-on-surface-variant tracking-wider uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/5">
                {(uploadedFiles.length > 0 ? uploadedFiles : documents).map((doc, idx) => {
                  const config = statusConfig[doc.status]
                  const StatusIcon = config?.icon || AlertCircle
                  
                  return (
                    <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            doc.type === 'pdf' ? 'bg-error/10' : 
                            doc.type === 'image' ? 'bg-surface-container-high' : 
                            'bg-error/10'
                          }`}>
                            <FileText className={`w-4 h-4 ${doc.type === 'pdf' ? 'text-error' : 'text-on-surface-variant'}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${doc.status === 'missing' ? 'text-error' : 'text-on-surface'}`}>
                              {doc.name}
                            </p>
                            <p className="text-xs text-on-surface-variant">{doc.size}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm text-on-surface-variant">{doc.category}</td>
                      <td className="py-4 text-sm text-on-surface-variant">{doc.uploaded}</td>
                      <td className="py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${config?.bg || 'bg-surface-container-high'} ${config?.color || 'text-on-surface-variant'}`}>
                          {config?.icon && <StatusIcon className="w-3 h-3" />}
                          {config?.label || doc.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline/5">
              <p className="text-xs text-on-surface-variant">Showing 4 of 4 document entries</p>
              <div className="flex items-center gap-2">
                <button className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Prev</button>
                <button className="w-6 h-6 rounded bg-primary text-white text-sm font-medium">1</button>
                <button className="w-6 h-6 rounded hover:bg-surface-container text-sm text-on-surface-variant">2</button>
                <button className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
