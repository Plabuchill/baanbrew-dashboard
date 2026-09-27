import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBahtCompact, formatThaiDate } from '../lib/metrics'
import ChartTooltip from './ChartTooltip'
import useIsMobile from '../hooks/useIsMobile'

const DAILY_COLOR = '#2563eb'
const DAILY_OPACITY = 0.25 // เส้นรายวันจางลง ให้เป็นพื้นหลัง
const AVG_COLOR = '#1d4ed8'

function LegendItem({ color, opacity = 1, width, label }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block w-5 rounded-full" style={{ height: width, background: color, opacity }} />
      {label}
    </span>
  )
}

function DailySalesChart({ data }) {
  const isMobile = useIsMobile()
  // ขีดแกน X ปรับตามช่วงที่กรอง: ช่วงยาวใช้วันที่ 1 ของเดือน (เว้นเดือนถ้าเยอะ) ช่วงสั้นกระจายราว 6 ขีดเท่า ๆ กัน
  const firstDays = data.filter((d) => d.date.endsWith('-01')).map((d) => d.date)
  const ticks =
    firstDays.length >= 4
      ? firstDays.filter((_, i) => i % Math.ceil(firstDays.length / 9) === 0)
      : data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 6)) === 0).map((d) => d.date)

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
        <LegendItem color={AVG_COLOR} width={3} label="ค่าเฉลี่ย 7 วัน" />
        <LegendItem color={DAILY_COLOR} opacity={DAILY_OPACITY + 0.15} width={2} label="ยอดรายวัน" />
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
        <LineChart data={data} margin={isMobile ? { top: 8, right: 8, bottom: 0, left: 0 } : { top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#dbeafe" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={(d) => formatThaiDate(d)}
            minTickGap={12}
            tick={{ fill: '#78716c', fontSize: isMobile ? 11 : 12 }}
            axisLine={{ stroke: '#d6d3d1' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatBahtCompact}
            tick={{ fill: '#78716c', fontSize: isMobile ? 11 : 12 }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 44 : 56}
          />
          <Tooltip
            content={<ChartTooltip labelFormatter={(d) => formatThaiDate(d)} swatchOpacity={{ sales: DAILY_OPACITY + 0.15 }} />}
            cursor={{ stroke: '#a8a29e', strokeDasharray: '3 3' }}
          />
          <Line
            name="ยอดรายวัน"
            type="monotone"
            dataKey="sales"
            stroke={DAILY_COLOR}
            strokeOpacity={DAILY_OPACITY}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: DAILY_COLOR, fillOpacity: 0.5, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            name="ค่าเฉลี่ย 7 วัน"
            type="monotone"
            dataKey="avg"
            stroke={AVG_COLOR}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

export default DailySalesChart
