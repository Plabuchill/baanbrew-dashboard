import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import KpiCard from './components/KpiCard'
import DailySalesChart from './components/DailySalesChart'
import BranchSalesChart from './components/BranchSalesChart'
import FilterBar from './components/FilterBar'
import HourlyOrdersSection from './components/HourlyOrdersSection'
import {
  averageOrderValue,
  branchList,
  dailySales,
  dateBounds,
  filterRows,
  formatBaht,
  formatNumber,
  formatThaiDate,
  hourRange,
  movingAverage,
  normalizeRows,
  orderCount,
  ordersByHour,
  ordersByHourByBranch,
  peakHour,
  salesByBranch,
  totalSales,
  uniqueMembers,
} from './lib/metrics'

function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(null)

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = normalizeRows(result.data)
        const { min, max } = dateBounds(data)
        setRows(data)
        setFilters({ branch: 'all', from: min, to: max })
      },
      error: (err) => setError(err.message),
    })
  }, [])

  // ค่าคงที่ของชุดข้อมูล (ไม่เปลี่ยนตามตัวกรอง)
  const meta = useMemo(
    () => (rows ? { bounds: dateBounds(rows), branches: branchList(rows), hours: hourRange(rows) } : null),
    [rows],
  )

  const stats = useMemo(() => {
    if (!rows || !filters || !meta) return null
    // KPI และกราฟรายวัน: กรองทั้งสาขาและวันที่
    const selected = filterRows(rows, filters)
    // กราฟแท่ง: กรองเฉพาะวันที่ ให้ยังเทียบกับสาขาอื่นได้ แล้วไฮไลต์สาขาที่เลือก
    const inRange = filterRows(rows, { from: filters.from, to: filters.to })
    // ค่าเฉลี่ย 7 วัน: คำนวณจากทุกวันของสาขาที่เลือกก่อน แล้วค่อยตัดตามช่วงวันที่
    // วันแรก ๆ ของช่วงจึงใช้ยอด 6 วันก่อนหน้าได้ เส้นเฉลี่ยไม่ขาดตอนต้นช่วง
    const branchDaily = movingAverage(dailySales(filterRows(rows, { branch: filters.branch })), 7)
    const daily = branchDaily.filter((d) => d.date >= filters.from && d.date <= filters.to)
    // จำนวนบิลตามชั่วโมง: กราฟรวมใช้ตัวกรองครบ · กราฟแยกสาขากรองเฉพาะวันที่ (เหมือนกราฟแท่งสาขา)
    const hourly = ordersByHour(selected, meta.hours)
    return {
      lines: selected.length,
      total: totalSales(selected),
      orders: orderCount(selected),
      avg: averageOrderValue(selected),
      members: uniqueMembers(selected),
      daily,
      branches: salesByBranch(inRange),
      hourly: { data: hourly, peak: peakHour(hourly) },
      hourlyByBranch: ordersByHourByBranch(inRange, meta.branches, meta.hours),
      hourlyPerDayByBranch: ordersByHourByBranch(inRange, meta.branches, meta.hours, { perDay: true }),
    }
  }, [rows, filters, meta])

  if (error) return <Centered>โหลดข้อมูลไม่สำเร็จ: {error}</Centered>
  if (!stats) return <Centered>กำลังโหลดข้อมูล...</Centered>

  const branchLabel = filters.branch === 'all' ? 'ทุกสาขา' : `สาขา${filters.branch}`

  return (
    <div className="min-h-screen bg-sky-50 text-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-2xl font-bold text-blue-800 sm:text-3xl">บ้านบรู Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">
            {branchLabel} · {formatThaiDate(filters.from)} – {formatThaiDate(filters.to)} ·{' '}
            {formatNumber(stats.lines)} รายการสินค้า
          </p>
        </header>

        <FilterBar branches={meta.branches} bounds={meta.bounds} filters={filters} onChange={setFilters} />

        {stats.lines === 0 ? (
          <div className="rounded-xl border border-blue-100 bg-white p-8 text-center text-stone-500 shadow-sm">
            ไม่มียอดขายของ{branchLabel}ในช่วงวันที่ที่เลือก
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <KpiCard label="ยอดขายรวม" value={formatBaht(stats.total)} />
              <KpiCard label="จำนวนบิล" value={formatNumber(stats.orders)} note="นับ order_id ไม่ซ้ำ" />
              <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(stats.avg, { decimals: true })} />
              <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatNumber(stats.members)} note="ไม่รวมลูกค้าทั่วไป" />
            </section>

            <section className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
              <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">ยอดขายรายวัน · {branchLabel}</h2>
              <DailySalesChart data={stats.daily} />
            </section>

            <section className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
              <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">ยอดขายแยกสาขา</h2>
              <BranchSalesChart data={stats.branches} highlight={filters.branch} />
            </section>

            <HourlyOrdersSection
              overall={stats.hourly}
              byBranch={stats.hourlyByBranch}
              perDayByBranch={stats.hourlyPerDayByBranch}
              branchLabel={branchLabel}
              highlight={filters.branch}
            />
          </>
        )}
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center text-stone-500">{children}</div>
}

export default App
