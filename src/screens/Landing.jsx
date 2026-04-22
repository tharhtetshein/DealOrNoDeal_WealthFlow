import { 
  ArrowRight, 
  Play, 
  Zap, 
  Shield, 
  BarChart3, 
  FileText,
  CheckCircle2,
  Clock,
  ChevronRight,
  Building2,
  PieChart,
  Globe,
  Lock
} from 'lucide-react'

const benefits = [
  {
    icon: Clock,
    stat: '90%',
    title: 'Reduction in Review Time',
    description: 'Cut the review period through bank statements and property deeds in seconds, not hours.',
    color: 'primary'
  },
  {
    icon: Shield,
    title: 'Vault Security',
    description: 'AES-256 encryption for every document, ensuring data is always & never compromised.',
    highlight: true,
    color: 'primary'
  },
  {
    icon: Zap,
    title: 'AI-Driven Insights',
    description: 'Identify anomalous wealth patterns, sanction risk, and potential red flags automatically.',
    color: 'tertiary'
  },
  {
    icon: FileText,
    title: 'Audit-Ready Packs',
    description: 'Generate standardized, regulator-friendly reports with the click of a button.',
    color: 'primary'
  }
]

const steps = [
  {
    step: '01',
    icon: Lock,
    title: 'Secure Ingestion',
    description: 'Upload or extract bulk trust assets via direct data center or cloud submission.'
  },
  {
    step: '02',
    icon: Zap,
    title: 'Automated Analysis',
    description: 'Our engines extract narrative context, flags, and verify the source of funds automatically.'
  },
  {
    step: '03',
    icon: CheckCircle2,
    title: 'Final Validation',
    description: 'Review AI findings, add final approval, and export your board-ready compliance pack.'
  }
]

export default function Landing({ onStart }) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-on-surface leading-tight">WEALTHFLOW</h1>
            <p className="text-[10px] text-on-surface-variant tracking-widest uppercase">Crimson Reserve</p>
          </div>
        </div>
        
        <nav className="flex items-center gap-8">
          <a href="#" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Features</a>
          <a href="#" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Pricing</a>
          <a href="#" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Security</a>
          <a href="#" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Contact</a>
        </nav>
        
        <button 
          onClick={onStart}
          className="px-5 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Access Vault
        </button>
      </header>

      {/* Hero Section */}
      <section className="px-8 py-16 grid grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-error/10 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-error" />
            <span className="text-xs font-semibold text-error">Now 50% Compliant</span>
          </div>
          
          <h1 className="font-display text-5xl font-bold text-on-surface leading-tight mb-6">
            Turn client documents into a <span className="text-primary">review-ready</span> Source of Wealth.
          </h1>
          
          <p className="text-lg text-on-surface-variant mb-8 max-w-lg">
            Automate the extraction, verification, and packaging of financial history. The Private Vault seamlessly creates precise, audit-grade compliance docs.
          </p>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onStart}
              className="px-8 py-4 gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity shadow-ambient flex items-center gap-2"
            >
              Start New Case
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="px-6 py-4 text-on-surface font-medium hover:text-primary transition-colors flex items-center gap-2">
              <Play className="w-4 h-4" />
              View Demo Dashboard
            </button>
          </div>
        </div>
        
        <div className="relative">
          <div className="rounded-2xl overflow-hidden shadow-ambient bg-surface-container-lowest p-4">
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop" 
              alt="Dashboard Preview"
              className="w-full rounded-xl"
            />
          </div>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          <div className="absolute -top-4 -left-4 w-32 h-32 bg-tertiary/10 rounded-full blur-2xl" />
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-8 py-16 bg-surface-container-low">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-2">Precision Engineered Benefits</h2>
            <p className="text-sm text-on-surface-variant">Designed for the low-down & high-net-worth service matrix where speed and accuracy are paramount.</p>
          </div>
          
          <div className="grid grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon
              return (
                <div 
                  key={idx} 
                  className={`rounded-xl p-6 ${benefit.highlight ? 'gradient-primary text-white' : 'bg-surface-container-lowest shadow-ambient'}`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                    benefit.highlight ? 'bg-white/20' : `bg-${benefit.color}/10`
                  }`}>
                    <Icon className={`w-6 h-6 ${benefit.highlight ? 'text-white' : `text-${benefit.color}`}`} />
                  </div>
                  
                  {benefit.stat && (
                    <p className="font-display text-3xl font-bold mb-2">{benefit.stat}</p>
                  )}
                  
                  <h3 className={`font-display text-lg font-bold mb-2 ${benefit.highlight ? 'text-white' : 'text-on-surface'}`}>
                    {benefit.title}
                  </h3>
                  <p className={`text-sm leading-relaxed ${benefit.highlight ? 'text-white/80' : 'text-on-surface-variant'}`}>
                    {benefit.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-2">The WealthFlow Process</h2>
            <p className="text-sm text-on-surface-variant">Seamless integration from document collection to final compliant SoW archive.</p>
          </div>
          
          <div className="grid grid-cols-3 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon
              return (
                <div key={idx} className="text-center">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{step.step}</span>
                    </div>
                  </div>
                  <h3 className="font-display text-lg font-bold text-on-surface mb-2">{step.title}</h3>
                  <p className="text-sm text-on-surface-variant">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-8 py-16">
        <div className="max-w-4xl mx-auto rounded-2xl bg-surface-container p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <h2 className="font-display text-3xl font-bold text-on-surface mb-4 relative z-10">
            Elevate your compliance standards today.
          </h2>
          <p className="text-on-surface-variant mb-8 max-w-lg mx-auto relative z-10">
            Join elite private banking institutions and law firms using WealthFlow to streamline onboarding for HNW clients.
          </p>
          
          <button 
            onClick={onStart}
            className="px-8 py-4 gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity shadow-ambient relative z-10"
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t border-outline/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-on-surface">WEALTHFLOW</p>
              <p className="text-[10px] text-on-surface-variant">The Private Vault for modern wealth compliance.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-on-surface-variant">
            <a href="#" className="hover:text-on-surface transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-on-surface transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-on-surface transition-colors">Compliance Guide</a>
            <a href="#" className="hover:text-on-surface transition-colors">Contact</a>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto mt-8 pt-4 border-t border-outline/5 flex items-center justify-between text-xs text-on-surface-variant">
          <p>© 2024 WealthFlow Technologies. All rights reserved. Registered Office: 87 St. Vincent Street, London EC2A 4DN.</p>
          <div className="flex items-center gap-4">
            <Globe className="w-4 h-4" />
            <div className="w-4 h-4 rounded-full bg-on-surface-variant/20" />
            <div className="w-4 h-4 rounded-full bg-on-surface-variant/20" />
          </div>
        </div>
      </footer>
    </div>
  )
}
