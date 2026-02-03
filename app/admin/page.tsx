"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
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
  created_at: string;
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
  const [chartPeriod, setChartPeriod] = useState<Period>("month");
  const [chartLoading, setChartLoading] = useState(false);

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

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

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
        <button onClick={() => router.push("/")} style={styles.backBtn}>
          ← Back to app
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalUsers}</div>
            <div style={styles.statLabel}>Total Users</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.activeSubscriptions}</div>
            <div style={styles.statLabel}>Active Subscriptions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalMessagesToday}</div>
            <div style={styles.statLabel}>Messages Today</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.signupsToday}</div>
            <div style={styles.statLabel}>Signups Today</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.signupsThisWeek}</div>
            <div style={styles.statLabel}>This Week</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.signupsThisMonth}</div>
            <div style={styles.statLabel}>This Month</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.avgMessagesPerUser}</div>
            <div style={styles.statLabel}>Avg Msgs/User</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalMessages}</div>
            <div style={styles.statLabel}>Total Messages</div>
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

        {/* Charts Side by Side */}
        <div style={styles.chartsContainer}>
          {/* User Signups Chart */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>User Signups</h3>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={userTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="New Users"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Total"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Messages Chart */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Messages Sent</h3>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={messageTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Messages"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Total"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Avg Messages per User Chart */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Avg Messages per User</h3>
            {chartLoading ? (
              <div style={styles.chartLoading}>Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={avgTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [value.toFixed(1), "Avg"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="Avg Msgs/User"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
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
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Users Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Plan</th>
              <th style={styles.th}>Messages Today</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
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
                <td style={styles.td}>{user.messages_used_today || 0}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.statusBadge,
                    background: user.subscription_status === "active" ? "#10b981" : "#6b7280"
                  }}>
                    {user.subscription_status || "none"}
                  </span>
                </td>
                <td style={styles.td}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td style={styles.td}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
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
              ({startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length})
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
    padding: "20px",
    borderRadius: "12px",
    textAlign: "center" as const,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#1a1a1a",
  },
  statLabel: {
    fontSize: "13px",
    color: "#666",
    marginTop: "4px",
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
    fontSize: "20px",
    fontWeight: 600,
    color: "#1a1a1a",
    margin: 0,
  },
  periodFilter: {
    display: "flex",
    gap: "8px",
  },
  periodBtn: {
    padding: "8px 16px",
    background: "#fff",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    transition: "all 0.2s",
  },
  periodBtnActive: {
    background: "#1a1a1a",
    color: "#fff",
    borderColor: "#1a1a1a",
  },
  chartsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
  },
  chartCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  chartTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1a1a1a",
    marginBottom: "16px",
    margin: "0 0 16px 0",
  },
  chartLoading: {
    height: "250px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
  },
  searchContainer: {
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
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
