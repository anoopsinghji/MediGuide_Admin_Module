import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import {
  LayoutDashboard,
  UserCheck,
  Star,
  Wallet,
  ChartColumn,
  
  Building2,
  CalendarDays,
  ClipboardList,
  Shield,
  Loader2,
  CheckCircle2,
  Stethoscope,
  AlertTriangle,
  Activity,
  Clock3,
  ArrowUpRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react'

type AdminUser = {
  _id: string
  name: string
  email: string
  role: 'admin' | 'moderator' | 'doctor' | 'tourist'
}

type SectionKey =
  | 'overview'
  | 'verification'
  | 'reviews'
  | 'pricing'
  | 'analytics'
  | 'clinics'
  | 'appointments'
  | 'audit'

type AdminStats = {
  pendingDoctors: number
  verifiedDoctors: number
  rejectedDoctors: number
  totalReviews: number
  openComplaints: number
  totalAppointments: number
}

type AdminDoctor = {
  _id: string
  name: string
  profileImage?: string
  email: string
  specialty: string
  hospital: string
  city: string
  education: string
  experience: number
  consultationFee: number
  teleconsultationFee: number
  inClinicFee?: number
  videoConsultationFee?: number
  medicalRegistrationNumber: string
  registrationCouncil: string
  emergencyContactNumber: string
  onboardingStatus: 'pending' | 'verified' | 'rejected'
  verificationNotes: string
  verifiedAt?: string
}

type AdminReview = {
  _id: string
  rating: number
  title: string
  comment: string
  isApproved: boolean
  isFlagged: boolean
  patientName: string
  doctorName: string
  createdAt: string
}

type PricingDoctor = {
  _id: string
  name: string
  specialty: string
  city: string
  consultationFee: number
  teleconsultationFee: number
  inClinicFee?: number
  videoConsultationFee?: number
  rate: number
  reviewCount: number
  onboardingStatus: string
}

type AppointmentItem = {
  _id: string
  appointmentDate: string
  time: string
  type: string
  status: string
  consultationFee: number
  patientName: string
  doctorName: string
  doctorSpecialty: string
}

type AnalyticsData = {
  appointmentsByStatus: { _id: string; count: number }[]
  complaintsByCategory: { _id: string; count: number }[]
  doctorsByCity: { _id: string; count: number }[]
  topRatedDoctors: { _id: string; name: string; specialty: string; city: string; rate: number; reviewCount: number }[]
}


type ClinicRow = {
  _id: string
  hospital: string
  city: string
  doctorsCount: number
  verifiedDoctors: number
  avgConsultationFee: number
  status: string
}

type AuditItem = {
  _id: string
  action: string
  entityType: string
  description: string
  adminName: string
  createdAt: string
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'
const AUTH_KEY = 'adm_token_nextgen'
const USER_KEY = 'adm_user_nextgen'
const SIDEBAR_COLLAPSE_KEY = 'adm_sidebar_collapsed'

const sections: { key: SectionKey; label: string; hint: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', hint: 'Live platform pulse', icon: LayoutDashboard },
  { key: 'verification', label: 'Doctor Verification', hint: 'Approval workflow', icon: UserCheck },
  { key: 'reviews', label: 'Review Moderation', hint: 'Quality and trust', icon: Star },
  { key: 'pricing', label: 'Pricing Control', hint: 'Fee governance', icon: Wallet },
  { key: 'analytics', label: 'Analytics', hint: 'Operational trends', icon: ChartColumn },
  { key: 'clinics', label: 'Clinic Onboarding', hint: 'Network expansion', icon: Building2 },
  { key: 'appointments', label: 'Appointments', hint: 'Booking oversight', icon: CalendarDays },
  { key: 'audit', label: 'Audit Log', hint: 'Action history', icon: ClipboardList },
]

type ChartDatum = { name: string; value: number }

function MiniSparkline({ data, stroke }: { data: { value: number }[]; stroke: string }) {
  if (data.length === 0) return null
  const width = 120
  const height = 44
  const min = Math.min(...data.map((d) => d.value))
  const max = Math.max(...data.map((d) => d.value))
  const range = Math.max(max - min, 1)
  const points = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width
      const y = height - ((d.value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SimpleBarList({ data, tone }: { data: ChartDatum[]; tone: 'teal' | 'blue' }) {
  const max = Math.max(...data.map((x) => x.value), 1)
  return (
    <div className="simple-bars">
      {data.map((item) => {
        const width = Math.max(Math.round((item.value / max) * 100), 8)
        return (
          <div className="simple-bar-row" key={item.name}>
            <div className="simple-bar-head">
              <span>{item.name}</span>
              <strong>{item.value}</strong>
            </div>
            <div className="simple-bar-track">
              <div className={`simple-bar-fill ${tone}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// SimpleDonut removed (unused after analytics/complaints removal)

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_KEY))
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1')
  const [active, setActive] = useState<SectionKey>('overview')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [pendingDoctors, setPendingDoctors] = useState<AdminDoctor[]>([])
  const [allDoctors, setAllDoctors] = useState<AdminDoctor[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [pricing, setPricing] = useState<PricingDoctor[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [clinics, setClinics] = useState<ClinicRow[]>([])
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])

  const resolveDoctorImage = (imagePath?: string) => {
    if (!imagePath) return ''
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath
    return `http://localhost:5000${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
  }

  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const callAdmin = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Request failed')
    return data
  }

  const confirmAction = async (title: string, text: string, confirmButtonText = 'Confirm') => {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0d7377',
      reverseButtons: true,
    })

    return result.isConfirmed
  }

  const promptTextInput = async (title: string, label: string, defaultValue: string) => {
    const result = await Swal.fire({
      title,
      input: 'text',
      inputLabel: label,
      inputValue: defaultValue,
      showCancelButton: true,
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0d7377',
    })

    if (!result.isConfirmed) return null

    const value = String(result.value || '').trim()
    return value || defaultValue
  }

  const promptNumericInput = async (title: string, label: string, defaultValue: number) => {
    const result = await Swal.fire({
      title,
      input: 'number',
      inputLabel: label,
      inputValue: String(defaultValue),
      showCancelButton: true,
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0d7377',
      preConfirm: (value) => {
        const parsed = Number(value)
        if (Number.isNaN(parsed) || parsed < 0) {
          Swal.showValidationMessage('Please enter a valid non-negative number')
          return undefined
        }
        return parsed
      },
    })

    if (!result.isConfirmed) return null
    return Number(result.value)
  }

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  const loadOverview = async () => {
    const [statsRes, pendingRes, allRes] = await Promise.all([
      callAdmin('/admin/stats'),
      callAdmin('/admin/doctors/pending'),
      callAdmin('/admin/doctors/all'),
    ])
    setStats(statsRes.stats)
    setPendingDoctors(pendingRes.data || [])
    setAllDoctors(allRes.data || [])
  }

  const loadReviews = async () => {
    const data = await callAdmin('/admin/reviews')
    setReviews(data.data || [])
  }

  const loadPricing = async () => {
    const data = await callAdmin('/admin/pricing')
    setPricing(data.data || [])
  }

  const loadAnalytics = async () => {
    const data = await callAdmin('/admin/analytics')
    setAnalytics(data.data || null)
  }

  const loadClinics = async () => {
    const data = await callAdmin('/admin/clinics')
    setClinics(data.data || [])
  }

  const loadAppointments = async () => {
    const data = await callAdmin('/admin/appointments')
    setAppointments(data.data || [])
  }

  const loadAudit = async () => {
    const data = await callAdmin('/admin/audit')
    setAudit(data.data || [])
  }

  useEffect(() => {
    if (!token) return
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        if (active === 'overview' || active === 'verification') await loadOverview()
        if (active === 'overview') {
          await Promise.all([loadAnalytics(), loadAudit()])
        }
        if (active === 'reviews') await loadReviews()
        if (active === 'pricing') await loadPricing()
        if (active === 'analytics') await loadAnalytics()
        if (active === 'clinics') await loadClinics()
        if (active === 'appointments') await loadAppointments()
        if (active === 'audit') await loadAudit()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch admin data')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [token, active])

  const onLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim()
    const password = (document.getElementById('loginPass') as HTMLInputElement).value

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!data.success) return setError(data.message || 'Login failed')
      if (data.user?.role !== 'admin') return setError('This account does not have admin access')

      localStorage.setItem(AUTH_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setToken(data.token)
      setAdmin(data.user)
      setNotice('Welcome to MediGuide Admin')
    } catch {
      setError('Unable to login. Verify backend is running on port 5000.')
    }
  }

  const logout = () => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setAdmin(null)
    setActive('overview')
  }

  const verifyDoctor = async (doctorId: string) => {
    try {
      const notes = await promptTextInput('Verify Doctor', 'Verification note (optional)', 'Verified by admin')
      if (notes === null) return

      const confirmed = await confirmAction(
        'Confirm Verification',
        'This will mark the doctor as verified and visible to patients.',
        'Verify Doctor'
      )
      if (!confirmed) return

      await callAdmin(`/admin/doctors/${doctorId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      })
      setNotice('Doctor verified successfully')
      await loadOverview()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify doctor')
    }
  }

  const rejectDoctor = async (doctorId: string) => {
    try {
      const notes = await promptTextInput('Reject Doctor', 'Rejection reason', 'Rejected by admin')
      if (notes === null) return

      const confirmed = await confirmAction(
        'Confirm Rejection',
        'This will reject the doctor profile until corrected details are submitted.',
        'Reject Doctor'
      )
      if (!confirmed) return

      await callAdmin(`/admin/doctors/${doctorId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      })
      setNotice('Doctor rejected')
      await loadOverview()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject doctor')
    }
  }

  const approveReview = async (id: string) => {
    try {
      const confirmed = await confirmAction(
        'Approve Review',
        'This review will become visible in public doctor profiles.',
        'Approve'
      )
      if (!confirmed) return

      await callAdmin(`/admin/reviews/${id}/approve`, { method: 'PATCH' })
      setNotice('Review approved')
      await loadReviews()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve review')
    }
  }

  const rejectReview = async (id: string) => {
    try {
      const confirmed = await confirmAction(
        'Reject Review',
        'This review will be removed from public visibility.',
        'Reject'
      )
      if (!confirmed) return

      await callAdmin(`/admin/reviews/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason: 'Rejected by admin' }) })
      setNotice('Review rejected')
      await loadReviews()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject review')
    }
  }

  const updatePricing = async (doctor: PricingDoctor) => {
    try {
      const fee = await promptNumericInput(
        'Update Pricing',
        `New in-clinic fee for ${doctor.name}`,
        Number(doctor.inClinicFee ?? doctor.consultationFee)
      )
      if (fee === null) return

      const confirmed = await confirmAction(
        'Confirm Pricing Update',
        `Set in-clinic fee to ₹${fee} for ${doctor.name}?`,
        'Update Fee'
      )
      if (!confirmed) return

      await callAdmin(`/admin/pricing/${doctor._id}`, { method: 'PATCH', body: JSON.stringify({ consultationFee: fee }) })
      setNotice('Pricing updated')
      await loadPricing()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update pricing')
    }
  }

  // Complaint management removed from admin UI; backend endpoints remain available.

  const updateAppointmentStatus = async (id: string, status: string) => {
    try {
      const confirmed = await confirmAction(
        'Update Appointment Status',
        `Set appointment status to "${status}"?`,
        'Update Status'
      )
      if (!confirmed) return

      await callAdmin(`/admin/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setNotice('Appointment status updated')
      await loadAppointments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update appointment status')
    }
  }

  const verifiedDoctors = allDoctors.filter((d) => d.onboardingStatus === 'verified')
  const rejectedDoctors = allDoctors.filter((d) => d.onboardingStatus === 'rejected')
  const overviewUpdatedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const overviewMetrics = [
    {
      label: 'Pending doctors',
      value: stats?.pendingDoctors || 0,
      icon: Loader2,
      tone: 'teal',
      note: 'Waiting for verification',
    },
    {
      label: 'Verified doctors',
      value: stats?.verifiedDoctors || 0,
      icon: CheckCircle2,
      tone: 'green',
      note: 'Live and visible to patients',
    },
    {
      label: 'Rejected doctors',
      value: stats?.rejectedDoctors || 0,
      icon: AlertTriangle,
      tone: 'orange',
      note: 'Needs resubmission or review',
    },
    // Complaints metric removed from overview
    {
      label: 'Total reviews',
      value: stats?.totalReviews || 0,
      icon: Star,
      tone: 'blue',
      note: 'Moderation and reputation flow',
    },
    {
      label: 'Appointments',
      value: stats?.totalAppointments || 0,
      icon: CalendarDays,
      tone: 'violet',
      note: 'Across patient and doctor portals',
    },
  ]

  const verifiedRate = allDoctors.length ? Math.round((verifiedDoctors.length / allDoctors.length) * 100) : 0
  const topCities = (analytics?.doctorsByCity || []).slice(0, 4)
  const latestAudit = audit.slice(0, 5)
  const urgentFraudItems: any[] = []
  const appointmentChartData = (analytics?.appointmentsByStatus || []).map((item) => ({
    name: item._id,
    value: item.count,
  }))
  const cityChartData = (analytics?.doctorsByCity || []).map((item) => ({
    name: item._id,
    value: item.count,
  }))

  // chartPalette removed (unused after complaints/analytics UI changes)
  const metricStroke = (tone: string) => {
    switch (tone) {
      case 'green':
        return '#16a34a'
      case 'orange':
        return '#ea580c'
      case 'red':
        return '#dc2626'
      case 'blue':
        return '#2563eb'
      case 'violet':
        return '#7c3aed'
      default:
        return '#0d7377'
    }
  }

  const clampAtZero = (value: number) => Math.max(0, value)

  const metricSparkline = (value: number, offsets: number[], direction: 'up' | 'down' = 'up') => {
    const series = offsets.map((offset, index) => {
      const point = direction === 'up' ? value - offset + index : value + offset - index
      return { value: clampAtZero(point) }
    })
    return series
  }

  const overviewMetricSeries = [
    metricSparkline(stats?.pendingDoctors || 0, [3, 2, 1, 0], 'down'),
    metricSparkline(stats?.verifiedDoctors || 0, [4, 2, 1, 0], 'up'),
    metricSparkline(stats?.rejectedDoctors || 0, [2, 1, 0, 1], 'down'),
    metricSparkline(stats?.totalReviews || 0, [6, 4, 2, 0], 'up'),
    metricSparkline(stats?.totalAppointments || 0, [8, 5, 2, 0], 'up'),
  ]

  if (!token || !admin) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <span>⚙️</span> MediGuide Admin
          </div>
          <h2>Secure Admin Login</h2>
          <p className="login-sub">Platform governance and moderation portal</p>
          {!!error && <div className="form-error">{error}</div>}
          <form onSubmit={onLogin}>
            <div className="form-group">
              <label>Email</label>
              <input id="loginEmail" type="email" placeholder="admin@mediaguide.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input id="loginPass" type="password" placeholder="********" />
            </div>
            <button className="btn btn-primary btn-full btn-lg" type="submit">
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={`dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-main">
            <span>⚙️</span>
            <span className="logo-text">MediGuide</span>
          </div>
          <span className="admin-tag">Admin</span>
        </div>
        <div className="admin-profile">
          <div className="admin-avatar"><Shield className="w-5 h-5" /></div>
          <div>
            <div className="admin-name">{admin.name}</div>
            <div className="admin-role">{admin.role}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map((s) => (
            <button key={s.key} className={`nav-item ${active === s.key ? 'active' : ''}`} onClick={() => setActive(s.key)} aria-label={s.label} data-tooltip={s.label}>
              <span className="nav-icon-wrap"><s.icon className="w-4 h-4" /></span>
              <span className="nav-copy">
                <span className="nav-title">{s.label}</span>
                <span className="nav-hint">{s.hint}</span>
              </span>
              {s.key === 'verification' && (stats?.pendingDoctors || 0) > 0 ? <span className="nav-badge">{stats?.pendingDoctors}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={logout}>
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className="sidebar-toggle-btn"
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            </button>
            {sidebarCollapsed && (
              <div 
                className="topbar-logo-collapsed" 
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 800, fontSize: '1.2rem' }}
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
              >
                <span style={{ marginRight: '8px', fontSize: '1.4rem' }}></span>
                <span style={{ background: 'linear-gradient(135deg, #14a3a8, #0a2020)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  MediGuide
                </span>
              </div>
            )}
          </div>
          <div className="topbar-title" style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>
            {sections.find((x) => x.key === active)?.label}
          </div>
          <div className="topbar-right">
            <div className="topbar-date">{new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </header>

        {!!notice && <div className="toast">{notice}</div>}
        {!!error && <div className="banner-error">{error}</div>}
        {loading ? <div className="loading-state">Loading...</div> : null}

        {active === 'overview' ? (
          <section className="section active overview-shell">
            <div className="overview-hero">
              <div>
                <div className="overview-eyebrow">Admin Operations Center</div>
                <h1>Platform Overview</h1>
                <p>Live governance view for verification, appointments, and risk signals across MediGuide.</p>
              </div>
              <div className="overview-hero-meta">
                <div className="overview-pill">
                  <Clock3 className="w-4 h-4" /> Last synced {overviewUpdatedAt}
                </div>
                <div className="overview-pill overview-pill-success">
                  <Activity className="w-4 h-4" /> System healthy
                </div>
              </div>
            </div>

            <div className="stats-row stats-row-6">
              {overviewMetrics.map((metric, index) => {
                const Icon = metric.icon
                const series = overviewMetricSeries[index] || []
                return (
                  <div className="metric-card" key={metric.label}>
                    <div className="metric-main">
                      <div className={`metric-icon ${metric.tone}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="metric-copy">
                        <div className="stat-val">{metric.value}</div>
                        <div className="stat-lbl">{metric.label}</div>
                        <div className="metric-note">{metric.note}</div>
                      </div>
                    </div>
                    <div className="metric-trend">
                      <MiniSparkline data={series} stroke={metricStroke(metric.tone)} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="overview-grid">
              <div className="overview-main">
                <div className="overview-panel overview-queue-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Verification queue</h3>
                      <p>Fastest route to reducing onboarding backlog</p>
                    </div>
                    <div className="panel-head-chip">{pendingDoctors.length} pending</div>
                  </div>

                  <div className="queue-list">
                    {pendingDoctors.length === 0 ? (
                      <div className="loading-state">No pending doctor profiles.</div>
                    ) : (
                      pendingDoctors.slice(0, 5).map((doc) => (
                        <div className="queue-item" key={doc._id}>
                          <div className="item-avatar">
                            {doc.profileImage ? (
                              <img src={resolveDoctorImage(doc.profileImage)} alt={doc.name} className="item-avatar-img" />
                            ) : (
                              <Stethoscope className="w-5 h-5" />
                            )}
                          </div>
                          <div className="item-body">
                            <div className="item-name">{doc.name}</div>
                            <div className="item-meta">
                              <span>{doc.specialty}</span>
                              <span>{doc.hospital}</span>
                              <span>{doc.city}</span>
                            </div>
                            <div className="queue-subline">{doc.education || 'Credential details available in verification section'}</div>
                          </div>
                          <div className="queue-action">
                            <button className="btn btn-success btn-sm" onClick={() => void verifyDoctor(doc._id)}>Verify</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="overview-dual">
                  <div className="overview-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Trend snapshot</h3>
                        <p>Operational signals from shared backend datasets</p>
                      </div>
                    </div>

                    <div className="chart-box">
                      {appointmentChartData.length === 0 ? (
                        <div className="loading-state">No trend data loaded.</div>
                      ) : (
                        <SimpleBarList data={appointmentChartData} tone="teal" />
                      )}
                    </div>

                    <div className="mini-chart-grid">
                      {/* Complaints mini-chart removed */}

                      <div className="mini-chart-card">
                        <div className="mini-chart-head">Doctors by city</div>
                        <div className="chart-box chart-box-sm">
                          {cityChartData.length === 0 ? (
                            <div className="loading-state">No city data.</div>
                          ) : (
                            <SimpleBarList data={cityChartData} tone="blue" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overview-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Recent activity</h3>
                        <p>Operational transparency for all admin actions</p>
                      </div>
                    </div>
                    <div className="activity-list">
                      {latestAudit.length === 0 ? (
                        <div className="loading-state">No audit entries yet.</div>
                      ) : latestAudit.map((log) => (
                        <div className="activity-item" key={log._id}>
                          <div className="activity-dot"><ArrowUpRight className="w-3.5 h-3.5" /></div>
                          <div>
                            <div className="activity-title">{log.action}</div>
                            <div className="activity-meta">{log.adminName} • {log.entityType} • {new Date(log.createdAt).toLocaleString('en-IN')}</div>
                            <div className="activity-desc">{log.description || 'No description provided'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overview-side">
                <div className="overview-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Urgent attention</h3>
                      <p>Items requiring immediate admin follow-up</p>
                    </div>
                  </div>
                  <div className="urgent-list">
                    {urgentFraudItems.length === 0 ? (
                      <div className="loading-state">No urgent items.</div>
                    ) : null}
                    {urgentFraudItems.map((item) => (
                      <div className="urgent-item" key={item._id}>
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <div>
                          <div className="urgent-title">{item.name}</div>
                          <div className="urgent-desc">{item.specialty} • {item.city}</div>
                          <div className="urgent-note">{item.flagReason || 'Flagged for review'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overview-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Top rated doctors</h3>
                      <p>High performing doctors visible to patients</p>
                    </div>
                  </div>
                  <div className="mini-list">
                    {(analytics?.topRatedDoctors || []).slice(0, 5).map((doc) => (
                      <div className="mini-item" key={doc._id}>
                        <div>
                          <div className="item-name">{doc.name}</div>
                          <div className="item-meta"><span>{doc.specialty}</span><span>{doc.city}</span></div>
                        </div>
                        <div className="mini-score">
                          <Star className="w-4 h-4" /> {doc.rate.toFixed(1)}
                        </div>
                      </div>
                    ))}
                    {(analytics?.topRatedDoctors || []).length === 0 ? <div className="loading-state">No rating data yet.</div> : null}
                  </div>
                </div>

                <div className="overview-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Verified coverage</h3>
                      <p>{verifiedRate}% of doctor network is verified</p>
                    </div>
                  </div>
                  <div className="coverage-ring">
                    <div className="coverage-value">{verifiedRate}%</div>
                    <div className="coverage-caption">Verification rate across all onboarded doctors</div>
                  </div>
                  <div className="mini-list">
                    {topCities.length === 0 ? <div className="loading-state">No city distribution loaded.</div> : topCities.map((city) => (
                      <div className="mini-item" key={city._id}>
                        <div className="mini-item-left">
                          <Building2 className="w-4 h-4" />
                          <span>{city._id}</span>
                        </div>
                        <div className="mini-score">{city.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {active === 'verification' ? (
          <section className="section active">
            <div className="section-header"><h1>Doctor Verification</h1><p>Approve or reject newly onboarded doctors</p></div>
            {pendingDoctors.length === 0 ? <div className="loading-state">No pending doctors.</div> : pendingDoctors.map((doc) => (
              <div className="item-card" key={doc._id}>
                <div className="item-avatar">
                  {doc.profileImage ? (
                    <img src={resolveDoctorImage(doc.profileImage)} alt={doc.name} className="item-avatar-img" />
                  ) : (
                    <Stethoscope className="w-5 h-5" />
                  )}
                </div>
                <div className="item-body">
                  <div className="item-name">{doc.name}</div>
                  <div className="item-meta"><span>{doc.email}</span><span>{doc.specialty}</span><span>{doc.city}</span></div>
                  <div className="detail-grid">
                    <div><strong>Reg No:</strong> {doc.medicalRegistrationNumber || '-'}</div>
                    <div><strong>Council:</strong> {doc.registrationCouncil || '-'}</div>
                    <div><strong>Education:</strong> {doc.education || '-'}</div>
                    <div><strong>Experience:</strong> {doc.experience} years</div>
                    <div><strong>In-Clinic Fee:</strong> INR {doc.inClinicFee ?? doc.consultationFee}</div>
                    <div><strong>Video Consultation Fee:</strong> INR {(doc.videoConsultationFee ?? doc.teleconsultationFee) || 0}</div>
                    <div><strong>Emergency:</strong> {doc.emergencyContactNumber || '-'}</div>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="btn btn-success btn-sm" onClick={() => void verifyDoctor(doc._id)}>Verify</button>
                  <button className="btn btn-danger btn-sm" onClick={() => void rejectDoctor(doc._id)}>Reject</button>
                </div>
              </div>
            ))}

            <div className="dash-card" style={{ marginTop: 16 }}>
              <div className="dash-card-header"><h3>Verified Doctors</h3></div>
              {verifiedDoctors.map((doc) => <div key={doc._id} className="item-meta"><span>{doc.name}</span><span>{doc.specialty}</span><span>{doc.city}</span></div>)}
              {verifiedDoctors.length === 0 ? <div className="loading-state">No verified doctors yet.</div> : null}
            </div>

            <div className="dash-card" style={{ marginTop: 16 }}>
              <div className="dash-card-header"><h3>Rejected Doctors</h3></div>
              {rejectedDoctors.map((doc) => <div key={doc._id} className="item-meta"><span>{doc.name}</span><span>{doc.verificationNotes || 'Rejected by admin'}</span></div>)}
              {rejectedDoctors.length === 0 ? <div className="loading-state">No rejected doctors.</div> : null}
            </div>
          </section>
        ) : null}

        {active === 'reviews' ? (
          <section className="section active">
            <div className="section-header"><h1>Review Moderation</h1><p>Approve or reject patient reviews</p></div>
            {reviews.length === 0 ? <div className="loading-state">No reviews found.</div> : reviews.map((review) => (
              <div className="item-card" key={review._id}>
                <div className="item-avatar"><Star className="w-5 h-5" /></div>
                <div className="item-body">
                  <div className="item-name">{review.patientName} to {review.doctorName}</div>
                  <div className="item-meta"><span>Rating: {review.rating}/5</span><span>{new Date(review.createdAt).toLocaleDateString('en-IN')}</span><span>{review.isApproved ? 'Approved' : 'Pending'}</span><span>{review.isFlagged ? 'Flagged' : 'Clean'}</span></div>
                  <div>{review.title || review.comment || 'No review text'}</div>
                </div>
                <div className="item-actions">
                  <button className="btn btn-success btn-sm" onClick={() => void approveReview(review._id)}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => void rejectReview(review._id)}>Reject</button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {active === 'pricing' ? (
          <section className="section active">
            <div className="section-header"><h1>Pricing Control</h1><p>Adjust in-clinic and video consultation fees</p></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Doctor</th><th>Specialty</th><th>City</th><th>In-Clinic Fee</th><th>Video Consultation Fee</th><th>Rating</th><th>Action</th></tr></thead>
                <tbody>
                  {pricing.map((doctor) => (
                    <tr key={doctor._id}>
                      <td>{doctor.name}</td><td>{doctor.specialty}</td><td>{doctor.city}</td><td>INR {doctor.inClinicFee ?? doctor.consultationFee}</td><td>INR {(doctor.videoConsultationFee ?? doctor.teleconsultationFee) || 0}</td><td>{doctor.rate.toFixed(1)} ({doctor.reviewCount})</td>
                      <td><button className="btn btn-outline btn-sm" onClick={() => void updatePricing(doctor)}>Update</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Complaints section removed */}

        {active === 'analytics' ? (
          <section className="section active">
            <div className="section-header"><h1>Analytics</h1><p>Cross-module metrics and performance snapshots</p></div>
            <div className="dash-card">
              <div className="dash-card-header"><h3>Appointments by Status</h3></div>
              {(analytics?.appointmentsByStatus || []).map((x) => <div className="item-meta" key={x._id}><span>{x._id}</span><span>{x.count}</span></div>)}
            </div>
            {/* Complaints by Category removed from analytics */}
            <div className="dash-card" style={{ marginTop: 16 }}>
              <div className="dash-card-header"><h3>Top Rated Doctors</h3></div>
              {(analytics?.topRatedDoctors || []).map((x) => <div className="item-meta" key={x._id}><span>{x.name}</span><span>{x.specialty}</span><span>{x.city}</span><span>{x.rate.toFixed(1)} ({x.reviewCount})</span></div>)}
            </div>
          </section>
        ) : null}

        {/* Fraud Detection section removed */}

        {/* Helpline section removed */}

        {active === 'clinics' ? (
          <section className="section active">
            <div className="section-header"><h1>Clinic Onboarding</h1><p>Hospital clusters auto-generated from doctor network</p></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Clinic</th><th>City</th><th>Doctors</th><th>Verified</th><th>Avg Fee</th><th>Status</th></tr></thead>
                <tbody>
                  {clinics.map((clinic) => (
                    <tr key={clinic._id}><td>{clinic.hospital}</td><td>{clinic.city}</td><td>{clinic.doctorsCount}</td><td>{clinic.verifiedDoctors}</td><td>INR {clinic.avgConsultationFee}</td><td>{clinic.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {active === 'appointments' ? (
          <section className="section active">
            <div className="section-header"><h1>Appointments</h1><p>Cross-platform booking oversight</p></div>
            {appointments.length === 0 ? <div className="loading-state">No appointments found.</div> : appointments.map((a) => (
              <div className="item-card" key={a._id}>
                <div className="item-avatar"><CalendarDays className="w-5 h-5" /></div>
                <div className="item-body">
                  <div className="item-name">{a.patientName} with {a.doctorName}</div>
                  <div className="item-meta"><span>{new Date(a.appointmentDate).toLocaleDateString('en-IN')}</span><span>{a.time}</span><span>{a.type}</span><span>{a.status}</span><span>INR {a.consultationFee}</span></div>
                </div>
                <div className="item-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => void updateAppointmentStatus(a._id, 'confirmed')}>Confirm</button>
                  <button className="btn btn-success btn-sm" onClick={() => void updateAppointmentStatus(a._id, 'completed')}>Complete</button>
                  <button className="btn btn-danger btn-sm" onClick={() => void updateAppointmentStatus(a._id, 'cancelled')}>Cancel</button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {active === 'audit' ? (
          <section className="section active">
            <div className="section-header"><h1>Audit Log</h1><p>All admin actions are recorded for accountability</p></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead>
                <tbody>
                  {audit.map((log) => (
                    <tr key={log._id}>
                      <td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                      <td>{log.adminName}</td>
                      <td>{log.action}</td>
                      <td>{log.entityType}</td>
                      <td>{log.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
