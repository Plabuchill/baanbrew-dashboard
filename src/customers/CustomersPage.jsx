// หน้า "ลูกค้า" · ใช้ customers_clean.csv (ผลจากโน้ตบุ๊ก Lab2_1_Data_Cleaning_NK.ipynb) ร่วมกับ sales.csv
// หลักเดียวกับ Lab 2.2: สีหลักสีเดียว, ตัวเลขมี ฿ + จุลภาค, ข้อความสรุปคำนวณจากข้อมูลจริง
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import KpiCard from "../components/KpiCard.jsx";
import { fmtBaht, formatNumber as fmtNum } from "../lib/metrics.js";
import { daysInMonth, thaiMonth } from "../lab2/lab2Metrics.js";
const MAIN = "#1d4ed8";

const GRID = "#eee";
const AXIS = { fontSize: 11 };
const LABEL = { fontSize: 11, fill: "#44403c" };
const pct = (x) => `${(x * 100).toFixed(1)}%`;

/** แปลงแถวดิบของ customers_clean.csv เป็นชนิดข้อมูลที่ใช้ได้ */
export function prepareCustomers(raw) {
  return raw
    .filter((c) => c.customer_id)
    .map((c) => ({
      ...c,
      age_order: Number(c.age_order),
      days_since_joined: Number(c.days_since_joined),
      has_purchase: c.has_purchase === "True",
      phone_shared: c.phone_shared === "True",
    }));
}

/** สมาชิกและยอดใช้จ่ายต่อคน แยกตามกลุ่มอายุ (เรียงด้วย age_order) */
function byAgeGroup(customers, rows) {
  const ageOf = new Map(customers.map((c) => [c.customer_id, c.age_group]));
  const groups = new Map();
  for (const c of customers) {
    const g = groups.get(c.age_group) ?? { age: c.age_group, order: c.age_order, members: 0, buyers: 0, revenue: 0 };
    g.members += 1;
    if (c.has_purchase) g.buyers += 1;
    groups.set(c.age_group, g);
  }
  for (const r of rows) {
    const age = r.customer_id && ageOf.get(r.customer_id);
    if (age) groups.get(age).revenue += r.revenue;
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ ...g, perBuyer: g.buyers ? g.revenue / g.buyers : 0 }));
}

/** สมาชิกใหม่ต่อวันในแต่ละเดือน (หารด้วยจำนวนวันที่มีข้อมูล เพื่อเทียบเดือนที่ไม่ครบได้)
 *  ใช้วันสมัครล่าสุดในไฟล์เป็นวันสุดท้ายของข้อมูล เพราะไฟล์ลูกค้าอาจตัดยอดก่อนไฟล์ยอดขาย */
function joinsByMonth(customers) {
  const dataEnd = customers.reduce((m, c) => (c.joined_date > m ? c.joined_date : m), "");
  const map = new Map();
  for (const c of customers) {
    const m = c.joined_date.slice(0, 7);
    map.set(m, (map.get(m) ?? 0) + 1);
  }
  const endMonth = dataEnd.slice(0, 7);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, joins]) => {
      const full = daysInMonth(month);
      const days = month === endMonth ? Number(dataEnd.slice(8, 10)) : full;
      return { month, label: thaiMonth(month), joins, days, full, partial: days < full, perDay: joins / days };
    });
}

/** อัตราสมาชิกที่เคยซื้อ แยกตามสาขาประจำ (ไม่นับสมาชิกที่สมัครไม่เกิน 30 วัน) */
function conversionByBranch(customers) {
  const map = new Map();
  for (const c of customers) {
    if (c.days_since_joined <= 30) continue;
    const b = map.get(c.home_branch) ?? { branch: c.home_branch, members: 0, buyers: 0 };
    b.members += 1;
    if (c.has_purchase) b.buyers += 1;
    map.set(c.home_branch, b);
  }
  return [...map.values()].map((b) => ({ ...b, rate: b.buyers / b.members })).sort((a, b) => b.rate - a.rate);
}

function ChartCard({ title, question, summary, children }) {
  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-stone-500">{question}</p>
      <p className="mt-2 text-sm font-medium text-stone-800">{summary}</p>
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </section>
  );
}

export default function CustomersPage({ rows, customers }) {
  const dataEnd = useMemo(() => rows.reduce((m, r) => (r.date > m ? r.date : m), ""), [rows]);
  const ages = useMemo(() => byAgeGroup(customers, rows), [customers, rows]);
  const joins = useMemo(() => joinsByMonth(customers), [customers]);
  const joinEnd = useMemo(() => customers.reduce((m, c) => (c.joined_date > m ? c.joined_date : m), ""), [customers]);
  const conv = useMemo(() => conversionByBranch(customers), [customers]);

  const kpi = useMemo(() => {
    const buyers = customers.filter((c) => c.has_purchase).length;
    const fresh = customers.filter((c) => c.member_segment === "สมาชิกใหม่ ยังไม่ซื้อ").length;
    const bills = new Map();
    for (const r of rows) bills.set(r.order_id, bills.get(r.order_id) || Boolean(r.customer_id));
    const memberBills = [...bills.values()].filter(Boolean).length;
    return { members: customers.length, buyers, fresh, memberBillShare: memberBills / bills.size };
  }, [customers, rows]);

  const topAge = ages.reduce((a, b) => (b.members > a.members ? b : a), ages[0]);
  const spend = [...ages].filter((g) => g.buyers).sort((a, b) => b.perBuyer - a.perBuyer);
  const lastJoin = joins[joins.length - 1];
  const prevJoin = joins[joins.length - 2];
  const bestConv = conv[0];
  const worstConv = conv[conv.length - 1];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-blue-800 sm:text-3xl">บ้านบรู · ลูกค้าสมาชิก</h1>
        <p className="text-stone-500">
          ข้อมูลจาก customers_clean.csv · ครอบคลุมเฉพาะบิลสมาชิก ({pct(kpi.memberBillShare)} ของบิลทั้งหมด) บิล walk-in ไม่มีข้อมูลลูกค้า
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="สมาชิกทั้งหมด" value={fmtNum(kpi.members)} />
        <KpiCard label="สมาชิกที่เคยซื้อ" value={fmtNum(kpi.buyers)} note={`${pct(kpi.buyers / kpi.members)} ของสมาชิก`} />
        <KpiCard label="สมาชิกใหม่ ยังไม่ซื้อ" value={fmtNum(kpi.fresh)} note="สมัครไม่เกิน 30 วัน" />
        <KpiCard label="บิลจากสมาชิก" value={pct(kpi.memberBillShare)} note="ที่เหลือเป็น walk-in" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="สมาชิกตามกลุ่มอายุ"
          question="ฝ่ายการตลาดถาม: ลูกค้าสมาชิกส่วนใหญ่เป็นคนกลุ่มไหน"
          summary={topAge ? `กลุ่ม ${topAge.age} มากที่สุด ${fmtNum(topAge.members)} คน (${pct(topAge.members / kpi.members)} ของสมาชิก)` : "ไม่มีข้อมูล"}
        >
          <BarChart data={ages} margin={{ top: 20, left: 0, right: 10 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="age" tick={AXIS} />
            <YAxis hide />
            <Tooltip formatter={(v) => [`${fmtNum(v)} คน`, "สมาชิก"]} />
            <Bar dataKey="members" fill={MAIN} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="members" position="top" formatter={fmtNum} style={LABEL} />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard
          title="ยอดซื้อสะสมต่อสมาชิก ตามกลุ่มอายุ"
          question="ฝ่ายการตลาดถาม: กลุ่มอายุไหนใช้จ่ายต่อคนมากที่สุด"
          summary={spend.length > 1
            ? `กลุ่ม ${spend[0].age} ใช้จ่ายสูงสุด ${fmtBaht(spend[0].perBuyer)}/คน (${fmtNum(spend[0].buyers)} คน) · ต่ำสุดคือ ${spend.at(-1).age} ${fmtBaht(spend.at(-1).perBuyer)}/คน`
            : "ไม่มีข้อมูล"}
        >
          <BarChart data={ages} layout="vertical" margin={{ left: 0, right: 80 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="age" width={80} tick={AXIS} />
            <Tooltip formatter={(v, _n, { payload }) => [`${fmtBaht(v)}/คน (${fmtNum(payload.buyers)} คนที่เคยซื้อ)`, "ยอดซื้อสะสม"]} />
            <Bar dataKey="perBuyer" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="perBuyer" position="right" formatter={fmtBaht} style={LABEL} />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard
          title="สมาชิกใหม่ต่อวัน รายเดือน"
          question="ผู้บริหารถาม: การหาสมาชิกใหม่ดีขึ้นหรือแย่ลง"
          summary={lastJoin && prevJoin
            ? `${lastJoin.label}${lastJoin.partial ? ` (ข้อมูลถึง ${joinEnd})` : ""} สมัครเฉลี่ย ${lastJoin.perDay.toFixed(1)} คน/วัน ${lastJoin.perDay >= prevJoin.perDay ? "สูงกว่า" : "ต่ำกว่า"}เดือนก่อน ${pct(Math.abs(lastJoin.perDay / prevJoin.perDay - 1))}`
            : "ไม่มีข้อมูล"}
        >
          <BarChart data={joins} margin={{ top: 20, left: 0, right: 10 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={8} />
            <YAxis tick={AXIS} width={35} />
            <Tooltip formatter={(v, _n, { payload }) => [`${v.toFixed(1)} คน/วัน (รวม ${fmtNum(payload.joins)} คน, ${payload.days}/${payload.full} วัน)`, "สมาชิกใหม่"]} />
            <Bar dataKey="perDay" fill={MAIN} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {joins.map((d) => <Cell key={d.month} fillOpacity={d.partial ? 0.35 : 1} />)}
              <LabelList
                dataKey="perDay"
                content={({ x, y, width, index }) => joins[index]?.partial ? (
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#78716c">
                    {joins[index].days}/{joins[index].full} วัน
                  </text>
                ) : null}
              />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard
          title="สมาชิกที่กลับมาซื้อจริง แยกตามสาขาประจำ"
          question="ผู้จัดการสาขาถาม: สาขาไหนเปลี่ยนคนสมัครเป็นลูกค้าที่ซื้อได้ดี"
          summary={bestConv && worstConv
            ? `${bestConv.branch} สูงสุด ${pct(bestConv.rate)} · ${worstConv.branch} ต่ำสุด ${pct(worstConv.rate)} (ไม่นับสมาชิกที่สมัครไม่เกิน 30 วัน)`
            : "ไม่มีข้อมูล"}
        >
          <BarChart data={conv} layout="vertical" margin={{ left: 0, right: 60 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" domain={[0, 1]} hide />
            <YAxis type="category" dataKey="branch" width={90} tick={AXIS} />
            <Tooltip formatter={(v, _n, { payload }) => [`${pct(v)} (${fmtNum(payload.buyers)} จาก ${fmtNum(payload.members)} คน)`, "เคยซื้อ"]} />
            <Bar dataKey="rate" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="rate" position="right" formatter={pct} style={LABEL} />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <p className="mt-6 text-xs text-stone-400">
        หมายเหตุ: สมาชิกที่เบอร์โทรซ้ำกัน {fmtNum(customers.filter((c) => c.phone_shared).length)} คนไม่ได้ถูกลบ
        เพราะเป็นการชนกันของเบอร์ที่ถูกปิดบัง ไม่ใช่คนซ้ำ · ยอดซื้อสะสมนับถึง {dataEnd}
      </p>
    </div>
  );
}
