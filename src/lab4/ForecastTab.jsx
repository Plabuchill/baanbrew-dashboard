// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot,
} from "recharts";
import { addDays } from "../lab3/time.js";
import { AnalyticsShell, Card, Pending, Insight, MAIN, GREEN, MUTED, INK, thaiDay } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest, mape } from "../lib/analytics/forecast.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

// Lab 4.4B · รวมเป็นรายสัปดาห์ จันทร์–อาทิตย์ (getUTCDay: 0 = อาทิตย์ จึงเลื่อนให้จันทร์เป็นวันแรก)
const weekStart = (ymd) => addDays(ymd, -((new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7));

/** รวมจุดรายวันเป็นรายสัปดาห์ตามคีย์ที่กำหนด · เก็บเฉพาะสัปดาห์ที่มีครบ 7 วัน (สัปดาห์ไม่ครบจะดูต่ำผิดปกติ) */
function toWeeks(points, keys) {
  const map = new Map();
  for (const p of points) {
    const w = weekStart(p.date);
    const c = map.get(w) ?? { date: w, days: 0, ...Object.fromEntries(keys.map((k) => [k, 0])) };
    c.days++;
    for (const k of keys) c[k] += p[k];
    map.set(w, c);
  }
  return [...map.values()].filter((w) => w.days === 7);
}

function ForecastCard({ daily }) {
  const [branch, setBranch] = useState(null);
  const [view, setView] = useState("daily");
  const result = useMemo(() => tryRun(() => {
    const series = toSeries(daily, branch);
    const bt = backtest(series, HORIZON);
    const fc = seasonalForecast(series, HORIZON);
    const recent = series.slice(-56);
    const last = recent[recent.length - 1];
    const chart = [
      ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
      ...fc.map((f) => ({ date: f.date, forecast: f.forecast, band: [f.forecast * (1 - bt.band), f.forecast * (1 + bt.band)] })),
    ];
    chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue }; // ต่อเส้นให้ไม่ขาด
    const next7 = fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0);

    // รายสัปดาห์: ใช้ผลย้อนทดสอบ 28 วันเดิม รวมยอดจริง/คาดการณ์เป็นสัปดาห์ แล้ววัดด้วย mape() ตัวเดิม
    const btWeeks = toWeeks(bt.test, ["actual", "forecast", "flat"]);
    const weekly = {
      weeks: btWeeks.length,
      mapeSeasonal: mape(btWeeks.map((w) => w.actual), btWeeks.map((w) => w.forecast)),
      mapeFlat: mape(btWeeks.map((w) => w.actual), btWeeks.map((w) => w.flat)),
    };
    const actualWeeks = toWeeks(recent.map((s) => ({ date: s.date, actual: s.revenue })), ["actual"]);
    const fcWeeks = toWeeks(fc, ["forecast"]);
    const weekChart = [...actualWeeks.map((w) => ({ date: w.date, actual: w.actual })), ...fcWeeks.map((w) => ({ date: w.date, forecast: w.forecast }))];
    if (actualWeeks.length) weekChart[actualWeeks.length - 1].forecast = actualWeeks.at(-1).actual; // ต่อเส้นให้ไม่ขาด
    return { bt, chart, next7, lastDate: last.date, weekly, weekChart, lastWeek: actualWeeks.at(-1)?.date };
  }), [daily, branch]);

  const r = result.value;
  const weeklyView = view === "weekly";
  const toggle = (
    <div className="flex gap-1">
      {[["daily", "รายวัน"], ["weekly", "รายสัปดาห์"]].map(([v, label]) => (
        <button key={v} onClick={() => setView(v)}
                className={`rounded-lg px-2.5 py-1 text-sm ${view === v ? "bg-emerald-700 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{label}</button>
      ))}
    </div>
  );
  return (
    <Card title="พยากรณ์ยอดขาย 28 วัน"
          sub={weeklyView
            ? "รวมยอดเป็นรายสัปดาห์ จันทร์–อาทิตย์ · แสดงเฉพาะสัปดาห์ที่มีข้อมูลครบ 7 วัน"
            : "ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"}
          right={<div className="flex flex-wrap items-center justify-end gap-2">
            {toggle}
            <div className="flex flex-wrap gap-1">
              {[null, ...BRANCHES].map((b) => (
                <button key={b ?? "all"} onClick={() => setBranch(b)}
                        className={`rounded-lg px-2.5 py-1 text-sm ${branch === b ? "bg-stone-900 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{b ?? "รวม"}</button>
              ))}
            </div>
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : (
        <>
          {weeklyView ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label={`ย้อนทดสอบ ${r.weekly.weeks} สัปดาห์: คลาดเคลื่อนเฉลี่ยต่อสัปดาห์`} value={`${r.weekly.mapeSeasonal.toFixed(1)}%`}
                    note={`รายวัน ${r.bt.mapeSeasonal.toFixed(1)}% · วิธีดูวันในสัปดาห์`} />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง (รายสัปดาห์)" value={`${r.weekly.mapeFlat.toFixed(1)}%`}
                    note={`รายวัน ${r.bt.mapeFlat.toFixed(1)}% · ตัวเปรียบเทียบ`} muted />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} note="วิธีดูวันในสัปดาห์" />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} note="ตัวเปรียบเทียบ" muted />
            </div>
          )}
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyView ? r.weekChart : r.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={(d) => (weeklyView ? `สัปดาห์ ${shortDay(d)} – ${thaiDay(addDays(d, 6))}` : thaiDay(d))}
                         formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine x={weeklyView ? r.lastWeek : r.lastDate} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />
                {!weeklyView && <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill={GREEN[1]} isAnimationActive={false} />}
                <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={weeklyView} isAnimationActive={false} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={weeklyView} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight>
            {weeklyView ? (
              `${branch ?? "ภาพรวม"}: รายสัปดาห์คลาดเคลื่อน ${r.weekly.mapeSeasonal.toFixed(1)}% เทียบรายวัน ${r.bt.mapeSeasonal.toFixed(1)}% `
              + (r.weekly.mapeSeasonal < r.bt.mapeSeasonal
                ? "เพราะวันที่ขายเกินกับขาดกว่าคาดหักล้างกันในสัปดาห์เดียวกัน จึงเหมาะกับการสั่งของและจัดกะรายสัปดาห์มากกว่า"
                : "ความคลาดเคลื่อนไม่ได้ลดลงเมื่อรวมเป็นสัปดาห์ แปลว่าทั้งสัปดาห์เบี่ยงไปทางเดียวกัน (เช่น ยอดกำลังขึ้นหรือลง)")
              + (r.weekly.mapeFlat <= r.weekly.mapeSeasonal
                ? ` · ค่าเฉลี่ยเส้นตรงแม่นพอ ๆ กันหรือดีกว่า (${r.weekly.mapeFlat.toFixed(1)}%) เพราะ 1 สัปดาห์มีครบทุกวันอยู่แล้ว วันในสัปดาห์จึงไม่มีผล`
                : "")
              + ` · ย้อนทดสอบได้ ${r.weekly.weeks} สัปดาห์เต็ม ตัวเลขจึงแกว่งได้มาก`
            ) : <>
              {r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
                ? `${branch ?? "ภาพรวม"}: การดูวันในสัปดาห์ช่วยลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
                : `${branch ?? "ภาพรวม"}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%) ${branch ? "" : "เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน"}`}
              {" "}ใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
            </>}
          </Insight>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, note, muted }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${muted ? "text-stone-500" : ""}`}>{value}</div>
      {note && <div className="text-xs text-stone-400">{note}</div>}
    </div>
  );
}

// Lab 4.5B · กราฟซูม ±28 วันรอบวันที่เลือก: ยอดจริงเทียบค่าปกติ (expected จาก scoreAnomalies)
function AnomalyZoom({ focus, daily, all, onClose }) {
  const from = addDays(focus.date, -28);
  const to = addDays(focus.date, 28);
  const expected = new Map(all.filter((a) => a.branch === focus.branch).map((a) => [a.date, a.expected]));
  const actual = new Map(daily.filter((d) => d.branch === focus.branch).map((d) => [d.date, d.revenue]));
  const chart = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!actual.has(d) && !expected.has(d)) continue;
    chart.push({ date: d, actual: actual.get(d), expected: expected.get(d) });
  }
  const color = focus.change < 0 ? "#b91c1c" : "#d97706";
  return (
    <div className="mb-4 rounded-lg bg-stone-50 p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{focus.branch} · {thaiDay(focus.date)}</div>
          <div className="text-sm text-stone-500">
            ยอดจริง {fmtBaht(focus.actual)} เทียบค่าปกติ {fmtBaht(focus.expected)} · แสดง ±28 วัน
          </div>
        </div>
        <button onClick={onClose} aria-label="ปิด"
                className="rounded-lg bg-white px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100">ปิด ✕</button>
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7e5e4" />
            <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={thaiDay} formatter={(v, n) => [fmtBaht(v), n]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            <Line name="ค่าปกติ" dataKey="expected" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
            <ReferenceDot x={focus.date} y={focus.actual} r={6} fill={color} stroke="#fff" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  return (
    <Card title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ">
      {focus && <AnomalyZoom focus={focus} daily={daily} all={all} onClose={() => setFocus(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="text-left text-stone-500">
            <tr><th className="py-1 font-medium">#</th><th className="font-medium">วันที่</th><th className="font-medium">สาขา</th>
              <th className="text-right font-medium">ยอดจริง</th><th className="text-right font-medium">ปกติ</th><th className="pl-4 font-medium">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              return (
                <tr key={a.date + a.branch} onClick={() => setFocus(sel ? null : a)}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${sel ? "bg-emerald-50" : ""}`}>
                  <td className="py-1.5 text-stone-400">{i + 1}</td>
                  <td>{thaiDay(a.date)} <span className="text-stone-400">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td>{a.branch}</td>
                  <td className="text-right">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-stone-500">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    {a.change < 0
                      ? <span className="font-medium text-red-700">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                      : <span className="font-medium text-amber-700">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.slice(0, 3).map((h) => `${h.holiday} (${h.branch})`).join(", ")}</>}
      </Insight>
    </Card>
  );
}

export default function ForecastTab({ source }) {
  const state = useAnalytics(source);
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์และวันผิดปกติ">
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-6">
          {d.meta.alerts?.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
