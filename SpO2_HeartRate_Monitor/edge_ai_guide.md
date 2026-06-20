# Hướng Dẫn Edge AI với Edge Impulse
# Thiết Bị Đeo Giám Sát Nhịp Tim & SpO2

**Nền tảng:** Edge Impulse (edgeimpulse.com)  
**Target Hardware:** ESP32-S3 N16R8 DevKitC  
**Mục tiêu:** Phân loại trạng thái sức khỏe: Normal / Warning / Danger  

---

## Tổng Quan Quy Trình

```
[1] Thu thập / tìm Dataset
        │
        ▼
[2] Import vào Edge Impulse
        │
        ▼
[3] Thiết kế Impulse (Feature + Learning Block)
        │
        ▼
[4] Train Model
        │
        ▼
[5] Test & Đánh giá
        │
        ▼
[6] Deploy → Arduino Library / C++ SDK
        │
        ▼
[7] Tích hợp vào Firmware ESP32-S3
        │
        ▼
[8] Inference + Cảnh báo Real-time
```

---

## Bước 1: Thu Thập Dataset

### 1.1 Lý Do Cần Dataset Tốt

Model AI chỉ tốt khi data tốt. Với bài toán phân loại sức khỏe từ HR + SpO2, cần dataset có đủ:
- Mẫu trạng thái **Normal** (đủ nhiều — thường chiếm đa số)
- Mẫu trạng thái **Warning** (SpO2 thấp dần, HR bất thường nhẹ)
- Mẫu trạng thái **Danger** (SpO2 < 90%, HR quá cao/thấp đột ngột)

### 1.2 Dataset Kaggle Khuyến Nghị

#### Lựa chọn 1 — "Health Data" phổ biến nhất:
- **Dataset:** [Body Signal of Smoking](https://www.kaggle.com/datasets/kukuroo3/body-signal-of-smoking) — có cột HR, SpO2
- **Dataset:** [Heart Rate and SpO2 Data](https://www.kaggle.com/datasets/muhammadtalha786/heart-rate-and-spo2-data) — trực tiếp HR + SpO2 + status

#### Lựa chọn 2 — Tự tạo nhãn:
```
HR (bpm)    SpO2 (%)    Nhãn (tự đặt)
70          98          Normal
85          97          Normal
105         94          Warning
130         92          Warning
145         88          Danger
55          85          Danger
```

> **Gợi ý thực tế:** Tạo bộ dữ liệu tổng hợp (synthetic) dựa trên tiêu chuẩn y khoa, sau đó import vào Edge Impulse. Đây là cách nhanh nhất khi thiếu data thực tế có nhãn "Danger".

### 1.3 Tạo Dataset CSV Thủ Công

Tạo file `health_data.csv` với format:

```csv
heart_rate,spo2,label
72,98,Normal
68,97,Normal
75,99,Normal
80,96,Normal
90,94,Warning
95,93,Warning
85,92,Warning
110,91,Warning
125,89,Danger
140,87,Danger
50,85,Danger
145,90,Danger
```

**Cần ít nhất:**
- 50+ mẫu Normal
- 30+ mẫu Warning  
- 30+ mẫu Danger

---

## Bước 2: Tạo Tài Khoản & Project Edge Impulse

### 2.1 Đăng Ký

1. Truy cập [https://edgeimpulse.com](https://edgeimpulse.com)
2. Nhấn **Sign Up** → dùng email hoặc GitHub
3. Tạo project mới: **Create new project** → Đặt tên `SpO2_HR_Monitor`
4. Chọn **Any** cho device type (sẽ deploy cho ESP32-S3 sau)

---

## Bước 3: Import Dataset vào Edge Impulse

### 3.1 Dùng CSV Wizard

1. Vào **Data Acquisition** (menu trái)
2. Nhấn **Upload data** → chọn **CSV files**
3. Kéo thả file `health_data.csv` vào
4. Cấu hình CSV Wizard:

```
Is this time series data? → NO  (data từng điểm độc lập)

Column mapping:
  heart_rate → Feature column
  spo2       → Feature column  
  label      → Label column

Split ratio: 80% Training / 20% Testing (tick "Automatic split")
```

5. Nhấn **Start upload** → Chờ upload hoàn tất

### 3.2 Kiểm Tra Data

- Vào tab **Training data** → xem số mẫu theo từng nhãn
- Đảm bảo 3 nhãn đều có mẫu (không bị imbalanced quá mức)
- Nếu ít data Danger: dùng **Data augmentation** hoặc thêm mẫu thủ công

---

## Bước 4: Thiết Kế Impulse

1. Vào **Impulse design** → **Create impulse**

### 4.1 Input Block

```
Add input block: Raw data
  Time series length: 1 (vì mỗi sample là 1 điểm, không phải chuỗi)
  Window increase: 1
  Frequency: 1 Hz
  Columns: heart_rate, spo2
```

### 4.2 Processing Block

```
Add processing block: Flatten
  (Vì data không phải time series → Flatten lấy raw values)
```

### 4.3 Learning Block

```
Add learning block: Classification (Keras)
  Output features: Normal, Warning, Danger
```

Nhấn **Save Impulse**

---

## Bước 5: Cấu Hình Feature & Train Model

### 5.1 Flatten Block

1. Vào **Flatten** trong menu trái
2. Nhấn **Save parameters** → **Generate features**
3. Chờ feature generation hoàn tất
4. Kiểm tra **Feature explorer** — 3 nhãn nên tách biệt nhau trên đồ thị

### 5.2 Train Classifier

1. Vào **Classifier** → cấu hình:

```
Number of training cycles: 100
Learning rate: 0.001
Validation set size: 20%

Neural network architecture (mặc định đủ dùng):
  Input layer → Dense(20, relu) → Dense(10, relu) → Output(3, softmax)
```

2. Nhấn **Start training**
3. Chờ ~1–2 phút (model nhỏ, chạy nhanh)

### 5.3 Đánh Giá Kết Quả

Sau khi train xong, xem:
- **Accuracy:** Mục tiêu ≥ 85%
- **Confusion matrix:** Xem nhãn nào dự đoán sai nhiều nhất
- **On-device performance:** RAM, Flash, Inference time trên ESP32-S3

Nếu accuracy thấp:
- Thêm data
- Điều chỉnh kiến trúc network (thêm layer/neuron)
- Cân bằng lại tỉ lệ nhãn

---

## Bước 6: Test Model

1. Vào **Model testing** → **Classify all**
2. Xem accuracy trên tập test (20% data chưa dùng để train)
3. Mục tiêu: ≥ 80% accuracy trên tập test

### Live Classification (Tùy chọn)

Nếu muốn test với data thực từ thiết bị:
1. Cài Edge Impulse CLI: `npm install -g edge-impulse-cli`
2. Kết nối ESP32-S3 → chạy `edge-impulse-daemon`
3. Quay lại web → **Live classification** → nhập data thực

---

## Bước 7: Deploy Model cho ESP32-S3

### 7.1 Export dạng Arduino Library

1. Vào **Deployment** → chọn **Arduino library**
2. Tick **Quantized (int8)** để giảm kích thước model
3. Nhấn **Build** → Tải về file `.zip`

### 7.2 Cài vào Arduino IDE

1. Mở Arduino IDE
2. **Sketch** → **Include Library** → **Add .ZIP Library**
3. Chọn file `.zip` vừa tải về
4. Library được cài với tên: `SpO2_HR_Monitor_inferencing`

### 7.3 Export dạng C++ Library (Thay thế)

Nếu không dùng Arduino IDE:
1. Chọn **C++ library** trong Deployment
2. Giải nén → copy vào project PlatformIO/ESP-IDF

---

## Bước 8: Tích Hợp vào Firmware Arduino

### 8.1 Include Headers

```cpp
#include <SpO2_HR_Monitor_inferencing.h>  // Thay bằng tên project của bạn
```

### 8.2 Cấu Trúc Inference

```cpp
// Số features = 2 (heart_rate và spo2)
// Phải khớp với EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE
float features[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];

int raw_feature_get_data(size_t offset, size_t length, float *out_ptr) {
    memcpy(out_ptr, features + offset, length * sizeof(float));
    return 0;
}

void run_inference(float heart_rate, float spo2) {
    features[0] = heart_rate;
    features[1] = spo2;
    
    signal_t signal;
    signal.total_length = EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE;
    signal.get_data = &raw_feature_get_data;
    
    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR err = run_classifier(&signal, &result, false);
    
    if (err != EI_IMPULSE_OK) {
        Serial.printf("Lỗi inference: %d\n", err);
        return;
    }
    
    // In kết quả
    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        Serial.printf("  %s: %.2f\n", 
            result.classification[ix].label,
            result.classification[ix].value);
    }
    
    // Lấy nhãn có confidence cao nhất
    float max_conf = 0;
    const char* predicted_label = "";
    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        if (result.classification[ix].value > max_conf) {
            max_conf = result.classification[ix].value;
            predicted_label = result.classification[ix].label;
        }
    }
    
    Serial.printf("→ Dự đoán: %s (%.0f%%)\n", predicted_label, max_conf * 100);
    
    // Cập nhật trạng thái global
    current_status = String(predicted_label);
}
```

### 8.3 Gọi Inference Trong Loop()

```cpp
void loop() {
    // ... đọc MAX30102 ...
    
    float hr = calculateHR();
    float spo2 = calculateSpO2();
    
    if (hr > 0 && spo2 > 0) {
        run_inference(hr, spo2);  // Chạy Edge AI
        updateOLED(hr, spo2, current_status);
        // Web server tự động trả current_status qua HTTP
    }
    
    delay(4000);  // Chạy mỗi 4 giây
}
```

---

## Bước 9: Xử Lý Kết Quả & Cảnh Báo

```cpp
void handle_alert(String status) {
    if (status == "Normal") {
        // LED xanh, không làm gì
        digitalWrite(LED_GREEN, HIGH);
        digitalWrite(LED_RED, LOW);
    } 
    else if (status == "Warning") {
        // LED vàng nhấp nháy
        digitalWrite(LED_GREEN, LOW);
        // Nhấp nháy trong 3 giây
        for (int i = 0; i < 6; i++) {
            digitalWrite(LED_YELLOW, !digitalRead(LED_YELLOW));
            delay(500);
        }
    }
    else if (status == "Danger") {
        // LED đỏ + buzzer (nếu có)
        digitalWrite(LED_RED, HIGH);
        digitalWrite(LED_GREEN, LOW);
        tone(BUZZER_PIN, 1000, 500);  // Buzzer 1kHz, 0.5 giây
    }
}
```

---

## Bước 10: Tối Ưu Model cho ESP32-S3

### RAM & Flash Sử Dụng (Ước Tính)

| Metric | Giá trị ước tính |
|---|---|
| RAM (arena) | ~2 KB |
| Flash (model) | ~5 KB |
| Inference time | ~1 ms |

ESP32-S3 N16R8 có 512KB SRAM và 16MB Flash → **hoàn toàn đủ**.

### Lưu Ý Khi Build

- Chọn **Quantized (int8)** khi export → giảm model ~4x, tăng tốc inference
- Trong Arduino IDE, chọn board: **ESP32S3 Dev Module**
- Partition scheme: **Huge APP (3MB No OTA / 1MB SPIFFS)** → đủ flash cho model

---

## Checklist Triển Khai Edge AI

- [ ] Đã có dataset với đủ 3 nhãn (Normal, Warning, Danger)
- [ ] Upload lên Edge Impulse thành công
- [ ] Feature generation không lỗi
- [ ] Model accuracy ≥ 85% trên training set
- [ ] Model accuracy ≥ 80% trên test set
- [ ] Confusion matrix không có nhầm lẫn nghiêm trọng (Normal ↔ Danger)
- [ ] Export Arduino library thành công
- [ ] Cài được vào Arduino IDE
- [ ] Code inference chạy không lỗi trên ESP32-S3
- [ ] Kết quả inference khớp khi nhập data test thủ công

---

## Tài Nguyên Tham Khảo

| Tài nguyên | Link |
|---|---|
| Edge Impulse Documentation | https://docs.edgeimpulse.com |
| AI Oximeter ESP32-S3 (DFRobot) | https://community.dfrobot.com/makelog-315026.html |
| Edge Impulse CSV Wizard | https://docs.edgeimpulse.com/docs/edge-impulse-studio/data-acquisition/csv-wizard |
| ESP32-S3 Arduino Setup | https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html |
| Dataset Kaggle — HR & SpO2 | https://www.kaggle.com/search?q=heart+rate+spo2 |
