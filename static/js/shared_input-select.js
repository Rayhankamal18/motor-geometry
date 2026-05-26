(function () {
  "use strict";

  var FORM_SELECTOR = "#geometry-form, #calc-form, #opt-form";
  var INPUT_SELECTOR = 'input[type="number"], input[type="text"]';

  function bindInput(el) {
    if (el.dataset.selectOnFocus === "1") return;
    el.dataset.selectOnFocus = "1";

    el.addEventListener("focus", function () {
      var input = this;
      requestAnimationFrame(function () {
        input.select();
      });
    });

    /* Klik: cegah kursor di tengah sehingga angka default (0) ikut terblok & tertimpa. */
    el.addEventListener("mouseup", function (e) {
      if (
        this.selectionStart === 0 &&
        this.selectionEnd === (this.value || "").length
      ) {
        return;
      }
      e.preventDefault();
      this.select();
    });
  }

  function bindForms(root) {
    var scope = root || document;
    scope.querySelectorAll(FORM_SELECTOR).forEach(function (form) {
      form.querySelectorAll(INPUT_SELECTOR).forEach(bindInput);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bindForms();
    });
  } else {
    bindForms();
  }

  window.InputSelectAll = { bindForms: bindForms };
})();
