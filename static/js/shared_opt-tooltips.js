(function () {
  "use strict";

  var FIELD_TIPS = {
    dp_list_text:
      "Daftar panjang drill collar yang tersedia (ft), pisahkan dengan koma. Optimizer memilih kombinasi subset yang valid untuk tiap section DC.",
    bur_target:
      "BUR (build-up rate) yang ingin dicapai, dalam deg/100 ft. Digunakan sebagai acuan perhitungan error pada setiap solusi.",
    eps:
      "Toleransi maksimum |BUR_hasil − BUR_target| (deg/100 ft). Solusi dengan error ≤ ε dianggap memenuhi target BUR.",
    max_iter:
      "Batas jumlah kombinasi yang dievaluasi. Nilai 0 = tanpa batas praktis (optimasi bisa lebih lama, terutama tipe 3–4).",
    max_results:
      "Batas baris solusi terbaik ke browser. 0 = default 280; maks. 350. Optimizer tetap menyimpan variasi (termasuk semua DC > 0) di server.",
    sort_mode:
      "Cara mengurutkan: (1) selisih BUR terkecil di atas, (2) total DC terpendek di atas, (3) skor kompromi terkecil di atas (lihat kolom Skor).",
    include_history:
      "Menyertakan log per iterasi optimasi (jumlah pasangan diuji, error terbaik, dll.) untuk analisis atau dokumentasi.",
  };

  var SORT_OPTION_TIPS = {
    1: "Solusi diurutkan berdasarkan error BUR terkecil. Total DC hanya memutus jika error sama.",
    2: "Solusi diurutkan berdasarkan total panjang DC terpendek. Error BUR hanya memutus jika total sama.",
    3: "Urut berdasarkan skor kompromi terkecil di atas. Kolom Skor muncul; nilainya menurun dari baris 1 ke bawah.",
  };

  var COL = {
    num: "Urutan baris di tabel (bukan peringkat mutlak di seluruh ruang solusi).",
    dc: "Panjang drill collar pada section tersebut (ft).",
    total: "Jumlah semua panjang DC pada kombinasi solusi ini (ft).",
    bur: "Build-up rate hasil perhitungan geometri motor (deg/100 ft).",
    err: "Error terhadap target: |BUR_hasil − BUR_target|. Semakin kecil semakin dekat target.",
    score:
      "Hanya mode urut rekomendasi seimbang. Skor = kompromi selisih BUR + total DC (dinormalisasi ke seluruh solusi). Tabel diurut dari skor terkecil (atas) ke terbesar. Semakin kecil semakin baik.",
    action: "",
  };

  var DC_KEYS = {
    1: ["A", "B"],
    2: ["A", "B", "C"],
    3: ["A", "B", "C", "D"],
    4: ["A", "B", "C", "D", "E"],
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tipHtml(text) {
    if (!text) return "";
    var t = escapeHtml(text);
    return (
      '<span class="field-tip" tabindex="0">' +
      '<span class="field-tip-btn" aria-hidden="true">?</span>' +
      '<span class="field-tip-text" role="tooltip">' +
      t +
      "</span></span>"
    );
  }

  function th(label, tipText) {
    if (!tipText) return "<th>" + escapeHtml(label) + "</th>";
    return (
      '<th class="th-with-tip"><span class="th-label">' +
      escapeHtml(label) +
      "</span>" +
      tipHtml(tipText) +
      "</th>"
    );
  }

  function solutionsHeadRow(motorType, showBalance) {
    var keys = DC_KEYS[motorType] || DC_KEYS[1];
    var out = th("#", COL.num);
    for (var i = 0; i < keys.length; i++) {
      out += th("DC_" + keys[i] + " (ft)", COL.dc);
    }
    out += th("Total DC (ft)", COL.total);
    out += th("BUR (deg/100 ft)", COL.bur);
    out += th("Selisih BUR", COL.err);
    if (showBalance) out += th("Skor", COL.score);
    out += "<th></th>";
    return out;
  }

  function enhanceOptForm() {
    var form = document.getElementById("opt-form");
    if (!form) return;

    if (!form.querySelector(".opt-tip-banner")) {
      var banner = document.createElement("p");
      banner.className = "opt-tip-banner";
      banner.textContent =
        "Arahkan kursor ke ikon ? pada label untuk penjelasan singkat parameter optimizer.";
      form.insertBefore(banner, form.firstChild);
    }

    var labels = form.querySelectorAll("label");
    for (var li = 0; li < labels.length; li++) {
      var label = labels[li];
      var field = label.querySelector("input[name], select[name], textarea[name]");
      if (!field || !field.name || !FIELD_TIPS[field.name]) continue;
      var span = label.querySelector("span");
      if (!span || span.querySelector(".field-tip")) continue;
      span.insertAdjacentHTML("beforeend", tipHtml(FIELD_TIPS[field.name]));
    }

    var sortSelect = form.querySelector('select[name="sort_mode"]');
    if (sortSelect && !sortSelect.dataset.tipsBound) {
      sortSelect.dataset.tipsBound = "1";
      for (var oi = 0; oi < sortSelect.options.length; oi++) {
        var opt = sortSelect.options[oi];
        if (SORT_OPTION_TIPS[opt.value]) {
          opt.title = SORT_OPTION_TIPS[opt.value];
        }
      }
    }
  }

  var activeTableTip = null;

  function getFloatTipEl() {
    var el = document.getElementById("opt-tip-float");
    if (!el) {
      el = document.createElement("div");
      el.id = "opt-tip-float";
      el.className = "field-tip-float";
      el.setAttribute("role", "tooltip");
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }

  function hideFloatTip() {
    var el = document.getElementById("opt-tip-float");
    if (el) el.hidden = true;
    activeTableTip = null;
  }

  function showFloatTip(tip) {
    var textEl = tip.querySelector(".field-tip-text");
    if (!textEl) return;
    var floatEl = getFloatTipEl();
    floatEl.textContent = textEl.textContent;
    floatEl.hidden = false;
    floatEl.style.visibility = "hidden";
    floatEl.style.left = "0";
    floatEl.style.top = "0";

    var rect = tip.getBoundingClientRect();
    var margin = 10;
    var w = floatEl.offsetWidth;
    var h = floatEl.offsetHeight;
    var left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    var top = rect.bottom + 8;
    if (top + h > window.innerHeight - margin) {
      top = rect.top - h - 8;
    }
    top = Math.max(margin, top);

    floatEl.style.left = left + "px";
    floatEl.style.top = top + "px";
    floatEl.style.visibility = "visible";
    activeTableTip = tip;
  }

  function bindTableFloatTips() {
    if (document.body.dataset.optTableTipsBound) return;
    document.body.dataset.optTableTipsBound = "1";

    document.addEventListener(
      "mouseover",
      function (e) {
        var tip = e.target.closest(".data-table .field-tip");
        if (!tip) return;
        if (tip !== activeTableTip) showFloatTip(tip);
      },
      true,
    );

    document.addEventListener(
      "mouseout",
      function (e) {
        var tip = e.target.closest(".data-table .field-tip");
        if (!tip) return;
        var rel = e.relatedTarget;
        if (rel && tip.contains(rel)) return;
        hideFloatTip();
      },
      true,
    );

    document.addEventListener(
      "focusin",
      function (e) {
        var tip = e.target.closest(".data-table .field-tip");
        if (tip) showFloatTip(tip);
      },
      true,
    );

    document.addEventListener(
      "focusout",
      function (e) {
        var tip = e.target.closest(".data-table .field-tip");
        if (!tip) return;
        var rel = e.relatedTarget;
        if (rel && tip.contains(rel)) return;
        hideFloatTip();
      },
      true,
    );

    document.addEventListener("scroll", hideFloatTip, true);
    window.addEventListener("resize", hideFloatTip);
  }

  function init() {
    enhanceOptForm();
    bindTableFloatTips();
  }

  window.OptTooltips = {
    th: th,
    tipHtml: tipHtml,
    solutionsHeadRow: solutionsHeadRow,
    enhanceOptForm: enhanceOptForm,
    COL: COL,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
