"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

  // Reset to page 1 when search changes
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

      // Update local state
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

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper: compute avg msgs/day for a user (total messages / days active)
  const getAvgMsgsDay = (user: User) => {
    const days = user.active_days || 1;
    return (user.total_messages || 0) / days;
  };

  // Sort
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

  // Pagination calculations
  const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading admin dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button onClick={() => router.push("/")} style={styles.backBtn}>
          ← Back to app
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={async () => {
              if (!confirm('Force logout ALL users? They will need to sign in again.')) return;
              try {
                const res = await fetch('/api/admin/force-logout', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  alert('Done! All users will be logged out.');
                } else {
                  alert('Failed: ' + (data.error || 'Unknown error'));
                }
              } catch {
                alert('Failed to force logout users');
              }
            }}
            style={{ ...styles.backBtn, background: '#ef4444', color: '#fff', border: 'none' }}
          >
            Force Logout All
          </button>
          <button onClick={() => router.push("/")} style={styles.backBtn}>
            ← Back to app
          </button>
        </div>
      </div>

      {/* Stats Cards - Period-specific */}
      {stats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalUsers}</div>
            <div style={styles.statLabel}>Total Users</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalMessages}</div>
            <div style={styles.statLabel}>Total Messages</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{periodStats?.signups || 0}</div>
            <div style={styles.statLabel}>Signups ({chartPeriod})</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{periodStats?.messages || 0}</div>
            <div style={styles.statLabel}>Messages ({chartPeriod})</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {users.length > 0
                ? (users.reduce((sum, u) => sum + getAvgMsgsDay(u), 0) / users.length).toFixed(1)
                : '0'}
            </div>
            <div style={styles.statLabel}>Avg Msgs/Day</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.activeSubscriptions}</div>
            <div style={styles.statLabel}>Active Subs</div>
          </div>
        </div>
      )}

      {/* Plan Distribution */}
      {stats && (
        <div style={styles.planDistribution}>
          <span style={styles.planBadgeFree}>Free: {stats.planCounts.Free}</span>
          <span style={styles.planBadgePro}>Pro: {stats.planCounts.Pro}</span>
          <span style={styles.planBadgePlus}>Plus: {stats.planCounts.Plus}</span>
        </div>
      )}

      {/* Chart Period Filter */}
      <div style={styles.chartSection}>
        <div style={styles.chartHeader}>
          <h2 style={styles.sectionTitle}>Trends</h2>
          <div style={styles.periodFilter}>
            {(["day", "week", "month", "year"] as Period[]).map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                style={{
                  ...styles.periodBtn,
                  ...(chartPeriod === period ? styles.periodBtnActive : {}),
                }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Charts 2x2 Grid */}
        <div style={styles.chartsContainer}>
          {/* Chart 1: Cumulative Users vs Messages (Dual Axis) */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader2}>
              <h3 style={styles.chartTitle}>Cumulative Growth</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={styles.chartBadge}>
                  {userTrend.length > 0 ? userTrend[userTrend.length - 1]?.cumulative || 0 : 0} users
                </span>
                <span style={{ ...styles.chartBadge, background: "#f3e8ff", color: "#7c3aed" }}>
                  {messageTrend.length > 0 ? messageTrend[messageTrend.length - 1]?.cumulative || 0 : 0} msgs
                </span>
              </div>
            </div>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={userTrend.map((u, i) => ({
                    label: u.label,
                    users: u.cumulative,
                    messages: messageTrend[i]?.cumulative || 0
                  }))}
                  margin={{ top: 5, right: 50, bottom: 5, left: 0 }}
                >
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#999" }}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#3b82f6" }}
                    width={35}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#8b5cf6" }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="users"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorUsers)"
                    name="Users"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="messages"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorMessages)"
                    name="Messages"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 2: Avg Messages per User */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader2}>
              <h3 style={styles.chartTitle}>Avg Messages / Day</h3>
              <span style={{ ...styles.chartBadge, background: "#d1fae5", color: "#059669" }}>
                {avgTrend.length > 0 ? avgTrend[avgTrend.length - 1]?.avg?.toFixed(1) || 0 : 0} avg
              </span>
            </div>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={avgTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="gradientAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#999" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#999" }}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [typeof value === 'number' ? value.toFixed(1) : '0', "Avg"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gradientAvg)"
                    activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 3: Top 10 Active Users */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader2}>
              <h3 style={styles.chartTitle}>Top 10 Active Users</h3>
              <span style={{ ...styles.chartBadge, background: "#fef3c7", color: "#d97706" }}>
                {chartPeriod}
              </span>
            </div>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={topUsers}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
                >
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#666" }}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(value, name, props) => [value, `${props.payload.email}`]}
                  />
                  <Bar dataKey="messageCount" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 4: Message Distribution (0-10 scale) */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader2}>
              <h3 style={styles.chartTitle}>Daily Message Distribution</h3>
              <span style={{ ...styles.chartBadge, background: "#fee2e2", color: "#dc2626" }}>
                msgs/day
              </span>
            </div>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={messageDistribution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis
                    dataKey="bucket"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#999" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#999" }}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(value, name, props) => [`${value} users`, `${props.payload.bucket} msgs/day`]}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <span style={styles.resultCount}>
          {sortedUsers.length} user{sortedUsers.length !== 1 ? "s" : ""} found
        </span>
        <button
          onClick={() => {
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
          }}
          style={styles.exportBtn}
        >
          Export CSV
        </button>
      </div>

      {/* Users Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Plan</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('total_messages')}>
                Messages {sortField === 'total_messages' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ ...styles.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('days_active')}>
                Days Since Joined {sortField === 'days_active' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ ...styles.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('active_days')}>
                Days Active {sortField === 'active_days' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ ...styles.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('created_at')}>
                Joined {sortField === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ ...styles.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('avg_msgs_day')}>
                Avg Msgs/Day {sortField === 'avg_msgs_day' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => {
              const isActive = (user.total_messages || 0) > 0;
              return (
                <tr key={user.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.userName}>{user.name}</div>
                    <div style={styles.userEmail}>{user.email}</div>
                    {user.original_name && user.original_name !== user.name && (
                      <div style={styles.originalName}>
                        Originally: {user.original_name}
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.planBadge,
                      background: user.plan === "Plus" ? "#8b5cf6" :
                                 user.plan === "Pro" ? "#3b82f6" : "#6b7280"
                    }}>
                      {user.plan}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background: isActive ? "#10b981" : "#9ca3af"
                    }}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {user.total_messages || 0}
                  </td>
                  <td style={styles.td}>
                    {user.days_active || 0}
                  </td>
                  <td style={styles.td}>
                    {user.active_days || 0}
                  </td>
                  <td style={styles.td}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={styles.td}>
                    {getAvgMsgsDay(user).toFixed(1)}
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={user.plan}
                        onChange={(e) => updatePlan(user.id, e.target.value)}
                        disabled={updatingUser === user.id}
                        style={styles.select}
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
                          } catch {
                            alert('Failed to force logout user');
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          whiteSpace: 'nowrap' as const,
                        }}
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
        <div style={styles.noResults}>No users found</div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            style={{
              ...styles.pageBtn,
              ...(currentPage === 1 ? styles.pageBtnDisabled : {}),
            }}
          >
            First
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              ...styles.pageBtn,
              ...(currentPage === 1 ? styles.pageBtnDisabled : {}),
            }}
          >
            ← Prev
          </button>

          <div style={styles.pageInfo}>
            Page {currentPage} of {totalPages}
            <span style={styles.pageRange}>
              ({startIndex + 1}-{Math.min(endIndex, sortedUsers.length)} of {sortedUsers.length})
            </span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              ...styles.pageBtn,
              ...(currentPage === totalPages ? styles.pageBtnDisabled : {}),
            }}
          >
            Next →
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              ...styles.pageBtn,
              ...(currentPage === totalPages ? styles.pageBtnDisabled : {}),
            }}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: "100vh",
    background: "#f8f5ef",
    padding: "24px",
    paddingBottom: "48px",
    fontFamily: "Inter, -apple-system, sans-serif",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1a1a1a",
    margin: 0,
  },
  backBtn: {
    padding: "8px 16px",
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  loading: {
    textAlign: "center" as const,
    padding: "60px",
    color: "#666",
  },
  error: {
    textAlign: "center" as const,
    padding: "60px",
    color: "#ef4444",
    fontSize: "18px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#fff",
    padding: "16px 20px",
    borderRadius: "12px",
    textAlign: "center" as const,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    border: "1px solid #f0f0f0",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 600,
    color: "#1a1a1a",
    letterSpacing: "-0.02em",
  },
  statLabel: {
    fontSize: "12px",
    color: "#888",
    marginTop: "2px",
    fontWeight: 500,
  },
  planDistribution: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px",
    flexWrap: "wrap" as const,
  },
  planBadgeFree: {
    padding: "8px 16px",
    background: "#6b7280",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 500,
  },
  planBadgePro: {
    padding: "8px 16px",
    background: "#3b82f6",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 500,
  },
  planBadgePlus: {
    padding: "8px 16px",
    background: "#8b5cf6",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 500,
  },
  chartSection: {
    marginBottom: "24px",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap" as const,
    gap: "12px",
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1a1a1a",
    margin: 0,
    letterSpacing: "-0.01em",
  },
  periodFilter: {
    display: "flex",
    gap: "4px",
    background: "#f5f5f5",
    padding: "4px",
    borderRadius: "10px",
  },
  periodBtn: {
    padding: "6px 14px",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    color: "#666",
    transition: "all 0.15s ease",
  },
  periodBtnActive: {
    background: "#fff",
    color: "#1a1a1a",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  chartsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
  },
  chartCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #f0f0f0",
  },
  chartHeader2: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  chartTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1a1a1a",
    margin: 0,
  },
  chartBadge: {
    fontSize: "11px",
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: "20px",
    background: "#eff6ff",
    color: "#2563eb",
  },
  chartLoading: {
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#999",
    fontSize: "13px",
  },
  searchContainer: {
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
  },
  exportBtn: {
    padding: "10px 18px",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  searchInput: {
    width: "100%",
    maxWidth: "400px",
    padding: "12px 16px",
    fontSize: "14px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    outline: "none",
  },
  resultCount: {
    fontSize: "14px",
    color: "#666",
  },
  tableContainer: {
    background: "#fff",
    borderRadius: "12px",
    overflow: "auto",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "14px",
  },
  th: {
    textAlign: "left" as const,
    padding: "14px 16px",
    borderBottom: "1px solid #e0e0e0",
    fontWeight: 600,
    color: "#666",
    background: "#fafafa",
  },
  tr: {
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "14px 16px",
    verticalAlign: "middle" as const,
  },
  userName: {
    fontWeight: 500,
    color: "#1a1a1a",
  },
  userEmail: {
    fontSize: "13px",
    color: "#666",
  },
  originalName: {
    fontSize: "11px",
    color: "#999",
    fontStyle: "italic" as const,
  },
  planBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 500,
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 500,
  },
  select: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #e0e0e0",
    fontSize: "13px",
    cursor: "pointer",
  },
  noResults: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#666",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap" as const,
  },
  pageBtn: {
    padding: "8px 16px",
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    transition: "all 0.2s",
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  pageInfo: {
    fontSize: "14px",
    color: "#1a1a1a",
    fontWeight: 500,
  },
  pageRange: {
    marginLeft: "8px",
    color: "#666",
    fontWeight: 400,
  },
};
