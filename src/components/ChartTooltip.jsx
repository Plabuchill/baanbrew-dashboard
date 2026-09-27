import { formatBaht } from '../lib/metrics'

// กล่อง tooltip ที่ใช้ร่วมกันทั้งสองกราฟ (แสดงได้หลายค่า เช่น ยอดรายวัน + ค่าเฉลี่ย 7 วัน)
function ChartTooltip({ active, payload, label, labelFormatter = (l) => l, swatchOpacity = {} }) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => p.value != null)
  return (
    <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm shadow-md">
      <p className="text-stone-500">{labelFormatter(label)}</p>
      {items.map((p) =>
        items.length > 1 ? (
          <p key={p.dataKey} className="flex items-center gap-2 tabular-nums text-stone-900">
            <span className="inline-block h-0.5 w-3" style={{ background: p.color, opacity: swatchOpacity[p.dataKey] ?? 1 }} />
            <span className="text-stone-600">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold">{formatBaht(p.value)}</span>
          </p>
        ) : (
          <p key={p.dataKey} className="font-semibold tabular-nums text-stone-900">{formatBaht(p.value)}</p>
        ),
      )}
    </div>
  )
}

export default ChartTooltip
