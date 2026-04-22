import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// WealthFlow Screens
import Landing from './screens/Landing'
import RoleSelection from './screens/RoleSelection'
import Dashboard from './screens/Dashboard'
import AuditTrail from './screens/AuditTrail'
import Vault from './screens/Vault'
import Verification from './screens/Verification'
import NewCase from './screens/NewCase'
import Regulatory from './screens/Regulatory'
import RiskReadiness from './screens/RiskReadiness'
import Extraction from './screens/Extraction'
import FollowUp from './screens/FollowUp'
import WealthReview from './screens/WealthReview'

// Legacy screens for compatibility
import ClientIntake from './screens/ClientIntake'
import DocumentUpload from './screens/DocumentUpload'
import SoWDraft from './screens/SoWDraft'
import RiskFlags from './screens/RiskFlags'
import ComplianceDashboard from './screens/ComplianceDashboard'

function App() {
  const [currentScreen, setCurrentScreen] = useState('landing')
  const [clientData, setClientData] = useState(null)
  const [documents, setDocuments] = useState({})
  const [sowData, setSowData] = useState(null)

  const handleNavigate = (screen) => {
    setCurrentScreen(screen)
  }

  // Layout wrapper for app screens (with sidebar)
  const AppLayout = ({ children, activeItem }) => (
    <div className="flex min-h-screen bg-surface">
      <Sidebar activeItem={activeItem} onNavigate={handleNavigate} />
      <div className="flex-1 ml-64">
        <Header />
        <main className="pt-0">
          {children}
        </main>
      </div>
    </div>
  )

  // Render the appropriate screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':
        return <Landing onStart={() => setCurrentScreen('role-selection')} />
      
      case 'role-selection':
        return <RoleSelection onContinue={() => setCurrentScreen('dashboard')} />
      
      case 'dashboard':
        return (
          <AppLayout activeItem="dashboard">
            <Dashboard />
          </AppLayout>
        )
      
      case 'audit':
        return (
          <AppLayout activeItem="audit">
            <AuditTrail />
          </AppLayout>
        )
      
      case 'documents':
        return (
          <AppLayout activeItem="documents">
            <Vault />
          </AppLayout>
        )
      
      case 'verification':
        return (
          <AppLayout activeItem="verification">
            <Verification />
          </AppLayout>
        )
      
      case 'new-case':
        return (
          <AppLayout activeItem="cases">
            <NewCase />
          </AppLayout>
        )
      
      case 'regulatory':
        return (
          <AppLayout activeItem="regulatory">
            <Regulatory />
          </AppLayout>
        )
      
      case 'risk-readiness':
        return (
          <AppLayout activeItem="cases">
            <RiskReadiness />
          </AppLayout>
        )
      
      case 'extraction':
        return (
          <AppLayout activeItem="cases">
            <Extraction />
          </AppLayout>
        )
      
      case 'automation':
        return (
          <AppLayout activeItem="automation">
            <FollowUp />
          </AppLayout>
        )
      
      case 'wealth-review':
        return (
          <AppLayout activeItem="cases">
            <WealthReview />
          </AppLayout>
        )
      
      // Legacy screens
      case 'client-intake':
        return (
          <AppLayout activeItem="cases">
            <ClientIntake 
              onNext={() => setCurrentScreen('document-upload')}
              onBack={() => setCurrentScreen('dashboard')}
              clientData={clientData}
              setClientData={setClientData}
            />
          </AppLayout>
        )
      
      case 'document-upload':
        return (
          <AppLayout activeItem="documents">
            <DocumentUpload 
              onNext={() => setCurrentScreen('sow-draft')}
              onBack={() => setCurrentScreen('client-intake')}
              documents={documents}
              setDocuments={setDocuments}
            />
          </AppLayout>
        )
      
      case 'sow-draft':
        return (
          <AppLayout activeItem="cases">
            <SoWDraft 
              onNext={() => setCurrentScreen('risk-flags')}
              onBack={() => setCurrentScreen('document-upload')}
              clientData={clientData}
              documents={documents}
              sowData={sowData}
              setSowData={setSowData}
            />
          </AppLayout>
        )
      
      case 'risk-flags':
        return (
          <AppLayout activeItem="verification">
            <RiskFlags 
              onNext={() => setCurrentScreen('compliance-dashboard')}
              onBack={() => setCurrentScreen('sow-draft')}
              clientData={clientData}
              documents={documents}
              sowData={sowData}
            />
          </AppLayout>
        )
      
      case 'compliance-dashboard':
        return (
          <AppLayout activeItem="dashboard">
            <ComplianceDashboard 
              onBack={() => setCurrentScreen('risk-flags')}
              clientData={clientData}
              documents={documents}
              sowData={sowData}
            />
          </AppLayout>
        )
      
      default:
        return <Landing onStart={() => setCurrentScreen('role-selection')} />
    }
  }

  return renderScreen()
}

export default App
