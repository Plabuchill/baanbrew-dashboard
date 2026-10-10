// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  // เดือนที่ลูกค้าแต่ละคนมาซื้อ (Set จึงนับซ้ำในเดือนเดียวกันครั้งเดียว)
  const months = new Map();
  for (const x of rows) {
    if (!x.customer_id) continue;
    const s = months.get(x.customer_id) ?? new Set();
    s.add(x.date.slice(0, 7));
    months.set(x.customer_id, s);
  }

  const lastMonth = asOf.slice(0, 7);
  const groups = new Map(); // cohort → [Set เดือนของลูกค้าแต่ละคน]
  for (const s of months.values()) {
    const first = [...s].sort()[0];
    if (!groups.has(first)) groups.set(first, []);
    groups.get(first).push(s);
  }

  const cohorts = [...groups.keys()].sort().map((cohort) => {
    const members = groups.get(cohort);
    const span = monthIndex(cohort, lastMonth) + 1;
    const counts = new Array(span).fill(0);
    for (const s of members) {
      for (const ym of s) {
        const k = monthIndex(cohort, ym);
        if (k >= 0 && k < span) counts[k]++;
      }
    }
    return { cohort, size: members.length, retention: counts.map((c) => c / members.length) };
  });

  // จำนวนวันในเดือนสุดท้าย คำนวณด้วย Date.UTC (วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้)
  const [y, m, d] = asOf.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { cohorts, lastMonth, lastMonthPartial: d < daysInMonth, daysInLastMonth: d, daysInMonth };
}
