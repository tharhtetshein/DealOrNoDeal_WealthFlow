import {
  createCaseFile as createFirebaseCaseFile,
  getCaseFile as getFirebaseCaseFile,
  listCaseFiles as listFirebaseCaseFiles,
  removeCaseFile as removeFirebaseCaseFile,
  updateCaseFile as updateFirebaseCaseFile,
} from './firebaseCases'
import { hasFirebaseConfig, removeCaseDocumentFile } from './firebase'

const CASES_STORAGE_KEY = 'wealthflow.caseFiles'
const ACTIVE_CASE_STORAGE_KEY = 'wealthflow.activeCaseId'
const CASE_COUNTER_STORAGE_KEY = 'wealthflow.caseCounter'

const REQUIRED_DOCUMENT_CATEGORIES = [
  'Passport / ID',
  'Bank Statements',
  'Source of Wealth (SoW)',
  'Utility Bill',
  'Tax Residency Bill',
]

function normalizeCategory(category) {
  if (category === 'Tax Residency Certificate') {
    return 'Tax Residency Bill'
  }
  return category
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function getCurrentCaseDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function normalizeDateValue(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return null
}

function normalizeCaseFile(caseFile) {
  if (!caseFile) return null

  return {
    ...caseFile,
    createdAt: normalizeDateValue(caseFile.createdAt),
    updatedAt: normalizeDateValue(caseFile.updatedAt),
    submittedAt: normalizeDateValue(caseFile.submittedAt),
    documents: (caseFile.documents || []).map((document) => ({
      ...document,
      uploadedAt: normalizeDateValue(document.uploadedAt) || document.uploadedAt || null,
    })),
  }
}

function getLocalCaseFiles() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(CASES_STORAGE_KEY)
  const cases = raw ? safeParse(raw, []) : []
  return cases.map(normalizeCaseFile)
}

function saveLocalCaseFiles(cases) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases))
}

function getLocalCaseFileById(caseId) {
  const cases = getLocalCaseFiles()
  return cases.find((item) => item.id === caseId) || null
}

function upsertLocalCaseFile(caseFile) {
  const normalizedCaseFile = normalizeCaseFile(caseFile)
  const cases = getLocalCaseFiles()
  const existingIndex = cases.findIndex((item) => item.id === normalizedCaseFile.id)

  if (existingIndex >= 0) {
    cases[existingIndex] = normalizedCaseFile
  } else {
    cases.unshift(normalizedCaseFile)
  }

  saveLocalCaseFiles(cases)
  return normalizedCaseFile
}

function deleteLocalCaseFile(caseId) {
  const cases = getLocalCaseFiles().filter((item) => item.id !== caseId)
  saveLocalCaseFiles(cases)

  if (getActiveCaseId() === caseId) {
    clearActiveCaseId()
  }
}

function createLocalDraftCase(formData) {
  const now = new Date().toISOString()
  const id = generateLocalCaseId()
  const caseFile = {
    id,
    clientName: formData.clientName || 'Unnamed Client',
    nationality: formData.nationality || '',
    residence: formData.residence || '',
    occupation: formData.occupation || '',
    netWorth: formData.netWorth || '',
    purpose: formData.purpose || '',
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    documents: [],
  }

  return upsertLocalCaseFile(caseFile)
}

function generateLocalCaseId() {
  if (typeof window === 'undefined') {
    return `WF-${getCurrentCaseDate()}-0001`
  }

  const dateKey = getCurrentCaseDate()
  const rawCounter = window.localStorage.getItem(CASE_COUNTER_STORAGE_KEY)
  const parsedCounter = rawCounter ? safeParse(rawCounter, {}) : {}
  const nextSequence = Number(parsedCounter[dateKey] || 0) + 1

  parsedCounter[dateKey] = nextSequence
  window.localStorage.setItem(CASE_COUNTER_STORAGE_KEY, JSON.stringify(parsedCounter))

  return `WF-${dateKey}-${String(nextSequence).padStart(4, '0')}`
}

async function withStorageFallback(operation, fallback) {
  if (!hasFirebaseConfig) {
    return fallback()
  }

  try {
    return await operation()
  } catch (error) {
    console.warn('Falling back to local case storage:', error)
    return fallback()
  }
}

export async function getAllCaseFiles() {
  return withStorageFallback(
    async () => {
      const cases = (await listFirebaseCaseFiles()).map(normalizeCaseFile)
      saveLocalCaseFiles(cases)
      return cases
    },
    async () => getLocalCaseFiles(),
  )
}

export async function getCaseFileById(caseId) {
  return withStorageFallback(
    async () => {
      const caseFile = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (caseFile) {
        upsertLocalCaseFile(caseFile)
      }
      return caseFile
    },
    async () => getLocalCaseFileById(caseId),
  )
}

export function setActiveCaseId(caseId) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_CASE_STORAGE_KEY, caseId)
}

export function getActiveCaseId() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_CASE_STORAGE_KEY)
}

export function clearActiveCaseId() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACTIVE_CASE_STORAGE_KEY)
}

export async function createDraftCase(formData) {
  return withStorageFallback(
    async () => {
      const payload = {
        clientName: formData.clientName || 'Unnamed Client',
        nationality: formData.nationality || '',
        residence: formData.residence || '',
        occupation: formData.occupation || '',
        netWorth: formData.netWorth || '',
        purpose: formData.purpose || '',
        status: 'Draft',
        submittedAt: null,
        documents: [],
      }

      const id = await createFirebaseCaseFile(payload)
      const caseFile = normalizeCaseFile(await getFirebaseCaseFile(id))
      if (caseFile) {
        upsertLocalCaseFile(caseFile)
      }
      return caseFile
    },
    async () => createLocalDraftCase(formData),
  )
}

export async function updateCaseCore(caseId, formData) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      await updateFirebaseCaseFile(caseId, {
        clientName: formData.clientName || existing.clientName,
        nationality: formData.nationality || existing.nationality,
        residence: formData.residence || existing.residence,
        occupation: formData.occupation || existing.occupation,
        netWorth: formData.netWorth || existing.netWorth,
        purpose: formData.purpose || existing.purpose,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }
      return updated
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const nextCase = {
        ...existing,
        clientName: formData.clientName || existing.clientName,
        nationality: formData.nationality || existing.nationality,
        residence: formData.residence || existing.residence,
        occupation: formData.occupation || existing.occupation,
        netWorth: formData.netWorth || existing.netWorth,
        purpose: formData.purpose || existing.purpose,
        updatedAt: new Date().toISOString(),
      }

      return upsertLocalCaseFile(nextCase)
    },
  )
}

export async function updateCaseData(caseId, payload) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      await updateFirebaseCaseFile(caseId, payload)

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }
      return updated
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const nextCase = {
        ...existing,
        ...payload,
        updatedAt: new Date().toISOString(),
      }

      return upsertLocalCaseFile(nextCase)
    },
  )
}

export async function deleteCaseFile(caseId) {
  return withStorageFallback(
    async () => {
      await removeFirebaseCaseFile(caseId)
      deleteLocalCaseFile(caseId)
    },
    async () => {
      deleteLocalCaseFile(caseId)
    },
  )
}

export async function addDocumentToCase(caseId, documentMeta) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      const nextCase = normalizeCaseFile({
        ...existing,
        documents: [...(existing.documents || []), documentMeta],
      })

      const requiredReady = hasRequiredDocuments(nextCase)

      await updateFirebaseCaseFile(caseId, {
        documents: nextCase.documents,
        status: requiredReady ? 'In Review' : 'Missing Documents',
        submittedAt: null,
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }
      return updated
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const nextCase = {
        ...existing,
        documents: [...(existing.documents || []), documentMeta],
        submittedAt: null,
      }

      const requiredReady = hasRequiredDocuments(nextCase)
      nextCase.status = requiredReady ? 'In Review' : 'Missing Documents'
      nextCase.updatedAt = new Date().toISOString()

      return upsertLocalCaseFile(nextCase)
    },
  )
}

export async function removeDocumentFromCase(caseId, documentId) {
  return withStorageFallback(
    async () => {
      const existing = await getFirebaseCaseFile(caseId)
      if (!existing) return null

      const removedDocument = (existing.documents || []).find((doc) => doc.id === documentId) || null
      const nextDocuments = (existing.documents || []).filter((doc) => doc.id !== documentId)
      const nextCase = normalizeCaseFile({
        ...existing,
        documents: nextDocuments,
      })

      let nextStatus = 'Draft'
      if (nextDocuments.length > 0) {
        nextStatus = hasRequiredDocuments(nextCase) ? 'In Review' : 'Missing Documents'
      }

      await updateFirebaseCaseFile(caseId, {
        documents: nextDocuments,
        status: nextStatus,
        submittedAt: null,
      })

      if (removedDocument?.storagePath) {
        try {
          await removeCaseDocumentFile(removedDocument.storagePath)
        } catch (error) {
          console.warn('Unable to remove document from Firebase Storage:', error)
        }
      }

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }
      return updated
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) return null

      const nextDocuments = (existing.documents || []).filter((doc) => doc.id !== documentId)
      const nextCase = {
        ...existing,
        documents: nextDocuments,
        submittedAt: null,
        updatedAt: new Date().toISOString(),
      }

      if (nextDocuments.length === 0) {
        nextCase.status = 'Draft'
      } else {
        nextCase.status = hasRequiredDocuments(nextCase) ? 'In Review' : 'Missing Documents'
      }

      return upsertLocalCaseFile(nextCase)
    },
  )
}

export function hasRequiredFields(caseFile) {
  if (!caseFile) return false
  const netWorthValue = Number(String(caseFile.netWorth || '').replace(/,/g, ''))
  return Boolean(caseFile.clientName) && netWorthValue >= 3000000
}

export function hasRequiredDocuments(caseFile) {
  const categoriesPresent = new Set((caseFile?.documents || []).map((doc) => normalizeCategory(doc.category)))
  return REQUIRED_DOCUMENT_CATEGORIES.every((category) => categoriesPresent.has(category))
}

export async function markReadyForReview(caseId) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      await updateFirebaseCaseFile(caseId, {
        status: 'Ready for Review',
        submittedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }

      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      const updated = upsertLocalCaseFile({
        ...existing,
        status: 'Ready for Review',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export async function submitCaseForCompliance(caseId, payload = {}) {
  return withStorageFallback(
    async () => {
      const existing = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      await updateFirebaseCaseFile(caseId, {
        ...payload,
        status: 'In Review',
        submittedAt: new Date().toISOString(),
      })

      const updated = normalizeCaseFile(await getFirebaseCaseFile(caseId))
      if (updated) {
        upsertLocalCaseFile(updated)
      }

      return { ok: true, caseFile: updated }
    },
    async () => {
      const existing = getLocalCaseFileById(caseId)
      if (!existing) {
        return { ok: false, reason: 'Case not found' }
      }

      if (!hasRequiredFields(existing)) {
        return { ok: false, reason: 'Required fields are incomplete' }
      }

      if (!hasRequiredDocuments(existing)) {
        return { ok: false, reason: 'Required documents are incomplete' }
      }

      const updated = upsertLocalCaseFile({
        ...existing,
        ...payload,
        status: 'In Review',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { ok: true, caseFile: updated }
    },
  )
}

export function getRequiredDocumentCategories() {
  return REQUIRED_DOCUMENT_CATEGORIES
}

export function isFirebaseEnabled() {
  return hasFirebaseConfig
}
