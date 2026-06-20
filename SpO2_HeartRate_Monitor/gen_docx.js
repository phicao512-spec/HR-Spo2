const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, Header, Footer, PageNumber, PageBreak,
  ExternalHyperlink
} = require('docx');
const fs = require('fs');

// ── Font & size constants ──────────────────────────────────────────────
const FONT = "Times New Roman";
const SZ   = 27;   // 13.5pt = 27 half-points
const SZ_H1 = 34;  // 17pt  (heading 1)
const SZ_H2 = 30;  // 15pt  (heading 2)
const SZ_H3 = 27;  // 13.5pt (heading 3, same as body)

// Page: A4, margins 2.5cm each side
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1418; // ~2.5cm in DXA
const CONTENT_W = PAGE_W - MARGIN * 2; // 9070

// ── Helper builders ───────────────────────────────────────────────────

/** Plain paragraph */
function p(text, opts = {}) {
  const { bold = false, italic = false, size = SZ, align = AlignmentType.JUSTIFIED,
          spaceBefore = 80, spaceAfter = 80, indent = 0, color = "000000" } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before: spaceBefore, after: spaceAfter, line: 320 },
    indent: indent ? { left: indent } : undefined,
    children: [new TextRun({ text, font: FONT, size, bold, italic, color })]
  });
}

/** Heading 1 */
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ_H1, bold: true, color: "1F3864" })]
  });
}

/** Heading 2 */
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 100, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ_H2, bold: true, color: "2E5496" })]
  });
}

/** Heading 3 */
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ_H3, bold: true, italic: true, color: "404040" })]
  });
}

/** Divider */
function divider() {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E5496", space: 1 } },
    children: []
  });
}

/** Bullet item */
function bullet(text, level = 0) {
  const indent = 720 + level * 360;
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ })]
  });
}

/** Numbered item */
function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 40, after: 40, line: 320 },
    children: [new TextRun({ text, font: FONT, size: SZ })]
  });
}

/** Code / monospace block */
function code(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 280 },
    indent: { left: 720 },
    children: [new TextRun({ text, font: "Courier New", size: 22, color: "1A1A2E" })]
  });
}

/** Empty line */
function emptyLine() {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun("")] });
}

// ── Table builders ────────────────────────────────────────────────────

const borderDef = { style: BorderStyle.SINGLE, size: 1, color: "B0C4DE" };
const borders = { top: borderDef, bottom: borderDef, left: borderDef, right: borderDef };

function makeCell(texts, isHeader = false, widthDXA = 2000, shade = null) {
  const children = (Array.isArray(texts) ? texts : [texts]).map(t =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({
        text: String(t), font: FONT, size: SZ,
        bold: isHeader, color: isHeader ? "FFFFFF" : "000000"
      })]
    })
  );
  return new TableCell({
    borders,
    width: { size: widthDXA, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: shade ? shade : (isHeader
      ? { fill: "2E5496", type: ShadingType.CLEAR }
      : { fill: "F5F8FF", type: ShadingType.CLEAR }),
    verticalAlign: VerticalAlign.CENTER,
    children
  });
}

function makeRow(cells, isHeader = false) {
  return new TableRow({ tableHeader: isHeader, children: cells });
}

/** 2-column info table */
function infoTable(rows) {
  const colW = [4535, 4535];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      makeRow([makeCell("Thông tin", true, colW[0]), makeCell("Chi tiết", true, colW[1])], true),
      ...rows.map(([a, b], i) => makeRow([
        makeCell(a, false, colW[0], { fill: i % 2 === 0 ? "EEF3FC" : "F9FBFF", type: ShadingType.CLEAR }),
        makeCell(b, false, colW[1], { fill: i % 2 === 0 ? "EEF3FC" : "F9FBFF", type: ShadingType.CLEAR })
      ]))
    ]
  });
}

/** Generic multi-column table */
function genericTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      makeRow(headers.map((h, i) => makeCell(h, true, colWidths[i])), true),
      ...rows.map((row, ri) => makeRow(
        row.map((cell, ci) => makeCell(cell, false, colWidths[ci],
          { fill: ri % 2 === 0 ? "EEF3FC" : "F9FBFF", type: ShadingType.CLEAR }
        ))
      ))
    ]
  });
}

// ── Document assembly ─────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }, {
          level: 1, format: LevelFormat.BULLET, text: "\u25E6",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "checklist",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u25A1",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: {
      document: { run: { font: FONT, size: SZ } }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ_H1, bold: true, font: FONT, color: "1F3864" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ_H2, bold: true, font: FONT, color: "2E5496" },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 }
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ_H3, bold: true, italic: true, font: FONT, color: "404040" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "2E5496", space: 1 } },
          spacing: { after: 120 },
          children: [new TextRun({ text: "PRD — Wearable HR & SpO\u2082 Monitor with Edge AI", font: FONT, size: 20, color: "555555", italic: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "2E5496", space: 1 } },
          spacing: { before: 80 },
          children: [
            new TextRun({ text: "Trang ", font: FONT, size: 20, color: "777777" }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20, color: "777777" }),
            new TextRun({ text: " | Nh\u00f3m IoT & Y sinh \u2014 2026", font: FONT, size: 20, color: "777777" })
          ]
        })]
      })
    },
    children: [
      // ══════════════════════════════════════════════════════════════
      // TRANG BÌA
      // ══════════════════════════════════════════════════════════════
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1000, after: 200 },
        children: [new TextRun({ text: "T\u00c0I LI\u1ec6U Y\u00cau C\u1ea6U S\u1ea2N PH\u1ea8M (PRD)", font: FONT, size: 48, bold: true, color: "1F3864" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: "Thi\u1ebft B\u1ecb \u0110eo Tay Gi\u00e1m S\u00e1t Nh\u1ecbp Tim & SpO\u2082 T\u00edch H\u1ee3p Edge AI", font: FONT, size: 36, bold: true, color: "2E5496" })]
      }),
      divider(),
      emptyLine(),
      infoTable([
        ["T\u00ean \u0111\u1ec1 t\u00e0i", "Wearable Heart Rate & SpO\u2082 Monitor with Edge AI Classification"],
        ["Nh\u00f3m th\u1ef1c hi\u1ec7n", "IoT & Y sinh"],
        ["Phi\u00ean b\u1ea3n t\u00e0i li\u1ec7u", "v1.1 \u2014 B\u1ea3n h\u1ecdc thu\u1eadt"],
        ["Ng\u00e0y so\u1ea1n th\u1ea3o", "2026-06-15"],
        ["Giai \u0111o\u1ea1n ph\u00e1t tri\u1ec3n", "EVT (Engineering Validation Test) \u2192 DVT (Design Validation Test)"]
      ]),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════
      // 1. BỐI CẢNH & BÀI TOÁN
      // ══════════════════════════════════════════════════════════════
      h1("1. B\u1ed1i C\u1ea3nh & B\u00e0i To\u00e1n (Problem Statement)"),
      divider(),
      h2("1.1 Ph\u00e1t Bi\u1ec3u V\u1ea5n \u0110\u1ec1"),
      p("C\u00e1c b\u1ec7nh l\u00fd tim m\u1ea1ch v\u00e0 h\u00f4 h\u1ea5p nh\u01b0 \u0111\u1ed9t qu\u1ef5 (stroke), suy tim sung huy\u1ebft (CHF \u2014 Congestive Heart Failure) v\u00e0 suy h\u00f4 h\u1ea5p c\u1ea5p (ARF \u2014 Acute Respiratory Failure) di\u1ec5n bi\u1ebfn \u00e2m th\u1ea7m trong nhi\u1ec1u gi\u1edd tr\u01b0\u1edbc khi x\u1ea3y ra bi\u1ebfn c\u1ed1 c\u1ea5p t\u00ednh. Hai ch\u1ec9 s\u1ed1 sinh t\u1ed3n quan tr\u1ecdng nh\u1ea5t \u0111\u1ec3 c\u1ea3nh b\u00e1o s\u1edbm l\u00e0:"),
      bullet("Heart Rate (HR) \u2014 nh\u1ecbp tim (\u0111\u01a1n v\u1ecb: bpm \u2014 beats per minute)"),
      bullet("SpO\u2082 \u2014 \u0111\u1ed9 b\u00e3o ho\u00e0 oxy trong m\u00e1u ngo\u1ea1i vi (\u0111\u01a1n v\u1ecb: %)"),
      emptyLine(),
      p("Thi\u1ebft b\u1ecb \u0111o oxy xung th\u01b0\u01a1ng m\u1ea1i (pulse oximeter) hi\u1ec7n nay c\u00f3 c\u00e1c h\u1ea1n ch\u1ebf:"),
      numbered("Chi ph\u00ed cao, kh\u00f4ng ph\u1ed5 bi\u1ebfn \u0111\u1ebfn h\u1ed9 gia \u0111\u00ecnh b\u00ecnh d\u00e2n."),
      numbered("Thi\u1ebfu kh\u1ea3 n\u0103ng k\u1ebft n\u1ed1i, kh\u00f4ng truy\u1ec1n d\u1eef li\u1ec7u l\u00ean n\u1ec1n t\u1ea3ng gi\u00e1m s\u00e1t t\u1eeb xa."),
      numbered("Kh\u00f4ng c\u00f3 tr\u00ed tu\u1ec7 nh\u00e2n t\u1ea1o \u0111\u1ec3 t\u1ef1 ph\u00e2n lo\u1ea1i nguy c\u01a1 v\u00e0 ph\u00e1t c\u1ea3nh b\u00e1o ch\u1ee7 \u0111\u1ed9ng."),
      emptyLine(),
      h2("1.2 Gi\u1ea3i Ph\u00e1p \u0110\u1ec1 Xu\u1ea5t"),
      p("Thi\u1ebft k\u1ebf m\u1ed9t thi\u1ebft b\u1ecb \u0111eo tay (wearable device) m\u00e3 ngu\u1ed3n m\u1edf, gi\u00e1 th\u00e0nh th\u1ea5p, t\u00edch h\u1ee3p thu\u1eadt to\u00e1n Edge AI (\u0110\u1ea7u cu\u1ed1i Th\u00f4ng minh) ch\u1ea1y tr\u1ef1c ti\u1ebfp tr\u00ean vi \u0111i\u1ec1u khi\u1ec3n ESP32-S3, kh\u00f4ng ph\u1ee5 thu\u1ed9c server b\u00ean ngo\u00e0i."),
      emptyLine(),
      p("Lu\u1ed3ng x\u1eed l\u00fd h\u1ec7 th\u1ed1ng:", { bold: true }),
      code("MAX30102 (C\u1ea3m bi\u1ebfn)  \u2192  ESP32-S3 (MCU Edge)  \u2192  TFLite Micro (AI)  \u2192  C\u1ea3nh b\u00e1o (LED / Web / OLED)"),
      code("D\u1eef li\u1ec7u th\u00f4 (Red, IR)    X\u1eed l\u00fd t\u00edn hi\u1ec7u,         Normal / Warning /    Ng\u01b0\u1eddi d\u00f9ng"),
      code("                         t\u00ednh HR & SpO\u2082       Danger label          \u0111\u01b0\u1ee3c th\u00f4ng b\u00e1o"),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════
      // 2. PERSONA
      // ══════════════════════════════════════════════════════════════
      h1("2. Persona \u2014 Ch\u00e2n Dung Ng\u01b0\u1eddi D\u00f9ng (User Persona)"),
      divider(),
      h2("2.1 Persona Ch\u00ednh: Ng\u01b0\u1eddi Cao Tu\u1ed5i S\u1ed1ng \u0110\u1ed9c L\u1eadp"),
      genericTable(
        ["Thu\u1ed9c t\u00ednh", "M\u00f4 t\u1ea3"],
        [
          ["T\u00ean \u0111\u1ea1i di\u1ec7n", "\u00d4ng Nguy\u1ec5n V\u0103n Minh"],
          ["Tu\u1ed5i", "68 tu\u1ed5i"],
          ["B\u1ec7nh n\u1ec1n", "T\u0103ng huy\u1ebft \u00e1p \u0111\u1ed9 II, ti\u1ec1n s\u1eed suy tim nh\u1eb9"],
          ["Ho\u00e0n c\u1ea3nh", "S\u1ed1ng m\u1ed9t m\u00ecnh t\u1ea1i nh\u00e0, con c\u00e1i l\u00e0m vi\u1ec7c xa"],
          ["Tr\u00ecnh \u0111\u1ed9 c\u00f4ng ngh\u1ec7", "Th\u1ea5p \u2014 ch\u1ec9 s\u1eed d\u1ee5ng \u0111i\u1ec7n tho\u1ea1i smartphone c\u01a1 b\u1ea3n"],
          ["Nhu c\u1ea7u", "Theo d\u00f5i s\u1ee9c kh\u1ecfe h\u00e0ng ng\u00e0y, kh\u00f4ng mu\u1ed1n ra ngo\u00e0i kh\u00e1m th\u01b0\u1eddng xuy\u00ean"],
          ["N\u1ed7i s\u1ee3 h\u1ea1i (Pain Points)", "\u0110\u1ed9t qu\u1ef5 m\u00e0 kh\u00f4ng ai bi\u1ebft; thi\u1ebft b\u1ecb ph\u1ee9c t\u1ea1p kh\u00f3 s\u1eed d\u1ee5ng"],
          ["M\u1ee5c ti\u00eau", "C\u00f3 thi\u1ebft b\u1ecb nh\u1ecf g\u1ecdn, t\u1ef1 \u0111\u1ed9ng c\u1ea3nh b\u00e1o khi ch\u1ec9 s\u1ed1 b\u1ea5t th\u01b0\u1eddng"]
        ],
        [3000, 6070]
      ),
      emptyLine(),
      h2("2.2 Persona Ph\u1ee5: Y T\u00e1 / Ng\u01b0\u1eddi Ch\u0103m S\u00f3c T\u1ea1i Nh\u00e0"),
      genericTable(
        ["Thu\u1ed9c t\u00ednh", "M\u00f4 t\u1ea3"],
        [
          ["T\u00ean \u0111\u1ea1i di\u1ec7n", "Ch\u1ecb L\u00ea Th\u1ecb Hoa"],
          ["Tu\u1ed5i", "34 tu\u1ed5i"],
          ["Vai tr\u00f2", "Y t\u00e1 ch\u0103m s\u00f3c t\u1ea1i nh\u00e0, qu\u1ea3n l\u00fd 4\u20136 b\u1ec7nh nh\u00e2n c\u00f9ng l\u00fac"],
          ["Thi\u1ebft b\u1ecb s\u1eed d\u1ee5ng", "\u0110i\u1ec7n tho\u1ea1i Android, k\u1ebft n\u1ed1i WiFi t\u1ea1i nh\u00e0 b\u1ec7nh nh\u00e2n"],
          ["Nhu c\u1ea7u", "Xem dashboard t\u1eeb xa, nh\u1eadn c\u1ea3nh b\u00e1o t\u1ee9c th\u00ec khi b\u1ec7nh nh\u00e2n b\u1ea5t th\u01b0\u1eddng"],
          ["Pain Points", "Kh\u00f4ng th\u1ec3 c\u00f3 m\u1eb7t b\u00ean b\u1ec7nh nh\u00e2n 24/7; c\u1ea7n d\u1eef li\u1ec7u tr\u1ef1c quan, kh\u00f4ng c\u1ea7n c\u00e0i app"]
        ],
        [3000, 6070]
      ),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════
      // 3. USE CASES
      // ══════════════════════════════════════════════════════════════
      h1("3. Use Cases \u2014 Tr\u01b0\u1eddng H\u1ee3p S\u1eed D\u1ee5ng"),
      divider(),
      h2("3.1 B\u1ea3ng T\u1ed5ng Quan Use Case"),
      genericTable(
        ["ID", "T\u00ean Use Case", "T\u00e1c nh\u00e2n"],
        [
          ["UC-01", "\u0110o ch\u1ec9 s\u1ed1 sinh t\u1ed3n t\u1ef1 \u0111\u1ed9ng (Core Feature)", "Ng\u01b0\u1eddi d\u00f9ng"],
          ["UC-02", "Xem m\u00e0n h\u00ecnh OLED hi\u1ec3n th\u1ecb HR / SpO\u2082 / Tr\u1ea1ng th\u00e1i", "Ng\u01b0\u1eddi d\u00f9ng"],
          ["UC-03", "Xem Web Dashboard t\u1eeb xa qua WiFi", "Y t\u00e1 / Ng\u01b0\u1eddi th\u00e2n"],
          ["UC-04", "Ph\u00e2n lo\u1ea1i AI t\u1ef1 \u0111\u1ed9ng (Normal / Warning / Danger)", "H\u1ec7 th\u1ed1ng"],
          ["UC-05", "K\u00edch ho\u1ea1t c\u1ea3nh b\u00e1o khi ph\u00e1t hi\u1ec7n b\u1ea5t th\u01b0\u1eddng", "H\u1ec7 th\u1ed1ng"]
        ],
        [1300, 5200, 2570]
      ),
      emptyLine(),
      h2("3.2 Chi Ti\u1ebft UC-01: \u0110o Ch\u1ec9 S\u1ed1 Sinh T\u1ed3n T\u1ef1 \u0110\u1ed9ng"),
      genericTable(
        ["Tr\u01b0\u1eddng", "N\u1ed9i dung"],
        [
          ["ID", "UC-01"],
          ["\u0110i\u1ec1u ki\u1ec7n \u0111\u1ea7u", "Thi\u1ebft b\u1ecb \u0111\u01b0\u1ee3c c\u1ea5p ngu\u1ed3n, ng\u00f3n tay \u0111\u1eb7t \u0111\u00fang l\u00ean c\u1ea3m bi\u1ebfn MAX30102"],
          ["Lu\u1ed3ng ch\u00ednh", "1. MAX30102 ph\u00e1t \u00e1nh s\u00e1ng \u0111\u1ecf (660nm) v\u00e0 h\u1ed3ng ngo\u1ea1i (880nm) \u2192 2. \u0110\u1ecdc gi\u00e1 tr\u1ecb ph\u1ea3n x\u1ea1 Red/IR m\u1ed7i 10ms (100 SPS) \u2192 3. T\u00edch lu\u0129 400 m\u1eabu trong 4s \u2192 4. Thu\u1eadt to\u00e1n peak-detection t\u00ednh HR \u2192 5. T\u1ec9 l\u1ec7 AC/DC c\u1ee7a Red:IR \u2192 t\u00ednh SpO\u2082 theo Beer-Lambert \u2192 6. C\u1eadp nh\u1eadt rolling average"],
          ["Lu\u1ed3ng ngo\u1ea1i l\u1ec7", "N\u1ebfu ng\u00f3n tay nh\u1ea5c l\u00ean: gi\u00e1 tr\u1ecb tr\u1ea3 v\u1ec1 0, hi\u1ec3n th\u1ecb \u201cKh\u00f4ng ph\u00e1t hi\u1ec7n ng\u00f3n tay\u201d"],
          ["\u0110i\u1ec1u ki\u1ec7n \u0111\u1ea7u ra", "Gi\u00e1 tr\u1ecb HR (bpm) v\u00e0 SpO\u2082 (%) h\u1ee3p l\u1ec7 c\u1eadp nh\u1eadt tr\u00ean OLED v\u00e0 RAM m\u1ed7i 4s"]
        ],
        [2500, 6570]
      ),
      emptyLine(),
      h2("3.3 Chi Ti\u1ebft UC-03: Xem Web Dashboard T\u1eeb Xa"),
      genericTable(
        ["Tr\u01b0\u1eddng", "N\u1ed9i dung"],
        [
          ["ID", "UC-03"],
          ["T\u00e1c nh\u00e2n", "Y t\u00e1 / Ng\u01b0\u1eddi th\u00e2n"],
          ["\u0110i\u1ec1u ki\u1ec7n \u0111\u1ea7u", "Thi\u1ebft b\u1ecb v\u00e0 \u0111i\u1ec7n tho\u1ea1i k\u1ebft n\u1ed1i c\u00f9ng WiFi n\u1ed9i b\u1ed9"],
          ["Lu\u1ed3ng ch\u00ednh", "1. Ng\u01b0\u1eddi d\u00f9ng m\u1edf tr\u00ecnh duy\u1ec7t \u2192 nh\u1eadp IP c\u1ee7a ESP32-S3 \u2192 2. ESP32-S3 ph\u1ee5c v\u1ee5 file index.html t\u1eeb Flash (PROGMEM) \u2192 3. JavaScript g\u1ecdi GET /data m\u1ed7i 3s \u2192 4. ESP32-S3 tr\u1ea3 v\u1ec1 JSON ch\u1ee9a hr, spo2, status, normal, warning, danger, anomaly \u2192 5. UI c\u1eadp nh\u1eadt m\u00e0u c\u1ea3nh b\u00e1o"],
          ["\u0110i\u1ec1u ki\u1ec7n ra", "Giao di\u1ec7n hi\u1ec3n th\u1ecb HR, SpO\u2082, nh\u00e3n AI, \u0111\u1ed9 tin c\u1eady (confidence), anomaly score"]
        ],
        [2500, 6570]
      ),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════
      // 4. CO-DESIGN
      // ══════════════════════════════════════════════════════════════
      h1("4. Co-Design: Giao Thoa Ph\u1ea7n C\u1ee9ng & Ph\u1ea7n M\u1ec1m"),
      divider(),
      p("M\u1ed9t \u0111i\u1ec3m n\u1ed5i b\u1eadt c\u1ee7a \u0111\u1ec1 t\u00e0i l\u00e0 chi\u1ebfn l\u01b0\u1ee3c Hardware-Software Co-design, trong \u0111\u00f3 c\u00e1c quy\u1ebft \u0111\u1ecbnh ph\u1ea7n c\u1ee9ng v\u00e0 ph\u1ea7n m\u1ec1m r\u00e0ng bu\u1ed9c l\u1eabn nhau v\u00e0 ph\u1ea3i \u0111\u01b0\u1ee3c thi\u1ebft k\u1ebf \u0111\u1ed3ng th\u1eddi."),
      emptyLine(),
      h2("4.1 Ma Tr\u1eadn Co-Design"),
      genericTable(
        ["Quy\u1ebft \u0111\u1ecbnh Ph\u1ea7n c\u1ee9ng", "\u1ea2nh h\u01b0\u1edfng \u0111\u1ebfn Ph\u1ea7n m\u1ec1m", "R\u00e0ng bu\u1ed9c ng\u01b0\u1ee3c l\u1ea1i"],
        [
          ["D\u00f9ng ESP32-S3 N16R8 (8MB PSRAM)", "Cho ph\u00e9p load TFLite Micro model t\u1ed1i \u0111a ~2MB v\u00e0o RAM", "Model ph\u1ea3i t\u1ed1i \u01b0u (quantization int8) \u0111\u1ec3 v\u1eeba PSRAM"],
          ["MAX30102 t\u1ed1c \u0111\u1ed9 l\u1ea5y m\u1eabu 100 SPS", "Thu\u1eadt to\u00e1n peak-detection c\u1ea7n b\u1ed9 \u0111\u1ec7m circular buffer 400 ph\u1ea7n t\u1eed", "Buffer ph\u1ea3i khai b\u00e1o t\u0129nh, tr\u00e1nh heap fragmentation"],
          ["OLED SSD1306 v\u00e0 MAX30102 c\u00f9ng I2C bus (GPIO 8/9)", "Driver I2C c\u1ea7n mutex, tr\u00e1nh xung \u0111\u1ed9t gi\u1eefa 2 task FreeRTOS", "T\u1ea7n su\u1ea5t c\u1eadp nh\u1eadt OLED b\u1ecb gi\u1edbi h\u1ea1n b\u1edfi t\u1ed1c \u0111\u1ed9 I2C 400 kHz"],
          ["Pin 18650 dung l\u01b0\u1ee3ng 2000mAh", "V\u00f2ng l\u1eb7p ch\u00ednh ph\u1ea3i non-blocking; kh\u00f4ng d\u00f9ng delay()", "WiFi \u1edf ch\u1ebf \u0111\u1ed9 STA \u0111\u1ec3 gi\u1ea3m c\u00f4ng su\u1ea5t so v\u1edbi AP mode"],
          ["Flash 16MB c\u1ee7a N16R8", "HTML/CSS/JS web UI nh\u00fang v\u00e0o PROGMEM thay v\u00ec LittleFS", "K\u00edch th\u01b0\u1edbc t\u1ed5ng HTML + CSS + JS ph\u1ea3i < 30KB"]
        ],
        [2800, 3400, 2870]
      ),
      emptyLine(),
      h2("4.2 Ki\u1ebfn Tr\u00fac Firmware Non-Blocking"),
      p("Y\u00eau c\u1ea7u Co-design quan tr\u1ecdng nh\u1ea5t l\u00e0 thi\u1ebft k\u1ebf firmware kh\u00f4ng ch\u1eb7n (non-blocking) \u0111\u1ec3 ba lu\u1ed3ng c\u00f4ng vi\u1ec7c ch\u1ea1y song song:"),
      code("loop() \u2014 ~10ms period"),
      code("\u251c\u2500\u2500 [Task 1] \u0110\u1ecdc MAX30102 v\u00e0o circular buffer (m\u1ed7i 10ms)"),
      code("\u251c\u2500\u2500 [Task 2] T\u00ednh HR + SpO\u2082 khi \u0111\u1ee7 400 m\u1eabu (m\u1ed7i 4s)"),
      code("\u2502              \u2514\u2500\u2500 Ch\u1ea1y TFLite inference \u2192 c\u1eadp nh\u1eadt label"),
      code("\u251c\u2500\u2500 [Task 3] C\u1eadp nh\u1eadt OLED (m\u1ed7i 2s, kh\u00f4ng block I2C)"),
      code("\u2514\u2500\u2500 [Task 4] ESPAsyncWebServer x\u1eed l\u00fd HTTP request (interrupt-driven)"),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════
      // 5. PRD CHI TIẾT — FEAT-003
      // ══════════════════════════════════════════════════════════════
      h1("5. PRD Chi Ti\u1ebft \u2014 T\u00ednh N\u0103ng Ph\u00e2n Lo\u1ea1i S\u1ee9c Kh\u1ecfe B\u1eb1ng Edge AI"),
      divider(),
      h2("5.1 M\u00f4 T\u1ea3 T\u00ednh N\u0103ng (Feature Description)"),
      genericTable(
        ["Thu\u1ed9c t\u00ednh", "N\u1ed9i dung"],
        [
          ["T\u00ean t\u00ednh n\u0103ng", "Edge AI Health Status Classification"],
          ["M\u00e3 t\u00ednh n\u0103ng", "FEAT-003"],
          ["M\u1ee9c \u01b0u ti\u00ean", "P0 \u2014 B\u1eaft bu\u1ed9c (Must-Have)"],
          ["M\u00f4 t\u1ea3 ng\u1eafn", "Ph\u00e2n lo\u1ea1i tr\u1ea1ng th\u00e1i s\u1ee9c kh\u1ecfe (Normal / Warning / Danger) t\u1ef1 \u0111\u1ed9ng t\u1eeb HR & SpO\u2082, ch\u1ea1y tr\u1ef1c ti\u1ebfp tr\u00ean ESP32-S3 qua TFLite Micro."]
        ],
        [2800, 6270]
      ),
      emptyLine(),
      h2("5.2 User Stories"),
      genericTable(
        ["ID", "User Story", "Acceptance Criteria"],
        [
          ["US-01", "V\u1edbi t\u01b0 c\u00e1ch l\u00e0 ng\u01b0\u1eddi d\u00f9ng cao tu\u1ed5i, t\u00f4i mu\u1ed1n thi\u1ebft b\u1ecb t\u1ef1 \u0111\u1ed9ng c\u1ea3nh b\u00e1o khi SpO\u2082 xu\u1ed1ng th\u1ea5p.", "LED \u0111\u1ecf s\u00e1ng + OLED hi\u1ec3n th\u1ecb \u201c\u26a0 NGUY HI\u1ec2M\u201d trong \u2264 5s sau khi SpO\u2082 < 90%"],
          ["US-02", "V\u1edbi t\u01b0 c\u00e1ch l\u00e0 y t\u00e1, t\u00f4i mu\u1ed1n xem ph\u1ea7n tr\u0103m \u0111\u1ed9 tin c\u1eady AI tr\u00ean Web Dashboard.", "Dashboard hi\u1ec3n th\u1ecb 3 c\u1ed9t: Normal / Warning / Danger v\u1edbi gi\u00e1 tr\u1ecb % ch\u00ednh x\u00e1c \u0111\u1ebfn 1 th\u1eadp ph\u00e2n"],
          ["US-03", "V\u1edbi t\u01b0 c\u00e1ch l\u00e0 nh\u00e0 nghi\u00ean c\u1ee9u, t\u00f4i mu\u1ed1n truy c\u1eadp API /data \u0111\u1ec3 l\u1ea5y d\u1eef li\u1ec7u JSON th\u00f4.", "GET /data tr\u1ea3 v\u1ec1 JSON h\u1ee3p l\u1ec7, Content-Type application/json, \u0111\u00e1p \u1ee9ng < 200ms"],
          ["US-04", "V\u1edbi t\u01b0 c\u00e1ch l\u00e0 h\u1ec7 th\u1ed1ng, t\u00f4i mu\u1ed1n ph\u00e1t hi\u1ec7n anomaly ngay c\u1ea3 khi model ch\u01b0a ch\u1eafc ch\u1eafn.", "Anomaly score (K-means) hi\u1ec3n th\u1ecb tr\u00ean dashboard; ng\u01b0\u1ee1ng c\u1ea3nh b\u00e1o > 0.5"]
        ],
        [1100, 4000, 3970]
      ),
      emptyLine(),
      h2("5.3 H\u1ea1n Ch\u1ebf Thi\u1ebft K\u1ebf (Design Constraints)"),
      h3("5.3.1 R\u00e0ng Bu\u1ed9c V\u1eadt L\u00fd"),
      genericTable(
        ["Th\u00f4ng s\u1ed1", "Gi\u00e1 tr\u1ecb m\u1ee5c ti\u00eau", "L\u00fd do"],
        [
          ["K\u00edch th\u01b0\u1edbc t\u1ed5ng th\u1ec3", "\u2264 80 \u00d7 55 \u00d7 25 mm", "V\u1eeba l\u00f2ng b\u00e0n tay, \u0111\u1eb7t tr\u00ean ng\u00f3n tay tho\u1ea3i m\u00e1i"],
          ["Kh\u1ed1i l\u01b0\u1ee3ng (bao g\u1ed3m pin)", "\u2264 120g", "Kh\u00f4ng g\u00e2y m\u1ecfi tay khi \u0111eo l\u00e2u"],
          ["V\u1eadt li\u1ec7u v\u1ecf", "Nh\u1ef1a ABS/PLA in 3D", "Chi ph\u00ed th\u1ea5p, d\u1ec5 ch\u1ebf t\u1ea1o prototype"]
        ],
        [3000, 2800, 3270]
      ),
      emptyLine(),
      h3("5.3.2 R\u00e0ng Bu\u1ed9c N\u0103ng L\u01b0\u1ee3ng"),
      genericTable(
        ["Th\u00e0nh ph\u1ea7n", "C\u00f4ng su\u1ea5t (m\u00e1 \u0111\u1ecbnh)", "Ghi ch\u00fa"],
        [
          ["ESP32-S3 (WiFi ho\u1ea1t \u0111\u1ed9ng)", "~100 mA @ 3.3V", "Ch\u1ebf \u0111\u1ed9 modem-sleep gi\u1eefa c\u00e1c l\u1ea7n polling"],
          ["MAX30102 (\u0111o t\u00edch c\u1ef1c)", "~10 mA @ 3.3V", "LED Red + LED IR ho\u1ea1t \u0111\u1ed9ng"],
          ["OLED SSD1306", "~20 mA @ 3.3V", "S\u00e1ng t\u1ed1i \u0111a"],
          ["T\u1ed5ng c\u1ed9ng (\u01b0\u1edbc t\u00ednh)", "~130 mA @ 3.3V \u2248 430 mW", ""],
          ["Pin 18650 (2000 mAh, 3.7V)", "Dung l\u01b0\u1ee3ng: 7.4 Wh", "Th\u1eddi l\u01b0\u1ee3ng l\u00fd thuy\u1ebft: ~17 gi\u1edd"],
          ["M\u1ee5c ti\u00eau th\u1ef1c t\u1ebf", "\u2265 8 gi\u1edd li\u00ean t\u1ee5c", "T\u00ednh h\u1ec7 s\u1ed1 hi\u1ec7u su\u1ea5t m\u1ea1ch ~70%"]
        ],
        [3000, 2800, 3270]
      ),
      emptyLine(),
      h3("5.3.3 R\u00e0ng Bu\u1ed9c Giao Ti\u1ebfp & K\u1ebft N\u1ed1i"),
      genericTable(
        ["Chu\u1ea9n", "Vai tr\u00f2", "Th\u00f4ng s\u1ed1"],
        [
          ["I2C (GPIO 8/9)", "Giao ti\u1ebfp v\u1edbi MAX30102 & SSD1306", "T\u1ed1c \u0111\u1ed9 400 kHz (Fast Mode); \u0111\u1ecba ch\u1ec9 7-bit"],
          ["WiFi 802.11b/g/n (2.4 GHz)", "Web Server & API JSON", "Ch\u1ebf \u0111\u1ed9 STA; b\u0103ng th\u00f4ng y\u00eau c\u1ea7u < 10 Kbps"],
          ["USB-C / Micro-USB", "N\u1ea1p firmware & s\u1ea1c pin", "T\u1ed1c \u0111\u1ed9 n\u1ea1p UART: 921600 baud"]
        ],
        [2500, 3500, 3070]
      ),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      h2("5.4 Th\u00f4ng S\u1ed1 K\u1ef9 Thu\u1eadt C\u1ea7n \u0110\u1ea1t (Technical Specifications)"),
      h3("5.4.1 Th\u00f4ng S\u1ed1 C\u1ea3m Bi\u1ebfn & \u0110o L\u01b0\u1eddng"),
      genericTable(
        ["Th\u00f4ng s\u1ed1", "Gi\u00e1 tr\u1ecb m\u1ee5c ti\u00eau", "Ph\u01b0\u01a1ng ph\u00e1p x\u00e1c minh"],
        [
          ["D\u1ea3i \u0111o Heart Rate", "20 \u2013 180 bpm", "So s\u00e1nh v\u1edbi m\u00e1y \u0111o chu\u1ea9n (ECG Holter)"],
          ["D\u1ea3i \u0111o SpO\u2082", "70% \u2013 100%", "So s\u00e1nh v\u1edbi m\u00e1y finger oximeter y t\u1ebf chu\u1ea9n"],
          ["\u0110\u1ed9 ch\u00ednh x\u00e1c HR", "\u00b1 5 bpm", "\u0110o 10 l\u1ea7n tr\u00ean 5 \u0111\u1ed1i t\u01b0\u1ee3ng kh\u00e1c nhau"],
          ["\u0110\u1ed9 ch\u00ednh x\u00e1c SpO\u2082", "\u00b1 2%", "Theo ti\u00eau chu\u1ea9n ISO 80601-2-61"],
          ["T\u1ed1c \u0111\u1ed9 l\u1ea5y m\u1eabu", "100 SPS (samples per second)", "\u0110\u1ecdc t\u1eeb register FIFO c\u1ee7a MAX30102"],
          ["Th\u1eddi gian \u1ed5n \u0111\u1ecbnh k\u1ebft qu\u1ea3", "\u2264 10 gi\u00e2y sau khi \u0111\u1eb7t ng\u00f3n tay", "T\u00ednh t\u1eeb l\u00fac h\u00e0m detect_finger() tr\u1ea3 v\u1ec1 true"]
        ],
        [2800, 2700, 3570]
      ),
      emptyLine(),
      h3("5.4.2 Th\u00f4ng S\u1ed1 H\u1ec7 Th\u1ed1ng & Hi\u1ec7u N\u0103ng"),
      genericTable(
        ["Th\u00f4ng s\u1ed1", "Gi\u00e1 tr\u1ecb m\u1ee5c ti\u00eau"],
        [
          ["Th\u1eddi gian kh\u1edfi \u0111\u1ed9ng h\u1ec7 th\u1ed1ng", "< 5 gi\u00e2y \u0111\u1ebfn khi hi\u1ec3n th\u1ecb d\u1eef li\u1ec7u \u0111\u1ea7u ti\u00ean"],
          ["\u0110\u1ed9 tr\u1ec5 c\u1ea3nh b\u00e1o DANGER", "< 10 gi\u00e2y k\u1ec3 t\u1eeb khi ph\u00e1t hi\u1ec7n ng\u01b0\u1ee1ng nguy hi\u1ec3m"],
          ["T\u1ea7n su\u1ea5t c\u1eadp nh\u1eadt Web API", "M\u1ed7i 3 gi\u00e2y"],
          ["T\u1ea7n su\u1ea5t c\u1eadp nh\u1eadt OLED", "M\u1ed7i 2 gi\u00e2y"],
          ["Uptime li\u00ean t\u1ee5c t\u1ed1i thi\u1ec3u", "\u2265 8 gi\u1edd tr\u00ean pin 18650 \u0111\u1ea7y"],
          ["Th\u1eddi gian ph\u1ee5c h\u1ed3i k\u1ebft n\u1ed1i WiFi", "\u2264 30 gi\u00e2y sau khi m\u1ea5t k\u1ebft n\u1ed1i"]
        ],
        [4500, 4570]
      ),
      emptyLine(),
      h3("5.4.3 Th\u00f4ng S\u1ed1 AI Model (Edge Impulse)"),
      genericTable(
        ["Th\u00f4ng s\u1ed1", "Gi\u00e1 tr\u1ecb m\u1ee5c ti\u00eau"],
        [
          ["Ki\u1ebfn tr\u00fac model", "Dense Neural Network (2 l\u1edbp \u1ea9n)"],
          ["Input features", "2 (HR, SpO\u2082)"],
          ["Output classes", "3 (Normal, Warning, Danger)"],
          ["T\u1eadp hu\u1ea5n luy\u1ec7n", "12.000 m\u1eabu (4.000/class, theo chu\u1ea9n WHO)"],
          ["T\u1ec9 l\u1ec7 train/test", "80% / 20%"],
          ["\u0110\u1ed9 ch\u00ednh x\u00e1c m\u1ee5c ti\u00eau", "\u2265 85% overall accuracy"],
          ["Ph\u01b0\u01a1ng ph\u00e1p anomaly", "K-means Anomaly Detection (n_cluster=4)"],
          ["Flash footprint", "\u2264 50 KB"],
          ["RAM footprint khi inference", "\u2264 4 KB"],
          ["Th\u1eddi gian inference", "\u2264 100 ms tr\u00ean ESP32-S3 N16R8"]
        ],
        [4500, 4570]
      ),
      emptyLine(),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════════════════════════════════════════════════════════════
      // 6. LỘ TRÌNH EVT → DVT → PVT
      // ══════════════════════════════════════════════════════════════
      h1("6. L\u1ed9 Tr\u00ecnh Ph\u00e1t Tri\u1ec3n (EVT \u2192 DVT \u2192 PVT)"),
      divider(),
      genericTable(
        ["Giai \u0111o\u1ea1n", "N\u1ed9i dung", "Tr\u1ea1ng th\u00e1i"],
        [
          ["EVT \u2014 Giai \u0111o\u1ea1n 1", "L\u1eafp r\u00e1p ph\u1ea7n c\u1ee9ng tr\u00ean breadboard; x\u00e1c minh I2C bus; \u0111\u1ecdc raw data Red/IR t\u1eeb MAX30102; ch\u1ea1y I2C scanner x\u00e1c nh\u1eadn kh\u00f4ng xung \u0111\u1ed9t \u0111\u1ecba ch\u1ec9", "Ch\u1edd th\u1ef1c hi\u1ec7n"],
          ["EVT \u2014 Giai \u0111o\u1ea1n 2", "T\u00edch h\u1ee3p thu\u1eadt to\u00e1n t\u00ednh HR (peak-detection) v\u00e0 SpO\u2082 (Beer-Lambert); hi\u1ec3n th\u1ecb OLED; k\u1ebft n\u1ed1i WiFi + b\u1eadt Web Server, x\u00e1c minh API /data", "Ch\u1edd th\u1ef1c hi\u1ec7n"],
          ["DVT \u2014 Giai \u0111o\u1ea1n 3", "Hu\u1ea5n luy\u1ec7n model Edge Impulse tr\u00ean 12.000 m\u1eabu; export TFLite library \u2192 t\u00edch h\u1ee3p Firmware; x\u00e1c minh accuracy \u2265 85%; ki\u1ec3m th\u1eed end-to-end", "Ch\u1edd th\u1ef1c hi\u1ec7n"],
          ["DVT \u2014 Giai \u0111o\u1ea1n 4", "Ki\u1ec3m th\u1eed tu\u1ed5i th\u1ecd pin 8+ gi\u1edd li\u00ean t\u1ee5c; ki\u1ec3m th\u1eed Watchdog Timer; so s\u00e1nh \u0111\u1ed9 ch\u00ednh x\u00e1c v\u1edbi thi\u1ebft b\u1ecb y t\u1ebf chu\u1ea9n; review b\u1ea3o m\u1eadt WiFi", "Ch\u1edd th\u1ef1c hi\u1ec7n"],
          ["PVT \u2014 T\u01b0\u01a1ng lai", "Thi\u1ebft k\u1ebf PCB t\u00edch h\u1ee3p; in v\u1ecf 3D b\u1ea3o v\u1ec7 thi\u1ebft b\u1ecb; \u0111\u00f3ng g\u00f3i v\u00e0 ki\u1ec3m th\u1eed to\u00e0n h\u1ec7 th\u1ed1ng l\u1ea7n cu\u1ed1i", "K\u1ebf ho\u1ea1ch t\u01b0\u01a1ng lai"]
        ],
        [2000, 5500, 1570]
      ),
      emptyLine(),

      // ══════════════════════════════════════════════════════════════
      // 7. DEFINITION OF DONE
      // ══════════════════════════════════════════════════════════════
      h1("7. \u0110\u1ecbnh Ngh\u0129a Ho\u00e0n Th\u00e0nh (Definition of Done)"),
      divider(),
      p("T\u00ednh n\u0103ng Edge AI Classification \u0111\u01b0\u1ee3c coi l\u00e0 ho\u00e0n th\u00e0nh khi t\u1ea5t c\u1ea3 c\u00e1c \u0111i\u1ec1u ki\u1ec7n sau \u0111\u01b0\u1ee3c x\u00e1c minh:"),
      emptyLine(),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "Model TFLite Micro \u0111\u01b0\u1ee3c load th\u00e0nh c\u00f4ng v\u00e0o firmware, kh\u00f4ng l\u1ed7i kh\u1edfi t\u1ea1o", font: FONT, size: SZ })] }),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "Inference ch\u1ea1y trong \u2264 100ms tr\u00ean ESP32-S3 N16R8", font: FONT, size: SZ })] }),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "K\u1ebft qu\u1ea3 ph\u00e2n lo\u1ea1i Normal/Warning/Danger hi\u1ec3n th\u1ecb \u0111\u00fang tr\u00ean OLED v\u00e0 Web Dashboard", font: FONT, size: SZ })] }),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "\u0110\u1ed9 ch\u00ednh x\u00e1c \u2265 85% \u0111o tr\u00ean t\u1eadp test (20% c\u1ee7a 12.000 m\u1eabu)", font: FONT, size: SZ })] }),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "Khi SpO\u2082 < 90%: nh\u00e3n \u201cNGUY HI\u1ec2M\u201d xu\u1ea5t hi\u1ec7n trong \u2264 10s", font: FONT, size: SZ })] }),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "Anomaly score hi\u1ec3n th\u1ecb \u0111\u00fang d\u1ea1ng s\u1ed1 th\u1ef1c 4 ch\u1eef s\u1ed1 th\u1eadp ph\u00e2n tr\u00ean Web", font: FONT, size: SZ })] }),
      new Paragraph({ numbering: { reference: "checklist", level: 0 }, spacing: { before: 40, after: 40, line: 320 }, children: [new TextRun({ text: "H\u1ec7 th\u1ed1ng ho\u1ea1t \u0111\u1ed9ng li\u00ean t\u1ee5c \u2265 8 gi\u1edd kh\u00f4ng crash", font: FONT, size: SZ })] }),
      emptyLine(),

      // ══════════════════════════════════════════════════════════════
      // 8. TÀI LIỆU THAM KHẢO
      // ══════════════════════════════════════════════════════════════
      h1("8. T\u00e0i Li\u1ec7u Tham Kh\u1ea3o"),
      divider(),
      numbered("SparkFun MAX30105 Library \u2014 https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library"),
      numbered("Edge Impulse Documentation \u2014 https://docs.edgeimpulse.com/docs/edge-impulse-studio/deployment/arduino-library"),
      numbered("TFLite Micro on ESP32-S3 \u2014 https://www.tensorflow.org/lite/microcontrollers"),
      numbered("WHO SpO\u2082 Clinical Thresholds \u2014 WHO Pulse Oximetry Training Manual (2011)"),
      numbered("ISO 80601-2-61:2017 \u2014 Medical electrical equipment \u2014 Pulse oximeter equipment"),
      numbered("ESPAsyncWebServer \u2014 https://github.com/ESP-BoosterPack/ESPAsyncWebServer"),
      numbered("Kaggle Dataset: Human Vital Signs 2024 \u2014 https://www.kaggle.com/datasets/"),
      numbered("DFRobot AI Oximeter Guide (ESP32-S3 + Edge Impulse) \u2014 https://community.dfrobot.com/makelog-315026.html"),
      emptyLine(),
      divider(),
      p("T\u00e0i li\u1ec7u n\u00e0y \u0111\u01b0\u1ee3c so\u1ea1n th\u1ea3o theo chu\u1ea9n PRD h\u1ecdc thu\u1eadt ph\u1ee5c v\u1ee5 m\u1ee5c \u0111\u00edch b\u00e1o c\u00e1o chuy\u00ean \u0111\u1ec1 IoT & Y sinh. C\u00e1c th\u00f4ng s\u1ed1 k\u1ef9 thu\u1eadt s\u1ebd \u0111\u01b0\u1ee3c hi\u1ec7u ch\u1ec9nh sau giai \u0111o\u1ea1n EVT d\u1ef1a tr\u00ean k\u1ebft qu\u1ea3 \u0111o th\u1ef1c t\u1ebf.", { italic: true, align: AlignmentType.CENTER, color: "555555" }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('PRD_Academic.docx', buffer);
  console.log('✅ Done: PRD_Academic.docx');
});
