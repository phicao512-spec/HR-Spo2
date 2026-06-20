import csv, random, os
from collections import Counter

INPUT  = r'c:\Users\Asus\OneDrive\Desktop\NgoDinhPhong\SpO2_HeartRate_Monitor\dataset_raw\human_vital_signs_dataset_2024.csv'
OUTPUT = r'c:\Users\Asus\OneDrive\Desktop\NgoDinhPhong\SpO2_HeartRate_Monitor\dataset_max30102.csv'

random.seed(42)

# --- Doc du lieu goc (Normal: HR 60-100, SpO2 95-100) ---
normal_rows = []
with open(INPUT, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            hr   = float(row['Heart Rate'])
            spo2 = float(row['Oxygen Saturation'])
        except Exception:
            continue
        normal_rows.append({'heart_rate': round(hr, 1), 'spo2': round(spo2, 2), 'label': 'Normal'})

random.shuffle(normal_rows)
normals = normal_rows[:4000]
print(f"Normal tu Kaggle: {len(normals)} mau")

# --- Tao Warning theo tieu chuan WHO ---
# Warning: SpO2 90-94%  HOAC  HR 101-119  HOAC  HR 51-59
warnings = []
for _ in range(4000):
    case = random.randint(0, 2)
    if case == 0:
        hr   = round(random.uniform(60, 100), 1)
        spo2 = round(random.uniform(90.0, 94.9), 2)
    elif case == 1:
        hr   = round(random.uniform(101, 119), 1)
        spo2 = round(random.uniform(95.0, 99.9), 2)
    else:
        hr   = round(random.uniform(51, 59), 1)
        spo2 = round(random.uniform(95.0, 99.9), 2)
    warnings.append({'heart_rate': hr, 'spo2': spo2, 'label': 'Warning'})
print(f"Warning (tong hop theo WHO): {len(warnings)} mau")

# --- Tao Danger theo tieu chuan WHO ---
# Danger: SpO2<90%  HOAC  HR>120  HOAC  HR<50
dangers = []
for _ in range(4000):
    case = random.randint(0, 2)
    if case == 0:
        hr   = round(random.uniform(50, 130), 1)
        spo2 = round(random.uniform(70.0, 89.9), 2)
    elif case == 1:
        hr   = round(random.uniform(121, 180), 1)
        spo2 = round(random.uniform(80.0, 99.9), 2)
    else:
        hr   = round(random.uniform(20, 49), 1)
        spo2 = round(random.uniform(80.0, 99.9), 2)
    dangers.append({'heart_rate': hr, 'spo2': spo2, 'label': 'Danger'})
print(f"Danger (tong hop theo WHO): {len(dangers)} mau")

# --- Gop va xao tron ---
all_data = normals + warnings + dangers
random.shuffle(all_data)

with open(OUTPUT, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['heart_rate', 'spo2', 'label'])
    writer.writeheader()
    writer.writerows(all_data)

cnt = Counter(r['label'] for r in all_data)
print()
print(f"=== HOAN THANH ===")
print(f"Tong so mau: {len(all_data)}")
print("Phan bo:")
for k in ['Normal', 'Warning', 'Danger']:
    print(f"  {k:8s}: {cnt[k]} mau")

print()
print("Preview 2 mau moi nhan:")
for lbl in ['Normal', 'Warning', 'Danger']:
    samples = [r for r in all_data if r['label'] == lbl][:2]
    print(f"  [{lbl}]")
    for s in samples:
        print(f"    HR={s['heart_rate']}  SpO2={s['spo2']}")

size = os.path.getsize(OUTPUT)
print()
print(f"File: {OUTPUT}")
print(f"Kich thuoc: {size/1024:.1f} KB")
