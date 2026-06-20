# Tài Liệu Yêu Cầu Sản Phẩm (PRD)
# Thiết Bị Đeo Tay Giám Sát Nhịp Tim & SpO₂ Tích Hợp Edge AI

---

| Thông tin | Chi tiết |
|---|---|
| **Tên đề tài** | Wearable Heart Rate & SpO₂ Monitor with Edge AI Classification |
| **Nhóm thực hiện** | IoT & Y sinh |
| **Phiên bản tài liệu** | v1.1 — Bản học thuật |
| **Ngày soạn thảo** | 2026-06-15 |
| **Giai đoạn phát triển** | EVT (Engineering Validation Test) → DVT (Design Validation Test) |

---

## 1. Bối Cảnh & Bài Toán (Problem Statement)

### 1.1 Phát Biểu Vấn Đề

Các bệnh lý tim mạch và hô hấp như đột quỵ (stroke), suy tim sung huyết (CHF — Congestive Heart Failure) và suy hô hấp cấp (ARF — Acute Respiratory Failure) diễn biến âm thầm trong nhiều giờ trước khi xảy ra biến cố cấp tính. Hai chỉ số sinh tồn quan trọng nhất để cảnh báo sớm là:

- **Heart Rate (HR)** — nhịp tim (đơn vị: bpm — beats per minute)
- **SpO₂** — độ bão hoà oxy trong máu ngoại vi (đơn vị: %)

Thiết bị đo oxy xung thương mại (pulse oximeter) hiện nay có các hạn chế:
1. **Chi phí cao**, không phổ biến đến hộ gia đình bình dân.
2. **Thiếu khả năng kết nối**, không truyền dữ liệu lên nền tảng giám sát từ xa.
3. **Không có trí tuệ nhân tạo** để tự phân loại nguy cơ và phát cảnh báo chủ động.

### 1.2 Giải Pháp Đề Xuất

Thiết kế một thiết bị đeo tay (wearable device) mã nguồn mở, giá thành thấp, tích hợp thuật toán **Edge AI (Trí Tuệ Nhân Tạo Biên)** để:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LUỒNG XỬ LÝ HỆ THỐNG                            │
│                                                                      │
│  MAX30102     →    ESP32-S3    →   TFLite Micro   →   Cảnh báo       │
│  (Cảm biến)       (MCU Edge)      (Phân loại AI)     (LED/Web/OLED)  │
│                                                                      │
│  Dữ liệu thô      Xử lý tín     Normal / Warning     Người dùng      │
│  (Red, IR)        hiệu, tính     / Danger label       được thông báo  │
│                   HR & SpO₂                                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Persona — Chân Dung Người Dùng (User Persona)

### 2.1 Persona Chính: Người Cao Tuổi Sống Độc Lập

| Thuộc tính | Mô tả |
|---|---|
| **Tên đại diện** | Ông Nguyễn Văn Minh |
| **Tuổi** | 68 tuổi |
| **Bệnh nền** | Tăng huyết áp độ II, tiền sử suy tim nhẹ |
| **Hoàn cảnh** | Sống một mình tại nhà, con cái làm việc xa |
| **Trình độ công nghệ** | Thấp — chỉ sử dụng điện thoại smartphone cơ bản |
| **Nhu cầu** | Theo dõi sức khỏe hàng ngày, không muốn ra ngoài khám thường xuyên |
| **Nỗi sợ hại (Pain Points)** | Đột quỵ mà không ai biết; thiết bị phức tạp khó sử dụng |
| **Mục tiêu** | Có thiết bị nhỏ gọn, tự động cảnh báo khi chỉ số bất thường |

### 2.2 Persona Phụ: Y Tá / Người Chăm Sóc Tại Nhà

| Thuộc tính | Mô tả |
|---|---|
| **Tên đại diện** | Chị Lê Thị Hoa |
| **Tuổi** | 34 tuổi |
| **Vai trò** | Y tá chăm sóc tại nhà, quản lý 4–6 bệnh nhân cùng lúc |
| **Thiết bị sử dụng** | Điện thoại Android, kết nối WiFi tại nhà bệnh nhân |
| **Nhu cầu** | Xem dashboard từ xa, nhận cảnh báo tức thì khi bệnh nhân bất thường |
| **Pain Points** | Không thể có mặt bên bệnh nhân 24/7; cần dữ liệu trực quan, không cần cài app |

---

## 3. Use Cases — Trường Hợp Sử Dụng

### 3.1 Sơ Đồ Use Case Tổng Quan

```
                     ┌─────────────────────────────────────┐
                     │         HỆ THỐNG GIÁM SÁT           │
                     │                                     │
  [Người dùng]  ─────┤── UC-01: Đeo thiết bị & đo tự động │
                     │                                     │
  [Người dùng]  ─────┤── UC-02: Xem màn hình OLED         │
                     │                                     │
  [Y tá/Thân nhân]──┤── UC-03: Xem Web Dashboard từ xa    │
                     │                                     │
  [Hệ thống]    ─────┤── UC-04: Phân loại AI tự động      │
                     │                                     │
  [Hệ thống]    ─────┤── UC-05: Kích hoạt cảnh báo        │
                     └─────────────────────────────────────┘
```

### 3.2 Chi Tiết Từng Use Case

#### UC-01: Đo Chỉ Số Sinh Tồn Tự Động (Core Feature)

| Trường | Nội dung |
|---|---|
| **ID** | UC-01 |
| **Tên** | Đo và tính HR & SpO₂ liên tục |
| **Tác nhân** | Người dùng (đeo thiết bị) |
| **Điều kiện đầu** | Thiết bị được cấp nguồn, ngón tay đặt đúng lên cảm biến MAX30102 |
| **Luồng chính** | 1. MAX30102 phát ánh sáng đỏ (660nm) và hồng ngoại (880nm) → 2. Đọc giá trị phản xạ Red/IR mỗi 10ms (100 SPS) → 3. ESP32-S3 tích luỹ 400 mẫu trong 4s → 4. Thuật toán peak-detection tính HR → 5. Tỉ lệ AC/DC của Red:IR → tính SpO₂ theo Beer-Lambert → 6. Cập nhật giá trị trung bình cuốn (rolling average) |
| **Luồng ngoại lệ** | Nếu ngón tay nhấc lên: giá trị trả về 0, hiển thị "Không phát hiện ngón tay" |
| **Điều kiện đầu ra** | Giá trị HR (bpm) và SpO₂ (%) hợp lệ được cập nhật trên OLED và RAM |

#### UC-03: Xem Web Dashboard Từ Xa

| Trường | Nội dung |
|---|---|
| **ID** | UC-03 |
| **Tên** | Truy cập giao diện web giám sát nội bộ |
| **Tác nhân** | Y tá / Người thân |
| **Điều kiện đầu** | Thiết bị và điện thoại kết nối cùng WiFi nội bộ |
| **Luồng chính** | 1. Người dùng mở trình duyệt → nhập IP của ESP32-S3 → 2. ESP32-S3 (ESPAsyncWebServer) phục vụ file `index.html` từ Flash (PROGMEM) → 3. JavaScript gọi `GET /data` mỗi 3s → 4. ESP32-S3 trả về JSON: `{"hr":72,"spo2":98.5,"status":"BÌNH THƯỜNG","normal":0.94,"warning":0.05,"danger":0.01,"anomaly":0.0023}` → 5. UI cập nhật card số liệu và màu cảnh báo |
| **Điều kiện đầu ra** | Giao diện hiển thị HR, SpO₂, nhãn AI, độ tin cậy (confidence), anomaly score |

---

## 4. Co-Design: Giao Thoa Phần Cứng & Phần Mềm

Một điểm nổi bật của đề tài là chiến lược **Hardware-Software Co-design**, trong đó các quyết định phần cứng và phần mềm ràng buộc lẫn nhau và phải được thiết kế đồng thời.

### 4.1 Ma Trận Co-Design

| Quyết định Phần cứng | Ảnh hưởng đến Phần mềm | Ràng buộc ngược lại |
|---|---|---|
| Dùng ESP32-S3 N16R8 (8MB PSRAM) | Cho phép load TFLite Micro model tối đa ~2MB vào RAM | Model phải tối ưu (quantization int8) để vừa PSRAM |
| MAX30102 tốc độ lấy mẫu 100 SPS | Thuật toán peak-detection cần bộ đệm circular buffer 400 phần tử | Buffer phải được khai báo tĩnh để tránh heap fragmentation |
| OLED SSD1306 và MAX30102 cùng I2C bus (GPIO 8/9) | Driver I2C cần quản lý mutex để tránh xung đột khi ghi đồng thời từ 2 task FreeRTOS | Tần suất cập nhật OLED bị giới hạn bởi tốc độ I2C (400 kHz Fast Mode) |
| Pin 18650 dung lượng 2000mAh | Vòng lặp chính phải non-blocking; không dùng `delay()` | WiFi AP phải ở chế độ STA (Station) thay vì AP để giảm công suất |
| Flash 16MB của N16R8 | HTML/CSS/JS web UI nhúng vào PROGMEM thay vì LittleFS | Kích thước tổng HTML + CSS + JS phải < 30KB để phù hợp |

### 4.2 Vòng Lặp Firmware (Non-Blocking Architecture)

Yêu cầu Co-design quan trọng nhất là thiết kế firmware **không chặn (non-blocking)** để ba luồng công việc chạy song song:

```
loop() — ~10ms period
├── [Task 1] Đọc MAX30102 vào circular buffer (mỗi 10ms)
├── [Task 2] Tính HR + SpO₂ khi đủ 400 mẫu (mỗi 4s)
│              └── Chạy TFLite inference → cập nhật label
├── [Task 3] Cập nhật OLED (mỗi 2s, không block I2C)
└── [Task 4] ESPAsyncWebServer xử lý HTTP request (interrupt-driven)
```

---

## 5. PRD Chi Tiết — Tính Năng Cốt Lõi: Phân Loại Trạng Thái Sức Khỏe Bằng Edge AI

### 5.1 Mô Tả Tính Năng (Feature Description)

**Tên tính năng:** Edge AI Health Status Classification  
**Mã tính năng:** FEAT-003  
**Mức độ ưu tiên:** P0 — Bắt buộc (Must-Have)

Hệ thống sử dụng mô hình học máy nhúng (on-device ML) chạy trực tiếp trên ESP32-S3 để phân loại trạng thái sức khỏe tức thì từ giá trị HR và SpO₂ đo được. Mô hình được huấn luyện trên Edge Impulse và xuất ra định dạng TFLite Micro (C++ library) để tích hợp vào firmware.

### 5.2 User Stories

| ID | User Story | Tiêu chí Hoàn thành (Acceptance Criteria) |
|---|---|---|
| US-01 | *Với tư cách* là **người dùng cao tuổi**, *tôi muốn* thiết bị tự động cảnh báo khi SpO₂ xuống thấp, *để* tôi có thể gọi cấp cứu kịp thời. | LED đỏ sáng + màn hình OLED hiển thị "⚠ NGUY HIỂM" trong vòng ≤5s sau khi SpO₂ < 90% |
| US-02 | *Với tư cách* là **y tá**, *tôi muốn* xem phần trăm độ tin cậy của từng nhãn AI trên Web Dashboard, *để* tôi đánh giá được mức độ rủi ro chính xác hơn. | Web Dashboard hiển thị 3 cột: Normal/Warning/Danger với giá trị % chính xác đến 1 chữ số thập phân |
| US-03 | *Với tư cách* là **nhà nghiên cứu**, *tôi muốn* truy cập endpoint `/data` để lấy dữ liệu JSON thô, *để* tôi có thể tích hợp vào hệ thống phân tích bên ngoài. | API `GET /data` trả về JSON hợp lệ với Content-Type `application/json` trong < 200ms |
| US-04 | *Với tư cách* là **hệ thống**, *tôi muốn* phát hiện anomaly ngay cả khi model chưa chắc chắn về nhãn nào, *để* giảm thiểu false negative trong tình huống nguy hiểm. | Anomaly score (K-means distance) hiển thị trên dashboard; ngưỡng cảnh báo > 0.5 |

### 5.3 Hạn Chế Thiết Kế (Design Constraints)

#### 5.3.1 Ràng Buộc Vật Lý

| Thông số | Giá trị mục tiêu | Lý do |
|---|---|---|
| Kích thước tổng thể | ≤ 80 × 55 × 25 mm | Vừa lòng bàn tay, đặt trên ngón tay thoải mái |
| Khối lượng (bao gồm pin) | ≤ 120g | Không gây mỏi tay khi đeo lâu |
| Vật liệu vỏ | Nhựa ABS/PLA in 3D | Chi phí thấp, dễ chế tạo prototype |

#### 5.3.2 Ràng Buộc Năng Lượng

| Thành phần | Công suất tiêu thụ (ước tính) | Chú thích |
|---|---|---|
| ESP32-S3 (WiFi hoạt động) | ~100 mA @ 3.3V | Chế độ modem-sleep giữa các lần polling |
| MAX30102 (đo tích cực) | ~10 mA @ 3.3V | LED Red + LED IR hoạt động |
| OLED SSD1306 | ~20 mA @ 3.3V | Sáng tối đa |
| **Tổng cộng (ước tính)** | **~130 mA @ 3.3V** | ≈ 430 mW |
| Pin 18650 (2000 mAh, 3.7V) | Dung lượng: 7.4 Wh | Thời lượng lý thuyết: **~17 giờ** |
| **Mục tiêu thực tế** | **≥ 8 giờ** | Có tính hệ số hiệu suất mạch ~70% |

#### 5.3.3 Ràng Buộc Giao Tiếp & Kết Nối

| Chuẩn | Vai trò | Thông số |
|---|---|---|
| I2C (GPIO 8/9) | Giao tiếp với MAX30102 & SSD1306 | Tốc độ 400 kHz (Fast Mode); địa chỉ 7-bit |
| WiFi 802.11b/g/n (2.4 GHz) | Web Server & API JSON | Chế độ STA; băng thông yêu cầu < 10 Kbps |
| USB-C / Micro-USB | Nạp firmware & sạc pin | Tốc độ nạp UART: 921600 baud |

#### 5.3.4 Ràng Buộc Phần Mềm & AI

| Ràng buộc | Giá trị | Lý do kỹ thuật |
|---|---|---|
| Kích thước model TFLite | ≤ 50 KB | Nằm gọn trong Flash, không cần PSRAM |
| Thời gian inference | ≤ 100 ms | Không gây trễ cho vòng lặp chính |
| Lượng tử hoá (Quantization) | INT8 | Tương thích TFLite Micro trên ESP32-S3 |
| Tập dữ liệu huấn luyện | 12,000 mẫu (4K/class) | Đảm bảo cân bằng class, không overfitting |
| Độ chính xác tập kiểm thử | ≥ 85% overall accuracy | Theo yêu cầu Definition of Done của dự án |

### 5.4 Thông Số Kỹ Thuật Cần Đạt (Technical Specifications)

#### 5.4.1 Thông Số Cảm Biến & Đo Lường

| Thông số | Giá trị mục tiêu | Phương pháp xác minh |
|---|---|---|
| Dải đo Heart Rate | 20 – 180 bpm | So sánh với máy đo chuẩn (ECG Holter) |
| Dải đo SpO₂ | 70% – 100% | So sánh với máy đo finger oximeter y tế chuẩn |
| Độ chính xác HR | ± 5 bpm | Đo 10 lần trên 5 đối tượng khác nhau |
| Độ chính xác SpO₂ | ± 2% | Theo tiêu chuẩn ISO 80601-2-61 |
| Tốc độ lấy mẫu | 100 SPS (samples per second) | Đọc từ register FIFO của MAX30102 |
| Thời gian ổn định kết quả | ≤ 10 giây sau khi đặt ngón tay | Tính từ lúc hàm detect_finger() trả về true |

#### 5.4.2 Thông Số Hệ Thống & Hiệu Năng

| Thông số | Giá trị mục tiêu |
|---|---|
| Thời gian khởi động hệ thống | < 5 giây đến khi hiển thị dữ liệu đầu tiên |
| Độ trễ cảnh báo DANGER | < 10 giây kể từ khi phát hiện ngưỡng nguy hiểm |
| Tần suất cập nhật Web API | Mỗi 3 giây |
| Tần suất cập nhật OLED | Mỗi 2 giây |
| Uptime liên tục tối thiểu | ≥ 8 giờ trên pin 18650 đầy |
| Thời gian phục hồi kết nối WiFi | ≤ 30 giây sau khi mất kết nối |

#### 5.4.3 Thông Số AI Model (Edge Impulse)

| Thông số | Giá trị mục tiêu |
|---|---|
| Kiến trúc model | Dense Neural Network (2 lớp ẩn) |
| Input features | 2 (HR, SpO₂) |
| Output classes | 3 (Normal, Warning, Danger) |
| Tập huấn luyện | 12,000 mẫu (theo chuẩn WHO) |
| Tỉ lệ train/test | 80% / 20% |
| Độ chính xác mục tiêu | ≥ 85% |
| Phương pháp phát hiện bất thường | K-means Anomaly Detection (n_cluster=4) |
| Flash footprint | ≤ 50 KB |
| RAM footprint khi inference | ≤ 4 KB |

---

## 6. Lộ Trình Phát Triển (EVT → DVT → PVT)

```
GĐ 1 — EVT (Engineering Validation Test)
├── Lắp ráp phần cứng trên breadboard
├── Xác minh I2C bus: đọc địa chỉ 0x57 (MAX30102) và 0x3C (OLED)
├── Đọc raw data Red/IR từ MAX30102 và in Serial
└── Chạy I2C scanner để xác nhận không xung đột địa chỉ

GĐ 2 — EVT (tiếp theo)
├── Tích hợp thuật toán tính HR (peak-detection)
├── Tích hợp thuật toán tính SpO₂ (Beer-Lambert ratio)
├── Hiển thị HR + SpO₂ lên OLED SSD1306
└── Kết nối WiFi + bật Web Server, xác minh API /data

GĐ 3 — DVT (Design Validation Test)
├── Huấn luyện model Edge Impulse trên 12,000 mẫu
├── Export TFLite library → tích hợp vào Firmware
├── Xác minh accuracy ≥ 85% trên tập test
└── Kiểm thử end-to-end: đặt ngón tay → 10s → nhãn AI trên Web

GĐ 4 — DVT (hoàn thiện)
├── Kiểm thử tuổi thọ pin 8+ giờ liên tục
├── Kiểm thử Watchdog Timer (giả lập firmware bị treo)
├── So sánh độ chính xác HR/SpO₂ với thiết bị y tế chuẩn
└── Review bảo mật: xác nhận không có data leak qua WiFi

GĐ 5 — PVT (Production Validation Test) [Tương lai]
├── Thiết kế PCB tích hợp (thay breadboard)
├── In vỏ 3D bảo vệ thiết bị
└── Đóng gói và kiểm thử toàn hệ thống lần cuối
```

---

## 7. Định Nghĩa Hoàn Thành (Definition of Done)

Tính năng **Phân loại Edge AI** được coi là hoàn thành khi tất cả các điều kiện sau được xác minh:

- [ ] Model TFLite Micro được load thành công vào firmware, không lỗi khởi tạo
- [ ] Inference chạy trong ≤ 100ms trên ESP32-S3 N16R8
- [ ] Kết quả phân loại Normal/Warning/Danger hiển thị đúng trên OLED và Web Dashboard
- [ ] Độ chính xác ≥ 85% đo trên tập test (20% của 12,000 mẫu)
- [ ] Khi SpO₂ < 90%: nhãn "NGUY HIỂM" xuất hiện trong ≤ 10s
- [ ] Anomaly score hiển thị đúng dạng số thực 4 chữ số thập phân trên Web
- [ ] Hệ thống hoạt động liên tục ≥ 8 giờ không crash

---

## 8. Tài Liệu Tham Khảo

1. **SparkFun MAX30105 Library** — https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library  
2. **Edge Impulse Documentation** — https://docs.edgeimpulse.com/docs/edge-impulse-studio/deployment/arduino-library  
3. **TFLite Micro on ESP32-S3** — https://www.tensorflow.org/lite/microcontrollers  
4. **WHO SpO₂ Clinical Thresholds** — WHO Pulse Oximetry Training Manual (2011)  
5. **ISO 80601-2-61:2017** — Medical electrical equipment — Pulse oximeter equipment  
6. **ESPAsyncWebServer** — https://github.com/ESP-BoosterPack/ESPAsyncWebServer  
7. **Kaggle Dataset: Human Vital Signs 2024** — https://www.kaggle.com/datasets/  
8. **DFRobot AI Oximeter Guide (ESP32-S3 + Edge Impulse)** — https://community.dfrobot.com/makelog-315026.html

---

*Tài liệu này được soạn thảo theo chuẩn PRD học thuật phục vụ mục đích báo cáo chuyên đề IoT & Y sinh. Các thông số kỹ thuật sẽ được hiệu chỉnh sau giai đoạn EVT dựa trên kết quả đo thực tế.*
