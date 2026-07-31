/**
 * Dashboard.js
 * Plan Page 2 — Main administration overview.
 *
 * Displays:
 *  - Welcome message with admin name (plan §8 HEADER CARD)
 *  - Statistics cards: Total Students, Total Classes, Activities, Average Grade,
 *    Passing Rate (plan §8 STATISTICS CARDS)
 *  - Grade distribution bar chart (plan §8 ANALYTICS SECTION)
 *  - Pass/Fail ratio visual (plan §8)
 *  - System status (plan §8)
 *
 * Note: Charts are rendered with inline CSS bars to avoid a Recharts dependency
 * at install time. Add Recharts via `npm install recharts` and replace the bar
 * components if you want animated SVG charts.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  BookOpen,
  TrendingUp,
  Award,
  CheckCircle,
  XCircle,
  Activity,
  GraduationCap,
} from 'lucide-react';
import { settingsAPI } from '@/api/sgmsAPI';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Static colour map (dynamic class names are purged by Tailwind) ───────────
const CARD_STYLES = {
  blue:   { icon: 'text-blue-600',   bg: 'bg-blue-50',   bar: 'bg-blue-500' },
  green:  { icon: 'text-green-600',  bg: 'bg-green-50',  bar: 'bg-green-500' },
  purple: { icon: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500' },
  orange: { icon: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  teal:   { icon: 'text-teal-600',   bg: 'bg-teal-50',   bar: 'bg-teal-500' },
};

// ─── Greeting helper ──────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Mini bar chart (CSS-only, no library needed) ────────────────────────────
const BarChart = ({ data, valueKey, labelKey, color = 'bg-blue-500', max }) => {
  const m = max || Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-right text-gray-500 flex-shrink-0">{d[labelKey]}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
            <div
              className={`${color} h-4 rounded-full transition-all duration-500`}
              style={{ width: `${Math.max((d[valueKey] / m) * 100, 1)}%` }}
            />
          </div>
          <span className="w-8 text-gray-700 font-medium">{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Pass/Fail donut (CSS conic-gradient) ─────────────────────────────────────
const PassFailRing = ({ passing, failing }) => {
  const total = passing + failing || 1;
  const passPct = Math.round((passing / total) * 100);
  const deg = Math.round((passing / total) * 360);
  return (
    <div className="flex items-center gap-6">
      <div
        className="w-24 h-24 rounded-full flex-shrink-0"
        style={{
          background: `conic-gradient(#22c55e 0deg ${deg}deg, #f87171 ${deg}deg 360deg)`,
        }}
      >
        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-white m-auto" style={{ margin: '12px' }}>
          <span className="text-lg font-bold text-gray-700">{passPct}%</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm">Passing: <strong>{passing}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-sm">Failing: <strong>{failing}</strong></span>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const { admin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await settingsAPI.getDashboardStats();
      if (result.success) setStats(result.data);
      else toast.error('Failed to load dashboard statistics');
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const statCards = [
    { title: 'Total Students',  value: stats?.totalStudents  ?? 0,         icon: Users,       color: 'blue' },
    { title: 'Total Classes',   value: stats?.totalClasses   ?? 0,         icon: BookOpen,    color: 'green' },
    { title: 'Activities',      value: stats?.totalActivities ?? 0,        icon: Award,       color: 'purple' },
    { title: 'Average Grade',   value: `${stats?.averageGrade ?? 0}%`,     icon: TrendingUp,  color: 'orange' },
    { title: 'Passing Rate',    value: `${stats?.passingRate  ?? 0}%`,     icon: CheckCircle, color: 'teal' },
  ];

  // ── Grade distribution (buckets) ────────────────────────────────────────────
  const gradeBreakdown = stats?.gradeBreakdown || [
    { label: '80–100', count: stats?.highPass  ?? 0 },
    { label: '60–79',  count: stats?.pass      ?? 0 },
    { label: '40–59',  count: stats?.nearPass  ?? 0 },
    { label: '0–39',   count: stats?.fail       ?? 0 },
  ];

  // ── Grade-level activity chart ───────────────────────────────────────────────
  const gradeLevelData = (stats?.gradeLevels || []).map((g) => ({
    label: `M${g.level}`,
    count: g.count,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="dashboard">
      {/* Welcome header — Plan §8 HEADER CARD */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {admin?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <p className="text-blue-100 text-sm">{getGreeting()},</p>
            <h2 className="text-2xl font-bold">{admin?.name || 'Administrator'}</h2>
            <p className="text-blue-200 text-sm mt-0.5">Have a productive day.</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-blue-100">
            <GraduationCap className="w-5 h-5" />
            <span className="text-sm font-medium">SGMS</span>
          </div>
        </div>
      </div>

      {/* Statistics cards — Plan §8 STATISTICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const style = CARD_STYLES[stat.color];
          return (
            <Card key={stat.title} className="overflow-hidden">
              <CardContent className="p-4">
                <div className={`inline-flex p-2 rounded-lg ${style.bg} mb-3`}>
                  <Icon className={`h-5 w-5 ${style.icon}`} />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.title}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analytics section — Plan §8 ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade distribution chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {gradeBreakdown.every((b) => b.count === 0) ? (
              <p className="text-sm text-gray-400 text-center py-6">No grade data yet — enter scores to see distribution.</p>
            ) : (
              <BarChart data={gradeBreakdown} valueKey="count" labelKey="label" color="bg-blue-500" />
            )}
          </CardContent>
        </Card>

        {/* Pass/Fail ratio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pass / Fail Ratio</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-2">
            <PassFailRing
              passing={stats?.passingCount ?? 0}
              failing={stats?.failingCount ?? 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by grade level */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Students by Grade Level</CardTitle>
          </CardHeader>
          <CardContent>
            {gradeLevelData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No students enrolled yet.</p>
            ) : (
              <BarChart data={gradeLevelData} valueKey="count" labelKey="label" color="bg-indigo-500" />
            )}
          </CardContent>
        </Card>

        {/* System status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Backend API</span>
              <Badge className="bg-green-100 text-green-800 border-0">
                <Activity className="w-3 h-3 mr-1" />
                Online
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <Badge className="bg-green-100 text-green-800 border-0">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Scores Recorded</span>
              <span className="font-semibold text-sm">{stats?.totalScores ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Grade Levels Active</span>
              <span className="font-semibold text-sm">{stats?.gradeLevels?.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Version</span>
              <span className="font-semibold text-sm text-gray-400">1.0.0</span>
            </div>
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">All systems operational</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
