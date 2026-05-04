const API_BASE_URL = 'http://localhost:3001/api'

async function getErrorMessage(response, fallback) {
  try {
    const payload = await response.json()
    if (payload?.code === 'groq_rate_limited') {
      return `AI analysis is temporarily unavailable. Try again in about ${payload.retryAfterMinutes || 1} minute(s).`
    }
    const rawMessage = payload?.details || payload?.error || fallback
    if (/rate limit|tokens per day|tokens per minute|retry-after|try again in/i.test(rawMessage)) {
      return 'AI analysis is temporarily unavailable because the daily AI token limit was reached. Please try again later.'
    }
    if (/groq|organization|service tier|billing|api key/i.test(rawMessage)) {
      return fallback
    }
    return rawMessage
  } catch {
    return fallback
  }
}

export async function extractDocumentText(files) {
  const formData = new FormData()

  Array.from(files || []).forEach((file) => {
    if (file instanceof File) {
      formData.append('documents', file)
    }
  })

  const response = await fetch(`${API_BASE_URL}/extract-document-text`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to extract document text'))
  }

  return response.json()
}

export async function analyzeCaseDocuments(clientData, documents) {
  const response = await fetch(`${API_BASE_URL}/analyze-case-documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clientData, documents }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to analyze case documents'))
  }

  return response.json()
}

export async function analyzeDocuments(clientData, documents) {
  const formData = new FormData()
  formData.append('clientData', JSON.stringify(clientData))
  
  // Convert document objects to actual files
  Object.entries(documents || {}).forEach(([docId, file]) => {
    if (file instanceof File) {
      formData.append('documents', file)
    }
  })

  const response = await fetch(`${API_BASE_URL}/analyze-documents`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to analyze documents'))
  }

  return response.json()
}

export async function detectRisks(clientData, documents) {
  const formData = new FormData()
  formData.append('clientData', JSON.stringify(clientData))
  
  Object.entries(documents || {}).forEach(([docId, file]) => {
    if (file instanceof File) {
      formData.append('documents', file)
    }
  })

  const response = await fetch(`${API_BASE_URL}/detect-risks`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to detect risks'))
  }

  return response.json()
}

export async function checkMissingDocs(uploadedDocs) {
  const response = await fetch(`${API_BASE_URL}/check-missing-docs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uploadedDocs })
  })

  if (!response.ok) {
    throw new Error('Failed to check missing documents')
  }

  return response.json()
}

// ============ FEATURE 1: Multi-source Verification ============
export async function verifyEntity(clientData, documents) {
  const response = await fetch(`${API_BASE_URL}/verify-entity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clientData, documents })
  })

  if (!response.ok) {
    throw new Error('Failed to verify entity')
  }

  return response.json()
}

// ============ FEATURE 2: Smart Follow-up Automation ============
export async function generateFollowUpEmail(clientData, missingDocs, tone = 'professional') {
  const response = await fetch(`${API_BASE_URL}/generate-follow-up`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clientData, missingDocs, tone })
  })

  if (!response.ok) {
    throw new Error('Failed to generate follow-up email')
  }

  return response.json()
}

// ============ FEATURE 3: Real-time Regulatory Intelligence ============
export async function getRegulatoryUpdates() {
  const response = await fetch(`${API_BASE_URL}/regulatory-updates`)

  if (!response.ok) {
    throw new Error('Failed to fetch regulatory updates')
  }

  return response.json()
}

export async function checkComplianceStatus(clientData, documents) {
  const response = await fetch(`${API_BASE_URL}/check-compliance-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clientData, documents })
  })

  if (!response.ok) {
    throw new Error('Failed to check compliance status')
  }

  return response.json()
}
