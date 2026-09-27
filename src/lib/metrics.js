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

// แกนกราฟแบบย่อ เช่น ฿12K, ฿1.2M
export function formatBahtCompact(n) {
  if (n >= 1_000_000) return `฿${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `฿${+(n / 1_000).toFixed(0)}K`
  return `฿${n}`
}

// วันที่แบบไทยสั้น เช่น 1 เม.ย. 68 (อ่านจากสตริง ไม่ผ่านเขตเวลา)
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function formatThaiDate(isoDate, { withDay = true } = {}) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const yy = String((y + 543) % 100).padStart(2, '0')
  return withDay ? `${d} ${TH_MONTHS[m - 1]} ${yy}` : `${TH_MONTHS[m - 1]} ${yy}`
}
