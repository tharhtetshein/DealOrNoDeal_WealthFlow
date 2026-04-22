import { Search, Bell, Settings, ChevronDown } from 'lucide-react'

export default function Header({ 
  title = 'WealthFlow SoW', 
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  showSearch = true,
  actionButton
}) {
  return (
    <header className="glass sticky top-0 z-30 border-b border-outline/10">
      {/* Top Bar */}
      <div className="h-16 px-6 flex items-center justify-between">
        {/* Left: Title & Navigation */}
        <div className="flex items-center gap-8">
          <div>
            <h1 className="font-display font-bold text-xl text-on-surface">{title}</h1>
            {subtitle && (
              <p className="text-xs text-on-surface-variant">{subtitle}</p>
            )}
          </div>
          
          {/* Tabs */}
          {tabs.length > 0 && (
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="h-0.5 bg-primary mt-1 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search cases, clients..."
                className="pl-10 pr-4 py-2 w-64 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}
          
          {actionButton && (
            <button className="px-5 py-2 rounded-lg gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
              {actionButton.icon}
              {actionButton.label}
            </button>
          )}
          
          <button className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </button>
          
          <div className="flex items-center gap-3 pl-4 border-l border-outline/10">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="text-sm font-medium text-on-surface">JS</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
