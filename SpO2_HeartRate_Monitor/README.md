# Thiết Bị Đeo Giám Sát Nhịp Tim & SpO2

> **Nhóm chuyên đề:** IoT & Y sinh  
> **Cấp độ:** Nâng cao (NC) — Edge AI cảnh báo bất thường  
> **Tác giả:** Cao Xuân Phi — N22DCDT044  
> **Cập nhật lần cuối:** 2026-06-20

---

## Tổng Quan

Dự án thiết kế thiết bị đeo tay giám sát sức khỏe theo thời gian thực, đo **nhịp tim (Heart Rate)** và **nồng độ oxy trong máu (SpO2)** sử dụng cảm biến quang học MAX30102, xử lý trên vi điều khiển ESP32-S3, hiển thị trên màn hình OLED và truyền dữ liệu qua WiFi tới Web Dashboard nội bộ.

Tích hợp **Edge AI (Edge Impulse)** để phân loại trạng thái sức khỏe và cảnh báo bất thường có thể liên quan đến đột quỵ hoặc suy hô hấp.

---

## Phần Cứng

| Thành phần | Chi tiết |
|---|---|
| MCU | ESP32-S3 N16R8 DevKitC |
| Cảm biến | MAX30102 (HR + SpO2, giao tiếp I2C) |
| Màn hình | OLED SSD1306 0.96 inch (I2C) |
| Kết nối | WiFi 2.4GHz (Web Dashboard nội bộ) |
| Nguồn | Li-Ion 18650 + mạch sạc tích hợp |

**Kết nối I2C:**

| Tín hiệu | ESP32-S3 GPIO |
|---|---|
| SDA | GPIO 8 |
| SCL | GPIO 9 |

---

## Cấu Trúc Dự Án

```
SpO2_HeartRate_Monitor/
├── README.md                  ← File này — tổng quan & changelog
├── PRD.md                     ← Product Requirements Document
├── PRD_Academic.md            ← PRD phiên bản học thuật
├── schematic.md               ← Sơ đồ nguyên lý + bảng kết nối
├── edge_ai_guide.md           ← Hướng dẫn Edge Impulse: dataset → train → deploy
├── build_dataset.py           ← Script tạo dataset CSV từ raw data
├── dataset_max30102.csv       ← Dataset HR/SpO2 đã xử lý
├── dataset_raw/               ← Dữ liệu thô từ cảm biến
├── firmware/
│   └── MAX30102_Monitor/
│       └── MAX30102_Monitor.ino  ← Firmware chính (Arduino/ESP32)
└── node_modules/              ← Công cụ tạo tài liệu (không deploy)
```

---

## Luồng Hệ Thống

```
MAX30102 (I2C)
     │
     ▼
ESP32-S3 N16R8 DevKitC
     │
     ├──→ OLED SSD1306 (I2C): Hiển thị HR / SpO2 / Trạng thái
     │
     ├──→ WiFi → Web Dashboard (HTML/JS): Biểu đồ thời gian thực
     │
     └──→ Edge Impulse Model (TFLite Micro): Phân loại Normal / Warning / Danger
                  │
                  └──→ Cảnh báo (LED / Web notification)
```

---

## Tính Năng Chính

- [x] Đo HR và SpO2 liên tục từ MAX30102
- [x] Hiển thị real-time trên OLED SSD1306
- [x] Web Dashboard nội bộ (hosted trên ESP32-S3 qua WiFi)
- [x] Phân loại trạng thái sức khỏe bằng Edge AI (Normal / Warning / Danger / Anomaly)
- [x] Cảnh báo khi phát hiện bất thường
- [x] Custom HAL-style driver cho MAX30102 (không phụ thuộc thư viện SparkFun sensor)
- [ ] Lưu lịch sử dữ liệu (mở rộng tương lai)
- [ ] Ứng dụng di động (mở rộng tương lai)

---

## Driver MAX30102 — Custom HAL Port

> **Thay đổi quan trọng:** Firmware đã được port từ driver STM32 HAL (`max30102_for_stm32_hal.c/.h`)  
> sang Arduino/ESP32 sử dụng `Wire.h`, thay thế thư viện SparkFun MAX3010x sensor layer.

### Kiến trúc driver

| Lớp | STM32 HAL (gốc) | Arduino/ESP32 (port) |
|---|---|---|
| I2C write | `HAL_I2C_Master_Transmit()` | `Wire.beginTransmission()` + `write()` + `endTransmission()` |
| I2C read | `HAL_I2C_Master_Receive()` | `Wire.requestFrom()` + `read()` |
| Struct | `I2C_HandleTypeDef *_ui2c` | `TwoWire *_wire` |
| Init | `max30102_init(obj, hi2c)` | `max30102_init(obj, &Wire)` |

### Cấu hình sensor (đồng bộ với driver STM32 HAL)

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| Mode | SpO2 (0x03) | Đo cả IR + RED |
| Sampling Rate | 100 Hz | 100 mẫu/giây |
| Pulse Width | 18-bit / 411µs | Độ phân giải cao nhất |
| ADC Range | 4096 nA | Phạm vi ADC |
| LED IR | 6.4 mA | Dòng LED hồng ngoại |
| LED Red | 6.4 mA | Dòng LED đỏ |
| SMP AVE | 4 | Trung bình 4 mẫu/FIFO entry |
| Roll Over | ON | Tránh tràn FIFO |

### Các hàm driver inline (trong `MAX30102_Monitor.ino`)

```cpp
max30102_init(&particleSensor, &Wire);          // Khởi tạo
max30102_set_mode(&particleSensor, 0x03);       // SpO2 mode
max30102_set_sampling_rate(&particleSensor, 1); // 100 Hz
max30102_set_led_pulse_width(&particleSensor, 3); // 18-bit
max30102_set_adc_resolution(&particleSensor, 1);  // 4096 nA
max30102_set_led_current_1(&particleSensor, 6.4f); // IR LED
max30102_set_led_current_2(&particleSensor, 6.4f); // Red LED
max30102_set_fifo_config(&particleSensor, 2, 1, 15);
max30102_clear_fifo(&particleSensor);
max30102_read_fifo(&particleSensor);            // Poll 1 mẫu (loop)
max30102_read_fifo_bulk(..., 100);              // Thu 100 mẫu (SpO2)
```

---

## Thuật Toán SpO2

Sử dụng `maxim_heart_rate_and_oxygen_saturation()` từ SparkFun `spo2_algorithm.h`.

**Quan trọng — Thứ tự byte FIFO theo datasheet MAX30102:**
- `byte[0..2]` = **SLOT1 = RED LED**
- `byte[3..5]` = **SLOT2 = IR LED**

SpO2 được thu thập mỗi **10 giây** (buffer 100 mẫu × 100Hz = 1 giây đo + trung bình).

---

## Thư Viện Cần Cài (Arduino Library Manager)

1. **MAX30102_inferencing** → Add .ZIP (file `ei-max30102-arduino-*.zip`)
2. **SparkFun MAX3010x Pulse and Proximity Sensor Library**  
   _(Chỉ dùng `heartRate.h` + `spo2_algorithm.h`, KHÔNG dùng `MAX30105.h`)_
3. **Adafruit SSD1306**
4. **Adafruit GFX Library**

---

## Cài Đặt & Chạy

```bash
# 1. Clone repo
git clone https://github.com/phicao512-spec/HR-Spo2.git

# 2. Mở Arduino IDE
#    File → Open → firmware/MAX30102_Monitor/MAX30102_Monitor.ino

# 3. Cài thư viện (xem mục trên)

# 4. Chỉnh WiFi credentials trong file .ino
#define WIFI_SSID      "TEN_WIFI_CUA_BAN"
#define WIFI_PASSWORD  "MAT_KHAU"

# 5. Chọn Board: ESP32S3 Dev Module
#    Upload Speed: 921600
#    Flash Size: 16MB
#    PSRAM: OPI PSRAM

# 6. Upload → mở Serial Monitor 115200 baud
```

---

## Changelog

### 2026-06-21
- **[ALGO]** Thay thuật toán SpO2/HR bằng **EMA BPF sample-by-sample** (port từ [manhzzzz/stm32f-max30102-rtos](https://github.com/manhzzzz/stm32f-max30102-rtos/blob/main/Core/Src/main.c))
  - Xóa: `heartRate.h`, `spo2_algorithm.h`, `collectAndComputeSpO2()`, buffer 100 mẫu
  - Thêm: `max30102_cal()` — xử lý từng mẫu, kết quả ngay sau **~2-3 giây** (thay vì 10 giây)
  - Thêm: `#include <math.h>` (fabsf, fmaxf)
  - AI inference trigger: mỗi **5 giây** (thay vì sau mỗi lần batch collect)
- **[CLONE]** Clone repo `manhzzzz/stm32f-max30102-rtos` làm tài liệu tham khảo thuật toán

### 2026-06-20
- **[PORT]** Port driver MAX30102 từ STM32 HAL C sang Arduino/ESP32 (Wire.h)
  - Thay thế `MAX30105.h` (SparkFun sensor layer) bằng custom HAL-style driver inline
  - Giữ nguyên `heartRate.h`, `spo2_algorithm.h`, Edge Impulse AI, WiFi, OLED
- **[FIX]** Sửa lỗi hoán vị IR/RED buffer theo đúng datasheet MAX30102
  - SLOT1 = RED (byte 0-2), SLOT2 = IR (byte 3-5) trong SpO2 mode
  - Lỗi này là nguyên nhân chính khiến SpO2 trả về `valid=0`
- **[FIX]** Thêm timeout 15 giây cho vòng lặp thu 100 mẫu SpO2 (tránh treo vô hạn)
- **[SYNC]** Đồng bộ cấu hình sensor với driver STM32 HAL gốc
  - SR=100Hz, PW=18-bit, ADC=4096nA, LED=6.4mA, SMP_AVE=4

### 2026-06-13
- Khởi tạo dự án
- Thiết kế phần cứng và sơ đồ kết nối
- Tạo dataset HR/SpO2 và train Edge Impulse model
- Xây dựng firmware ban đầu với SparkFun MAX3010x library

---

## Tài Liệu Tham Khảo

- [MAX30102 Datasheet — Maxim Integrated](https://datasheets.maximintegrated.com/en/ds/MAX30102.pdf)
- [max30102_for_stm32_hal — GitHub](https://github.com/dacarson/max30102-for-stm32-hal)
- [SparkFun MAX3010x Arduino Library](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library)
- [Edge Impulse Documentation](https://docs.edgeimpulse.com)
- [Wifi Oximeter MAX30102 + ESP32](https://github.com/Probots-Electronics/Wifi-Oximiter-using-MAX30102-and-ESP32)
- [ESP32_MAX30102 Real-time HR/SpO2](https://github.com/nferrante93/ESP32_MAX30102)
