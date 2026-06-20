# Sơ Đồ Nguyên Lý Phần Cứng
# Thiết Bị Đeo Giám Sát Nhịp Tim & SpO2

**MCU:** ESP32-S3 N16R8 DevKitC  
**Phiên bản:** v1.0  

---

## 1. Tổng Quan Kiến Trúc Phần Cứng

```
┌─────────────────────────────────────────────────────────────────┐
│                    NGUỒN ĐIỆN                                   │
│                                                                 │
│  [Pin 18650 Li-Ion 3.7V]                                        │
│       │                                                         │
│       └──→ [Module Sạc 18650 (TP4056 tích hợp bảo vệ)]         │
│                 │                                               │
│                 └──→ OUT+ / OUT- ──→ ESP32-S3 DevKitC (5V USB) │
│                       hoặc ──→ 3.3V LDO trên DevKit            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                ESP32-S3 N16R8 DevKitC                           │
│                                                                 │
│  GPIO 8  (SDA) ──┬──→ MAX30102 (SDA)                           │
│  GPIO 9  (SCL) ──┤──→ MAX30102 (SCL)    I2C Bus chung          │
│                  └──→ SSD1306 OLED (SDA/SCL)                    │
│                                                                 │
│  3.3V ──┬──→ MAX30102 (VCC)                                     │
│         └──→ SSD1306 OLED (VCC)                                 │
│                                                                 │
│  GND  ──┬──→ MAX30102 (GND)                                     │
│         └──→ SSD1306 OLED (GND)                                 │
│                                                                 │
│  [WiFi Antenna Built-in] ──→ Router WiFi → Trình duyệt Web     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Sơ Đồ Kết Nối Chi Tiết

### 2.1 ESP32-S3 DevKitC ↔ MAX30102

```
ESP32-S3 DevKitC          MAX30102 Module
─────────────────          ──────────────
3.3V  ─────────────────→  VCC
GND   ─────────────────→  GND
GPIO 8 (SDA) ──────────→  SDA
GPIO 9 (SCL) ──────────→  SCL
(không nối)  ──────────   INT  (ngắt, tùy chọn)
```

**Lưu ý:**
- MAX30102 đã tích hợp điện trở pull-up trên module breakout
- Địa chỉ I2C: `0x57`
- Điện áp hoạt động: 1.8V – 3.3V → dùng 3.3V từ DevKit

### 2.2 ESP32-S3 DevKitC ↔ OLED SSD1306 (0.96")

```
ESP32-S3 DevKitC          SSD1306 OLED 0.96"
─────────────────          ───────────────────
3.3V  ─────────────────→  VCC
GND   ─────────────────→  GND
GPIO 8 (SDA) ──────────→  SDA     (cùng I2C bus với MAX30102)
GPIO 9 (SCL) ──────────→  SCL     (cùng I2C bus với MAX30102)
```

**Lưu ý:**
- SSD1306 địa chỉ I2C: `0x3C` (hoặc `0x3D` nếu chân SA0 nối HIGH)
- Khác địa chỉ với MAX30102 (`0x57`) → không xung đột

### 2.3 Module Sạc 18650 ↔ ESP32-S3

```
Module Sạc 18650           ESP32-S3 DevKitC
────────────────           ─────────────────
OUT+ (3.7V–4.2V) ──────→  5V hoặc VBUS (qua USB)
OUT- (GND) ─────────────→  GND
```

**Phương án đơn giản nhất:**
- Nối OUT của module sạc vào cổng **Micro-USB hoặc USB-C** của DevKit qua dây
- Hoặc nối thẳng vào chân **5V** và **GND** trên header của DevKit

> ⚠️ **Cảnh báo:** Module sạc 18650 output trực tiếp ~3.7V. Nếu nối vào chân 5V thì cần mạch boost 5V (dùng thêm module boost MT3608 hoặc tương đương). Cách đơn giản nhất là nối qua cổng USB của DevKit (DevKit có LDO tự điều chỉnh).

---

## 3. Sơ Đồ Nguyên Lý Tổng Thể (ASCII)

```
                      ┌──────────────────────────────────────────────────────┐
                      │             ESP32-S3 N16R8 DevKitC                  │
                      │                                                      │
   ┌──────────┐       │  GPIO8 ─────────────────────────────────────┐       │
   │MAX30102  │       │  (SDA)                                      │       │
   │          │       │                                             ▼       │
   │ VCC─────────────────3.3V                               ┌──────────────┐│
   │ GND─────────────────GND                                │ SSD1306 OLED ││
   │ SDA─────────────────GPIO8 (SDA)                        │  0.96" I2C  ││
   │ SCL─────────────────GPIO9 (SCL)──────────────────────→ │              ││
   │  I2C                                                   │ VCC──3.3V   ││
   │ 0x57     │       │  GPIO9 ─────────────────────────────│ GND──GND    ││
   └──────────┘       │  (SCL)                              │ SDA──GPIO8  ││
                      │                                     │ SCL──GPIO9  ││
                      │  [WiFi 2.4GHz]                      └──────────────┘│
                      │      │                                              │
                      │      ▼                                              │
                      │  [Mạng WiFi nội bộ] ──→ [Trình duyệt điện thoại/PC]│
                      │                                                      │
                      │  USB-C / 5V ←────────────────────────────────────┐  │
                      └──────────────────────────────────────────────────│──┘
                                                                         │
                      ┌──────────────────────────────────────────────────┘
                      │
               ┌──────────────┐
               │ Module Sạc   │
               │ 18650        │
               │              │
               │  OUT+ ───────│ (3.7V → 5V cần boost, hoặc qua USB)
               │  OUT- ───────│ (GND)
               │  USB-IN ─────│ (cổng sạc)
               └──────┬───────┘
                      │
               [Pin Li-Ion 18650]
               [3.7V, 2000-3500mAh]
```

---

## 4. Bảng Chân Kết Nối Tổng Hợp

| Từ | Chân | Đến | Chân | Ghi chú |
|---|---|---|---|---|
| ESP32-S3 | GPIO 8 | MAX30102 | SDA | I2C Data |
| ESP32-S3 | GPIO 9 | MAX30102 | SCL | I2C Clock |
| ESP32-S3 | 3.3V | MAX30102 | VCC | Nguồn cảm biến |
| ESP32-S3 | GND | MAX30102 | GND | Đất chung |
| ESP32-S3 | GPIO 8 | SSD1306 | SDA | Cùng I2C bus |
| ESP32-S3 | GPIO 9 | SSD1306 | SCL | Cùng I2C bus |
| ESP32-S3 | 3.3V | SSD1306 | VCC | Nguồn màn hình |
| ESP32-S3 | GND | SSD1306 | GND | Đất chung |
| Module Sạc | OUT+ | ESP32-S3 | 5V/USB | Nguồn chính |
| Module Sạc | OUT- | ESP32-S3 | GND | Đất |
| Pin 18650 | (+) | Module Sạc | B+ | Pin dương |
| Pin 18650 | (-) | Module Sạc | B- | Pin âm |

---

## 5. Địa Chỉ I2C Các Thiết Bị

| Thiết bị | Địa chỉ I2C | Ghi chú |
|---|---|---|
| MAX30102 | `0x57` | Cố định, không thay đổi được |
| SSD1306 OLED | `0x3C` | Mặc định (chân SA0 = GND) |

> Hai địa chỉ khác nhau hoàn toàn → chia sẻ cùng I2C bus trên GPIO 8/9 an toàn.

---

## 6. Khuyến Nghị Kỹ Thuật

### 6.1 Chống Nhiễu MAX30102

- Bọc vùng cảm biến bằng băng keo đen hoặc vỏ nhựa tối màu
- Đặt cảm biến áp sát ngón tay với áp lực nhẹ, đều đặn
- Không bóp mạnh (ảnh hưởng lưu lượng máu → sai số lớn)
- Tránh đèn huỳnh quang mạnh gần cảm biến

### 6.2 Pull-up Resistor I2C

- Module breakout MAX30102 thường đã có 4.7kΩ pull-up sẵn
- Module SSD1306 cũng thường có pull-up sẵn
- Nếu tự thiết kế PCB: thêm 4.7kΩ từ SDA/SCL lên 3.3V

### 6.3 Nguồn Điện

- Nếu dùng pin 18650 (3.7V) nối trực tiếp: cần **module boost 5V** để cấp cho USB/5V của DevKit
- Thay thế đơn giản: Dùng **power bank** thông thường → cắm vào USB-C DevKit → không cần thêm mạch
- Mạch sạc TP4056 có bảo vệ quá áp, quá dòng, ngắn mạch → an toàn

### 6.4 GPIO Thay Thế

Nếu GPIO 8/9 bị xung đột, có thể dùng:

```cpp
// Trong code Arduino
Wire.begin(SDA_PIN, SCL_PIN);  // Đặt I2C tùy chỉnh
```

Các GPIO khả dụng trên ESP32-S3 DevKitC cho I2C:
- SDA: GPIO 8, 10, 11, 38, 39, 40
- SCL: GPIO 9, 12, 13, 41, 42, 43

---

## 7. Ghi Chú PCB / Breadboard

### Thứ tự lắp trên Breadboard

1. Gắn ESP32-S3 DevKitC lên breadboard (cần loại rộng ≥ 830 lỗ)
2. Nối 3.3V và GND từ DevKit ra rails nguồn
3. Nối MAX30102: VCC → rail 3.3V, GND → rail GND, SDA → GPIO8, SCL → GPIO9
4. Nối SSD1306: VCC → rail 3.3V, GND → rail GND, SDA → GPIO8, SCL → GPIO9
5. Kết nối module sạc và pin 18650
6. Cấp nguồn qua USB trước để test (tránh dùng pin khi chưa kiểm tra)

### Kiểm Tra Trước Khi Cấp Điện

- [ ] Đo thông mạch VCC–GND: đảm bảo không ngắn mạch
- [ ] Kiểm tra chiều cực pin 18650
- [ ] Xác nhận dây SDA/SCL đúng vị trí
