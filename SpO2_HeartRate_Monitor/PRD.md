# PRD — Product Requirements Document
# Thiết Bị Đeo Giám Sát Nhịp Tim & SpO2

**Dự án:** Wearable Heart Rate & SpO2 Monitor with Edge AI  
**Nhóm:** IoT & Y sinh  
**Phiên bản:** v1.0  
**Ngày:** 2026-06-13  

---

## 1. Bối Cảnh & Bài Toán

### 1.1 Vấn Đề

Các bệnh lý tim mạch và hô hấp như đột quỵ, suy tim, suy hô hấp thường diễn biến âm thầm trước khi xảy ra biến cố cấp. Các dấu hiệu sinh tồn như **nhịp tim (Heart Rate)** và **nồng độ oxy trong máu (SpO2)** là những chỉ số cảnh báo sớm quan trọng nhưng hiếm khi được theo dõi liên tục trong cuộc sống hàng ngày.

Thiết bị đo oxy xung thương mại (pulse oximeter) đắt tiền, không kết nối, và không có khả năng phân tích thông minh.

### 1.2 Giải Pháp

Thiết kế thiết bị đeo tay giá rẻ, mã nguồn mở, có khả năng:
- Đo HR và SpO2 liên tục
- Hiển thị trực tiếp trên màn hình OLED
- Gửi dữ liệu lên Web Dashboard qua WiFi
- Phân loại trạng thái sức khỏe bằng mô hình AI nhúng (Edge Impulse)
- Cảnh báo khi phát hiện các chỉ số bất thường

---

## 2. Đối Tượng Người Dùng

### 2.1 Người Dùng Chính

| Đối tượng | Mô tả |
|---|---|
| **Người cao tuổi** | Theo dõi sức khỏe tim mạch thường xuyên tại nhà |
| **Người bệnh mãn tính** | Bệnh nhân COPD, suy tim, tiểu đường cần giám sát SpO2 |
| **Người vận động** | Theo dõi nhịp tim trong quá trình tập luyện |
| **Người chăm sóc** | Người thân/y tá theo dõi bệnh nhân qua web |

### 2.2 Người Dùng Phụ

- Sinh viên kỹ thuật nghiên cứu thiết bị y sinh
- Nhà nghiên cứu cần thu thập dataset sinh lý

---

## 3. Yêu Cầu Phần Cứng

### 3.1 Linh Kiện Chính

| Thành phần | Thông số | Ghi chú |
|---|---|---|
| **MCU** | ESP32-S3 N16R8 DevKitC | 16MB Flash, 8MB PSRAM, hỗ trợ TFLite Micro |
| **Cảm biến sinh học** | MAX30102 | I2C (SDA/SCL), 1.8V–3.3V, đo HR + SpO2 qua ánh sáng đỏ và hồng ngoại |
| **Màn hình** | OLED SSD1306 0.96" | I2C, 128×64 pixel, 3.3V |
| **Pin** | Li-Ion 18650 | 3.7V, dung lượng 2000–3500mAh |
| **Mạch sạc** | Module sạc 18650 (TP4056 hoặc tương đương) | Sạc qua USB-C/Micro-USB, ngắt khi đầy |
| **Nút bấm** | Nút reset/mode | Active LOW |

### 3.2 Sơ Đồ I2C Chia Sẻ Bus

MAX30102 và OLED SSD1306 chia sẻ cùng I2C bus:
- **MAX30102 địa chỉ:** `0x57`
- **SSD1306 địa chỉ:** `0x3C`

> **Quan trọng:** Hai địa chỉ khác nhau hoàn toàn — không xung đột.

### 3.3 Yêu Cầu Điện

| Tham số | Giá trị |
|---|---|
| Điện áp hoạt động ESP32-S3 | 3.3V (qua LDO trên DevKit) |
| Điện áp pin 18650 | 3.0V – 4.2V |
| Dòng tiêu thụ trung bình | ~150mA (WiFi + MAX30102 + OLED) |
| Thời lượng pin (2000mAh) | ~13 giờ liên tục |
| Sạc | Qua cổng USB trên mạch sạc 18650 |

---

## 4. Yêu Cầu Phần Mềm

### 4.1 Firmware (Arduino IDE)

**Thư viện cần dùng:**

| Thư viện | Nguồn | Mục đích |
|---|---|---|
| `MAX30105` (SparkFun) | Arduino Library Manager | Đọc dữ liệu MAX30102 |
| `heartRate.h` | Kèm theo SparkFun MAX30105 | Tính toán BPM |
| `spo2_algorithm.h` | Kèm theo SparkFun MAX30105 | Tính toán SpO2 |
| `Adafruit_SSD1306` | Arduino Library Manager | Điều khiển màn hình OLED |
| `Adafruit_GFX` | Arduino Library Manager | Vẽ đồ họa lên OLED |
| `WiFi.h` | Built-in ESP32 Arduino | Kết nối WiFi |
| `ESPAsyncWebServer` | Arduino Library Manager | Web server không đồng bộ |
| `AsyncTCP` | Arduino Library Manager | TCP không đồng bộ (cần cho ESPAsyncWebServer) |
| TFLite Micro (tùy chọn) | Edge Impulse export | Chạy model AI |

**Cài đặt thư viện:** Trong Arduino IDE → Tools → Manage Libraries → tìm và cài từng thư viện trên.

### 4.2 Web Dashboard

**Yêu cầu:**
- Giao diện web nhúng trong firmware (HTML + CSS + JavaScript)
- Cập nhật dữ liệu qua HTTP polling hoặc WebSocket
- Hiển thị HR, SpO2 dạng số lớn + biểu đồ đường thời gian thực
- Màu cảnh báo đổi khi chỉ số bất thường (đỏ/vàng/xanh)
- Responsive — dùng được trên điện thoại

**Truy cập:** Kết nối cùng WiFi → mở trình duyệt → nhập IP của ESP32-S3

### 4.3 Edge AI (Edge Impulse)

**Mục tiêu:** Phân loại trạng thái sức khỏe thành 3 nhãn:
- `Normal` — HR và SpO2 trong ngưỡng an toàn
- `Warning` — Một trong hai chỉ số tiến gần ngưỡng nguy hiểm
- `Danger` — Nguy hiểm, cần can thiệp ngay

**Inputs của model:**
- Heart Rate (BPM)
- SpO2 (%)
- (Tùy chọn) Nhiệt độ cơ thể nếu thêm cảm biến

---

## 5. Tính Năng Chức Năng

### 5.1 Đọc Cảm Biến

| Chức năng | Mô tả |
|---|---|
| Đo liên tục | MAX30102 lấy mẫu liên tục ở 100 mẫu/giây |
| Tính HR | Thuật toán detect đỉnh (peak detection) trong chuỗi hồng ngoại |
| Tính SpO2 | Tỉ lệ ánh sáng đỏ / hồng ngoại theo công thức Beer-Lambert |
| Trung bình hóa | Lấy trung bình 4 giây để ổn định kết quả |

### 5.2 Hiển Thị OLED

Layout màn hình (128×64 pixel):
```
+──────────────────────+
│  HR: 72 bpm          │
│  SpO2: 98 %          │
│  Status: NORMAL      │
│  IP: 192.168.1.105   │
+──────────────────────+
```

### 5.3 Web Dashboard

- **URL:** `http://<IP-cua-ESP32>/`
- **Dữ liệu API:** `http://<IP-cua-ESP32>/data` → JSON `{"hr": 72, "spo2": 98, "status": "NORMAL"}`
- **Cập nhật:** Mỗi 2 giây
- **Biểu đồ:** Chart.js — đường HR và SpO2 theo thời gian (hiện 60 điểm gần nhất)

### 5.4 Cảnh Báo

| Trạng thái | Điều kiện | Hành động |
|---|---|---|
| NORMAL | Trong ngưỡng bình thường | LED xanh, web màu xanh |
| WARNING | Tiến gần ngưỡng nguy hiểm | LED vàng nhấp nháy |
| DANGER | Vượt ngưỡng nguy hiểm | LED đỏ + âm thanh buzzer (nếu có) |

> **Ghi chú:** Ngưỡng cụ thể sẽ được tune sau khi có dataset và model hoàn chỉnh.

---

## 6. Yêu Cầu Phi Chức Năng

### 6.1 Hiệu Năng

| Yêu cầu | Mục tiêu |
|---|---|
| Thời gian khởi động | < 5 giây đến khi hiển thị dữ liệu |
| Độ trễ đọc cảm biến | < 100ms |
| Cập nhật Web | Mỗi 2 giây |
| Thời lượng pin | > 8 giờ sử dụng liên tục |

### 6.2 Độ Tin Cậy

- Tự động kết nối lại WiFi khi mất kết nối
- Watchdog timer tránh firmware bị treo
- Cảm biến MAX30102 cần che chắn ánh sáng môi trường

### 6.3 An Toàn

- Thiết bị chỉ dùng để tham khảo, **không thay thế thiết bị y tế chuyên nghiệp**
- Không lưu trữ dữ liệu cá nhân trên server bên ngoài
- Kết nối chỉ trong mạng nội bộ (local network)

---

## 7. Kiến Trúc Firmware

```
main.ino
├── setup()
│   ├── Khởi tạo Serial
│   ├── Khởi tạo I2C (SDA, SCL)
│   ├── Khởi tạo MAX30102
│   ├── Khởi tạo OLED SSD1306
│   ├── Kết nối WiFi
│   ├── Khởi tạo Web Server
│   └── Tải Edge Impulse model (nếu đã train xong)
│
└── loop()
    ├── Đọc dữ liệu MAX30102 (non-blocking)
    ├── Tính HR và SpO2 (mỗi 4 giây)
    ├── Chạy inference Edge Impulse → status
    ├── Cập nhật OLED
    ├── Xử lý HTTP requests (Web server)
    └── Cập nhật cảnh báo LED/buzzer
```

---

## 8. Kế Hoạch Thực Hiện

| Giai đoạn | Công việc | Trạng thái |
|---|---|---|
| **Giai đoạn 1** | Lắp ráp phần cứng, kiểm tra I2C, đọc raw data MAX30102 | Chờ thực hiện |
| **Giai đoạn 2** | Tính HR/SpO2, hiển thị OLED, kết nối WiFi | Chờ thực hiện |
| **Giai đoạn 3** | Xây dựng Web Dashboard nội bộ | Chờ thực hiện |
| **Giai đoạn 4** | Thu thập dataset, train Edge Impulse, deploy model | Chờ thực hiện |
| **Giai đoạn 5** | Tích hợp Edge AI + cảnh báo, test toàn hệ thống | Chờ thực hiện |

---

## 9. Rủi Ro & Giải Pháp

| Rủi ro | Mức độ | Giải pháp |
|---|---|---|
| MAX30102 nhạy ánh sáng môi trường | Cao | Bọc cảm biến bằng vật liệu tối màu, ép sát ngón tay |
| Tín hiệu nhiễu do chuyển động | Trung bình | Lọc trung bình động, yêu cầu người dùng giữ yên khi đo |
| Không đủ data label "Danger" để train | Cao | Dùng dataset Kaggle có sẵn + Anomaly Detection thay vì Classification |
| Độ chính xác SpO2 thấp | Trung bình | Hiệu chỉnh với thiết bị y tế chuẩn, dùng nhiều mẫu trung bình |
| Pin nhanh hết | Thấp | Deep sleep khi không dùng, tắt WiFi khi đo offline |

---

## 10. Định Nghĩa Hoàn Thành (Definition of Done)

- [ ] Đo được HR và SpO2 chính xác (so sánh với thiết bị chuẩn ±5%)
- [ ] OLED hiển thị HR, SpO2, Status cập nhật mỗi 4 giây
- [ ] Web Dashboard truy cập được qua WiFi, cập nhật tự động
- [ ] Edge Impulse model phân loại đúng ≥ 85% trên tập test
- [ ] Cảnh báo kích hoạt đúng khi phát hiện bất thường
- [ ] Hệ thống hoạt động liên tục ≥ 8 giờ trên pin 18650
