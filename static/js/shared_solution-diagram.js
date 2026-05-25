(function () {
  "use strict";

  var DC_KEYS = ["DC_A", "DC_B", "DC_C", "DC_D", "DC_E"];
  var showBtn = null;
  var showHandler = null;

  function applySolution(solution) {
    if (!solution) return false;
    var calcForm = document.getElementById("calc-form");
    if (!calcForm) return false;

    var changed = false;
    for (var i = 0; i < DC_KEYS.length; i++) {
      var key = DC_KEYS[i];
      if (!(key in solution)) continue;
      var el = calcForm.elements[key];
      if (!el) continue;
      el.value = solution[key];
      changed = true;
    }
    if (!changed) return false;

    calcForm.dispatchEvent(new Event("input", { bubbles: true }));
    calcForm.dispatchEvent(new Event("change", { bubbles: true }));

    if (window.FormulaPanel && typeof FormulaPanel.refresh === "function") {
      FormulaPanel.refresh();
    }

    var panel = document.getElementById("formula-panel");
    if (panel) {
      var details = panel.querySelector(".formula-panel-details");
      if (details) details.open = true;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    return true;
  }

  function setShowVisible(visible) {
    if (showBtn) showBtn.hidden = !visible;
  }

  function registerShowHandler(fn) {
    showHandler = typeof fn === "function" ? fn : null;
  }

  function initButton() {
    showBtn = document.getElementById("detail-show-diagram");
    if (!showBtn || showBtn.dataset.bound) return;
    showBtn.dataset.bound = "1";
    showBtn.addEventListener("click", function () {
      if (showHandler) showHandler();
    });
  }

  window.SolutionDiagram = {
    apply: applySolution,
    setShowVisible: setShowVisible,
    registerShowHandler: registerShowHandler,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initButton);
  } else {
    initButton();
  }
})();
