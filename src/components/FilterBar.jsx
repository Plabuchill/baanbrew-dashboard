import { addDays } from '../lib/metrics'

const PRESETS = [
  { label: '30 วัน', days: 30 },
  { label: '90 วัน', days: 90 },
  { label: '12 เดือน', days: 365 },
  { label: 'ทั้งหมด', days: null },
]

const inputClass =
  'h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm text-stone-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'

// ช่วงของปุ่มลัด: นับย้อนจากวันสุดท้ายที่มีข้อมูล (ไม่ใช่วันนี้) และไม่ย้อนเกินวันแรกของข้อมูล
function presetRange(preset, bounds) {
  if (preset.days === null) return { from: bounds.min, to: bounds.max }
  const from = addDays(bounds.max, -(preset.days - 1))
  return { from: from < bounds.min ? bounds.min : from, to: bounds.max }
}

// แถบตัวกรอง: สาขา + ช่วงวันที่ + ปุ่มลัดช่วงเวลา
function FilterBar({ branches, bounds, filters, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch })

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:mb-6 lg:flex-row lg:items-end">
      <label className="flex flex-col gap-1 text-xs text-stone-500 lg:w-44">
        สาขา
        <select className={inputClass} value={filters.branch} onChange={(e) => set({ branch: e.target.value })}>
          <option value="all">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-stone-500">
          ตั้งแต่วันที่
          <input
            type="date"
            className={inputClass}
            value={filters.from}
            min={bounds.min}
            max={filters.to}
            onChange={(e) => e.target.value && set({ from: e.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-stone-500">
          ถึงวันที่
          <input
            type="date"
            className={inputClass}
            value={filters.to}
            min={filters.from}
            max={bounds.max}
            onChange={(e) => e.target.value && set({ to: e.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลาลัด">
        {PRESETS.map((p) => {
          const range = presetRange(p, bounds)
          const active = range.from === filters.from && range.to === filters.to
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => set(range)}
              className={`h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {filters.branch !== 'all' || filters.from !== bounds.min || filters.to !== bounds.max ? (
        <button
          type="button"
          onClick={() => onChange({ branch: 'all', from: bounds.min, to: bounds.max })}
          className="h-10 self-start text-sm text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline lg:ml-auto lg:self-auto"
        >
          ล้างตัวกรอง
        </button>
      ) : null}
    </section>
  )
}

export default FilterBar
