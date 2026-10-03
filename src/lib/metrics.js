// ฟังก์ชันคำนวณทั้งหมดของ Dashboard
// ข้อมูลเข้า: แถวจาก sales.csv (1 แถว = 1 รายการสินค้า, บิลหนึ่งมีได้หลายแถว)

// แปลงแถวดิบจาก PapaParse (ทุกค่าเป็น string) ให้เป็นชนิดที่ถูกต้อง
export function normalizeRows(rawRows) {
  return rawRows
    .filter((r) => r.order_id)
    .map((r) => ({
      orderId: r.order_id.trim(),
      datetime: r.datetime.trim(),
      branch: r.branch.trim(),
      qty: Number(r.qty),
      unitPrice: Number(r.unit_price),
      customerId: (r.customer_id ?? '').trim() || null, // ว่าง = ลูกค้าทั่วไป
    }))
}

// ยอดขายของ 1 แถว = qty × unit_price
export function lineAmount(row) {
  return row.qty * row.unitPrice
}

// ยอดขายรวม = ผลรวมของ qty × unit_price ทุกแถว
export function totalSales(rows) {
  return rows.reduce((sum, r) => sum + lineAmount(r), 0)
}

// จำนวนบิล = จำนวน order_id ที่ไม่ซ้ำ (ไม่ใช่จำนวนแถว)
export function orderCount(rows) {
  return new Set(rows.map((r) => r.orderId)).size
}

// ยอดเฉลี่ยต่อบิล = ยอดขายรวม ÷ จำนวนบิล
export function averageOrderValue(rows) {
  const orders = orderCount(rows)
  return orders === 0 ? 0 : totalSales(rows) / orders
}

// จำนวนลูกค้าสมาชิกที่ไม่ซ้ำ = customer_id ที่ไม่ว่าง แบบไม่นับซ้ำ
export function uniqueMembers(rows) {
  return new Set(rows.filter((r) => r.customerId).map((r) => r.customerId)).size
}

// วันที่ตามเวลาไทย: ตัด 10 ตัวแรกของ datetime (YYYY-MM-DD)
// ไม่ใช้ new Date() เพราะจะถูกแปลงเป็นเขตเวลาของเครื่องผู้ชม ทำให้วันเลื่อนได้
export function thaiDate(datetime) {
  return datetime.slice(0, 10)
}

// ยอดขายรายวัน: รวมยอดตามวันที่ แล้วเรียงจากวันเก่าไปวันใหม่
export function dailySales(rows) {
  const byDay = new Map()
  for (const r of rows) {
    const day = thaiDate(r.datetime)
    byDay.set(day, (byDay.get(day) ?? 0) + lineAmount(r))
  }
  return [...byDay]
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ค่าเฉลี่ยเคลื่อนที่ (moving average) ย้อนหลัง `days` วัน รวมวันนั้นเอง
// ใช้กับผลของ dailySales ซึ่งเรียงวันแล้ว: ค่าของวันที่ i = เฉลี่ยยอดวันที่ i-6 ถึง i
// ช่วงต้นที่ยังมีข้อมูลไม่ครบ 7 วันจะเป็น null (กราฟจะไม่วาดจุดนั้น) แทนการเฉลี่ยจากวันที่น้อยกว่า
export function movingAverage(daily, days = 7) {
  let windowSum = 0
  return daily.map((d, i) => {
    windowSum += d.sales
    if (i >= days) windowSum -= daily[i - days].sales
    return { ...d, avg: i >= days - 1 ? windowSum / days : null }
  })
}

// ยอดขายแยกสาขา: รวมยอดตามสาขา แล้วเรียงจากมากไปน้อย
export function salesByBranch(rows) {
  const byBranch = new Map()
  for (const r of rows) {
    byBranch.set(r.branch, (byBranch.get(r.branch) ?? 0) + lineAmount(r))
  }
  return [...byBranch]
    .map(([branch, sales]) => ({ branch, sales }))
    .sort((a, b) => b.sales - a.sales)
}

// ---------- จำนวนบิลตามชั่วโมง ----------

// ชั่วโมงตามเวลาไทย: ตัวที่ 12–13 ของ datetime (เช่น "2025-04-01T18:48:40+07:00" → 18)
// อ่านจากสตริงตรง ๆ เหมือน thaiDate เพื่อไม่ให้เขตเวลาของเครื่องผู้ชมมีผล
export function thaiHour(datetime) {
  return Number(datetime.slice(11, 13))
}

// ช่วงชั่วโมงที่มีการขาย (ใช้กำหนดแกน X ให้ทุกกราฟเท่ากัน)
export function hourRange(rows) {
  let min = 23
  let max = 0
  for (const r of rows) {
    const h = thaiHour(r.datetime)
    if (h < min) min = h
    if (h > max) max = h
  }
  return { min, max }
}

// จำนวนบิลต่อชั่วโมง: นับ order_id ไม่ซ้ำ (บิลหนึ่งมีหลายแถวแต่เวลาเดียวกัน จึงนับครั้งเดียว)
// คืนครบทุกชั่วโมงในช่วง แม้ชั่วโมงนั้นไม่มีบิล (orders = 0) เพื่อให้แท่งเรียงตรงกันทุกกราฟ
export function ordersByHour(rows, { min, max }) {
  const seen = new Set()
  const counts = new Map()
  for (const r of rows) {
    if (seen.has(r.orderId)) continue
    seen.add(r.orderId)
    const h = thaiHour(r.datetime)
    counts.set(h, (counts.get(h) ?? 0) + 1)
  }
  const out = []
  for (let h = min; h <= max; h++) out.push({ hour: h, orders: counts.get(h) ?? 0 })
  return out
}

// จำนวนวันที่มียอดขายจริง (ใช้เป็นตัวหารของ "เฉลี่ยต่อวัน")
export function activeDays(rows) {
  return new Set(rows.map((r) => thaiDate(r.datetime))).size
}

// จำนวนบิลต่อชั่วโมงแยกสาขา
// perDay = true → หารด้วยจำนวนวันที่สาขานั้นเปิดขาย เพื่อเทียบสาขาที่เปิดไม่นานเท่ากันได้ยุติธรรม
export function ordersByHourByBranch(rows, branches, hours, { perDay = false } = {}) {
  return branches.map((branch) => {
    const branchRows = rows.filter((r) => r.branch === branch)
    const days = activeDays(branchRows)
    const data = ordersByHour(branchRows, hours).map((d) => ({
      ...d,
      orders: perDay ? (days ? d.orders / days : 0) : d.orders,
    }))
    return { branch, days, data, peak: peakHour(data) }
  })
}

// ชั่วโมงที่มีบิลมากที่สุด (ถ้าเท่ากันเอาชั่วโมงแรก) · null ถ้าไม่มีบิลเลย
export function peakHour(hourly) {
  let best = null
  for (const d of hourly) if (d.orders > 0 && (!best || d.orders > best.orders)) best = d
  return best
}

// ป้ายชั่วโมง เช่น 8 → "08:00"
export function formatHour(h) {
  return `${String(h).padStart(2, '0')}:00`
}

// ---------- ตัวกรอง ----------

// ช่วงวันที่ที่มีข้อมูล: วันแรกและวันสุดท้าย (YYYY-MM-DD)
export function dateBounds(rows) {
  let min = null
  let max = null
  for (const r of rows) {
    const day = thaiDate(r.datetime)
    if (min === null || day < min) min = day
    if (max === null || day > max) max = day
  }
  return { min, max }
}

// รายชื่อสาขาทั้งหมด เรียงตามยอดขายมากไปน้อย (ลำดับเดียวกับกราฟแท่ง)
export function branchList(rows) {
  return salesByBranch(rows).map((b) => b.branch)
}

// เลื่อนวันที่ไป n วัน (ติดลบ = ย้อนหลัง) คำนวณแบบ UTC เพื่อไม่ให้เขตเวลาของเครื่องมีผล
export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// กรองแถวตามสาขาและช่วงวันที่ (รวมวันแรกและวันสุดท้าย)
// branch = 'all' หมายถึงทุกสาขา · เทียบวันที่เป็นสตริง YYYY-MM-DD ได้เลยเพราะเรียงตามตัวอักษรตรงกับลำดับเวลา
export function filterRows(rows, { branch = 'all', from = null, to = null } = {}) {
  return rows.filter((r) => {
    if (branch !== 'all' && r.branch !== branch) return false
    const day = thaiDate(r.datetime)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
}

// ---------- การจัดรูปแบบตัวเลข ----------

const intFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
const moneyFormat = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// ตัวเลขมีจุลภาค เช่น 34,791
export function formatNumber(n) {
  return intFormat.format(n)
}

// เงินบาท เช่น ฿4,466,821 หรือ ฿128.39 (decimals = true)
export function formatBaht(n, { decimals = false } = {}) {
  return '฿' + (decimals ? moneyFormat : intFormat).format(n)
}

// แกนกราฟแบบย่อ เช่น ฿1.5K, ฿12K, ฿1.2M (ต่ำกว่า 10K เก็บทศนิยม 1 ตำแหน่ง กันป้ายซ้ำกัน)
export function formatBahtCompact(n) {
  if (n >= 1_000_000) return `฿${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `฿${+(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}K`
  return `฿${n}`
}

// วันที่แบบไทยสั้น เช่น 1 เม.ย. 68 (อ่านจากสตริง ไม่ผ่านเขตเวลา)
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function formatThaiDate(isoDate, { withDay = true } = {}) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const yy = String((y + 543) % 100).padStart(2, '0')
  return withDay ? `${d} ${TH_MONTHS[m - 1]} ${yy}` : `${TH_MONTHS[m - 1]} ${yy}`
}

// ---- ใช้กับหน้า Lab 2.2 (src/lab2) ----

// แปลงแถวดิบเป็นแถวที่มี revenue, date, hour พร้อมใช้ในกราฟ Lab 2.2
export function prepareRows(rawRows) {
  return rawRows
    .filter((r) => r.order_id)
    .map((r) => {
      const qty = Number(r.qty)
      const unitPrice = Number(r.unit_price)
      return {
        ...r,
        branch: r.branch.trim(),
        qty,
        unitPrice,
        revenue: qty * unitPrice,
        // ใช้ 10 ตัวอักษรแรกของ ISO string (เวลาไทย) ไม่แปลงเป็น UTC
        date: r.datetime.slice(0, 10),
        hour: Number(r.datetime.slice(11, 13)),
      }
    })
}

export function dailyRevenue(rows) {
  const map = new Map()
  for (const r of rows) map.set(r.date, (map.get(r.date) ?? 0) + r.revenue)
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }))
}

// KPI 4 ตัว จากแถวของ prepareRows (ใช้ในแท็บสด · Lab 3.2)
export function computeKpis(rows) {
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0)
  const bills = new Set(rows.map((r) => r.order_id)).size // นับบิล ไม่ใช่นับแถว
  // customer_id ว่างหรือ null = ลูกค้าทั่วไป ไม่นับเป็นสมาชิก
  const customers = new Set(rows.map((r) => r.customer_id).filter(Boolean)).size
  return { revenue, bills, avgPerBill: bills ? revenue / bills : 0, customers }
}

// ยอดขายแยกสาขา เรียงจากมากไปน้อย
export function revenueByBranch(rows) {
  const map = new Map()
  for (const r of rows) {
    const cur = map.get(r.branch) ?? { branch: r.branch, revenue: 0, bills: new Set() }
    cur.revenue += r.revenue
    cur.bills.add(r.order_id)
    map.set(r.branch, cur)
  }
  return [...map.values()]
    .map((b) => ({ branch: b.branch, revenue: b.revenue, bills: b.bills.size }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ยอดขายรายชั่วโมง (เวลาไทยจาก r.hour) · แสดงอย่างน้อย 7:00–20:00 ขยายถ้ามียอดนอกช่วง · ไม่มียอดเลย = []
export function revenueByHour(rows) {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0 }))
  for (const r of rows) hourly[r.hour].revenue += r.revenue
  const first = hourly.findIndex((h) => h.revenue > 0)
  if (first < 0) return []
  const last = hourly.findLastIndex((h) => h.revenue > 0)
  return hourly.slice(Math.min(first, 7), Math.max(last, 20) + 1)
}

export const fmtBaht = (n) => '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 })

export const fmtShortBaht = (n) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)} ล.` : n >= 1000 ? `฿${(n / 1000).toFixed(0)}k` : `฿${n}`
