(function () {
  const geometryForm = document.getElementById("geometry-form");
  const calcForm = document.getElementById("calc-form");
  const optForm = document.getElementById("opt-form");
  const statusEl = document.getElementById("status");
  const calcResults = document.getElementById("calc-results");
  const optResults = document.getElementById("opt-results");
  const optMessage = document.getElementById("opt-message");
  const solutionsTable = document.querySelector("#solutions-table tbody");
  const solutionsScroll = document.getElementById("solutions-scroll");
  const solutionsScrollHint = document.getElementById("solutions-scroll-hint");
  const historyTable = document.querySelector("#history-table tbody");
  const historyBlock = document.getElementById("history-block");
  const historyScroll = document.getElementById("history-scroll");
  const historyScrollHint = document.getElementById("history-scroll-hint");
  const clearBtn = document.getElementById("clear-results");
  const detailBar = document.getElementById("detail-bar");
  const backToListBtn = document.getElementById("back-to-list");
  const headerBackBtn = document.getElementById("header-back");
  const detailPrevBtn = document.getElementById("detail-prev");
  const detailNextBtn = document.getElementById("detail-next");
  const detailLabel = document.getElementById("detail-label");

  let optListContext = null;

  const VIEW = { idle: "idle", calc: "calc", optList: "optList", optDetail: "optDetail" };
  let currentView = VIEW.idle;

  const CALC_FIELDS = [
    ["DC_A", "Panjang DC A (DC_A) (ft)"],
    ["DC_B", "Panjang DC B (DC_B) (ft)"],
    ["S1", "Clearance stabilizer 1 (S1) (in)"],
    ["S2", "Clearance stabilizer 2 (S2) (in)"],
    ["L1", "Panjang L1 = A (ft)"],
    ["L2", "Panjang L2 = B (ft)"],
    ["Bprime", "Sudut B′ (deg)"],
    ["B1", "Sudut B1 (deg)"],
    ["B2", "Sudut B2 (deg)"],
    ["Phi", "Sudut Φ (deg)"],
    ["BUR", "BUR (deg/100 ft)"],
  ];

  function readGeometry() {
    const data = {};
    for (const el of geometryForm.elements) {
      if (el.name) data[el.name] = parseFloat(el.value);
    }
    return data;
  }

  function readFormFields(form) {
    const data = {};
    for (const el of form.elements) {
      if (!el.name || el.type === "submit") continue;
      if (el.type === "checkbox") {
        data[el.name] = el.checked;
      } else if (el.type === "number") {
        data[el.name] = parseFloat(el.value);
      } else {
        data[el.name] = el.value;
      }
    }
    return data;
  }

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
  }

  function hideAllResults() {
    calcResults.hidden = true;
    optResults.hidden = true;
    historyBlock.hidden = true;
    hideSolutionsNav();
    clearBtn.hidden = true;
    if (solutionsScrollHint) solutionsScrollHint.hidden = true;
    if (historyScrollHint) historyScrollHint.hidden = true;
    optListContext = null;
    currentView = VIEW.idle;
    if (window.OptExport) OptExport.clear();
  }

  function enterCalculatorTab() {
    hideSolutionsNav();
    optResults.hidden = true;
    if (solutionsScrollHint) solutionsScrollHint.hidden = true;
    if (currentView === VIEW.optDetail || currentView === VIEW.optList) {
      calcResults.hidden = true;
    }
  }

  function enterOptimizerTab() {
    if (optListContext) showOptList();
  }

  function updateSolutionsNav() {
    if (
      currentView === VIEW.calc ||
      currentView === VIEW.idle ||
      !optListContext?.solutions?.length
    ) {
      hideSolutionsNav();
      return;
    }

    const { solutions, detailIndex } = optListContext;
    const total = solutions.length;
    const idx = detailIndex < 0 ? 0 : detailIndex;

    const inDetail = currentView === VIEW.optDetail;
    detailBar.hidden = !inDetail;
    backToListBtn.hidden = true;
    if (headerBackBtn) headerBackBtn.hidden = !inDetail;

    if (inDetail) {
      detailLabel.textContent = `Detail solusi ${idx + 1} / ${total}`;
    } else {
      detailLabel.textContent = `Solusi ${idx + 1} / ${total}`;
    }

    detailPrevBtn.disabled = idx <= 0;
    detailNextBtn.disabled = idx >= total - 1;
    if (window.SolutionDiagram) SolutionDiagram.setShowVisible(inDetail);
  }

  function hideSolutionsNav() {
    detailBar.hidden = true;
    backToListBtn.hidden = true;
    if (headerBackBtn) headerBackBtn.hidden = true;
    if (window.SolutionDiagram) SolutionDiagram.setShowVisible(false);
  }

  function selectSolutionIndex(index, { scroll = true } = {}) {
    if (!optListContext) return;
    const max = optListContext.solutions.length - 1;
    const idx = Math.max(0, Math.min(index, max));
    optListContext.detailIndex = idx;
    highlightSolutionRow(idx);
    updateSolutionsNav();
  }

  function showOptList() {
    if (!optListContext) return;
    currentView = VIEW.optList;
    calcResults.hidden = true;
    optResults.hidden = false;
    setStatus(optListContext.statusText, optListContext.statusType);
    if (optListContext.detailIndex < 0 && optListContext.solutions.length) {
      optListContext.detailIndex = 0;
    }
    if (optListContext.detailIndex >= 0) {
      highlightSolutionRow(optListContext.detailIndex);
    }
    updateSolutionsNav();
  }

  async function showSolutionDetail(index) {
    if (!optListContext) return;
    const { solutions, geometry } = optListContext;
    const s = solutions[index];
    if (!s) return;

    currentView = VIEW.optDetail;
    optListContext.detailIndex = index;
    setStatus("Memuat detail solusi…", "loading");

    try {
      const body = await API.calculate({
        ...geometry,
        DC_A: s.DC_A,
        DC_B: s.DC_B,
      });
      if (!body.ok) {
        setStatus(body.error || "Gagal memuat detail.", "error");
        return;
      }
      setStatus(`Detail solusi #${index + 1} dari ${solutions.length}`, "success");
      updateSolutionsNav();
      highlightSolutionRow(index);
      calcResults.hidden = false;
      optResults.hidden = true;
      renderCalcCards(body.result);
      showClear();
    } catch (err) {
      setStatus(err.message || "Kesalahan jaringan.", "error");
    }
  }

  function showClear() {
    clearBtn.hidden = false;
  }

  function formatNum(v) {
    if (typeof v !== "number" || Number.isNaN(v)) return String(v);
    return Number.isInteger(v) ? String(v) : v.toPrecision(6).replace(/\.?0+$/, "");
  }

  function renderCalcCards(result) {
    if (window.CalcResults) {
      CalcResults.render(calcResults, result, CALC_FIELDS);
      return;
    }
    calcResults.innerHTML = CALC_FIELDS.map(
      ([key, label]) =>
        `<div class="card"><div class="label">${label}</div><div class="value">${formatNum(result[key])}</div></div>`
    ).join("");
  }

  function renderCalcResult(result) {
    currentView = VIEW.calc;
    hideSolutionsNav();
    historyBlock.hidden = true;
    if (historyScrollHint) historyScrollHint.hidden = true;
    renderCalcCards(result);
    calcResults.hidden = false;
    optResults.hidden = true;
    showClear();
  }

  function parseDpList(text) {
    return text
      .replace(/;/g, ",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const v = parseFloat(s);
        if (Number.isNaN(v) || v <= 0) throw new Error(`DP tidak valid: ${s}`);
        return v;
      });
  }

  function highlightSolutionRow(index) {
    solutionsTable.querySelectorAll("tr").forEach((tr, i) => {
      tr.classList.toggle("row-active", i === index);
    });
    const active = solutionsTable.querySelector("tr.row-active");
    if (active && solutionsScroll) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function updateScrollHint(count) {
    if (!solutionsScrollHint) return;
    if (count > 10) {
      solutionsScrollHint.hidden = false;
      solutionsScrollHint.textContent =
        `${count} kombinasi — tampil ~10 baris, scroll ke bawah untuk melihat sisanya.`;
    } else if (count > 0) {
      solutionsScrollHint.hidden = false;
      solutionsScrollHint.textContent = `${count} kombinasi.`;
    } else {
      solutionsScrollHint.hidden = true;
    }
  }

  function renderSolutions(solutions, geometry, statusText, statusType) {
    optListContext = {
      solutions,
      geometry,
      detailIndex: -1,
      statusText,
      statusType,
    };
    currentView = VIEW.optList;

    calcResults.hidden = true;
    optResults.hidden = false;

    solutionsTable.innerHTML = "";
    const showBalance = solutions.some((s) => s.balance_score != null);
    const thead = document.querySelector("#solutions-table thead tr");
    if (thead && window.OptTooltips) {
      thead.innerHTML = OptTooltips.solutionsHeadRow(1, showBalance);
    }
    solutions.forEach((s, i) => {
      const tr = document.createElement("tr");
      tr.dataset.index = String(i);
      const scoreCell =
        s.balance_score != null
          ? `<td>${formatNum(s.balance_score)}</td>`
          : "";
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${formatNum(s.DC_A)}</td>
        <td>${formatNum(s.DC_B)}</td>
        <td>${formatNum(s.total)}</td>
        <td>${formatNum(s.BUR)}</td>
        <td>${formatNum(s.err)}</td>
        ${scoreCell}
        <td><button type="button" class="btn small" data-detail="${i}">Detail</button></td>
      `;
      tr.addEventListener("click", (e) => {
        if (e.target.closest("[data-detail]")) return;
        selectSolutionIndex(i);
      });
      tr.querySelector("[data-detail]").addEventListener("click", (e) => {
        e.stopPropagation();
        showSolutionDetail(i);
      });
      solutionsTable.appendChild(tr);
    });
    updateScrollHint(solutions.length);
    if (solutionsScroll) solutionsScroll.scrollTop = 0;
    if (solutions.length) {
      selectSolutionIndex(0);
    } else {
      hideSolutionsNav();
    }
  }

  function updateHistoryScrollHint(count) {
    if (!historyScrollHint) return;
    if (count > 10) {
      historyScrollHint.hidden = false;
      historyScrollHint.textContent =
        `${count} iterasi — tampil ~10 baris, scroll ke bawah untuk melihat sisanya.`;
    } else if (count > 0) {
      historyScrollHint.hidden = false;
      historyScrollHint.textContent = `${count} iterasi.`;
    } else {
      historyScrollHint.hidden = true;
    }
  }

  function renderHistory(history) {
    historyTable.innerHTML = "";
    if (!history || !history.length) {
      historyBlock.hidden = true;
      if (historyScrollHint) historyScrollHint.hidden = true;
      return;
    }
    history.forEach((h) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${h.iter_idx}</td>
        <td>${formatNum(h.total_dc)}</td>
        <td>${h.pairs_tested}</td>
        <td>${h.matches_found}</td>
        <td>${formatNum(h.best_err_this_iter)}</td>
        <td>${formatNum(h.best_err_so_far)}</td>
        <td>${h.heap_size}</td>
      `;
      historyTable.appendChild(tr);
    });
    historyBlock.hidden = false;
    updateHistoryScrollHint(history.length);
    if (historyScroll) historyScroll.scrollTop = 0;
  }

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      const isCalc = tab.dataset.tab === "calc";
      document.getElementById("panel-calc").hidden = !isCalc;
      document.getElementById("panel-opt").hidden = isCalc;
      if (isCalc) enterCalculatorTab();
      else enterOptimizerTab();
    });
  });

  function goBackToSolutionList() {
    showOptList();
  }

  backToListBtn.addEventListener("click", goBackToSolutionList);
  if (headerBackBtn) headerBackBtn.addEventListener("click", goBackToSolutionList);

  detailPrevBtn.addEventListener("click", () => {
    if (!optListContext || optListContext.detailIndex <= 0) return;
    const prev = optListContext.detailIndex - 1;
    if (currentView === VIEW.optDetail) {
      showSolutionDetail(prev);
    } else {
      selectSolutionIndex(prev);
    }
  });

  detailNextBtn.addEventListener("click", () => {
    if (!optListContext) return;
    const next = optListContext.detailIndex + 1;
    if (next >= optListContext.solutions.length) return;
    if (currentView === VIEW.optDetail) {
      showSolutionDetail(next);
    } else {
      selectSolutionIndex(next);
    }
  });

  clearBtn.addEventListener("click", () => {
    hideAllResults();
    setStatus("Isi parameter lalu jalankan kalkulator atau optimizer.", "info");
  });

  calcForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = calcForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus("Menghitung…", "loading");
    try {
      const payload = { ...readGeometry(), ...readFormFields(calcForm) };
      const body = await API.calculate(payload);
      if (!body.ok) {
        setStatus(body.error || "Perhitungan gagal.", "error");
        return;
      }
      setStatus("Perhitungan selesai.", "success");
      renderCalcResult(body.result);
    } catch (err) {
      setStatus(err.message || "Kesalahan jaringan.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  optForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = optForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    ProgressUI.show(statusEl, 0, 0, 0);
    calcResults.hidden = true;
    hideSolutionsNav();
    optListContext = null;
    try {
      const fields = readFormFields(optForm);
      const geometry = readGeometry();
      const dp_list = parseDpList(fields.dp_list_text);
      const payload = {
        ...geometry,
        dp_list,
        bur_target: fields.bur_target,
        eps: fields.eps,
        max_iter: fields.max_iter,
        sort_mode: fields.sort_mode,
        include_history: fields.include_history,
      };
      const body = await API.optimizeStream(payload, (percent, evaluated, total) => {
        ProgressUI.show(statusEl, percent, evaluated, total);
      });
      if (!body.ok) {
        setStatus(body.error || "Optimasi gagal.", "error");
        if (window.OptExport) OptExport.clear();
        return;
      }
      optResults.hidden = false;
      showClear();
      optMessage.textContent = body.message || "";
      if (body.found && body.solutions?.length) {
        const statusText = `Ditemukan ${body.total_matches} solusi — scroll tabel untuk melihat semua.`;
        setStatus(statusText, "success");
        renderSolutions(body.solutions, geometry, statusText, "success");
      } else if (body.approximate && body.solutions?.length) {
        const statusText =
          `Tidak ada solusi dalam toleransi ±${body.eps}. ` +
          `Menampilkan BUR terdekat ke target (${body.bur_target}).`;
        setStatus(statusText, "warn");
        renderSolutions(body.solutions, geometry, statusText, "warn");
      } else {
        setStatus(body.message || "Tidak ada solusi.", "error");
        solutionsTable.innerHTML = "";
      }
      renderHistory(body.history);
      if (window.OptExport) {
        OptExport.bindOptimizeResult(body);
      }
    } catch (err) {
      setStatus(err.message || "Kesalahan jaringan.", "error");
      if (window.OptExport) OptExport.clear();
    } finally {
      btn.disabled = false;
    }
  });

  if (window.SolutionDiagram) {
    SolutionDiagram.registerShowHandler(() => {
      if (!optListContext || currentView !== VIEW.optDetail) return;
      const idx = optListContext.detailIndex;
      const s = optListContext.solutions[idx];
      if (!s) return;
      if (SolutionDiagram.apply(s)) {
        setStatus(`Solusi #${idx + 1} diterapkan ke diagram & rumus section.`, "success");
      }
    });
  }
})();
