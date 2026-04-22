import { 
  LayoutDashboard, 
  ShieldCheck, 
  Zap, 
  Scale, 
  FolderKanban, 
  FileText, 
  History,
  Plus,
  HelpCircle,
  LogOut,
  Building2
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'regulatory', label: 'Regulatory Intel', icon: Scale },
  { id: 'cases', label: 'Case Files', icon: FolderKanban },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'audit', label: 'Audit Trail', icon: History },
]

export default function Sidebar({ activeItem = 'dashboard', onNavigate }) {
  return (
    <aside className="w-64 h-screen bg-surface-container-low flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-on-surface leading-tight">WEALTHFLOW</h1>
            <p className="text-[10px] text-on-surface-variant tracking-widest uppercase">Crimson Reserve</p>
          </div>
        </div>
      </div>

      {/* New Case Button */}
      <div className="px-4 mb-6">
        <button 
          onClick={() => onNavigate('new-case')}
          className="w-full py-3 px-4 rounded-lg gradient-primary text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-ambient"
        >
          <Plus className="w-4 h-4" />
          New Case File
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-surface-container-lowest text-primary shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-outline/10">
        <button 
          onClick={() => onNavigate('support')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors mb-1"
        >
          <HelpCircle className="w-4 h-4" />
          Support
        </button>
        <button 
          onClick={() => onNavigate('logout')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
