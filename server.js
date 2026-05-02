import express from 'express'
import cors from 'cors'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import dotenv from 'dotenv'
import { Groq } from 'groq-sdk'
import fs from 'fs'
import path from 'path'
import Tesseract from 'tesseract.js'
import { evaluateRules, getDefaultRules, normalizeRule, validateRule } from './src/lib/ruleEngine.js'

dotenv.config()

const app = express()
const upload = multer({ dest: 'uploads/' })
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

app.use(cors())
app.use(express.json())

const KYC_AML_SYSTEM_PROMPT = `You are an AI assistant embedded in a banking onboarding system called "WealthFlow SoW".

Your role is to analyze client onboarding data and uploaded documents to support Relationship Managers (RM) and Compliance Reviewers.

You MUST follow real-world KYC (Know Your Customer) and AML (Anti-Money Laundering) principles.

You will receive:
1. Client Profile (intake form)
2. Uploaded Documents (text extracted)

Your tasks are:
1. Extract key information from documents
2. Validate extracted data against the client profile
3. Assess document completeness for KYC and Source of Wealth verification
4. Generate a professional Source of Wealth draft
5. Identify and classify risk factors
6. Suggest clear next actions

Important rules:
- Do NOT make assumptions without evidence
- Clearly indicate uncertainty when evidence is weak
- Do NOT approve or reject cases
- Support human decision-making only
- Keep outputs clear, structured, and easy to scan`

function parseJsonResponse(content) {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('Model response was not valid JSON')
  }
}

function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }
  }
}

function buildClientProfileSummary(clientData = {}) {
  return `CLIENT PROFILE
- Full name: ${clientData.clientName || 'Not provided'}
- Nationality: ${clientData.nationality || 'Not provided'}
- Country of residence: ${clientData.residence || clientData.countryOfResidence || 'Not provided'}
- Occupation: ${clientData.occupation || 'Not provided'}
- Employer / business name: ${clientData.employer || clientData.businessName || 'Not provided'}
- Client type: ${clientData.clientType || 'Not provided'}
- Estimated net worth: ${clientData.estimatedWealth || clientData.netWorth || 'Not provided'}
- Declared source of wealth: ${clientData.primarySource || clientData.declaredSourceOfWealth || 'Not provided'}
- Account purpose: ${clientData.purpose || clientData.accountPurpose || 'Not provided'}`
}

function buildDocumentsSummary(documents = []) {
  if (!documents.length) {
    return 'UPLOADED DOCUMENTS\nNo document text provided.'
  }

  const maxDocChars = 1800
  const maxCombinedChars = 6000
  let remainingChars = maxCombinedChars

  return `UPLOADED DOCUMENTS
${documents.map((doc) => {
  if (remainingChars <= 0) {
    return null
  }

  const rawText = String(doc.text || '').trim() || 'No extractable text found.'
  const truncatedByDoc = rawText.slice(0, maxDocChars)
  const snippet = truncatedByDoc.slice(0, remainingChars)
  remainingChars -= snippet.length

  return `--- ${doc.filename}${doc.category ? ` (${doc.category})` : ''} ---\n${snippet}`
}).filter(Boolean).join('\n\n')}`
}

function buildAnalysisPrompt(clientData = {}, documents = []) {
  return `Analyze the following onboarding case using KYC and AML principles.

${buildClientProfileSummary(clientData)}

${buildDocumentsSummary(documents)}

Return JSON with these top-level sections:
1. extractedData
2. mismatches
3. missingOrInsufficientDocuments
4. sourceOfWealthDraft
5. riskFlags
6. suggestedActions

Also include these compatibility keys for the current frontend:
- clientOverview
- primarySource
- timeline
- supportingDocs
- riskSummary
- recommendations

Formatting requirements:
- extractedData must be an object whose fields use this shape:
  {
    "name": { "value": "...", "sourceDocument": "passport.pdf" },
    "occupation": { "value": "...", "sourceDocument": "employment_letter.pdf" },
    "employerOrBusiness": { "value": "...", "sourceDocument": "bank_statement.pdf" },
    "sourceOfWealthIndicators": { "value": "...", "sourceDocument": "source_of_wealth.pdf" },
    "ownershipPercentage": { "value": "...", "sourceDocument": "company_registry.pdf" },
    "incomeIndicators": { "value": "...", "sourceDocument": "bank_statement.pdf" },
    "countriesInvolved": { "value": ["Singapore"], "sourceDocument": "passport.pdf" },
    "keyDatesAndAmounts": { "value": ["01 Jan 2026: SGD 250,000"], "sourceDocument": "bank_statement.pdf" }
  }
- mismatches should be an array with field, declaredValue, detectedValue, issue, sourceDocument, severity
- missingOrInsufficientDocuments should identify missing, outdated, weak, or insufficient evidence
- sourceOfWealthDraft must include primarySourceOfWealth, supportingEvidence, narrativeExplanation, confidence
- riskFlags should include title, severity, description, rationale
- suggestedActions should be a concise array of actionable recommendations
- Only cite values that are supported by the provided text
- If a field is not evidenced in the documents, set its value to null or an empty array instead of inventing it
- If evidence is weak, explicitly state uncertainty
- Do not approve or reject the case`
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

// Extract text from uploaded file
async function runOcrOnImage(filePath) {
  const result = await Tesseract.recognize(filePath, 'eng')
  return String(result?.data?.text || '').trim()
}

async function extractTextFromFile(file) {
  const filePath = file.path
  const fileExtension = path.extname(file.originalname || filePath).toLowerCase()

  if (fileExtension === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdfParse(dataBuffer)
    const parsedText = String(data.text || '').trim()
    if (parsedText.length > 0) {
      return parsedText
    }
    return 'No machine-readable text was found in this PDF. OCR is only available for image uploads in the current setup.'
  } else if (fileExtension === '.txt') {
    return fs.readFileSync(filePath, 'utf-8')
  } else if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif'].includes(fileExtension)) {
    const ocrText = await runOcrOnImage(filePath)
    return ocrText || 'OCR could not detect readable text in this image.'
  } else {
    // For other file types, return a placeholder
    return `Document uploaded: ${file.originalname}\nType: ${file.mimetype}\nSize: ${file.size} bytes`
  }
}

// API endpoint to analyze documents and generate SoW
app.post('/api/analyze-documents', upload.array('documents'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No documents uploaded' })
    }

    const clientData = req.body.clientData ? JSON.parse(req.body.clientData) : {}
    
    // Extract text from all uploaded documents
    const documentTexts = []
    for (const file of req.files) {
      const text = await extractTextFromFile(file)
      documentTexts.push({
        filename: file.originalname,
        text: text
      })
      // Clean up uploaded file
      fs.unlinkSync(file.path)
    }

    const prompt = buildAnalysisPrompt(clientData, documentTexts)

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: KYC_AML_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.3,
      max_tokens: 3000,
      top_p: 1,
      stream: false
    })

    const sowData = parseJsonResponse(completion.choices[0].message.content)

    res.json({
      success: true,
      sowData: sowData,
      documentsProcessed: documentTexts.length
    })

  } catch (error) {
    console.error('Error analyzing documents:', error)
    res.status(500).json({ 
      error: 'Failed to analyze documents',
      details: error.message 
    })
  }
})

app.post('/api/extract-document-text', upload.array('documents'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No documents uploaded' })
    }

    const documents = []

    for (const file of req.files) {
      const text = await extractTextFromFile(file)
      documents.push({
        filename: file.originalname,
        text,
        mimeType: file.mimetype,
        size: file.size,
      })
    }

    cleanupUploadedFiles(req.files)

    res.json({
      success: true,
      documents,
    })
  } catch (error) {
    console.error('Error extracting document text:', error)
    cleanupUploadedFiles(req.files)
    res.status(500).json({
      error: 'Failed to extract document text',
      details: error.message,
    })
  }
})

app.post('/api/analyze-case-documents', async (req, res) => {
  try {
    const { clientData = {}, documents = [] } = req.body || {}

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'No document data provided' })
    }

    const prompt = buildAnalysisPrompt(clientData, documents)

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: KYC_AML_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      max_tokens: 3000,
      top_p: 1,
      stream: false,
    })

    const sowData = parseJsonResponse(completion.choices[0].message.content)

    res.json({
      success: true,
      sowData,
      documentsProcessed: documents.length,
    })
  } catch (error) {
    console.error('Error analyzing stored case documents:', error)
    res.status(500).json({
      error: 'Failed to analyze case documents',
      details: error.message,
    })
  }
})

// API endpoint to detect risk flags
app.post('/api/detect-risks', upload.array('documents'), async (req, res) => {
  try {
    const clientData = req.body.clientData ? JSON.parse(req.body.clientData) : {}
    
    // Extract text from documents if provided
    let documentText = ''
    if (req.files && req.files.length > 0) {
      const documentTexts = []
      for (const file of req.files) {
        const text = await extractTextFromFile(file)
        documentTexts.push(text)
        fs.unlinkSync(file.path)
      }
      documentText = documentTexts.join('\n\n')
    }

    const prompt = `Assess this onboarding case for KYC / AML risk factors.

CLIENT PROFILE
- Full name: ${clientData.clientName || 'Not provided'}
- Nationality: ${clientData.nationality || 'Not provided'}
- Country of residence: ${clientData.residence || clientData.countryOfResidence || 'Not provided'}
- Occupation: ${clientData.occupation || 'Not provided'}
- Employer / business name: ${clientData.employer || clientData.businessName || 'Not provided'}
- Client type: ${clientData.clientType || 'Not provided'}
- Estimated net worth: ${clientData.estimatedWealth || clientData.netWorth || 'Not provided'}
- Declared source of wealth: ${clientData.primarySource || clientData.declaredSourceOfWealth || 'Not provided'}
- Account purpose: ${clientData.purpose || clientData.accountPurpose || 'Not provided'}

${documentText ? `DOCUMENT CONTENT:\n${documentText.substring(0, 12000)}` : ''}

Return JSON with:
- riskFlags: array of objects with id, title, description, severity, rationale
- mismatches: array of objects with field, declaredValue, detectedValue, issue
- missingOrInsufficientDocuments: array of objects with document, issue, reason
- suggestedActions: array of strings

Only identify risks supported by the provided profile or document content. If evidence is weak, say so clearly.`

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: KYC_AML_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_tokens: 8192,
      top_p: 1,
      stream: false
    })

    const riskData = parseJsonResponse(completion.choices[0].message.content)

    res.json({
      success: true,
      riskFlags: riskData.riskFlags || [],
      mismatches: riskData.mismatches || [],
      missingOrInsufficientDocuments: riskData.missingOrInsufficientDocuments || [],
      suggestedActions: riskData.suggestedActions || [],
    })

  } catch (error) {
    console.error('Error detecting risks:', error)
    res.status(500).json({ 
      error: 'Failed to detect risks',
      details: error.message 
    })
  }
})

// API endpoint for missing documents check
app.post('/api/check-missing-docs', (req, res) => {
  try {
    const { uploadedDocs } = req.body
    
    const requiredDocs = [
      { id: 'passport', name: 'Passport / ID Document', required: true },
      { id: 'payslip', name: 'Recent Payslips (3 months)', required: true },
      { id: 'tax_return', name: 'Tax Returns (2 years)', required: true },
      { id: 'bank_statement', name: 'Bank Statements (6 months)', required: true },
      { id: 'business_docs', name: 'Business Registration / Ownership', required: false },
      { id: 'investment_portfolio', name: 'Investment Portfolio Statement', required: false },
      { id: 'property_docs', name: 'Property Ownership Documents', required: false },
      { id: 'inheritance_docs', name: 'Inheritance / Gift Documents', required: false },
      { id: 'reference_letter', name: 'Bank Reference Letter', required: true },
      { id: 'cv_resume', name: 'CV / Resume', required: true },
    ]

    const uploadedDocIds = uploadedDocs ? Object.keys(uploadedDocs) : []
    const missingDocs = requiredDocs
      .filter(doc => !uploadedDocIds.includes(doc.id))
      .map(doc => ({
        ...doc,
        reason: 'Required for KYC and Source of Wealth verification'
      }))

    res.json({
      success: true,
      missingDocs: missingDocs
    })

  } catch (error) {
    console.error('Error checking missing docs:', error)
    res.status(500).json({ 
      error: 'Failed to check missing documents',
      details: error.message 
    })
  }
})

// ============ FEATURE 1: MULTI-SOURCE VERIFICATION ============

// Mock ACRA company database (Singapore company registry simulation)
const mockACRADatabase = {
  'TechVentures Pte Ltd': { uen: '202312345K', status: 'Live', incorporationDate: '2023-05-15', directors: ['Tan Wei Ming', 'Sarah Lim'] },
  'GlobalInvest Holdings': { uen: '201998765A', status: 'Live', incorporationDate: '2019-11-20', directors: ['David Chen', 'Michelle Wong'] },
  'BlueOcean Trading': { uen: '202045678B', status: 'Struck Off', incorporationDate: '2020-03-10', directors: ['Robert Ng'] },
  'Summit Capital Partners': { uen: '201812345C', status: 'Live', incorporationDate: '2018-07-25', directors: ['Jennifer Tan', 'Kevin Lim'] }
}

// Mock PEP and Sanctions database
const mockPEPSanctionsDB = {
  peps: [
    { name: 'Minister Lim', country: 'Singapore', level: 'National', position: 'Minister of Finance' },
    { name: 'Ambassador Chen', country: 'China', level: 'International', position: 'Former UN Ambassador' }
  ],
  sanctions: [
    { name: 'Sanctioned Entity A', type: 'Entity', list: 'OFAC SDN', reason: 'Weapons proliferation' },
    { name: 'Restricted Person B', type: 'Individual', list: 'UN', reason: 'Human rights violations' }
  ]
}

// Mock news database
const mockNewsDB = [
  { headline: 'TechVentures acquires AI startup for $50M', sentiment: 'positive', date: '2024-01-15', source: 'Business Times' },
  { headline: 'GlobalInvest Holdings under MAS review', sentiment: 'negative', date: '2024-02-20', source: 'Straits Times' },
  { headline: 'BlueOcean Trading former director charged', sentiment: 'negative', date: '2023-12-10', source: 'Channel News Asia' },
  { headline: 'Summit Capital expands to Southeast Asia', sentiment: 'positive', date: '2024-03-05', source: 'Reuters' }
]

// API endpoint for multi-source verification (ACRA, PEP/Sanctions, News)
app.post('/api/verify-entity', async (req, res) => {
  try {
    const { clientData, documents } = req.body
    
    // Extract company names from documents or client data
    const searchTerms = []
    if (clientData.occupation) searchTerms.push(clientData.occupation)
    if (clientData.clientName) searchTerms.push(clientData.clientName)
    
    // Search ACRA database
    const acraResults = []
    for (const term of searchTerms) {
      for (const [companyName, data] of Object.entries(mockACRADatabase)) {
        if (term.toLowerCase().includes(companyName.toLowerCase()) || 
            companyName.toLowerCase().includes(term.toLowerCase())) {
          acraResults.push({
            source: 'ACRA',
            entityName: companyName,
            uen: data.uen,
            status: data.status,
            incorporationDate: data.incorporationDate,
            directors: data.directors,
            verified: data.status === 'Live',
            riskFlag: data.status !== 'Live' ? 'Company not in good standing' : null
          })
        }
      }
    }
    
    // PEP and Sanctions screening
    const pepSanctionsResults = []
    const clientName = clientData.clientName || ''
    const normalizedName = clientName.toLowerCase()
    
    // Check PEP list
    for (const pep of mockPEPSanctionsDB.peps) {
      if (pep.name.toLowerCase().includes(normalizedName) || 
          normalizedName.includes(pep.name.toLowerCase().split(' ')[0])) {
        pepSanctionsResults.push({
          type: 'PEP',
          name: pep.name,
          country: pep.country,
          level: pep.level,
          position: pep.position,
          riskLevel: 'high',
          alert: 'Politically Exposed Person identified'
        })
      }
    }
    
    // Check Sanctions list
    for (const sanction of mockPEPSanctionsDB.sanctions) {
      if (sanction.name.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(sanction.name.toLowerCase().split(' ')[2])) {
        pepSanctionsResults.push({
          type: 'Sanctions',
          name: sanction.name,
          list: sanction.list,
          reason: sanction.reason,
          riskLevel: 'critical',
          alert: 'SANCTIONS MATCH - Immediate escalation required'
        })
      }
    }
    
    // News monitoring
    const newsResults = []
    for (const term of searchTerms) {
      for (const news of mockNewsDB) {
        if (news.headline.toLowerCase().includes(term.toLowerCase()) ||
            term.toLowerCase().includes(news.headline.split(' ')[0].toLowerCase())) {
          newsResults.push({
            headline: news.headline,
            date: news.date,
            source: news.source,
            sentiment: news.sentiment,
            riskFlag: news.sentiment === 'negative' ? 'Negative media coverage' : null
          })
        }
      }
    }
    
    res.json({
      success: true,
      verification: {
        acra: acraResults,
        pepSanctions: pepSanctionsResults,
        news: newsResults,
        overallRisk: pepSanctionsResults.length > 0 ? 'high' : 
                     newsResults.some(n => n.riskFlag) ? 'medium' : 'low',
        lastVerified: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Error in verification:', error)
    res.status(500).json({ 
      error: 'Failed to verify entity',
      details: error.message 
    })
  }
})


// ============ FEATURE 2: SMART FOLLOW-UP AUTOMATION ============

// Document alternatives database based on client profile
const documentAlternatives = {
  'payslip': {
    alternatives: ['Tax return with salary section', 'Employment contract', 'CPF contribution statement'],
    rationale: 'Alternative proof of employment income'
  },
  'tax_return': {
    alternatives: ['Payslip annual summary', 'IRAS NOA (Notice of Assessment)', 'Employment income affidavit'],
    rationale: 'Alternative proof of declared income'
  },
  'bank_statement': {
    alternatives: ['Investment account statement', 'Credit card statement', 'Loan statement showing repayments'],
    rationale: 'Alternative proof of financial activity'
  },
  'business_docs': {
    alternatives: ['Company website screenshot', 'LinkedIn profile', 'Client contracts'],
    rationale: 'Alternative proof of business ownership/activity'
  },
  'reference_letter': {
    alternatives: ['LinkedIn recommendations', 'Professional membership certificate', 'Client testimonials'],
    rationale: 'Alternative proof of professional standing'
  }
}

// API endpoint for generating smart follow-up emails
app.post('/api/generate-follow-up', async (req, res) => {
  try {
    const { clientData, missingDocs, tone = 'professional' } = req.body
    
    // Generate AI-powered email content
    const prompt = `You are a relationship manager at Bank of Singapore writing to a high-net-worth client about missing onboarding documents.

CLIENT: ${clientData.clientName || 'Valued Client'}
NATIONALITY: ${clientData.nationality || 'Not specified'}
CLIENT TYPE: ${clientData.clientType || 'Individual'}
ESTIMATED WEALTH: ${clientData.estimatedWealth || 'Not disclosed'}

MISSING DOCUMENTS:
${missingDocs.map(doc => `- ${doc.name}: ${doc.reason}`).join('\n')}

TONE: ${tone} (options: professional, friendly, urgent)

Write a polite, professional email requesting the missing documents. Include:
1. Brief greeting acknowledging the relationship
2. Clear list of required documents with brief explanation of why each is needed
3. Alternative documents they can provide if primary ones unavailable
4. Timeline (request within 7 business days)
5. Professional closing

Return ONLY the email body text, no subject line or signature placeholders.`

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a professional relationship manager writing to high-net-worth clients. Be courteous, clear, and respectful of their time."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.4,
      max_tokens: 2048,
      top_p: 1,
      stream: false
    })
    
    const emailContent = completion.choices[0].message.content
    
    // Add alternative suggestions for each missing doc
    const suggestions = missingDocs.map(doc => {
      const alts = documentAlternatives[doc.id]
      return {
        docId: doc.id,
        docName: doc.name,
        alternatives: alts ? alts.alternatives : [],
        rationale: alts ? alts.rationale : 'Standard document required for KYC'
      }
    })
    
    res.json({
      success: true,
      email: {
        content: emailContent,
        subject: `Document Request for ${clientData.clientName || 'Your'} Private Banking Onboarding`,
        suggestions: suggestions,
        tone: tone,
        generatedAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Error generating follow-up:', error)
    res.status(500).json({ 
      error: 'Failed to generate follow-up email',
      details: error.message 
    })
  }
})


// ============ FEATURE 3: REAL-TIME REGULATORY INTELLIGENCE ============

// Mock regulatory updates database
const regulatoryUpdates = [
  {
    id: 'MAS-2024-001',
    date: '2024-01-15',
    authority: 'MAS',
    title: 'Enhanced Due Diligence for High Net Worth Individuals',
    summary: 'New requirements for SoW documentation when net worth exceeds SGD 10M',
    effectiveDate: '2024-04-01',
    impactLevel: 'high',
    affectedClientTypes: ['individual', 'family_office'],
    actionRequired: 'Review all pending cases > SGD 10M for additional documentation'
  },
  {
    id: 'MAS-2024-002',
    date: '2024-02-20',
    authority: 'MAS',
    title: 'Updated PEP Definition Guidelines',
    summary: 'Expanded definition of Politically Exposed Persons includes senior judiciary',
    effectiveDate: '2024-03-15',
    impactLevel: 'medium',
    affectedClientTypes: ['all'],
    actionRequired: 'Re-screen existing clients against new PEP criteria'
  },
  {
    id: 'MAS-2024-003',
    date: '2024-03-10',
    authority: 'MAS',
    title: 'Source of Wealth Documentation Standards',
    summary: 'Minimum 3-year wealth accumulation documentation now required',
    effectiveDate: '2024-06-01',
    impactLevel: 'high',
    affectedClientTypes: ['all'],
    actionRequired: 'Update SoW templates and request additional historical documents'
  }
]

// Typology database for risk comparison
const typologyDatabase = [
  {
    name: 'Layering through Real Estate',
    indicators: ['Multiple property transactions', 'Unusual payment patterns', 'Third-party payments'],
    riskLevel: 'high',
    description: 'Using property purchases to obscure wealth origin'
  },
  {
    name: 'Trade-Based Money Laundering',
    indicators: ['Over/under invoicing', 'Phantom shipments', 'Multiple intermediaries'],
    riskLevel: 'high',
    description: 'Using trade transactions to move value across borders'
  },
  {
    name: 'Investment Fund Complexity',
    indicators: ['Layered fund structures', 'Offshore jurisdictions', 'Anonymous holdings'],
    riskLevel: 'medium',
    description: 'Using complex fund structures to hide beneficial ownership'
  }
]

// API endpoint for regulatory intelligence
app.get('/api/regulatory-updates', (req, res) => {
  try {
    res.json({
      success: true,
      updates: regulatoryUpdates,
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching regulatory updates:', error)
    res.status(500).json({ error: 'Failed to fetch updates' })
  }
})

// API endpoint to check case against regulatory requirements
app.post('/api/check-compliance-status', (req, res) => {
  try {
    const { clientData, documents } = req.body
    
    // Check against latest regulatory requirements
    const applicableUpdates = regulatoryUpdates.filter(update => 
      update.affectedClientTypes.includes('all') || 
      update.affectedClientTypes.includes(clientData?.clientType)
    )
    
    // Check if case needs re-review due to regulatory changes
    const needsReReview = applicableUpdates.some(update => {
      if (update.impactLevel === 'high') {
        // Check if wealth threshold triggered
        if (update.id === 'MAS-2024-001' && clientData?.estimatedWealth) {
          const wealth = parseInt(clientData.estimatedWealth.replace(/,/g, ''))
          return wealth > 10000000
        }
        return true
      }
      return false
    })
    
    // Compare against typologies
    const typologyMatches = []
    for (const typology of typologyDatabase) {
      let matchScore = 0
      for (const indicator of typology.indicators) {
        // Check if any document or client data matches indicators
        const docText = JSON.stringify(documents || {}).toLowerCase()
        const clientText = JSON.stringify(clientData || {}).toLowerCase()
        if (docText.includes(indicator.toLowerCase()) || 
            clientText.includes(indicator.toLowerCase())) {
          matchScore += 1
        }
      }
      if (matchScore > 0) {
        typologyMatches.push({
          typology: typology.name,
          matchScore: matchScore,
          riskLevel: typology.riskLevel,
          description: typology.description,
          matchedIndicators: typology.indicators.slice(0, matchScore)
        })
      }
    }
    
    res.json({
      success: true,
      compliance: {
        applicableUpdates: applicableUpdates,
        needsReReview: needsReReview,
        reReviewReason: needsReReview ? 'New regulatory requirements affect this case' : null,
        typologyMatches: typologyMatches,
        overallComplianceStatus: needsReReview ? 'pending_review' : 
                                  typologyMatches.length > 0 ? 'enhanced_due_diligence' : 'compliant'
      }
    })
    
  } catch (error) {
    console.error('Error checking compliance:', error)
    res.status(500).json({ 
      error: 'Failed to check compliance status',
      details: error.message 
    })
  }
})

app.post('/api/rules/evaluate', (req, res) => {
  try {
    const { caseFile, rules, baselineRisk = 'Low', baselineReadiness = 0 } = req.body || {}
    if (!caseFile) {
      res.status(400).json({ error: 'caseFile is required' })
      return
    }

    const activeRules = Array.isArray(rules) && rules.length > 0
      ? rules.map(normalizeRule)
      : getDefaultRules()

    const evaluation = evaluateRules(caseFile, activeRules, {
      baselineRisk,
      baselineReadiness,
    })

    res.json({ success: true, evaluation })
  } catch (error) {
    console.error('Error evaluating rules:', error)
    res.status(500).json({ error: 'Failed to evaluate rules', details: error.message })
  }
})

app.post('/api/rules/validate', (req, res) => {
  try {
    const rule = normalizeRule(req.body?.rule || req.body || {})
    const validation = validateRule(rule)
    res.status(validation.valid ? 200 : 400).json({ success: validation.valid, validation, rule })
  } catch (error) {
    console.error('Error validating rule:', error)
    res.status(500).json({ error: 'Failed to validate rule', details: error.message })
  }
})


const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Make sure to set GROQ_API_KEY in .env file`)
})
