/**
 * Proyecto: Dibujar sobre imagen fija con Canvas (Vanilla JS)
 * - Soporte: mouse + touch (Pointer Events)
 * - Historial para Undo: guarda "strokes" (trazos) con puntos NORMALIZADOS (0..1)
 *   para que al redimensionar se redibuje manteniendo proporción.
 */

(function () {
  // Detecta en qué página estamos
  const isDrawPage = !!document.getElementById("drawCanvas");
  if (!isDrawPage) return;

  // ====== DOM ======
  const canvas = document.getElementById("drawCanvas");
  const ctx = canvas.getContext("2d");
  const modeBtn = document.getElementById("modeBtn");
  const stage = document.getElementById("stage"); // si ya lo tienes por zoom, no lo repitas
  const img = document.getElementById("baseImage");
  const zoomRange = document.getElementById("zoomRange");
  const zoomValue = document.getElementById("zoomValue");
  const colorPicker = document.getElementById("colorPicker");
  const sizeRange = document.getElementById("sizeRange");
  const sizeValue = document.getElementById("sizeValue");
  const downloadBtn = document.getElementById("downloadBtn");
  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");

  // ====== Estado de dibujo ======
  let strokes = []; // historial de trazos: [{color, size, points:[{x,y}]}]
  let currentStroke = null;
  let isDrawing = false;
  let mode = "draw"; // "draw" | "pan"

  // Para Pointer Events: así evitamos dibujar con toques múltiples
  let activePointerId = null;

  // ====== Helpers ======

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  /**
   * Convierte la posición del pointer (mouse/touch) a coordenadas NORMALIZADAS (0..1)
   * respecto al canvas mostrado.
   */
  function getNormalizedPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  /**
   * Ajusta el tamaño real del canvas (sus pixeles internos) para que coincida
   * con el tamaño mostrado de la imagen (clientWidth/clientHeight).
   * Considera devicePixelRatio para evitar dibujo borroso.
   */
  function fitCanvasToImage() {
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    canvas.style.width = displayW + "px";
    canvas.style.height = displayH + "px";

    // En algunos momentos (antes de cargar imagen), puede ser 0
    if (!displayW || !displayH) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);

    // Importante: normalizamos el sistema de coordenadas
    // para dibujar en "pixeles CSS" (no en pixeles reales).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redrawAll();
  }

  /**
   * Redibuja TODO el historial en el canvas.
   * Como los puntos están normalizados (0..1), los escalamos
   * al tamaño actual del canvas en CSS: img.clientWidth/Height.
   */
  function redrawAll() {
    const w = img.clientWidth;
    const h = img.clientHeight;

    // Limpia solo el dibujo (el <img> queda intacto debajo)
    ctx.clearRect(0, 0, w, h);

    for (const stroke of strokes) {
      drawStroke(stroke, w, h);
    }
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
  function setMode(nextMode) {
  mode = nextMode;
  const isPan = mode === "pan";
  stage.classList.toggle("is-pan", isPan);
}
  function setUIState() {
    sizeValue.textContent = String(sizeRange.value);
    undoBtn.disabled = strokes.length === 0;
    clearBtn.disabled = strokes.length === 0;
  }
function setMode(nextMode) {
  mode = nextMode;

  const isPan = mode === "pan";

  // UI
  modeBtn.textContent = isPan ? "🖐 Navegar" : "✍️ Dibujar";
  modeBtn.classList.toggle("is-pan", isPan);
  modeBtn.setAttribute("aria-pressed", String(!isPan));

  // comportamiento: en pan, el canvas no recibe eventos
  stage.classList.toggle("is-pan", isPan);

  // si estaban dibujando y cambian de modo, cerramos el trazo
  if (isPan && isDrawing) {
    // forzamos cierre sin depender de un event real
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

// modo inicial
setMode("draw");

  // ====== Lógica de dibujo (Pointer Events) ======

  function startDraw(e) {
    // Solo si es el primer pointer activo
    
    if (mode === "pan") return;
    if (activePointerId !== null) return;

    activePointerId = e.pointerId;
    canvas.setPointerCapture(activePointerId);

    isDrawing = true;
    currentStroke = {
      color: colorPicker.value,
      size: Number(sizeRange.value),
      points: []
    };
   modeBtn.addEventListener("click", () => {
  setMode(mode === "draw" ? "pan" : "draw");
  });
    currentStroke.points.push(getNormalizedPoint(e));

    // Redibuja y pinta el inicio (feedback inmediato)
    redrawAll();
    drawStroke(currentStroke, img.clientWidth, img.clientHeight);
    setUIState();
  }

  function moveDraw(e) {
    if (!isDrawing || e.pointerId !== activePointerId || !currentStroke) return;

    currentStroke.points.push(getNormalizedPoint(e));

    // Para rendimiento: redibujamos historial + el stroke actual
    redrawAll();
    drawStroke(currentStroke, img.clientWidth, img.clientHeight);
  }

  function endDraw(e) {
    if (e.pointerId !== activePointerId) return;

    if (isDrawing && currentStroke && currentStroke.points.length > 0) {
      // Guardamos el trazo terminado en historial (para múltiples Undo)
      strokes.push(currentStroke);
    }

    isDrawing = false;
    currentStroke = null;

    // Liberamos pointer
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
  



// al iniciar

  function downloadImage() {
  // Crear canvas temporal con tamaño REAL de la imagen
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  tempCanvas.width = naturalWidth;
  tempCanvas.height = naturalHeight;

  // Dibujar imagen base
  tempCtx.drawImage(img, 0, 0, naturalWidth, naturalHeight);

  // Dibujar cada stroke escalado al tamaño real
  for (const stroke of strokes) {
    tempCtx.lineCap = "round";
    tempCtx.lineJoin = "round";
    tempCtx.strokeStyle = stroke.color;
    const scaleX = naturalWidth / img.clientWidth;
    const scaleY = naturalHeight / img.clientHeight;
    tempCtx.lineWidth = stroke.size * (naturalWidth / img.clientWidth); 

    const pts = stroke.points;
    if (!pts.length) continue;

    tempCtx.beginPath();
    tempCtx.moveTo(pts[0].x * naturalWidth, pts[0].y * naturalHeight);

    for (let i = 1; i < pts.length; i++) {
      tempCtx.lineTo(pts[i].x * naturalWidth, pts[i].y * naturalHeight);
    }

    tempCtx.stroke();
  }

  // Convertir a imagen descargable
  const link = document.createElement("a");
  link.download = "imagen-editada.png";
  link.href = tempCanvas.toDataURL("image/png");
  link.click();
}

  // ====== Eventos ======

  // Imagen: cuando termine de cargar (la tuya fija en assets)
  img.addEventListener("load", () => {
    fitCanvasToImage();
    setUIState();
  });

  // Mantener proporción correcta al cambiar tamaño de pantalla
  window.addEventListener("resize", fitCanvasToImage);

  // Pointer events: mouse + touch + stylus
  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", moveDraw);
  canvas.addEventListener("pointerup", endDraw);
  canvas.addEventListener("pointercancel", endDraw);
  canvas.addEventListener("pointerleave", (e) => {
    // si el usuario sale del canvas mientras dibuja, cerramos el trazo
    if (isDrawing) endDraw(e);
  });

  // UI
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearAll);
  sizeRange.addEventListener("input", () => setUIState());
  downloadBtn.addEventListener("click", downloadImage);

  // Estado inicial
  setUIState();

  // Si la imagen ya estaba cacheada y el evento "load" no dispara,
  // forzamos el ajuste al iniciar:
  if (img.complete) {
    fitCanvasToImage();
  }
})();    