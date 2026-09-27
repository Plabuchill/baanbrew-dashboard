import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import KpiCard from './components/KpiCard'
import DailySalesChart from './components/DailySalesChart'
import BranchSalesChart from './components/BranchSalesChart'
import {
  averageOrderValue,
  dailySales,
  formatBaht,
  formatNumber,
  formatThaiDate,
  movingAverage,
  normalizeRows,
  orderCount,
  salesByBranch,
  totalSales,
  uniqueMembers,
} from './lib/metrics'

function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(normalizeRows(result.data)),
      error: (err) => setError(err.message),
    })
  }, [])

  const stats = useMemo(() => {
    if (!rows) return null
    return {
      total: totalSales(rows),
      orders: orderCount(rows),
      avg: averageOrderValue(rows),
      members: uniqueMembers(rows),
      daily: movingAverage(dailySales(rows), 7),
      branches: salesByBranch(rows),
    }
  }, [rows])

  if (error) return <Centered>โหลดข้อมูลไม่สำเร็จ: {error}</Centered>
  if (!stats) return <Centered>กำลังโหลดข้อมูล...</Centered>

  const first = stats.daily[0]?.date
  const last = stats.daily.at(-1)?.date

  return (
    <div className="min-h-screen bg-sky-50 text-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-blue-800 sm:text-3xl">บ้านบรู Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">
            ข้อมูล {formatThaiDate(first)} – {formatThaiDate(last)} · {formatNumber(rows.length)} รายการสินค้า
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard label="ยอดขายรวม" value={formatBaht(stats.total)} />
          <KpiCard label="จำนวนบิล" value={formatNumber(stats.orders)} note="นับ order_id ไม่ซ้ำ" />
          <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(stats.avg, { decimals: true })} />
          <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatNumber(stats.members)} note="ไม่รวมลูกค้าทั่วไป" />
        </section>

        <section className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
          <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">ยอดขายรายวัน</h2>
          <DailySalesChart data={stats.daily} />
        </section>

        <section className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
          <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">ยอดขายแยกสาขา</h2>
          <BranchSalesChart data={stats.branches} />
        </section>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center text-stone-500">{children}</div>
}

export default App
