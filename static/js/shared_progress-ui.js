/** Progress bar untuk optimasi (dipakai Tipe 1 & 2). */
const ProgressUI = {
  show(statusEl, percent, evaluated, total) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    const detail =
      total > 0
        ? `${evaluated.toLocaleString()} / ${total.toLocaleString()} kombinasi`
        : "";
    statusEl.className = "status loading";
    statusEl.innerHTML = `
      <div class="opt-progress">
        <div class="opt-progress-head">
          <span class="opt-progress-title">Mengoptimasi…</span>
          <span class="opt-progress-pct">${pct}%</span>
        </div>
        <div class="opt-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <div class="opt-progress-fill" style="width:${pct}%"></div>
        </div>
        ${detail ? `<div class="opt-progress-detail">${detail}</div>` : ""}
      </div>
    `;
  },

  reset(statusEl, text, type) {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
  },
};
