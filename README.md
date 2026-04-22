# SoW Copilot - Private Banking Onboarding

An AI-powered web application that helps Bank of Singapore relationship managers and onboarding teams transform client documents into clean Source of Wealth (SoW) drafts, missing-document checklists, and risk review summaries before compliance review.

## Features

- **Client Intake Form**: Collect comprehensive client information including nationality, occupation, estimated wealth, and risk profile
- **Document Upload**: Upload and track required documents (passport, payslips, tax returns, bank statements, etc.)
- **AI-Powered SoW Generation**: Automatically generates structured Source of Wealth reports using Groq AI
- **Risk Flag Detection**: AI-powered identification of compliance risks and missing information
- **Compliance Dashboard**: Final review interface with case status, document checklist, and risk assessment

## Tech Stack

### Frontend
- React 18 with Vite
- TailwindCSS for styling
- Lucide React for icons
- Custom UI components (Card, Button, Input, Label)

### Backend
- Express.js server
- Groq AI for document analysis and SoW generation
- Multer for file uploads
- PDF-parse for document text extraction
- CORS for cross-origin requests

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Groq API key (get one at https://console.groq.com/keys)

### Installation

1. Clone the repository and navigate to the project directory:
```bash
cd dealornodeal
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key:
```
GROQ_API_KEY=gsk-your-actual-api-key-here
PORT=3001
```

### Running the Application

You need to run both the frontend and backend servers:

**Terminal 1 - Backend Server:**
```bash
npm run server
```
The backend will run on http://localhost:3001

**Terminal 2 - Frontend Server:**
```bash
npm run dev
```
The frontend will run on http://localhost:3000

### Usage

1. Open http://localhost:3000 in your browser
2. Fill out the Client Intake Form with client information
3. Upload required documents (PDF, TXT, or other formats)
4. The AI will automatically generate a Source of Wealth draft
5. Review and edit the SoW draft if needed
6. View AI-detected risk flags and missing documents
7. Proceed to the Compliance Dashboard for final review

## API Endpoints

### POST /api/analyze-documents
Analyzes uploaded documents and generates SoW draft using AI.

**Request:** multipart/form-data
- `documents`: Array of uploaded files
- `clientData`: JSON string with client information

**Response:** 
```json
{
  "success": true,
  "sowData": {
    "clientOverview": "...",
    "primarySource": "...",
    "timeline": "...",
    "supportingDocs": "...",
    "riskSummary": "...",
    "recommendations": "..."
  },
  "documentsProcessed": 5
}
```

### POST /api/detect-risks
Detects risk flags using AI analysis.

**Request:** multipart/form-data
- `documents`: Array of uploaded files
- `clientData`: JSON string with client information

**Response:**
```json
{
  "success": true,
  "riskFlags": [
    {
      "id": "missing_tax",
      "title": "Missing Tax Returns",
      "description": "...",
      "severity": "high"
    }
  ]
}
```

### POST /api/check-missing-docs
Checks which required documents are missing.

**Request:** JSON body
- `uploadedDocs`: Object with uploaded document IDs

**Response:**
```json
{
  "success": true,
  "missingDocs": [
    {
      "id": "passport",
      "name": "Passport / ID Document",
      "required": true,
      "reason": "Required for KYC and Source of Wealth verification"
    }
  ]
}
```

## Document Types Supported

- PDF files (text extraction via pdf-parse)
- TXT files
- Other file types (metadata only)

## Required Documents

1. Passport / ID Document (Required)
2. Recent Payslips - 3 months (Required)
3. Tax Returns - 2 years (Required)
4. Bank Statements - 6 months (Required)
5. Bank Reference Letter (Required)
6. CV / Resume (Required)
7. Business Registration / Ownership (Optional)
8. Investment Portfolio Statement (Optional)
9. Property Ownership Documents (Optional)
10. Inheritance / Gift Documents (Optional)

## Case Status

The system automatically determines case status based on:
- Number of required documents uploaded (minimum 70% required)
- Severity of detected risk flags

**Status Levels:**
- **Ready for Review**: All required documents uploaded, no critical risk flags
- **Needs Review**: Some documents missing or medium-severity flags detected
- **Need More Documents**: Critical documents missing or high-severity flags detected

## AI Model

The application uses Groq AI (openai/gpt-oss-120b) for:
- Document analysis and text understanding
- Source of Wealth report generation
- Risk flag detection
- Compliance recommendations

The AI is configured with:
- Temperature: 0.2-0.3 for consistent, professional outputs
- Max tokens: 8192 for comprehensive responses
- System prompts for compliance officer persona

## Development

### Project Structure
```
dealornodeal/
├── src/
│   ├── components/ui/     # Reusable UI components
│   ├── lib/               # Utilities and API client
│   ├── screens/           # Page components
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # Entry point
│   └── index.css          # Global styles
├── server.js              # Backend API server
├── package.json           # Dependencies
├── vite.config.js         # Vite configuration
└── tailwind.config.js     # Tailwind configuration
```

### Adding New Features

1. **New Screen**: Create component in `src/screens/` and add to `App.jsx`
2. **New API Endpoint**: Add route to `server.js`
3. **New UI Component**: Create in `src/components/ui/`

## Troubleshooting

**AI not responding:**
- Check that GROQ_API_KEY is set in `.env`
- Verify your Groq API key is valid
- Check backend server is running on port 3001

**Document upload failing:**
- Ensure file size is reasonable (< 10MB)
- Check that uploads directory exists
- Verify CORS is configured correctly

**Frontend not connecting to backend:**
- Ensure backend server is running
- Check API_BASE_URL in `src/lib/api.js`
- Verify no firewall blocking port 3001

## Security Notes

- Never commit `.env` file with real API keys
- Use environment variables for all sensitive configuration
- Implement proper authentication for production deployment
- Add rate limiting for API endpoints in production
- Validate all file uploads on the backend

## License

This is a demonstration project for the SoW Copilot concept.

## Support

For issues or questions, please refer to the project documentation or contact the development team.
