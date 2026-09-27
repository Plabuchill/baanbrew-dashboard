"""Data profiling ของ sales_raw.csv (Lab 2) — รายงานอย่างเดียว ไม่แก้ข้อมูล

รัน:  python analysis/profile_sales_raw.py
ต้องมี pandas  (pip install pandas)
"""
from pathlib import Path

import pandas as pd

PUBLIC = Path(__file__).resolve().parent.parent / "public"

# ทุกคอลัมน์เป็น str และค่าว่างเป็น "" (keep_default_na=False กันไม่ให้ "" กลายเป็น NaN)
df = pd.read_csv(PUBLIC / "sales_raw.csv", dtype=str, keep_default_na=False, encoding="utf-8-sig")

# ชื่อสาขาที่ถูกต้อง อ่านจาก branches.csv ไม่ต้องพิมพ์เอง
VALID_BRANCHES = set(
    pd.read_csv(PUBLIC / "branches.csv", dtype=str, keep_default_na=False, encoding="utf-8-sig")["branch"]
)


def is_blank(s: pd.Series) -> pd.Series:
    """"" หรือมีแต่ช่องว่าง นับเป็นค่าว่าง"""
    return s.str.strip() == ""


print(f"ทั้งหมด {len(df):,} แถว × {df.shape[1]} คอลัมน์\n")

# 1) ค่าว่างและค่าไม่ซ้ำของแต่ละคอลัมน์
summary = pd.DataFrame({
    "ค่าว่าง": df.apply(lambda c: is_blank(c).sum()),
    "ค่าไม่ซ้ำ": df.nunique(),  # นับ "" เป็นค่าหนึ่งด้วย
})
print("1) ค่าว่าง / ค่าไม่ซ้ำ")
print(summary, "\n")

# 2) แถวที่ซ้ำกันทุกคอลัมน์ (นับเฉพาะแถวที่เกินมา ไม่นับแถวแรกของกลุ่ม)
n_dup = int(df.duplicated().sum())
print(f"2) แถวซ้ำทุกคอลัมน์: {n_dup:,}\n")

# 3) datetime ที่ไม่ใช่ YYYY-MM-DDT... ปี ค.ศ. (ปีขึ้นต้น 19xx หรือ 20xx)
iso_ad = df["datetime"].str.match(r"^(?:19|20)\d{2}-\d{2}-\d{2}T")
bad_dt = df.loc[~iso_ad, "datetime"]
n_bad_dt = int(len(bad_dt))
print(f"3) datetime ผิดรูปแบบ: {n_bad_dt:,}")
# จัดกลุ่มตามรูปแบบ (แทนตัวเลขด้วย 9) พร้อมตัวอย่างของแต่ละรูปแบบ
patterns = bad_dt.str.replace(r"\d", "9", regex=True)
print(bad_dt.groupby(patterns).agg(จำนวน="size", ตัวอย่าง="first").sort_values("จำนวน", ascending=False), "\n")

# 4) ชื่อสาขาทั้งหมดพร้อมจำนวนแถว
branch_counts = df["branch"].value_counts()
print("4) ชื่อสาขา")
print(branch_counts.to_frame("แถว").assign(ถูกต้อง=lambda t: t.index.isin(VALID_BRANCHES)))
n_bad_branch = int((~df["branch"].isin(VALID_BRANCHES)).sum())
print(f"ชื่อสาขาไม่ตรง branches.csv: {n_bad_branch:,} แถว\n")

# 5) unit_price: แปลงเป็นตัวเลขไม่ได้ (ไม่นับค่าว่าง) และติดลบ
price_num = pd.to_numeric(df["unit_price"], errors="coerce")
price_text = df.loc[price_num.isna() & ~is_blank(df["unit_price"]), "unit_price"]
n_price_text = int(len(price_text))
n_price_neg = int((price_num < 0).sum())
print(f"5) unit_price แปลงเป็นตัวเลขไม่ได้: {n_price_text:,} · ตัวอย่าง {price_text.unique()[:5].tolist()}")
print(f"   unit_price ติดลบ: {n_price_neg:,} · ตัวอย่าง {df.loc[price_num < 0, 'unit_price'].unique()[:5].tolist()}")
print(f"   unit_price ว่าง: {int(is_blank(df['unit_price']).sum()):,}\n")

# 6) qty = 0 และ product_id ว่าง
n_qty_zero = int((pd.to_numeric(df["qty"], errors="coerce") == 0).sum())
n_missing_product = int(is_blank(df["product_id"]).sum())
print(f"6) qty = 0: {n_qty_zero:,} · product_id ว่าง: {n_missing_product:,}\n")

print("สรุป:", dict(
    n_dup=n_dup,
    n_bad_dt=n_bad_dt,
    n_bad_branch=n_bad_branch,
    n_price_text=n_price_text,
    n_price_neg=n_price_neg,
    n_qty_zero=n_qty_zero,
    n_missing_product=n_missing_product,
))
