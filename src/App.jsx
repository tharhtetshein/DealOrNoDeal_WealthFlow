import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// WealthFlow Screens
import Landing from './screens/Landing'
import RoleSelection from './screens/RoleSelection'
import Dashboard from './screens/Dashboard'
import RMDashboard from './screens/RMDashboard'
import ComplianceReviewerDashboard from './screens/ComplianceReviewerDashboard'
import OpsOnboardingDashboard from './screens/OpsOnboardingDashboard'
import AuditTrail from './screens/AuditTrail'
import Vault from './screens/Vault'
import Verification from './screens/Verification'
import NewCase from './screens/NewCase'
import Regulatory from './screens/Regulatory'
import RiskReadiness from './screens/RiskReadiness'
import Extraction from './screens/Extraction'
import FollowUp from './screens/FollowUp'
import WealthReview from './screens/WealthReview'
import SavedCaseFiles from './screens/SavedCaseFiles'
import CaseDetail from './screens/CaseDetail'
import ComplianceCaseReview from './screens/ComplianceCaseReview'
import RuleAdmin from './screens/RuleAdmin'

// Legacy screens for compatibility
import ClientIntake from './screens/ClientIntake'
import DocumentUpload from './screens/DocumentUpload'
import SoWDraft from './screens/SoWDraft'
import RiskFlags from './screens/RiskFlags'
import ComplianceDashboard from './screens/ComplianceDashboard'

function App() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    if (typeof window === 'undefined') return 'landing'
    return sessionStorage.getItem('wealthflow.currentScreen') || 'landing'
  })
  const [selectedRole, setSelectedRole] = useState(() => {
    if (typeof window === 'undefined') return 'ops'
    return sessionStorage.getItem('wealthflow.selectedRole') || 'ops'
  })
  const [clientData, setClientData] = useState(null)
  const [documents, setDocuments] = useState({})
  const [sowData, setSowData] = useState(null)

  useEffect(() => {
    sessionStorage.setItem('wealthflow.currentScreen', currentScreen)
  }, [currentScreen])

  useEffect(() => {
    sessionStorage.setItem('wealthflow.selectedRole', selectedRole)
  }, [selectedRole])

  const handleNavigate = (screen) => {
    setCurrentScreen(screen)
  }

  // Layout wrapper for app screens (with sidebar)
  const AppLayout = ({ children, activeItem, headerProps }) => (
    <div className="min-h-screen bg-surface">
      <Sidebar activeItem={activeItem} onNavigate={handleNavigate} role={selectedRole} />
      <div className="min-h-screen pl-64">
        <Header {...headerProps} />
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
        return (
          <RoleSelection
            onBack={() => setCurrentScreen('landing')}
            onContinue={(role) => {
              setSelectedRole(role)
              setCurrentScreen('dashboard')
            }}
          />
        )
      
      case 'dashboard':
        return (
          <AppLayout activeItem="dashboard" headerProps={selectedRole === 'rm' ? { showSearch: false } : undefined}>
            {selectedRole === 'rm' ? <RMDashboard onNavigate={handleNavigate} /> : selectedRole === 'compliance' ? <ComplianceReviewerDashboard onNavigate={handleNavigate} /> : selectedRole === 'ops' ? <OpsOnboardingDashboard onNavigate={handleNavigate} /> : <Dashboard />}
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
            <Vault onNavigate={handleNavigate} />
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
          <AppLayout activeItem={selectedRole === 'rm' ? 'dashboard' : 'cases'}>
            <NewCase
              onNext={() => setCurrentScreen('verification')}
              setClientData={setClientData}
              setSowData={setSowData}
              onNavigate={handleNavigate}
            />
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

      case 'case-detail':
        return (
          <AppLayout activeItem="dashboard" headerProps={selectedRole === 'rm' ? { showSearch: false } : undefined}>
            <CaseDetail onNavigate={handleNavigate} />
          </AppLayout>
        )

      case 'compliance-case-review':
        return (
          <AppLayout activeItem="dashboard" headerProps={{ showSearch: false }}>
            <ComplianceCaseReview onNavigate={handleNavigate} />
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
      
      case 'cases':
        return (
          <AppLayout activeItem="cases">
            <SavedCaseFiles onNavigate={handleNavigate} />
          </AppLayout>
        )

      case 'rule-admin':
        return (
          <AppLayout activeItem="rule-admin">
            <RuleAdmin onBack={() => setCurrentScreen('dashboard')} />
          </AppLayout>
        )
      
      default:
        return <Landing onStart={() => setCurrentScreen('role-selection')} />
    }
  }

  return renderScreen()
}

export default App
