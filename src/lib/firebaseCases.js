import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'

const CASES_COLLECTION = 'caseFiles'
const COUNTERS_COLLECTION = 'systemCounters'

function getCurrentCaseDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function ensureFirebaseReady() {
  if (!hasFirebaseConfig || !db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values in .env')
  }
}

export async function listCaseFiles() {
  ensureFirebaseReady()
  const q = query(collection(db, CASES_COLLECTION), orderBy('updatedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function getCaseFile(caseId) {
  ensureFirebaseReady()
  const ref = doc(db, CASES_COLLECTION, caseId)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() }
}

export async function createCaseFile(payload) {
  ensureFirebaseReady()
  const dateKey = getCurrentCaseDate()

  return runTransaction(db, async (transaction) => {
    const counterRef = doc(db, COUNTERS_COLLECTION, `caseId-${dateKey}`)
    const counterSnapshot = await transaction.get(counterRef)
    const lastSequence = counterSnapshot.exists() ? Number(counterSnapshot.data().lastSequence || 0) : 0
    const nextSequence = lastSequence + 1
    const caseId = `WF-${dateKey}-${String(nextSequence).padStart(4, '0')}`
    const caseRef = doc(db, CASES_COLLECTION, caseId)

    transaction.set(counterRef, {
      dateKey,
      lastSequence: nextSequence,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    transaction.set(caseRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return caseId
  })
}

export async function updateCaseFile(caseId, payload) {
  ensureFirebaseReady()
  const ref = doc(db, CASES_COLLECTION, caseId)
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function removeCaseFile(caseId) {
  ensureFirebaseReady()
  await deleteDoc(doc(db, CASES_COLLECTION, caseId))
}
