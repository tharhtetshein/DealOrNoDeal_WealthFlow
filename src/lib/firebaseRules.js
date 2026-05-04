import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db, hasFirebaseConfig } from './firebase'

const RULES_COLLECTION = 'complianceRules'

function ensureFirebaseReady() {
  if (!hasFirebaseConfig || !db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values in .env')
  }
}

function withoutUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(withoutUndefined)
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (entry !== undefined) {
        result[key] = withoutUndefined(entry)
      }
      return result
    }, {})
  }
  return value
}

export function getRuleDocumentId(rule) {
  return `${encodeURIComponent(rule.id)}__v${rule.version || 1}`
}

export async function listFirebaseRules() {
  ensureFirebaseReady()
  const q = query(collection(db, RULES_COLLECTION), orderBy('priority', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => item.data())
}

export async function saveFirebaseRule(rule) {
  ensureFirebaseReady()
  await setDoc(doc(db, RULES_COLLECTION, getRuleDocumentId(rule)), withoutUndefined(rule), { merge: true })
}

export async function deleteFirebaseRule(id, version) {
  ensureFirebaseReady()
  await deleteDoc(doc(db, RULES_COLLECTION, `${encodeURIComponent(id)}__v${version || 1}`))
}

export async function replaceFirebaseRules(rules) {
  ensureFirebaseReady()
  const batch = writeBatch(db)
  const snapshot = await getDocs(collection(db, RULES_COLLECTION))

  snapshot.docs.forEach((item) => {
    batch.delete(item.ref)
  })

  rules.forEach((rule) => {
    batch.set(doc(db, RULES_COLLECTION, getRuleDocumentId(rule)), withoutUndefined(rule))
  })

  await batch.commit()
}

export { hasFirebaseConfig }
