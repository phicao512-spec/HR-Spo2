/**
 * gen_prd_v2.js
 * PRD academic document — Times New Roman 13pt, prose-first, minimal tables
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, Header, Footer, PageNumber, PageBreak
} = require('docx');
const fs = require('fs');

// ── Constants ─────────────────────────────────────────────────────────
const FONT  = "Times New Roman";
const SZ    = 26;   // 13pt  = 26 half-points
const SZ_H1 = 32;   // 16pt
const SZ_H2 = 28;   // 14pt
const SZ_H3 = 26;   // 13pt bold-italic (same size as body)

const PAGE_W    = 11906;            // A4
const PAGE_H    = 16838;
const MARGIN_TB = 1440;             // 2.54 cm top/bottom (1 inch)
const MARGIN_LR = 1701;             // 3.0 cm left/right
const CONTENT_W = PAGE_W - MARGIN_LR * 2; // ≈ 8504 DXA

// ── Paragraph helpers ─────────────────────────────────────────────────

/** Multi-run paragraph builder */
function para(runs, opts = {}) {
  const {
    align      = AlignmentType.JUSTIFIED,
    before     = 100,
    after      = 100,
    line       = 340,           // ~1.5 line spacing
    indent     = 0,
    firstLine  = 0,
  } = opts;
  const children = runs.map(r =>
    new TextRun({ font: FONT, size: SZ, ...r })
  );
  return new Paragraph({
    alignment: align,
    spacing: { before, after, line },
    indent: indent || firstLine
      ? { left: indent, firstLine }
      : undefined,
    children,
  });
}

/** Plain prose paragraph */
function prose(text, opts = {}) {
  return para([{ text }], { firstLine: 720, ...opts }); // 0.5" indent first line
}

/** Bold-inline helper */
function boldText(t) { return { text: t, bold: true }; }

/** Italic-inline helper */
function italicText(t) { return { text: t, italic: true }; }

/** Heading 1 */
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ_H1, bold: true, color: "1F3864" })],
  });
}

/** Heading 2 */
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ_H2, bold: true, color: "2E5496" })],
  });
}

/** Heading 3 */
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ_H3, bold: true, italic: true, color: "404040" })],
  });
}

/** Divider rule */
function rule() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E5496", space: 1 } },
    children: [],
  });
}

/** Bullet paragraph (no unicode) */
function bull(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ })],
  });
}

/** Numbered paragraph */
function num(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 60, after: 60, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ })],
  });
}

/** Checkbox list item (square bullet) */
function chk(text) {
  return new Paragraph({
    numbering: { reference: "checklist", level: 0 },
    spacing: { before: 60, after: 60, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ })],
  });
}

/** Empty spacer line */
function gap() {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun("")] });
}

/** Figure caption */
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 140 },
    children: [new TextRun({ text, font: FONT, size: SZ, italic: true, color: "555555" })],
  });
}

// ── Table helpers ─────────────────────────────────────────────────────

const BD = { style: BorderStyle.SINGLE, size: 1, color: "B0C4DE" };
const BORDERS = { top: BD, bottom: BD, left: BD, right: BD };

function cell(text, isHdr, w, even) {
  const fill = isHdr ? "2E5496" : (even ? "EEF3FC" : "F9FBFF");
  return new TableCell({
    borders: BORDERS,
    width: { size: w, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    shading: { fill, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, font: FONT, size: SZ, bold: isHdr, color: isHdr ? "FFFFFF" : "000000" })],
    })],
  });
}

/** Compact spec table: [[col1, col2, ...], ...rows] */
function specTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, true, colWidths[i], false)),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((v, ci) => cell(v, false, colWidths[ci], ri % 2 === 0)),
        })
      ),
    ],
  });
}

// ── INFO BOX (cover table) ────────────────────────────────────────────

function infoBox(pairs) {
  const w1 = 3200, w2 = 5304;
  return new Table({
    width: { size: w1 + w2, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: pairs.map(([k, v], i) =>
      new TableRow({
        children: [
          cell(k, false, w1, i % 2 === 0),
          cell(v, false, w2, i % 2 === 0),
        ],
      })
    ),
  });
}

// ── DOCUMENT ──────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ],
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ],
      },
      {
        reference: "checklist",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u25A1",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: FONT, size: SZ } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ_H1, bold: true, font: FONT, color: "1F3864" },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ_H2, bold: true, font: FONT, color: "2E5496" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ_H3, bold: true, italic: true, font: FONT, color: "404040" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },

  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN_TB, right: MARGIN_LR, bottom: MARGIN_TB, left: MARGIN_LR },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "2E5496", space: 1 } },
          spacing: { after: 100 },
          children: [new TextRun({ text: "Tài liệu PRD \u2014 Thiết Bị Đeo Giám Sát HR & SpO\u2082 với Edge AI", font: FONT, size: 20, italic: true, color: "666666" })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "2E5496", space: 1 } },
          spacing: { before: 80 },
          children: [
            new TextRun({ text: "Trang ", font: FONT, size: 20, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20, color: "888888" }),
            new TextRun({ text: "  \u2014  Nhóm IoT & Y sinh \u2014 2026", font: FONT, size: 20, color: "888888" }),
          ],
        })],
      }),
    },

    children: [

      // ════════════════════════════════════════════════════════════
      // TRANG BÌA
      // ════════════════════════════════════════════════════════════
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 240 },
        children: [
          new TextRun({ text: "TÀI LIỆU YÊU CẦU SẢN PHẨM", font: FONT, size: 52, bold: true, color: "1F3864" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({ text: "(Product Requirements Document — PRD)", font: FONT, size: 28, italic: true, color: "2E5496" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [
          new TextRun({ text: "Thiết Bị Đeo Tay Giám Sát Nhịp Tim & SpO\u2082\nTích Hợp Trí Tuệ Nhân Tạo Biên (Edge AI)", font: FONT, size: 36, bold: true, color: "2E5496" }),
        ],
      }),
      rule(),
      gap(),
      infoBox([
        ["Nhóm thực hiện",   "IoT & Y sinh"],
        ["Phiên bản",        "v2.0 — Bản học thuật chính thức"],
        ["Ngày soạn",        "15 tháng 06 năm 2026"],
        ["Giai đoạn",        "EVT (Engineering Validation Test) → DVT (Design Validation Test)"],
        ["Tính năng PRD",    "FEAT-003 — Edge AI Health Status Classification"],
        ["MCU",              "ESP32-S3 N16R8 DevKitC — 16 MB Flash, 8 MB PSRAM"],
        ["Cảm biến",         "MAX30102 (HR + SpO\u2082, giao tiếp I2C)"],
        ["Khuôn khổ AI",     "Edge Impulse + TFLite Micro (INT8 Quantization)"],
      ]),
      gap(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════
      // 1. TỔNG QUAN ĐỀ TÀI
      // ════════════════════════════════════════════════════════════
      h1("1. Tổng Quan Đề Tài"),
      rule(),
      prose("Đề tài này thuộc nhóm chuyên đề IoT & Y sinh, với mục tiêu thiết kế và chế tạo một thiết bị đeo tay (wearable device) chi phí thấp, mã nguồn mở, có khả năng đo và phân tích hai chỉ số sinh tồn quan trọng là nhịp tim (Heart Rate — HR, đơn vị bpm) và nồng độ oxy trong máu ngoại vi (SpO₂, đơn vị %) một cách liên tục và tức thời."),
      prose("Điểm khác biệt cốt lõi so với các thiết bị đo oxy xung (pulse oximeter) thương mại thông thường là tích hợp thuật toán Trí Tuệ Nhân Tạo Biên (Edge AI), cụ thể là mô hình học sâu nhẹ (lightweight deep learning) được huấn luyện trên nền tảng Edge Impulse và triển khai dưới dạng thư viện TFLite Micro trên vi điều khiển ESP32-S3 N16R8 DevKitC. Mô hình này tự phân loại trạng thái sức khỏe người dùng thành ba nhãn: Normal (Bình thường), Warning (Cảnh báo) và Danger (Nguy hiểm) — hoàn toàn không cần kết nối internet hay máy chủ đám mây bên ngoài."),
      prose("Hệ thống hiển thị kết quả theo hai kênh song song: màn hình OLED SSD1306 (0.96\") gắn trực tiếp trên thiết bị, và một Web Dashboard nội bộ truy cập qua WiFi trong cùng mạng LAN, phù hợp để người thân hoặc y tá theo dõi từ xa qua điện thoại."),
      gap(),

      // ════════════════════════════════════════════════════════════
      // 2. TÍNH NĂNG ĐƯỢC CHỌN
      // ════════════════════════════════════════════════════════════
      h1("2. Tính Năng Được Chọn: Phân Loại Trạng Thái Sức Khỏe Bằng Edge AI (FEAT-003)"),
      rule(),
      prose("Trong tổng thể hệ thống, tính năng FEAT-003 — Edge AI Health Status Classification được chọn làm trọng tâm của tài liệu PRD này vì đây là tính năng phân biệt thiết bị so với các sản phẩm tương tự trên thị trường và cũng là tính năng có độ phức tạp kỹ thuật cao nhất, đòi hỏi sự phối hợp chặt chẽ giữa phần cứng và phần mềm (Hardware-Software Co-design)."),
      prose("Về mặt kỹ thuật, tính năng này nhận đầu vào là cặp giá trị (HR, SpO₂) đã được tính toán từ dữ liệu thô của cảm biến MAX30102, sau đó đưa qua mô hình Dense Neural Network được lượng tử hóa INT8 (8-bit integer quantization) để giảm thiểu bộ nhớ và thời gian suy luận (inference). Đầu ra là ba xác suất tương ứng với ba trạng thái sức khỏe, cùng với điểm bất thường (anomaly score) từ thuật toán K-means Anomaly Detection, giúp phát hiện các trường hợp chỉ số bất thường ngay cả khi mô hình phân loại chưa hoàn toàn chắc chắn. Toàn bộ quá trình này chạy trong thời gian thực trên ESP32-S3, không cần kết nối đám mây."),
      gap(),

      // ════════════════════════════════════════════════════════════
      // 3. PERSONA & USE CASES
      // ════════════════════════════════════════════════════════════
      h1("3. Persona & Use Cases"),
      rule(),

      h2("3.1 Persona — Chân Dung Người Dùng"),
      prose("Nhóm xác định hai persona chính có liên quan trực tiếp đến tính năng phân loại AI:"),
      gap(),

      h3("Persona 1: Người cao tuổi sống độc lập (Primary User)"),
      prose("Ông Nguyễn Văn Minh, 68 tuổi, sống một mình, có tiền sử tăng huyết áp độ II và suy tim nhẹ. Ông chỉ sử dụng smartphone ở mức cơ bản và không có kiến thức chuyên sâu về y tế. Ông đeo thiết bị thường xuyên tại nhà và mong muốn được cảnh báo tự động khi các chỉ số sinh tồn đi vào vùng nguy hiểm, thay vì phải tự đọc và đánh giá số liệu. Pain point lớn nhất của Ông Minh là nỗi lo bị đột quỵ mà không có ai ứng cứu kịp thời."),
      gap(),

      h3("Persona 2: Y tá chăm sóc tại nhà (Secondary User)"),
      prose("Chị Lê Thị Hoa, 34 tuổi, chăm sóc đồng thời 4 đến 6 bệnh nhân tại nhà. Chị sử dụng điện thoại Android và kết nối cùng WiFi nội bộ của bệnh nhân. Chị cần giám sát từ xa không qua ứng dụng cần cài đặt, tiếp nhận cảnh báo tức thì và xem được độ tin cậy của từng nhãn phân loại AI để đưa ra quyết định can thiệp. Pain point chính là không thể có mặt cạnh mỗi bệnh nhân 24/7 và cần thông tin được hiển thị trực quan, dễ đọc."),
      gap(),

      h2("3.2 Use Cases — Trường Hợp Sử Dụng"),
      prose("Tính năng FEAT-003 liên quan trực tiếp đến bốn use case sau:"),
      gap(),

      h3("UC-01: Phân loại trạng thái sức khỏe tự động"),
      prose("Mỗi khoảng 4 giây, sau khi ESP32-S3 tích lũy đủ 400 mẫu tín hiệu quang học từ MAX30102, firmware tính toán giá trị HR và SpO₂, sau đó đưa vào mô hình TFLite Micro để suy luận. Kết quả ba xác suất (Normal, Warning, Danger) và anomaly score được lưu vào bộ nhớ RAM và cập nhật lên cả OLED lẫn endpoint API, hoàn toàn không chặn (non-blocking) các luồng xử lý khác."),
      gap(),

      h3("UC-02: Kích hoạt cảnh báo khi phát hiện Danger"),
      prose("Khi nhãn phân loại là Danger (SpO₂ dưới 90% hoặc HR ngoài dải 50–180 bpm), hệ thống phải kích hoạt cảnh báo trong vòng tối đa 10 giây kể từ thời điểm phát hiện. Trên OLED, trạng thái hiển thị chuyển sang \"NGUY HIỂM\" với màu đỏ; trên Web Dashboard, nền của hộp trạng thái đổi sang màu đỏ bán trong suốt; LED cảnh báo vật lý (nếu tích hợp) nhấp nháy đỏ."),
      gap(),

      h3("UC-03: Xem confidence score và anomaly trên Web Dashboard"),
      prose("Y tá Chị Hoa mở trình duyệt trên điện thoại Android, nhập địa chỉ IP của ESP32-S3 trong cùng mạng WiFi, và xem giao diện Web Dashboard cập nhật mỗi 3 giây. Dashboard hiển thị ba chỉ số phần trăm độ tin cậy (Normal %, Warning %, Danger %) và anomaly score dạng số thực bốn chữ số thập phân. API endpoint GET /data trả về dữ liệu JSON đầy đủ trong dưới 200ms."),
      gap(),

      h3("UC-04: Phát hiện bất thường bằng K-means Anomaly Detection"),
      prose("Ngay cả khi mô hình phân loại không chắc chắn (ví dụ xác suất Normal là 45% và Warning là 40%), thuật toán K-means Anomaly Detection vẫn tính khoảng cách từ điểm dữ liệu hiện tại đến centroid gần nhất. Nếu khoảng cách này vượt ngưỡng 0.5, hệ thống coi đây là bất thường và tô màu cam cho chỉ số anomaly score trên dashboard, nhắc nhở y tá xem xét kỹ hơn."),
      gap(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════
      // 4. HẠN CHẾ THIẾT KẾ
      // ════════════════════════════════════════════════════════════
      h1("4. Hạn Chế Thiết Kế (Design Constraints)"),
      rule(),

      h2("4.1 Ràng Buộc Vật Lý & Cơ Khí"),
      prose("Thiết bị được thiết kế dưới dạng kẹp ngón tay (finger clip) cầm tay, với kích thước tổng thể không vượt quá 80 × 55 × 25 mm và khối lượng toàn bộ (bao gồm pin 18650) không quá 120 gram, đảm bảo người dùng có thể cầm hoặc đặt ngón tay lên trong thời gian đo mà không cảm thấy mỏi. Vỏ ngoài của prototype giai đoạn EVT/DVT được in 3D bằng nhựa ABS hoặc PLA, đủ bền cho môi trường sử dụng tại nhà và dễ dàng sửa đổi thiết kế khi cần điều chỉnh bố cục linh kiện."),
      gap(),

      h2("4.2 Ràng Buộc Năng Lượng"),
      prose("Toàn bộ hệ thống hoạt động ở điện áp 3.3 V cung cấp từ LDO tích hợp trên board ESP32-S3 DevKitC. Công suất tiêu thụ ước tính khoảng 430 mW (ESP32-S3 với WiFi: ~100 mA, MAX30102 ở chế độ đo tích cực: ~10 mA, OLED SSD1306: ~20 mA). Nguồn cung cấp từ pin Li-Ion 18650 dung lượng 2000 mAh qua module sạc TP4056 có tích hợp bảo vệ quá áp, quá dòng và ngắn mạch. Với hệ số hiệu suất mạch thực tế khoảng 70%, thời lượng hoạt động liên tục đạt mục tiêu tối thiểu 8 giờ — đây cũng là tiêu chí trong Definition of Done của dự án. Để tối ưu pin, ESP32-S3 sử dụng chế độ modem-sleep giữa các chu kỳ polling và firmware được viết theo kiến trúc non-blocking, không sử dụng hàm delay() gây lãng phí CPU."),
      gap(),

      h2("4.3 Ràng Buộc Giao Tiếp & Kết Nối"),
      prose("Cảm biến MAX30102 và màn hình OLED SSD1306 chia sẻ cùng một I2C bus trên chân GPIO 8 (SDA) và GPIO 9 (SCL) của ESP32-S3, hoạt động ở tốc độ Fast Mode 400 kHz. Hai thiết bị sử dụng địa chỉ I2C khác nhau hoàn toàn (MAX30102: 0x57, SSD1306: 0x3C), không gây xung đột. Trong firmware, một mutex được dùng để đồng bộ hóa giữa các tác vụ FreeRTOS khi cùng truy cập bus I2C, tránh tranh chấp dữ liệu. Giao tiếp WiFi sử dụng chuẩn 802.11b/g/n dải tần 2.4 GHz, ESP32-S3 chạy ở chế độ Station (STA), kết nối với router nội bộ và phục vụ Web Dashboard qua thư viện ESPAsyncWebServer không đồng bộ. Băng thông cần thiết rất nhỏ (dưới 10 Kbps) nên không yêu cầu đường truyền cao cấp."),
      gap(),

      h2("4.4 Ràng Buộc Phần Mềm & AI"),
      prose("Mô hình TFLite Micro sau khi lượng tử hóa INT8 phải có dung lượng Flash không vượt quá 50 KB để tránh ảnh hưởng đến không gian lưu trữ firmware và trang HTML/CSS/JavaScript nhúng trong PROGMEM. Thời gian suy luận của mô hình trên ESP32-S3 phải dưới 100 ms, đảm bảo không gây độ trễ đáng kể cho vòng lặp chính. Tập dữ liệu huấn luyện gồm 12.000 mẫu (4.000 mẫu mỗi class: Normal, Warning, Danger), trong đó dữ liệu Normal được trích xuất từ bộ dữ liệu Kaggle Human Vital Signs 2024, còn Warning và Danger được sinh tổng hợp (synthetic data) theo ngưỡng lâm sàng của Tổ chức Y tế Thế giới (WHO). Độ chính xác tối thiểu trên tập kiểm thử (20% của 12.000 mẫu) phải đạt 85%."),
      gap(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════
      // 5. THÔNG SỐ KỸ THUẬT
      // ════════════════════════════════════════════════════════════
      h1("5. Thông Số Kỹ Thuật Cần Đạt (Technical Specifications)"),
      rule(),
      prose("Dưới đây là bảng tổng hợp các thông số kỹ thuật định lượng cần đạt được, được phân nhóm theo ba lĩnh vực: đo lường sinh tồn, hiệu năng hệ thống và mô hình AI. Các giá trị này được xác định dựa trên tài liệu kỹ thuật của nhà sản xuất, tiêu chuẩn y tế quốc tế ISO 80601-2-61 và khuyến nghị lâm sàng của WHO."),
      gap(),

      specTable(
        ["Nhóm", "Thông số", "Giá trị mục tiêu"],
        [
          ["Đo lường",    "Dải đo Heart Rate",                     "20 – 180 bpm"],
          ["Đo lường",    "Dải đo SpO₂",                           "70 % – 100 %"],
          ["Đo lường",    "Độ chính xác HR",                       "± 5 bpm"],
          ["Đo lường",    "Độ chính xác SpO₂",                     "± 2 %  (ISO 80601-2-61)"],
          ["Đo lường",    "Tốc độ lấy mẫu MAX30102",               "100 SPS (samples/s)"],
          ["Đo lường",    "Thời gian ổn định sau khi đặt ngón tay","≤ 10 giây"],
          ["Hệ thống",    "Thời gian khởi động đến dữ liệu đầu tiên","< 5 giây"],
          ["Hệ thống",    "Độ trễ cảnh báo DANGER",                "< 10 giây"],
          ["Hệ thống",    "Tần suất cập nhật OLED",                "Mỗi 2 giây"],
          ["Hệ thống",    "Tần suất cập nhật Web API (/data)",     "Mỗi 3 giây"],
          ["Hệ thống",    "Thời gian phản hồi API",                "< 200 ms"],
          ["Hệ thống",    "Uptime pin liên tục",                   "≥ 8 giờ"],
          ["AI Model",    "Kiến trúc",                             "Dense NN — 2 lớp ẩn, kích hoạt ReLU"],
          ["AI Model",    "Input / Output",                        "2 features / 3 classes"],
          ["AI Model",    "Lượng tử hóa",                         "INT8 (8-bit)"],
          ["AI Model",    "Dung lượng Flash",                      "≤ 50 KB"],
          ["AI Model",    "RAM khi inference",                     "≤ 4 KB"],
          ["AI Model",    "Thời gian inference",                   "≤ 100 ms trên ESP32-S3"],
          ["AI Model",    "Độ chính xác tập test",                 "≥ 85 % overall accuracy"],
          ["AI Model",    "Anomaly method",                        "K-means (n_clusters = 4)"],
        ],
        [2000, 4000, 2504]
      ),
      gap(),

      // ════════════════════════════════════════════════════════════
      // 6. CO-DESIGN
      // ════════════════════════════════════════════════════════════
      h1("6. Giao Thoa Phần Cứng & Phần Mềm (Hardware-Software Co-design)"),
      rule(),
      prose("Tính năng FEAT-003 là ví dụ điển hình của thiết kế đồng thời (Co-design), trong đó mỗi quyết định phần cứng ràng buộc trực tiếp một hoặc nhiều quyết định phần mềm và ngược lại. Tư duy Co-design được áp dụng xuyên suốt từ giai đoạn EVT."),
      prose("Về vi điều khiển, việc chọn ESP32-S3 N16R8 với 8 MB PSRAM (Pseudo-Static RAM) là điều kiện tiên quyết để load được mô hình TFLite Micro lên đến 2 MB vào RAM trong runtime; ngược lại, phần mềm phải tối ưu mô hình bằng INT8 quantization để đảm bảo toàn bộ inference graph vừa trong giới hạn bộ nhớ cho phép mà không cần dùng PSRAM — ưu tiên Flash tốc độ nhanh hơn."),
      prose("Về tốc độ lấy mẫu cảm biến, MAX30102 được cấu hình ở 100 SPS buộc firmware phải duy trì một circular buffer tĩnh 400 phần tử (khoảng 1600 byte) để tích lũy đủ 4 giây dữ liệu trước khi tính HR/SpO₂. Kích thước buffer này phải được khai báo tĩnh trong BSS segment thay vì cấp phát động trên heap, tránh phân mảnh bộ nhớ trong các session chạy dài."),
      prose("Về chia sẻ I2C bus, quyết định phần cứng cho MAX30102 và OLED SSD1306 dùng chung GPIO 8/9 giảm chi phí dây và chân GPIO, nhưng phần mềm phải dùng FreeRTOS mutex để đảm bảo tác vụ cập nhật OLED (mỗi 2 giây) và tác vụ đọc cảm biến (mỗi 10 ms) không tranh chấp bus. Điều này cũng giới hạn tần suất làm mới OLED vì mỗi lần vẽ màn hình chiếm bus I2C trong khoảng 5–8 ms."),
      prose("Về phần mềm Web UI, toàn bộ trang HTML (khoảng 6 KB) được nhúng trực tiếp vào Flash ROM dưới dạng hằng số PROGMEM trong file web_ui.h — đây là quyết định Co-design để tránh dùng LittleFS (đòi hỏi partition table phức tạp hơn) trong khi Flash 16 MB của N16R8 vẫn còn dư thừa."),
      prose("Sơ đồ kiến trúc firmware dưới đây minh họa cách bốn luồng công việc hoạt động song song mà không chặn lẫn nhau, đây là yêu cầu thiết kế bắt buộc để đạt được cả thời gian phản hồi API dưới 200 ms lẫn tần suất đo cảm biến 100 SPS:"),
      gap(),

      // ASCII diagram as code-like paragraph
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 80, after: 80, line: 280 },
        indent: { left: 720 },
        border: {
          top: BD, bottom: BD, left: BD, right: BD,
        },
        children: [new TextRun({ text: "loop() — chu kỳ ~10ms", font: "Courier New", size: 22, bold: true, color: "1F3864" })],
      }),
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0, line: 280 }, indent: { left: 720 }, children: [new TextRun({ text: "├── [Task 1] Đọc MAX30102 → circular buffer (mỗi 10 ms)", font: "Courier New", size: 22 })]}),
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0, line: 280 }, indent: { left: 720 }, children: [new TextRun({ text: "├── [Task 2] Đủ 400 mẫu → tính HR & SpO₂ → TFLite inference (mỗi 4 s)", font: "Courier New", size: 22 })]}),
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 0, line: 280 }, indent: { left: 720 }, children: [new TextRun({ text: "├── [Task 3] Cập nhật OLED qua I2C (mỗi 2 s, dùng mutex)", font: "Courier New", size: 22 })]}),
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 80, line: 280 }, indent: { left: 720 }, children: [new TextRun({ text: "└── [Task 4] ESPAsyncWebServer phục vụ HTTP request (interrupt-driven)", font: "Courier New", size: 22 })]}),
      caption("Hình 1: Kiến trúc firmware non-blocking — bốn luồng công việc chạy song song trên ESP32-S3"),
      gap(),
      new Paragraph({ children: [new PageBreak()] }),

      // ════════════════════════════════════════════════════════════
      // 7. LỘ TRÌNH EVT → DVT → PVT
      // ════════════════════════════════════════════════════════════
      h1("7. Lộ Trình Phát Triển: EVT → DVT → PVT"),
      rule(),
      prose("Dự án được chia thành ba giai đoạn xác nhận theo quy trình phát triển sản phẩm phần cứng tiêu chuẩn:"),
      gap(),

      h3("Giai đoạn EVT (Engineering Validation Test)"),
      prose("Đây là giai đoạn đang thực hiện, tập trung hoàn thiện phần cứng trên breadboard và xác minh toàn bộ luồng dữ liệu từ cảm biến đến giao diện. Các mốc cần đạt gồm: xác nhận bus I2C nhận đúng hai địa chỉ 0x57 và 0x3C, đọc tín hiệu raw Red/IR từ MAX30102, tính toán HR và SpO₂ với độ chính xác tham chiếu so với máy đo chuẩn, hiển thị lên OLED và phục vụ Web Dashboard qua WiFi."),
      gap(),

      h3("Giai đoạn DVT (Design Validation Test)"),
      prose("Giai đoạn này tập trung tích hợp mô hình Edge AI và kiểm thử toàn diện. Nhóm sẽ huấn luyện model trên 12.000 mẫu, export thư viện TFLite Micro, nhúng vào firmware và xác minh độ chính xác trên tập test đạt tối thiểu 85%. Tiếp theo kiểm thử tuổi thọ pin liên tục 8 giờ, kiểm thử Watchdog Timer trong kịch bản firmware treo giả lập, và rà soát bảo mật không để rò rỉ dữ liệu cá nhân qua WiFi nội bộ."),
      gap(),

      h3("Giai đoạn PVT (Production Validation Test — Kế hoạch tương lai)"),
      prose("Sau khi vượt qua DVT, nhóm dự kiến thiết kế PCB tùy chỉnh để thay thế breadboard, in vỏ 3D bảo vệ tích hợp, và thực hiện kiểm thử toàn hệ thống lần cuối trước khi đóng gói thành sản phẩm prototype hoàn chỉnh phục vụ mục đích trình diễn và nghiên cứu."),
      gap(),

      // ════════════════════════════════════════════════════════════
      // 8. DEFINITION OF DONE
      // ════════════════════════════════════════════════════════════
      h1("8. Định Nghĩa Hoàn Thành (Definition of Done)"),
      rule(),
      prose("Tính năng FEAT-003 — Edge AI Health Status Classification được coi là hoàn thành và sẵn sàng bước sang giai đoạn DVT khi tất cả các tiêu chí sau được xác minh có tài liệu kết quả kèm theo:"),
      gap(),
      chk("Model TFLite Micro load thành công vào firmware, không lỗi khởi tạo, Flash footprint ≤ 50 KB"),
      chk("Thời gian inference ≤ 100 ms trên ESP32-S3 N16R8 (đo bằng millis() trước và sau lời gọi inference)"),
      chk("Nhãn phân loại Normal / Warning / Danger hiển thị đúng trên OLED và Web Dashboard"),
      chk("Độ chính xác ≥ 85 % trên tập test 2.400 mẫu (20 % của 12.000 mẫu)"),
      chk("Khi SpO₂ < 90 %: nhãn NGUY HIỂM xuất hiện trên OLED và Dashboard trong ≤ 10 giây"),
      chk("Anomaly score hiển thị dạng số thực 4 chữ số thập phân; cảnh báo cam khi score > 0.5"),
      chk("API GET /data trả về JSON đầy đủ (hr, spo2, status, normal, warning, danger, anomaly) trong < 200 ms"),
      chk("Hệ thống hoạt động liên tục ≥ 8 giờ trên pin 18650 đầy, không crash hoặc memory leak"),
      gap(),

      // ════════════════════════════════════════════════════════════
      // 9. TÀI LIỆU THAM KHẢO
      // ════════════════════════════════════════════════════════════
      h1("9. Tài Liệu Tham Khảo"),
      rule(),
      num("SparkFun MAX30105 Library — github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library"),
      num("Edge Impulse Documentation — docs.edgeimpulse.com/docs/deployment/arduino-library"),
      num("TensorFlow Lite Micro on ESP32-S3 — tensorflow.org/lite/microcontrollers"),
      num("WHO Pulse Oximetry Training Manual, 2011 — SpO₂ clinical thresholds"),
      num("ISO 80601-2-61:2017 — Medical electrical equipment: Pulse oximeter requirements"),
      num("ESPAsyncWebServer — github.com/ESP-BoosterPack/ESPAsyncWebServer"),
      num("Kaggle: Human Vital Signs Dataset 2024 — kaggle.com/datasets"),
      num("DFRobot AI Oximeter (ESP32-S3 + Edge Impulse) — community.dfrobot.com/makelog-315026"),
      gap(),
      rule(),
      para([italicText("Tài liệu này được soạn thảo phục vụ mục đích báo cáo học thuật chuyên đề IoT & Y sinh. Các thông số kỹ thuật sẽ được hiệu chỉnh sau giai đoạn EVT dựa trên kết quả thực nghiệm.")], { align: AlignmentType.CENTER }),

    ],
  }],
});

// ── Write file ─────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('PRD_v2.docx', buf);
  console.log('✅ Done: PRD_v2.docx');
});
