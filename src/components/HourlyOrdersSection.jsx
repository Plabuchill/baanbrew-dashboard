import { useState } from 'react'
import { formatHour, formatNumber } from '../lib/metrics'
import HourlyOrdersChart from './HourlyOrdersChart'
import useIsMobile from '../hooks/useIsMobile'

const MODES = [
  { key: 'count', label: 'จำนวนบิล' },
  { key: 'perDay', label: 'เฉลี่ยต่อวัน' },
]

const formatCount = (v) => `${formatNumber(v)} บิล`
const formatPerDay = (v) => `${v.toFixed(1)} บิล/วัน`

// ปัดเพดานแกนขึ้นเป็นเลขกลม ๆ (เช่น 1,243 → 1,500 · 17.3 → 20) ให้ขีดแกนอ่านง่าย
function niceCeil(n) {
  if (n <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * p >= n)
  return step * p
}

// ส่วน "จำนวนบิลตามชั่วโมงของวัน": กราฟรวมตามตัวกรอง + กราฟย่อยแยกทุกสาขา (สเกลแกน Y เดียวกัน)
function HourlyOrdersSection({ overall, byBranch, perDayByBranch, branchLabel, highlight }) {
  const isMobile = useIsMobile()
  const [mode, setMode] = useState('count')
  const panels = mode === 'count' ? byBranch : perDayByBranch
  const valueFormatter = mode === 'count' ? formatCount : formatPerDay
  const yMax = niceCeil(Math.max(...panels.flatMap((p) => p.data.map((d) => d.orders))))
  const overallPeak = overall.peak

  return (
    <section className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
      <h2 className="text-base font-semibold sm:text-lg">จำนวนบิลตามชั่วโมงของวัน · {branchLabel}</h2>
      {overallPeak && (
        <p className="mt-1 text-sm text-stone-500">
          ชั่วโมงที่มีบิลมากที่สุด {formatHour(overallPeak.hour)} ({formatNumber(overallPeak.orders)} บิล) · นับบิลตามเวลาที่ออกบิล
        </p>
      )}
      <div className="mt-3">
        <HourlyOrdersChart
          data={overall.data}
          peak={overallPeak}
          yMax={niceCeil(overallPeak?.orders ?? 0)}
          height={isMobile ? 220 : 260}
          valueFormatter={formatCount}
          yTickFormatter={(v) => formatNumber(v)}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
        <h3 className="text-sm font-semibold text-stone-700 sm:text-base">แยกตามสาขา</h3>
        <div className="flex rounded-lg bg-blue-50 p-1" role="group" aria-label="หน่วยของกราฟแยกสาขา">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                mode === m.key ? 'bg-white text-blue-800 shadow-sm' : 'text-stone-600 hover:text-blue-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {mode === 'count'
          ? 'ทุกกราฟใช้สเกลเดียวกัน · สาขาที่เปิดทีหลังจะมีบิลรวมน้อยกว่าเพราะมีจำนวนวันน้อยกว่า'
          : 'หารด้วยจำนวนวันที่แต่ละสาขามียอดขาย จึงเทียบสาขาที่เปิดไม่นานเท่ากันได้ยุติธรรม'}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {panels.map((p) => {
          const muted = highlight !== 'all' && highlight !== p.branch
          return (
            <div
              key={p.branch}
              className={`rounded-lg border p-3 ${muted ? 'border-stone-100' : 'border-blue-100'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm font-semibold ${muted ? 'text-stone-400' : 'text-stone-800'}`}>{p.branch}</p>
                <p className="text-xs text-stone-500">
                  {p.peak ? `พีค ${formatHour(p.peak.hour)}` : 'ไม่มีบิล'}
                  {mode === 'perDay' && ` · ${formatNumber(p.days)} วัน`}
                </p>
              </div>
              <HourlyOrdersChart
                data={p.data}
                peak={p.peak}
                compact
                muted={muted}
                yMax={yMax}
                height={140}
                valueFormatter={valueFormatter}
                yTickFormatter={(v) => (mode === 'count' ? formatNumber(v) : String(+v.toFixed(1)))}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default HourlyOrdersSection
