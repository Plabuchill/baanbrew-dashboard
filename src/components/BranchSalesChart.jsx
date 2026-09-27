import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht } from '../lib/metrics'
import ChartTooltip from './ChartTooltip'
import useIsMobile from '../hooks/useIsMobile'

const COLOR = '#2563eb'
const FADED = '#bfdbfe' // สาขาที่ไม่ได้เลือกในตัวกรอง

// แท่งแนวนอน: อ่านชื่อสาขาภาษาไทยง่ายกว่า ข้อมูลเรียงมากไปน้อยมาแล้วจาก metrics.js
// highlight = ชื่อสาขาที่เลือก ('all' = ทุกแท่งสีปกติ)
function BranchSalesChart({ data, highlight = 'all' }) {
  const isMobile = useIsMobile()
  const rowHeight = isMobile ? 44 : 52

  return (
    <ResponsiveContainer width="100%" height={data.length * rowHeight + 16}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: isMobile ? 76 : 96, bottom: 0, left: 0 }}
        barCategoryGap={isMobile ? 8 : 10}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="branch"
          tick={{ fill: '#44403c', fontSize: isMobile ? 12 : 14 }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 76 : 104}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#eff6ff' }} />
        <Bar dataKey="sales" fill={COLOR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.branch} fill={highlight === 'all' || highlight === d.branch ? COLOR : FADED} />
          ))}
          <LabelList
            dataKey="sales"
            position="right"
            formatter={(v) => formatBaht(v)}
            style={{ fill: '#44403c', fontSize: isMobile ? 12 : 13, fontVariantNumeric: 'tabular-nums' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default BranchSalesChart
