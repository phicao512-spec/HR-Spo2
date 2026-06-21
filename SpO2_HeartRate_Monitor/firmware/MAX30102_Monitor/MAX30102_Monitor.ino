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
#include <math.h>               // fabsf, fmaxf (EMA BPF algorithm)

// ═══════════════════════════════════════════════════════════════
//  THONG SO THUAT TOAN EMA BPF
//  Port tu: manhzzzz/stm32f-max30102-rtos/Core/Src/main.c
//  FS_HZ dieu chinh 50->100 de khop SR=100Hz cau hinh sensor
// ═══════════════════════════════════════════════════════════════
#define FS_HZ           100.0f   // Toc do mau thuat toan (khop SR=100Hz)
#define ALPHA_DC        0.01f    // EMA DC (~1s)
#define ALPHA_FAST      0.25f    // EMA nhanh (~5Hz)
#define ALPHA_SLOW      0.02f    // EMA cham (~0.5Hz)
#define ALPHA_ENV       0.10f    // EMA envelope |AC|
#define ALPHA_HR_EMA    0.20f    // Lam muot HR
#define ALPHA_SPO2_EMA  0.15f    // Lam muot SpO2
#define REFRACTORY_SEC  0.35f    // 350ms chong dem trung
#define MIN_THR_ABS     8.0f     // Nguong phat hien peak toi thieu
#define THR_K_ENV       0.5f     // Nguong thich nghi = K * envelope
#define HR_AVG_BEATS    6        // So chu ky lay trung binh HR
// ═══════════════════════════════════════════════════════════════
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
#define WIFI_SSID      "H09"
#define WIFI_PASSWORD  "hoilamgi"

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

// Heart Rate & SpO2 — EMA BPF (sample-by-sample, khong can buffer)
int   beatAvg   = 0;   // HR hien thi (bpm), cap nhat lien tuc

// Shared state
float  g_heart_rate    = 0.0f;
float  g_spo2          = 0.0f;
bool   g_finger_on     = false;

float  g_plot_sig      = 0.0f;
float  g_plot_env      = 1.0f;

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
//  THUAT TOAN EMA BPF — tinh HR va SpO2 theo tung mau
//  Port tu: manhzzzz/stm32f-max30102-rtos/Core/Src/main.c
//  Uu diem: ket qua ngay sau ~2-3s, tu thich nghi bien do tin hieu
// ═══════════════════════════════════════════════════════════════
void max30102_cal(uint32_t red_raw, uint32_t ir_raw) {
    // Khong co ngon tay — reset ket qua
    if (ir_raw < 50000) { g_heart_rate = 0.0f; g_spo2 = 0.0f; beatAvg = 0; return; }

    static float ir_dc=0,   red_dc=0;
    static float ir_fast=0, ir_slow=0,  red_fast=0, red_slow=0;
    static float ir_bpf=0,  red_bpf=0;
    static float ir_env=1,  red_env=1;
    static float prev2=0,   prev1=0;
    static uint16_t ref_count = 0;
    static uint16_t ibi_buf[HR_AVG_BEATS] = {0};
    static uint8_t  ibi_len = 0;
    static uint16_t samples_since_peak = 0;
    static float hr_ema   = 0.0f;
    static float spo2_ema = 0.0f;

    // --- Loc DC (EMA low-pass) ---
    ir_dc  += ALPHA_DC * ((float)ir_raw  - ir_dc);
    red_dc += ALPHA_DC * ((float)red_raw - red_dc);

    // --- Band-pass filter: BPF = EMA_fast - EMA_slow ---
    ir_fast  += ALPHA_FAST * ((float)ir_raw  - ir_fast);
    ir_slow  += ALPHA_SLOW * ((float)ir_raw  - ir_slow);
    ir_bpf    = ir_fast - ir_slow;

    red_fast += ALPHA_FAST * ((float)red_raw - red_fast);
    red_slow += ALPHA_SLOW * ((float)red_raw - red_slow);
    red_bpf   = red_fast - red_slow;

    // --- Envelope (bien do AC, dung cho nguong thich nghi) ---
    ir_env  += ALPHA_ENV * (fabsf(ir_bpf)  - ir_env);
    red_env += ALPHA_ENV * (fabsf(red_bpf) - red_env);

    // --- Peak detection (phat hien dinh song nhip tim) ---
    if (ref_count > 0) ref_count--;
    samples_since_peak++;

    float thr = fmaxf(MIN_THR_ABS, THR_K_ENV * ir_env);
    if ((prev2 < prev1) && (prev1 > ir_bpf) && (prev1 >= thr) && (ref_count == 0)) {
        ref_count = (uint16_t)(FS_HZ * REFRACTORY_SEC);  // chong dem trung
        uint16_t ibi = samples_since_peak;               // khoang cach giua 2 dinh
        samples_since_peak = 0;

        // Cap nhat ring buffer IBI (inter-beat interval)
        if (ibi_len < HR_AVG_BEATS) ibi_buf[ibi_len++] = ibi;
        else {
            for (int i = HR_AVG_BEATS-1; i > 0; --i) ibi_buf[i] = ibi_buf[i-1];
            ibi_buf[0] = ibi;
        }

        // Tinh HR tu IBI trung binh (can >= 2 diem)
        if (ibi_len >= 2) {
            uint32_t sum = 0;
            for (int i = 0; i < ibi_len; ++i) sum += ibi_buf[i];
            float ibi_avg = (float)sum / (float)ibi_len;
            float hr_inst = 60.0f * (FS_HZ / ibi_avg);
            if (hr_ema <= 1.0f) hr_ema = hr_inst;
            else hr_ema += ALPHA_HR_EMA * (hr_inst - hr_ema);
            if (hr_ema < 30.0f)  hr_ema = 30.0f;
            if (hr_ema > 220.0f) hr_ema = 220.0f;
            beatAvg      = (int)(hr_ema + 0.5f);
            g_heart_rate = hr_ema;
        }
    }
    prev2 = prev1; prev1 = ir_bpf;

    // --- Tinh SpO2: R = (AC_red/DC_red) / (AC_ir/DC_ir), SpO2 = 110 - 25*R ---
    float rdc = fmaxf(1.0f, red_dc),  idc = fmaxf(1.0f, ir_dc);
    float rac  = fmaxf(1.0f, red_env), iac = fmaxf(1.0f, ir_env);
    float R    = (rac / rdc) / (iac / idc);
    float spo2_inst = 110.0f - 25.0f * R;

    if (spo2_ema <= 1.0f) spo2_ema = spo2_inst;
    else spo2_ema += ALPHA_SPO2_EMA * (spo2_inst - spo2_ema);
    if (spo2_ema < 70.0f)  spo2_ema = 70.0f;
    if (spo2_ema > 100.0f) spo2_ema = 100.0f;
    g_spo2 = spo2_ema;

    g_plot_sig = ir_bpf;
    g_plot_env = ir_env;
}

// ═══════════════════════════════════════════════════════════════
//  OLED
// ═══════════════════════════════════════════════════════════════
#define UI_HEADER_H   40
#define WAVE_Y0       UI_HEADER_H
#define WAVE_H        (64 - UI_HEADER_H)

#define COL_W   42
#define COL0_X  2
#define COL1_X  (COL0_X + COL_W)
#define COL2_X  (COL1_X + COL_W)
#define WAVEFORM_WIDTH 128

uint8_t waveform_buffer[WAVEFORM_WIDTH] = {0};
uint8_t waveform_x = 0;

void updateOLED() {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);

    char buf[16];

    // --- HR ---
    display.setCursor(COL0_X, 0);
    display.print("HR");
    snprintf(buf, sizeof(buf), "%3d", g_finger_on ? beatAvg : 0);
    display.setCursor(COL0_X, 12);
    display.print(buf);

    // --- SpO2 ---
    display.setCursor(COL1_X, 0);
    display.print("SpO2");
    snprintf(buf, sizeof(buf), "%2d%%", g_finger_on ? (int)g_spo2 : 0);
    display.setCursor(COL1_X, 12);
    display.print(buf);

    // --- STATUS ---
    display.setCursor(COL2_X, 0);
    display.print("Stt");
    display.setCursor(COL2_X, 12);
    if      (g_status.indexOf("BINH") >= 0) display.print("NORM");
    else if (g_status.indexOf("CANH") >= 0) display.print("WARN");
    else if (g_status.indexOf("NGUY") >= 0) display.print("DANG");
    else                                    display.print("WAIT");

    // --- WEB IP ---
    display.setCursor(2, 30);
    display.print("IP: ");
    display.print(wifiConnected ? WiFi.localIP().toString() : "Offline");

    // --- Waveform ---
    if (g_finger_on) {
        float scale = (g_plot_env > 1.0f) ? (3.0f * g_plot_env) : 1000.0f;
        float norm  = g_plot_sig / scale; 
        if (norm > 1.0f) norm = 1.0f; 
        if (norm < -1.0f) norm = -1.0f;

        uint8_t y0 = WAVE_Y0, yh = WAVE_H, mid = y0 + (yh/2);
        uint8_t y = (uint8_t)( mid - norm*((yh/2)-1) );
        if (y < y0) y = y0;
        if (y > (y0+yh-1)) y = y0+yh-1;
        waveform_buffer[waveform_x] = y;
    } else {
        waveform_buffer[waveform_x] = WAVE_Y0 + WAVE_H/2;
    }

    uint8_t y0 = WAVE_Y0, yh = WAVE_H;
    for (int x = 0; x < 128; x += 8) { display.drawPixel(x, y0, SSD1306_WHITE); display.drawPixel(x, y0+yh-1, SSD1306_WHITE); }
    for (int yy = y0; yy <= y0+yh-1; yy += 4) { display.drawPixel(0, yy, SSD1306_WHITE); display.drawPixel(127, yy, SSD1306_WHITE); }

    for (int i=1; i<WAVEFORM_WIDTH; i++) {
        int x1=i-1, y1=waveform_buffer[(waveform_x+i-1)%WAVEFORM_WIDTH];
        int x2=i,   y2=waveform_buffer[(waveform_x+i)%WAVEFORM_WIDTH];
        display.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
    }
    
    waveform_x = (waveform_x + 1) % WAVEFORM_WIDTH;
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

    Serial.println("[System] San sang! Dat ngon tay len cam bien.\n");
}

// ═══════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════
void loop() {
    // --- Doc IR+RED tu FIFO theo tung mau (poll) ---
    max30102_read_fifo(&particleSensor);
    long irValue  = (long)particleSensor._ir_samples[0];
    long redValue = (long)particleSensor._red_samples[0];

    // Kiem tra ngon tay (IR > 50000 = co ngon tay)
    g_finger_on = (irValue > 50000);

    if (g_finger_on) {
        // Thuat toan EMA BPF — cap nhat theo tung mau, ket qua ngay sau ~2-3s
        // g_heart_rate va g_spo2 duoc ghi truc tiep trong max30102_cal()
        max30102_cal((uint32_t)redValue, (uint32_t)irValue);
        beatAvg = (int)g_heart_rate;

        // Chay AI inference moi 5 giay (sau khi co du lieu on dinh)
        static unsigned long lastInferenceTime = 0;
        if (millis() - lastInferenceTime >= 5000 && g_heart_rate > 0 && g_spo2 > 0) {
            lastInferenceTime = millis();
            runInference(g_heart_rate, g_spo2);
        }
    } else {
        // Khong co ngon tay — reset trang thai
        beatAvg      = 0;
        g_heart_rate = 0.0f;
        g_spo2       = 0.0f;
        g_status     = "DAT NGON TAY";
    }

    // OLED cap nhat moi 200ms
    if (millis() - lastOledTime >= 200) {
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
