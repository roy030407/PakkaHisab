/**
 * FILE: components/reports/MerchantActivityCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows merchant usage analytics for the last 28 days: active days,
 *   feature adoption (scan vs voice vs manual), week-over-week growth bars,
 *   and a daily activity sparkline. Evidence of real engagement for demos.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for merchant activity analytics
 *
 * WHERE IT FITS:
 *   Rendered at the bottom of app/(dashboard)/reports/page.tsx.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'
import { Activity, Zap, Camera, Mic, PenLine, Edit3 } from 'lucide-react'

interface ActivityData {
  activeDays: number
  totalDays: number
  totalTransactions: number
  sourceBreakdown: {
    manual_quick: number
    manual_full: number
    bill_scan: number
    voice: number
    other: number
  }
  weeklyTotals: { label: string; count: number; sales: number }[]
  dailyCounts: number[]
  growth: number | null
}

const SOURCE_META = [
  { key: 'bill_scan',    label: 'Bill Scan',    icon: Camera,  color: 'bg-violet-500' },
  { key: 'voice',        label: 'Voice',        icon: Mic,     color: 'bg-rose-500'   },
  { key: 'manual_quick', label: 'Quick Entry',  icon: Zap,     color: 'bg-emerald-500'},
  { key: 'manual_full',  label: 'Full Entry',   icon: Edit3,   color: 'bg-amber-500'  },
  { key: 'other',        label: 'Other',        icon: PenLine, color: 'bg-gray-400'   },
] as const

export function MerchantActivityCard() {
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/activity')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-24 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!data || data.totalTransactions === 0) return null

  const maxWeek = Math.max(...data.weeklyTotals.map(w => w.count), 1)
  const maxDay = Math.max(...data.dailyCounts, 1)
  const totalSrc = Object.values(data.sourceBreakdown).reduce((s, v) => s + v, 0) || 1

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <Activity size={16} className="text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Merchant Activity</p>
            <p className="text-xs text-gray-400">Last 28 days</p>
          </div>
        </div>
        {data.growth !== null && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            data.growth >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {data.growth >= 0 ? '+' : ''}{data.growth}% this week
          </span>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{data.activeDays}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active days</p>
          <p className="text-[10px] text-gray-400">of {data.totalDays}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{data.totalTransactions}</p>
          <p className="text-xs text-gray-500 mt-0.5">Transactions</p>
          <p className="text-[10px] text-gray-400">entered</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">
            {Math.round(data.totalTransactions / Math.max(data.activeDays, 1))}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Per active</p>
          <p className="text-[10px] text-gray-400">day avg</p>
        </div>
      </div>

      {/* Daily sparkline */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Daily transactions (28 days)</p>
        <div className="flex items-end gap-0.5 h-12">
          {data.dailyCounts.map((count, i) => (
            <div
              key={i}
              title={`${count} transactions`}
              className="flex-1 rounded-sm bg-emerald-400 opacity-80 hover:opacity-100 transition-opacity"
              style={{ height: `${Math.max(4, (count / maxDay) * 100)}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">27 days ago</span>
          <span className="text-[10px] text-gray-400">Today</span>
        </div>
      </div>

      {/* Weekly growth bars */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Weekly transaction trend</p>
        <div className="flex items-end gap-2 h-16">
          {data.weeklyTotals.map((wk, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-700">{wk.count}</span>
              <div
                className="w-full rounded-t-md bg-emerald-600"
                style={{ height: `${Math.max(6, (wk.count / maxWeek) * 52)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-1">
          {data.weeklyTotals.map((wk, i) => (
            <p key={i} className="flex-1 text-center text-[10px] text-gray-400">{wk.label}</p>
          ))}
        </div>
      </div>

      {/* Feature adoption */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">How entries were made</p>
        <div className="space-y-2">
          {SOURCE_META.filter(s => data.sourceBreakdown[s.key] > 0).map(s => {
            const count = data.sourceBreakdown[s.key]
            const pct = Math.round((count / totalSrc) * 100)
            const Icon = s.icon
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className="flex w-24 items-center gap-1.5 shrink-0">
                  <Icon size={12} className="text-gray-500 shrink-0" />
                  <span className="text-xs text-gray-600 truncate">{s.label}</span>
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-10 text-right shrink-0">
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
