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
    ["DC_C", "Panjang DC C (DC_C) (ft)"],
    ["DC_D", "Panjang DC D (DC_D) (ft)"],
    ["S1", "Clearance stabilizer 1 (S1) (in)"],
    ["S2", "Clearance stabilizer 2 (S2) (in)"],
    ["A", "Panjang section A (ft)"],
    ["B", "Panjang section B (ft)"],
    ["C", "Panjang section C (ft)"],
    ["D", "Panjang section D (ft)"],
    ["L1", "Panjang L1 = A (ft)"],
    ["L2", "Panjang L2 = B+C+D (ft)"],
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
      if (el.type === "checkbox") data[el.name] = el.checked;
      else if (el.type === "number") data[el.name] = parseFloat(el.value);
      else data[el.name] = el.value;
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

  function updateSolutionsNav() {
    if (!optListContext?.solutions?.length) {
      detailBar.hidden = true;
      if (headerBackBtn) headerBackBtn.hidden = true;
      return;
    }
    const { solutions, detailIndex } = optListContext;
    const total = solutions.length;
    const idx = detailIndex < 0 ? 0 : detailIndex;
    const inDetail = currentView === VIEW.optDetail;
    detailBar.hidden = !inDetail;
    if (headerBackBtn) headerBackBtn.hidden = !inDetail;
    detailLabel.textContent = inDetail
      ? `Detail solusi ${idx + 1} / ${total}`
      : `Solusi ${idx + 1} / ${total}`;
    detailPrevBtn.disabled = idx <= 0;
    detailNextBtn.disabled = idx >= total - 1;
    if (window.SolutionDiagram) SolutionDiagram.setShowVisible(inDetail);
  }

  function hideSolutionsNav() {
    detailBar.hidden = true;
    if (headerBackBtn) headerBackBtn.hidden = true;
    if (window.SolutionDiagram) SolutionDiagram.setShowVisible(false);
  }

  function selectSolutionIndex(index) {
    if (!optListContext) return;
    const max = optListContext.solutions.length - 1;
    optListContext.detailIndex = Math.max(0, Math.min(index, max));
    highlightSolutionRow(optListContext.detailIndex);
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
    if (optListContext.detailIndex >= 0) highlightSolutionRow(optListContext.detailIndex);
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
      const body = await API.calculateType3({
        ...geometry,
        DC_A: s.DC_A,
        DC_B: s.DC_B,
        DC_C: s.DC_C,
        DC_D: s.DC_D,
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
    calcResults.innerHTML = CALC_FIELDS.map(
      ([key, label]) =>
        `<div class="card"><div class="label">${label}</div><div class="value">${formatNum(result[key])}</div></div>`
    ).join("");
  }

  function renderCalcResult(result) {
    currentView = VIEW.calc;
    hideSolutionsNav();
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

  function updateScrollHint(count, totalFound) {
    if (!solutionsScrollHint) return;
    if (totalFound && totalFound > count) {
      solutionsScrollHint.hidden = false;
      solutionsScrollHint.textContent = `Menampilkan ${count} dari ${totalFound} solusi — scroll tabel.`;
    } else if (count > 10) {
      solutionsScrollHint.hidden = false;
      solutionsScrollHint.textContent = `${count} kombinasi — scroll tabel.`;
    } else if (count > 0) {
      solutionsScrollHint.hidden = false;
      solutionsScrollHint.textContent = `${count} kombinasi.`;
    } else {
      solutionsScrollHint.hidden = true;
    }
  }

  function renderSolutions(solutions, geometry, statusText, statusType, meta) {
    optListContext = { solutions, geometry, detailIndex: -1, statusText, statusType };
    currentView = VIEW.optList;
    calcResults.hidden = true;
    optResults.hidden = false;
    const showBalance = solutions.some((s) => s.balance_score != null);
    const thead = document.querySelector("#solutions-table thead tr");
    if (thead && window.OptTooltips) {
      thead.innerHTML = OptTooltips.solutionsHeadRow(3, showBalance);
    }
    const rows = solutions
      .map((s, i) => {
        const scoreCell =
          s.balance_score != null
            ? `<td>${formatNum(s.balance_score)}</td>`
            : "";
        return `<tr data-idx="${i}">
        <td>${i + 1}</td>
        <td>${formatNum(s.DC_A)}</td>
        <td>${formatNum(s.DC_B)}</td>
        <td>${formatNum(s.DC_C)}</td>
        <td>${formatNum(s.DC_D)}</td>
        <td>${formatNum(s.total)}</td>
        <td>${formatNum(s.BUR)}</td>
        <td>${formatNum(s.err)}</td>
        ${scoreCell}
        <td><button type="button" class="btn small" data-detail="${i}">Detail</button></td>
      </tr>`;
      })
      .join("");
    solutionsTable.innerHTML = rows;
    if (meta?.total_matches > solutions.length) {
      updateScrollHint(solutions.length, meta.total_matches);
    } else {
      updateScrollHint(solutions.length);
    }
    if (solutionsScroll) solutionsScroll.scrollTop = 0;
    if (solutions.length) selectSolutionIndex(0);
    else hideSolutionsNav();
  }

  if (!solutionsTable.dataset.bound) {
    solutionsTable.dataset.bound = "1";
    solutionsTable.addEventListener("click", (e) => {
      const detailBtn = e.target.closest("[data-detail]");
      if (detailBtn) {
        e.stopPropagation();
        showSolutionDetail(Number(detailBtn.dataset.detail));
        return;
      }
      const row = e.target.closest("tr[data-idx]");
      if (row) selectSolutionIndex(Number(row.dataset.idx));
    });
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
    const slice = history?.slice(0, 50) ?? [];
    if (!slice.length) {
      historyBlock.hidden = true;
      if (historyScrollHint) historyScrollHint.hidden = true;
      return;
    }
    historyTable.innerHTML = slice
      .map(
        (h) => `<tr>
        <td>${h.iter_idx}</td>
        <td>${formatNum(h.total_dc)}</td>
        <td>${h.quads_tested}</td>
        <td>${h.matches_found}</td>
        <td>${formatNum(h.best_err_this_iter)}</td>
        <td>${formatNum(h.best_err_so_far)}</td>
      </tr>`
      )
      .join("");
    historyBlock.hidden = false;
    updateHistoryScrollHint(slice.length);
    if (historyScroll) historyScroll.scrollTop = 0;
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      const isCalc = tab.dataset.tab === "calc";
      document.getElementById("panel-calc").hidden = !isCalc;
      document.getElementById("panel-opt").hidden = isCalc;
    });
  });

  if (headerBackBtn) headerBackBtn.addEventListener("click", () => showOptList());
  if (backToListBtn) backToListBtn.addEventListener("click", () => showOptList());

  detailPrevBtn.addEventListener("click", () => {
    if (!optListContext || optListContext.detailIndex <= 0) return;
    const prev = optListContext.detailIndex - 1;
    if (currentView === VIEW.optDetail) showSolutionDetail(prev);
    else selectSolutionIndex(prev);
  });

  detailNextBtn.addEventListener("click", () => {
    if (!optListContext) return;
    const next = optListContext.detailIndex + 1;
    if (next >= optListContext.solutions.length) return;
    if (currentView === VIEW.optDetail) showSolutionDetail(next);
    else selectSolutionIndex(next);
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
      const body = await API.calculateType3({ ...readGeometry(), ...readFormFields(calcForm) });
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
      const body = await API.optimizeType3Stream(
        {
          ...geometry,
          dp_list: parseDpList(fields.dp_list_text),
          bur_target: fields.bur_target,
          eps: fields.eps,
          max_iter: fields.max_iter,
          max_results: fields.max_results,
          sort_mode: fields.sort_mode,
          include_history: fields.include_history,
        },
        (percent, evaluated, total) => {
          ProgressUI.show(statusEl, percent, evaluated, total);
        }
      );
      if (!body.ok) {
        setStatus(body.error || "Optimasi gagal.", "error");
        if (window.OptExport) OptExport.clear();
        return;
      }
      optResults.hidden = false;
      showClear();
      optMessage.textContent = body.message || "";
      if (body.found && body.solutions?.length) {
        const total = body.total_matches ?? body.solutions.length;
        const statusText = `Ditemukan ${total} solusi (tampil ${body.solutions.length}).`;
        setStatus(statusText, "success");
        renderSolutions(body.solutions, geometry, statusText, "success", {
          total_matches: total,
        });
      } else if (body.approximate && body.solutions?.length) {
        const statusText = `Tidak ada solusi dalam ±${body.eps}; menampilkan terdekat ke ${body.bur_target}.`;
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
