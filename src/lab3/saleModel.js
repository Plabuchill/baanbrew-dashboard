// Lab 3.2 · ตรวจฟอร์มและสร้างเอกสารยอดขายใหม่
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.2A) จนกว่า npm test จะผ่านทุกข้อ
// เอกสารที่ได้ต้องมีโครงสร้างเดียวกับข้อมูลที่ import ใน Lab 3.1 เพื่อให้ metrics.js จาก Lab 1 ใช้ต่อได้
import { nowBangkokISO } from "./time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
export const PAYMENTS = ["QR พร้อมเพย์", "บัตรเครดิต", "เงินสด", "LINE MAN", "Grab"];
export const MAX_QTY = 20;

const CUSTOMER_RE = /^C\d{5}$/;
const DELIVERY = ["LINE MAN", "Grab"];
const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** รหัสสมาชิกแบบมาตรฐาน: ตัดช่องว่าง + ตัวพิมพ์ใหญ่ · ว่าง = null (ลูกค้าทั่วไป) */
const normalizeCustomer = (v) => (v ?? "").trim().toUpperCase() || null;

/**
 * ตรวจฟอร์ม { branch, product_id, qty, payment_method, customer_id } (ค่าเป็นข้อความจาก input)
 * คืน {} ถ้าถูกต้อง หรือ { ชื่อฟิลด์: ข้อความภาษาไทย } ถ้าผิด
 */
export function validateSaleForm(form, products) {
  const errors = {};
  if (!BRANCHES.includes(form.branch)) errors.branch = "เลือกสาขา";
  if (!products.some((p) => p.product_id === form.product_id)) errors.product_id = "เลือกเมนู";

  // ตรวจด้วย /^\d+$/ ก่อน เพราะ Number("") = 0 และ "1.5", "abc" ต้องถูกปฏิเสธตั้งแต่รูปแบบ
  const qtyText = String(form.qty ?? "").trim();
  const qty = Number(qtyText);
  if (!/^\d+$/.test(qtyText) || qty < 1 || qty > MAX_QTY) errors.qty = `จำนวนต้องเป็นจำนวนเต็ม 1–${MAX_QTY}`;

  if (!PAYMENTS.includes(form.payment_method)) errors.payment_method = "เลือกวิธีชำระเงิน";

  const customer = normalizeCustomer(form.customer_id);
  if (customer && !CUSTOMER_RE.test(customer)) errors.customer_id = "รหัสสมาชิกต้องเป็น C ตามด้วยตัวเลข 5 หลัก เช่น C01234";
  return errors;
}

/** เลขบิลจากเวลาไทย รูปแบบ WEB-YYYYMMDD-HHMMSS-XXXX (XXXX = ตัวเลข/อักษรพิมพ์ใหญ่สุ่ม 4 ตัว) */
export function makeOrderId(now = new Date(), rand = Math.random) {
  // ใช้เวลาไทย (ไม่ใช่ toISOString ที่เป็น UTC) · ขึ้นต้น WEB- จึงไม่ชนกับเลขบิลเดิม ORD…
  const t = nowBangkokISO(now); // 2026-09-27T03:30:05+07:00
  const ymd = t.slice(0, 10).replaceAll("-", "");
  const hms = t.slice(11, 19).replaceAll(":", "");
  const suffix = Array.from({ length: 4 }, () => ID_CHARS[Math.floor(rand() * ID_CHARS.length)]).join("");
  return `WEB-${ymd}-${hms}-${suffix}`;
}

/**
 * สร้าง { id, data } จากฟอร์มที่ผ่านการตรวจแล้ว
 * - ราคามาจาก product.price เสมอ · revenue = qty × ราคา · ตัวเลขทุกตัวเป็น number
 * - datetime/date/hour เป็นเวลาไทย (ใช้ nowBangkokISO)
 * - channel = "เดลิเวอรี" ถ้าจ่ายด้วย LINE MAN หรือ Grab ไม่งั้น "หน้าร้าน"
 * - source = "web", created_by = uid · ยังไม่ต้องใส่ created_at (ใส่ตอนบันทึกด้วย serverTimestamp())
 */
export function buildSale(form, product, { uid, now = new Date(), rand = Math.random }) {
  const datetime = nowBangkokISO(now);
  const qty = Number(form.qty);
  const unitPrice = Number(product.price); // ราคาจากเมนูเสมอ ไม่รับราคาจากฟอร์ม
  const orderId = makeOrderId(now, rand);
  return {
    id: `${orderId}-${product.product_id}`,
    data: {
      order_id: orderId,
      datetime,
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
      branch: form.branch,
      product_id: product.product_id,
      qty,
      unit_price: unitPrice,
      revenue: qty * unitPrice,
      customer_id: normalizeCustomer(form.customer_id),
      payment_method: form.payment_method,
      channel: DELIVERY.includes(form.payment_method) ? "เดลิเวอรี" : "หน้าร้าน",
      source: "web",
      created_by: uid,
    },
  };
}
