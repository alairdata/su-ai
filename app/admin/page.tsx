"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

// ── Types ──
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
  planCounts: { Free: number; Pro: number; Plus: number };
  activeSubscriptions: number;
  totalMessagesToday: number;
  signupsToday: number;
  signupsThisWeek: number;
  signupsThisMonth: number;
  avgMessagesPerUser: number;
  totalMessages: number;
  deletedMessages: number;
  allTimeMessages: number;
  totalMessagesAllRoles: number;
}

interface TrendData { label: string; count: number; cumulative: number }
interface TopUser { id: string; name: string; email: string; messageCount: number }
interface MessageDistribution { bucket: string; count: number; users: { email: string; total: number }[] }

interface InsightsData {
  sessionDepth: { sent1: number; sent3: number; sent5: number; sent10: number; sent20: number };
  ghostBuckets: { day0: number; day1: number; day2_3: number; day4_7: number; day8_14: number; day15_30: number };
  cohorts: { week: string; size: number; d1: number | null; d3: number | null; d7: number | null; d14: number | null; d30: number | null }[];
  returnFreq: { daily: number; twoThree: number; weekly: number; biweekly: number; onceOnly: number };
  dauMauData: { label: string; dau: number; mau: number; ratio: number }[];
  avgDauMau: string;
  mrrHistory: { label: string; mrr: number }[];
  activeGhostTrend: { label: string; active: number; ghost: number }[];
}

type Period = "day" | "week" | "month" | "year";
type Tab = "users" | "finance";
type Scenario = "bear" | "base" | "bull";

declare global {
  interface Window {
    Chart: any;
  }
}

const USERS_PER_PAGE = 15;

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // UI
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [chartPeriod, setChartPeriod] = useState<Period>("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "g" | "r" } | null>(null);
  const [scenario, setScenario] = useState<Scenario>("bear");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [chartJsLoaded, setChartJsLoaded] = useState(false);

  // Chart data
  const [userTrend, setUserTrend] = useState<TrendData[]>([]);
  const [messageTrend, setMessageTrend] = useState<TrendData[]>([]);
  const [activeUserTrend, setActiveUserTrend] = useState<{ label: string; count: number }[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [messageDistribution, setMessageDistribution] = useState<MessageDistribution[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<MessageDistribution | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  // Insights data (real from API)
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(false);

  // Sorting & pagination
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Chart refs
  const chartRefs = useRef<Record<string, any>>({});

  // ── Chart.js availability check (handles cached script on back-navigation) ──
  useEffect(() => {
    if ((window as any).Chart) setChartJsLoaded(true);
  }, []);

  // ── Auth ──
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
      fetchChartData(chartPeriod);
      fetchInsights();
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") fetchChartData(chartPeriod);
  }, [chartPeriod]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, planFilter]);

  // ── Data fetching ──
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
    } catch {
      setError("Failed to load admin data");
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
        setActiveUserTrend(data.activeUserTrend || []);
        setTopUsers(data.topUsers || []);
        setMessageDistribution(data.messageDistribution || []);
      }
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(false);
    try {
      const res = await fetch("/api/admin/insights");
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      } else {
        setInsightsError(true);
      }
    } catch (err) {
      console.error("Failed to fetch insights:", err);
      setInsightsError(true);
    } finally {
      setInsightsLoading(false);
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
      setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan as "Free" | "Pro" | "Plus" } : u));
      showToast(`Plan updated to ${newPlan}`, "g");
    } catch {
      showToast("Failed to update plan", "r");
    } finally {
      setUpdatingUser(null);
    }
  };

  const showToast = (msg: string, type: "g" | "r" = "g") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  // ── Computed ──
  const computed = useMemo(() => {
    if (!stats || users.length === 0) return null;
    const ghosts = users.filter(u => (u.total_messages || 0) === 0);
    const withMessages = users.filter(u => (u.total_messages || 0) > 0);
    const paidUsers = users.filter(u => u.plan !== "Free");
    const freeActive = users.filter(u => u.plan === "Free" && (u.total_messages || 0) >= 1 && (u.total_messages || 0) <= 9);
    const freePower = users.filter(u => u.plan === "Free" && (u.total_messages || 0) >= 10);
    const ghostRate = users.length > 0 ? ghosts.length / users.length : 0;
    const retentionRate = users.length > 0 ? withMessages.length / users.length : 0;
    const mrr = stats.planCounts.Pro * 4.99 + stats.planCounts.Plus * 9.99;
    const avgSessionDepth = withMessages.length > 0
      ? withMessages.reduce((s, u) => s + (u.total_messages || 0), 0) / withMessages.length : 0;

    const avgPerActiveDay = users.length > 0
      ? users.reduce((sum, u) => sum + ((u.total_messages || 0) / Math.max(u.active_days || 1, 1)), 0) / users.length : 0;

    // Upgrade targets
    const upgradeTargets = users
      .filter(u => u.plan === "Free" && (u.total_messages || 0) >= 10)
      .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0));

    return {
      ghostRate, retentionRate, mrr, avgSessionDepth, avgPerActiveDay,
      ghosts: ghosts.length,
      activeCount: withMessages.length,
      freeActiveCount: freeActive.length,
      freePowerCount: freePower.length,
      paidCount: paidUsers.length,
      upgradeTargets,
      funnel: {
        signupCount: users.length,
        oneMsg: withMessages.length,
        tenMsg: users.filter(u => (u.total_messages || 0) >= 10).length,
        paidCount: paidUsers.length,
      },
    };
  }, [users, stats]);

  // ── Filtered stats (reactive to status/plan filters) ──
  const hasFilter = !!(statusFilter || planFilter);

  const filteredStats = useMemo(() => {
    // Apply status + plan filters (not search) to get filtered user set for stats
    const base = users.filter(u => {
      const isActive = (u.total_messages || 0) > 0;
      const matchStatus = !statusFilter ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "ghost" && !isActive);
      const matchPlan = !planFilter ||
        (planFilter === "free" && u.plan === "Free") ||
        (planFilter === "pro" && u.plan !== "Free");
      return matchStatus && matchPlan;
    });

    const totalUsers = base.length;
    const totalMsgs = base.reduce((s, u) => s + (u.total_messages || 0), 0);
    const todayMsgs = base.reduce((s, u) => s + (u.messages_used_today || 0), 0);
    const withMsgs = base.filter(u => (u.total_messages || 0) > 0);
    const avgPerActive = withMsgs.length > 0
      ? withMsgs.reduce((s, u) => s + (u.total_messages || 0), 0) / withMsgs.length : 0;
    const avgPerUser = totalUsers > 0 ? totalMsgs / totalUsers : 0;
    const avgPerDay = base.length > 0
      ? base.reduce((s, u) => s + ((u.total_messages || 0) / Math.max(u.active_days || 1, 1)), 0) / base.length : 0;

    return { totalUsers, totalMsgs, todayMsgs, avgPerActive, avgPerUser, avgPerDay };
  }, [users, statusFilter, planFilter]);

  // ── Filtering & sorting ──
  const getAvgMsgsDay = (user: User) => (user.total_messages || 0) / Math.max(user.active_days || 1, 1);

  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const isActive = (u.total_messages || 0) > 0;
    const matchStatus = !statusFilter ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "ghost" && !isActive);
    const matchPlan = !planFilter ||
      (planFilter === "free" && u.plan === "Free") ||
      (planFilter === "pro" && u.plan !== "Free");
    return matchSearch && matchStatus && matchPlan;
  });

  const sortedUsers = sortField ? [...filteredUsers].sort((a, b) => {
    let aVal: number, bVal: number;
    if (sortField === "created_at") {
      aVal = new Date(a.created_at).getTime();
      bVal = new Date(b.created_at).getTime();
    } else if (sortField === "avg_msgs_day") {
      aVal = getAvgMsgsDay(a);
      bVal = getAvgMsgsDay(b);
    } else {
      aVal = (a as any)[sortField] || 0;
      bVal = (b as any)[sortField] || 0;
    }
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  }) : filteredUsers;

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

  const exportCSV = () => {
    const h = ["Name", "Email", "Plan", "Status", "Msgs", "Today", "Days", "Active", "Avg", "Joined"];
    const rows = sortedUsers.map(u => [
      u.name, u.email, u.plan,
      (u.total_messages || 0) > 0 ? "active" : "ghost",
      u.total_messages || 0, u.messages_used_today || 0,
      u.days_active || 0, u.active_days || 0,
      getAvgMsgsDay(u).toFixed(1),
      new Date(u.created_at).toLocaleDateString(),
    ]);
    const csv = [h, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "users.csv";
    a.click();
    showToast("CSV exported.", "g");
  };

  // ── Chart drawing ──
  const chartConfig = useMemo(() => ({
    tip: { backgroundColor: "#1e1e27", borderColor: "#2a2a35", borderWidth: 1, titleColor: "#e8e6f0", bodyColor: "#9896a8", titleFont: { family: "inherit", size: 11 }, bodyFont: { family: "inherit", size: 11 }, padding: 10 },
    grid: { color: "rgba(255,255,255,0.05)", drawTicks: false },
    tickX: { color: "#55546a", font: { family: "inherit", size: 9 }, maxRotation: 0, maxTicksLimit: 6 },
    tickY: { color: "#55546a", font: { family: "inherit", size: 9 } },
  }), []);

  const destroyChart = useCallback((id: string) => {
    if (chartRefs.current[id]) {
      chartRefs.current[id].destroy();
      delete chartRefs.current[id];
    }
  }, []);

  const createChart = useCallback((id: string, config: any) => {
    const el = document.getElementById(id) as HTMLCanvasElement;
    if (!el || !window.Chart) return;
    destroyChart(id);
    chartRefs.current[id] = new window.Chart(el, config);
  }, [destroyChart]);

  // Draw all charts when data changes
  useEffect(() => {
    if (!chartJsLoaded || !stats || chartLoading) return;

    const labels = userTrend.map(d => d.label);
    const { tip, grid, tickX, tickY } = chartConfig;
    const crosshairPlugin = {
      id: 'crosshair',
      afterDatasetsDraw(chart: any) {
        const active = chart.getActiveElements();
        if (active && active.length > 0) {
          const ctx = chart.ctx;
          const x = active[0].element.x;
          const yScale = chart.scales.y || chart.scales.yUsers || Object.values(chart.scales).find((s: any) => s.axis === 'y');
          if (!yScale) return;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    };
    const baseInteraction = { mode: "index" as const, intersect: false };
    const baseScales = {
      x: { grid, ticks: tickX, border: { display: false } },
      y: { grid, ticks: tickY, border: { display: false } },
    };
    const baseOpts = {
      responsive: true, maintainAspectRatio: false,
      interaction: baseInteraction,
      hover: { mode: "index" as const, intersect: false },
      plugins: { legend: { display: false }, tooltip: { ...tip, mode: "index" as const, intersect: false } },
    };
    const hoverPoint = (color: string) => ({ pointRadius: 0, pointHitRadius: 20, pointHoverRadius: 6, pointHoverBackgroundColor: color, pointHoverBorderWidth: 2, pointHoverBorderColor: "#fff" });

    // Growth chart — dual Y axes
    createChart("growthChart", {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Users", data: userTrend.map(d => d.cumulative), borderColor: "#648FFF", tension: 0.4, fill: false, borderWidth: 2, yAxisID: "yUsers", ...hoverPoint("#648FFF") },
          { label: "Messages", data: messageTrend.map(d => d.cumulative), borderColor: "#FFB000", tension: 0.4, fill: false, borderWidth: 1.5, borderDash: [4, 3], yAxisID: "yMsgs", ...hoverPoint("#FFB000") },
        ],
      },
      options: {
        ...baseOpts,
        scales: {
          x: { grid, ticks: tickX, border: { display: false } },
          yUsers: { type: "linear", position: "left", grid, ticks: { ...tickY, color: "#648FFF" }, border: { display: false }, title: { display: true, text: "Users", color: "#648FFF", font: { size: 10 } } },
          yMsgs: { type: "linear", position: "right", grid: { drawOnChartArea: false }, ticks: { ...tickY, color: "#FFB000" }, border: { display: false }, title: { display: true, text: "Messages", color: "#FFB000", font: { size: 10 } } },
        },
      },
      plugins: [crosshairPlugin],
    });

    // Signup chart (active vs ghost over time) - REAL DATA from insights API
    if (insights?.activeGhostTrend && insights.activeGhostTrend.length > 0) {
      createChart("signupChart", {
        type: "line",
        data: {
          labels: insights.activeGhostTrend.map(d => d.label),
          datasets: [
            { label: "Active", data: insights.activeGhostTrend.map(d => d.active), borderColor: "#009E73", backgroundColor: "rgba(0,158,115,0.08)", tension: 0.4, fill: true, borderWidth: 2, ...hoverPoint("#009E73") },
            { label: "Ghost", data: insights.activeGhostTrend.map(d => d.ghost), borderColor: "#999999", backgroundColor: "rgba(153,153,153,0.08)", tension: 0.4, fill: true, borderWidth: 1.5, borderDash: [4, 3], ...hoverPoint("#999") },
          ],
        },
        options: { ...baseOpts, scales: { ...baseScales, y: { ...baseScales.y, min: 0 } } },
        plugins: [crosshairPlugin],
      });
    }

    // Active users chart
    createChart("activeChart", {
      type: "line",
      data: {
        labels: activeUserTrend.map(d => d.label),
        datasets: [
          { label: "Active Users", data: activeUserTrend.map(d => d.count), borderColor: "#FFB000", backgroundColor: "rgba(255,176,0,0.08)", tension: 0.4, fill: true, borderWidth: 1.5, ...hoverPoint("#FFB000") },
          { label: "Signups", data: userTrend.map(d => d.count), borderColor: "#648FFF", backgroundColor: "transparent", tension: 0.4, fill: false, borderWidth: 1.5, borderDash: [4, 3], ...hoverPoint("#648FFF") },
        ],
      },
      options: { ...baseOpts, scales: { ...baseScales, y: { ...baseScales.y, min: 0 } } },
      plugins: [crosshairPlugin],
    });

    // Distribution chart
    createChart("distChart", {
      type: "bar",
      data: {
        labels: messageDistribution.map(d => d.bucket),
        datasets: [{
          label: "Users", data: messageDistribution.map(d => d.count),
          backgroundColor: messageDistribution.map((d) => selectedBucket?.bucket === d.bucket ? "rgba(100,143,255,0.7)" : "rgba(100,143,255,0.3)"),
          borderColor: "rgba(100,143,255,0.8)",
          borderWidth: 1, borderRadius: 3, hoverBackgroundColor: "rgba(100,143,255,0.6)",
        }],
      },
      options: {
        ...baseOpts,
        onClick: (_e: any, elements: any[]) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const bucket = messageDistribution[idx];
            setSelectedBucket(prev => prev?.bucket === bucket.bucket ? null : bucket);
          }
        },
        scales: { ...baseScales, y: { ...baseScales.y, min: 0 } },
      },
      plugins: [crosshairPlugin],
    });

    // Donut chart
    if (computed) {
      createChart("donutChart", {
        type: "doughnut",
        data: {
          labels: ["Ghost (0 msgs)", "Free (1-9)", "Free (10+)", "Paid"],
          datasets: [{
            data: [computed.ghosts, computed.freeActiveCount, computed.freePowerCount, computed.paidCount],
            backgroundColor: ["#444", "#009E73", "#FFB000", "#648FFF"],
            borderWidth: 0, hoverOffset: 8, hoverBorderWidth: 2, hoverBorderColor: "#fff",
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false }, tooltip: { ...tip, callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} users (${((ctx.raw / (stats?.totalUsers || 1)) * 100).toFixed(1)}%)` } } } },
      });

      // Session depth funnel - REAL DATA from insights API
      if (insights?.sessionDepth) {
        createChart("sessionDepthChart", {
          type: "bar",
          data: {
            labels: ["Sent 1 msg", "Sent 3 msgs", "Sent 5 msgs", "Sent 10 msgs", "Sent 20+ msgs"],
            datasets: [{
              label: "Users", data: [insights.sessionDepth.sent1, insights.sessionDepth.sent3, insights.sessionDepth.sent5, insights.sessionDepth.sent10, insights.sessionDepth.sent20],
              backgroundColor: ["rgba(100,143,255,0.7)", "rgba(100,143,255,0.6)", "rgba(100,143,255,0.5)", "rgba(100,143,255,0.4)", "rgba(100,143,255,0.3)"],
              borderColor: "#648FFF", borderWidth: 1, borderRadius: 4, hoverBackgroundColor: "rgba(100,143,255,0.9)",
            }],
          },
          options: {
            indexAxis: "y" as const, ...baseOpts,
            scales: {
              x: { grid, ticks: tickX, border: { display: false }, min: 0 },
              y: { grid: { display: false }, ticks: { color: "#9896a8", font: { family: "inherit", size: 10 } }, border: { display: false } },
            },
          },
        });
      }

      // Time to ghost - REAL DATA from insights API
      if (insights?.ghostBuckets) {
        const gb = insights.ghostBuckets;
        createChart("ghostChart", {
          type: "bar",
          data: {
            labels: ["Day 0 (never back)", "Day 1", "Day 2-3", "Day 4-7", "Day 8-14", "Day 15-30"],
            datasets: [{
              label: "Ghosts", data: [gb.day0, gb.day1, gb.day2_3, gb.day4_7, gb.day8_14, gb.day15_30],
              backgroundColor: ["rgba(254,97,0,0.7)", "rgba(254,97,0,0.6)", "rgba(254,97,0,0.5)", "rgba(254,97,0,0.4)", "rgba(254,97,0,0.3)", "rgba(254,97,0,0.2)"],
              borderColor: "#FE6100", borderWidth: 1, borderRadius: 4, hoverBackgroundColor: "rgba(254,97,0,0.9)",
            }],
          },
          options: { ...baseOpts, scales: { ...baseScales, y: { ...baseScales.y, min: 0 } } },
          plugins: [crosshairPlugin],
        });
      }

      // DAU/MAU - REAL DATA from insights API
      if (insights?.dauMauData && insights.dauMauData.length > 0) {
        createChart("dauMauChart", {
          type: "line",
          data: {
            labels: insights.dauMauData.map(d => d.label),
            datasets: [
              { label: "DAU/MAU %", data: insights.dauMauData.map(d => d.ratio), borderColor: "#FFB000", backgroundColor: "rgba(255,176,0,0.08)", tension: 0.4, fill: true, borderWidth: 2, ...hoverPoint("#FFB000") },
              { label: "Target (20%)", data: insights.dauMauData.map(() => 20), borderColor: "rgba(100,143,255,0.4)", borderDash: [6, 4], tension: 0, fill: false, pointRadius: 0, pointHoverRadius: 0, borderWidth: 1.5 },
            ],
          },
          options: {
            ...baseOpts,
            scales: {
              x: { grid, ticks: tickX, border: { display: false } },
              y: { grid, ticks: { ...tickY, callback: (v: number) => v + "%" }, border: { display: false }, min: 0, max: 50 },
            },
          },
          plugins: [crosshairPlugin],
        });
      }

      // Return frequency - REAL DATA from insights API
      if (insights?.returnFreq) {
        const rf = insights.returnFreq;
        createChart("returnFreqChart", {
          type: "bar",
          data: {
            labels: ["Daily", "2-3x/week", "Weekly", "Bi-weekly", "Once only"],
            datasets: [{
              label: "Users", data: [rf.daily, rf.twoThree, rf.weekly, rf.biweekly, rf.onceOnly],
              backgroundColor: ["rgba(0,158,115,0.8)", "rgba(0,158,115,0.6)", "rgba(0,158,115,0.4)", "rgba(255,176,0,0.4)", "rgba(254,97,0,0.4)"],
              borderColor: ["#009E73", "#009E73", "#009E73", "#FFB000", "#FE6100"],
              borderWidth: 1, borderRadius: 4, hoverBackgroundColor: "rgba(255,255,255,0.25)",
            }],
          },
          options: { ...baseOpts, scales: { ...baseScales, y: { ...baseScales.y, min: 0 } } },
        });
      }
    }
  }, [chartJsLoaded, userTrend, messageTrend, activeUserTrend, messageDistribution, stats, chartLoading, computed, users, insights, createChart, chartConfig, selectedBucket]);

  // Draw finance charts when tab switches
  useEffect(() => {
    if (!chartJsLoaded || activeTab !== "finance" || !computed || !stats) return;
    const timer = setTimeout(() => drawFinanceCharts(), 100);
    return () => clearTimeout(timer);
  }, [chartJsLoaded, activeTab, computed, stats, scenario, insights]);

  const drawFinanceCharts = () => {
    if (!computed || !stats) return;
    const { tip, grid, tickX, tickY } = chartConfig;
    const crosshairPlugin = {
      id: 'crosshair',
      afterDatasetsDraw(chart: any) {
        const active = chart.getActiveElements();
        if (active && active.length > 0) {
          const ctx = chart.ctx;
          const x = active[0].element.x;
          const yScale = chart.scales.y || chart.scales.yUsers || Object.values(chart.scales).find((s: any) => s.axis === 'y');
          if (!yScale) return;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    };
    const baseInteraction = { mode: "index" as const, intersect: false };
    const baseOpts = {
      responsive: true, maintainAspectRatio: false,
      interaction: baseInteraction,
      hover: { mode: "index" as const, intersect: false },
      plugins: { legend: { display: false }, tooltip: { ...tip, mode: "index" as const, intersect: false } },
    };
    const hoverPoint = (color: string) => ({ pointRadius: 0, pointHitRadius: 20, pointHoverRadius: 6, pointHoverBackgroundColor: color, pointHoverBorderWidth: 2, pointHoverBorderColor: "#fff" });

    // MRR Trend - REAL DATA from insights API
    const mrrLabels = insights?.mrrHistory?.map(d => d.label) || ["Now"];
    const mrrData = insights?.mrrHistory?.map(d => d.mrr) || [computed.mrr];

    createChart("mrrTrendChart", {
      type: "line",
      data: {
        labels: mrrLabels,
        datasets: [{
          label: "MRR", data: mrrData, borderColor: "#009E73", backgroundColor: "rgba(0,158,115,0.08)",
          tension: 0.4, fill: true, borderWidth: 2, ...hoverPoint("#009E73"),
        }],
      },
      options: {
        ...baseOpts,
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)", drawTicks: false }, ticks: tickX, border: { display: false } },
          y: { grid: { color: "rgba(255,255,255,0.05)", drawTicks: false }, ticks: { ...tickY, callback: (v: number) => "$" + v }, border: { display: false }, min: 0 },
        },
      },
      plugins: [crosshairPlugin],
    });

    // Funnel
    createChart("funnelChart", {
      type: "bar",
      data: {
        labels: ["Signed Up", "1+ Messages", "10+ Messages", "Paid"],
        datasets: [{
          data: [computed.funnel.signupCount, computed.funnel.oneMsg, computed.funnel.tenMsg, computed.funnel.paidCount],
          backgroundColor: ["rgba(100,143,255,0.3)", "rgba(255,176,0,0.3)", "rgba(255,176,0,0.5)", "rgba(0,158,115,0.6)"],
          borderColor: ["#648FFF", "#FFB000", "#FFB000", "#009E73"],
          borderWidth: 1, borderRadius: 4, hoverBackgroundColor: "rgba(255,255,255,0.25)",
        }],
      },
      options: {
        indexAxis: "y" as const, ...baseOpts,
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)", drawTicks: false }, ticks: tickX, border: { display: false }, min: 0 },
          y: { grid: { display: false }, ticks: { color: "#9896a8", font: { family: "inherit", size: 11 } }, border: { display: false } },
        },
      },
    });

    // Forecast
    drawForecast();
  };

  const drawForecast = () => {
    if (!computed) return;
    const { tip, grid, tickX, tickY } = chartConfig;
    const crosshairPlugin = {
      id: 'crosshair',
      afterDatasetsDraw(chart: any) {
        const active = chart.getActiveElements();
        if (active && active.length > 0) {
          const ctx = chart.ctx;
          const x = active[0].element.x;
          const yScale = chart.scales.y || chart.scales.yUsers || Object.values(chart.scales).find((s: any) => s.axis === 'y');
          if (!yScale) return;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    };
    const scenarios: Record<Scenario, { label: string; color: string; data: number[] }> = {
      bear: {
        label: `Conservative (0.8% conv, 20 signups/wk)`,
        color: "#648FFF",
        data: [computed.mrr, computed.mrr + 4.99, computed.mrr + 9.98, computed.mrr + 14.97, computed.mrr + 19.96, computed.mrr + 24.95, computed.mrr + 29.94],
      },
      base: {
        label: `Base (1.2% conv, 25 signups/wk)`,
        color: "#FFB000",
        data: [computed.mrr, computed.mrr + 9.98, computed.mrr + 19.96, computed.mrr + 34.93, computed.mrr + 49.90, computed.mrr + 69.86, computed.mrr + 89.82],
      },
      bull: {
        label: `Optimistic (3% conv, 35 signups/wk)`,
        color: "#009E73",
        data: [computed.mrr, computed.mrr + 24.95, computed.mrr + 59.88, computed.mrr + 104.79, computed.mrr + 159.68, computed.mrr + 224.55, computed.mrr + 299.40],
      },
    };
    const s = scenarios[scenario];

    const fHoverPoint = (color: string) => ({ pointRadius: 0, pointHitRadius: 20, pointHoverRadius: 6, pointHoverBackgroundColor: color, pointHoverBorderWidth: 2, pointHoverBorderColor: "#fff" });
    createChart("forecastChart", {
      type: "line",
      data: {
        labels: ["Now", "Mo 1", "Mo 2", "Mo 3", "Mo 4", "Mo 5", "Mo 6"],
        datasets: [
          { label: "Projected MRR", data: s.data, borderColor: s.color, backgroundColor: s.color + "18", tension: 0.4, fill: true, borderWidth: 2, ...fHoverPoint(s.color) },
          { label: "$500 target", data: [500, 500, 500, 500, 500, 500, 500], borderColor: "rgba(255,255,255,0.15)", borderDash: [6, 4], fill: false, pointRadius: 0, pointHoverRadius: 0, borderWidth: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        hover: { mode: "index" as const, intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tip, mode: "index" as const, intersect: false } },
        scales: {
          x: { grid, ticks: tickX, border: { display: false } },
          y: { grid, ticks: { ...tickY, callback: (v: number) => "$" + v }, border: { display: false }, min: 0 },
        },
      },
      plugins: [crosshairPlugin],
    });
  };

  // ── Loading / Error states ──
  if (status === "loading" || loading) {
    return (
      <div className="admin-page">
        <style>{adminCSS}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#9896a8", fontSize: "15px", gap: "12px" }}>
          <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #648FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Loading admin dashboard...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <style>{adminCSS}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "16px" }}>
          <div style={{ color: "#e05555", fontSize: "18px", fontWeight: 600 }}>{error}</div>
          <button onClick={() => router.push("/")} className="tbtn">Back to app</button>
        </div>
      </div>
    );
  }

  const topUserMax = topUsers.length > 0 ? topUsers[0].messageCount : 1;
  const dauMauAvg = insights?.avgDauMau || "0";

  // Heat level helper for upgrade targets
  const heatLevel = (msgs: number) => {
    if (msgs >= 100) return { color: "#009E73", label: "Hot", bg: "rgba(0,158,115,0.12)", border: "rgba(0,158,115,0.3)" };
    if (msgs >= 50) return { color: "#FFB000", label: "Warm", bg: "rgba(255,176,0,0.12)", border: "rgba(255,176,0,0.3)" };
    return { color: "#648FFF", label: "Watch", bg: "rgba(100,143,255,0.08)", border: "rgba(100,143,255,0.2)" };
  };

  // Cohort data - REAL from insights API
  const cohorts = insights?.cohorts || [];

  const heatColor = (pct: number | null) => {
    if (pct === null) return { bg: "transparent", color: "#333" };
    if (pct >= 50) return { bg: "rgba(0,158,115,0.5)", color: "#009E73" };
    if (pct >= 30) return { bg: "rgba(0,158,115,0.25)", color: "#009E73" };
    if (pct >= 15) return { bg: "rgba(255,176,0,0.25)", color: "#FFB000" };
    if (pct >= 5) return { bg: "rgba(254,97,0,0.2)", color: "#FE6100" };
    return { bg: "rgba(254,97,0,0.1)", color: "#FE6100" };
  };

  return (
    <div className="admin-page">
      <style>{adminCSS}</style>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
        onReady={() => setChartJsLoaded(true)}
      />

      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            Admin Dashboard
          </div>
          <span className="live-badge">Live</span>
        </div>
        <div className="topbar-right">
          <button className="tbtn danger" onClick={async () => {
            if (!confirm("Force logout ALL users? They will need to sign in again.")) return;
            try {
              const res = await fetch("/api/admin/force-logout", { method: "POST" });
              const data = await res.json();
              if (data.success) showToast("All sessions terminated.", "r");
              else showToast("Failed: " + (data.error || "Unknown error"), "r");
            } catch { showToast("Failed to force logout users", "r"); }
          }}>Force Logout All</button>
          <button className="tbtn" onClick={() => router.push("/")}>Back to app</button>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        <button className={`tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>Users</button>
        <button className={`tab ${activeTab === "finance" ? "active" : ""}`} onClick={() => setActiveTab("finance")}>Finance</button>
      </div>

      {/* ══ USERS TAB ══ */}
      {activeTab === "users" && (
        <div className="page-content">
          {/* Stat cards - reactive to filters */}
          {stats && (
            <div className="stat-grid">
              <div className="sc"><div className="sc-label">TOTAL USERS</div><div className="sc-val">{hasFilter ? filteredStats.totalUsers : stats.totalUsers}</div><div className="sc-sub">{hasFilter ? "filtered" : "all-time signups"}</div></div>
              <div className="sc"><div className="sc-label">TOTAL MESSAGES</div><div className="sc-val">{hasFilter ? filteredStats.totalMsgs.toLocaleString() : stats.allTimeMessages.toLocaleString()}</div><div className="sc-sub">{hasFilter ? "from filtered users" : <><span className="g">{stats.totalMessages.toLocaleString()}</span> active{stats.deletedMessages > 0 ? ` · ${stats.deletedMessages.toLocaleString()} deleted` : ""}</>}</div></div>
              <div className="sc"><div className="sc-label">TOTAL INTERACTIONS</div><div className="sc-val">{stats.totalMessagesAllRoles.toLocaleString()}</div><div className="sc-sub">user + AI messages combined</div></div>
              <div className="sc"><div className="sc-label">MESSAGES TODAY</div><div className="sc-val">{hasFilter ? filteredStats.todayMsgs : stats.totalMessagesToday}</div><div className="sc-sub">new messages sent today</div></div>
              <div className="sc"><div className="sc-label">MSG / ACTIVE USER</div><div className="sc-val">{hasFilter ? filteredStats.avgPerActive.toFixed(1) : (computed?.avgSessionDepth.toFixed(1) || "0")}</div><div className="sc-sub">avg per user w/ 1+ msg</div></div>
              <div className="sc"><div className="sc-label">MSG / USER</div><div className="sc-val">{hasFilter ? filteredStats.avgPerUser.toFixed(1) : stats.avgMessagesPerUser.toFixed(1)}</div><div className="sc-sub">{hasFilter ? "filtered avg" : "all-time incl. ghosts"}</div></div>
              <div className="sc"><div className="sc-label">MSG / ACTIVE DAY</div><div className="sc-val">{hasFilter ? filteredStats.avgPerDay.toFixed(1) : (computed?.avgPerActiveDay.toFixed(1) || "0")}</div><div className="sc-sub">avg msgs per active day</div></div>
            </div>
          )}

          {/* Trends header */}
          <div className="sec-head">
            <span className="sec-title">Trends</span>
            <div className="period-row">
              {(["day", "week", "month", "year"] as Period[]).map(p => (
                <button key={p} className={`pb ${chartPeriod === p ? "active" : ""}`} onClick={() => setChartPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Growth + Signups */}
          <div className="row2" style={{ marginBottom: 10 }}>
            <div className="cc">
              <InfoKicker label="Cumulative Growth" title="Cumulative Growth" body="Total users and messages accumulated over time. Shows overall product growth trajectory." how="Running total of all signups and messages sent since launch. A steepening curve = accelerating growth." />
              <div className="cc-title">{hasFilter ? filteredStats.totalUsers : (stats?.totalUsers || 0)} users · {hasFilter ? filteredStats.totalMsgs.toLocaleString() : (stats?.allTimeMessages.toLocaleString() || 0)} msgs</div>
              <div className="chart-legend">
                <div className="legend-item"><div className="legend-sq" style={{ background: "#648FFF" }} />Users</div>
                <div className="legend-item"><div className="legend-sq" style={{ background: "#FFB000" }} />Messages</div>
              </div>
              <div style={{ position: "relative", height: 200 }}><canvas id="growthChart" /></div>
            </div>
            <div className="cc">
              <InfoKicker label="User Status Over Time" title="Active vs Ghost" body="Active = users who have sent at least 1 message. Ghost = users who signed up but never messaged." how="Counted from your user records. Ghost rate = ghosts ÷ total signups × 100." />
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
                <div className="cc-title" style={{ marginBottom: 0 }}>Active vs Ghost</div>
                <span style={{ fontSize: 13, color: "#009E73", fontWeight: 600 }}>{computed?.activeCount || 0} active</span>
                <span style={{ fontSize: 13, color: "#999", fontWeight: 600 }}>{computed?.ghosts || 0} ghost</span>
              </div>
              <div style={{ position: "relative", height: 200 }}>
                <canvas id="signupChart" />
                {insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #648FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
                {insightsError && !insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#55546a", fontSize: 12 }}>Failed to load</div>}
              </div>
            </div>
          </div>

          {/* Active Users + Donut */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10, alignItems: "stretch" }}>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <InfoKicker label="Active Users" title="Daily Engagement" body="How many unique users sent at least one message each day." how="Count of distinct users with at least 1 message per calendar day." />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                    <div className="cc-title" style={{ marginBottom: 0 }}>Daily engagement</div>
                    <span style={{ fontSize: 13, color: "#FFB000", fontWeight: 600 }}>{activeUserTrend.length > 0 ? activeUserTrend[activeUserTrend.length - 1].count : 0} active</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, background: "rgba(255,176,0,0.12)", color: "#FFB000", border: "1px solid rgba(255,176,0,0.3)", padding: "2px 8px", borderRadius: 4 }}>
                    {activeUserTrend.length > 0 ? Math.max(...activeUserTrend.map(d => d.count)) : 0} peak
                  </span>
                </div>
              </div>
              <div style={{ position: "relative", flex: 1, minHeight: 100 }}>
                <canvas id="activeChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              </div>
            </div>
            <div className="cc donut-wrap" style={{ width: 240 }}>
              <InfoKicker label="User Status" title="User Status Breakdown" body={`Snapshot of where all ${stats?.totalUsers || 0} users sit today.`} how="Counted from message totals per user." />
              <div className="donut-rel">
                <canvas id="donutChart" />
                <div className="donut-inner"><div className="donut-num">{stats?.totalUsers || 0}</div><div className="donut-sub">USERS</div></div>
              </div>
              {computed && (
                <div className="leg">
                  <div className="leg-r"><div className="leg-l2"><span className="leg-dot" style={{ background: "#444", border: "1px solid #666" }} />Ghost (0 msgs)</div><div className="leg-right"><strong>{computed.ghosts}</strong> · {((computed.ghosts / (stats?.totalUsers || 1)) * 100).toFixed(0)}%</div></div>
                  <div className="leg-r"><div className="leg-l2"><span className="leg-dot" style={{ background: "#009E73" }} />Free (1-9)</div><div className="leg-right"><strong>{computed.freeActiveCount}</strong> · {((computed.freeActiveCount / (stats?.totalUsers || 1)) * 100).toFixed(0)}%</div></div>
                  <div className="leg-r"><div className="leg-l2"><span className="leg-dot" style={{ background: "#FFB000" }} />Free (10+)</div><div className="leg-right"><strong>{computed.freePowerCount}</strong> · {((computed.freePowerCount / (stats?.totalUsers || 1)) * 100).toFixed(0)}%</div></div>
                  <div className="leg-r"><div className="leg-l2"><span className="leg-dot" style={{ background: "#648FFF" }} />Paid</div><div className="leg-right"><strong>{computed.paidCount}</strong> · {((computed.paidCount / (stats?.totalUsers || 1)) * 100).toFixed(0)}%</div></div>
                </div>
              )}
            </div>
          </div>

          {/* Top Users + Distribution */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div className="cc">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <InfoKicker label="Top 10 Users" title="Top Users" body="Your highest-volume users by message count." how="Ranked by total messages sent in the current period." />
                <span style={{ fontSize: 10, color: "#55546a" }}>{chartPeriod}</span>
              </div>
              {topUsers.map((u, i) => (
                <div key={u.id} className={`user-row ${i === 0 ? "rank1" : ""}`}>
                  <span className="ur-rank">{i + 1}</span>
                  <div className="ur-info">
                    <div className="ur-name">{u.name}</div>
                    <div className="ur-bar"><div className="ur-fill" style={{ width: `${Math.round(u.messageCount / topUserMax * 100)}%` }} /></div>
                  </div>
                  <span className={i === 0 ? "ur-count" : "ur-count dim"}>{u.messageCount}</span>
                </div>
              ))}
              {topUsers.length === 0 && <div style={{ color: "#55546a", textAlign: "center", padding: 20, fontSize: 12 }}>No data</div>}
            </div>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Message Distribution" title="Total Messages Per User" body="How many total messages each user has sent, grouped into ranges." how="Each bar = number of users whose all-time message count falls in that range. Click a bar to see the users." />
              <div className="cc-title">Total msgs per user</div>
              <div style={{ position: "relative", flex: 1, minHeight: 120, cursor: "pointer" }}>
                <canvas id="distChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              </div>
              {selectedBucket && selectedBucket.users.length > 0 && (
                <div style={{ marginTop: 10, maxHeight: 200, overflowY: "auto", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>{selectedBucket.bucket} msgs — {selectedBucket.users.length} users</span>
                    <button onClick={() => setSelectedBucket(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11 }}>close</button>
                  </div>
                  {selectedBucket.users.map((u, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, color: "var(--text2)", borderBottom: "1px solid var(--border)" }}>
                      <span>{u.email}</span>
                      <span style={{ color: "var(--text3)" }}>{u.total} msgs</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DEEPER INSIGHTS */}
          <div style={{ marginBottom: 10 }}>
            <div className="cc-kicker" style={{ marginBottom: 4, fontSize: 11, color: "#648FFF", letterSpacing: 1 }}>DEEPER INSIGHTS</div>
          </div>

          {/* Session Depth + Return Frequency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="First Session Depth" title="First Session Depth" body="How far users go in their very first session." how="Count users whose first session crossed each message threshold." />
              <div className="cc-title" style={{ marginBottom: 14 }}>How far users go in session 1</div>
              <div style={{ position: "relative", flex: 1, minHeight: 220 }}>
                <canvas id="sessionDepthChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                {insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #648FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
                {insightsError && !insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#55546a", fontSize: 12 }}>Failed to load</div>}
              </div>
            </div>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Return Frequency" title="Return Frequency" body="Of your active users, how often do they actually come back?" how="Count sessions per user over 30 days." />
              <div className="cc-title" style={{ marginBottom: 14 }}>How often active users come back</div>
              <div style={{ position: "relative", flex: 1, minHeight: 220 }}>
                <canvas id="returnFreqChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                {insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #648FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
                {insightsError && !insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#55546a", fontSize: 12 }}>Failed to load</div>}
              </div>
            </div>
          </div>

          {/* Time-to-Ghost + DAU/MAU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Time-to-Ghost" title="Time-to-Ghost" body={`Of your ghost/churned users, when did they abandon? Includes 0-msg users and users inactive 14+ days.`} how="Day 0 spike = signup/onboarding problem. Day 1-3 spike = first experience problem." />
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
                <div className="cc-title" style={{ marginBottom: 0 }}>When users drop off</div>
                <span style={{ fontSize: 13, color: "#FE6100", fontWeight: 600 }}>{insights ? Object.values(insights.ghostBuckets).reduce((a, b) => a + b, 0) : (computed?.ghosts || 0)} ghosts total</span>
              </div>
              <div style={{ position: "relative", flex: 1, minHeight: 220 }}>
                <canvas id="ghostChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                {insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #648FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
                {insightsError && !insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#55546a", fontSize: 12 }}>Failed to load</div>}
              </div>
            </div>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="DAU / MAU Ratio" title="DAU / MAU Ratio" body="Daily Active Users ÷ Monthly Active Users × 100. Measures how habitual your app is." how="Below 10% = occasional use. Above 20% = building a habit." />
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
                <div className="cc-title" style={{ marginBottom: 0 }}>Product stickiness</div>
                <span style={{ fontSize: 13, color: "#FFB000", fontWeight: 600 }}>avg {dauMauAvg}%</span>
                <span style={{ fontSize: 11, color: "#55546a" }}>target &gt;20%</span>
              </div>
              <div style={{ position: "relative", flex: 1, minHeight: 220 }}>
                <canvas id="dauMauChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                {insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #648FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
                {insightsError && !insightsLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#55546a", fontSize: 12 }}>Failed to load</div>}
              </div>
            </div>
          </div>

          {/* Cohort Retention + Upgrade Targets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {/* Cohort Table */}
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Retention Cohort" title="Cohort Retention Table" body="Groups users by signup week and tracks what % returned." how="For each cohort, count users who sent a message on or after that day ÷ cohort size × 100." />
              <div className="cc-title" style={{ marginBottom: 14 }}>By signup week</div>
              <div style={{ overflowX: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["COHORT", "SIZE", "D1", "D3", "D7", "D14", "D30"].map(h => (
                        <th key={h} style={{ textAlign: h === "COHORT" ? "left" : "center", padding: "6px 8px", color: "#55546a", fontSize: 9, letterSpacing: 1, fontWeight: 400, borderBottom: "1px solid #2a2a35", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((c, ci) => (
                      <tr key={ci}>
                        <td style={{ padding: "6px 8px", color: "#9896a8", whiteSpace: "nowrap", borderBottom: "1px solid #1a1a22" }}>{c.week}</td>
                        <td style={{ textAlign: "center", padding: "6px 8px", color: "#e8e6f0", borderBottom: "1px solid #1a1a22" }}>{c.size}</td>
                        {[c.d1, c.d3, c.d7, c.d14, c.d30].map((v, vi) => {
                          const { bg, color } = heatColor(v);
                          return (
                            <td key={vi} style={{ textAlign: "center", padding: "6px 8px", background: bg, color, fontWeight: 500, borderRadius: 3, borderBottom: "1px solid #1a1a22" }}>
                              {v === null ? "—" : `${v}%`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upgrade Targets */}
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Upgrade Targets" title="Upgrade Targets" body="Free users with high engagement who haven't paid yet." how="Filtered from all free users by message count. Hot = 100+ msgs, Warm = 50-99, Watch = 10-49." />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                  <div className="cc-title" style={{ marginBottom: 0 }}>Free users ripe to convert</div>
                  <span style={{ fontSize: 11, color: "#55546a" }}>high-engagement, still free</span>
                </div>
                <button onClick={() => setUpgradeModalOpen(true)} style={{ fontFamily: "inherit", fontSize: 10, padding: "4px 12px", borderRadius: 4, cursor: "pointer", background: "transparent", border: "1px solid #2a2a35", color: "#648FFF" }}>See all →</button>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {(computed?.upgradeTargets || []).slice(0, 6).map(u => {
                  const h = heatLevel(u.total_messages || 0);
                  const maxMsgs = computed?.upgradeTargets[0]?.total_messages || 1;
                  const pct = Math.round((u.total_messages || 0) / maxMsgs * 100);
                  const initials = u.name.split(" ").map(w => w[0]).slice(0, 2).join("");
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 6, background: h.bg, border: `1px solid ${h.border}` }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: h.color + "22", border: `1px solid ${h.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: h.color, flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: "#e8e6f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{u.name}</span>
                          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, background: h.bg, color: h.color, border: `1px solid ${h.border}` }}>{h.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 3, background: "#2a2a35", borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: h.color, borderRadius: 2, opacity: 0.7 }} />
                          </div>
                          <span style={{ fontSize: 11, color: h.color, fontWeight: 600, flexShrink: 0 }}>{u.total_messages} msgs</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!computed?.upgradeTargets || computed.upgradeTargets.length === 0) && (
                  <div style={{ color: "#55546a", textAlign: "center", padding: 20, fontSize: 12 }}>No upgrade targets yet</div>
                )}
              </div>
            </div>
          </div>

          {/* USER TABLE */}
          <div className="tbl-wrap">
            <div className="tbl-head">
              <span className="tbl-title">Users</span>
              <div className="tbl-controls">
                <input className="sinp" placeholder="Search users…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <select className="sinp" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="ghost">Ghost</option>
                </select>
                <select className="sinp" value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ width: "auto" }}>
                  <option value="">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                </select>
                <button className="csv-btn" onClick={exportCSV}>Export CSV</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th style={{ cursor: "pointer" }} onClick={() => toggleSort("total_messages")}>Messages {sortField === "total_messages" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                    <th style={{ cursor: "pointer" }} onClick={() => toggleSort("messages_used_today")}>Today {sortField === "messages_used_today" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                    <th style={{ cursor: "pointer" }} onClick={() => toggleSort("days_active")}>Days Since Join {sortField === "days_active" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                    <th style={{ cursor: "pointer" }} onClick={() => toggleSort("active_days")}>Days Active {sortField === "active_days" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                    <th style={{ cursor: "pointer" }} onClick={() => toggleSort("avg_msgs_day")}>Avg/Day {sortField === "avg_msgs_day" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                    <th style={{ cursor: "pointer" }} onClick={() => toggleSort("created_at")}>Joined {sortField === "created_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => {
                    const isActive = (u.total_messages || 0) > 0;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="td-name">{u.name}</div>
                          <div className="td-email">{u.email}</div>
                        </td>
                        <td><span className={`badge ${u.plan === "Free" ? "free" : "pro"}`}>{u.plan}</span></td>
                        <td><span className={`badge ${isActive ? "active" : "ghost"}`}>{isActive ? "active" : "ghost"}</span></td>
                        <td><span className="mono-n">{u.total_messages || 0}</span></td>
                        <td><span className="mono-n">{u.messages_used_today || 0}</span></td>
                        <td><span className="mono-n">{u.days_active || 0}</span></td>
                        <td><span className="mono-n">{u.active_days || 0}</span></td>
                        <td><span className="mono-n">{getAvgMsgsDay(u).toFixed(1)}</span></td>
                        <td style={{ color: "#55546a", fontSize: 10 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="act-row">
                            <select value={u.plan} onChange={e => updatePlan(u.id, e.target.value)} disabled={updatingUser === u.id} className="act" style={{ cursor: "pointer", background: "#18181f", color: "#9896a8", border: "1px solid #333340", borderRadius: 4, fontSize: 9, padding: "3px 6px" }}>
                              <option value="Free">Free</option>
                              <option value="Pro">Pro</option>
                              <option value="Plus">Plus</option>
                            </select>
                            <button className="act out" onClick={async () => {
                              if (!confirm(`Force logout ${u.name}?`)) return;
                              try {
                                const res = await fetch("/api/admin/force-logout", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: u.id }),
                                });
                                const data = await res.json();
                                if (data.success) showToast(`${u.name} logged out.`, "r");
                                else showToast("Failed: " + (data.error || "Unknown error"), "r");
                              } catch { showToast("Failed to force logout user", "r"); }
                            }}>Logout</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sortedUsers.length === 0 && <div className="empty" style={{ display: "block" }}>No users match your filters.</div>}
            <div className="tfoot">
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                  <button className="act" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <span>{currentPage} / {totalPages}</span>
                  <button className="act" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              )}
              Showing {sortedUsers.length} of {users.length} users
            </div>
          </div>
        </div>
      )}

      {/* ══ FINANCE TAB ══ */}
      {activeTab === "finance" && stats && computed && (
        <div className="page-content">
          {/* Top stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
            <div className="sc" style={{ borderColor: "rgba(0,158,115,0.3)" }}>
              <div className="sc-label">MRR</div>
              <div className="sc-val" style={{ color: "#009E73" }}>${computed.mrr.toFixed(2)}</div>
              <div className="sc-sub">monthly recurring</div>
            </div>
            <div className="sc"><div className="sc-label">ARR</div><div className="sc-val">${(computed.mrr * 12).toFixed(2)}</div><div className="sc-sub">annualised run rate</div></div>
            <div className="sc"><div className="sc-label">Paid Users</div><div className="sc-val">{computed.paidCount}</div><div className="sc-sub">of {stats.totalUsers} total ({((computed.paidCount / stats.totalUsers) * 100).toFixed(1)}%)</div></div>
            <div className="sc"><div className="sc-label">ARPU</div><div className="sc-val">${computed.paidCount > 0 ? (computed.mrr / computed.paidCount).toFixed(2) : "0.00"}</div><div className="sc-sub">avg revenue per paid user</div></div>
            <div className="sc"><div className="sc-label">Est. LTV</div><div className="sc-val">${computed.paidCount > 0 ? ((computed.mrr / computed.paidCount) * 18).toFixed(2) : "0.00"}</div><div className="sc-sub">at 18mo avg retention</div></div>
          </div>

          {/* MRR Trend + Forecast */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10, marginBottom: 10 }}>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="MRR Trend" title="MRR Trend" body="Monthly Recurring Revenue over time." how="Sum of all active subscription charges per month." />
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
                <div className="cc-title" style={{ marginBottom: 0 }}>${computed.mrr.toFixed(2)} this month</div>
              </div>
              <div style={{ position: "relative", flex: 1, minHeight: 160 }}>
                <canvas id="mrrTrendChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              </div>
            </div>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Revenue Forecast" title="Revenue Forecast" body="Projected MRR over the next 6 months." how="Assumes current signup rate and conversion holds." />
              <div className="cc-title" style={{ marginBottom: 16 }}>Next 6 months</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#55546a", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Scenario</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["bear", "base", "bull"] as Scenario[]).map(s => (
                    <button key={s} className={`scenario-btn ${scenario === s ? "active" : ""}`} onClick={() => setScenario(s)}>
                      {s === "bear" ? "Conservative" : s === "base" ? "Base" : "Optimistic"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ position: "relative", flex: 1, minHeight: 120 }}>
                <canvas id="forecastChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              </div>
            </div>
          </div>

          {/* Conversion Funnel + Churn Impact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="cc" style={{ display: "flex", flexDirection: "column" }}>
              <InfoKicker label="Conversion Funnel" title="Conversion Funnel" body="How users move from signup → messaging → power use → paying." how="Each bar = users who crossed that threshold." />
              <div className="cc-title" style={{ marginBottom: 14 }}>Signup to paid</div>
              <div style={{ position: "relative", flex: 1, minHeight: 160 }}>
                <canvas id="funnelChart" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              </div>
            </div>
            <div className="cc">
              <InfoKicker label="Churn & Upgrade Impact" title="Churn & Upgrade Impact" body="What happens to MRR if you lose or gain a paid user." how="Shows how fragile or resilient your revenue is right now." />
              <div className="cc-title" style={{ marginBottom: 16 }}>MRR sensitivity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "#0f0f12", borderRadius: 6, padding: "14px 16px", border: "1px solid #2a2a35" }}>
                  <div style={{ fontSize: 10, color: "#55546a", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>If you lose 1 paid user</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: "#e05555" }}>${Math.max(computed.mrr - 4.99, 0).toFixed(2)}</span>
                    <span style={{ fontSize: 12, color: "#e05555" }}>-$4.99 ({computed.paidCount > 0 ? `-${Math.round(100 / computed.paidCount)}%` : "-100%"})</span>
                  </div>
                </div>
                {computed.upgradeTargets[0] && (
                  <div style={{ background: "#0f0f12", borderRadius: 6, padding: "14px 16px", border: "1px solid #2a2a35" }}>
                    <div style={{ fontSize: 10, color: "#55546a", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>If {computed.upgradeTargets[0].name} converts ({computed.upgradeTargets[0].total_messages} msgs)</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: "#009E73" }}>${(computed.mrr + 4.99).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "#009E73" }}>+$4.99 (+{computed.paidCount > 0 ? Math.round(100 / computed.paidCount) : 100}%)</span>
                    </div>
                  </div>
                )}
                <div style={{ background: "#0f0f12", borderRadius: 6, padding: "14px 16px", border: "1px solid #2a2a35" }}>
                  <div style={{ fontSize: 10, color: "#55546a", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>If all {computed.upgradeTargets.filter(u => (u.total_messages || 0) >= 50).length} hot/warm users convert</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: "#FFB000" }}>${(computed.mrr + computed.upgradeTargets.filter(u => (u.total_messages || 0) >= 50).length * 4.99).toFixed(2)}</span>
                    <span style={{ fontSize: 12, color: "#FFB000" }}>+${(computed.upgradeTargets.filter(u => (u.total_messages || 0) >= 50).length * 4.99).toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#55546a", marginTop: 4 }}>Your realistic near-term ceiling</div>
                </div>
              </div>
            </div>
          </div>

          {/* Retention + Growth Targets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div className="cc">
              <InfoKicker label="Retention & Churn" title="Retention & Churn" body="How well you keep users." how="Retention = active users ÷ total signups. Industry benchmark: retention >40%, churn <10%." />
              <div className="ret-block">
                <div className="ret-top"><span className="ret-lbl">Retention Rate</span><span className="ret-val g">{(computed.retentionRate * 100).toFixed(1)}%</span></div>
                <div className="prog"><div className="prog-fill pf-g" style={{ width: `${(computed.retentionRate * 100)}%` }} /></div>
                <div className="ret-note">{computed.activeCount} of {stats.totalUsers} users send 1+ message</div>
              </div>
              <div className="ret-block">
                <div className="ret-top"><span className="ret-lbl">Ghost Rate (Churn)</span><span className="ret-val r">{(computed.ghostRate * 100).toFixed(1)}%</span></div>
                <div className="prog"><div className="prog-fill pf-r" style={{ width: `${(computed.ghostRate * 100)}%` }} /></div>
                <div className="ret-note">{computed.ghosts} users signed up but never messaged</div>
              </div>
              <div className="ret-block">
                <div className="ret-top"><span className="ret-lbl">Paid Conversion</span><span className="ret-val o">{((computed.paidCount / stats.totalUsers) * 100).toFixed(1)}%</span></div>
                <div className="prog"><div className="prog-fill pf-o" style={{ width: `${(computed.paidCount / stats.totalUsers) * 100}%` }} /></div>
                <div className="ret-note">Industry avg for freemium: 2-5%. You have room to grow.</div>
              </div>
            </div>
            <div className="cc">
              <InfoKicker label="Growth Targets" title="Growth Targets" body="How close you are to key milestones." how="MRR target is $500/mo (ramen profitable). User target is 500." />
              <div className="tgt-block">
                <div className="tgt-top">
                  <span className="tgt-lbl">MRR — $500 target</span>
                  <span className="tgt-val" style={{ color: "#FFB000" }}>${computed.mrr.toFixed(2)} / $500 · {((computed.mrr / 500) * 100).toFixed(0)}%</span>
                </div>
                <div className="prog"><div className="prog-fill pf-o" style={{ width: `${Math.min((computed.mrr / 500) * 100, 100)}%` }} /></div>
                <div className="ret-note" style={{ marginBottom: 12 }}>Need {Math.ceil((500 - computed.mrr) / 4.99)} more paid users at $4.99 to hit target</div>
              </div>
              <div className="tgt-block">
                <div className="tgt-top">
                  <span className="tgt-lbl">Users — 500 target</span>
                  <span className="tgt-val" style={{ color: "#009E73" }}>{stats.totalUsers} / 500 · {((stats.totalUsers / 500) * 100).toFixed(0)}%</span>
                </div>
                <div className="prog"><div className="prog-fill pf-g" style={{ width: `${Math.min((stats.totalUsers / 500) * 100, 100)}%` }} /></div>
                <div className="ret-note" style={{ marginBottom: 12 }}>{stats.totalUsers >= 250 ? "Halfway there — strongest metric you have" : "Growing steadily"}</div>
              </div>
              <div className="tgt-block">
                <div className="tgt-top">
                  <span className="tgt-lbl">Paid conversion — 5% target</span>
                  <span className="tgt-val" style={{ color: "#e05555" }}>{((computed.paidCount / stats.totalUsers) * 100).toFixed(1)}% / 5%</span>
                </div>
                <div className="prog"><div className="prog-fill pf-r" style={{ width: `${Math.min(((computed.paidCount / stats.totalUsers) / 0.05) * 100, 100)}%` }} /></div>
                <div className="ret-note" style={{ marginBottom: 12 }}>Need {Math.max(Math.ceil(stats.totalUsers * 0.05) - computed.paidCount, 0)} more paid users to hit freemium benchmark</div>
              </div>
              <div style={{ background: "#0f0f12", borderRadius: 6, padding: "12px 14px", border: "1px solid #2a2a35", marginTop: 4 }}>
                <div style={{ fontSize: 10, color: "#55546a", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>The honest number</div>
                <div style={{ fontSize: 12, color: "#9896a8", lineHeight: 1.7 }}>
                  The lever isn&apos;t more users — it&apos;s converting the ones you have.
                  Fix conversion to 5% and revenue accelerates dramatically.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Targets Modal */}
      {upgradeModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={e => { if (e.target === e.currentTarget) setUpgradeModalOpen(false); }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(720px,95vw)", maxHeight: "80vh", background: "#18181f", border: "1px solid #2a2a35", borderRadius: 10, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #2a2a35" }}>
              <div>
                <div style={{ fontSize: 10, color: "#55546a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Upgrade Targets</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#e8e6f0" }}>All free users · high engagement</div>
              </div>
              <button onClick={() => setUpgradeModalOpen(false)} style={{ fontFamily: "inherit", fontSize: 18, background: "none", border: "none", color: "#55546a", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 24px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["USER", "MESSAGES", "ENGAGEMENT", "DAYS", "AVG/DAY", "HEAT"].map(h => (
                      <th key={h} style={{ textAlign: h === "USER" || h === "ENGAGEMENT" ? "left" : "center", padding: "8px 10px", fontSize: 9, letterSpacing: 1, color: "#55546a", fontWeight: 400, borderBottom: "1px solid #2a2a35" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.plan === "Free" && (u.total_messages || 0) >= 1).sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0)).map(u => {
                    const h = heatLevel(u.total_messages || 0);
                    const maxM = computed?.upgradeTargets[0]?.total_messages || 1;
                    const pct = Math.round((u.total_messages || 0) / maxM * 100);
                    const initials = u.name.split(" ").map(w => w[0]).slice(0, 2).join("");
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid #1a1a22" }}>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: h.color + "22", border: `1px solid ${h.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: h.color, flexShrink: 0 }}>{initials}</div>
                            <div>
                              <div style={{ color: "#e8e6f0", fontSize: 12 }}>{u.name}</div>
                              <div style={{ color: "#55546a", fontSize: 10 }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: 10, color: h.color, fontWeight: 600, fontSize: 14 }}>{u.total_messages || 0}</td>
                        <td style={{ padding: 10, minWidth: 120 }}>
                          <div style={{ height: 4, background: "#1e1e27", borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: h.color, borderRadius: 2, opacity: 0.7 }} />
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: 10, color: "#9896a8" }}>{u.days_active}</td>
                        <td style={{ textAlign: "center", padding: 10, color: "#9896a8" }}>{getAvgMsgsDay(u).toFixed(1)}</td>
                        <td style={{ textAlign: "center", padding: 10 }}>
                          <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 3, background: h.bg, color: h.color, border: `1px solid ${h.border}` }}>{h.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast show ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}

// ── Info Kicker component (tooltip on hover) ──
function InfoKicker({ label, title, body, how }: { label: string; title: string; body: string; how: string }) {
  return (
    <div className="cc-kicker" style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {label}
      <span className="info-icon">
        ⓘ
        <div className="tooltip">
          <div className="tooltip-title">{title}</div>
          <div className="tooltip-body">{body}</div>
          <div className="tooltip-how"><strong>How:</strong> {how}</div>
        </div>
      </span>
    </div>
  );
}

// ── CSS ──
const adminCSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
.admin-page{
  --bg:#0f0f12;--surface:#18181f;--surface2:#1e1e27;
  --border:#2a2a35;--border2:#333340;
  --text:#e8e6f0;--text2:#9896a8;--text3:#55546a;
  --orange:#648FFF;--orange-dim:rgba(100,143,255,0.15);
  --green:#009E73;--green-dim:rgba(0,158,115,0.12);
  --red:#e05555;--red-dim:rgba(224,85,85,0.12);
  background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:13px;line-height:1.5;min-height:100vh;
  height:100vh;overflow-y:auto;
}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 20px;max-width:1400px;margin:0 auto;height:48px;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:100;}
.topbar-left{display:flex;align-items:center;gap:12px;}
.brand{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--text);}
.brand svg{color:var(--orange);}
.live-badge{font-size:10px;color:var(--green);background:var(--green-dim);border:1px solid rgba(62,207,110,0.25);padding:2px 8px;border-radius:4px;display:flex;align-items:center;gap:4px;}
.live-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.topbar-right{display:flex;gap:8px;}
.tbtn{font-size:11px;padding:5px 12px;border-radius:5px;cursor:pointer;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);transition:all 0.15s;font-family:inherit;}
.tbtn:hover{color:var(--text);border-color:var(--text3);}
.tbtn.danger{color:#FE6100;border-color:rgba(254,97,0,0.3);}
.tbtn.danger:hover{background:rgba(254,97,0,0.12);}
.tabs{display:flex;padding:0 20px;max-width:1400px;margin:0 auto;border-bottom:1px solid var(--border);background:var(--bg);}
.tab{font-size:12px;padding:12px 16px;cursor:pointer;background:none;border:none;color:var(--text3);border-bottom:2px solid transparent;transition:all 0.15s;letter-spacing:0.2px;font-family:inherit;}
.tab:hover:not(.active){color:var(--text2);}
.tab.active{color:var(--text);border-bottom-color:#648FFF;}
.page-content{padding:20px;max-width:1400px;margin:0 auto;}
.stat-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:20px;}
.sc{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;}
.sc-label{font-size:10px;color:var(--text3);margin-bottom:8px;letter-spacing:0.3px;}
.sc-val{font-size:24px;font-weight:700;color:var(--text);line-height:1;margin-bottom:4px;}
.sc-sub{font-size:10px;color:var(--text3);}
.sc-sub .g{color:var(--green);}
.sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.sec-title{font-size:13px;font-weight:600;color:var(--text2);}
.period-row{display:flex;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:2px;}
.pb{font-size:10px;padding:3px 10px;border-radius:3px;cursor:pointer;border:none;background:transparent;color:var(--text3);transition:all 0.15s;font-family:inherit;}
.pb.active{background:var(--surface2);color:var(--text);}
.row2{display:grid;grid-template-columns:3fr 2fr;gap:10px;margin-bottom:10px;}
.cc{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;}
.cc-kicker{font-size:10px;color:var(--text3);margin-bottom:2px;letter-spacing:0.3px;}
.cc-title{font-size:16px;font-weight:600;color:var(--text);margin-bottom:14px;}
.chart-legend{display:flex;gap:14px;margin-bottom:10px;font-size:10px;color:var(--text3);}
.legend-item{display:flex;align-items:center;gap:5px;}
.legend-sq{width:8px;height:8px;border-radius:2px;}
.user-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:5px;cursor:pointer;transition:background 0.1s;}
.user-row:hover{background:var(--surface2);}
.user-row.rank1{background:rgba(100,143,255,0.1);}
.ur-rank{color:var(--text3);font-size:10px;width:14px;flex-shrink:0;}
.ur-info{flex:1;min-width:0;}
.ur-name{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ur-bar{height:2px;background:var(--border);border-radius:1px;margin-top:4px;}
.ur-fill{height:100%;border-radius:1px;background:#648FFF;opacity:0.6;}
.ur-count{font-size:17px;font-weight:700;color:#648FFF;}
.ur-count.dim{color:var(--text2);font-size:14px;font-weight:600;}
.donut-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;}
.donut-rel{position:relative;width:130px;height:130px;margin-bottom:14px;}
.donut-inner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;}
.donut-num{font-size:26px;font-weight:700;color:var(--text);}
.donut-sub{font-size:9px;color:var(--text3);letter-spacing:0.5px;}
.leg{width:100%;}
.leg-r{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-top:1px solid var(--border);font-size:10px;}
.leg-l2{display:flex;align-items:center;gap:6px;color:var(--text2);}
.leg-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.leg-right{color:var(--text3);}
.leg-right strong{color:var(--text2);font-weight:500;}
.tbl-wrap{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;}
.tbl-head{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px;}
.tbl-title{font-size:13px;font-weight:600;color:var(--text2);}
.tbl-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.sinp{font-family:inherit;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:6px 11px;outline:none;transition:border-color 0.15s;width:170px;}
.sinp::placeholder{color:var(--text3);}
.sinp:focus{border-color:rgba(100,143,255,0.5);}
.csv-btn{font-size:11px;padding:6px 12px;border-radius:5px;cursor:pointer;background:#648FFF;border:none;color:#fff;font-weight:500;transition:opacity 0.15s;font-family:inherit;}
.csv-btn:hover{opacity:0.85;}
table{width:100%;border-collapse:collapse;}
thead th{padding:9px 18px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);font-weight:500;user-select:none;}
tbody td{padding:10px 18px;font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);vertical-align:middle;}
tbody tr:last-child td{border-bottom:none;}
tbody tr:hover td{background:var(--surface2);}
.td-name{color:var(--text);font-size:12px;margin-bottom:1px;}
.td-email{color:var(--text3);font-size:10px;}
.badge{font-size:9px;padding:2px 7px;border-radius:4px;border:1px solid;letter-spacing:0.3px;}
.badge.free{color:var(--text3);border-color:var(--border2);background:transparent;}
.badge.pro{color:#FFB000;border-color:rgba(255,176,0,0.3);background:rgba(255,176,0,0.1);}
.badge.active{color:#009E73;border-color:rgba(0,158,115,0.25);background:rgba(0,158,115,0.1);}
.badge.ghost{color:var(--text3);border-color:var(--border);background:transparent;}
.mono-n{font-size:14px;font-weight:600;color:var(--text);}
.act-row{display:flex;gap:4px;align-items:center;}
.act{font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;border:1px solid var(--border2);background:transparent;color:var(--text3);transition:all 0.15s;font-family:inherit;}
.act:hover{color:var(--text);border-color:var(--text3);}
.act.out{border-color:rgba(224,85,85,0.25);color:var(--red);}
.act.out:hover{background:var(--red-dim);border-color:var(--red);}
.tfoot{padding:10px 18px;border-top:1px solid var(--border);font-size:10px;color:var(--text3);}
.empty{text-align:center;padding:40px;color:var(--text3);display:none;}
.ret-block{margin-bottom:18px;}
.ret-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;}
.ret-lbl{font-size:10px;color:var(--text3);letter-spacing:0.5px;text-transform:uppercase;}
.ret-val{font-size:20px;font-weight:700;}
.ret-val.g{color:#009E73;}
.ret-val.r{color:var(--red);}
.ret-val.o{color:var(--orange);}
.prog{height:4px;background:var(--border);border-radius:2px;margin-bottom:5px;}
.prog-fill{height:100%;border-radius:2px;}
.pf-g{background:#009E73;}
.pf-r{background:var(--red);}
.pf-o{background:#648FFF;}
.ret-note{font-size:10px;color:var(--text3);}
.tgt-block{margin-bottom:14px;}
.tgt-top{display:flex;justify-content:space-between;margin-bottom:6px;font-size:10px;}
.tgt-lbl{color:var(--text3);letter-spacing:0.3px;text-transform:uppercase;}
.tgt-val{color:var(--text2);}
.toast{position:fixed;bottom:22px;right:22px;z-index:999;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;padding:11px 18px;font-size:11px;color:var(--text);transform:translateY(60px);opacity:0;transition:all 0.25s;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,0.5);}
.toast.show{transform:translateY(0);opacity:1;}
.toast.g{border-left:3px solid var(--green);}
.toast.r{border-left:3px solid var(--red);}
.info-icon{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid #2a2a35;color:#55546a;font-size:9px;cursor:default;position:relative;flex-shrink:0;transition:all 0.15s;}
.info-icon:hover{background:rgba(100,143,255,0.15);border-color:#648FFF;color:#648FFF;}
.info-icon .tooltip{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:260px;background:#1e1e27;border:1px solid #2a2a35;border-radius:7px;padding:12px 14px;z-index:300;pointer-events:none;}
.info-icon:hover .tooltip{display:block;}
.tooltip-title{font-size:11px;font-weight:600;color:#e8e6f0;margin-bottom:6px;}
.tooltip-body{font-size:10px;color:#9896a8;line-height:1.6;margin-bottom:8px;}
.tooltip-how{font-size:10px;color:#55546a;line-height:1.5;padding-top:8px;border-top:1px solid #2a2a35;}
.tooltip-how strong{color:#648FFF;font-weight:500;}
.scenario-btn{font-family:inherit;font-size:10px;padding:4px 12px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid #2a2a35;color:#55546a;transition:all 0.15s;}
.scenario-btn:hover{color:#9896a8;border-color:#3a3a45;}
.scenario-btn.active{background:rgba(100,143,255,0.12);border-color:#648FFF;color:#648FFF;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
@media (max-width:900px){
  .stat-grid{grid-template-columns:repeat(3,1fr)!important;}
  .row2{grid-template-columns:1fr!important;}
}
@media (max-width:600px){
  .stat-grid{grid-template-columns:repeat(2,1fr)!important;}
  .tbl-controls{flex-direction:column;align-items:stretch;}
}
`;
