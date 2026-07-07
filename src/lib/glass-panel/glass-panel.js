const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

let filterIdCounter = 0;

function getGlassPanels(root = document) {
  return Array.from(root.querySelectorAll("[data-glass-panel]"));
}

function supportsBackdropFilterUrl() {
  const probe = document.createElement("div");
  probe.style.backdropFilter = "url(#test-filter)";
  probe.style.webkitBackdropFilter = "url(#test-filter)";
  return /url\(#test-filter\)/.test(
    `${probe.style.backdropFilter} ${probe.style.webkitBackdropFilter}`
  );
}

function ensureGlassSvgHost() {
  let host = document.querySelector("#glass-filter-host");
  if (host) return host;

  host = document.createElementNS(SVG_NS, "svg");
  host.setAttribute("id", "glass-filter-host");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("width", "1");
  host.setAttribute("height", "1");
  host.setAttribute(
    "style",
    "position:fixed;left:-999px;top:-999px;width:1px;height:1px;overflow:hidden;pointer-events:none;"
  );
  const defs = document.createElementNS(SVG_NS, "defs");
  host.appendChild(defs);
  document.body.appendChild(host);
  return host;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRectSdf(x, y, width, height, radius) {
  const qx = Math.abs(x - width / 2) - (width / 2 - radius);
  const qy = Math.abs(y - height / 2) - (height / 2 - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

function getPanelMetrics(panel) {
  const rect = panel.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || panel.offsetWidth || 128));
  const height = Math.max(1, Math.round(rect.height || panel.offsetHeight || 128));
  const styles = getComputedStyle(panel);
  const radius = parseFloat(styles.borderTopLeftRadius) || Math.min(width, height) * 0.28;

  return { width, height, radius };
}

function generateRefractionMap(panel) {
  const metrics = getPanelMetrics(panel);
  const maxMapSide = Number(panel.dataset.glassMapSize || 320);
  const mapScale = Math.min(1, maxMapSide / Math.max(metrics.width, metrics.height));
  const width = Math.max(24, Math.round(metrics.width * mapScale));
  const height = Math.max(24, Math.round(metrics.height * mapScale));
  const radius = clamp(metrics.radius * mapScale, 0, Math.min(width, height) / 2);
  const bezelRatio = Number(panel.dataset.glassBezel || 0.19);
  const bezel = clamp(Math.min(width, height) * bezelRatio, 2, Math.min(width, height) / 2);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;

  if (!ctx) {
    return null;
  }

  const image = ctx.createImageData(width, height);
  const data = image.data;
  const finiteStep = 1.4;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sdf = roundedRectSdf(x + 0.5, y + 0.5, width, height, radius);
      const dxSdf =
        roundedRectSdf(x + finiteStep, y, width, height, radius) -
        roundedRectSdf(x - finiteStep, y, width, height, radius);
      const dySdf =
        roundedRectSdf(x, y + finiteStep, width, height, radius) -
        roundedRectSdf(x, y - finiteStep, width, height, radius);
      const normalLength = Math.hypot(dxSdf, dySdf) || 1;
      const nx = dxSdf / normalLength;
      const ny = dySdf / normalLength;
      const distanceFromBorder = clamp(-sdf, 0, bezel);
      const distanceRatio = clamp(distanceFromBorder / bezel, 0, 1);
      const surfaceDerivative = Math.pow(1 - distanceRatio, 3);
      const lens = sdf <= 0 && distanceRatio < 1 ? surfaceDerivative : 0;
      const encodedX = clamp(128 - nx * lens * 127, 0, 255);
      const encodedY = clamp(128 - ny * lens * 127, 0, 255);
      const offset = (y * width + x) * 4;

      data[offset] = encodedX;
      data[offset + 1] = encodedY;
      data[offset + 2] = 128;
      data[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function setImageHref(image, href) {
  image.setAttribute("href", href);
  image.setAttributeNS(XLINK_NS, "href", href);
}

function updateGlassFilter(panel, options) {
  const opts = options || {};
  const filterId = panel.dataset.glassFilterId;
  if (!filterId) return;

  const filter = document.querySelector(`#glass-filter-host #${CSS.escape(filterId)}`);
  if (!filter) return;

  const map = filter.querySelector("feImage");
  const displacement = filter.querySelector("feDisplacementMap");
  const mapUrl = generateRefractionMap(panel);
  const metrics = getPanelMetrics(panel);

  filter.setAttribute("filterUnits", "objectBoundingBox");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  filter.setAttribute("x", "-0.5");
  filter.setAttribute("y", "-0.5");
  filter.setAttribute("width", "2");
  filter.setAttribute("height", "2");

  if (map && mapUrl) {
    map.setAttribute("x", "0");
    map.setAttribute("y", "0");
    map.setAttribute("width", String(metrics.width));
    map.setAttribute("height", String(metrics.height));
    setImageHref(map, mapUrl);
    panel.dataset.glassMapUrl = mapUrl;
  }
  if (displacement) {
    const distortion = Number(panel.dataset.glassDistortion || 55);
    displacement.setAttribute("scale", `${Math.max(0, distortion)}`);
  }

  const burn = Math.max(0, Math.min(2, Number(panel.dataset.glassBurn || 0)));
  const saturate = filter.querySelector('feColorMatrix[data-role="burn-saturate"]');
  const componentTransfer = filter.querySelector('feComponentTransfer[data-role="burn-gamma"]');
  if (saturate) {
    saturate.setAttribute("values", `${1 + burn * 0.9}`);
  }
  if (componentTransfer) {
    const exponent = `${1 + burn * 1.4}`;
    componentTransfer.querySelectorAll("feFuncR, feFuncG, feFuncB").forEach((node) => {
      node.setAttribute("exponent", exponent);
    });
  }

  if (panel.dataset.glassReady === "true" && !opts.skipForceRefresh) {
    panel.style.setProperty("--glass-filter-url", "none");
    window.requestAnimationFrame(() => {
      panel.style.setProperty("--glass-filter-url", `url(#${filterId})`);
    });
  }
}

function createGlassFilter(panel) {
  const svgHost = ensureGlassSvgHost();
  const defs = svgHost.querySelector("defs");
  if (!defs) return null;

  const filterId = `glass-refraction-${++filterIdCounter}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", filterId);
  filter.setAttribute("filterUnits", "objectBoundingBox");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  filter.setAttribute("x", "-0.5");
  filter.setAttribute("y", "-0.5");
  filter.setAttribute("width", "2");
  filter.setAttribute("height", "2");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const neutralBg = document.createElementNS(SVG_NS, "feFlood");
  neutralBg.setAttribute("flood-color", "rgb(128,128,128)");
  neutralBg.setAttribute("flood-opacity", "1");
  neutralBg.setAttribute("result", "neutralBg");

  const metrics = getPanelMetrics(panel);
  const map = document.createElementNS(SVG_NS, "feImage");
  map.setAttribute("x", "0");
  map.setAttribute("y", "0");
  map.setAttribute("width", String(metrics.width));
  map.setAttribute("height", String(metrics.height));
  map.setAttribute("preserveAspectRatio", "none");
  map.setAttribute("result", "rawRefractionMap");

  const composite = document.createElementNS(SVG_NS, "feComposite");
  composite.setAttribute("in", "rawRefractionMap");
  composite.setAttribute("in2", "neutralBg");
  composite.setAttribute("operator", "over");
  composite.setAttribute("result", "refractionMap");

  const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
  displacement.setAttribute("in", "SourceGraphic");
  displacement.setAttribute("in2", "refractionMap");
  displacement.setAttribute("scale", `${Math.max(0, Number(panel.dataset.glassDistortion || 55))}`);
  displacement.setAttribute("xChannelSelector", "R");
  displacement.setAttribute("yChannelSelector", "G");
  displacement.setAttribute("result", "refracted");

  const burnSaturate = document.createElementNS(SVG_NS, "feColorMatrix");
  burnSaturate.setAttribute("data-role", "burn-saturate");
  burnSaturate.setAttribute("in", "refracted");
  burnSaturate.setAttribute("type", "saturate");
  burnSaturate.setAttribute("values", "1");
  burnSaturate.setAttribute("result", "burnSat");

  const burnGamma = document.createElementNS(SVG_NS, "feComponentTransfer");
  burnGamma.setAttribute("data-role", "burn-gamma");
  burnGamma.setAttribute("in", "burnSat");
  ["feFuncR", "feFuncG", "feFuncB"].forEach((tag) => {
    const fn = document.createElementNS(SVG_NS, tag);
    fn.setAttribute("type", "gamma");
    fn.setAttribute("amplitude", "1");
    fn.setAttribute("exponent", "1");
    fn.setAttribute("offset", "0");
    burnGamma.appendChild(fn);
  });

  filter.appendChild(neutralBg);
  filter.appendChild(map);
  filter.appendChild(composite);
  filter.appendChild(displacement);
  filter.appendChild(burnSaturate);
  filter.appendChild(burnGamma);
  defs.appendChild(filter);

  panel.dataset.glassFilterId = filterId;
  updateGlassFilter(panel);
  return filterId;
}

function applyGlassStyles(panel) {
  panel.classList.add("glass-panel");
  panel.style.setProperty("--glass-blur", panel.dataset.glassBlur || "2px");
  panel.style.setProperty("--glass-saturation", panel.dataset.glassSaturation || "1.3");
  panel.style.setProperty("--glass-specular", panel.dataset.glassSpecular || "0");
  panel.style.setProperty("--glass-warmth", panel.dataset.glassWarmth || "0");
  panel.style.setProperty("--glass-fill-top", panel.dataset.glassFillTop || "0");
  panel.style.setProperty("--glass-fill-bottom", panel.dataset.glassFillBottom || "0");
  panel.style.setProperty("--glass-edge-opacity", panel.dataset.glassEdge || "0");
  panel.style.setProperty("--glass-shadow-opacity", panel.dataset.glassShadow || "0");
}

function initGlassPanel(panel, canUseFilterUrl = supportsBackdropFilterUrl()) {
  if (!panel || panel.dataset.glassReady === "true") return;

  applyGlassStyles(panel);

  if (panel.dataset.glassNoSvg === "true") {
    panel.dataset.glassReady = "true";
    return;
  }

  if (!canUseFilterUrl) {
    panel.dataset.glassFallback = "true";
    return;
  }

  const filterId = createGlassFilter(panel);
  if (!filterId) {
    panel.dataset.glassFallback = "true";
    return;
  }

  panel.style.setProperty("--glass-filter-url", `url(#${filterId})`);
  panel.dataset.glassReady = "true";
}

function initGlassPanels(root = document) {
  const panels = getGlassPanels(root);
  if (!panels.length) return;

  const canUseFilterUrl = supportsBackdropFilterUrl();
  panels.forEach((panel) => initGlassPanel(panel, canUseFilterUrl));
}

function refreshAllGlassPanels(root = document) {
  getGlassPanels(root).forEach((panel) => {
    if (panel.dataset.glassReady !== "true") {
      initGlassPanel(panel);
      return;
    }
    applyGlassStyles(panel);
    updateGlassFilter(panel);
  });
}

const GlassPanel = {
  init(root) {
    initGlassPanels(root || document);
  },
  initPanel(panel) {
    initGlassPanel(panel);
  },
  refreshPanel(panel, options) {
    if (!panel) return;
    const opts = options || {};
    if (panel.dataset.glassReady !== "true") {
      initGlassPanel(panel);
      return;
    }
    if (!opts.skipStylesRefresh) applyGlassStyles(panel);
    updateGlassFilter(panel, opts);
  },
  refreshAll(root) {
    refreshAllGlassPanels(root || document);
  },
  inspectPanelMap(panel) {
    if (!panel) return null;
    const mapUrl = generateRefractionMap(panel);
    panel.dataset.glassMapUrl = mapUrl || "";
    return mapUrl;
  },
};

window.GlassPanel = GlassPanel;

window.addEventListener("resize", () => {
  window.requestAnimationFrame(() => refreshAllGlassPanels());
});

export { GlassPanel, initGlassPanels, refreshAllGlassPanels };
