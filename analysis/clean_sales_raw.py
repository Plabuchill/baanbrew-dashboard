"""ทำความสะอาด sales_raw.csv → sales_clean.csv + cleaning_log.csv (Lab 2.1 ขั้นที่ 4–6)

รัน:  python analysis/clean_sales_raw.py
ต้องมี pandas  (pip install pandas)

การตัดสินใจ (ขั้นที่ 3): ลบแถวซ้ำ · แปลงวันที่ พ.ศ./DD-MM-YYYY · map ชื่อสาขา ("ม." = มหาวิทยาลัย)
· ตัดคำ "บาท" · ราคาติดลบแปลงเป็นบวก (ไม่มีการคืนเงิน) · ลบ qty = 0 (บิลยกเลิก) · ลบ product_id ว่าง
"""
from pathlib import Path

import pandas as pd

PUBLIC = Path(__file__).resolve().parent.parent / "public"
STD_BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"]

df = pd.read_csv(PUBLIC / "sales_raw.csv", dtype=str, keep_default_na=False, encoding="utf-8-sig")
clean = df.copy()
log = []


def add_log(step, n, decision):
    log.append({"ขั้นตอน": step, "จำนวนแถวที่กระทบ": int(n), "การตัดสินใจ": decision})


rows_before = len(clean)

# 1) แถวซ้ำทุกคอลัมน์ (ไม่ใช้ order_id อย่างเดียว เพราะ 1 บิลมีหลายแถว)
dup = clean.duplicated()
add_log("แถวซ้ำทุกคอลัมน์", dup.sum(), "ลบ เก็บแถวแรกไว้")
clean = clean[~dup].copy()

# 2) datetime → YYYY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ.
#    แยกส่วนด้วย regex เอง ไม่ใช้ pd.to_datetime() เพราะอาจสลับวันกับเดือน และแปลงเป็น UTC
COLS = ["y", "m", "d", "H", "M", "S"]
dt = clean["datetime"].str.strip()
iso = dt.str.extract(
    r"^(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})T(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2})(?P<tz>[+-]\d{2}:\d{2})$"
)
# DD/MM/YYYY HH:MM หรือ DD MM YYYY H:MM (คั่นด้วย / หรือช่องว่าง ชั่วโมงอาจมีหลักเดียว วินาทีอาจไม่มี)
dmy = dt.str.extract(
    r"^(?P<d>\d{1,2})[/ ](?P<m>\d{1,2})[/ ](?P<y>\d{4})\s+(?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2}))?$"
)
is_iso = iso["y"].notna()
is_dmy = dmy["y"].notna() & ~is_iso

parts = iso[COLS].copy()
parts.loc[is_dmy, COLS] = dmy.loc[is_dmy, COLS].values

unparsed = parts["y"].isna()
if unparsed.any():
    raise ValueError(f"datetime ที่แปลงไม่ได้ {unparsed.sum()} แถว เช่น {dt[unparsed].unique()[:5].tolist()}")

year = parts["y"].astype(int)
is_be = year >= 2400  # ปี พ.ศ. (เช่น 2568) → ลบ 543
year = year.where(~is_be, year - 543)
tz = iso["tz"].fillna("+07:00")  # DD/MM ไม่มีเขตเวลา = เวลาไทย

new_dt = (
    year.astype(str) + "-" + parts["m"].str.zfill(2) + "-" + parts["d"].str.zfill(2)
    + "T" + parts["H"].str.zfill(2) + ":" + parts["M"] + ":" + parts["S"].fillna("00") + tz
)
add_log("datetime ปี พ.ศ.", is_be.sum(), "ลบ 543 เป็น ค.ศ.")
add_log("datetime รูปแบบ DD/MM/YYYY", is_dmy.sum(), "แปลงเป็น ISO ไม่มีวินาทีใส่ 00 เขตเวลา +07:00")
clean["datetime"] = new_dt

# 3) ชื่อสาขา: strip ก่อน แล้วค่อย map
BRANCH_MAP = {
    "Siam": "สยาม", "สาขาสยาม": "สยาม",
    "Silom": "สีลม",
    "Bangna": "บางนา",
    "มหาลัย": "มหาวิทยาลัย", "ม.": "มหาวิทยาลัย",  # ทีม POS ยืนยันว่า "ม." คือมหาวิทยาลัย
    "อารีย": "อารีย์", "Ari": "อารีย์",
}
stripped = clean["branch"].str.strip()
mapped = stripped.replace(BRANCH_MAP)
add_log("ชื่อสาขามีช่องว่างหน้า/ท้าย", (stripped != clean["branch"]).sum(), "ตัดช่องว่าง")
add_log("ชื่อสาขาสะกดต่าง", (mapped != stripped).sum(), "map เป็น 5 ชื่อมาตรฐาน")
unknown = ~mapped.isin(STD_BRANCHES)
if unknown.any():
    raise ValueError(f"ชื่อสาขาที่ยังไม่รู้จัก: {mapped[unknown].value_counts().to_dict()} · เพิ่มใน BRANCH_MAP")
clean["branch"] = mapped

# 4) unit_price: ตัดคำว่า "บาท" แล้วแปลงเป็นตัวเลข · ติดลบแปลงเป็นบวก (POS นี้ไม่มีการคืนเงิน)
price_str = clean["unit_price"].str.strip()
has_baht = price_str.str.contains("บาท", regex=False)
price = pd.to_numeric(price_str.str.replace("บาท", "", regex=False).str.strip(), errors="coerce")
if price.isna().any():
    raise ValueError(f"unit_price ที่ยังแปลงไม่ได้: {clean.loc[price.isna(), 'unit_price'].unique()[:5].tolist()}")
neg = price < 0
add_log("unit_price มีคำว่า บาท", has_baht.sum(), "ตัดคำแล้วแปลงเป็นตัวเลข")
add_log("unit_price ติดลบ", neg.sum(), "แปลงเป็นบวก (ไม่มีการคืนเงินในระบบ = ใส่เครื่องหมายผิด)")
clean["unit_price"] = price.abs().round().astype(int)

# 5) ลบบิลยกเลิก (qty = 0) และแถวไม่มี product_id
qty = pd.to_numeric(clean["qty"], errors="coerce")
if qty.isna().any():
    raise ValueError(f"qty ที่แปลงไม่ได้: {clean.loc[qty.isna(), 'qty'].unique()[:5].tolist()}")
cancelled = qty == 0
add_log("qty = 0", cancelled.sum(), "ลบ (บิลยกเลิก)")
clean = clean[~cancelled].copy()

no_product = clean["product_id"].str.strip() == ""
add_log("product_id ว่าง", no_product.sum(), "ลบ (เดาจากราคาไม่ได้ เพราะหลายเมนูราคาเท่ากัน)")
clean = clean[~no_product].copy()

# 6) ตรวจซ้ำอีกรอบหลังแปลงรูปแบบ (แถวที่ต่างกันแค่รูปแบบวันที่อาจกลายเป็นแถวเดียวกัน)
dup2 = clean.duplicated()
add_log("แถวซ้ำหลังแปลงรูปแบบ", dup2.sum(), "ลบ")
clean = clean[~dup2]

# คอลัมน์และลำดับเหมือนเดิม
clean = clean[df.columns].reset_index(drop=True)
cleaning_log = pd.DataFrame(log)

print(f"ก่อน {rows_before:,} แถว → หลัง {len(clean):,} แถว (ลดลง {rows_before - len(clean):,})\n")
print(cleaning_log.to_string(index=False))

# Export: ใช้เป็น public/sales.csv ของ Dashboard (Lab 2.2) และเก็บ log เป็นหลักฐาน
clean.to_csv(PUBLIC / "sales.csv", index=False, encoding="utf-8-sig")
cleaning_log.to_csv(PUBLIC / "cleaning_log.csv", index=False, encoding="utf-8-sig")
print("\nบันทึก public/sales.csv และ public/cleaning_log.csv แล้ว")
