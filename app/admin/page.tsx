"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface User {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Pro" | "Plus";
  messages_used_today: number;
  total_messages: number;
  days_active: number;
  active_days: number;
  created_at: string;
  last_active?: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  original_name: string | null;
}

interface Stats {
  totalUsers: number;
  planCounts: {
    Free: number;
    Pro: number;
    Plus: number;
  };
  activeSubscriptions: number;
  totalMessagesToday: number;
  signupsToday: number;
  signupsThisWeek: number;
  signupsThisMonth: number;
  avgMessagesPerUser: number;
  totalMessages: number;
  deletedMessages: number;
  allTimeMessages: number;
}

interface TrendData {
  label: string;
  count: number;
  cumulative: number;
}

interface AvgTrendData {
  label: string;
  avg: number;
}

interface TopUser {
  id: string;
  name: string;
  email: string;
  messageCount: number;
}

interface MessageDistribution {
  bucket: string;
  count: number;
}

interface PeriodStats {
  signups: number;
  messages: number;
  avgMessagesPerUser: number;
}

type Period = "day" | "week" | "month" | "year";

const USERS_PER_PAGE = 15;

// --- Donut Chart Component (SVG) ---
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>No data</div>;

  const size = 160;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOffset = -offset;
          offset += dashLen;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          );
        })}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill="#f0ede8" fontSize="22" fontWeight="700">{total}</text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="500">USERS</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ color: '#9ca3af' }}>{seg.label}</span>
            <span style={{ color: '#f0ede8', fontWeight: 600, marginLeft: 'auto', paddingLeft: '8px' }}>{seg.value}</span>
            <span style={{ color: '#6b7280', fontSize: '11px', width: '36px', textAlign: 'right' }}>
              {total > 0 ? (seg.value / total * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Custom Tooltip for recharts dark mode ---
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      <div style={{ color: '#9ca3af', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Chart data
  const [userTrend, setUserTrend] = useState<TrendData[]>([]);
  const [messageTrend, setMessageTrend] = useState<TrendData[]>([]);
  const [avgTrend, setAvgTrend] = useState<AvgTrendData[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [messageDistribution, setMessageDistribution] = useState<MessageDistribution[]>([]);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [chartPeriod, setChartPeriod] = useState<Period>("month");
  const [chartLoading, setChartLoading] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<'total_messages' | 'days_active' | 'active_days' | 'created_at' | 'avg_msgs_day' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
      fetchChartData(chartPeriod);
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchChartData(chartPeriod);
    }
  }, [chartPeriod]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
      ]);

      if (!usersRes.ok || !statsRes.ok) {
        if (usersRes.status === 401 || statsRes.status === 401) {
          setError("You don't have admin access");
          return;
        }
        throw new Error("Failed to fetch data");
      }

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      setUsers(usersData.users || []);
      setStats(statsData.stats || null);
    } catch (err) {
      setError("Failed to load admin data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async (period: Period) => {
    setChartLoading(true);
    try {
      const res = await fetch(`/api/admin/history?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setUserTrend(data.userTrend || []);
        setMessageTrend(data.messageTrend || []);
        setAvgTrend(data.avgTrend || []);
        setTopUsers(data.topUsers || []);
        setMessageDistribution(data.messageDistribution || []);
        setPeriodStats(data.periodStats || null);
      }
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    } finally {
      setChartLoading(false);
    }
  };

  const updatePlan = async (userId: string, newPlan: string) => {
    setUpdatingUser(userId);
    try {
      const res = await fetch("/api/admin/users/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan: newPlan }),
      });

      if (!res.ok) throw new Error("Failed to update plan");

      setUsers(users.map(u =>
        u.id === userId ? { ...u, plan: newPlan as "Free" | "Pro" | "Plus" } : u
      ));
    } catch (err) {
      alert("Failed to update plan");
      console.error(err);
    } finally {
      setUpdatingUser(null);
    }
  };

  const getAvgMsgsDay = (user: User) => {
    const days = user.active_days || 1;
    return (user.total_messages || 0) / days;
  };

  // --- Computed metrics ---
  const computed = useMemo(() => {
    if (!stats || users.length === 0) return null;
    const ghosts = users.filter(u => (u.total_messages || 0) === 0);
    const paidUsers = users.filter(u => u.plan !== 'Free');
    const freeActive = users.filter(u => u.plan === 'Free' && (u.total_messages || 0) >= 1 && (u.total_messages || 0) <= 10);
    const freePower = users.filter(u => u.plan === 'Free' && (u.total_messages || 0) > 10);
    // Keep these for funnel/health metrics (all users regardless of plan)
    const activeUsers = users.filter(u => (u.total_messages || 0) >= 1 && (u.total_messages || 0) <= 10);
    const powerUsers = users.filter(u => (u.total_messages || 0) > 10);

    const ghostRate = users.length > 0 ? ghosts.length / users.length : 0;
    const mrr = stats.planCounts.Pro * 4.99 + stats.planCounts.Plus * 9.99;

    const withMessages = users.filter(u => (u.total_messages || 0) > 0);
    const avgSessionDepth = withMessages.length > 0
      ? withMessages.reduce((s, u) => s + (u.total_messages || 0), 0) / withMessages.length
      : 0;

    const retentionRate = users.length > 0 ? withMessages.length / users.length : 0;

    // Funnel
    const signupCount = users.length;
    const oneMsg = users.filter(u => (u.total_messages || 0) >= 1).length;
    const tenMsg = users.filter(u => (u.total_messages || 0) >= 10).length;
    const paidCount = paidUsers.length;

    // Revenue targets
    const targetMRR = 100;
    const targetUsers = 500;

    return {
      ghostRate,
      mrr,
      avgSessionDepth,
      retentionRate,
      ghosts: ghosts.length,
      activeCount: activeUsers.length,
      powerCount: powerUsers.length,
      paidCount: paidUsers.length,
      freeActiveCount: freeActive.length,
      freePowerCount: freePower.length,
      funnel: { signupCount, oneMsg, tenMsg, paidCount },
      targetMRR,
      targetUsers,
    };
  }, [users, stats]);

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedUsers = sortField ? [...filteredUsers].sort((a, b) => {
    let aVal: number, bVal: number;
    if (sortField === 'created_at') {
      aVal = new Date(a.created_at).getTime();
      bVal = new Date(b.created_at).getTime();
    } else if (sortField === 'avg_msgs_day') {
      aVal = getAvgMsgsDay(a);
      bVal = getAvgMsgsDay(b);
    } else {
      aVal = (a as unknown as Record<string, number>)[sortField] || 0;
      bVal = (b as unknown as Record<string, number>)[sortField] || 0;
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  }) : filteredUsers;

  const toggleSort = (field: 'total_messages' | 'days_active' | 'active_days' | 'created_at' | 'avg_msgs_day') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const exportCSV = () => {
    const headers = ["Name", "Email", "Plan", "Status", "Total Messages", "Days Since Joined", "Days Active", "Joined", "Avg Msgs/Day"];
    const rows = sortedUsers.map(u => [
      u.name || "",
      u.email || "",
      u.plan,
      (u.total_messages || 0) > 0 ? "Active" : "Inactive",
      u.total_messages || 0,
      u.days_active || 0,
      u.active_days || 0,
      new Date(u.created_at).toLocaleDateString(),
      getAvgMsgsDay(u).toFixed(1),
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Loading / Error states ---
  if (status === "loading" || loading) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: '15px', gap: '12px' }}>
          <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #E8A04C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading admin dashboard...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
          <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600 }}>{error}</div>
          <button onClick={() => router.push("/")} style={S.btnSecondary}>Back to app</button>
        </div>
      </div>
    );
  }

  const topUserMax = topUsers.length > 0 ? topUsers[0].messageCount : 1;
  const distMax = messageDistribution.length > 0 ? Math.max(...messageDistribution.map(d => d.count)) : 1;

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* ========= HEADER ========= */}
        <header style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="logoGrad" x1="30%" y1="0%" x2="70%" y2="100%">
                  <stop offset="0%" stopColor="#E8A04C" />
                  <stop offset="100%" stopColor="#E8624C" />
                </linearGradient>
              </defs>
              <path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="url(#logoGrad)" />
            </svg>
            <div>
              <h1 style={S.headerTitle}>Admin Dashboard</h1>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>So-UnFiltered AI</span>
            </div>
            <span style={S.liveBadge}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Live
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={async () => {
                if (!confirm('Force logout ALL users? They will need to sign in again.')) return;
                try {
                  const res = await fetch('/api/admin/force-logout', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) alert('Done! All users will be logged out.');
                  else alert('Failed: ' + (data.error || 'Unknown error'));
                } catch { alert('Failed to force logout users'); }
              }}
              style={S.btnDanger}
            >
              Force Logout All
            </button>
            <button onClick={() => router.push("/")} style={S.btnSecondary}>
              Back to app
            </button>
          </div>
        </header>

        {/* ========= HERO STATS ========= */}
        {stats && (
          <div style={S.statsGrid}>
            {/* Row 1 */}
            <StatCard label="Total Users" value={stats.totalUsers} sub="all-time signups" icon="👥" accent="#3b82f6" />
            <StatCard
              label="Total Messages"
              value={stats.allTimeMessages.toLocaleString()}
              icon="💬"
              accent="#8b5cf6"
              sub={stats.deletedMessages > 0 ? `${stats.totalMessages.toLocaleString()} active · ${stats.deletedMessages.toLocaleString()} deleted` : 'all-time'}
            />
            <StatCard label="Messages Today" value={stats.totalMessagesToday} sub="user messages sent today" icon="📨" accent="#f59e0b" />
            <StatCard
              label="Msgs/Active User"
              value={computed?.avgSessionDepth.toFixed(1) || '0'}
              icon="🎯"
              accent="#8b5cf6"
              sub="avg for users with 1+ msg"
            />
            <StatCard label="Active Subs" value={stats.activeSubscriptions} sub="paid subscriptions" icon="💳" accent="#ec4899" />
            <StatCard
              label="MRR"
              value={`$${computed?.mrr.toFixed(2) || '0.00'}`}
              icon="💰"
              accent="#E8A04C"
              sub="monthly recurring revenue"
            />
            {/* Row 2 */}
            <StatCard
              label="Msgs/User"
              value={stats.avgMessagesPerUser.toFixed(1)}
              icon="📊"
              accent="#3b82f6"
              sub="all-time incl. ghosts"
            />
            <StatCard
              label="Msgs/Active Day"
              value={users.length > 0 ? (users.reduce((sum, u) => sum + getAvgMsgsDay(u), 0) / users.length).toFixed(1) : '0'}
              icon="📅"
              accent="#10b981"
              sub="avg msgs per active day"
            />
            <StatCard label="Free Users" value={stats.planCounts.Free} icon="🆓" accent="#6b7280" sub={`$0/mo`} />
            <StatCard label="Pro Users" value={stats.planCounts.Pro} icon="⚡" accent="#3b82f6" sub={`$4.99/mo each`} />
            <StatCard label="Plus Users" value={stats.planCounts.Plus} icon="💎" accent="#a855f7" sub={`$9.99/mo each`} />
          </div>
        )}

        {/* ========= CONVERSION FUNNEL ========= */}
        {computed && (
          <div style={S.card}>
            <h2 style={S.sectionTitle}>Conversion Funnel</h2>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              {[
                { label: 'Signed Up', value: computed.funnel.signupCount, color: '#3b82f6' },
                { label: '1+ Messages', value: computed.funnel.oneMsg, color: '#8b5cf6' },
                { label: '10+ Messages', value: computed.funnel.tenMsg, color: '#f59e0b' },
                { label: 'Paid', value: computed.funnel.paidCount, color: '#22c55e' },
              ].map((step, i, arr) => {
                const pct = computed.funnel.signupCount > 0 ? (step.value / computed.funnel.signupCount * 100) : 0;
                const dropoff = i > 0 && arr[i - 1].value > 0
                  ? ((arr[i - 1].value - step.value) / arr[i - 1].value * 100).toFixed(0)
                  : null;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {i > 0 && (
                      <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '16px' }}>→</div>
                    )}
                    <div style={{
                      background: `${step.color}15`,
                      border: `1px solid ${step.color}40`,
                      borderRadius: '12px',
                      padding: '16px 12px',
                      textAlign: 'center',
                      width: '100%',
                      margin: '0 6px',
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: step.color }}>{step.value}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', fontWeight: 500 }}>{step.label}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{pct.toFixed(0)}% of total</div>
                    </div>
                    {dropoff && (
                      <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '6px', fontWeight: 500 }}>-{dropoff}% drop</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Health metrics moved to hero stats grid above */}

        {/* ========= TREND CHARTS ========= */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={S.sectionTitle}>Trends</h2>
            <div style={S.periodFilter}>
              {(["day", "week", "month", "year"] as Period[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  style={{
                    ...S.periodBtn,
                    ...(chartPeriod === period ? S.periodBtnActive : {}),
                  }}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Cumulative Growth */}
            <div style={S.chartInner}>
              <div style={S.chartHeader}>
                <h3 style={S.chartTitle}>Cumulative Growth</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ ...S.chartBadge, color: '#60a5fa' }}>
                    {userTrend.length > 0 ? userTrend[userTrend.length - 1]?.cumulative || 0 : 0} users
                  </span>
                  <span style={{ ...S.chartBadge, color: '#a78bfa' }}>
                    {messageTrend.length > 0 ? messageTrend[messageTrend.length - 1]?.cumulative || 0 : 0} msgs
                  </span>
                </div>
              </div>
              {chartLoading ? (
                <div style={S.chartLoading}>Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={userTrend.map((u, i) => ({
                      label: u.label,
                      users: u.cumulative,
                      messages: messageTrend[i]?.cumulative || 0
                    }))}
                    margin={{ top: 5, right: 50, bottom: 5, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6b7280" }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#60a5fa" }} width={35} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a78bfa" }} width={40} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area yAxisId="left" type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} fill="url(#gUsers)" name="Users" />
                    <Area yAxisId="right" type="monotone" dataKey="messages" stroke="#8b5cf6" strokeWidth={2} fill="url(#gMessages)" name="Messages" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Signups */}
            <div style={S.chartInner}>
              <div style={S.chartHeader}>
                <h3 style={S.chartTitle}>Signups</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ ...S.chartBadge, color: '#34d399' }}>
                    {userTrend.length > 0 ? userTrend[userTrend.length - 1]?.cumulative || 0 : 0} total
                  </span>
                  <span style={{ ...S.chartBadge, color: '#6b7280' }}>
                    {userTrend.reduce((sum, d) => sum + d.count, 0)} in period
                  </span>
                </div>
              </div>
              {chartLoading ? (
                <div style={S.chartLoading}>Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={userTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6b7280" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6b7280" }} width={30} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area
                      type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2}
                      fill="url(#gSignups)" activeDot={{ r: 4, fill: "#10b981", stroke: "#0c0c0e", strokeWidth: 2 }}
                      name="Signups"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* ========= SECOND ROW: Top 10 / Distribution (2x1) ========= */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Top 10 Users (CSS bar chart) */}
          <div style={S.card}>
            <div style={S.chartHeader}>
              <h3 style={S.chartTitle}>Top 10 Users</h3>
              <span style={{ ...S.chartBadge, color: '#fbbf24' }}>{chartPeriod}</span>
            </div>
            {chartLoading ? <div style={S.chartLoading}>Loading...</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {topUsers.map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#6b7280', width: '16px', textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        background: `linear-gradient(90deg, rgba(245,158,11,0.25) ${(u.messageCount / topUserMax * 100)}%, transparent ${(u.messageCount / topUserMax * 100)}%)`,
                        borderRadius: '4px', padding: '4px 8px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.email}>{u.name}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>{u.messageCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {topUsers.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No data</div>}
              </div>
            )}
          </div>

          {/* Message Distribution (CSS bar chart) */}
          <div style={S.card}>
            <div style={S.chartHeader}>
              <h3 style={S.chartTitle}>Daily Msg Distribution</h3>
              <span style={{ ...S.chartBadge, color: '#f87171' }}>msgs/day</span>
            </div>
            {chartLoading ? <div style={S.chartLoading}>Loading...</div> : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px', paddingTop: '12px' }}>
                {messageDistribution.map((d) => (
                  <div key={d.bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px', fontWeight: 500 }}>{d.count || ''}</span>
                    <div style={{
                      width: '100%',
                      height: `${distMax > 0 ? Math.max(d.count / distMax * 100, d.count > 0 ? 4 : 0) : 0}%`,
                      background: 'linear-gradient(180deg, #ef4444, #b91c1c)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: d.count > 0 ? '4px' : '0',
                      transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>{d.bucket}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========= THIRD ROW: Donut / Retention & Churn (2x1) ========= */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* User Status Donut */}
          <div style={S.card}>
            <div style={S.chartHeader}>
              <h3 style={S.chartTitle}>User Status</h3>
            </div>
            {computed ? (
              <DonutChart segments={[
                { label: 'Ghost (0 msgs)', value: computed.ghosts, color: '#6b7280' },
                { label: 'Free (1-10)', value: computed.freeActiveCount, color: '#3b82f6' },
                { label: 'Free (11+)', value: computed.freePowerCount, color: '#8b5cf6' },
                { label: 'Paid', value: computed.paidCount, color: '#22c55e' },
              ]} />
            ) : <div style={S.chartLoading}>No data</div>}
          </div>

          {/* Retention & Churn */}
          <div style={S.card}>
            <div style={S.chartHeader}>
              <h3 style={S.chartTitle}>Retention & Churn</h3>
            </div>
            {computed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 0' }}>
                {/* Retention bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>Retention Rate</span>
                    <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 700 }}>{(computed.retentionRate * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: '#1A1A1E', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${computed.retentionRate * 100}%`, height: '100%', background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '6px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{users.filter(u => (u.total_messages || 0) > 0).length} of {users.length} users sent 1+ message</div>
                </div>

                {/* Churn/Ghost bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>Ghost Rate (Churn)</span>
                    <span style={{ fontSize: '13px', color: computed.ghostRate > 0.5 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{(computed.ghostRate * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: '#1A1A1E', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${computed.ghostRate * 100}%`, height: '100%', background: computed.ghostRate > 0.5 ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '6px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{computed.ghosts} users signed up but never messaged</div>
                </div>

                {/* Paid conversion bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>Paid Conversion</span>
                    <span style={{ fontSize: '13px', color: '#a855f7', fontWeight: 700 }}>{users.length > 0 ? ((computed.paidCount / users.length) * 100).toFixed(1) : '0'}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: '#1A1A1E', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${users.length > 0 ? (computed.paidCount / users.length) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #7c3aed)', borderRadius: '6px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{computed.paidCount} of {users.length} users on a paid plan</div>
                </div>
              </div>
            ) : <div style={S.chartLoading}>No data</div>}
          </div>
        </div>

        {/* ========= REVENUE ========= */}
        {computed && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* MRR Card */}
            <div style={S.card}>
              <h3 style={S.chartTitle}>Monthly Recurring Revenue</h3>
              <div style={{ fontSize: '36px', fontWeight: 700, color: '#E8A04C', margin: '12px 0 16px', letterSpacing: '-0.02em' }}>
                ${computed.mrr.toFixed(2)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>Pro ({stats.planCounts.Pro} users × $4.99)</span>
                  <span style={{ color: '#e5e7eb', fontWeight: 600 }}>${(stats.planCounts.Pro * 4.99).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>Plus ({stats.planCounts.Plus} users × $9.99)</span>
                  <span style={{ color: '#e5e7eb', fontWeight: 600 }}>${(stats.planCounts.Plus * 9.99).toFixed(2)}</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>ARR (projected)</span>
                  <span style={{ color: '#e5e7eb', fontWeight: 600 }}>${(computed.mrr * 12).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Growth Targets */}
            <div style={S.card}>
              <h3 style={S.chartTitle}>Growth Targets</h3>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <ProgressTarget
                  label="MRR Target"
                  current={computed.mrr}
                  target={computed.targetMRR}
                  format="currency"
                  color="#E8A04C"
                />
                <ProgressTarget
                  label="User Target"
                  current={stats.totalUsers}
                  target={computed.targetUsers}
                  format="number"
                  color="#3b82f6"
                />
                <ProgressTarget
                  label="Paid Conversion"
                  current={computed.paidCount}
                  target={Math.max(Math.ceil(stats.totalUsers * 0.1), 1)}
                  format="number"
                  color="#22c55e"
                  suffix={` / ${Math.max(Math.ceil(stats.totalUsers * 0.1), 1)} (10% target)`}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========= USER TABLE ========= */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={S.sectionTitle}>Users</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={S.searchInput}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {sortedUsers.length} user{sortedUsers.length !== 1 ? "s" : ""}
              </span>
              <button onClick={exportCSV} style={S.btnAccent}>Export CSV</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>User</th>
                  <th style={S.th}>Plan</th>
                  <th style={S.th}>Status</th>
                  <th style={{ ...S.th, ...S.thSort }} onClick={() => toggleSort('total_messages')}>
                    Messages {sortField === 'total_messages' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ ...S.th, ...S.thSort }} onClick={() => toggleSort('days_active')}>
                    Days Since Joined {sortField === 'days_active' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ ...S.th, ...S.thSort }} onClick={() => toggleSort('active_days')}>
                    Days Active {sortField === 'active_days' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ ...S.th, ...S.thSort }} onClick={() => toggleSort('created_at')}>
                    Joined {sortField === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ ...S.th, ...S.thSort }} onClick={() => toggleSort('avg_msgs_day')}>
                    Avg/Day {sortField === 'avg_msgs_day' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => {
                  const isActive = (user.total_messages || 0) > 0;
                  const isPower = (user.total_messages || 0) > 10;
                  return (
                    <tr key={user.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 500, color: '#f0ede8', fontSize: '13px' }}>{user.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{user.email}</div>
                        {user.original_name && user.original_name !== user.name && (
                          <div style={{ fontSize: '10px', color: '#4b5563', fontStyle: 'italic' }}>
                            Originally: {user.original_name}
                          </div>
                        )}
                      </td>
                      <td style={S.td}>
                        <span style={{
                          ...S.badge,
                          background: user.plan === "Plus" ? 'rgba(139,92,246,0.2)' :
                                     user.plan === "Pro" ? 'rgba(59,130,246,0.2)' : 'rgba(107,114,128,0.2)',
                          color: user.plan === "Plus" ? '#a78bfa' :
                                 user.plan === "Pro" ? '#60a5fa' : '#9ca3af',
                          border: `1px solid ${user.plan === "Plus" ? 'rgba(139,92,246,0.3)' :
                                                user.plan === "Pro" ? 'rgba(59,130,246,0.3)' : 'rgba(107,114,128,0.3)'}`,
                        }}>
                          {user.plan}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          ...S.badge,
                          background: isPower ? 'rgba(139,92,246,0.15)' : isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                          color: isPower ? '#a78bfa' : isActive ? '#4ade80' : '#6b7280',
                          border: `1px solid ${isPower ? 'rgba(139,92,246,0.3)' : isActive ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.2)'}`,
                        }}>
                          {isPower ? 'Power' : isActive ? 'Active' : 'Ghost'}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{user.total_messages || 0}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{user.days_active || 0}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{user.active_days || 0}</td>
                      <td style={{ ...S.td, fontSize: '12px', color: '#9ca3af' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{getAvgMsgsDay(user).toFixed(1)}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <select
                            value={user.plan}
                            onChange={(e) => updatePlan(user.id, e.target.value)}
                            disabled={updatingUser === user.id}
                            style={S.select}
                          >
                            <option value="Free">Free</option>
                            <option value="Pro">Pro</option>
                            <option value="Plus">Plus</option>
                          </select>
                          <button
                            onClick={async () => {
                              if (!confirm(`Force logout ${user.name}?`)) return;
                              try {
                                const res = await fetch('/api/admin/force-logout', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: user.id }),
                                });
                                const data = await res.json();
                                if (data.success) alert(`${user.name} will be logged out.`);
                                else alert('Failed: ' + (data.error || 'Unknown error'));
                              } catch { alert('Failed to force logout user'); }
                            }}
                            style={S.btnDangerSmall}
                          >
                            Logout
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedUsers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '13px' }}>No users found</div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={S.pagination}>
              <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ ...S.pageBtn, ...(currentPage === 1 ? S.pageBtnDisabled : {}) }}>First</button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ ...S.pageBtn, ...(currentPage === 1 ? S.pageBtnDisabled : {}) }}>Prev</button>
              <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>
                {currentPage} / {totalPages}
                <span style={{ color: '#6b7280', marginLeft: '8px', fontWeight: 400 }}>
                  ({startIndex + 1}-{Math.min(endIndex, sortedUsers.length)} of {sortedUsers.length})
                </span>
              </span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ ...S.pageBtn, ...(currentPage === totalPages ? S.pageBtnDisabled : {}) }}>Next</button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ ...S.pageBtn, ...(currentPage === totalPages ? S.pageBtnDisabled : {}) }}>Last</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// --- Sub-components ---
function StatCard({ label, value, icon, accent, sub }: { label: string; value: string | number; icon: string; accent: string; sub?: string }) {
  return (
    <div style={{
      background: '#141416',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '20px', opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#f0ede8', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>{sub}</div>}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accent}, transparent)` }} />
    </div>
  );
}

function MiniCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: '#141416',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

function ProgressTarget({ label, current, target, format, color, suffix }: {
  label: string; current: number; target: number; format: 'currency' | 'number'; color: string; suffix?: string;
}) {
  const pct = Math.min((current / target) * 100, 100);
  const display = format === 'currency' ? `$${current.toFixed(2)}` : current.toString();
  const targetDisplay = format === 'currency' ? `$${target.toFixed(2)}` : target.toString();
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
        <span style={{ color: '#9ca3af' }}>{label}</span>
        <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
          {display} / {targetDisplay}{suffix || ''}
        </span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          borderRadius: '4px',
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>{pct.toFixed(1)}%</div>
    </div>
  );
}

// --- Styles ---
const S: { [key: string]: React.CSSProperties } = {
  page: {
    height: '100vh',
    background: '#0c0c0e',
    fontFamily: 'Inter, -apple-system, sans-serif',
    overflowY: 'auto',
    color: '#e5e7eb',
  },
  inner: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px 28px 60px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#f0ede8',
    margin: 0,
    letterSpacing: '-0.03em',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#4ade80',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.2)',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  btnDanger: {
    padding: '8px 16px',
    background: 'rgba(239,68,68,0.15)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnDangerSmall: {
    padding: '4px 8px',
    background: 'rgba(239,68,68,0.15)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  btnSecondary: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.06)',
    color: '#9ca3af',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnAccent: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #E8A04C, #E8624C)',
    color: '#0c0c0e',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  pill: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 500,
  },
  card: {
    background: '#141416',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '20px 24px',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f0ede8',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  chartInner: {
    background: '#0c0c0e',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '12px',
    padding: '16px',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  chartTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e5e7eb',
    margin: 0,
  },
  chartBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
  },
  chartLoading: {
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '12px',
  },
  periodFilter: {
    display: 'flex',
    gap: '2px',
    background: 'rgba(255,255,255,0.04)',
    padding: '3px',
    borderRadius: '10px',
  },
  periodBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: '#6b7280',
    transition: 'all 0.15s ease',
  },
  periodBtnActive: {
    background: 'rgba(255,255,255,0.08)',
    color: '#f0ede8',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  searchInput: {
    width: '260px',
    padding: '8px 14px',
    fontSize: '13px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    outline: 'none',
    background: '#0c0c0e',
    color: '#e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontWeight: 600,
    color: '#6b7280',
    background: 'rgba(255,255,255,0.02)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  thSort: {
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '10px 14px',
    verticalAlign: 'middle' as const,
    fontSize: '13px',
    color: '#d1d5db',
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    display: 'inline-block',
  },
  select: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: '12px',
    cursor: 'pointer',
    background: '#0c0c0e',
    color: '#e5e7eb',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap' as const,
  },
  pageBtn: {
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: '#e5e7eb',
    transition: 'all 0.2s',
  },
  pageBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
};
