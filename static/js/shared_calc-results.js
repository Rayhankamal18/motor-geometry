(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatNum(v) {
    if (typeof v !== "number" || Number.isNaN(v)) return String(v);
    return Number.isInteger(v) ? String(v) : v.toPrecision(6).replace(/\.?0+$/, "");
  }

  function formatBur(v) {
    if (typeof v !== "number" || !Number.isFinite(v)) return "—";
    return v.toFixed(4);
  }

  function renderHero(result) {
    var bur = result.BUR;
    var phi = result.Phi;
    var l1 = result.L1;
    var l2 = result.L2;
    var lSum =
      typeof l1 === "number" && typeof l2 === "number" && Number.isFinite(l1) && Number.isFinite(l2)
        ? l1 + l2
        : null;

    var metaParts = [];
    if (typeof phi === "number" && Number.isFinite(phi)) {
      metaParts.push('<span class="calc-hero-meta-item"><span class="calc-hero-meta-k">Φ</span> ' + escapeHtml(formatNum(phi)) + " deg</span>");
    }
    if (typeof l1 === "number" && Number.isFinite(l1)) {
      metaParts.push('<span class="calc-hero-meta-item"><span class="calc-hero-meta-k">L1</span> ' + escapeHtml(formatNum(l1)) + " ft</span>");
    }
    if (typeof l2 === "number" && Number.isFinite(l2)) {
      metaParts.push('<span class="calc-hero-meta-item"><span class="calc-hero-meta-k">L2</span> ' + escapeHtml(formatNum(l2)) + " ft</span>");
    }
    if (lSum != null) {
      metaParts.push(
        '<span class="calc-hero-meta-item"><span class="calc-hero-meta-k">L1+L2</span> ' + escapeHtml(formatNum(lSum)) + " ft</span>",
      );
    }

    return (
      '<div class="calc-hero" role="group" aria-label="Hasil utama BUR">' +
      '<p class="calc-hero-label">Build-Up Rate</p>' +
      '<p class="calc-hero-value">' +
      escapeHtml(formatBur(bur)) +
      "</p>" +
      '<p class="calc-hero-unit">deg/100 ft</p>' +
      (metaParts.length
        ? '<div class="calc-hero-meta">' + metaParts.join("") + "</div>"
        : "") +
      "</div>"
    );
  }

  function renderCards(result, fields) {
    var cards = fields
      .filter(function (row) {
        return row[0] !== "BUR";
      })
      .map(function (row) {
        var key = row[0];
        var label = row[1];
        return (
          '<div class="card"><div class="label">' +
          escapeHtml(label) +
          '</div><div class="value">' +
          escapeHtml(formatNum(result[key])) +
          "</div></div>"
        );
      })
      .join("");
    return '<div class="result-cards">' + cards + "</div>";
  }

  function render(container, result, fields) {
    if (!container || !result || !fields) return;
    container.innerHTML =
      '<div class="calc-results-layout">' + renderHero(result) + renderCards(result, fields) + "</div>";
  }

  window.CalcResults = {
    render: render,
    formatNum: formatNum,
    formatBur: formatBur,
  };
})();
