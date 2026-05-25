(function () {
  "use strict";

  function num(v) {
    const x = parseFloat(v);
    return Number.isFinite(x) ? x : 0;
  }

  function fmt(v, digits) {
    if (digits === void 0) digits = 2;
    if (v == null || !Number.isFinite(v)) return "—";
    return v.toFixed(digits);
  }

  function readForm(form) {
    const data = {};
    if (!form) return data;
    for (const el of form.elements) {
      if (!el.name || el.type === "submit" || el.type === "checkbox") continue;
      data[el.name] = num(el.value);
    }
    return data;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CLEARANCE_ROWS = [
    { label: "S1", formula: "D_lubang − D_stab1", live: { key: "S1", unit: "in" } },
    { label: "S2", formula: "D_lubang − D_stab2", live: { key: "S2", unit: "in" } },
  ];

  var COMMON_TAIL = [
    { label: "B1", formula: "(57,3·S1 / 24) · (1/L1 + 1/L2)", live: degLive("B1") },
    { label: "B2", formula: "(57,3·S2 / 24) · (1/L2)", live: degLive("B2") },
    { label: "Φ", formula: "B′ − B1 + B2", live: degLive("Phi") },
    { label: "BUR", formula: "(Φ × 200) / (L1 + L2)  [deg/100 ft]", live: burLive("BUR") },
  ];

  function ftLive(key) {
    return { key: key, unit: "ft" };
  }

  function degLive(key, digits) {
    return { key: key, unit: "deg", digits: digits != null ? digits : 4 };
  }

  function burLive(key) {
    return { key: key, unit: "deg/100 ft", digits: 4 };
  }

  function burExtras(S1, S2, L1, L2, Bprime) {
    if (
      !Number.isFinite(S1) ||
      !Number.isFinite(S2) ||
      !Number.isFinite(L1) ||
      !Number.isFinite(L2) ||
      !Number.isFinite(Bprime) ||
      L1 <= 0 ||
      L2 <= 0
    ) {
      return { B1: null, B2: null, Phi: null, BUR: null };
    }
    var B1 = (57.3 * S1 / 24) * (1 / L1 + 1 / L2);
    var B2 = (57.3 * S2 / 24) * (1 / L2);
    var Phi = Bprime - B1 + B2;
    var BUR = (Phi * 200) / (L1 + L2);
    return { B1: B1, B2: B2, Phi: Phi, BUR: BUR };
  }

  function mergeValues(base, extras) {
    return Object.assign({}, base, extras);
  }

  function formatLiveCell(values, liveCfg) {
    if (!liveCfg) {
      return '<span class="formula-live-empty">—</span>';
    }
    var v = values[liveCfg.key];
    if (liveCfg.key === "Bprime" && (v == null || !Number.isFinite(v))) {
      return '<span class="formula-live-empty">—</span>';
    }
    if (!Number.isFinite(v)) {
      return '<span class="formula-live-empty">—</span>';
    }
    var digits = liveCfg.digits != null ? liveCfg.digits : 2;
    return (
      '<span class="formula-live-val">' +
      escapeHtml(fmt(v, digits) + " " + liveCfg.unit) +
      "</span>"
    );
  }

  function renderCombinedTable(rowsEl, subtitleEl, motorType, live) {
    var cfg = STATIC[motorType];
    if (!cfg || !rowsEl) return;
    if (subtitleEl) subtitleEl.textContent = cfg.subtitle;
    var html = cfg.rows
      .map(function (row) {
        return (
          "<tr>" +
          '<th scope="row">' +
          escapeHtml(row.label) +
          "</th>" +
          "<td><code>" +
          escapeHtml(row.formula) +
          "</code></td>" +
          '<td class="formula-live-cell">' +
          formatLiveCell(live.values, row.live) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    rowsEl.innerHTML = html;
  }

  var STATIC = {
    1: {
      subtitle: "L1 = A · L2 = B",
      rows: [
        { label: "L1 (A)", formula: "L_bit + DC_A + ½·L_S1BH", live: ftLive("L1") },
        { label: "L2 (B)", formula: "½·L_S1BH + DC_B + ½·L_S2", live: ftLive("L2") },
      ]
        .concat(CLEARANCE_ROWS)
        .concat([
          { label: "B′", formula: "X (sudut bent housing)", live: { key: "Bprime", unit: "deg", digits: 4 } },
        ])
        .concat(COMMON_TAIL),
    },
    2: {
      subtitle: "L1 = A · L2 = B + C",
      rows: [
        { label: "A", formula: "L_bit + DC_A + ½·L_S1", live: ftLive("A") },
        { label: "B", formula: "½·L_S1 + DC_B + ½·L_BH", live: ftLive("B") },
        { label: "C", formula: "½·L_BH + DC_C + ½·L_S2", live: ftLive("C") },
        { label: "L1", formula: "L1 = A", live: ftLive("L1") },
        { label: "L2", formula: "L2 = B + C", live: ftLive("L2") },
      ]
        .concat(CLEARANCE_ROWS)
        .concat([
          { label: "B′", formula: "x · C / (B + C)", live: { key: "Bprime", unit: "deg", digits: 4 } },
        ])
        .concat(COMMON_TAIL),
    },
    3: {
      subtitle: "L1 = A · L2 = B + C + D",
      rows: [
        { label: "A", formula: "L_bit + DC_A + ½·L_S1", live: ftLive("A") },
        { label: "B", formula: "½·L_S1 + DC_B + ½·L_BH", live: ftLive("B") },
        { label: "C", formula: "½·L_BH + DC_C + ½·L_BS", live: ftLive("C") },
        { label: "D", formula: "½·L_BS + DC_D + ½·L_S2", live: ftLive("D") },
        { label: "L1", formula: "L1 = A", live: ftLive("L1") },
        { label: "L2", formula: "L2 = B + C + D", live: ftLive("L2") },
      ]
        .concat(CLEARANCE_ROWS)
        .concat([
          { label: "B′", formula: "[x·(C+D) + y·D] / (B+C+D)", live: { key: "Bprime", unit: "deg", digits: 4 } },
        ])
        .concat(COMMON_TAIL),
    },
    4: {
      subtitle: "L1 = A + B · L2 = C + D + E",
      rows: [
        { label: "A", formula: "L_bit + DC_A + ½·L_TDB", live: ftLive("A") },
        { label: "B", formula: "½·L_TDB + DC_B + ½·L_S1", live: ftLive("B") },
        { label: "C", formula: "½·L_S1 + DC_C + ½·L_BH", live: ftLive("C") },
        { label: "D", formula: "½·L_BH + DC_D + ½·L_BS", live: ftLive("D") },
        { label: "E", formula: "½·L_BS + DC_E + ½·L_S2", live: ftLive("E") },
        { label: "L1", formula: "L1 = A + B", live: ftLive("L1") },
        { label: "L2", formula: "L2 = C + D + E", live: ftLive("L2") },
      ]
        .concat(CLEARANCE_ROWS)
        .concat([
          {
            label: "B′",
            formula: "[y + z·E/(D+E)]·(D+E)/(C+D+E) + x·A/(A+B)",
            live: { key: "Bprime", unit: "deg", digits: 4 },
          },
        ])
        .concat(COMMON_TAIL),
    },
  };

  function computeType1(g, dc) {
    var d = dRef(g);
    var S1 = g.D_hole - g.D_stab1;
    var S2 = g.D_hole - g.D_stab2;
    var L1 = g.L_bit + dc.DC_A + 0.5 * g.L_S1BH;
    var L2 = 0.5 * g.L_S1BH + dc.DC_B + 0.5 * g.L_S2;
    var Bprime = g.X_bent_housing_deg;
    var segments = [
      { label: "Bit", w: g.L_bit, kind: "bit", d: d.hole * 0.42 },
      { label: "DC_A", w: dc.DC_A, kind: "dc", d: d.hole * 0.5 },
      { label: "½BH", w: 0.5 * g.L_S1BH, kind: "comp", d: d.hole * 0.56 },
      {
        label: "½BH",
        w: 0.5 * g.L_S1BH,
        kind: "bend",
        angle: "X",
        angleLabel: "X",
        d: d.hole * 0.58,
        bendDeg: g.X_bent_housing_deg,
      },
      { label: "DC_B", w: dc.DC_B, kind: "dc", d: d.hole * 0.5 },
      { label: "½S2", w: 0.5 * g.L_S2, kind: "comp", d: d.stab2 },
    ];
    return {
      S1: S1,
      S2: S2,
      L1: L1,
      L2: L2,
      Bprime: Bprime,
      l1End: 2,
      l1Label: "L1",
      l2Label: "L2",
      values: mergeValues(
        { L1: L1, L2: L2, S1: S1, S2: S2, Bprime: Bprime },
        burExtras(S1, S2, L1, L2, Bprime),
      ),
      segments: segments,
      dRef: d,
    };
  }

  function computeType2(g, dc) {
    var d = dRef(g);
    var S1 = g.D_hole - g.D_stab1;
    var S2 = g.D_hole - g.D_stab2;
    var A = g.L_bit + dc.DC_A + 0.5 * g.L_S1;
    var B = 0.5 * g.L_S1 + dc.DC_B + 0.5 * g.L_BH;
    var C = 0.5 * g.L_BH + dc.DC_C + 0.5 * g.L_S2;
    var L1 = A;
    var L2 = B + C;
    var bc = B + C;
    var Bprime = bc > 0 ? g.X_bent_housing_deg * (C / bc) : null;
    var segments = [
      { label: "Bit", w: g.L_bit, kind: "bit", d: d.hole * 0.42 },
      { label: "DC_A", w: dc.DC_A, kind: "dc", d: d.hole * 0.5 },
      { label: "S1", w: 0.5 * g.L_S1, kind: "comp", d: d.stab1 },
      { label: "DC_B", w: dc.DC_B, kind: "dc", d: d.hole * 0.5 },
      {
        label: "BH",
        w: g.L_BH,
        kind: "bend",
        angle: "x",
        angleLabel: "x",
        d: d.hole * 0.58,
        bendDeg: g.X_bent_housing_deg,
      },
      { label: "DC_C", w: dc.DC_C, kind: "dc", d: d.hole * 0.5 },
      { label: "S2", w: 0.5 * g.L_S2, kind: "comp", d: d.stab2 },
    ];
    return {
      S1: S1,
      S2: S2,
      L1: L1,
      L2: L2,
      Bprime: Bprime,
      l1End: 2,
      l1Label: "L1 = A",
      l2Label: "L2 = B+C",
      values: mergeValues(
        { A: A, B: B, C: C, L1: L1, L2: L2, S1: S1, S2: S2, Bprime: Bprime },
        burExtras(S1, S2, L1, L2, Bprime),
      ),
      segments: segments,
      dRef: d,
    };
  }

  function computeType3(g, dc) {
    var d = dRef(g);
    var S1 = g.D_hole - g.D_stab1;
    var S2 = g.D_hole - g.D_stab2;
    var A = g.L_bit + dc.DC_A + 0.5 * g.L_S1;
    var B = 0.5 * g.L_S1 + dc.DC_B + 0.5 * g.L_BH;
    var C = 0.5 * g.L_BH + dc.DC_C + 0.5 * g.L_BS;
    var D = 0.5 * g.L_BS + dc.DC_D + 0.5 * g.L_S2;
    var L1 = A;
    var L2 = B + C + D;
    var bcd = B + C + D;
    var cd = C + D;
    var Bprime = bcd > 0 ? (g.X_bent_housing_deg * cd + g.Y_bent_sub_deg * D) / bcd : null;
    var segments = [
      { label: "Bit", w: g.L_bit, kind: "bit", d: d.hole * 0.42 },
      { label: "DC_A", w: dc.DC_A, kind: "dc", d: d.hole * 0.5 },
      { label: "S1", w: 0.5 * g.L_S1, kind: "comp", d: d.stab1 },
      { label: "DC_B", w: dc.DC_B, kind: "dc", d: d.hole * 0.5 },
      {
        label: "BH",
        w: g.L_BH,
        kind: "bend",
        angle: "x",
        angleLabel: "x",
        d: d.hole * 0.58,
        bendDeg: g.X_bent_housing_deg,
      },
      { label: "DC_C", w: dc.DC_C, kind: "dc", d: d.hole * 0.5 },
      {
        label: "BS",
        w: g.L_BS,
        kind: "bend",
        angle: "y",
        angleLabel: "y",
        d: d.hole * 0.56,
        bendDeg: g.Y_bent_sub_deg,
      },
      { label: "DC_D", w: dc.DC_D, kind: "dc", d: d.hole * 0.5 },
      { label: "S2", w: 0.5 * g.L_S2, kind: "comp", d: d.stab2 },
    ];
    return {
      S1: S1,
      S2: S2,
      L1: L1,
      L2: L2,
      Bprime: Bprime,
      l1End: 2,
      l1Label: "L1 = A",
      l2Label: "L2 = B+C+D",
      values: mergeValues(
        { A: A, B: B, C: C, D: D, L1: L1, L2: L2, S1: S1, S2: S2, Bprime: Bprime },
        burExtras(S1, S2, L1, L2, Bprime),
      ),
      segments: segments,
      dRef: d,
    };
  }

  function computeType4(g, dc) {
    var d = dRef(g);
    var S1 = g.D_hole - g.D_stab1;
    var S2 = g.D_hole - g.D_stab2;
    var A = g.L_bit + dc.DC_A + 0.5 * g.L_TDB;
    var B = 0.5 * g.L_TDB + dc.DC_B + 0.5 * g.L_S1;
    var C = 0.5 * g.L_S1 + dc.DC_C + 0.5 * g.L_BH;
    var D = 0.5 * g.L_BH + dc.DC_D + 0.5 * g.L_BS;
    var E = 0.5 * g.L_BS + dc.DC_E + 0.5 * g.L_S2;
    var L1 = A + B;
    var L2 = C + D + E;
    var ab = A + B;
    var de = D + E;
    var Bprime = null;
    if (ab > 0 && L2 > 0 && de > 0) {
      Bprime = (g.Y_bent_housing_deg + g.Z_bent_sub_deg * (E / de)) * (de / L2) + g.X_tdb_deg * (A / ab);
    }
    var segments = [
      { label: "Bit", w: g.L_bit, kind: "bit", d: d.hole * 0.42 },
      { label: "DC_A", w: dc.DC_A, kind: "dc", d: d.hole * 0.5 },
      {
        label: "TDB",
        w: g.L_TDB,
        kind: "bend",
        angle: "x",
        angleLabel: "x",
        d: d.hole * 0.58,
        bendDeg: g.X_tdb_deg,
      },
      { label: "DC_B", w: dc.DC_B, kind: "dc", d: d.hole * 0.5 },
      { label: "S1", w: 0.5 * g.L_S1, kind: "comp", d: d.stab1 },
      { label: "DC_C", w: dc.DC_C, kind: "dc", d: d.hole * 0.5 },
      {
        label: "BH",
        w: g.L_BH,
        kind: "bend",
        angle: "y",
        angleLabel: "y",
        d: d.hole * 0.58,
        bendDeg: g.Y_bent_housing_deg,
      },
      { label: "DC_D", w: dc.DC_D, kind: "dc", d: d.hole * 0.5 },
      {
        label: "BS",
        w: g.L_BS,
        kind: "bend",
        angle: "z",
        angleLabel: "z",
        d: d.hole * 0.56,
        bendDeg: g.Z_bent_sub_deg,
      },
      { label: "DC_E", w: dc.DC_E, kind: "dc", d: d.hole * 0.5 },
      { label: "S2", w: 0.5 * g.L_S2, kind: "comp", d: d.stab2 },
    ];
    return {
      S1: S1,
      S2: S2,
      L1: L1,
      L2: L2,
      Bprime: Bprime,
      l1End: 4,
      l1Label: "L1 = A+B",
      l2Label: "L2 = C+D+E",
      values: mergeValues(
        { A: A, B: B, C: C, D: D, E: E, L1: L1, L2: L2, S1: S1, S2: S2, Bprime: Bprime },
        burExtras(S1, S2, L1, L2, Bprime),
      ),
      segments: segments,
      dRef: d,
    };
  }

  var COMPUTE = {
    1: computeType1,
    2: computeType2,
    3: computeType3,
    4: computeType4,
  };

  function dRef(g) {
    return {
      hole: Math.max(g.D_hole, 0) || 8,
      stab1: Math.max(g.D_stab1, 0) || 6.5,
      stab2: Math.max(g.D_stab2, 0) || 6.5,
    };
  }

  function segLenWeight(v) {
    return Math.max(v, 0);
  }

  function visualBendDeg(deg) {
    if (deg == null || !Number.isFinite(deg) || Math.abs(deg) < 0.0001) return 0;
    var sign = deg > 0 ? 1 : -1;
    /* Skala halus & proporsional: 1° input ≈ 2° visual, tanpa lantai paksa */
    return sign * Math.min(14, Math.abs(deg) * 2);
  }

  function isStabilizer(seg) {
    return /^(S1|S2|½S1|½S2)$/.test(seg.label);
  }

  /** Ketebalan visual: Bit > Stabilizer > DC > TDB/BH/BS */
  function segmentThickness(seg, dr) {
    if (seg.kind === "bit") {
      return 36;
    }
    if (isStabilizer(seg)) {
      var sd = /S2|½S2/.test(seg.label) ? dr.stab2 : dr.stab1;
      return 24 + Math.min(4, sd * 0.35);
    }
    if (seg.kind === "dc") {
      return 14;
    }
    if (seg.kind === "bend") {
      return 17;
    }
    return 16;
  }

  /** Bit di kanan: balik urutan dari uphole (kiri) ke bit (kanan). */
  function prepareDisplaySegments(segments, l1EndIdx) {
    var rev = segments.slice().reverse();
    for (var i = 0; i < rev.length; i++) {
      if (rev[i].bendDeg != null) {
        rev[i] = Object.assign({}, rev[i], {
          bendDegLabel: rev[i].bendDeg,
          bendDeg: -rev[i].bendDeg,
        });
      }
    }
    return {
      segments: rev,
      l1Start: segments.length - 1 - l1EndIdx,
    };
  }

  function polyRectCorners(x1, y1, x2, y2, thickness) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.hypot(dx, dy) || 1;
    var nx = (-dy / len) * (thickness / 2);
    var ny = (dx / len) * (thickness / 2);
    return [
      [x1 + nx, y1 + ny],
      [x2 + nx, y2 + ny],
      [x2 - nx, y2 - ny],
      [x1 - nx, y1 - ny],
    ];
  }

  function polyRectPath(x1, y1, x2, y2, thickness) {
    var corners = polyRectCorners(x1, y1, x2, y2, thickness);
    return (
      "M" +
      corners[0][0] +
      "," +
      corners[0][1] +
      " L" +
      corners[1][0] +
      "," +
      corners[1][1] +
      " L" +
      corners[2][0] +
      "," +
      corners[2][1] +
      " L" +
      corners[3][0] +
      "," +
      corners[3][1] +
      " Z"
    );
  }

  function diagramBoundsInit(x, y) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }

  function diagramBoundsGrowPoint(b, x, y, margin) {
    var m = margin != null ? margin : 0;
    b.minX = Math.min(b.minX, x - m);
    b.maxX = Math.max(b.maxX, x + m);
    b.minY = Math.min(b.minY, y - m);
    b.maxY = Math.max(b.maxY, y + m);
  }

  function diagramBoundsGrowBox(b, box, margin) {
    if (!box) return;
    var m = margin != null ? margin : 0;
    b.minX = Math.min(b.minX, box.x1 - m);
    b.maxX = Math.max(b.maxX, box.x2 + m);
    b.minY = Math.min(b.minY, box.y1 - m);
    b.maxY = Math.max(b.maxY, box.y2 + m);
  }

  function diagramBoundsGrowCorners(b, corners, margin) {
    for (var i = 0; i < corners.length; i++) {
      diagramBoundsGrowPoint(b, corners[i][0], corners[i][1], margin);
    }
  }

  function fillForKind(kind) {
    if (kind === "dc") return "var(--formula-dc)";
    if (kind === "bend") return "var(--formula-bend)";
    if (kind === "bit") return "var(--formula-bit)";
    return "var(--formula-comp)";
  }

  function labelTextBox(mx, my, text, rotDeg, fontSize) {
    var fs = fontSize || 10;
    var hw = Math.max(18, text.length * fs * 0.34);
    var hh = fs * 0.62;
    var rad = (rotDeg * Math.PI) / 180;
    var corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    var xs = [];
    var ys = [];
    for (var i = 0; i < corners.length; i++) {
      var lx = corners[i][0];
      var ly = corners[i][1];
      xs.push(mx + lx * Math.cos(rad) - ly * Math.sin(rad));
      ys.push(my + lx * Math.sin(rad) + ly * Math.cos(rad));
    }
    return {
      x1: Math.min.apply(null, xs),
      x2: Math.max.apply(null, xs),
      y1: Math.min.apply(null, ys),
      y2: Math.max.apply(null, ys),
    };
  }

  function textBoxCentered(x, y, text, fontSize) {
    var fs = fontSize || 9;
    var hw = Math.max(22, text.length * fs * 0.33);
    var hh = fs * 0.72;
    return { x1: x - hw, x2: x + hw, y1: y - hh, y2: y + hh };
  }

  function textBoxAnchored(x, y, text, fontSize, anchor) {
    var fs = fontSize || 10;
    var w = Math.max(20, text.length * fs * 0.36);
    var hh = fs * 0.65;
    if (anchor === "end") {
      return { x1: x - w, x2: x + 3, y1: y - hh, y2: y + hh };
    }
    if (anchor === "start") {
      return { x1: x - 3, x2: x + w, y1: y - hh, y2: y + hh };
    }
    return textBoxCentered(x, y, text, fs);
  }

  function bodyBoxFromCorners(corners, margin) {
    var b = diagramBoundsInit(corners[0][0], corners[0][1]);
    diagramBoundsGrowCorners(b, corners, margin || 0);
    return { x1: b.minX, x2: b.maxX, y1: b.minY, y2: b.maxY };
  }

  function boxesOverlap(a, b, pad) {
    var p = pad != null ? pad : 3;
    return a.x1 - p < b.x2 && a.x2 + p > b.x1 && a.y1 - p < b.y2 && a.y2 + p > b.y1;
  }

  function overlapsAny(box, boxes, pad) {
    for (var i = 0; i < boxes.length; i++) {
      if (boxesOverlap(box, boxes[i], pad)) return true;
    }
    return false;
  }

  function bendTagText(bm) {
    var deg = bm.bendDegLabel != null ? bm.bendDegLabel : bm.realDeg;
    var prefix = bm.label ? bm.label + " " : "";
    return prefix + fmt(Math.abs(deg), 2) + "°";
  }

  function placeBendTag(bm, occupiedBoxes, vertical) {
    var text = bendTagText(bm);
    var bisect = (bm.r0 + bm.r1) / 2;
    var fs = 9;
    if (vertical) {
      var candidatesV = [
        { dist: 42, ang: bisect + Math.PI / 2, leader: true },
        { dist: 50, ang: bisect + Math.PI / 2, leader: true },
        { dist: 38, ang: bisect + Math.PI / 2, leader: true },
        { dist: 44, ang: bisect - Math.PI / 2, leader: true },
        { dist: 52, ang: bisect, leader: true },
        { dist: 48, ang: bisect + 0.7, leader: true },
      ];
      for (var vi = 0; vi < candidatesV.length; vi++) {
        var cv = candidatesV[vi];
        var lvx = bm.x + Math.cos(cv.ang) * cv.dist;
        var lvy = bm.y + Math.sin(cv.ang) * cv.dist;
        var vbox = textBoxCentered(lvx, lvy, text, fs);
        if (!overlapsAny(vbox, occupiedBoxes, 6)) {
          return {
            text: text,
            x: lvx,
            y: lvy,
            leader: cv.leader !== false,
            anchorX: bm.x,
            anchorY: bm.y,
            box: vbox,
          };
        }
      }
    }
    var candidates = [
      { dist: 26, ang: bisect, leader: false },
      { dist: 34, ang: bisect, leader: true },
      { dist: 38, ang: bisect - 0.55, leader: true },
      { dist: 38, ang: bisect + 0.55, leader: true },
      { dist: 42, ang: bisect - 1.0, leader: true },
      { dist: 42, ang: bisect + 1.0, leader: true },
      { dist: 36, ang: bisect + Math.PI / 2, leader: true },
      { dist: 36, ang: bisect - Math.PI / 2, leader: true },
    ];

    for (var ci = 0; ci < candidates.length; ci++) {
      var c = candidates[ci];
      var lx = bm.x + Math.cos(c.ang) * c.dist;
      var ly = bm.y + Math.sin(c.ang) * c.dist;
      var box = textBoxCentered(lx, ly, text, fs);
      if (!overlapsAny(box, occupiedBoxes, 4)) {
        return {
          text: text,
          x: lx,
          y: ly,
          leader: c.leader || ci > 0,
          anchorX: bm.x,
          anchorY: bm.y,
          box: box,
        };
      }
    }

    var fallback = candidates[candidates.length - 1];
    var fx = bm.x + Math.cos(fallback.ang) * fallback.dist;
    var fy = bm.y + Math.sin(fallback.ang) * fallback.dist;
    var fbox = textBoxCentered(fx, fy, text, fs);
    return {
      text: text,
      x: fx,
      y: fy,
      leader: true,
      anchorX: bm.x,
      anchorY: bm.y,
      box: fbox,
    };
  }

  function renderBendTagSvg(tag) {
    var out = "";
    if (tag.leader) {
      out +=
        '<line x1="' +
        tag.anchorX +
        '" y1="' +
        tag.anchorY +
        '" x2="' +
        tag.x +
        '" y2="' +
        tag.y +
        '" class="formula-bend-leader"/>' +
        '<circle cx="' +
        tag.anchorX +
        '" cy="' +
        tag.anchorY +
        '" r="2.5" class="formula-bend-anchor"/>';
    }
    out +=
      '<text x="' +
      tag.x +
      '" y="' +
      tag.y +
      '" text-anchor="middle" dominant-baseline="middle" class="formula-bend-tag' +
      (tag.leader ? " formula-bend-tag-callout" : "") +
      '">' +
      escapeHtml(tag.text) +
      "</text>";
    return out;
  }

  function dcLengthTagText(mark, vertical) {
    if (vertical) {
      return fmt(mark.lenFt, 2) + " ft";
    }
    return mark.label + " " + fmt(mark.lenFt, 2) + " ft";
  }

  /** Panjang DC — selalu callout + garis penunjuk (kalkulator & optimizer via calc-form). */
  function placeDcLengthTag(mark, occupiedBoxes, vertical) {
    var text = dcLengthTagText(mark, vertical);
    var fs = 9;
    if (vertical) {
      var nx = -Math.sin(mark.heading);
      var ny = Math.cos(mark.heading);
      var ang = Math.atan2(ny, nx);
      var ax = mark.edgeX != null ? mark.edgeX : mark.anchorX;
      var ay = mark.edgeY != null ? mark.edgeY : mark.anchorY;
      var dists = [34, 40, 46, 52, 58];
      for (var di = 0; di < dists.length; di++) {
        var lx = ax + Math.cos(ang) * dists[di];
        var ly = ay + Math.sin(ang) * dists[di];
        var box = textBoxCentered(lx, ly, text, fs);
        if (!overlapsAny(box, occupiedBoxes, 6)) {
          return {
            text: text,
            x: lx,
            y: ly,
            leader: true,
            anchorX: ax,
            anchorY: ay,
            box: box,
          };
        }
      }
      var flx = ax + Math.cos(ang) * dists[0];
      var fly = ay + Math.sin(ang) * dists[0];
      return {
        text: text,
        x: flx,
        y: fly,
        leader: true,
        anchorX: ax,
        anchorY: ay,
        box: textBoxCentered(flx, fly, text, fs),
      };
    }
    var along = mark.heading;
    var perpUp = along - Math.PI / 2;
    var perpDown = along + Math.PI / 2;
    var candidates = [
      { dist: 22, ang: perpUp, leader: true },
      { dist: 28, ang: perpUp, leader: true },
      { dist: 22, ang: perpDown, leader: true },
      { dist: 28, ang: perpDown, leader: true },
      { dist: 34, ang: perpUp, leader: true },
      { dist: 34, ang: perpDown, leader: true },
      { dist: 30, ang: along, leader: true },
      { dist: 30, ang: along + Math.PI, leader: true },
    ];

    for (var ci = 0; ci < candidates.length; ci++) {
      var c = candidates[ci];
      var lx = mark.anchorX + Math.cos(c.ang) * c.dist;
      var ly = mark.anchorY + Math.sin(c.ang) * c.dist;
      var box = textBoxCentered(lx, ly, text, fs);
      if (!overlapsAny(box, occupiedBoxes, 4)) {
        return {
          text: text,
          x: lx,
          y: ly,
          leader: true,
          anchorX: mark.anchorX,
          anchorY: mark.anchorY,
          box: box,
        };
      }
    }

    var fb = candidates[0];
    var fx = mark.anchorX + Math.cos(fb.ang) * fb.dist;
    var fy = mark.anchorY + Math.sin(fb.ang) * fb.dist;
    return {
      text: text,
      x: fx,
      y: fy,
      leader: true,
      anchorX: mark.anchorX,
      anchorY: mark.anchorY,
      box: textBoxCentered(fx, fy, text, fs),
    };
  }

  function renderDcLengthTagSvg(tag) {
    var out = "";
    if (tag.leader) {
      out +=
        '<line x1="' +
        tag.anchorX +
        '" y1="' +
        tag.anchorY +
        '" x2="' +
        tag.x +
        '" y2="' +
        tag.y +
        '" class="formula-dc-length-leader"/>' +
        '<circle cx="' +
        tag.anchorX +
        '" cy="' +
        tag.anchorY +
        '" r="2.5" class="formula-dc-length-anchor"/>';
    }
    out +=
      '<text x="' +
      tag.x +
      '" y="' +
      tag.y +
      '" text-anchor="middle" dominant-baseline="middle" class="formula-dc-length-tag formula-dc-length-tag-callout">' +
      escapeHtml(tag.text) +
      "</text>";
    return out;
  }

  function renderDimensionBracket(x1, x2, y, label, tickH, options) {
    var tick = tickH != null ? tickH : 7;
    options = options || {};
    var leftTick = options.leftTick !== false;
    var rightTick = options.rightTick !== false;
    if (x2 < x1) {
      var swap = x1;
      x1 = x2;
      x2 = swap;
    }
    if (x2 - x1 < 2) return "";

    var mid = (x1 + x2) / 2;
    var out =
      '<line x1="' +
      x1 +
      '" y1="' +
      y +
      '" x2="' +
      x2 +
      '" y2="' +
      y +
      '" class="formula-bracket"/>';
    if (leftTick) {
      out +=
        '<line x1="' +
        x1 +
        '" y1="' +
        (y - tick) +
        '" x2="' +
        x1 +
        '" y2="' +
        (y + tick) +
        '" class="formula-bracket-tick"/>';
    }
    if (rightTick) {
      out +=
        '<line x1="' +
        x2 +
        '" y1="' +
        (y - tick) +
        '" x2="' +
        x2 +
        '" y2="' +
        (y + tick) +
        '" class="formula-bracket-tick"/>';
    }
    out +=
      '<text x="' +
      mid +
      '" y="' +
      (y + 14) +
      '" text-anchor="middle" class="formula-bracket-label">' +
      escapeHtml(label) +
      "</text>";
    return out;
  }

  function renderBracketBoundary(x, y, tickH) {
    var tick = tickH != null ? tickH : 9;
    return (
      '<line x1="' +
      x +
      '" y1="' +
      (y - tick) +
      '" x2="' +
      x +
      '" y2="' +
      (y + tick) +
      '" class="formula-bracket-boundary"/>'
    );
  }

  function renderBracketBoundaryV(y, x, tickH) {
    var tick = tickH != null ? tickH : 9;
    return (
      '<line x1="' +
      (x - tick) +
      '" y1="' +
      y +
      '" x2="' +
      (x + tick) +
      '" y2="' +
      y +
      '" class="formula-bracket-boundary"/>'
    );
  }

  function renderDimensionBracketVertical(y1, y2, x, label, tickH, options) {
    var tick = tickH != null ? tickH : 7;
    options = options || {};
    var topTick = options.topTick !== false;
    var bottomTick = options.bottomTick !== false;
    if (y2 < y1) {
      var swap = y1;
      y1 = y2;
      y2 = swap;
    }
    if (y2 - y1 < 2) return "";

    var mid = (y1 + y2) / 2;
    var out =
      '<line x1="' +
      x +
      '" y1="' +
      y1 +
      '" x2="' +
      x +
      '" y2="' +
      y2 +
      '" class="formula-bracket"/>';
    if (topTick) {
      out +=
        '<line x1="' +
        (x - tick) +
        '" y1="' +
        y1 +
        '" x2="' +
        (x + tick) +
        '" y2="' +
        y1 +
        '" class="formula-bracket-tick"/>';
    }
    if (bottomTick) {
      out +=
        '<line x1="' +
        (x - tick) +
        '" y1="' +
        y2 +
        '" x2="' +
        (x + tick) +
        '" y2="' +
        y2 +
        '" class="formula-bracket-tick"/>';
    }
    out +=
      '<text x="' +
      (x + 12) +
      '" y="' +
      mid +
      '" dominant-baseline="middle" class="formula-bracket-label">' +
      escapeHtml(label) +
      "</text>";
    return out;
  }

  function segmentLabelPos(mx, my, heading, thick, vertical) {
    if (!vertical) {
      return { lx: mx, ly: my, rot: (heading * 180) / Math.PI, anchor: "middle" };
    }
    /* Vertikal: nama komponen (DC, BH, S1, Bit, …) di tengah segmen — angka panjang di callout luar */
    return { lx: mx, ly: my, rot: 0, anchor: "middle" };
  }

  function dcEdgeAnchor(mx, my, heading, thick) {
    var nx = -Math.sin(heading);
    var ny = Math.cos(heading);
    var half = thick * 0.5 + 2;
    return { x: mx + nx * half, y: my + ny * half };
  }

  var diagramVertical = false;

  function renderDiagram(container, live) {
    if (!live.segments.length) {
      container.innerHTML = "";
      return;
    }

    var dr = live.dRef || { hole: 8, stab1: 6.5, stab2: 6.5 };
    var disp = prepareDisplaySegments(live.segments, live.l1End);
    var segs = disp.segments;
    var l1Start = disp.l1Start;

    var vertical = diagramVertical;
    var pad = 20;
    var gap = 4;
    var innerSpan = 680;
    var totalW = 0;
    for (var i = 0; i < segs.length; i++) totalW += segLenWeight(segs[i].w);
    var equalWidths = totalW < 1e-6;
    if (equalWidths) totalW = segs.length;

    var heading = vertical ? Math.PI / 2 : 0;
    var cx = vertical ? pad + innerSpan / 2 : pad;
    var cy = vertical ? pad + 40 : 72;
    var shapes = [];
    var labels = [];
    var bendMarks = [];
    var dcMarks = [];
    var segProj = [];
    var bodyBoxes = [];
    var bounds = diagramBoundsInit(cx, cy);

    for (var j = 0; j < segs.length; j++) {
      var seg = segs[j];
      var weight = equalWidths ? 1 : segLenWeight(seg.w);
      var len = equalWidths
        ? innerSpan / segs.length
        : Math.max(16, (weight / totalW) * innerSpan);
      var thick = segmentThickness(seg, dr);
      var x2 = cx + Math.cos(heading) * len;
      var y2 = cy + Math.sin(heading) * len;

      shapes.push(
        '<path d="' +
          polyRectPath(cx, cy, x2, y2, thick) +
          '" fill="' +
          fillForKind(seg.kind) +
          '" stroke="var(--border)" stroke-width="1" class="formula-seg formula-seg-' +
          seg.kind +
          '"/>',
      );

      var mx = (cx + x2) / 2;
      var my = (cy + y2) / 2;
      var lp = segmentLabelPos(mx, my, heading, thick, vertical);
      labels.push({
        mx: lp.lx,
        my: lp.ly,
        rot: lp.rot,
        anchor: lp.anchor || "middle",
        seg: seg,
        len: len,
        anchorX: mx,
        anchorY: my,
      });

      if (seg.kind === "dc") {
        var edge = dcEdgeAnchor(mx, my, heading, thick);
        dcMarks.push({
          anchorX: mx,
          anchorY: my,
          edgeX: edge.x,
          edgeY: edge.y,
          heading: heading,
          lenFt: seg.w,
          label: seg.label,
          thick: thick,
        });
      }

      var pStart = vertical ? Math.min(cy, y2) : Math.min(cx, x2);
      var pEnd = vertical ? Math.max(cy, y2) : Math.max(cx, x2);
      segProj.push({ startP: pStart, endP: pEnd, idx: j });
      var corners = polyRectCorners(cx, cy, x2, y2, thick);
      diagramBoundsGrowCorners(bounds, corners, 1);
      if (vertical) {
        bodyBoxes.push(bodyBoxFromCorners(corners, 3));
      }

      var nextX = x2 + Math.cos(heading) * gap;
      var nextY = y2 + Math.sin(heading) * gap;

      if (seg.bendDeg != null && Math.abs(seg.bendDeg) > 0.0001) {
        var vDeg = visualBendDeg(seg.bendDeg);
        var radBefore = heading;
        var radAfter = heading + (vDeg * Math.PI) / 180;
        bendMarks.push({
          x: x2,
          y: y2,
          r0: radBefore,
          r1: radAfter,
          label: seg.angleLabel || seg.angle || "",
          realDeg: seg.bendDegLabel != null ? seg.bendDegLabel : seg.bendDeg,
        });
        heading = radAfter;
      }

      cx = nextX;
      cy = nextY;
    }

    var occupiedBoxes = [];
    if (vertical) {
      for (var bi = 0; bi < bodyBoxes.length; bi++) {
        occupiedBoxes.push(bodyBoxes[bi]);
      }
    }

    for (var li = 0; li < labels.length; li++) {
      var lb = labels[li];
      var labelText = lb.seg.label;
      var tspanAngle = "";
      if (
        !vertical &&
        lb.seg.kind !== "bend" &&
        (lb.seg.angleLabel || lb.seg.angle)
      ) {
        tspanAngle =
          '<tspan x="' +
          lb.mx +
          '" dy="1.1em" class="formula-seg-angle">' +
          escapeHtml(lb.seg.angleLabel || lb.seg.angle) +
          "</tspan>";
      }
      var rotAttr =
        lb.rot === 0
          ? ""
          : ' transform="rotate(' +
            lb.rot +
            " " +
            lb.mx +
            " " +
            lb.my +
            '"';
      var textAnchor = lb.anchor || "middle";
      shapes.push(
        '<text x="' +
          lb.mx +
          '" y="' +
          lb.my +
          '" text-anchor="' +
          textAnchor +
          '" dominant-baseline="middle"' +
          rotAttr +
          ' class="formula-seg-label' +
          (lb.seg.kind === "bit" ? " formula-seg-label-bit" : "") +
          '">' +
          escapeHtml(lb.seg.label) +
          tspanAngle +
          "</text>",
      );
      var lbBox = labelTextBox(lb.mx, lb.my, labelText, lb.rot, 10);
      occupiedBoxes.push(lbBox);
      diagramBoundsGrowBox(bounds, lbBox, 4);
    }

    for (var bmi = 0; bmi < bendMarks.length; bmi++) {
      var bm = bendMarks[bmi];
      var arcR = 16;
      var a0 = bm.r0;
      var a1 = bm.r1;
      var ax1 = bm.x + Math.cos(a0) * arcR;
      var ay1 = bm.y + Math.sin(a0) * arcR;
      var ax2 = bm.x + Math.cos(a1) * arcR;
      var ay2 = bm.y + Math.sin(a1) * arcR;
      var sweep = a1 > a0 ? 1 : 0;
      var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
      shapes.push(
        '<path d="M' +
          ax1 +
          "," +
          ay1 +
          " A" +
          arcR +
          "," +
          arcR +
          " 0 " +
          large +
          " " +
          sweep +
          " " +
          ax2 +
          "," +
          ay2 +
          '" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" class="formula-bend-arc"/>',
      );

      diagramBoundsGrowPoint(bounds, bm.x, bm.y, arcR + 4);
      var tag = placeBendTag(bm, occupiedBoxes, vertical);
      shapes.push(renderBendTagSvg(tag));
      occupiedBoxes.push(tag.box);
      diagramBoundsGrowBox(bounds, tag.box, 4);
    }

    for (var di = 0; di < dcMarks.length; di++) {
      var dm = dcMarks[di];
      var dcTag = placeDcLengthTag(dm, occupiedBoxes, vertical);
      shapes.push(renderDcLengthTagSvg(dcTag));
      occupiedBoxes.push(dcTag.box);
      diagramBoundsGrowBox(bounds, dcTag.box, 3);
    }

    var midX = (bounds.minX + bounds.maxX) / 2;
    var tickH = 7;

    var l2P1 = segProj[0] ? segProj[0].startP : vertical ? cy : pad;
    var l2P2 =
      l1Start > 0 && segProj[l1Start - 1]
        ? segProj[l1Start - 1].endP
        : l2P1;
    var l1P1 = segProj[l1Start] ? segProj[l1Start].startP : l2P2;
    var l1P2 = segProj[segProj.length - 1]
      ? segProj[segProj.length - 1].endP
      : vertical
        ? bounds.maxY
        : bounds.maxX;
    var boundaryP = l1P1;

    var orientHint = "";
    if (vertical) {
      orientHint =
        '<text x="' +
        midX +
        '" y="' +
        (bounds.minY - 8) +
        '" text-anchor="middle" class="formula-orient-hint">Uphole / stabilizer</text>' +
        '<text x="' +
        midX +
        '" y="' +
        (bounds.maxY + 18) +
        '" text-anchor="middle" class="formula-orient-hint">Bit</text>';
      diagramBoundsGrowBox(
        bounds,
        textBoxCentered(midX, bounds.minY - 8, "Uphole / stabilizer", 9),
        2,
      );
      diagramBoundsGrowBox(
        bounds,
        textBoxCentered(midX, bounds.maxY + 18, "Bit", 9),
        2,
      );
    } else {
      orientHint =
        '<text x="' +
        pad +
        '" y="14" class="formula-orient-hint">Uphole / stabilizer</text>' +
        '<text x="' +
        (bounds.maxX + pad - 8) +
        '" y="14" text-anchor="end" class="formula-orient-hint">Bit →</text>';
      diagramBoundsGrowBox(
        bounds,
        textBoxCentered(pad + 72, 14, "Uphole / stabilizer", 9),
        2,
      );
      diagramBoundsGrowBox(
        bounds,
        textBoxCentered(bounds.maxX + pad - 8, 14, "Bit →", 9),
        2,
      );
    }

    var brackets = "";
    if (l1P2 - l2P1 >= 2) {
      if (vertical) {
        var bracketX = bounds.maxX + 22;
        brackets +=
          '<line x1="' +
          bracketX +
          '" y1="' +
          l2P1 +
          '" x2="' +
          bracketX +
          '" y2="' +
          l1P2 +
          '" class="formula-bracket-baseline"/>';
        if (
          Math.abs(boundaryP - l2P1) > 1.5 &&
          Math.abs(boundaryP - l1P2) > 1.5
        ) {
          brackets += renderBracketBoundaryV(boundaryP, bracketX, tickH + 2);
        }
        if (boundaryP - l2P1 >= 2) {
          brackets += renderDimensionBracketVertical(
            l2P1,
            boundaryP,
            bracketX,
            live.l2Label,
            tickH,
            { bottomTick: false },
          );
        }
        if (l1P2 - boundaryP >= 2) {
          brackets += renderDimensionBracketVertical(
            boundaryP,
            l1P2,
            bracketX,
            live.l1Label,
            tickH,
            { topTick: false },
          );
        }
        diagramBoundsGrowPoint(bounds, bracketX, l2P1, tickH + 2);
        diagramBoundsGrowPoint(bounds, bracketX, l1P2, tickH + 2);
        diagramBoundsGrowPoint(bounds, bracketX + 14, boundaryP, tickH + 4);
        diagramBoundsGrowBox(
          bounds,
          textBoxCentered(
            bracketX + 12,
            (l2P1 + boundaryP) / 2,
            live.l2Label || "",
            9,
          ),
          2,
        );
        diagramBoundsGrowBox(
          bounds,
          textBoxCentered(
            bracketX + 12,
            (boundaryP + l1P2) / 2,
            live.l1Label || "",
            9,
          ),
          2,
        );
      } else {
        var bracketY = bounds.maxY + 22;
        brackets +=
          '<line x1="' +
          l2P1 +
          '" y1="' +
          bracketY +
          '" x2="' +
          l1P2 +
          '" y2="' +
          bracketY +
          '" class="formula-bracket-baseline"/>';
        if (
          Math.abs(boundaryP - l2P1) > 1.5 &&
          Math.abs(boundaryP - l1P2) > 1.5
        ) {
          brackets += renderBracketBoundary(boundaryP, bracketY, tickH + 2);
        }
        if (boundaryP - l2P1 >= 2) {
          brackets += renderDimensionBracket(
            l2P1,
            boundaryP,
            bracketY,
            live.l2Label,
            tickH,
            { rightTick: false },
          );
        }
        if (l1P2 - boundaryP >= 2) {
          brackets += renderDimensionBracket(
            boundaryP,
            l1P2,
            bracketY,
            live.l1Label,
            tickH,
            { leftTick: false },
          );
        }
        diagramBoundsGrowPoint(bounds, l2P1, bracketY, tickH + 2);
        diagramBoundsGrowPoint(bounds, l1P2, bracketY, tickH + 2);
        diagramBoundsGrowPoint(bounds, boundaryP, bracketY, tickH + 4);
        diagramBoundsGrowBox(
          bounds,
          textBoxCentered(
            (l2P1 + boundaryP) / 2,
            bracketY + 14,
            live.l2Label || "",
            9,
          ),
          2,
        );
        diagramBoundsGrowBox(
          bounds,
          textBoxCentered(
            (boundaryP + l1P2) / 2,
            bracketY + 14,
            live.l1Label || "",
            9,
          ),
          2,
        );
      }
    }

    var edgePad = 18;
    var edgePadL = vertical ? 88 : edgePad;
    var edgePadR = vertical ? 40 : edgePad;
    var edgePadY = edgePad;
    var vbX = bounds.minX - edgePadL;
    var vbY = bounds.minY - edgePadY;
    var vbW = Math.max(
      bounds.maxX - bounds.minX + edgePadL + edgePadR,
      vertical ? 260 : 200,
    );
    var vbH = Math.max(bounds.maxY - bounds.minY + edgePadY * 2, 100);
    container.innerHTML =
      '<svg class="formula-svg" viewBox="' +
      vbX +
      " " +
      vbY +
      " " +
      vbW +
      " " +
      vbH +
      '" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagram section motor">' +
      orientHint +
      shapes.join("") +
      brackets +
      "</svg>";
  }

  var panelRefresh = null;

  function initFormulaPanel(motorType) {
    var panel = document.getElementById("formula-panel");
    var geometryForm = document.getElementById("geometry-form");
    var calcForm = document.getElementById("calc-form");

    if (!panel || !geometryForm) return;

    var compute = COMPUTE[motorType];
    if (!compute) return;

    var details = panel.querySelector(".formula-panel-details");
    if (details) {
      var key = "formula-panel-open-" + motorType;
      try {
        var saved = sessionStorage.getItem(key);
        if (saved === "1") details.open = true;
        else if (saved === "0") details.open = false;
      } catch (_e) {
        /* ignore */
      }
      details.addEventListener("toggle", function () {
        try {
          sessionStorage.setItem(key, details.open ? "1" : "0");
        } catch (_e2) {
          /* ignore */
        }
      });
    }

    function update() {
      var diagramEl = document.getElementById("formula-diagram");
      var rowsEl = document.getElementById("formula-rows");
      var subtitleEl = document.getElementById("formula-subtitle");
      if (!diagramEl || !rowsEl) return;
      var g = readForm(geometryForm);
      var dc = readForm(calcForm);
      var live = compute(g, dc);
      renderDiagram(diagramEl, live);
      renderCombinedTable(rowsEl, subtitleEl, motorType, live);
    }

    geometryForm.addEventListener("input", update);
    geometryForm.addEventListener("change", update);
    if (calcForm) {
      calcForm.addEventListener("input", update);
      calcForm.addEventListener("change", update);
    }
    diagramVertical = loadDiagramOrientation(motorType);

    var orientBtn = document.getElementById("formula-diagram-orient-btn");
    var diagramWrap = document.getElementById("formula-diagram-wrap");

    function syncDiagramOrientationUi() {
      if (orientBtn) {
        orientBtn.textContent = diagramVertical ? "Landscape" : "Vertikal";
        orientBtn.setAttribute("aria-pressed", diagramVertical ? "true" : "false");
        orientBtn.title = diagramVertical
          ? "Kembali ke tampilan landscape (horizontal)"
          : "Skema vertikal: uphole atas, bit bawah — teks tetap horizontal";
      }
      if (diagramWrap) {
        diagramWrap.classList.toggle(
          "formula-diagram-wrap--vertical",
          diagramVertical,
        );
      }
    }

    syncDiagramOrientationUi();

    if (orientBtn && !orientBtn.dataset.bound) {
      orientBtn.dataset.bound = "1";
      orientBtn.addEventListener("click", function () {
        diagramVertical = !diagramVertical;
        try {
          sessionStorage.setItem(
            "formula-diagram-orient-" + motorType,
            diagramVertical ? "vertical" : "landscape",
          );
        } catch (_e3) {
          /* ignore */
        }
        syncDiagramOrientationUi();
        update();
      });
    }

    panelRefresh = update;
    update();
  }

  function loadDiagramOrientation(motorType) {
    try {
      return (
        sessionStorage.getItem("formula-diagram-orient-" + motorType) ===
        "vertical"
      );
    } catch (_e) {
      return false;
    }
  }

  window.FormulaPanel = {
    refresh: function () {
      if (panelRefresh) panelRefresh();
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    var panel = document.getElementById("formula-panel");
    if (!panel) return;
    var motorType = parseInt(panel.getAttribute("data-motor-type"), 10);
    if (!motorType) return;
    initFormulaPanel(motorType);
  });
})();
