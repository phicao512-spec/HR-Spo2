# Thiết bị đeo giám sát nhịp tim và SpO2

**Nhóm chuyên đề:** IoT & Y sinh

## 1. Mục tiêu (Yêu cầu tối thiểu - 2 tuần)
- Lập hồ sơ PRD (Product Requirements Document)
- Thiết kế sơ đồ nguyên lý sử dụng cảm biến y sinh (MAX30102 hoặc MAX30100)

## 2. Các bước thực hiện

### Bước 1: Viết PRD
- Mô tả bài toán, đối tượng người dùng, tính năng chính
- Yêu cầu phần cứng: MCU, cảm biến, pin, giao tiếp (WiFi/BLE)
- Yêu cầu phần mềm: app hiển thị, ngưỡng cảnh báo

### Bước 2: Chọn MCU công suất thấp
- Đề xuất: **ESP32-C3** hoặc **ESP32-S3** (đủ mạnh để chạy Edge AI, hỗ trợ BLE tiết kiệm pin)
- Cảm biến: **MAX30102** (đo HR + SpO2 qua I2C)

### Bước 3: Layout PCB nguyên mẫu EVT
- Sơ đồ nguyên lý: MCU + MAX30102 (I2C) + pin Li-Po + mạch sạc + (tùy chọn) OLED hiển thị

## 3. Phân loại năng lực

### Cơ bản (CB): Hiển thị dữ liệu lên App
- Đọc dữ liệu HR/SpO2 từ MAX30102
- Gửi qua WiFi hoặc BLE tới app điện thoại
- Hiển thị real-time

**Project tham khảo (open-source):**
- [Wifi Oximeter MAX30102 + ESP32](https://github.com/Probots-Electronics/Wifi-Oximiter-using-MAX30102-and-ESP32) — gửi BPM & SpO2 qua WiFi tới mobile app
- [ESP32_MAX30102 (nferrante93)](https://github.com/nferrante93/ESP32_MAX30102) — đọc real-time HR/SpO2, code CC0/Public Domain
- [esp32-max30102-nimBLE-PLX](https://github.com/JoshDumo/esp32-max30102-nimBLE-PLX) — gửi dữ liệu qua BLE (Pulse Oximetry Service), tiết kiệm pin hơn WiFi
- [Health Check Device (capitalfuse)](https://github.com/capitalfuse/capitalfuse-esp32_max30102_mlx90614_oled_hcd) — mở rộng thêm cảm biến nhiệt độ (MLX90614) + OLED

**Lưu ý kỹ thuật khi dùng MAX30102:**
- Cảm biến nhạy với ánh sáng môi trường → cần che chắn kín
- Cần gắn cố định với áp lực ổn định lên ngón tay (vd dùng dây cao su), không bóp/giữ tay vào cảm biến

### Nâng cao (NC): Tích hợp Edge AI cảnh báo đột quỵ

**Hướng triển khai với Edge Impulse:**
1. Thu thập / tìm dataset HR, SpO2, nhiệt độ + nhãn trạng thái (Status)
   - Tham khảo: bộ "Health Data" trên Kaggle (cột SpO2, Heart Rate, Body Temperature, Status)
2. Import vào Edge Impulse:
   - Data Acquisition → CSV Wizard
   - "Is this time series data?" = No
   - Chọn cột "Status" làm Label
   - Tick "Automatic split between training and testing" (80-20)
3. Train model phân loại (Classification) hoặc Anomaly Detection (nếu không đủ data label "nguy hiểm")
4. Deploy model dưới dạng Arduino library / C++ SDK cho ESP32-S3
5. Tích hợp inference vào firmware: đọc HR/SpO2 → đưa vào model → cảnh báo nếu phát hiện bất thường (vd SpO2 < 90%, nhịp tim quá thấp/cao đột ngột)

**Project tham khảo:**
- [AI Oximeter ESP32-S3 + Edge Impulse (DFRobot)](https://community.dfrobot.com/makelog-315026.html) — quy trình đầy đủ từ dataset Kaggle → train Edge Impulse → deploy ESP32-S3

## 4. Tổng kết lựa chọn phần cứng đề xuất
| Thành phần | Đề xuất |
|---|---|
| MCU | ESP32-S3 (đủ RAM/CPU cho TFLite Micro, có BLE) |
| Cảm biến | MAX30102 (I2C) |
| Hiển thị | OLED SSD1306 (tùy chọn) |
| Kết nối | BLE (tiết kiệm pin) hoặc WiFi (đơn giản hơn) |
| Pin | Li-Po + mạch sạc TP4056 |

## 5. Việc cần làm tiếp
- [ ] Tìm/lọc dataset cụ thể trên Kaggle phù hợp cảnh báo đột quỵ
- [ ] Xác định ngưỡng cảnh báo y khoa (SpO2, HR) dựa trên tài liệu y tế
- [ ] Thiết kế sơ đồ nguyên lý chi tiết (KiCad/EasyEDA)
- [ ] Viết PRD chính thức
