import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  listRules,
  createRuleDraft,
  publishRule,
  archiveRule,
  deleteRule,
  upsertRule,
  resetToDefaultRules,
} from '../lib/ruleStorage'
import { evaluateRule, extractFacts, validateRule } from '../lib/ruleEngine'
import { evaluateCaseRules } from '../lib/ruleEvaluation'
import { getAllCaseFiles } from '../lib/caseFiles'

function Badge({ children, variant = 'default' }) {
  const styles = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant] || styles.default}`}>
      {children}
    </span>
  )
}

function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex space-x-1 border-b border-gray-200 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

const OPERATOR_OPTIONS = [
  { value: '==', label: 'Equals (==)' },
  { value: '!=', label: 'Not Equals (!=)' },
  { value: '>', label: 'Greater Than (>)' },
  { value: '<', label: 'Less Than (<)' },
  { value: '>=', label: 'Greater Than or Equal (>=)' },
  { value: '<=', label: 'Less Than or Equal (<=)' },
  { value: 'in', label: 'In List (in)' },
  { value: 'exists', label: 'Exists (exists)' },
]

const ACTION_TYPES = [
  { value: 'requireDocument', label: 'Require Document' },
  { value: 'modifyRisk', label: 'Modify Risk' },
  { value: 'applyReadinessPenalty', label: 'Apply Readiness Penalty' },
  { value: 'addChecklist', label: 'Add Checklist Item' },
  { value: 'blockSubmission', label: 'Block Submission' },
]

function generateRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const FACT_FIELDS = [
  { value: 'clientProfileType', label: 'Client Profile Type' },
  { value: 'netWorth', label: 'Net Worth' },
  { value: 'riskAppetite', label: 'Risk Appetite' },
  { value: 'usPerson', label: 'US Person' },
  { value: 'pep', label: 'PEP Status' },
  { value: 'documentCount', label: 'Document Count' },
  { value: 'hasPassportOrID', label: 'Has Passport/ID' },
  { value: 'hasAddressProof', label: 'Has Address Proof' },
  { value: 'hasTaxResidency', label: 'Has Tax Residency' },
  { value: 'hasSoWDeclaration', label: 'Has SoW Declaration' },
  { value: 'hasBankStatements', label: 'Has Bank Statements' },
  { value: 'hasEmploymentDocs', label: 'Has Employment Docs' },
  { value: 'hasBusinessDocs', label: 'Has Business Docs' },
  { value: 'hasInvestmentDocs', label: 'Has Investment Docs' },
  { value: 'aiRiskCount', label: 'AI Risk Count' },
  { value: 'aiMismatchCount', label: 'AI Mismatch Count' },
  { value: 'status', label: 'Case Status' },
]

function emptyCondition() {
  return { field: '', operator: '==', value: '' }
}

function emptyAction() {
  return { type: 'requireDocument', params: { documentKey: '', label: '', reason: '' } }
}

function emptyRule() {
  return {
    id: '',
    name: '',
    description: '',
    priority: 100,
    status: 'Draft',
    version: 1,
    conditions: { operator: 'AND', clauses: [emptyCondition()] },
    actions: [emptyAction()],
    policyReference: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: null,
  }
}

function parseRuleFromStorage(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default function RuleAdmin({ onBack }) {
  const [activeTab, setActiveTab] = useState('list')
  const [rules, setRules] = useState([])
  const [draftRule, setDraftRule] = useState(emptyRule())
  const [isEditing, setIsEditing] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sandboxRule, setSandboxRule] = useState(null)
  const [sandboxCase, setSandboxCase] = useState('')
  const [sandboxResult, setSandboxResult] = useState(null)
  const [cases, setCases] = useState([])
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    refreshRules()
    getAllCaseFiles().then(setCases).catch(() => setCases([]))
  }, [])

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(t)
    }
  }, [notification])

  async function refreshRules() {
    const nextRules = await listRules()
    setRules(nextRules)
  }

  function showNotification(message, type = 'success') {
    setNotification({ message, type })
  }

  const filteredRules = useMemo(() => {
    let result = rules
    if (filterStatus !== 'all') {
      result = result.filter((r) => r.status === filterStatus)
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (r) =>
          r.name?.toLowerCase().includes(term) ||
          r.description?.toLowerCase().includes(term) ||
          r.id?.toLowerCase().includes(term) ||
          r.policyReference?.toLowerCase().includes(term),
      )
    }
    return result
  }, [rules, filterStatus, searchTerm])

  function handleNewRule() {
    setDraftRule(emptyRule())
    setIsEditing(false)
    setActiveTab('editor')
  }

  function handleEditRule(rule) {
    setDraftRule({
      ...emptyRule(),
      ...JSON.parse(JSON.stringify(rule)),
      conditions: rule.conditions || { operator: 'AND', clauses: [emptyCondition()] },
      actions: (rule.actions || []).map((a) => ({
        type: a.type || 'requireDocument',
        params: {
          ...a.params,
          documentKey: a.target || a.params?.documentKey || '',
          label: a.target || a.params?.label || '',
          riskLevel: a.modifier || a.params?.riskLevel || '',
          readinessDelta: a.value ?? a.params?.readinessDelta ?? '',
          item: a.item || a.params?.item || '',
          reason: a.reason || a.params?.reason || '',
        },
      })),
    })
    setIsEditing(true)
    setActiveTab('editor')
  }

  function handleCloneRule(rule) {
    const cloned = {
      ...emptyRule(),
      ...JSON.parse(JSON.stringify(rule)),
      id: generateRuleId(),
      name: `${rule.name} (Copy)`,
      status: 'Draft',
      version: 1,
      effectiveDate: new Date().toISOString().split('T')[0],
    }
    delete cloned.publishedVersionId
    setDraftRule(cloned)
    setIsEditing(false)
    setActiveTab('editor')
  }

  async function handleSaveDraft() {
    const ruleToSave = { ...draftRule }
    if (!ruleToSave.id) ruleToSave.id = generateRuleId()
    const validation = validateRule(ruleToSave)
    if (!validation.valid) {
      showNotification(`Validation failed: ${validation.errors.join(', ')}`, 'error')
      return
    }
    await upsertRule(ruleToSave)
    await refreshRules()
    showNotification(isEditing ? 'Rule updated' : 'Rule draft saved')
    setActiveTab('list')
  }

  async function handlePublishRule(id) {
    const result = await publishRule(id, 'admin')
    if (!result?.ok) {
      showNotification(`Publish blocked: ${(result?.errors || [result?.reason || 'rule is not publishable']).join(', ')}`, 'error')
      return
    }
    await refreshRules()
    showNotification('Rule published')
  }

  async function handleArchiveRule(id, version) {
    await archiveRule(id, version)
    await refreshRules()
    showNotification('Rule archived')
  }

  async function handleDeleteRule(id, version) {
    if (!window.confirm('Are you sure you want to delete this rule?')) return
    const result = await deleteRule(id, version)
    if (result && !result.ok) {
      showNotification(result.reason, 'error')
      return
    }
    await refreshRules()
    showNotification('Rule deleted')
  }

  async function handleResetDefaults() {
    if (!window.confirm('Reset all rules to system defaults? This will replace current rules.')) return
    await resetToDefaultRules()
    await refreshRules()
    showNotification('Rules reset to defaults')
  }

  async function handleRunSandbox() {
    if (!sandboxRule || !sandboxCase) {
      showNotification('Select both a rule and a case to test', 'error')
      return
    }
    const rule = rules.find((r) => r.id === sandboxRule)
    const caseFile = cases.find((c) => c.id === sandboxCase)
    if (!rule || !caseFile) {
      showNotification('Rule or case not found', 'error')
      return
    }
    const facts = extractFacts(caseFile)
    const triggered = evaluateRule(rule, facts)
    const evaluation = await evaluateCaseRules(caseFile, { baselineReadiness: 100, baselineRisk: 'Low' })
    setSandboxResult({
      rule,
      facts,
      triggered,
      evaluation,
      timestamp: new Date().toISOString(),
    })
  }

  function addCondition() {
    setDraftRule((prev) => ({
      ...prev,
        conditions: {
          ...prev.conditions,
          clauses: [...(prev.conditions.clauses || []), emptyCondition()],
        },
    }))
  }

  function removeCondition(index) {
    setDraftRule((prev) => ({
      ...prev,
        conditions: {
          ...prev.conditions,
          clauses: (prev.conditions.clauses || []).filter((_, i) => i !== index),
        },
    }))
  }

  function updateCondition(index, field, value) {
    setDraftRule((prev) => {
      const conditions = [...(prev.conditions.clauses || [])]
      conditions[index] = { ...conditions[index], [field]: value }
      return { ...prev, conditions: { ...prev.conditions, clauses: conditions } }
    })
  }

  function addAction() {
    setDraftRule((prev) => ({
      ...prev,
      actions: [...prev.actions, emptyAction()],
    }))
  }

  function removeAction(index) {
    setDraftRule((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }))
  }

  function updateAction(index, field, value) {
    setDraftRule((prev) => {
      const actions = [...prev.actions]
      actions[index] = { ...actions[index], [field]: value }
      return { ...prev, actions }
    })
  }

  function updateActionParam(index, paramKey, value) {
    setDraftRule((prev) => {
      const actions = [...prev.actions]
      actions[index] = {
        ...actions[index],
        params: { ...actions[index].params, [paramKey]: value },
      }
      return { ...prev, actions }
    })
  }

  function statusBadge(status) {
    switch (String(status || '').toLowerCase()) {
      case 'published':
        return <Badge variant="success">Published</Badge>
      case 'draft':
        return <Badge variant="warning">Draft</Badge>
      case 'archived':
        return <Badge variant="danger">Archived</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              notification.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}
          >
            {notification.message}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rule Engine Admin</h1>
            <p className="text-gray-600 mt-1">Manage compliance rules, test policies, and review evaluation history</p>
          </div>
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
            <Button onClick={handleNewRule}>New Rule</Button>
            <Button variant="outline" onClick={handleResetDefaults}>
              Reset Defaults
            </Button>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: 'list', label: 'Rules' },
            { id: 'editor', label: 'Editor' },
            { id: 'sandbox', label: 'Sandbox' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'list' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search rules..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                  <span className="text-sm text-gray-500">{filteredRules.length} rules</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {filteredRules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                          {statusBadge(rule.status)}
                          <span className="text-xs text-gray-500">v{rule.version}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>ID: {rule.id}</span>
                          <span>Priority: {rule.priority}</span>
                          {rule.policyReference && <span>Policy: {rule.policyReference}</span>}
                          <span>
                            Conditions: {rule.conditions?.clauses?.length || 0} ({rule.conditions?.operator || 'AND'})
                          </span>
                          <span>Actions: {rule.actions?.length || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRule(rule)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloneRule(rule)}
                        >
                          Clone
                        </Button>
                        {String(rule.status).toLowerCase() === 'draft' && (
                          <Button size="sm" onClick={() => handlePublishRule(rule.id)}>
                            Publish
                          </Button>
                        )}
                        {String(rule.status).toLowerCase() === 'published' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveRule(rule.id, rule.version)}
                          >
                            Archive
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteRule(rule.id, rule.version)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredRules.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg font-medium">No rules found</p>
                  <p className="text-sm mt-1">Create a new rule or reset to defaults</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isEditing ? 'Edit Rule' : 'New Rule'}</CardTitle>
                <CardDescription>
                  Define conditions and actions for automated compliance evaluation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ruleName">Rule Name</Label>
                    <Input
                      id="ruleName"
                      value={draftRule.name}
                      onChange={(e) => setDraftRule((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Require FATCA for US Persons"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruleId">Rule ID</Label>
                    <Input
                      id="ruleId"
                      value={draftRule.id}
                      readOnly
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ruleDescription">Description</Label>
                  <textarea
                    id="ruleDescription"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draftRule.description}
                    onChange={(e) => setDraftRule((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Explain what this rule evaluates and why..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rulePriority">Priority</Label>
                    <Input
                      id="rulePriority"
                      type="number"
                      value={draftRule.priority}
                      onChange={(e) =>
                        setDraftRule((p) => ({ ...p, priority: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rulePolicy">Policy Reference</Label>
                    <Input
                      id="rulePolicy"
                      value={draftRule.policyReference || ''}
                      onChange={(e) =>
                        setDraftRule((p) => ({ ...p, policyReference: e.target.value }))
                      }
                      placeholder="e.g., KYC-2024-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruleEffective">Effective From</Label>
                    <Input
                      id="ruleEffective"
                      type="date"
                      value={draftRule.effectiveDate || ''}
                      onChange={(e) =>
                        setDraftRule((p) => ({ ...p, effectiveDate: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Conditions</h4>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                        value={draftRule.conditions.operator}
                        onChange={(e) =>
                          setDraftRule((p) => ({
                            ...p,
                            conditions: { ...p.conditions, operator: e.target.value },
                          }))
                        }
                      >
                        <option value="AND">Match ALL (AND)</option>
                        <option value="OR">Match ANY (OR)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(draftRule.conditions.clauses || []).map((cond, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <select
                          className="flex-1 min-w-[140px] px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                          value={cond.field}
                          onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                        >
                          <option value="">Select field...</option>
                          {FACT_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-[150px] px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                          value={cond.operator}
                          onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                        >
                          {OPERATOR_OPTIONS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          className="flex-1"
                          placeholder="Value"
                          value={cond.value}
                          onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => removeCondition(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={addCondition}>
                    + Add Condition
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Actions</h4>
                  <div className="space-y-3">
                    {draftRule.actions.map((action, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                            value={action.type}
                            onChange={(e) => updateAction(idx, 'type', e.target.value)}
                          >
                            {ACTION_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => removeAction(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {action.type === 'requireDocument' && (
                            <>
                              <Input
                                placeholder="Document key (e.g., tax-residency)"
                                value={action.params.documentKey || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'documentKey', e.target.value)
                                }
                              />
                              <Input
                                placeholder="Label (e.g., Tax Residency Form)"
                                value={action.params.label || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'label', e.target.value)
                                }
                              />
                              <Input
                                placeholder="Reason"
                                value={action.params.reason || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'reason', e.target.value)
                                }
                              />
                            </>
                          )}
                          {action.type === 'modifyRisk' && (
                            <>
                              <Input
                                type="number"
                                placeholder="Risk delta (e.g., +15)"
                                value={action.params.riskDelta || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'riskDelta', Number(e.target.value))
                                }
                              />
                              <Input
                                placeholder="Risk level override (Low/Medium/High)"
                                value={action.params.riskLevel || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'riskLevel', e.target.value)
                                }
                              />
                              <Input
                                placeholder="Reason"
                                value={action.params.reason || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'reason', e.target.value)
                                }
                              />
                            </>
                          )}
                          {action.type === 'applyReadinessPenalty' && (
                            <>
                              <Input
                                type="number"
                                placeholder="Readiness delta (e.g., -20)"
                                value={action.params.readinessDelta || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'readinessDelta', Number(e.target.value))
                                }
                              />
                              <Input
                                placeholder="Reason"
                                value={action.params.reason || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'reason', e.target.value)
                                }
                              />
                              <div />
                            </>
                          )}
                          {action.type === 'addChecklist' && (
                            <>
                              <Input
                                placeholder="Checklist item text"
                                value={action.params.item || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'item', e.target.value)
                                }
                              />
                              <Input
                                placeholder="Reason"
                                value={action.params.reason || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'reason', e.target.value)
                                }
                              />
                              <div />
                            </>
                          )}
                          {action.type === 'blockSubmission' && (
                            <>
                              <Input
                                className="col-span-2"
                                placeholder="Block reason"
                                value={action.params.reason || ''}
                                onChange={(e) =>
                                  updateActionParam(idx, 'reason', e.target.value)
                                }
                              />
                              <div />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={addAction}>
                    + Add Action
                  </Button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <Button variant="outline" onClick={() => setActiveTab('list')}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveDraft}>
                    {isEditing ? 'Update Rule' : 'Save Draft'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'sandbox' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rule Sandbox</CardTitle>
                <CardDescription>
                  Test a rule against a real case to preview evaluation results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Rule</Label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={sandboxRule || ''}
                      onChange={(e) => {
                        setSandboxRule(e.target.value || null)
                        setSandboxResult(null)
                      }}
                    >
                      <option value="">-- Choose a rule --</option>
                      {rules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.status}, v{r.version})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Case</Label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={sandboxCase || ''}
                      onChange={(e) => {
                        setSandboxCase(e.target.value || '')
                        setSandboxResult(null)
                      }}
                    >
                      <option value="">-- Choose a case --</option>
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.clientName || 'Unnamed'} ({c.id.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button onClick={handleRunSandbox} disabled={!sandboxRule || !sandboxCase}>
                  Run Evaluation
                </Button>

                {sandboxResult && (
                  <div className="space-y-4 mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Rule</h4>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{sandboxResult.rule.name}</span> —{' '}
                        {sandboxResult.rule.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>ID: {sandboxResult.rule.id}</span>
                        <span>Priority: {sandboxResult.rule.priority}</span>
                        <span>Version: {sandboxResult.rule.version}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Result</h4>
                      <div className="flex items-center gap-2 mb-2">
                        {sandboxResult.triggered?.match ? (
                          <Badge variant="success">TRIGGERED</Badge>
                        ) : (
                          <Badge variant="default">NOT TRIGGERED</Badge>
                        )}
                      </div>
                      {sandboxResult.triggered?.match && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700 font-medium">Actions that would fire:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            {sandboxResult.rule.actions.map((a, i) => (
                              <li key={i}>
                                <span className="font-medium">{a.type}</span>
                                {a.params && (
                                  <span className="text-gray-500">
                                    {' '}
                                    — {JSON.stringify(a.params)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Facts from Case
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(sandboxResult.facts).map(([key, val]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
                          >
                            <span className="text-gray-600">{key}</span>
                            <span className="font-mono font-medium text-gray-900">
                              {String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Rule Evaluation Details
                      </h4>
                      <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-auto max-h-[300px]">
                        {JSON.stringify({ triggered: sandboxResult.triggered, ruleId: sandboxResult.rule.id, conditions: sandboxResult.rule.conditions }, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}