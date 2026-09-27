import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatHour } from '../lib/metrics'
import ChartTooltip from './ChartTooltip'

const COLOR = '#2563eb'
const FADED = '#bfdbfe' // สาขาที่ไม่ได้เลือกในตัวกรอง

// กราฟแท่งจำนวนบิลต่อชั่วโมง ใช้ทั้งกราฟรวม (compact = false) และกราฟย่อยของแต่ละสาขา (compact = true)
// yMax: กำหนดเพดานแกน Y ให้กราฟย่อยทุกสาขาใช้สเกลเดียวกัน จะได้เทียบความสูงแท่งข้ามสาขาได้ตรง ๆ
// peak: ชั่วโมงที่ขายดีสุด แสดงตัวเลขกำกับบนแท่งนั้นแท่งเดียว · muted = true ทุกแท่งจาง (สาขาที่ไม่ได้เลือกในตัวกรอง)
function HourlyOrdersChart({ data, height, compact = false, yMax, peak, muted = false, valueFormatter, yTickFormatter }) {
  const tickEvery = compact ? 3 : 1
  const ticks = data.map((d) => d.hour).filter((h, i) => i % tickEvery === 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: compact ? 16 : 20, right: 4, bottom: 0, left: 0 }} barCategoryGap={compact ? 2 : 4}>
        <CartesianGrid stroke="#dbeafe" vertical={false} />
        <XAxis
          dataKey="hour"
          ticks={ticks}
          interval={0}
          tickFormatter={(h) => (compact ? String(h) : formatHour(h))}
          tick={{ fill: '#78716c', fontSize: compact ? 10 : 11 }}
          axisLine={{ stroke: '#d6d3d1' }}
          tickLine={false}
          minTickGap={0}
        />
        <YAxis
          domain={[0, yMax ?? 'auto']}
          tickFormatter={yTickFormatter}
          tick={{ fill: '#78716c', fontSize: compact ? 10 : 11 }}
          axisLine={false}
          tickLine={false}
          width={compact ? 32 : 44}
          tickCount={compact ? 3 : 5}
        />
        <Tooltip
          content={<ChartTooltip labelFormatter={(h) => `${formatHour(h)}–${String(h).padStart(2, '0')}:59`} valueFormatter={valueFormatter} />}
          cursor={{ fill: '#eff6ff' }}
        />
        <Bar dataKey="orders" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.hour} fill={muted ? FADED : COLOR} />
          ))}
          {peak && (
            <LabelList
              dataKey="orders"
              content={({ x, y, width, index }) =>
                data[index]?.hour === peak.hour ? (
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={compact ? 11 : 12} fontWeight={600} fill="#1c1917">
                    {valueFormatter(peak.orders)}
                  </text>
                ) : null
              }
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default HourlyOrdersChart
