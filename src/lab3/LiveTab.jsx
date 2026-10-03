// Lab 3.2 · Dashboard ยอดขายแบบ real-time จาก Firestore (Prompt 3.2B)
// ฟัง collection "sales" ด้วย onSnapshot ตามช่วงวันที่ · กรองสาขาฝั่งเบราว์เซอร์
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { db, projectId } from "./firebase.js";
import { addDays, todayBangkok } from "./time.js";
import { BRANCHES } from "./saleModel.js";
import SaleForm from "./SaleForm.jsx";
import KpiCard from "../components/KpiCard.jsx";
import ChartTooltip from "../components/ChartTooltip.jsx";
import {
  computeKpis, dailyRevenue, formatBaht, formatBahtCompact, formatNumber, formatThaiDate, prepareRows, revenueByBranch, revenueByHour,
} from "../lib/metrics.js";

const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7d", label: "7 วัน", days: 7 },
  { id: "30d", label: "30 วัน", days: 30 },
];
const COLOR = "#2563eb";
const HIGHLIGHT_MS = 4000;
// "3 ต.ค." · ตัดปีออก ให้ป้ายแกนและตารางสั้นลง
const shortDate = (d) => formatThaiDate(d).split(" ").slice(0, 2).join(" ");

const errorText = (e) =>
  e.code === "permission-denied"
    ? "อ่านข้อมูลไม่ได้: ถูกปฏิเสธโดย Security Rules"
    : e.code === "unavailable"
      ? "เชื่อมต่อ Firestore ไม่ได้ ตรวจสอบอินเทอร์เน็ต"
      : `อ่านข้อมูลไม่สำเร็จ: ${e.message}`;

export default function LiveTab() {
  const [rangeId, setRangeId] = useState("7d");
  const [branch, setBranch] = useState("all");
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [reads, setReads] = useState(0);
  const [fresh, setFresh] = useState(() => new Set());
  const [products, setProducts] = useState([]);
  const timers = useRef([]);

  const range = RANGES.find((r) => r.id === rangeId);
  const end = todayBangkok();
  const start = addDays(end, -(range.days - 1));

  // เมนูโหลดครั้งเดียว ส่งให้ฟอร์ม
  useEffect(() => {
    getDocs(collection(db, "products"))
      .then((s) => setProducts(s.docs.map((d) => d.data()).sort((a, b) => a.product_id.localeCompare(b.product_id))))
      .catch((e) => setError(errorText(e)));
  }, []);

  const chooseRange = (id) => {
    if (id === rangeId) return;
    setDocs(null); // ล้างข้อมูลช่วงเก่า ไม่ให้ KPI ของช่วงเดิมค้างระหว่างรอ snapshot ใหม่
    setError(null);
    setRangeId(id);
  };

  useEffect(() => {
    let first = true;
    const q = query(collection(db, "sales"), where("date", ">=", start), where("date", "<=", end), orderBy("date"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        setReads((n) => n + changes.length);
        if (!first) {
          // แถวที่เพิ่งเข้ามาหลัง snapshot แรก = มีคนบันทึกยอดขายใหม่
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length) {
            setFresh((s) => new Set([...s, ...added]));
            timers.current.push(setTimeout(() => {
              setFresh((s) => new Set([...s].filter((id) => !added.includes(id))));
            }, HIGHLIGHT_MS));
          }
        }
        first = false;
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (e) => setError(errorText(e)),
    );
    // ถ้าไม่ unsubscribe ทุกครั้งที่เปลี่ยนช่วงจะมี listener ค้างเพิ่มขึ้นเรื่อย ๆ อ่านเอกสารซ้ำและเปลืองโควตา
    return unsubscribe;
  }, [start, end]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const view = useMemo(() => {
    if (!docs) return null;
    const rows = prepareRows(docs.map((d) => ({ ...d, _id: d.id })))
      .filter((r) => branch === "all" || r.branch === branch);
    return {
      kpis: computeKpis(rows),
      daily: dailyRevenue(rows),
      hourly: revenueByHour(rows),
      branches: revenueByBranch(rows),
      latest: [...rows].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, 8),
      count: rows.length,
    };
  }, [docs, branch]);

  const productName = Object.fromEntries(products.map((p) => [p.product_id, p.product_name]));

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 sm:text-3xl">ยอดขายสด</h1>
          <p className="mt-1 text-sm text-stone-500">
            Firestore · {projectId} · {formatThaiDate(start)}
            {range.days > 1 && ` – ${formatThaiDate(end)}`} · อัปเดตเองเมื่อมีบิลใหม่
          </p>
        </div>
        <p className="text-xs text-stone-500">อ่านเอกสารไปแล้ว <b className="tabular-nums">{formatNumber(reads)}</b> ครั้ง</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
        {RANGES.map((r) => (
          <button key={r.id} onClick={() => chooseRange(r.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${rangeId === r.id ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-800 hover:bg-blue-100"}`}>
            {r.label}
          </button>
        ))}
        <select value={branch} onChange={(e) => setBranch(e.target.value)}
          className="ml-auto rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-sm">
          <option value="all">ทุกสาขา</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {!view && !error && <p className="text-stone-500">กำลังโหลดข้อมูล…</p>}
          {view && (
            <>
              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <KpiCard label="ยอดขายรวม" value={formatBaht(view.kpis.revenue)} />
                <KpiCard label="จำนวนบิล" value={formatNumber(view.kpis.bills)} />
                <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(view.kpis.avgPerBill, { decimals: true })} />
                <KpiCard label="ลูกค้าสมาชิก" value={formatNumber(view.kpis.customers)} note="ไม่ซ้ำ" />
              </section>

              <section className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-semibold">{rangeId === "today" ? "ยอดขายรายชั่วโมง · วันนี้" : "ยอดขายรายวัน"}</h2>
                <div className="h-64">
                  {view.count === 0 ? (
                    <p className="flex h-full items-center justify-center text-stone-500">ยังไม่มียอดขายในช่วงนี้</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {rangeId === "today" ? (
                        <BarChart data={view.hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e0e7ff" vertical={false} />
                          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={formatBahtCompact} tick={{ fontSize: 11 }} width={56} />
                          <Tooltip content={<ChartTooltip labelFormatter={(h) => `${h}:00–${h}:59 น.`} />} />
                          <Bar dataKey="revenue" fill={COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      ) : (
                        <LineChart data={view.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e0e7ff" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(d) => shortDate(d)} tick={{ fontSize: 11 }} minTickGap={16} />
                          <YAxis tickFormatter={formatBahtCompact} tick={{ fontSize: 11 }} width={56} />
                          <Tooltip content={<ChartTooltip labelFormatter={(d) => formatThaiDate(d)} />} />
                          <Line dataKey="revenue" stroke={COLOR} strokeWidth={2} dot={range.days <= 7} isAnimationActive={false} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                  <h2 className="mb-2 font-semibold">ยอดขายแยกสาขา</h2>
                  <table className="w-full text-sm">
                    <tbody>
                      {view.branches.map((b) => (
                        <tr key={b.branch} className="border-t border-blue-50">
                          <td className="py-1.5">{b.branch}</td>
                          <td className="py-1.5 text-right text-stone-500 tabular-nums">{formatNumber(b.bills)} บิล</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{formatBaht(b.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                  <h2 className="mb-2 font-semibold">รายการล่าสุด</h2>
                  <table className="w-full text-sm">
                    <tbody>
                      {view.latest.map((r) => (
                        <tr key={r._id}
                          className={`border-t border-blue-50 transition-colors duration-700 ${fresh.has(r._id) ? "bg-amber-100" : ""}`}>
                          <td className="py-1.5 pr-2 text-stone-500 tabular-nums">
                            {range.days > 1 && `${shortDate(r.date)} `}{r.datetime.slice(11, 16)}
                          </td>
                          <td className="py-1.5 pr-2">
                            {r.branch} · {productName[r.product_id] ?? r.product_id} ×{r.qty}
                            {r.source === "web" && <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] text-blue-700">เว็บ</span>}
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{formatBaht(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        <aside>
          <SaleForm products={products} />
        </aside>
      </div>
    </div>
  );
}
