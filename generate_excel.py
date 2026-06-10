import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill, numbers
from openpyxl.utils import get_column_letter
import random

random.seed(42)  # make reproducible

wb = openpyxl.Workbook()

# ============================================================
# Sheet 1: 30°斜面实验数据总表
# ============================================================
ws = wb.active
ws.title = "30度斜面实验数据"

# --- styles ---
header_font = Font(name="微软雅黑", bold=True, size=11, color="FFFFFF")
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
cell_align = Alignment(horizontal="center", vertical="center")
thin_border = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
outlier_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")  # light red
good_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")  # light green
note_font = Font(name="微软雅黑", size=9, color="888888")

# --- title ---
ws.merge_cells("A1:K1")
title_cell = ws["A1"]
title_cell.value = "30°斜面电磁阻尼下滑实验 — 电导率测量数据"
title_cell.font = Font(name="微软雅黑", bold=True, size=16, color="1F4E79")
title_cell.alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 36

ws.merge_cells("A2:K2")
ws["A2"].value = "实验条件：斜面角度 θ=30°，磁感应强度 B=0.5T，滑块质量 m=0.1kg，轨道长度 2000mm，垫板厚度 d=5mm，有效面积 A=0.002m²"
ws["A2"].font = Font(name="微软雅黑", size=9, color="666666")
ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[2].height = 22

# --- headers (row 4) ---
headers = [
    "实验编号",
    "金属材料",
    "斜面角度\n(°)",
    "参考电导率\n(S/m)",
    "实验电导率\n(S/m)",
    "相对误差\n(%)",
    "最大稳定速度\nv_max (m/s)",
    "总位移\n(mm)",
    "测量时长\n(s)",
    "是否异常",
    "备注",
]

for col_idx, h in enumerate(headers, 1):
    cell = ws.cell(row=4, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

ws.row_dimensions[4].height = 40

# --- column widths ---
col_widths = [12, 14, 10, 18, 18, 12, 18, 12, 12, 10, 30]
for i, w in enumerate(col_widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w

# --- data generation ---
# Reference data: (name, σ_ref in S/m, typical v_max in m/s)
metals = [
    ("银 (Ag)",       6.30e7, 0.047),
    ("铜 (Cu)",       5.96e7, 0.050),
    ("铝 (Al)",       3.77e7, 0.079),
    ("不锈钢 (304)",  1.45e6, 2.055),
]

# v ∝ 1/σ  → σ_ref * v_ref = σ_exp * v_exp → v_exp = σ_ref * v_ref / σ_exp

experiments = []
exp_id = 1

for metal_name, sigma_ref, v_ref in metals:
    # Generate 6 trials per metal, mostly close to reference
    for trial in range(1, 7):
        # Most trials: random error within ±8%
        error_pct = random.uniform(-8, 8)
        sigma_exp = sigma_ref * (1 + error_pct / 100)
        v_exp = sigma_ref * v_ref / sigma_exp
        displacement = random.uniform(1950, 2000)  # mm
        time_measured = displacement / 1000 / (v_exp / 2)  # rough: avg v ≈ v_max/2
        time_measured = round(time_measured, 2)

        is_outlier = False
        note = ""
        outlier_type = ""

        # Insert 1-2 deliberate outliers across the dataset (not per metal)
        # We'll flag them after generation

        experiments.append({
            "exp_id": exp_id,
            "metal": metal_name,
            "angle": 30,
            "sigma_ref": sigma_ref,
            "sigma_exp": round(sigma_exp, -5),  # round to 6 significant-ish
            "error_pct": round(error_pct, 2),
            "v_max": round(v_exp, 4),
            "displacement": round(displacement, 0),
            "time": time_measured,
            "is_outlier": False,
            "note": "",
        })
        exp_id += 1

# Now insert some deliberate outliers — override specific experiments
# Outlier 1: 铜 trial 3 — sensor reading error
outlier_idx = 1 * 6 + 2  # copper trial 3 (metal_idx=1, trial=2, 0-indexed)
experiments[outlier_idx]["sigma_exp"] = 1.23e7  # way off: ~5x too low
experiments[outlier_idx]["error_pct"] = round((1.23e7 - 5.96e7) / 5.96e7 * 100, 1)
experiments[outlier_idx]["v_max"] = round(5.96e7 * 0.050 / 1.23e7, 4)
experiments[outlier_idx]["is_outlier"] = True
experiments[outlier_idx]["note"] = "异常：滑块初始位置未对齐，起始速度异常偏大"

# Outlier 2: 铝 trial 5 — high error
outlier_idx2 = 2 * 6 + 4  # aluminum trial 5 (metal_idx=2, trial=4, 0-indexed)
experiments[outlier_idx2]["sigma_exp"] = 9.45e7  # way too high
experiments[outlier_idx2]["error_pct"] = round((9.45e7 - 3.77e7) / 3.77e7 * 100, 1)
experiments[outlier_idx2]["v_max"] = round(3.77e7 * 0.079 / 9.45e7, 4)
experiments[outlier_idx2]["is_outlier"] = True
experiments[outlier_idx2]["note"] = "异常：传感器65535溢出错误，位移数据丢失，电导率计算偏高"

# Outlier 3: 不锈钢 trial 2 — experimental mishandling
outlier_idx3 = 3 * 6 + 1  # stainless steel trial 2 (metal_idx=3, trial=1, 0-indexed)
experiments[outlier_idx3]["sigma_exp"] = 8.50e5  # ~40% off
experiments[outlier_idx3]["error_pct"] = round((8.50e5 - 1.45e6) / 1.45e6 * 100, 1)
experiments[outlier_idx3]["v_max"] = round(1.45e6 * 2.055 / 8.50e5, 4)
experiments[outlier_idx3]["is_outlier"] = True
experiments[outlier_idx3]["note"] = "异常：轨道表面有异物，摩擦力增大，速度偏慢"

# Stainless steel trial 6 — slightly higher error but still reasonable
ss_t6 = 3 * 6 + 5  # stainless steel trial 6
experiments[ss_t6]["sigma_exp"] = 1.60e6
experiments[ss_t6]["error_pct"] = round((1.60e6 - 1.45e6) / 1.45e6 * 100, 1)
experiments[ss_t6]["v_max"] = round(1.45e6 * 2.055 / 1.60e6, 4)
experiments[ss_t6]["note"] = "数据略微偏高，可能在允许误差范围内"

# Write data rows
for row_idx, exp in enumerate(experiments):
    row = row_idx + 5  # data starts at row 5
    values = [
        exp["exp_id"],
        exp["metal"],
        exp["angle"],
        exp["sigma_ref"],
        exp["sigma_exp"],
        exp["error_pct"],
        exp["v_max"],
        exp["displacement"],
        exp["time"],
        "是 ⚠" if exp["is_outlier"] else "否",
        exp["note"],
    ]
    for col_idx, val in enumerate(values, 1):
        cell = ws.cell(row=row, column=col_idx, value=val)
        cell.alignment = cell_align
        cell.border = thin_border
        cell.font = Font(name="微软雅黑", size=10)

        # Highlight outliers
        if exp["is_outlier"]:
            cell.fill = outlier_fill
        elif col_idx == 6:  # error column — light color coding
            if abs(exp["error_pct"]) <= 5:
                cell.fill = good_fill

    # Format scientific notation columns
    for c in [4, 5]:
        ws.cell(row=row, column=c).number_format = '0.00E+00'

    ws.cell(row=row, column=6).number_format = '0.0"%"'

    ws.row_dimensions[row].height = 22

# --- summary rows ---
last_data_row = 4 + len(experiments)
summary_start = last_data_row + 2

ws.merge_cells(f"A{summary_start}:K{summary_start}")
ws.cell(row=summary_start, column=1, value="统计摘要").font = Font(name="微软雅黑", bold=True, size=12, color="1F4E79")
ws.cell(row=summary_start, column=1).alignment = Alignment(horizontal="center")

summary_data = [
    ("总实验次数", len(experiments), ""),
    ("异常数据次数", sum(1 for e in experiments if e["is_outlier"]), "（传感器故障或操作失误）"),
    ("异常率", f"{sum(1 for e in experiments if e['is_outlier'])/len(experiments)*100:.1f}%", ""),
]

for i, (label, value, extra) in enumerate(summary_data):
    row = summary_start + 1 + i
    ws.merge_cells(f"A{row}:B{row}")
    ws.cell(row=row, column=1, value=label).font = Font(name="微软雅黑", bold=True, size=10)
    ws.cell(row=row, column=1).alignment = cell_align
    ws.cell(row=row, column=3, value=value).font = Font(name="微软雅黑", size=10)
    ws.cell(row=row, column=3).alignment = cell_align
    ws.cell(row=row, column=4, value=extra).font = Font(name="微软雅黑", size=9, color="888888")

# --- per-metal summary ---
metal_summary_start = summary_start + 5
ws.merge_cells(f"A{metal_summary_start}:K{metal_summary_start}")
ws.cell(row=metal_summary_start, column=1, value="各金属实验电导率 vs 参考电导率").font = Font(name="微软雅黑", bold=True, size=12, color="1F4E79")
ws.cell(row=metal_summary_start, column=1).alignment = Alignment(horizontal="center")

metal_headers = ["金属材料", "参考电导率 (S/m)", "实验平均值 (S/m)", "平均误差 (%)", "实验次数", "异常次数"]
for col_idx, h in enumerate(metal_headers, 1):
    cell = ws.cell(row=metal_summary_start + 1, column=col_idx, value=h)
    cell.font = Font(name="微软雅黑", bold=True, size=10, color="FFFFFF")
    cell.fill = PatternFill(start_color="5B9BD5", end_color="5B9BD5", fill_type="solid")
    cell.alignment = header_align
    cell.border = thin_border

for i, (metal_name, sigma_ref, v_ref) in enumerate(metals):
    row = metal_summary_start + 2 + i
    metal_exps = [e for e in experiments if e["metal"] == metal_name]
    normal_exps = [e for e in metal_exps if not e["is_outlier"]]
    avg_sigma = sum(e["sigma_exp"] for e in normal_exps) / len(normal_exps) if normal_exps else 0
    avg_error = sum(e["error_pct"] for e in normal_exps) / len(normal_exps) if normal_exps else 0
    outlier_count = sum(1 for e in metal_exps if e["is_outlier"])

    vals = [
        metal_name,
        sigma_ref,
        avg_sigma,
        avg_error,
        len(metal_exps),
        outlier_count,
    ]
    for col_idx, val in enumerate(vals, 1):
        cell = ws.cell(row=row, column=col_idx, value=val)
        cell.alignment = cell_align
        cell.border = thin_border
        cell.font = Font(name="微软雅黑", size=10)
        if col_idx in [2, 3]:
            cell.number_format = '0.00E+00'
        if col_idx == 4:
            cell.number_format = '0.0"%"'

# ============================================================
# Sheet 2: 详细测量记录（以铜为例）
# ============================================================
ws2 = wb.create_sheet("铜-详细测量数据")

ws2.merge_cells("A1:H1")
ws2["A1"].value = "铜 (Cu) — 30°斜面实验详细测量记录（第1次实验）"
ws2["A1"].font = Font(name="微软雅黑", bold=True, size=14, color="1F4E79")
ws2["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws2.row_dimensions[1].height = 32

detail_headers = [
    "采样序号",
    "时间 t (s)",
    "位移 d (mm)",
    "速度 v (m/s)",
    "加速度 a (m/s²)",
    "动能 Ek (J)",
    "势能 Ep (J)",
    "内能 Ein (J)",
]

for col_idx, h in enumerate(detail_headers, 1):
    cell = ws2.cell(row=3, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

col_widths2 = [12, 14, 14, 14, 16, 14, 14, 14]
for i, w in enumerate(col_widths2, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

# Simulate detailed time-series data for copper experiment
g = 9.81
theta = 30
sin_theta = 0.5
mass = 0.1
track_length = 2.0  # m
B = 0.5
d = 0.005
A = 0.002
sigma = 5.96e7  # copper reference
k = sigma * B**2 * d * A  # damping coefficient
# Terminal velocity: mg sinθ = k * v_max
v_terminal = mass * g * sin_theta / k

# Simulate with Euler method, 50ms steps
dt = 0.05
t = 0.0
x = 0.0
v = 0.0
sample_num = 0
row = 4

while x < track_length and t < 60:
    sample_num += 1
    a = g * sin_theta - (k / mass) * v
    if a < 0 and v < 0.001:
        break

    # Add small random noise to simulate real measurement
    x_measured = x * 1000 + random.uniform(-2, 2)  # mm, ±2mm noise
    v_measured = v + random.uniform(-0.002, 0.002)
    a_measured = a + random.uniform(-0.05, 0.05)

    Ek = 0.5 * mass * v_measured**2
    Ep = mass * g * x * sin_theta
    Ein = mass * g * (track_length - x) * sin_theta  # remaining potential

    values = [
        sample_num,
        round(t, 3),
        round(x_measured, 1),
        round(v_measured, 4),
        round(a_measured, 4),
        round(Ek, 5),
        round(Ep, 5),
        round(Ein, 5),
    ]
    for col_idx, val in enumerate(values, 1):
        cell = ws2.cell(row=row, column=col_idx, value=val)
        cell.alignment = cell_align
        cell.border = thin_border
        cell.font = Font(name="Consolas", size=9)

    ws2.row_dimensions[row].height = 18
    row += 1

    # Euler step
    v = v + a * dt
    x = x + v * dt
    t = t + dt

    # Every 20th sample to keep file manageable
    # Actually let's keep all of them since it's just a demo

# ============================================================
# Sheet 3: 实验参数与公式
# ============================================================
ws3 = wb.create_sheet("实验参数与公式")

ws3.merge_cells("A1:C1")
ws3["A1"].value = "实验参数与计算公式"
ws3["A1"].font = Font(name="微软雅黑", bold=True, size=14, color="1F4E79")
ws3["A1"].alignment = Alignment(horizontal="center")

params = [
    ("实验参数", "", ""),
    ("斜面角度 θ", "30°", ""),
    ("重力加速度 g", "9.81 m/s²", ""),
    ("滑块质量 m", "0.100 kg", ""),
    ("磁感应强度 B", "0.50 T", "钕磁铁"),
    ("垫板厚度 d", "5.0 mm", "铝垫板"),
    ("有效接触面积 A", "0.002 m²", "20mm × 100mm"),
    ("轨道总长度 L", "2000 mm", ""),
    ("", "", ""),
    ("计算公式", "", ""),
    ("下滑力", "F∥ = mg·sinθ", ""),
    ("电磁阻尼力", "F阻尼 = k·v = σB²dA·v", ""),
    ("力平衡条件", "mg·sinθ = σB²dA·v_max", ""),
    ("电导率公式", "σ = mg·sinθ / (B²dA·v_max)", ""),
    ("", "", ""),
    ("电导率参考值 (S/m)", "", ""),
    ("银 Ag", "6.30 × 10⁷", ""),
    ("铜 Cu", "5.96 × 10⁷", ""),
    ("铝 Al", "3.77 × 10⁷", ""),
    ("不锈钢 (304)", "1.45 × 10⁶", ""),
    ("", "", ""),
    ("⚠ 注意", "铁 (Fe) 为铁磁性材料，会被磁铁直接吸附，无法进行涡流阻尼实验，故不纳入本实验。", ""),
]

for i, (label, val, note) in enumerate(params):
    row = 3 + i
    ws3.cell(row=row, column=1, value=label).font = Font(name="微软雅黑", bold=(i in [0, 9, 16]), size=10)
    ws3.cell(row=row, column=2, value=val).font = Font(name="微软雅黑", size=10)
    ws3.cell(row=row, column=3, value=note).font = Font(name="微软雅黑", size=9, color="888888")
    ws3.cell(row=row, column=2).alignment = Alignment(horizontal="center")

ws3.column_dimensions["A"].width = 26
ws3.column_dimensions["B"].width = 32
ws3.column_dimensions["C"].width = 20

# --- freeze panes ---
ws.freeze_panes = "A5"
ws2.freeze_panes = "A4"

# --- autofilter ---
ws.auto_filter.ref = f"A4:K{last_data_row}"

# Save
output_path = r"d:\last_project\30度斜面实验数据_v2.xlsx"
wb.save(output_path)
print(f"Excel saved to: {output_path}")
print(f"Total experiments: {len(experiments)}")
print(f"Outliers: {sum(1 for e in experiments if e['is_outlier'])}")
