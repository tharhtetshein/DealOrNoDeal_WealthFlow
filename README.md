# WealthFlow SoW

WealthFlow SoW is a banking onboarding workspace for Relationship Managers. It combines case management, document collection, AI-assisted extraction, Source of Wealth drafting, risk review, and audit visibility in a single app.

## What It Does

- Create and manage onboarding cases with human-readable case IDs like `WF-20260424-0001`
- Store case data in Firebase Firestore
- Store uploaded source documents in Firebase Storage
- Extract text from uploaded documents for later AI analysis
- Run Groq-powered KYC/AML analysis on stored case documents
- Generate AI insights:
  - extracted data
  - mismatches
  - missing / weak evidence
  - Source of Wealth draft
  - risk flags
  - suggested actions
- Track readiness, risk, and audit activity in the RM dashboard and case detail workspace

## Current Document Extraction Behavior

- Text-based PDFs: extracted with `pdf-parse`
- TXT files: read directly
- Image files (`png`, `jpg`, `jpeg`, `webp`, `bmp`, `tiff`): OCR with `tesseract.js`
- Scanned image-only PDFs: not fully OCR-enabled yet

If a document has no machine-readable text, AI extraction may return blank values instead of guessing.

## Tech Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- Lucide React

### Backend

- Express
- Multer
- Groq SDK
- pdf-parse
- tesseract.js

### Data / Storage

- Firebase Firestore for case records
- Firebase Storage for original uploaded files

## Environment Variables

Copy `.env.example` to `.env` and fill in all required values.

```env
GROQ_API_KEY=your_groq_api_key
PORT=3001

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

## Firebase Setup

### 1. Firestore

- Create a Firebase project
- Enable Firestore Database
- Add a Web App in Firebase project settings
- copy the Firebase config values into `.env`

### 2. Storage

- Enable Firebase Storage
- Make sure your `VITE_FIREBASE_STORAGE_BUCKET` is correct
- Add Storage rules appropriate for your environment

For local testing, you can start with permissive temporary rules and tighten them later.

## Install

```bash
npm install
```

## Run

Start both servers.

### Backend

```bash
npm run server
```

Backend runs on:

`http://localhost:3001`

### Frontend

```bash
npm run dev
```

Open the URL printed by Vite in the terminal, typically:

`http://localhost:5173`

## Important Restart Rule

Whenever you change:

- `.env`
- `server.js`
- Firebase config
- Groq configuration

restart the backend server.

If you changed frontend config or env values, restart the frontend too.

## AI Analysis Flow

The current workflow is:

1. Upload document in Case Detail or Vault
2. Original file is stored in Firebase Storage
3. Extracted text is stored with the case document record
4. Click `Run AI Analysis`
5. Backend sends stored document text plus client profile to Groq
6. Case detail page renders:
   - extracted data
   - mismatches
   - SoW draft
   - risk flags
   - suggested actions

### Important

Old documents uploaded before extraction/storage changes may not have:

- `storagePath`
- `downloadURL`
- `extractedText`

If AI analysis does not work for an older case, remove those old documents and upload them again once.

## Supported AI Endpoints

### `POST /api/extract-document-text`

Extracts text from uploaded files for storage with the case.

### `POST /api/analyze-case-documents`

Runs Groq analysis against already stored case document text.

### `POST /api/analyze-documents`

Legacy upload-and-analyze route. Still available.

### `POST /api/detect-risks`

Returns risk flags, mismatches, missing evidence, and suggested actions.

## Readiness and Risk Logic

The case detail page now uses both workflow completeness and AI results.

### Readiness considers

- required document coverage
- required case/profile fields
- SoW narrative completion
- AI mismatch penalties
- AI risk severity penalties

### Risk Level considers

- AI mismatch severity
- AI risk flag severity
- missing required documents
- overall readiness condition

This means a case can no longer stay `100%` readiness with `Low` risk if major AI mismatches are present.

## Project Structure

```text
src/
  components/
  lib/
    api.js
    caseFiles.js
    firebase.js
    firebaseCases.js
  screens/
    CaseDetail.jsx
    RMDashboard.jsx
    Vault.jsx
server.js
package.json
README.md
```

## Common Issues

### AI analysis failed

Check:

- backend is running
- `GROQ_API_KEY` is set
- backend was restarted after changes
- uploaded documents actually have extracted text

### Extracted fields show `--`

Usually means:

- the file had no readable text
- the document is scanned and OCR did not apply
- the AI found no reliable evidence and correctly avoided guessing

### Storage upload fails

Check:

- Firebase Storage is enabled
- storage bucket env value is correct
- Storage rules allow the operation

### Route returns 404

Your backend is likely stale. Restart `npm run server`.

## Notes

- The backend trims document text before sending it to Groq to stay within token limits.
- OCR currently supports image files, not full scanned-PDF OCR conversion.
- Some older demo logic still exists as fallback when no live AI analysis is present.

## Verification

Frontend build:

```bash
npm run build
```

## Security

- Do not commit real API keys
- Do not use permissive Firebase rules in production
- Add authentication and authorization before production use
- Review document and AI outputs before using them for real compliance decisions
