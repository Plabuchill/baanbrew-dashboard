// Lab 3.2 · ฟอร์มบันทึกยอดขาย (Prompt 3.2C)
// ตรวจด้วย validateSaleForm · สร้างเอกสารด้วย buildSale · บันทึกด้วย setDoc + serverTimestamp()
import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, PAYMENTS, buildSale, validateSaleForm } from "./saleModel.js";
import { formatBaht } from "../lib/metrics.js";

const EMPTY = { branch: BRANCHES[0], product_id: "", qty: "1", payment_method: PAYMENTS[0], customer_id: "" };

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-sm text-stone-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm";

export default function SaleForm({ products }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const product = products.find((p) => p.product_id === form.product_id);
  const qty = Number(form.qty);
  const preview = product && Number.isInteger(qty) && qty > 0 ? qty * product.price : null;

  async function submit(e) {
    e.preventDefault();
    const found = validateSaleForm(form, products);
    setErrors(found);
    setResult(null);
    if (Object.keys(found).length) return;

    // uid "anonymous" ชั่วคราว · Lab 3.3 จะเปลี่ยนเป็นผู้ใช้ที่ล็อกอิน
    const { id, data } = buildSale(form, product, { uid: "anonymous" });
    setSaving(true);
    try {
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setResult({ ok: true, text: `บันทึกแล้ว ${data.order_id} · ${formatBaht(data.revenue)}` });
      setForm((f) => ({ ...f, product_id: "", qty: "1", customer_id: "" })); // คงสาขาและวิธีชำระเงินไว้ บันทึกบิลถัดไปเร็วขึ้น
    } catch (err) {
      setResult({
        ok: false,
        text: err.code === "permission-denied" ? "ถูกปฏิเสธโดย Security Rules" : `บันทึกไม่สำเร็จ: ${err.message}`,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">บันทึกยอดขาย</h2>

      <Field label="สาขา" error={errors.branch}>
        <select value={form.branch} onChange={set("branch")} className={inputClass}>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>

      <Field label="เมนู" error={errors.product_id}>
        <select value={form.product_id} onChange={set("product_id")} className={inputClass} disabled={!products.length}>
          <option value="">{products.length ? "เลือกเมนู" : "กำลังโหลดเมนู…"}</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>{p.product_name} · {formatBaht(p.price)}</option>
          ))}
        </select>
      </Field>

      <Field label="จำนวน" error={errors.qty}>
        <input type="number" inputMode="numeric" min="1" max="20" step="1" value={form.qty} onChange={set("qty")} className={inputClass} />
      </Field>

      <Field label="วิธีชำระเงิน" error={errors.payment_method}>
        <select value={form.payment_method} onChange={set("payment_method")} className={inputClass}>
          {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="รหัสสมาชิก (ไม่บังคับ)" error={errors.customer_id}>
        <input value={form.customer_id} onChange={set("customer_id")} placeholder="เช่น C01234" className={inputClass} />
      </Field>

      <div className="flex items-baseline justify-between border-t border-blue-50 pt-3">
        <span className="text-sm text-stone-600">ยอดรวม</span>
        <span className="text-xl font-bold tabular-nums">{preview == null ? "–" : formatBaht(preview)}</span>
      </div>

      <button type="submit" disabled={saving}
        className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
        {saving ? "กำลังบันทึก…" : "บันทึก"}
      </button>

      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.ok ? "✅ " : "❌ "}{result.text}</p>
      )}
    </form>
  );
}
