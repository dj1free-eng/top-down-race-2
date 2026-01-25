(() => {
  const $ = (id) => document.getElementById(id);

  const imgInput = $("imgInput");
  const btnClear = $("btnClear");
  const btnUndo = $("btnUndo");
  const btnExport = $("btnExport");
  const btnImport = $("btnImport");
  const btnCopy = $("btnCopy");
  const txtJson = $("txtJson");
  const lblCount = $("lblCount");

  const canvas = $("c");
  const ctx = canvas.getContext("2d");

  const state = {
    img: null,
    imgW: 0,
    imgH: 0,
    points: [], // [[x,y],...], en coords de imagen (1:1)
    viewScale: 1, // escala para encajar la imagen en pantalla (solo visual)
  };

  function setCount() {
    lblCount.textContent = String(state.points.length);
  }

  function fitCanvasToImage() {
    if (!state.img) return;

    // Canvas interno = tamaño real de imagen para que coords sean 1:1 con el JSON
    canvas.width = state.imgW;
    canvas.height = state.imgH;

    // Visualmente lo encajamos en el ancho disponible (pero sin reescalar el buffer)
    // Para iPhone: usamos CSS transform via style.width/height
    const maxW = Math.min(window.innerWidth - 24, state.imgW);
    const scale = Math.min(1, maxW / state.imgW);
    state.viewScale = scale;

    canvas.style.width = `${Math.round(state.imgW * scale)}px`;
    canvas.style.height = `${Math.round(state.imgH * scale)}px`;

    redraw();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo
    if (state.img) {
      ctx.drawImage(state.img, 0, 0);
    } else {
      // placeholder
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, canvas.width || 800, canvas.height || 500);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "16px system-ui";
      ctx.fillText("Carga una imagen para empezar", 20, 40);
      return;
    }

    // Trazo del centerline
    if (state.points.length >= 2) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(state.points[0][0], state.points[0][1]);
      for (let i = 1; i < state.points.length; i++) {
        ctx.lineTo(state.points[i][0], state.points[i][1]);
      }
      ctx.stroke();
    }

    // Puntos
    for (let i = 0; i < state.points.length; i++) {
      const [x, y] = state.points[i];
      ctx.fillStyle = i === state.points.length - 1 ? "rgba(37,99,235,0.95)" : "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(String(i + 1), x + 10, y - 10);
    }
  }

  function canvasToImageCoords(clientX, clientY) {
    // Convertimos coords de pantalla -> coords reales de imagen (canvas buffer)
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (state.imgW / rect.width);
    const y = (clientY - rect.top) * (state.imgH / rect.height);
    return [x, y];
  }

  function addPoint(x, y) {
    if (!state.img) return;
    state.points.push([Math.round(x), Math.round(y)]);
    setCount();
    redraw();
  }

  // Eventos
  imgInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.imgW = img.naturalWidth;
      state.imgH = img.naturalHeight;
      state.points = [];
      txtJson.value = "";
      setCount();
      fitCanvasToImage();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  // Tap/click para añadir punto (pointer events para iOS)
  canvas.addEventListener("pointerdown", (ev) => {
    if (!state.img) return;
    const [x, y] = canvasToImageCoords(ev.clientX, ev.clientY);
    addPoint(x, y);
  });

  btnClear.addEventListener("click", () => {
    state.points = [];
    setCount();
    redraw();
  });

  btnUndo.addEventListener("click", () => {
    state.points.pop();
    setCount();
    redraw();
  });

  btnExport.addEventListener("click", () => {
    // JSON compatible con TrackBuilder: [[x,y],...]
    txtJson.value = JSON.stringify(state.points);
  });

  btnImport.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(txtJson.value || "[]");
      if (!Array.isArray(parsed)) throw new Error("JSON no es un array");
      const cleaned = parsed
        .map((p) => Array.isArray(p) ? p : (p && typeof p.x === "number" && typeof p.y === "number" ? [p.x, p.y] : null))
        .filter((p) => p && typeof p[0] === "number" && typeof p[1] === "number")
        .map((p) => [Math.round(p[0]), Math.round(p[1])]);

      state.points = cleaned;
      setCount();
      redraw();
    } catch (err) {
      alert("Import falló: " + (err && err.message ? err.message : String(err)));
    }
  });

  btnCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(txtJson.value || "");
      // feedback mínimo sin molestar
      btnCopy.textContent = "Copiado";
      setTimeout(() => (btnCopy.textContent = "Copiar"), 900);
    } catch {
      alert("No pude copiar. En iPhone a veces toca copiar a mano.");
    }
  });

  window.addEventListener("resize", () => {
    if (state.img) fitCanvasToImage();
  });

  // Placeholder inicial
  canvas.width = 800;
  canvas.height = 500;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  redraw();
})();
