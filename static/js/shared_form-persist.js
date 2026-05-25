(function () {
  "use strict";

  var STORAGE_PREFIX = "motor-geom-inputs-v1-type-";

  function getMotorType() {
    var bar = document.querySelector(".type-toolbar[data-motor-type]");
    if (bar) return String(bar.getAttribute("data-motor-type"));
    var panel = document.getElementById("formula-panel");
    if (panel) return String(panel.getAttribute("data-motor-type"));
    return "1";
  }

  function storageKey(type) {
    return STORAGE_PREFIX + type;
  }

  function getForms() {
    return {
      geometry: document.getElementById("geometry-form"),
      calc: document.getElementById("calc-form"),
      opt: document.getElementById("opt-form"),
    };
  }

  function snapshotForm(form) {
    var data = {};
    if (!form) return data;
    for (var i = 0; i < form.elements.length; i++) {
      var el = form.elements[i];
      if (!el.name || el.type === "submit") continue;
      if (el.type === "checkbox") data[el.name] = el.checked;
      else data[el.name] = el.value;
    }
    return data;
  }

  function applySnapshot(form, data) {
    if (!form || !data) return;
    for (var i = 0; i < form.elements.length; i++) {
      var el = form.elements[i];
      if (!el.name || !(el.name in data)) continue;
      if (el.type === "checkbox") el.checked = !!data[el.name];
      else el.value = data[el.name];
    }
  }

  function captureDefaults(forms) {
    return {
      geometry: snapshotForm(forms.geometry),
      calc: snapshotForm(forms.calc),
      opt: snapshotForm(forms.opt),
    };
  }

  function saveState(type, forms) {
    try {
      var payload = {
        geometry: snapshotForm(forms.geometry),
        calc: snapshotForm(forms.calc),
        opt: snapshotForm(forms.opt),
      };
      sessionStorage.setItem(storageKey(type), JSON.stringify(payload));
    } catch (_e) {
      /* quota / private mode */
    }
  }

  function loadState(type) {
    try {
      var raw = sessionStorage.getItem(storageKey(type));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_e2) {
      return null;
    }
  }

  function notifyFormsChanged(forms) {
    var list = [forms.geometry, forms.calc, forms.opt];
    for (var i = 0; i < list.length; i++) {
      if (list[i]) list[i].dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function initFormPersist() {
    var type = getMotorType();
    var forms = getForms();
    if (!forms.geometry) return;

    var defaults = captureDefaults(forms);
    var saved = loadState(type);
    if (saved) {
      applySnapshot(forms.geometry, saved.geometry);
      applySnapshot(forms.calc, saved.calc);
      applySnapshot(forms.opt, saved.opt);
      notifyFormsChanged(forms);
    }

    function persist() {
      saveState(type, forms);
    }

    var persistTimer = null;
    function persistDebounced() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(persist, 120);
    }

    [forms.geometry, forms.calc, forms.opt].forEach(function (form) {
      if (!form) return;
      form.addEventListener("input", persistDebounced);
      form.addEventListener("change", persist);
    });

    document.querySelectorAll(".motor-nav a").forEach(function (link) {
      link.addEventListener("click", persist);
    });

    window.addEventListener("pagehide", persist);

    var resetBtn = document.getElementById("reset-type-inputs");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        applySnapshot(forms.geometry, defaults.geometry);
        applySnapshot(forms.calc, defaults.calc);
        applySnapshot(forms.opt, defaults.opt);
        try {
          sessionStorage.removeItem(storageKey(type));
        } catch (_e3) {
          /* ignore */
        }
        notifyFormsChanged(forms);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFormPersist);
  } else {
    initFormPersist();
  }
})();
