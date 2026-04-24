import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]

const hasFirebaseConfig = requiredKeys.every((key) => Boolean(firebaseConfig[key]))

let app = null
let db = null
let storage = null

if (hasFirebaseConfig) {
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
  storage = getStorage(app)
}

function ensureStorageReady() {
  if (!hasFirebaseConfig || !storage) {
    throw new Error('Firebase Storage is not configured. Add VITE_FIREBASE_* values in .env')
  }
}

export async function uploadCaseDocumentFile(caseId, documentId, file) {
  ensureStorageReady()

  const storagePath = `caseFiles/${caseId}/documents/${documentId}-${file.name}`
  const storageRef = ref(storage, storagePath)

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  })

  const downloadURL = await getDownloadURL(storageRef)

  return {
    storagePath,
    downloadURL,
  }
}

export async function removeCaseDocumentFile(storagePath) {
  if (!storagePath) return
  ensureStorageReady()
  await deleteObject(ref(storage, storagePath))
}

export { app, db, storage, hasFirebaseConfig }
