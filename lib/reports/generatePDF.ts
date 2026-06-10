/**
 * FILE: lib/reports/generatePDF.ts
 *
 * WHAT THIS DOES:
 *   Server-only function that generates a PDF report using @react-pdf/renderer.
 *   Produces a clean A4 document with summary stats, top products, and tax
 *   details for the given PeriodReport. Returns a Buffer.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 7 report export
 *
 * WHERE IT FITS:
 *   Called by /api/reports/pdf route. Never imported by client components.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/reports/pdf/route.ts
 */
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import type { PeriodReport } from '@/types'

function fmt(n: number): string {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', padding: 48, fontSize: 10, color: '#111827' },
  header:      { marginBottom: 24 },
  storeName:   { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  period:      { fontSize: 10, color: '#6B7280' },
  section:     { marginBottom: 20 },
  sectionTitle:{ fontSize: 11, fontWeight: 'bold', marginBottom: 10, color: '#374151' },
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label:       { color: '#6B7280' },
  value:       { fontWeight: 'bold' },
  divider:     { borderBottom: '1pt solid #E5E7EB', marginBottom: 12, marginTop: 4 },
  tableRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
                 borderBottom: '0.5pt solid #F3F4F6' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
                 borderBottom: '1pt solid #D1D5DB', marginBottom: 2 },
  tableHead:   { fontWeight: 'bold', fontSize: 9, color: '#6B7280', textTransform: 'uppercase' },
  footer:      { position: 'absolute', bottom: 32, left: 48, right: 48,
                 fontSize: 8, color: '#9CA3AF', textAlign: 'center' },
})

function buildDocument(storeName: string, period: string, report: PeriodReport) {
  return React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: s.page },

      // Header
      React.createElement(View, { style: s.header },
        React.createElement(Text, { style: s.storeName }, storeName),
        React.createElement(Text, { style: s.period },
          `${report.periodLabel} · ${report.transactionCount} transactions`),
      ),

      // Summary
      React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, 'Summary'),
        React.createElement(View, { style: s.divider }),
        ...[
          ['Total sales',     fmt(report.sales)],
          ['Total purchases', fmt(report.purchases)],
          ['Gross margin',    fmt(report.grossMargin)],
          ['Fixed costs',     fmt(report.fixedCosts)],
          ['Net profit',      fmt(report.netProfit)],
        ].map(([label, value]) =>
          React.createElement(View, { style: s.row, key: label },
            React.createElement(Text, { style: s.label }, label),
            React.createElement(Text, { style: s.value }, value),
          )
        ),
      ),

      // Payment methods
      React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, 'Payment Methods'),
        React.createElement(View, { style: s.divider }),
        ...[
          ['Cash', fmt(report.paymentBreakdown.cash)],
          ['UPI',  fmt(report.paymentBreakdown.upi)],
          ['Credit (outstanding)', fmt(report.paymentBreakdown.credit)],
        ].map(([label, value]) =>
          React.createElement(View, { style: s.row, key: label },
            React.createElement(Text, { style: s.label }, label),
            React.createElement(Text, { style: s.value }, value),
          )
        ),
      ),

      // Tax
      React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, 'GST Summary'),
        React.createElement(View, { style: s.divider }),
        ...[
          ['GST collected on sales',    fmt(report.taxSummary.collected)],
          ['GST paid on purchases',     fmt(report.taxSummary.paid)],
          ['Net GST payable',           fmt(report.taxSummary.payable)],
        ].map(([label, value]) =>
          React.createElement(View, { style: s.row, key: label },
            React.createElement(Text, { style: s.label }, label),
            React.createElement(Text, { style: s.value }, value),
          )
        ),
      ),

      // Top products
      report.topProducts.length > 0 && React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, 'Top Products'),
        React.createElement(View, { style: s.divider }),
        React.createElement(View, { style: s.tableHeader },
          React.createElement(Text, { style: s.tableHead }, 'Product'),
          React.createElement(Text, { style: s.tableHead }, 'Revenue'),
          React.createElement(Text, { style: s.tableHead }, 'Units'),
        ),
        ...report.topProducts.slice(0, 10).map((p) =>
          React.createElement(View, { style: s.tableRow, key: p.productId },
            React.createElement(Text, { style: { flex: 1 } }, p.productName),
            React.createElement(Text, {}, fmt(p.revenue)),
            React.createElement(Text, { style: { width: 40, textAlign: 'right' } },
              String(p.quantity)),
          )
        ),
      ),

      // Footer
      React.createElement(Text, { style: s.footer },
        `Generated by PakkaHisab · ${new Date().toLocaleDateString('en-IN')} · ${period} report`
      ),
    )
  )
}

export async function generateReportPDF(
  storeName: string,
  period: string,
  report: PeriodReport,
): Promise<Buffer> {
  const doc = buildDocument(storeName, period, report)
  return await renderToBuffer(doc)
}
