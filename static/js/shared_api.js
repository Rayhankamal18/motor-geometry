const API = {
  async calculate(payload) {
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimize(payload) {
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeStream(payload, onProgress) {
    return API._consumeOptimizeStream("/api/optimize/stream", payload, onProgress);
  },

  async calculateType2(payload) {
    const res = await fetch("/api/type2/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeType2(payload) {
    const res = await fetch("/api/type2/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeType2Stream(payload, onProgress) {
    return API._consumeOptimizeStream("/api/type2/optimize/stream", payload, onProgress);
  },

  async calculateType3(payload) {
    const res = await fetch("/api/type3/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeType3(payload) {
    const res = await fetch("/api/type3/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeType3Stream(payload, onProgress) {
    return API._consumeOptimizeStream("/api/type3/optimize/stream", payload, onProgress);
  },

  async calculateType4(payload) {
    const res = await fetch("/api/type4/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeType4(payload) {
    const res = await fetch("/api/type4/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async optimizeType4Stream(payload, onProgress) {
    return API._consumeOptimizeStream("/api/type4/optimize/stream", payload, onProgress);
  },

  async _consumeOptimizeStream(url, payload, onProgress) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let err = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j.error) err = j.error;
      } catch (_) {
        /* ignore */
      }
      return { ok: false, error: err };
    }
    if (!res.body) {
      return { ok: false, error: "Streaming tidak didukung browser." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalBody = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.type === "progress" && onProgress) {
          onProgress(msg.percent, msg.evaluated, msg.total);
        } else if (msg.type === "done") {
          finalBody = msg;
        } else if (msg.type === "error") {
          return { ok: false, error: msg.error || "Optimasi gagal." };
        }
      }
    }

    if (buffer.trim()) {
      const msg = JSON.parse(buffer);
      if (msg.type === "done") finalBody = msg;
      if (msg.type === "error") return { ok: false, error: msg.error };
    }

    return finalBody || { ok: false, error: "Tidak ada respons dari server." };
  },
};
