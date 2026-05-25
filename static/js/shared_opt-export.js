(function () {
  "use strict";

  var DC_KEYS = {
    1: ["DC_A", "DC_B"],
    2: ["DC_A", "DC_B", "DC_C"],
    3: ["DC_A", "DC_B", "DC_C", "DC_D"],
    4: ["DC_A", "DC_B", "DC_C", "DC_D", "DC_E"],
  };

  var SORT_LABELS = {
    1: "Prioritas error BUR",
    2: "Prioritas total DC terpendek",
    3: "Rekomendasi seimbang (error + total DC)",
  };

  var ctx = null;

  function getMotorType() {
    var panel = document.getElementById("formula-panel");
    if (panel) {
      var t = parseInt(panel.getAttribute("data-motor-type"), 10);
      if (t) return t;
    }
    var bar = document.querySelector(".type-toolbar[data-motor-type]");
    if (bar) return parseInt(bar.getAttribute("data-motor-type"), 10) || 1;
    return 1;
  }

  function escapeCsvCell(value) {
    if (value == null) return "";
    var s = String(value);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function rowsToCsv(rows) {
    return rows
      .map(function (row) {
        return row.map(escapeCsvCell).join(",");
      })
      .join("\r\n");
  }

  function downloadCsv(filename, csvText) {
    var blob = new Blob(["\uFEFF" + csvText], {
      type: "text/csv;charset=utf-8",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function timestampSlug() {
    var d = new Date();
    var p = function (n) {
      return String(n).padStart(2, "0");
    };
    return (
      d.getFullYear() +
      p(d.getMonth() + 1) +
      p(d.getDate()) +
      "_" +
      p(d.getHours()) +
      p(d.getMinutes()) +
      p(d.getSeconds())
    );
  }

  /** Sama persis formatNum() di app_type*.js — agar PDF = tabel di layar. */
  function formatDisplayNum(value) {
    if (value == null || value === "") return "";
    var v = typeof value === "number" ? value : Number(value);
    if (typeof v !== "number" || Number.isNaN(v)) return String(value);
    return Number.isInteger(v) ? String(v) : v.toPrecision(6).replace(/\.?0+$/, "");
  }

  /** Helvetica jsPDF hanya ASCII aman; Unicode (±, ≈, …) merusak render (& antar huruf). */
  function pdfSafeText(text) {
    if (text == null) return "";
    return String(text)
      .replace(/\u00B1/g, "+/-")
      .replace(/\u00F7/g, "/")
      .replace(/\u2248/g, "~")
      .replace(/\u2192/g, "->")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
      .replace(/[^\t\n\r\x20-\x7E]/g, "");
  }

  function wrapPdfLines(text, maxChars) {
    var safe = pdfSafeText(text);
    if (!safe) return [];
    var words = safe.split(/\s+/).filter(Boolean);
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var next = line ? line + " " + w : w;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function pdfWriteLines(doc, lines, x, startY, lineHeight) {
    var y = startY;
    for (var i = 0; i < lines.length; i++) {
      doc.text(lines[i], x, y);
      y += lineHeight;
    }
    return y;
  }

  /** Ambil blok Keragaman, catatan match, dan Best sebagai baris terpisah. */
  function extractMessageSections(raw) {
    var safe = pdfSafeText(String(raw).replace(/\r?\n/g, " "));
    var sections = [];
    if (!safe) return sections;

    var bestIdx = safe.search(/Best:/i);
    var beforeBest = bestIdx >= 0 ? safe.slice(0, bestIdx) : safe;
    var bestLine = bestIdx >= 0 ? safe.slice(bestIdx).trim() : "";

    var kerIdx = beforeBest.search(/Keragaman/i);
    if (kerIdx >= 0) {
      var afterKer = beforeBest.slice(kerIdx);
      var capRe = /(\d+\s+match;\s*\d+\s+representatif disimpan\.)/;
      var capM = afterKer.match(capRe);
      if (capM) {
        var kerText = afterKer.slice(0, afterKer.indexOf(capM[1])).trim();
        if (kerText) sections.push(kerText);
        sections.push(capM[1].trim());
      } else {
        var kerOnly = afterKer.match(
          /Keragaman(?:\s+tersimpan)?:[\s\S]*?bin\./i,
        );
        if (kerOnly) sections.push(kerOnly[0].trim());
        else if (afterKer.trim()) sections.push(afterKer.trim());
      }
    }

    if (bestLine) sections.push(bestLine);
    return sections;
  }

  /** Ringkasan optimizer untuk PDF — tidak memakai string mentah dari server (hindari ±/≈). */
  function buildPdfSummaryLines(meta) {
    var lines = [];
    if (meta.total_matches != null) {
      var epsPart =
        meta.eps != null
          ? " (+/-" + formatDisplayNum(meta.eps) + " deg/100ft)"
          : "";
      var shown =
        meta.displayed_matches != null
          ? ", " + meta.displayed_matches + " solusi diekspor"
          : "";
      lines.push(
        "Ditemukan " + meta.total_matches + " kombinasi" + epsPart + shown + ".",
      );
    }
    if (meta.message) {
      var extra = extractMessageSections(meta.message);
      for (var ei = 0; ei < extra.length; ei++) {
        lines.push(extra[ei]);
      }
    }
    return lines;
  }

  function hasBalanceScore() {
    return (
      ctx &&
      ctx.solutions.some(function (s) {
        return s.balance_score != null;
      })
    );
  }

  function solutionHeaderLabels() {
    var headers = ["#"];
    var motorType = ctx ? ctx.motorType : 1;
    var dc = DC_KEYS[motorType] || DC_KEYS[1];
    for (var i = 0; i < dc.length; i++) {
      headers.push(dc[i] + " (ft)");
    }
    headers.push("Total DC (ft)", "BUR (deg/100ft)", "Selisih BUR");
    if (hasBalanceScore()) headers.push("Skor");
    return headers;
  }

  function solutionDataRow(s, index) {
    var motorType = ctx ? ctx.motorType : 1;
    var dc = DC_KEYS[motorType] || DC_KEYS[1];
    var row = [String(index + 1)];
    for (var i = 0; i < dc.length; i++) {
      row.push(formatDisplayNum(s[dc[i]]));
    }
    row.push(formatDisplayNum(s.total));
    row.push(formatDisplayNum(s.BUR));
    row.push(formatDisplayNum(s.err));
    if (hasBalanceScore()) {
      row.push(formatDisplayNum(s.balance_score));
    }
    return row;
  }

  function sortModeLabel(mode) {
    return SORT_LABELS[String(mode)] || String(mode != null ? mode : "");
  }

  function buildHistoryCsv() {
    if (!ctx || !ctx.history || !ctx.history.length) return "";
    var lines = [
      "# Motor Geometry Type-" +
        ctx.motorType +
        " — history iterasi optimizer",
    ];
    var keys = Object.keys(ctx.history[0]);
    var tableRows = [keys];
    for (var i = 0; i < ctx.history.length; i++) {
      var h = ctx.history[i];
      var row = [];
      for (var k = 0; k < keys.length; k++) {
        row.push(h[keys[k]] != null ? h[keys[k]] : "");
      }
      tableRows.push(row);
    }
    lines.push(rowsToCsv(tableRows));
    return lines.join("\r\n");
  }

  function syncUi() {
    var bar = document.getElementById("opt-export-bar");
    var solBtn = document.getElementById("export-solutions-pdf");
    var histBtn = document.getElementById("export-history-csv");
    if (!bar) return;

    var hasSol = ctx && ctx.solutions && ctx.solutions.length > 0;
    var hasHist = ctx && ctx.history && ctx.history.length > 0;

    bar.hidden = !hasSol;
    if (solBtn) solBtn.disabled = !hasSol;
    if (histBtn) {
      histBtn.hidden = !hasHist;
      histBtn.disabled = !hasHist;
    }
  }

  function exportSolutionsPdf() {
    if (!ctx || !ctx.solutions.length) return;
    var jspdfNs = window.jspdf;
    if (!jspdfNs || !jspdfNs.jsPDF) {
      alert("Pustaka PDF belum dimuat. Muat ulang halaman.");
      return;
    }

    var doc = new jspdfNs.jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    var meta = ctx.meta || {};
    var pageW = doc.internal.pageSize.getWidth();
    var y = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      pdfSafeText(
        "Motor Geometry Type-" + ctx.motorType + " - Solusi Optimizer",
      ),
      14,
      y,
    );
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    var metaLines = [];
    if (meta.bur_target != null) {
      metaLines.push(
        "Target BUR: " + formatDisplayNum(meta.bur_target) + " deg/100 ft",
      );
    }
    if (meta.eps != null) {
      metaLines.push("Toleransi eps: " + formatDisplayNum(meta.eps));
    }
    if (meta.sort_mode != null) {
      metaLines.push("Urutan: " + sortModeLabel(meta.sort_mode));
    }
    if (meta.total_matches != null) {
      metaLines.push("Total ditemukan: " + meta.total_matches);
    }
    if (meta.displayed_matches != null) {
      metaLines.push("Ditampilkan: " + meta.displayed_matches);
    }
    metaLines.push("Diekspor: " + new Date().toLocaleString("id-ID"));

    y = pdfWriteLines(doc, metaLines.map(pdfSafeText), 14, y, 5);

    var summaryLines = buildPdfSummaryLines(meta);
    for (var si = 0; si < summaryLines.length; si++) {
      if (si > 0) y += 1.5;
      var block = wrapPdfLines(summaryLines[si], 110);
      if (block.length) {
        y = pdfWriteLines(doc, block, 14, y + (si === 0 ? 1 : 0), 4.5);
      }
    }

    var body = [];
    for (var i = 0; i < ctx.solutions.length; i++) {
      body.push(solutionDataRow(ctx.solutions[i], i));
    }

    doc.autoTable({
      startY: y + 2,
      head: [solutionHeaderLabels()],
      body: body,
      theme: "striped",
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [47, 94, 70], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 246] },
      margin: { left: 14, right: 14 },
      didDrawPage: function () {
        doc.setFontSize(8);
        doc.text(
          pdfSafeText("Halaman " + doc.internal.getNumberOfPages()),
          pageW - 14,
          doc.internal.pageSize.getHeight() - 8,
          { align: "right" },
        );
      },
    });

    var name =
      "motor_type" + ctx.motorType + "_solusi_" + timestampSlug() + ".pdf";
    doc.save(name);
  }

  function exportHistory() {
    if (!ctx || !ctx.history || !ctx.history.length) return;
    var csv = buildHistoryCsv();
    var name =
      "motor_type" +
      ctx.motorType +
      "_history_" +
      timestampSlug() +
      ".csv";
    downloadCsv(name, csv);
  }

  function setContext(newCtx) {
    ctx = newCtx;
    syncUi();
  }

  function clearContext() {
    ctx = null;
    syncUi();
  }

  function initButtons() {
    var solBtn = document.getElementById("export-solutions-pdf");
    var histBtn = document.getElementById("export-history-csv");
    if (solBtn && !solBtn.dataset.bound) {
      solBtn.dataset.bound = "1";
      solBtn.addEventListener("click", exportSolutionsPdf);
    }
    if (histBtn && !histBtn.dataset.bound) {
      histBtn.dataset.bound = "1";
      histBtn.addEventListener("click", exportHistory);
    }
    syncUi();
  }

  function bindOptimizeResult(body) {
    if (!body) {
      clearContext();
      return;
    }
    setContext({
      motorType: getMotorType(),
      solutions: body.solutions || [],
      history: body.history || [],
      meta: {
        bur_target: body.bur_target,
        eps: body.eps,
        sort_mode: body.sort_mode,
        message: body.message || "",
        total_matches: body.total_matches,
        displayed_matches: body.displayed_matches,
      },
    });
  }

  window.OptExport = {
    setContext: setContext,
    clear: clearContext,
    bindOptimizeResult: bindOptimizeResult,
    getMotorType: getMotorType,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initButtons);
  } else {
    initButtons();
  }
})();
