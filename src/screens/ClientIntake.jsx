import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { User, Building2, DollarSign, FileText, ArrowRight } from 'lucide-react'

export default function ClientIntake({ onNext, clientData, setClientData }) {
  const [formData, setFormData] = useState(clientData || {
    clientName: '',
    clientType: 'individual',
    nationality: '',
    occupation: '',
    estimatedWealth: '',
    primarySource: '',
    riskProfile: 'medium'
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setClientData(formData)
    onNext()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SoW Copilot</h1>
          <p className="text-gray-600">Private Banking Onboarding Assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-6 h-6" />
              Client Intake Form
            </CardTitle>
            <CardDescription>
              Enter client information to begin the Source of Wealth assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => handleChange('clientName', e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientType">Client Type</Label>
                  <select
                    id="clientType"
                    value={formData.clientType}
                    onChange={(e) => handleChange('clientType', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="individual">Individual</option>
                    <option value="corporate">Corporate</option>
                    <option value="trust">Trust</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => handleChange('nationality', e.target.value)}
                    placeholder="Enter nationality"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation / Business</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => handleChange('occupation', e.target.value)}
                    placeholder="Enter occupation or business type"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedWealth" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Estimated Net Worth (SGD)
                  </Label>
                  <Input
                    id="estimatedWealth"
                    value={formData.estimatedWealth}
                    onChange={(e) => handleChange('estimatedWealth', e.target.value)}
                    placeholder="e.g., 5,000,000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primarySource">Primary Source of Wealth</Label>
                  <select
                    id="primarySource"
                    value={formData.primarySource}
                    onChange={(e) => handleChange('primarySource', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select source</option>
                    <option value="employment">Employment Income</option>
                    <option value="business">Business Ownership</option>
                    <option value="inheritance">Inheritance</option>
                    <option value="investments">Investment Returns</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="riskProfile">Risk Profile</Label>
                  <div className="flex gap-4">
                    {['low', 'medium', 'high'].map((profile) => (
                      <label key={profile} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="riskProfile"
                          value={profile}
                          checked={formData.riskProfile === profile}
                          onChange={(e) => handleChange('riskProfile', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="capitalize">{profile}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" className="flex items-center gap-2">
                  Continue to Document Upload
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
