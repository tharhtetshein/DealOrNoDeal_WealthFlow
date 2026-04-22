import { 
  User, 
  Zap, 
  ShieldCheck, 
  ArrowRight,
  Lock,
  CheckCircle2
} from 'lucide-react'

const roles = [
  {
    id: 'rm',
    title: 'Relationship Manager',
    icon: User,
    description: 'Manage high-net-worth portfolios, client communications, and strategic wealth planning tools.',
    active: false
  },
  {
    id: 'ops',
    title: 'Onboarding Ops',
    icon: Zap,
    description: 'Coordinate new account sequences, document verification, and initial client integration flows.',
    active: true
  },
  {
    id: 'compliance',
    title: 'Compliance Reviewer',
    icon: ShieldCheck,
    description: 'Audit account activity, perform KYC/AML checks, and authorize high-value transactions.',
    active: false
  }
]

export default function RoleSelection({ onContinue }) {
  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-surface-container-low p-6 flex flex-col">
        {/* Logo */}
        <div className="mb-12">
          <h1 className="font-display font-bold text-xl text-on-surface">WEALTHFLOW</h1>
          <p className="text-xs text-on-surface-variant tracking-widest uppercase">Crimson Reserve</p>
        </div>
        
        {/* Nav Items - Decorative */}
        <nav className="flex-1 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-lowest shadow-sm">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium text-on-surface">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm">Verification</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant">
            <Zap className="w-4 h-4" />
            <span className="text-sm">Automation</span>
          </div>
        </nav>
        
        {/* Bottom */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant">
            <div className="w-4 h-4 rounded-full border border-on-surface-variant/30" />
            <span className="text-sm">Support</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant">
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span className="text-sm">Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 flex flex-col items-center justify-center">
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
                className={`relative rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                  role.active 
                    ? 'bg-surface-container-lowest shadow-ambient ring-2 ring-primary' 
                    : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                {role.active && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 gradient-primary text-white text-[10px] font-bold tracking-wider uppercase rounded-full">
                    Active Choice
                  </div>
                )}
                
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  role.active ? 'gradient-primary' : 'bg-primary/10'
                }`}>
                  <Icon className={`w-8 h-8 ${role.active ? 'text-white' : 'text-primary'}`} />
                </div>
                
                <h3 className="font-display text-xl font-bold text-on-surface mb-3">{role.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                  {role.description}
                </p>
                
                {role.active && (
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
          onClick={onContinue}
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
      <footer className="absolute bottom-0 left-0 right-0 px-8 py-4 flex items-center justify-between text-xs text-on-surface-variant">
        <p className="flex items-center gap-2">
          <Lock className="w-3 h-3" />
          Secured by WealthFlow Quantum Encryption
        </p>
        <p>System v4.2.0</p>
      </footer>
    </div>
  )
}
