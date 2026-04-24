import { useState } from 'react'
import { 
  User, 
  Zap, 
  ShieldCheck, 
  ArrowLeft,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

const roles = [
  {
    id: 'rm',
    title: 'Relationship Manager',
    icon: User,
    description: 'Manage high-net-worth portfolios, client communications, and strategic wealth planning tools.'
  },
  {
    id: 'ops',
    title: 'Onboarding Ops',
    icon: Zap,
    description: 'Coordinate new account sequences, document verification, and initial client integration flows.'
  },
  {
    id: 'compliance',
    title: 'Compliance Reviewer',
    icon: ShieldCheck,
    description: 'Audit account activity, perform KYC/AML checks, and authorize high-value transactions.'
  }
]

export default function RoleSelection({ onContinue, onBack }) {
  const [selectedRole, setSelectedRole] = useState('rm')

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Main Content */}
      <main className="w-full flex-1 px-6 py-12 md:px-12 flex flex-col items-center justify-center">
        <div className="w-full max-w-5xl mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        <div className="text-center mb-10">
          <p className="text-[10px] font-semibold text-primary tracking-widest uppercase mb-4">Access Control</p>
          <h1 className="font-display text-4xl font-bold text-on-surface mb-3">Select your workspace role</h1>
          <p className="text-on-surface-variant max-w-lg mx-auto">
            Configure your dashboard environment and toolset based on your professional responsibilities within the Private Vault.
          </p>
        </div>
        
        {/* Role Cards */}
        <div className="grid grid-cols-3 gap-6 max-w-5xl w-full mb-10">
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <div 
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`relative rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                  role.id === selectedRole
                    ? 'bg-surface-container-lowest shadow-ambient ring-2 ring-primary' 
                    : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                {role.id === selectedRole && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 gradient-primary text-white text-[10px] font-bold tracking-wider uppercase rounded-full">
                    Active Choice
                  </div>
                )}
                
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  role.id === selectedRole ? 'gradient-primary' : 'bg-primary/10'
                }`}>
                  <Icon className={`w-8 h-8 ${role.id === selectedRole ? 'text-white' : 'text-primary'}`} />
                </div>
                
                <h3 className="font-display text-xl font-bold text-on-surface mb-3">{role.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                  {role.description}
                </p>
                
                {role.id === selectedRole && (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Currently Selected</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Continue Button */}
        <button 
          onClick={() => onContinue(selectedRole)}
          className="px-10 py-4 gradient-primary text-white rounded-lg font-medium text-sm tracking-wider uppercase hover:opacity-90 transition-opacity shadow-ambient flex items-center gap-2"
        >
          Continue to Workspace
          <ArrowRight className="w-4 h-4" />
        </button>
        
        <p className="text-xs text-on-surface-variant mt-6 italic">
          Administrator authorization may be required for specific role transitions.
        </p>
      </main>
      
      {/* Footer */}
      <footer className="px-8 py-4 flex items-center justify-end text-xs text-on-surface-variant">
        <p>System v4.2.0</p>
      </footer>
    </div>
  )
}
