'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Mail,
  Search,
  MoreHorizontal,
  UserPlus,
  Clock,
  X,
  Loader2,
  Crown,
  Building2,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react'

interface TeamMember {
  id: string
  accountId: string
  fullName: string
  email: string
  role: string
  isOwner: boolean
  sites: { id: string; name: string; role: string }[]
  joinedAt: string
}

interface Invite {
  id: string
  email: string
  status: string
  expiresAt: string
  createdAt: string
  tenantAssignments: { tenantId: string; tenantName: string; role: string }[]
}

interface Company {
  id: string
  name: string
  slug: string
  role: string
  isOwner: boolean
}

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'technician', label: 'Technician' },
  { value: 'accounts_manager', label: 'Accounts Manager' },
  { value: 'stock_manager', label: 'Stock Manager' },
  { value: 'report_user', label: 'Report User' },
]

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [selectedRole, setSelectedRole] = useState('cashier')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [resending, setResending] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    try {
      const [membersRes, invitesRes, companiesRes] = await Promise.all([
        fetch('/api/account/team'),
        fetch('/api/account/invites'),
        fetch('/api/account/companies'),
      ])

      if (membersRes.ok) {
        const data = await membersRes.json()
        setMembers(data.members || [])
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json()
        setInvites(data || [])
      }

      if (companiesRes.ok) {
        const data = await companiesRes.json()
        const owned = (data || []).filter((c: Company) => c.isOwner || c.role === 'owner')
        setCompanies(owned)
        if (owned.length > 0 && !selectedTenantId) {
          setSelectedTenantId(owned[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch team:', error)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const handleInvite = async () => {
    if (!inviteEmail || !selectedTenantId) return
    setInviting(true)
    setInviteError('')

    try {
      const res = await fetch('/api/account/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          tenantAssignments: [{ tenantId: selectedTenantId, role: selectedRole }],
        }),
      })

      if (res.ok) {
        setInviteEmail('')
        setInviteSuccess(true)
        setTimeout(() => {
          setShowInviteModal(false)
          setInviteSuccess(false)
        }, 1500)
        fetchTeam()
      } else {
        const data = await res.json()
        setInviteError(data.error || data.details?.[0]?.message || 'Failed to send invite')
      }
    } catch {
      setInviteError('An error occurred. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const handleResendInvite = async (inviteId: string) => {
    setResending(inviteId)
    try {
      const res = await fetch(`/api/account/invites/${inviteId}/resend`, { method: 'POST' })
      if (res.ok) fetchTeam()
    } catch { /* ignore */ }
    finally { setResending(null) }
  }

  const filteredMembers = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  const pendingInvites = invites.filter((i) => i.status === 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Team</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Invite people to manage billing and view sites. For POS staff (cashiers, technicians), use Staff in each site&apos;s settings.
          </p>
        </div>
        <button
          onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess(false) }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00FF88]/40 placeholder:text-gray-400"
        />
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 dark:border-amber-700/50 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-amber-900 dark:text-amber-300">
              {pendingInvites.length} Pending Invitation{pendingInvites.length > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-800/30">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 dark:bg-amber-800/50 rounded-full flex items-center justify-center">
                    <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{invite.email}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      {invite.tenantAssignments?.[0] && ` · ${invite.tenantAssignments[0].tenantName} (${invite.tenantAssignments[0].role})`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleResendInvite(invite.id)}
                  disabled={resending === invite.id}
                  className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 rounded-md transition-colors disabled:opacity-50"
                >
                  {resending === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resend'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#00965c]" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Team Members <span className="text-gray-400 font-normal text-sm ml-1">({members.length})</span>
            </h2>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No team members yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Invite your first team member to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {filteredMembers.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">{member.fullName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{member.fullName}</p>
                      {member.isOwner && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold rounded-full">
                          <Crown className="w-2.5 h-2.5" />
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-wrap gap-1">
                    {member.sites.slice(0, 2).map((site) => (
                      <span key={site.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-md">
                        <Building2 className="w-3 h-3" />
                        {site.name}
                      </span>
                    ))}
                    {member.sites.length > 2 && (
                      <span className="text-xs text-gray-400 px-1">+{member.sites.length - 2}</span>
                    )}
                  </div>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#00FF88]/15 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-4.5 h-4.5 text-[#00965c]" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Invite Team Member</h2>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {inviteSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#00FF88] mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 dark:text-white">Invitation sent!</p>
                  <p className="text-sm text-gray-500 mt-1">They&apos;ll receive an email with instructions.</p>
                </div>
              ) : (
                <>
                  {inviteError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                      {inviteError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                        placeholder="colleague@example.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00FF88]/40 focus:border-[#00FF88]"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Company
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00FF88]/40 appearance-none"
                      >
                        {companies.length === 0 ? (
                          <option value="">No companies available</option>
                        ) : (
                          companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))
                        )}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00FF88]/40 appearance-none"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 rounded-lg">
                    An invitation email will be sent. They&apos;ll have access to manage this company&apos;s portal with the selected role.
                  </p>
                </>
              )}
            </div>

            {!inviteSuccess && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail || !selectedTenantId || inviting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-[#00FF88] hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
