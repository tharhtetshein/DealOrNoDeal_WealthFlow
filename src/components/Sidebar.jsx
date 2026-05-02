import { 
  LayoutDashboard, 
  FolderKanban,
  FileText,
  ClipboardList,
  LogOut,
  Building2,
  Gavel
} from 'lucide-react'

const defaultNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'cases', label: 'Case Files', icon: FolderKanban },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'audit', label: 'System Audit Log', icon: ClipboardList },
  { id: 'rule-admin', label: 'Rule Admin', icon: Gavel },
]

const rmNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'cases', label: 'Case Files', icon: FolderKanban },
  { id: 'audit', label: 'System Audit Log', icon: ClipboardList },
]

export default function Sidebar({ activeItem = 'dashboard', onNavigate, role = 'ops' }) {
  const navItems = role === 'rm' ? rmNavItems : defaultNavItems

  return (
    <aside className="w-64 h-screen bg-surface-container-low flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <button
        onClick={() => window.location.reload()}
        className="p-6 pb-4 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h1 className="font-display font-bold text-lg text-on-surface leading-tight">WEALTHFLOW</h1>
            <p className="text-[10px] text-on-surface-variant tracking-widest uppercase">Crimson Reserve</p>
          </div>
        </div>
      </button>

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
          onClick={() => onNavigate('role-selection')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
