(function attachGlassCanvas(global) {
  const DEFAULT_PANEL = {
    blur: 22,
    distortion: 16,
    slices: 18,
    fillTop: "rgba(255, 255, 255, 0.22)",
    fillBottom: "rgba(255, 255, 255, 0.08)",
    specular: "rgba(255, 255, 255, 0.76)",
    warmth: "rgba(255, 209, 175, 0.18)",
    rim: "rgba(255, 255, 255, 0.42)",
    shadow: "rgba(241, 123, 101, 0.16)",
    shadowBlur: 28,
    shadowOffsetY: 12,
    alpha: 1,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    return canvas;
  }

  function resizeCanvas(canvas, width, height) {
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
  }

  function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function circlePath(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  function applyShapePath(ctx, shape) {
    if (!shape || !shape.type) {
      throw new Error("GlassCanvas shape is required");
    }

    if (shape.type === "roundedRect") {
      roundRectPath(ctx, shape.x, shape.y, shape.width, shape.height, shape.radius || 0);
      return;
    }

    if (shape.type === "circle") {
      circlePath(ctx, shape.cx, shape.cy, shape.r);
      return;
    }

    throw new Error(`Unsupported GlassCanvas shape: ${shape.type}`);
  }

  function getShapeBounds(shape) {
    if (shape.type === "roundedRect") {
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
      };
    }

    if (shape.type === "circle") {
      return {
        x: shape.cx - shape.r,
        y: shape.cy - shape.r,
        width: shape.r * 2,
        height: shape.r * 2,
      };
    }

    throw new Error(`Unsupported GlassCanvas shape: ${shape.type}`);
  }

  function drawDistortedBackdrop(ctx, sourceCanvas, bounds, panel) {
    const slices = Math.max(6, Math.round(panel.slices || DEFAULT_PANEL.slices));
    const distortion = Math.max(0, panel.distortion || 0);
    const sliceHeight = bounds.height / slices;

    ctx.save();
    ctx.globalAlpha = 0.32 * panel.alpha;

    for (let index = 0; index < slices; index += 1) {
      const y = bounds.y + sliceHeight * index;
      const wave = Math.sin((index / slices) * Math.PI * 2.8 + 0.6);
      const offsetX = wave * distortion * 0.26;
      const offsetY = Math.cos((index / slices) * Math.PI * 1.7) * distortion * 0.05;
      const sourceY = clamp(y + offsetY, 0, sourceCanvas.height - sliceHeight);

      ctx.drawImage(
        sourceCanvas,
        0,
        sourceY,
        sourceCanvas.width,
        sliceHeight,
        offsetX,
        y,
        sourceCanvas.width,
        sliceHeight
      );
    }

    ctx.restore();
  }

  function paintGlassPanel(ctx, sourceCanvas, panel) {
    const bounds = getShapeBounds(panel.shape);
    const merged = { ...DEFAULT_PANEL, ...panel };

    ctx.save();
    applyShapePath(ctx, merged.shape);
    ctx.shadowColor = merged.shadow;
    ctx.shadowBlur = merged.shadowBlur;
    ctx.shadowOffsetY = merged.shadowOffsetY;
    ctx.fillStyle = "rgba(255,255,255,0.001)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    applyShapePath(ctx, merged.shape);
    ctx.clip();

    ctx.save();
    ctx.filter = `blur(${merged.blur}px) saturate(1.22)`;
    ctx.globalAlpha = merged.alpha;
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    drawDistortedBackdrop(ctx, sourceCanvas, bounds, merged);

    const fillGradient = ctx.createLinearGradient(
      bounds.x,
      bounds.y,
      bounds.x,
      bounds.y + bounds.height
    );
    fillGradient.addColorStop(0, merged.fillTop);
    fillGradient.addColorStop(1, merged.fillBottom);
    ctx.fillStyle = fillGradient;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    const warmthGradient = ctx.createLinearGradient(
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height
    );
    warmthGradient.addColorStop(0, merged.warmth);
    warmthGradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = warmthGradient;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    const specular = ctx.createRadialGradient(
      bounds.x + bounds.width * 0.24,
      bounds.y + bounds.height * 0.2,
      0,
      bounds.x + bounds.width * 0.24,
      bounds.y + bounds.height * 0.2,
      Math.max(bounds.width, bounds.height) * 0.72
    );
    specular.addColorStop(0, merged.specular);
    specular.addColorStop(0.18, "rgba(255,255,255,0.22)");
    specular.addColorStop(0.48, "rgba(255,255,255,0)");
    ctx.fillStyle = specular;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.restore();

    ctx.save();
    applyShapePath(ctx, merged.shape);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = merged.rim;
    ctx.stroke();
    ctx.restore();
  }

  class GlassCanvasRenderer {
    constructor(canvas, scene = {}) {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("GlassCanvasRenderer requires a canvas element");
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.scene = scene;
      this.dpr = 1;
      this.pixelWidth = 1;
      this.pixelHeight = 1;
      this.buffer = createCanvas(1, 1);
      this.bufferCtx = this.buffer.getContext("2d");
    }

    setScene(scene) {
      this.scene = scene || {};
      return this;
    }

    resize(width, height, dpr = window.devicePixelRatio || 1) {
      const safeDpr = clamp(dpr, 1, 2);
      this.dpr = safeDpr;
      this.pixelWidth = Math.max(1, Math.round(width * safeDpr));
      this.pixelHeight = Math.max(1, Math.round(height * safeDpr));

      resizeCanvas(this.canvas, this.pixelWidth, this.pixelHeight);
      resizeCanvas(this.buffer, this.pixelWidth, this.pixelHeight);

      this.canvas.style.width = `${Math.round(width)}px`;
      this.canvas.style.height = `${Math.round(height)}px`;

      this.ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
      this.bufferCtx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
      return this;
    }

    clear(ctx, width, height) {
      ctx.clearRect(0, 0, width, height);
    }

    render() {
      const width = this.canvas.width / this.dpr;
      const height = this.canvas.height / this.dpr;
      if (!width || !height) return this;

      this.clear(this.bufferCtx, width, height);

      if (typeof this.scene.background === "function") {
        this.scene.background(this.bufferCtx, width, height);
      }

      if (Array.isArray(this.scene.underlays)) {
        this.scene.underlays.forEach((draw) => {
          if (typeof draw === "function") {
            draw(this.bufferCtx, width, height);
          }
        });
      }

      this.clear(this.ctx, width, height);
      this.ctx.drawImage(this.buffer, 0, 0, width, height);

      if (Array.isArray(this.scene.panels)) {
        this.scene.panels.forEach((panel) => {
          paintGlassPanel(this.ctx, this.buffer, panel);
        });
      }

      if (Array.isArray(this.scene.overlays)) {
        this.scene.overlays.forEach((draw) => {
          if (typeof draw === "function") {
            draw(this.ctx, width, height);
          }
        });
      }

      return this;
    }
  }

  function createRenderer(canvas, scene) {
    return new GlassCanvasRenderer(canvas, scene);
  }

  global.GlassCanvas = {
    GlassCanvasRenderer,
    createRenderer,
    roundedRect(x, y, width, height, radius) {
      return { type: "roundedRect", x, y, width, height, radius };
    },
    circle(cx, cy, r) {
      return { type: "circle", cx, cy, r };
    },
  };
})(window);
