/**
 * Proyecto: Dibujar sobre imagen fija con Canvas (Vanilla JS)
 * - Soporte: mouse + touch (Pointer Events)
 * - Historial para Undo: guarda "strokes" (trazos) con puntos NORMALIZADOS (0..1)
 *   para que al redimensionar se redibuje manteniendo proporción.
 * - Modo: Dibujar / Navegar (para poder scrollear sin rayar)
 */

(function () {
  const isDrawPage = !!document.getElementById("drawCanvas");
  if (!isDrawPage) return;

  // ====== DOM ======
  const canvas = document.getElementById("drawCanvas");
  const ctx = canvas.getContext("2d");

  const modeBtn = document.getElementById("modeBtn");
  const stage = document.getElementById("stage");
  const img = document.getElementById("baseImage");



  const downloadBtn = document.getElementById("downloadBtn");
  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");

  // ====== Estado ======
  let strokes = [];
  let currentStroke = null;
  let isDrawing = false;
  let activePointerId = null;

  let mode = "draw"; // "draw" | "pan"
  const DEFAULT_LINE_WIDTH = 2.5;
    const DEFAULT_COLOR = "#000000";

  // ====== Helpers ======  
  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  function getNormalizedPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function fitCanvasToImage() {
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;

    if (!displayW || !displayH) return;

    // Asegura tamaño CSS
    canvas.style.width = displayW + "px";
    canvas.style.height = displayH + "px";

    // Tamaño interno con DPR
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);

    // Dibujar en "pixeles CSS"
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redrawAll();
  }

  function drawStroke(stroke, w, h) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;

    ctx.beginPath();
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h);
    }
    ctx.stroke();
  }

  function redrawAll() {
    const w = img.clientWidth;
    const h = img.clientHeight;

    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokes) drawStroke(stroke, w, h);
  }

  function setUIState() {
   
    undoBtn.disabled = strokes.length === 0;
    clearBtn.disabled = strokes.length === 0;
  }

  // ====== Modo Navegar / Dibujar ======
  function setMode(nextMode) {
    mode = nextMode;
    const isPan = mode === "pan";

    modeBtn.textContent = isPan ? "🖐 Navegar" : "✍️ Dibujar";
    modeBtn.classList.toggle("is-pan", isPan);
    modeBtn.setAttribute("aria-pressed", String(!isPan));

    stage.classList.toggle("is-pan", isPan);

    // si cambian a navegar mientras dibujan, cortamos el trazo
    if (isPan && isDrawing) {
      isDrawing = false;
      currentStroke = null;
      try {
        if (activePointerId !== null) canvas.releasePointerCapture(activePointerId);
      } catch (_) {}
      activePointerId = null;
      redrawAll();
      setUIState();
    }
  }

  modeBtn.addEventListener("click", () => {
    setMode(mode === "draw" ? "pan" : "draw");
  });

  // ====== Dibujo ======
 function startDraw(e) {
  console.log("pointerdown", mode, e.pointerType);
  if (mode === "pan") return;
  if (activePointerId !== null) return;

  if (e.cancelable) e.preventDefault();

  activePointerId = e.pointerId;
  canvas.setPointerCapture(activePointerId);

  isDrawing = true; // ✅ FALTABA

  currentStroke = {
    color: DEFAULT_COLOR, // ✅ negro fijo
    size: DEFAULT_LINE_WIDTH,
    points: [getNormalizedPoint(e)]
  };

  redrawAll();
  drawStroke(currentStroke, img.clientWidth, img.clientHeight);
  setUIState();
}

  function moveDraw(e) {
    if (!isDrawing || e.pointerId !== activePointerId || !currentStroke) return;
    if (e.cancelable) e.preventDefault();

    currentStroke.points.push(getNormalizedPoint(e));

    redrawAll();
    drawStroke(currentStroke, img.clientWidth, img.clientHeight);
  }

  function endDraw(e) {
    if (e.pointerId !== activePointerId) return;

    if (isDrawing && currentStroke && currentStroke.points.length > 0) {
      strokes.push(currentStroke);
    }

    isDrawing = false;
    currentStroke = null;

    try {
      canvas.releasePointerCapture(activePointerId);
    } catch (_) {}
    activePointerId = null;

    redrawAll();
    setUIState();
  }

  // ====== Undo / Clear ======
  function undo() {
    if (strokes.length === 0) return;
    strokes.pop();
    redrawAll();
    setUIState();
  }

  function clearAll() {
    strokes = [];
    redrawAll();
    setUIState();
  }

  // ====== Download ======
  function downloadImage() {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    

    tempCanvas.width = naturalWidth;
    tempCanvas.height = naturalHeight;

    tempCtx.drawImage(img, 0, 0, naturalWidth, naturalHeight);

    const scaleX = naturalWidth / img.clientWidth;
    const scaleY = naturalHeight / img.clientHeight;
    const lineScale = Math.min(scaleX, scaleY);

    for (const stroke of strokes) {
      const pts = stroke.points;
      if (!pts.length) continue;

      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";
      tempCtx.strokeStyle = stroke.color;
      tempCtx.lineWidth = stroke.size * lineScale;

      tempCtx.beginPath();
      tempCtx.moveTo(pts[0].x * naturalWidth, pts[0].y * naturalHeight);
      for (let i = 1; i < pts.length; i++) {
        tempCtx.lineTo(pts[i].x * naturalWidth, pts[i].y * naturalHeight);
      }
      tempCtx.stroke();
    }

    const link = document.createElement("a");
    link.download = "imagen-editada.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  }

  // ====== Eventos ======
  img.addEventListener("load", () => {
  fitCanvasToImage();
  console.log("IMG loaded", img.clientWidth, img.clientHeight, canvas.width, canvas.height);
  setUIState();
});
  window.addEventListener("resize", fitCanvasToImage);

  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", moveDraw);
  canvas.addEventListener("pointerup", endDraw);
  canvas.addEventListener("pointercancel", endDraw);

  // UI
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearAll);
  
  downloadBtn.addEventListener("click", downloadImage);

  // Estado inicial
  setMode("draw");
  setUIState();

  // Si la imagen ya estaba cacheada
  if (img.complete) {
    fitCanvasToImage();
  }
})();