/*
 * ============================================================
 *  Giam Sat Nhip Tim & SpO2 — Edge AI + Custom MAX30102 Driver
 * ============================================================
 *  Hardware : ESP32-S3 N16R8 | MAX30102 | SSD1306 OLED
 *  I2C      : SDA=GPIO8, SCL=GPIO9
 *
 *  Thu vien can cai (Arduino Library Manager):
 *    1. MAX30102_inferencing  -> Add .ZIP
 *    2. SparkFun MAX3010x Pulse and Proximity Sensor Library
 *       (chi dung heartRate.h + spo2_algorithm.h, KHONG dung MAX30105.h)
 *    3. Adafruit SSD1306
 *    4. Adafruit GFX Library
 *
 *  Driver sensor: Custom HAL-style driver (port tu STM32 HAL)
 *    - File goc: max30102_for_stm32_hal.c/.h
 *    - I2C layer: Wire.h
 * ============================================================
 */

// Edge Impulse
#include <MAX30102_inferencing.h>

// Hardware
#include <Wire.h>

// ═══════════════════════════════════════════════════════════════
//  MAX30102 DRIVER (port tu STM32 HAL, dung Wire.h)
//  Nguon goc: max30102_for_stm32_hal.c/.h
// ═══════════════════════════════════════════════════════════════
#define MAX30102_I2C_ADDR        0x57
#define MAX30102_SAMPLE_LEN_MAX  32

// Register map (tu max30102_for_stm32_hal.h)
#define MAX30102_FIFO_WR_PTR     0x04
#define MAX30102_OVF_COUNTER     0x05
#define MAX30102_FIFO_RD_PTR     0x06
#define MAX30102_FIFO_DATA       0x07
#define MAX30102_FIFO_CONFIG     0x08
#define MAX30102_MODE_CONFIG     0x09
#define MAX30102_SPO2_CONFIG     0x0A
#define MAX30102_LED_IR_PA1      0x0C
#define MAX30102_LED_RED_PA2     0x0D
#define MAX30102_PART_ID         0xFF

struct max30102_t {
    TwoWire *_wire;
    uint32_t _ir_samples[MAX30102_SAMPLE_LEN_MAX];
    uint32_t _red_samples[MAX30102_SAMPLE_LEN_MAX];
};

// I2C write — thay the HAL_I2C_Master_Transmit
void max30102_write(max30102_t *obj, uint8_t reg, uint8_t *buf, uint16_t len) {
    obj->_wire->beginTransmission(MAX30102_I2C_ADDR);
    obj->_wire->write(reg);
    for (uint16_t i = 0; i < len; i++) obj->_wire->write(buf[i]);
    obj->_wire->endTransmission(true);
}

// I2C read — thay the HAL_I2C_Master_Receive
void max30102_read(max30102_t *obj, uint8_t reg, uint8_t *buf, uint16_t len) {
    obj->_wire->beginTransmission(MAX30102_I2C_ADDR);
    obj->_wire->write(reg);
    obj->_wire->endTransmission(false);
    obj->_wire->requestFrom((uint8_t)MAX30102_I2C_ADDR, (uint8_t)len);
    for (uint16_t i = 0; i < len; i++) buf[i] = obj->_wire->read();
}

void max30102_init(max30102_t *obj, TwoWire *wire) {
    obj->_wire = wire;
    memset(obj->_ir_samples,  0, sizeof(obj->_ir_samples));
    memset(obj->_red_samples, 0, sizeof(obj->_red_samples));
}

// Config helpers — port 1-1 tu max30102_for_stm32_hal.c
void max30102_set_mode(max30102_t *obj, uint8_t mode) {
    uint8_t cfg; max30102_read(obj, MAX30102_MODE_CONFIG, &cfg, 1);
    cfg = (cfg & 0xF8) | mode;
    max30102_write(obj, MAX30102_MODE_CONFIG, &cfg, 1);
}
void max30102_set_sampling_rate(max30102_t *obj, uint8_t sr) {
    uint8_t cfg; max30102_read(obj, MAX30102_SPO2_CONFIG, &cfg, 1);
    cfg = (cfg & 0x63) | (uint8_t)(sr << 2);
    max30102_write(obj, MAX30102_SPO2_CONFIG, &cfg, 1);
}
void max30102_set_led_pulse_width(max30102_t *obj, uint8_t pw) {
    uint8_t cfg; max30102_read(obj, MAX30102_SPO2_CONFIG, &cfg, 1);
    cfg = (cfg & 0x7C) | pw;
    max30102_write(obj, MAX30102_SPO2_CONFIG, &cfg, 1);
}
void max30102_set_adc_resolution(max30102_t *obj, uint8_t adc) {
    uint8_t cfg; max30102_read(obj, MAX30102_SPO2_CONFIG, &cfg, 1);
    cfg = (cfg & 0x1F) | (uint8_t)(adc << 5);
    max30102_write(obj, MAX30102_SPO2_CONFIG, &cfg, 1);
}
void max30102_set_led_current_1(max30102_t *obj, float ma) {
    uint8_t pa = (uint8_t)(ma / 0.2f);
    max30102_write(obj, MAX30102_LED_IR_PA1, &pa, 1);
}
void max30102_set_led_current_2(max30102_t *obj, float ma) {
    uint8_t pa = (uint8_t)(ma / 0.2f);
    max30102_write(obj, MAX30102_LED_RED_PA2, &pa, 1);
}
void max30102_set_fifo_config(max30102_t *obj, uint8_t smp_ave, uint8_t roll_over, uint8_t a_full) {
    uint8_t cfg = (uint8_t)((smp_ave << 5) | ((roll_over & 1) << 4) | (a_full & 0x0F));
    max30102_write(obj, MAX30102_FIFO_CONFIG, &cfg, 1);
}
void max30102_clear_fifo(max30102_t *obj) {
    uint8_t z = 0;
    max30102_write(obj, MAX30102_FIFO_WR_PTR, &z, 1);
    max30102_write(obj, MAX30102_FIFO_RD_PTR, &z, 1);
    max30102_write(obj, MAX30102_OVF_COUNTER,  &z, 1);
}

// Doc 1 mau IR+RED moi nhat tu FIFO (dung cho loop polling)
// MAX30102 SpO2 mode: SLOT1 = RED (byte 0-2), SLOT2 = IR (byte 3-5)
bool max30102_read_fifo(max30102_t *obj) {
    uint8_t wr_ptr = 0, rd_ptr = 0;
    max30102_read(obj, MAX30102_FIFO_WR_PTR, &wr_ptr, 1);
    max30102_read(obj, MAX30102_FIFO_RD_PTR, &rd_ptr, 1);
    int8_t num = (int8_t)wr_ptr - (int8_t)rd_ptr;
    if (num < 1) num += 32;
    if (num < 1) return false;
    uint8_t s[6];
    max30102_read(obj, MAX30102_FIFO_DATA, s, 6);
    // SLOT1=RED (s[0..2]), SLOT2=IR (s[3..5]) — theo datasheet MAX30102
    obj->_red_samples[0] = ((uint32_t)s[0] << 16 | (uint32_t)s[1] << 8 | s[2]) & 0x3FFFF;
    obj->_ir_samples[0]  = ((uint32_t)s[3] << 16 | (uint32_t)s[4] << 8 | s[5]) & 0x3FFFF;
    return true;
}

// Doc toi da max_samples mau vao buffer ngoai (dung cho SpO2 100 mau)
// MAX30102 SpO2 mode: SLOT1 = RED (byte 0-2), SLOT2 = IR (byte 3-5)
uint8_t max30102_read_fifo_bulk(max30102_t *obj, uint32_t *ir_buf, uint32_t *red_buf, uint8_t max_samples) {
    uint8_t wr_ptr = 0, rd_ptr = 0;
    max30102_read(obj, MAX30102_FIFO_WR_PTR, &wr_ptr, 1);
    max30102_read(obj, MAX30102_FIFO_RD_PTR, &rd_ptr, 1);
    int8_t num = (int8_t)wr_ptr - (int8_t)rd_ptr;
    if (num < 1) num += 32;
    if (num > (int8_t)max_samples) num = (int8_t)max_samples;
    if (num < 1) return 0;
    for (int8_t i = 0; i < num; i++) {
        uint8_t s[6];
        max30102_read(obj, MAX30102_FIFO_DATA, s, 6);
        // SLOT1=RED (s[0..2]), SLOT2=IR (s[3..5]) — theo datasheet MAX30102
        red_buf[i] = ((uint32_t)s[0] << 16 | (uint32_t)s[1] << 8 | s[2]) & 0x3FFFF;
        ir_buf[i]  = ((uint32_t)s[3] << 16 | (uint32_t)s[4] << 8 | s[5]) & 0x3FFFF;
    }
    return (uint8_t)num;
}
// ═══════════════════════════════════════════════════════════════
#include "heartRate.h"          // SparkFun beat detection
#include "spo2_algorithm.h"     // SparkFun SpO2
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// WiFi & Web
#include <WiFi.h>
#include <WebServer.h>

// HTML Dashboard
#include "web_ui.h"

// ═══════════════════════════════════════════════════════════════
//  CAU HINH
// ═══════════════════════════════════════════════════════════════
#define WIFI_SSID      "TEN_WIFI"
#define WIFI_PASSWORD  "MAT_KHAU"

#define I2C_SDA   8
#define I2C_SCL   9

#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT   64
#define OLED_ADDR     0x3C

#define ANOMALY_THRESHOLD    0.3f

// ═══════════════════════════════════════════════════════════════
//  BIEN TOAN CUC
// ═══════════════════════════════════════════════════════════════
max30102_t        particleSensor;
Adafruit_SSD1306  display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WebServer         server(80);

// Heart Rate — SparkFun checkForBeat
const byte RATE_SIZE = 8;
byte  rates[RATE_SIZE];
byte  rateSpot  = 0;
long  lastBeat  = 0;
float beatsPerMinute = 0;
int   beatAvg   = 0;

// SpO2 — buffer-based
#define SPO2_BUFFER_LEN 100
uint32_t irBuffer[SPO2_BUFFER_LEN];
uint32_t redBuffer[SPO2_BUFFER_LEN];
int32_t  spo2_value     = 0;
int8_t   spo2_valid     = 0;
int32_t  hr_spo2_value  = 0;
int8_t   hr_spo2_valid  = 0;
unsigned long lastSpo2Time = 0;
#define SPO2_INTERVAL_MS 10000  // tinh SpO2 moi 10 giay

// Shared state
float  g_heart_rate    = 0.0f;
float  g_spo2          = 0.0f;
bool   g_finger_on     = false;

String g_status        = "KHOI DONG";
float  g_anomaly_score = 0.0f;
float  g_conf_normal   = 0.0f;
float  g_conf_warning  = 0.0f;
float  g_conf_danger   = 0.0f;

unsigned long lastOledTime = 0;
bool wifiConnected = false;

// ═══════════════════════════════════════════════════════════════
//  EDGE IMPULSE
// ═══════════════════════════════════════════════════════════════
static float ei_features[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];

int raw_feature_get_data(size_t offset, size_t length, float *out) {
    memcpy(out, ei_features + offset, length * sizeof(float));
    return 0;
}

void runInference(float hr, float spo2) {
    ei_features[0] = hr;
    ei_features[1] = spo2;

    signal_t signal;
    signal.total_length = EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE;
    signal.get_data     = &raw_feature_get_data;

    ei_impulse_result_t result = {0};
    if (run_classifier(&signal, &result, false) != EI_IMPULSE_OK) return;

    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        String lbl = String(result.classification[ix].label);
        float  val = result.classification[ix].value;
        if (lbl == "Danger")  g_conf_danger  = val;
        if (lbl == "Normal")  g_conf_normal  = val;
        if (lbl == "Warning") g_conf_warning = val;
    }

#if EI_CLASSIFIER_HAS_ANOMALY == EI_ANOMALY_TYPE_KMEANS
    g_anomaly_score = result.anomaly;
#endif

    if      (g_anomaly_score > ANOMALY_THRESHOLD) g_status = "NGHI NGO BAT THUONG";
    else if (g_conf_danger  >= 0.6f)              g_status = "NGUY HIEM";
    else if (g_conf_warning >= 0.5f)              g_status = "CANH BAO";
    else                                           g_status = "BINH THUONG";

    Serial.printf("[AI] %s | N=%.2f W=%.2f D=%.2f A=%.3f\n",
        g_status.c_str(), g_conf_normal, g_conf_warning, g_conf_danger, g_anomaly_score);
}

// ═══════════════════════════════════════════════════════════════
//  SpO2 — thu thap buffer va tinh
// ═══════════════════════════════════════════════════════════════
void collectAndComputeSpO2() {
    Serial.println("[SpO2] Thu thap 100 mau...");

    // Thu thap SPO2_BUFFER_LEN mau bang cach poll FIFO truc tiep
    // Timeout: toi da 15 giay de tranh treo vo han
    int collected = 0;
    unsigned long t0 = millis();
    while (collected < SPO2_BUFFER_LEN) {
        if (millis() - t0 > 15000) {
            Serial.printf("[SpO2] TIMEOUT! Chi thu thap duoc %d/%d mau\n", collected, SPO2_BUFFER_LEN);
            break;
        }
        uint8_t got = max30102_read_fifo_bulk(
            &particleSensor,
            irBuffer  + collected,
            redBuffer + collected,
            (uint8_t)(SPO2_BUFFER_LEN - collected)
        );
        if (got > 0) collected += got;
        else delay(10); // cho FIFO co du lieu
    }
    if (collected < SPO2_BUFFER_LEN) {
        Serial.println("[SpO2] Khong du mau, bo qua lan nay.");
        return;
    }

    // Tinh SpO2 va HR tu buffer
    maxim_heart_rate_and_oxygen_saturation(
        irBuffer, SPO2_BUFFER_LEN, redBuffer,
        &spo2_value, &spo2_valid,
        &hr_spo2_value, &hr_spo2_valid
    );

    if (spo2_valid && spo2_value > 0 && spo2_value <= 100) {
        g_spo2 = (float)spo2_value;
    }

    Serial.printf("[SpO2] SpO2=%d (v=%d) HR=%d (v=%d)\n",
        spo2_value, spo2_valid, hr_spo2_value, hr_spo2_valid);
}

// ═══════════════════════════════════════════════════════════════
//  OLED
// ═══════════════════════════════════════════════════════════════
void updateOLED() {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);

    display.setTextSize(1); display.setCursor(0, 0);  display.print("HR:");
    display.setTextSize(2); display.setCursor(22, 0);
    if (g_finger_on && beatAvg > 0) display.printf("%3d bpm", beatAvg);
    else display.print("--- bpm");

    display.setTextSize(1); display.setCursor(0, 18); display.print("SpO2:");
    display.setTextSize(2); display.setCursor(36, 18);
    if (g_finger_on && g_spo2 > 0) display.printf("%4.1f%%", g_spo2);
    else display.print("--.-%");

    display.drawLine(0, 36, 128, 36, SSD1306_WHITE);
    display.setTextSize(1); display.setCursor(0, 40);

    if      (g_status.indexOf("BINH")  >= 0) display.print("> NORMAL");
    else if (g_status.indexOf("CANH")  >= 0) display.print("> WARNING !");
    else if (g_status.indexOf("NGUY")  >= 0) display.print("> DANGER !!");
    else if (g_status.indexOf("NGHI")  >= 0) display.print("> ANOMALY ??");
    else                                      display.print("> DAT NGON TAY");

    display.setCursor(0, 54);
    display.print(wifiConnected ? WiFi.localIP().toString() : "WiFi...");
    display.display();
}

// ═══════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n[Monitor] Khoi dong...");

    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);

    // OLED
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        Serial.println("[OLED] Khong tim thay!");
    } else {
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(0, 0);  display.println("SpO2+HR Monitor");
        display.setCursor(0, 10); display.println("Custom HAL Driver");
        display.setCursor(0, 20); display.println("Khoi dong...");
        display.display();
        Serial.println("[OLED] OK");
    }

    // MAX30102 — Custom HAL Driver (port tu STM32)
    max30102_init(&particleSensor, &Wire);

    // Kiem tra ket noi qua Part ID register (0xFF phai tra ve 0x15)
    uint8_t part_id = 0;
    max30102_read(&particleSensor, MAX30102_PART_ID, &part_id, 1);
    if (part_id != 0x15) {
        Serial.printf("[MAX30102] Khong tim thay! Part ID = 0x%02X (can 0x15)\n", part_id);
        display.setCursor(0, 40); display.println("MAX30102 ERROR!");
        display.display();
        while (1) delay(500);
    }
    Serial.println("[MAX30102] OK — Custom HAL Driver");

    // Cau hinh sensor (dong bo voi driver STM32 HAL):
    //   Mode    : SpO2 (0x03)
    //   FIFO    : smp_ave=4, roll_over=on, a_full=15
    //   SR      : 100 Hz
    //   PW      : 18-bit / 411us
    //   ADC     : 4096 nA
    //   LED     : IR=6.4mA, Red=6.4mA
    max30102_set_mode(&particleSensor, 0x03);            // SpO2 mode
    max30102_set_fifo_config(&particleSensor, 2, 1, 15); // smp_ave=4, roll_over=on
    max30102_set_sampling_rate(&particleSensor, 1);      // 100 Hz
    max30102_set_led_pulse_width(&particleSensor, 3);    // 18-bit
    max30102_set_adc_resolution(&particleSensor, 1);     // 4096 nA
    max30102_set_led_current_1(&particleSensor, 6.4f);   // IR  LED = 6.4 mA
    max30102_set_led_current_2(&particleSensor, 6.4f);   // Red LED = 6.4 mA
    max30102_clear_fifo(&particleSensor);

    // WiFi
    Serial.printf("[WiFi] Ket noi '%s'...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempt = 0;
    while (WiFi.status() != WL_CONNECTED && attempt < 20) {
        delay(500); Serial.print("."); attempt++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.printf("\n[WiFi] http://%s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] Offline.");
    }

    // Web Server
    if (wifiConnected) {
        server.on("/", HTTP_GET, []() {
            server.send_P(200, "text/html", INDEX_HTML);
        });

        server.on("/data", HTTP_GET, []() {
            String json = "{";
            json += "\"hr\":"       + String(g_heart_rate, 1)   + ",";
            json += "\"spo2\":"     + String(g_spo2, 2)          + ",";
            json += "\"status\":\"" + g_status                   + "\",";
            json += "\"normal\":"   + String(g_conf_normal, 4)   + ",";
            json += "\"warning\":"  + String(g_conf_warning, 4)  + ",";
            json += "\"danger\":"   + String(g_conf_danger, 4)   + ",";
            json += "\"anomaly\":"  + String(g_anomaly_score, 4);
            json += "}";
            server.send(200, "application/json", json);
        });

        server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
        server.begin();
    }

    lastSpo2Time = millis();
    Serial.println("[System] San sang! Dat ngon tay len cam bien.\n");
}

// ═══════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════
void loop() {
    // --- Doc IR de phat hien nhip tim realtime (poll FIFO) ---
    max30102_read_fifo(&particleSensor);
    long irValue = (long)particleSensor._ir_samples[0];

    // Kiem tra ngon tay (IR > 50000 = co ngon tay)
    g_finger_on = (irValue > 50000);

    if (g_finger_on) {
        // SparkFun checkForBeat — phat hien nhip tim
        if (checkForBeat(irValue)) {
            long delta = millis() - lastBeat;
            lastBeat = millis();

            beatsPerMinute = 60.0f / (delta / 1000.0f);

            // Chi chap nhan 30-220 bpm
            if (beatsPerMinute > 30 && beatsPerMinute < 220) {
                rates[rateSpot++ % RATE_SIZE] = (byte)beatsPerMinute;

                // Tinh trung binh
                beatAvg = 0;
                for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
                beatAvg /= RATE_SIZE;

                g_heart_rate = (float)beatAvg;
            }
        }

        // SpO2: thu thap moi 10 giay
        if (millis() - lastSpo2Time >= SPO2_INTERVAL_MS) {
            lastSpo2Time = millis();
            collectAndComputeSpO2();

            // Chay AI inference sau khi co du lieu
            if (g_heart_rate > 0 && g_spo2 > 0) {
                runInference(g_heart_rate, g_spo2);
            }
        }
    } else {
        // Khong co ngon tay
        beatAvg      = 0;
        g_heart_rate = 0;
        g_spo2       = 0;
        g_status     = "DAT NGON TAY";
        rateSpot     = 0;
        memset(rates, 0, sizeof(rates));
    }

    // OLED cap nhat moi 1 giay
    if (millis() - lastOledTime >= 1000) {
        lastOledTime = millis();
        updateOLED();

        if (g_finger_on) {
            Serial.printf("[Sensor] HR=%d bpm | SpO2=%.1f%% | IR=%ld\n",
                beatAvg, g_spo2, irValue);
        }
    }

    // Web server
    if (wifiConnected) server.handleClient();

    // WiFi reconnect
    if (wifiConnected && WiFi.status() != WL_CONNECTED) {
        wifiConnected = false; WiFi.reconnect();
    } else if (!wifiConnected && WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
    }
}

// Edge Impulse logger
void ei_printf(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vprintf(format, args);
    va_end(args);
}
