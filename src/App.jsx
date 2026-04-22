import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Download,
  Trash2,
  RefreshCw,
  Settings,
  Activity,
  AlertTriangle,
  Check,
  MousePointer2,
  Plus,
  Scaling,
  Type,
  CornerUpLeft,
  ChevronDown,
  ChevronRight,
  CircleDot,
} from "lucide-react";

// --- Paleta de Colores para Tramos ---
const PALETTE = [
  { hex: "#2563eb", name: "Azul" },
  { hex: "#dc2626", name: "Rojo" },
  { hex: "#16a34a", name: "Verde" },
  { hex: "#ea580c", name: "Naranja" },
  { hex: "#9333ea", name: "Púrpura" },
];

// --- Helpers de Formato Matemático ---
const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "0";
  if (Math.abs(val) < 1e-10) return "0";
  const rounded = Math.round(val * 100) / 100;
  return rounded.toString().replace(/-/g, "–");
};

const parseInput = (str) => {
  if (typeof str !== "string") return str;
  if (!str) return NaN;
  const sanitized = str.replace(/–/g, "-").replace(",", ".");
  return parseFloat(sanitized);
};

const getConfigNum = (val, fallback) => {
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
};

// --- Componente Auxiliar: Input Genérico Editable ---
const EditableValue = ({
  value,
  onChange,
  onInteractionStart,
  label,
  className = "",
  width = "w-full",
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  const commitChange = () => {
    setIsEditing(false);
    onChange(localValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    if (onInteractionStart) onInteractionStart();
  };

  return (
    <div
      className={`flex flex-col gap-1 text-gray-600 font-mono text-xs ${className}`}
    >
      <span className="text-gray-500 font-semibold">{label}</span>
      <input
        type="text"
        value={localValue}
        className={`${width} px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-left bg-gray-50 shadow-inner`}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={commitChange}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

// --- Componente Auxiliar: Selector de Borde ---
const BoundaryControl = ({ value, onChange, label }) => (
  <div className="flex flex-col mb-3">
    <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">
      {label}
    </span>
    <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
      <button
        onClick={() => onChange("closed")}
        className={`flex-1 text-xs py-1 rounded-sm transition ${value === "closed" ? "bg-white shadow-sm font-bold text-black" : "text-gray-500 hover:text-gray-700"}`}
      >
        ● Cerrado
      </button>
      <button
        onClick={() => onChange("open")}
        className={`flex-1 text-xs py-1 rounded-sm transition ${value === "open" ? "bg-white shadow-sm font-bold text-black" : "text-gray-500 hover:text-gray-700"}`}
      >
        ○ Abierto
      </button>
      <button
        onClick={() => onChange("none")}
        className={`flex-1 text-xs py-1 rounded-sm transition ${value === "none" ? "bg-white shadow-sm font-bold text-black" : "text-gray-500 hover:text-gray-700"}`}
      >
        Nada
      </button>
    </div>
  </div>
);

const FunctionGrapher = () => {
  // --- Constantes de Visualización ---
  const FIXED_WIDTH = 1000;
  const PADDING = 60;

  // --- Configuración Inicial y Estado de Ejes ---
  const [config, setConfig] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -7.1,
    yMax: 7.1,
    fontSize: 16,
    arrowSize: 10,
    pointSize: 5,
  });

  const [draftConfig, setDraftConfig] = useState({
    xMin: "–10",
    xMax: "10",
    yMin: "–7.1",
    yMax: "7.1",
    fontSize: "16",
    arrowSize: "10",
    pointSize: "5",
  });

  const [configError, setConfigError] = useState(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  // Asíntotas
  const [asymptotesX, setAsymptotesX] = useState([]); // [{val, extent, showVal}]
  const [asymptotesY, setAsymptotesY] = useState([]); // [{val, extent, showVal}]
  const [newAsymX, setNewAsymX] = useState("");
  const [newAsymY, setNewAsymY] = useState("");

  // Cálculo Dinámico de Altura para Escala 1:1
  const xMinVal = getConfigNum(config.xMin, -10);
  const xMaxVal = getConfigNum(config.xMax, 10);
  const yMinVal = getConfigNum(config.yMin, -10);
  const yMaxVal = getConfigNum(config.yMax, 10);
  const fontSizeBase = getConfigNum(config.fontSize, 16);
  const arrowSizeBase = getConfigNum(config.arrowSize, 10);
  const POINT_RADIUS = getConfigNum(config.pointSize, 5);
  const tickFontSize = Math.max(10, fontSizeBase - 3);

  const xRangeSafe = Math.max(1e-5, xMaxVal - xMinVal);
  const yRangeSafe = Math.max(1e-5, yMaxVal - yMinVal);

  const pixelsPerUnit = (FIXED_WIDTH - 2 * PADDING) / xRangeSafe;
  const calculatedHeight = yRangeSafe * pixelsPerUnit + 2 * PADDING;

  const width = FIXED_WIDTH;
  const height = calculatedHeight;
  const padding = PADDING;

  // --- ESTADO DE TRAMOS ---
  const [segments, setSegments] = useState([]);
  const segmentsRef = useRef([]);

  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [selectedPointId, setSelectedPointId] = useState(null);

  const [dragging, setDragging] = useState(null);
  const [hoveredPointId, setHoveredPointId] = useState(null);
  const [collision, setCollision] = useState(null);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const isInteractingRef = useRef(false);

  const MIN_DIST = 0.05;
  const HANDLE_SNAP_THRESHOLD = 3;
  const STUB_LENGTH = 15;

  const MATH_FONT =
    '"Latin Modern Math", "Computer Modern", "Cambria Math", "Times New Roman", serif';
  const COLOR_SELECTED = "#2563eb";
  const COLOR_HOVER = "rgba(37, 99, 235, 0.2)";

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // --- Helpers Funcionales Generales ---
  const formatSlope = (dx, dy, handleSide) => {
    if (Math.abs(dx) < 1e-5) {
      if (handleSide === "left") return dy <= 0 ? "+∞" : "-∞";
      return dy >= 0 ? "+∞" : "-∞";
    }
    const m = dy / dx;
    if (Math.abs(m) < 0.005) return "0";
    return formatNumber(m);
  };

  const createPoint = (x, y, type = "smooth") => ({
    id: Date.now() + Math.random(),
    x,
    y,
    type,
    cp1: { dx: -1, dy: 0 },
    cp2: { dx: 1, dy: 0 },
    projX: true,
    valX: true,
    projY: true,
    valY: true,
  });

  const generateDefaultPoints = (cfg) => {
    const xM = cfg ? cfg.xMin : xMinVal;
    const xMx = cfg ? cfg.xMax : xMaxVal;
    const yM = cfg ? cfg.yMin : yMinVal;
    const yMx = cfg ? cfg.yMax : yMaxVal;

    const avgY = (yM + yMx) / 2;
    const defaultY = Math.abs(avgY) < 0.001 ? (yMx - yM) * 0.25 : avgY;

    const startX = xM + (xMx - xM) * 0.25;
    const endX = xMx - (xMx - xM) * 0.25;

    const p1 = createPoint(startX, defaultY, "smooth");
    const p2 = createPoint(endX, defaultY, "smooth");
    const span = (endX - startX) / 3;
    p1.cp2 = { dx: span, dy: 0 };
    p2.cp1 = { dx: -span, dy: 0 };

    return [p1, p2];
  };

  const addSegment = () => {
    const newId = Date.now().toString();
    const colorObj = PALETTE[segments.length % PALETTE.length];
    const newSegment = {
      id: newId,
      color: colorObj.hex,
      colorName: colorObj.name,
      startType: "closed",
      endType: "closed",
      points: generateDefaultPoints(),
    };
    setSegments((prev) => [...prev, newSegment]);
    setSelectedSegmentId(newId);
    setSelectedPointId(null);
  };

  const resetAll = () => {
    const initId = Date.now().toString();
    setSegments([
      {
        id: initId,
        startType: "closed",
        endType: "closed",
        points: generateDefaultPoints(),
      },
    ]);
    setAsymptotesX([]);
    setAsymptotesY([]);
    setSelectedSegmentId(initId);
    setSelectedPointId(null);
  };

  useEffect(() => {
    if (segments.length === 0) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteSegment = (id) => {
    setSegments((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (selectedSegmentId === id) {
        if (filtered.length > 0)
          setSelectedSegmentId(filtered[filtered.length - 1].id);
        else setSelectedSegmentId(null);
        setSelectedPointId(null);
      }
      return filtered;
    });
  };

  // --- Funciones de Conversión ---
  const toScreenX = useCallback(
    (val) => {
      if (xMaxVal === xMinVal) return padding;
      return (
        padding +
        ((val - xMinVal) / (xMaxVal - xMinVal)) * (width - 2 * padding)
      );
    },
    [xMinVal, xMaxVal, width, padding],
  );

  const toScreenY = useCallback(
    (val) => {
      if (yMaxVal === yMinVal) return height - padding;
      return (
        height -
        padding -
        ((val - yMinVal) / (yMaxVal - yMinVal)) * (height - 2 * padding)
      );
    },
    [yMinVal, yMaxVal, height, padding],
  );

  const toLogicX = useCallback(
    (pixel) => {
      return (
        xMinVal +
        ((pixel - padding) / (width - 2 * padding)) * (xMaxVal - xMinVal)
      );
    },
    [xMinVal, xMaxVal, width, padding],
  );

  const toLogicY = useCallback(
    (pixel) => {
      return (
        yMinVal +
        ((height - padding - pixel) / (height - 2 * padding)) *
          (yMaxVal - yMinVal)
      );
    },
    [yMinVal, yMaxVal, height, padding],
  );

  // --- Manejo del Borrador de Configuración Global ---
  const handleDraftChange = (key, value) => {
    if (!/^[0-9.\-–]*$/.test(value)) return;
    const formattedValue = value.replace(/-/g, "–");
    setDraftConfig((prev) => ({ ...prev, [key]: formattedValue }));
    if (configError) setConfigError(null);
  };

  const applyConfiguration = () => {
    const xM = parseInput(draftConfig.xMin);
    const xMx = parseInput(draftConfig.xMax);
    const yM = parseInput(draftConfig.yMin);
    const yMx = parseInput(draftConfig.yMax);
    const fS = parseInput(draftConfig.fontSize);
    const aS = parseInput(draftConfig.arrowSize);
    const pS = parseInput(draftConfig.pointSize);

    if (
      isNaN(xM) ||
      isNaN(xMx) ||
      isNaN(yM) ||
      isNaN(yMx) ||
      isNaN(fS) ||
      isNaN(aS) ||
      isNaN(pS)
    ) {
      setConfigError("Los valores deben ser numéricos.");
      return;
    }
    if (xM >= xMx) {
      setConfigError("X Mín debe ser menor que X Máx.");
      return;
    }
    if (yM >= yMx) {
      setConfigError("Y Mín debe ser menor que Y Máx.");
      return;
    }
    if (fS < 8 || fS > 48) {
      setConfigError("El tamaño de fuente debe estar entre 8 y 48.");
      return;
    }
    if (aS < 5 || aS > 30) {
      setConfigError("El tamaño de flechas debe estar entre 5 y 30.");
      return;
    }
    if (pS < 2 || pS > 30) {
      setConfigError("El tamaño de puntos debe estar entre 2 y 30.");
      return;
    }
    if (xM > 0 || xMx < 0 || yM > 0 || yMx < 0) {
      setConfigError(
        "El rango debe incluir el 0 (min ≤ 0, max ≥ 0) para mostrar los ejes.",
      );
      return;
    }

    const newConfig = {
      xMin: xM,
      xMax: xMx,
      yMin: yM,
      yMax: yMx,
      fontSize: fS,
      arrowSize: aS,
      pointSize: pS,
    };
    setConfig(newConfig);
    setDraftConfig({
      xMin: formatNumber(xM),
      xMax: formatNumber(xMx),
      yMin: formatNumber(yM),
      yMax: formatNumber(yMx),
      fontSize: fS.toString(),
      arrowSize: aS.toString(),
      pointSize: pS.toString(),
    });
    setConfigError(null);

    // Solo conservar los puntos que queden dentro de los nuevos límites
    setSegments((prev) => {
      const newSegments = prev
        .map((seg) => {
          const keptPoints = seg.points.filter(
            (p) => p.x >= xM && p.x <= xMx && p.y >= yM && p.y <= yMx,
          );
          return { ...seg, points: keptPoints };
        })
        .filter((seg) => seg.points.length > 0);

      if (selectedSegmentId) {
        const segStillExists = newSegments.find(
          (s) => s.id === selectedSegmentId,
        );
        if (!segStillExists) {
          setSelectedSegmentId(null);
          setSelectedPointId(null);
        } else if (selectedPointId) {
          const pointStillExists = segStillExists.points.find(
            (p) => p.id === selectedPointId,
          );
          if (!pointStillExists) {
            setSelectedPointId(null);
          }
        }
      }
      return newSegments;
    });
  };

  const addAsymptoteX = () => {
    const val = parseInput(newAsymX);
    if (!isNaN(val)) {
      setAsymptotesX((prev) => [
        ...prev,
        { val, extent: "full", showVal: true },
      ]);
      setNewAsymX("");
    }
  };

  const addAsymptoteY = () => {
    const val = parseInput(newAsymY);
    if (!isNaN(val)) {
      setAsymptotesY((prev) => [
        ...prev,
        { val, extent: "full", showVal: true },
      ]);
      setNewAsymY("");
    }
  };

  const updateAsymptoteXExtent = (index, extent) => {
    setAsymptotesX((prev) =>
      prev.map((a, i) => (i === index ? { ...a, extent } : a)),
    );
  };

  const updateAsymptoteYExtent = (index, extent) => {
    setAsymptotesY((prev) =>
      prev.map((a, i) => (i === index ? { ...a, extent } : a)),
    );
  };

  const toggleAsymXVal = (index) => {
    setAsymptotesX((prev) =>
      prev.map((a, i) => (i === index ? { ...a, showVal: !a.showVal } : a)),
    );
  };

  const toggleAsymYVal = (index) => {
    setAsymptotesY((prev) =>
      prev.map((a, i) => (i === index ? { ...a, showVal: !a.showVal } : a)),
    );
  };

  // --- Cambios de Bordes del Tramo Seleccionado ---
  const updateBoundaryType = (key, value) => {
    if (!selectedSegmentId) return;
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.id !== selectedSegmentId) return seg;
        return { ...seg, [key]: value };
      }),
    );
  };

  // --- State Updates de Puntos ---
  const updateSelectedPoint = (updaterFn) => {
    if (!selectedSegmentId || !selectedPointId) return;
    setSegments((prevSegments) =>
      prevSegments.map((seg) => {
        if (seg.id !== selectedSegmentId) return seg;

        const index = seg.points.findIndex((p) => p.id === selectedPointId);
        if (index === -1) return seg;

        const newPoints = [...seg.points];
        newPoints[index] = updaterFn({ ...newPoints[index] }, index, newPoints);

        if (index > 0) {
          newPoints[index - 1] = { ...newPoints[index - 1] };
          squashHandlesInInterval(newPoints[index - 1], newPoints[index]);
        }
        if (index < newPoints.length - 1) {
          newPoints[index + 1] = { ...newPoints[index + 1] };
          squashHandlesInInterval(newPoints[index], newPoints[index + 1]);
        }

        return { ...seg, points: newPoints };
      }),
    );
  };

  const updateCoordinate = (pointId, axis, valueStr) => {
    const val = parseInput(valueStr);
    if (isNaN(val)) return;

    updateSelectedPoint((p, index, pointsArr) => {
      const prev = pointsArr[index - 1];
      const next = pointsArr[index + 1];

      if (axis === "x") {
        const minX = Math.max(xMinVal, prev ? prev.x + MIN_DIST : xMinVal);
        const maxX = Math.min(xMaxVal, next ? next.x - MIN_DIST : xMaxVal);
        return { ...p, x: Math.max(minX, Math.min(maxX, val)) };
      } else {
        return { ...p, y: val };
      }
    });
  };

  const updateSlope = (pointId, slopeStr, handleSide) => {
    let targetM = 0;
    let isInfinite = false;
    let infiniteSign = 1;

    const s = slopeStr.trim().toLowerCase();
    if (s.includes("inf") || s.includes("∞")) {
      isInfinite = true;
      if (s.startsWith("-")) infiniteSign = -1;
    } else {
      const parsed = parseInput(s);
      if (isNaN(parsed)) return;
      targetM = parsed;
    }

    updateSelectedPoint((p, index, pointsArr) => {
      const prev = pointsArr[index - 1];
      const next = pointsArr[index + 1];

      const applySlope = (currentDx, currentDy, isRightHandle) => {
        let len = Math.sqrt(currentDx ** 2 + currentDy ** 2);
        if (len < MIN_DIST) {
          const safe = getSafeHandleDist(p, prev, next);
          len = safe > 0 ? safe : 1;
        }

        if (isInfinite) {
          let sign = isRightHandle ? infiniteSign : -infiniteSign;
          return { dx: 0, dy: len * sign };
        } else {
          const norm = Math.sqrt(1 + targetM ** 2);
          let uDx = 1 / norm;
          let uDy = targetM / norm;
          if (isRightHandle && uDx < 0) {
            uDx = -uDx;
            uDy = -uDy;
          }
          if (!isRightHandle && uDx > 0) {
            uDx = -uDx;
            uDy = -uDy;
          }
          return { dx: uDx * len, dy: uDy * len };
        }
      };

      const newP = { ...p };
      if (handleSide === "right" || handleSide === "both")
        newP.cp2 = applySlope(p.cp2.dx, p.cp2.dy, true);
      if (handleSide === "left" || handleSide === "both")
        newP.cp1 = applySlope(p.cp1.dx, p.cp1.dy, false);
      return newP;
    });
  };

  const togglePointType = (id) => {
    updateSelectedPoint((p, index, pointsArr) => {
      const newType = p.type === "smooth" ? "sharp" : "smooth";
      const newP = { ...p, type: newType };

      if (newType === "smooth") {
        const len1 = Math.sqrt(p.cp1.dx ** 2 + p.cp1.dy ** 2);
        const len2 = Math.sqrt(p.cp2.dx ** 2 + p.cp2.dy ** 2);
        if (len1 < 1 || len2 < 1) {
          const safeDist = getSafeHandleDist(
            p,
            pointsArr[index - 1],
            pointsArr[index + 1],
          );
          newP.cp1 = { dx: -safeDist, dy: 0 };
          newP.cp2 = { dx: safeDist, dy: 0 };
        } else {
          const angle = Math.atan2(p.cp2.dy, p.cp2.dx);
          let targetDx = Math.cos(angle + Math.PI) * len1;
          let targetDy = Math.sin(angle + Math.PI) * len1;
          newP.cp1 = { dx: targetDx, dy: targetDy };
        }
      }
      return newP;
    });
  };

  const togglePointProp = (id, propName) => {
    updateSelectedPoint((p) => ({ ...p, [propName]: !p[propName] }));
  };

  const deletePoint = (id) => {
    if (!selectedSegmentId) return;
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.id !== selectedSegmentId) return seg;
        if (seg.points.length <= 2) return seg;
        return { ...seg, points: seg.points.filter((p) => p.id !== id) };
      }),
    );
    setSelectedPointId(null);
  };

  // --- Funciones Lógicas de Geometría ---
  const getSafeHandleDist = (p, prev, next) => {
    const leftSpace = prev ? p.x - prev.x : 2;
    const rightSpace = next ? next.x - p.x : 2;
    return Math.min(leftSpace, rightSpace) * 0.3;
  };

  const limitHandleLength = (handle, maxLength) => {
    const len = Math.sqrt(handle.dx * handle.dx + handle.dy * handle.dy);
    if (len === 0) return handle;
    if (Math.abs(handle.dx) > maxLength) {
      const scale = maxLength / Math.abs(handle.dx);
      return { dx: handle.dx * scale, dy: handle.dy * scale };
    }
    return handle;
  };

  const clampHandleVector = (dx, dy, currentX, limitX, isRightHandle) => {
    if (isRightHandle && dx < 0) return { dx: 0, dy };
    if (!isRightHandle && dx > 0) return { dx: 0, dy };
    const targetX = currentX + dx;
    if (Math.abs(dx) < 1e-9) return { dx, dy };

    if (isRightHandle && targetX > limitX) {
      const safeRatio = Math.max(0, (limitX - currentX) / dx);
      return { dx: limitX - currentX, dy: dy * safeRatio };
    }
    if (!isRightHandle && targetX < limitX) {
      const safeRatio = Math.max(0, (limitX - currentX) / dx);
      return { dx: limitX - currentX, dy: dy * safeRatio };
    }
    return { dx, dy };
  };

  const squashHandlesInInterval = (pLeft, pRight) => {
    const safeGap = Math.max(0, pRight.x - pLeft.x);
    const maxHandleXProj = safeGap * 0.49;
    pLeft.cp2 = limitHandleLength(pLeft.cp2, maxHandleXProj);
    pRight.cp1 = limitHandleLength(pRight.cp1, maxHandleXProj);
  };

  // --- EFECTO GLOBAL DE ARRASTRE ---
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDragging(null);
      setCollision(null);
      setTimeout(() => {
        isInteractingRef.current = false;
      }, 100);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleWindowMouseMove = (e) => {
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;

      // Aplicar Offset inicial para evitar saltos (Jumps)
      const lx = toLogicX(mouseX) + (dragging.offsetX || 0);
      const ly = toLogicY(mouseY) + (dragging.offsetY || 0);

      let newCollision = null;

      const nextSegments = JSON.parse(JSON.stringify(segmentsRef.current));
      const segIndex = nextSegments.findIndex(
        (s) => s.id === dragging.segmentId,
      );
      if (segIndex === -1) return;

      const seg = nextSegments[segIndex];
      const index = seg.points.findIndex((p) => p.id === dragging.pointId);
      if (index === -1) return;

      const p = seg.points[index];
      const prevP = seg.points[index - 1];
      const nextP = seg.points[index + 1];

      if (dragging.type === "point") {
        const minX = Math.max(xMinVal, prevP ? prevP.x + MIN_DIST : xMinVal);
        const maxX = Math.min(xMaxVal, nextP ? nextP.x - MIN_DIST : xMaxVal);

        p.y = Math.max(yMinVal, Math.min(yMaxVal, ly)); // Constreñir al área visual
        p.x = Math.max(minX, Math.min(maxX, lx)); // Libre constreñido por vecinos

        if (prevP) squashHandlesInInterval(prevP, p);
        if (nextP) squashHandlesInInterval(p, nextP);
      } else {
        const isCp2 = dragging.type === "cp2";
        let dx = lx - p.x;
        let dy = ly - p.y;

        const distInPixels = Math.sqrt(dx * dx + dy * dy) * pixelsPerUnit;

        if (distInPixels < HANDLE_SNAP_THRESHOLD) {
          dx = 0;
          dy = 0;
          if (p.type === "smooth") p.type = "sharp";
        }

        if (isCp2) {
          const rightLimit = nextP ? nextP.x + nextP.cp1.dx : xMaxVal;
          if (p.x + dx >= rightLimit - 0.001 && nextP)
            newCollision = {
              x: rightLimit,
              segmentId: seg.id,
              pointId: nextP.id,
              handle: "cp1",
            };
          const clamped = clampHandleVector(dx, dy, p.x, rightLimit, true);
          p.cp2 = clamped;

          if (p.type === "smooth") {
            const angle = Math.atan2(clamped.dy, clamped.dx);
            const len1 = Math.sqrt(p.cp1.dx ** 2 + p.cp1.dy ** 2);
            const leftLimit = prevP ? prevP.x + prevP.cp2.dx : xMinVal;
            let dx1 = Math.cos(angle + Math.PI) * len1;
            let dy1 = Math.sin(angle + Math.PI) * len1;
            if (p.x + dx1 <= leftLimit + 0.001 && prevP)
              newCollision = {
                x: leftLimit,
                segmentId: seg.id,
                pointId: prevP.id,
                handle: "cp2",
              };
            p.cp1 = clampHandleVector(dx1, dy1, p.x, leftLimit, false);
          }
        } else {
          const leftLimit = prevP ? prevP.x + prevP.cp2.dx : xMinVal;
          if (p.x + dx <= leftLimit + 0.001 && prevP)
            newCollision = {
              x: leftLimit,
              segmentId: seg.id,
              pointId: prevP.id,
              handle: "cp2",
            };
          const clamped = clampHandleVector(dx, dy, p.x, leftLimit, false);
          p.cp1 = clamped;

          if (p.type === "smooth") {
            const angle = Math.atan2(clamped.dy, clamped.dx);
            const len2 = Math.sqrt(p.cp2.dx ** 2 + p.cp2.dy ** 2);
            const rightLimit = nextP ? nextP.x + nextP.cp1.dx : xMaxVal;
            let dx2 = Math.cos(angle + Math.PI) * len2;
            let dy2 = Math.sin(angle + Math.PI) * len2;
            if (p.x + dx2 >= rightLimit - 0.001 && nextP)
              newCollision = {
                x: rightLimit,
                segmentId: seg.id,
                pointId: nextP.id,
                handle: "cp1",
              };
            p.cp2 = clampHandleVector(dx2, dy2, p.x, rightLimit, true);
          }
        }
      }

      setCollision(newCollision);
      setSegments(nextSegments);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    return () => window.removeEventListener("mousemove", handleWindowMouseMove);
  }, [
    dragging,
    toLogicX,
    toLogicY,
    xMinVal,
    xMaxVal,
    yMinVal,
    yMaxVal,
    pixelsPerUnit,
  ]);

  // --- Handlers Locales (Eventos de Mouse con Offset) ---
  const handlePointMouseDown = (e, pointId, segmentId, cx, cy) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === "INPUT")
      document.activeElement.blur();

    const svgRect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    const lx = toLogicX(mouseX);
    const ly = toLogicY(mouseY);

    const vlx = toLogicX(cx);
    const vly = toLogicY(cy);

    isInteractingRef.current = true;
    setSelectedSegmentId(segmentId);
    setSelectedPointId(pointId);
    setDragging({
      type: "point",
      pointId,
      segmentId,
      offsetX: vlx - lx,
      offsetY: vly - ly,
    });
  };

  const handleHandleMouseDown = (e, type, pointId, segmentId, cx, cy) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === "INPUT")
      document.activeElement.blur();

    const svgRect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    const lx = toLogicX(mouseX);
    const ly = toLogicY(mouseY);

    const vlx = toLogicX(cx);
    const vly = toLogicY(cy);

    isInteractingRef.current = true;
    setSelectedSegmentId(segmentId);
    setSelectedPointId(pointId);
    setDragging({
      type,
      pointId,
      segmentId,
      offsetX: vlx - lx,
      offsetY: vly - ly,
    });
  };

  const handleSvgClick = (e) => {
    if (isInteractingRef.current) return;
    setSelectedPointId(null);
  };

  const handleSvgDoubleClick = (e) => {
    if (!selectedSegmentId) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const lx = toLogicX(e.clientX - svgRect.left);
    const ly = toLogicY(e.clientY - svgRect.top);

    if (lx < xMinVal || lx > xMaxVal || ly < yMinVal || ly > yMaxVal) return;

    setSegments((prev) => {
      let updateFired = false;
      const newSegments = prev.map((seg) => {
        if (seg.id !== selectedSegmentId) return seg;

        const insertIndex = seg.points.findIndex((p) => p.x > lx);
        if (insertIndex <= 0) return seg;

        const newPoints = [...seg.points];
        const prevPoint = { ...newPoints[insertIndex - 1] };
        const nextPoint = { ...newPoints[insertIndex] };

        const newPoint = createPoint(lx, ly, "smooth");
        const dist = (nextPoint.x - prevPoint.x) * 0.15;
        newPoint.cp1 = { dx: -dist, dy: 0 };
        newPoint.cp2 = { dx: dist, dy: 0 };

        newPoints[insertIndex - 1] = prevPoint;
        newPoints[insertIndex] = nextPoint;
        newPoints.splice(insertIndex, 0, newPoint);

        squashHandlesInInterval(
          newPoints[insertIndex - 1],
          newPoints[insertIndex],
        );
        squashHandlesInInterval(
          newPoints[insertIndex],
          newPoints[insertIndex + 1],
        );

        setTimeout(() => setSelectedPointId(newPoint.id), 0);
        updateFired = true;
        return { ...seg, points: newPoints };
      });
      return updateFired ? newSegments : prev;
    });
  };

  // --- Lógica de Teclado ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedPointId &&
        selectedSegmentId
      ) {
        if (e.target.tagName === "INPUT") return;

        const seg = segmentsRef.current.find((s) => s.id === selectedSegmentId);
        if (seg) {
          const index = seg.points.findIndex((p) => p.id === selectedPointId);
          if (index > 0 && index < seg.points.length - 1) {
            deletePoint(selectedPointId);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPointId, selectedSegmentId]);

  // --- Renderizado SVG ---
  const generatePathData = (pts) => {
    if (!pts || pts.length < 2) return "";
    let d = `M ${toScreenX(pts[0].x)} ${toScreenY(pts[0].y)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const pCurrent = pts[i];
      const pNext = pts[i + 1];
      const cp1X = toScreenX(pCurrent.x + pCurrent.cp2.dx);
      const cp1Y = toScreenY(pCurrent.y + pCurrent.cp2.dy);
      const cp2X = toScreenX(pNext.x + pNext.cp1.dx);
      const cp2Y = toScreenY(pNext.y + pNext.cp1.dy);
      const endX = toScreenX(pNext.x);
      const endY = toScreenY(pNext.y);
      d += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    }
    return d;
  };

  const processCloneForExport = (clone) => {
    const uiElements = clone.querySelectorAll(
      ".ui-layer, .hit-area, .internal-point",
    );
    uiElements.forEach((el) => el.remove());

    clone.querySelectorAll(".curve-path").forEach((el) => {
      el.style.opacity = "1";
      el.setAttribute("stroke", "#000000");
    });
    clone.querySelectorAll(".segment-boundary").forEach((el) => {
      if (
        el.getAttribute("fill") !== "white" &&
        el.getAttribute("fill") !== "transparent"
      ) {
        el.setAttribute("fill", "#000000");
      }
      if (
        el.getAttribute("stroke") !== "none" &&
        el.getAttribute("stroke") !== "transparent"
      ) {
        el.setAttribute("stroke", "#000000");
      }
    });
    clone
      .querySelectorAll(".projection-line, .asymptote-line")
      .forEach((el) => {
        el.setAttribute("stroke", "#000000");
      });
    clone.style.backgroundColor = "white";
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    processCloneForExport(clone);
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grafico_funciones.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const originY = toScreenY(0);
  const originX = toScreenX(0);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId);
  const activePoint = activeSegment?.points.find(
    (p) => p.id === selectedPointId,
  );
  const activePointIndex = activeSegment?.points.findIndex(
    (p) => p.id === selectedPointId,
  );

  const selIsBoundary =
    activePointIndex === 0 ||
    (activeSegment && activePointIndex === activeSegment.points.length - 1);

  // Espaciado extra para los textos del eje X
  let xLabelY = originY + tickFontSize + 12;
  let yLabelX = originX - 10;
  let yLabelAnchor = "end";

  const sortedSegments = [...segments].sort((a, b) => {
    if (a.id === selectedSegmentId) return 1;
    if (b.id === selectedSegmentId) return -1;
    return 0;
  });

  return (
    <div
      className="flex flex-col items-center p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen font-sans"
      tabIndex="0"
      ref={containerRef}
    >
      <style>{`
        @keyframes blink-red {
          0% { stroke: #ef4444; stroke-width: 2; r: 5; }
          50% { stroke: #b91c1c; stroke-width: 4; r: 6; }
          100% { stroke: #ef4444; stroke-width: 2; r: 5; }
        }
        .blink-handle {
          animation: blink-red 0.8s infinite;
        }
        @keyframes blink-line {
            0% { stroke: #ef4444; opacity: 0.5; }
            50% { stroke: #b91c1c; opacity: 1; stroke-width: 2; }
            100% { stroke: #ef4444; opacity: 0.5; }
        }
        .blink-line {
            animation: blink-line 0.8s infinite;
        }
      `}</style>

      {/* HEADER */}
      <div className="w-full max-w-[1600px] flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Activity className="text-blue-600" /> Graficador de Funciones
        </h1>
        <div className="flex gap-2">
          <button
            onClick={resetAll}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition border border-gray-300"
          >
            <RefreshCw size={16} />{" "}
            <span className="hidden sm:inline">Reiniciar</span>
          </button>
          <button
            onClick={downloadSVG}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition border border-gray-300"
          >
            <Download size={16} /> SVG
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1600px] items-start">
        {/* PANEL IZQUIERDO (Inspector de Propiedades Fijo) */}
        <div className="w-full lg:w-80 shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-fit overflow-hidden">
          {/* SECCIÓN 1: EJES GLOBALES Y FUENTE */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div
              className="flex justify-between items-center cursor-pointer mb-2"
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            >
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Scaling size={14} /> Espacio de Trabajo
              </h2>
              {isWorkspaceOpen ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              )}
            </div>

            {isWorkspaceOpen && (
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                      X Mín
                    </label>
                    <input
                      type="text"
                      value={draftConfig.xMin}
                      onChange={(e) =>
                        handleDraftChange("xMin", e.target.value)
                      }
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                      X Máx
                    </label>
                    <input
                      type="text"
                      value={draftConfig.xMax}
                      onChange={(e) =>
                        handleDraftChange("xMax", e.target.value)
                      }
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                      Y Mín
                    </label>
                    <input
                      type="text"
                      value={draftConfig.yMin}
                      onChange={(e) =>
                        handleDraftChange("yMin", e.target.value)
                      }
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                      Y Máx
                    </label>
                    <input
                      type="text"
                      value={draftConfig.yMax}
                      onChange={(e) =>
                        handleDraftChange("yMax", e.target.value)
                      }
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <label
                      className="block text-[10px] font-bold text-gray-400 mb-1 uppercase flex items-center gap-1"
                      title="Tamaño de Fuente"
                    >
                      <Type size={10} /> Fuente
                    </label>
                    <input
                      type="number"
                      value={draftConfig.fontSize}
                      onChange={(e) =>
                        handleDraftChange("fontSize", e.target.value)
                      }
                      min="8"
                      max="48"
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <label
                      className="block text-[10px] font-bold text-gray-400 mb-1 uppercase flex items-center gap-1"
                      title="Tamaño de Flechas en Ejes"
                    >
                      Flechas
                    </label>
                    <input
                      type="number"
                      value={draftConfig.arrowSize}
                      onChange={(e) =>
                        handleDraftChange("arrowSize", e.target.value)
                      }
                      min="5"
                      max="30"
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label
                      className="block text-[10px] font-bold text-gray-400 mb-1 uppercase flex items-center gap-1"
                      title="Tamaño de los puntos del gráfico"
                    >
                      <CircleDot size={10} /> Tamaño de Puntos
                    </label>
                    <input
                      type="number"
                      value={draftConfig.pointSize}
                      onChange={(e) =>
                        handleDraftChange("pointSize", e.target.value)
                      }
                      min="2"
                      max="30"
                      className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {configError && (
                  <div className="flex items-center gap-1.5 p-2 mb-3 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded leading-tight">
                    <AlertTriangle size={12} className="shrink-0" />{" "}
                    <span>{configError}</span>
                  </div>
                )}
                <button
                  onClick={applyConfiguration}
                  className="w-full py-1.5 bg-gray-800 text-white rounded text-xs font-semibold hover:bg-gray-700 transition flex justify-center items-center gap-1.5"
                >
                  <Check size={14} /> Aplicar Cambios
                </button>

                {/* ASÍNTOTAS */}
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">
                    Asíntotas
                  </label>

                  {/* Asíntota Vertical */}
                  <div className="flex gap-2 mb-2">
                    <span className="text-xs text-gray-500 font-semibold self-center w-4">
                      X=
                    </span>
                    <input
                      type="text"
                      placeholder="Vertical"
                      value={newAsymX}
                      onChange={(e) =>
                        setNewAsymX(e.target.value.replace(/-/g, "–"))
                      }
                      className="flex-1 p-1.5 border border-gray-300 rounded text-sm shadow-inner focus:ring-1 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addAsymptoteX();
                      }}
                    />
                    <button
                      onClick={addAsymptoteX}
                      className="px-2 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-100 transition text-xs font-semibold"
                    >
                      Añadir
                    </button>
                  </div>
                  {asymptotesX.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-3">
                      {asymptotesX.map((a, i) => {
                        const val = a.val !== undefined ? a.val : a;
                        const extent = a.extent || "full";
                        const showVal = a.showVal !== false;
                        return (
                          <div
                            key={`ax-${i}`}
                            className="flex items-center justify-between bg-white border border-gray-200 px-2 py-1 rounded text-xs shadow-sm w-full"
                          >
                            <span className="font-mono text-gray-600">
                              x = {formatNumber(val)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-500 mr-1">
                                <input
                                  type="checkbox"
                                  checked={showVal}
                                  onChange={() => toggleAsymXVal(i)}
                                  className="rounded text-blue-600"
                                />{" "}
                                Val
                              </label>
                              <select
                                value={extent}
                                onChange={(e) =>
                                  updateAsymptoteXExtent(i, e.target.value)
                                }
                                className="bg-gray-50 border border-gray-300 rounded text-[10px] p-0.5 outline-none"
                              >
                                <option value="full">Comp.</option>
                                <option value="top">Arr.</option>
                                <option value="bottom">Aba.</option>
                              </select>
                              <button
                                onClick={() =>
                                  setAsymptotesX((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  )
                                }
                                className="text-gray-400 hover:text-red-500 ml-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Asíntota Horizontal */}
                  <div className="flex gap-2 mb-2 mt-2">
                    <span className="text-xs text-gray-500 font-semibold self-center w-4">
                      Y=
                    </span>
                    <input
                      type="text"
                      placeholder="Horizontal"
                      value={newAsymY}
                      onChange={(e) =>
                        setNewAsymY(e.target.value.replace(/-/g, "–"))
                      }
                      className="flex-1 p-1.5 border border-gray-300 rounded text-sm shadow-inner focus:ring-1 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addAsymptoteY();
                      }}
                    />
                    <button
                      onClick={addAsymptoteY}
                      className="px-2 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-100 transition text-xs font-semibold"
                    >
                      Añadir
                    </button>
                  </div>
                  {asymptotesY.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      {asymptotesY.map((asym, i) => {
                        const val = asym.val !== undefined ? asym.val : asym;
                        const extent = asym.extent || "full";
                        const showVal = asym.showVal !== false;

                        return (
                          <div
                            key={`ay-${i}`}
                            className="flex items-center justify-between bg-white border border-gray-200 px-2 py-1 rounded text-xs shadow-sm w-full"
                          >
                            <span className="font-mono text-gray-600">
                              y = {formatNumber(val)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-500 mr-1">
                                <input
                                  type="checkbox"
                                  checked={showVal}
                                  onChange={() => toggleAsymYVal(i)}
                                  className="rounded text-blue-600"
                                />{" "}
                                Val
                              </label>
                              <select
                                value={extent}
                                onChange={(e) =>
                                  updateAsymptoteYExtent(i, e.target.value)
                                }
                                className="bg-gray-50 border border-gray-300 rounded text-[10px] p-0.5 outline-none"
                              >
                                <option value="full">Comp.</option>
                                <option value="left">Izq.</option>
                                <option value="right">Der.</option>
                              </select>
                              <button
                                onClick={() =>
                                  setAsymptotesY((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  )
                                }
                                className="text-gray-400 hover:text-red-500 ml-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: LISTA DE TRAMOS */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} /> Tramos (Funciones)
              </h2>
              <button
                onClick={addSegment}
                className="text-blue-600 hover:bg-blue-50 p-1 rounded transition"
                title="Añadir nuevo tramo"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
              {segments.map((seg, i) => (
                <div
                  key={seg.id}
                  onClick={() => {
                    setSelectedSegmentId(seg.id);
                    setSelectedPointId(null);
                  }}
                  className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer border transition-colors ${selectedSegmentId === seg.id ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm ${selectedSegmentId === seg.id ? "font-semibold text-blue-900" : "font-medium text-gray-700"}`}
                    >
                      Tramo {i + 1}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSegment(seg.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN 3: CONFIGURACIÓN DEL TRAMO SELECCIONADO */}
          {activeSegment ? (
            <div className="p-4 flex-1 flex flex-col gap-4 bg-white">
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Settings size={14} /> Terminaciones
                </h2>

                <BoundaryControl
                  label="Extremo Izquierdo"
                  value={activeSegment.startType || "closed"}
                  onChange={(val) => updateBoundaryType("startType", val)}
                />
                <BoundaryControl
                  label="Extremo Derecho"
                  value={activeSegment.endType || "closed"}
                  onChange={(val) => updateBoundaryType("endType", val)}
                />
              </div>

              {/* SECCIÓN 4: PROPIEDADES DEL PUNTO SELECCIONADO */}
              <div
                className={`p-3 rounded-lg border transition-all ${activePoint ? "bg-yellow-50 border-yellow-200 shadow-sm" : "bg-gray-50 border-dashed border-gray-200 opacity-50"}`}
              >
                <div className="flex items-center gap-2 mb-3 text-yellow-800 border-b border-yellow-200/50 pb-2">
                  <MousePointer2 size={14} />
                  <h3 className="text-xs font-bold uppercase tracking-wide">
                    Punto Seleccionado
                  </h3>
                </div>

                {activePoint ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <EditableValue
                        label="Coordenada X:"
                        value={formatNumber(activePoint.x)}
                        onChange={(val) =>
                          updateCoordinate(activePoint.id, "x", val)
                        }
                        onInteractionStart={() => {
                          isInteractingRef.current = true;
                        }}
                      />
                      <EditableValue
                        label="Coordenada Y:"
                        value={formatNumber(activePoint.y)}
                        onChange={(val) =>
                          updateCoordinate(activePoint.id, "y", val)
                        }
                        onInteractionStart={() => {
                          isInteractingRef.current = true;
                        }}
                      />
                    </div>

                    <div className="p-2 bg-white rounded shadow-sm border border-yellow-100">
                      {activePointIndex === 0 ? (
                        <EditableValue
                          label="Pendiente (Der):"
                          onInteractionStart={() => {
                            isInteractingRef.current = true;
                          }}
                          value={formatSlope(
                            activePoint.cp2.dx,
                            activePoint.cp2.dy,
                            "right",
                          )}
                          onChange={(val) =>
                            updateSlope(activePoint.id, val, "right")
                          }
                        />
                      ) : activePointIndex ===
                        activeSegment.points.length - 1 ? (
                        <EditableValue
                          label="Pendiente (Izq):"
                          onInteractionStart={() => {
                            isInteractingRef.current = true;
                          }}
                          value={formatSlope(
                            activePoint.cp1.dx,
                            activePoint.cp1.dy,
                            "left",
                          )}
                          onChange={(val) =>
                            updateSlope(activePoint.id, val, "left")
                          }
                        />
                      ) : activePoint.type === "smooth" ? (
                        <EditableValue
                          label="Pendiente (m):"
                          onInteractionStart={() => {
                            isInteractingRef.current = true;
                          }}
                          value={formatSlope(
                            activePoint.cp2.dx,
                            activePoint.cp2.dy,
                            "right",
                          )}
                          onChange={(val) =>
                            updateSlope(activePoint.id, val, "both")
                          }
                        />
                      ) : (
                        <div className="flex gap-2">
                          <EditableValue
                            label="m (Izq):"
                            onInteractionStart={() => {
                              isInteractingRef.current = true;
                            }}
                            value={formatSlope(
                              activePoint.cp1.dx,
                              activePoint.cp1.dy,
                              "left",
                            )}
                            onChange={(val) =>
                              updateSlope(activePoint.id, val, "left")
                            }
                          />
                          <EditableValue
                            label="m (Der):"
                            onInteractionStart={() => {
                              isInteractingRef.current = true;
                            }}
                            value={formatSlope(
                              activePoint.cp2.dx,
                              activePoint.cp2.dy,
                              "right",
                            )}
                            onChange={(val) =>
                              updateSlope(activePoint.id, val, "right")
                            }
                          />
                        </div>
                      )}
                      <div className="text-[9px] text-gray-400 mt-1 italic">
                        Tip: Escribe +inf o -inf para asíntotas.
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-yellow-200/50">
                      <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activePoint.projX !== false}
                          onChange={() =>
                            togglePointProp(activePoint.id, "projX")
                          }
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Mostrar proy. X
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activePoint.valX !== false}
                          onChange={() =>
                            togglePointProp(activePoint.id, "valX")
                          }
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Mostrar valor X
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activePoint.projY !== false}
                          onChange={() =>
                            togglePointProp(activePoint.id, "projY")
                          }
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Mostrar proy. Y
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activePoint.valY !== false}
                          onChange={() =>
                            togglePointProp(activePoint.id, "valY")
                          }
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Mostrar valor Y
                      </label>
                    </div>

                    {!selIsBoundary && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => togglePointType(activePoint.id)}
                          className="flex-1 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 shadow-sm transition"
                        >
                          {activePoint.type === "smooth" ? (
                            <CornerUpLeft size={12} />
                          ) : (
                            <Activity size={12} />
                          )}
                          {activePoint.type === "smooth"
                            ? "Puntiagudo"
                            : "Suavizar"}
                        </button>
                        <button
                          onClick={() => deletePoint(activePoint.id)}
                          className="flex-1 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 hover:bg-red-100 flex items-center justify-center gap-1.5 shadow-sm transition"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-center text-gray-400 italic">
                    Haz clic en un punto para editarlo.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 flex-1 flex flex-col items-center justify-center text-center text-gray-400 opacity-50">
              <Activity size={32} className="mb-2" />
              <p className="text-sm">
                Selecciona un tramo arriba para configurarlo.
              </p>
            </div>
          )}
        </div>

        {/* ÁREA DE GRÁFICO EXPANDIDA */}
        <div
          className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-gray-200 overflow-auto relative select-none w-full"
          style={{ maxHeight: "85vh" }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            className="bg-white mx-auto cursor-crosshair"
            onClick={handleSvgClick}
            onDoubleClick={handleSvgDoubleClick}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 15 8"
                refX="4"
                refY="4"
                markerWidth={arrowSizeBase}
                markerHeight={arrowSizeBase * 0.6}
                orient="auto"
              >
                <path d="M 0 0 L 15 4 L 0 8 L 4 4 z" fill="black" />
              </marker>
            </defs>

            {/* ASÍNTOTAS VERTICALES Y HORIZONTALES */}
            {asymptotesX.map((a, i) => {
              const val = a.val !== undefined ? a.val : a;
              const extent = a.extent || "full";
              const showVal = a.showVal !== false;

              let y1 = padding;
              let y2 = height - padding;
              if (extent === "top") y2 = originY;
              if (extent === "bottom") y1 = originY;
              const sx = toScreenX(val);

              return (
                <g key={`asym-x-${i}`}>
                  <line
                    x1={sx}
                    y1={y1}
                    x2={sx}
                    y2={y2}
                    stroke="#bbb"
                    strokeWidth="1.5"
                    strokeDasharray="6,4"
                    className="asymptote-line"
                  />
                  {showVal && (
                    <g>
                      <line
                        x1={sx}
                        y1={originY - 5}
                        x2={sx}
                        y2={originY + 5}
                        stroke="black"
                        strokeWidth="1"
                      />
                      <text
                        x={sx}
                        y={xLabelY}
                        textAnchor="middle"
                        fontSize={tickFontSize}
                        fontFamily={MATH_FONT}
                        fill="#000"
                      >
                        {formatNumber(val)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {asymptotesY.map((asym, i) => {
              const val = asym.val !== undefined ? asym.val : asym;
              const extent = asym.extent || "full";
              const showVal = asym.showVal !== false;

              let x1 = padding;
              let x2 = width - padding;
              if (extent === "left") x2 = originX;
              if (extent === "right") x1 = originX;
              const sy = toScreenY(val);

              return (
                <g key={`asym-y-${i}`}>
                  <line
                    x1={x1}
                    y1={sy}
                    x2={x2}
                    y2={sy}
                    stroke="#bbb"
                    strokeWidth="1.5"
                    strokeDasharray="6,4"
                    className="asymptote-line"
                  />
                  {showVal && (
                    <g>
                      <line
                        x1={originX - 5}
                        y1={sy}
                        x2={originX + 5}
                        y2={sy}
                        stroke="black"
                        strokeWidth="1"
                      />
                      <text
                        x={originX - 10}
                        y={sy + tickFontSize / 3}
                        textAnchor="end"
                        fontSize={tickFontSize}
                        fontFamily={MATH_FONT}
                        fill="#000"
                      >
                        {formatNumber(val)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* EJES Y ETIQUETAS GLOBALES */}
            <line
              x1={padding}
              y1={originY}
              x2={width - padding}
              y2={originY}
              stroke="black"
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
            <text
              x={width - padding}
              y={originY - 15}
              fontWeight="bold"
              fontSize={fontSizeBase}
              fontFamily={MATH_FONT}
              fontStyle="italic"
            >
              x
            </text>

            <line
              x1={originX}
              y1={height - padding}
              x2={originX}
              y2={padding}
              stroke="black"
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
            <text
              x={originX + 15}
              y={padding}
              textAnchor="start"
              fontWeight="bold"
              fontSize={fontSizeBase}
              fontFamily={MATH_FONT}
              fontStyle="italic"
            >
              y
            </text>

            {/* RENDERIZADO DE TRAMOS ORDENADOS (Activo arriba) */}
            {sortedSegments.map((seg) => {
              const isSelected = selectedSegmentId === seg.id;
              const pathData = generatePathData(seg.points);

              return (
                <g key={seg.id} className="transition-opacity duration-300">
                  {/* Hit Area Gruesa Invisible para Seleccionar Curva */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    className="hit-area"
                    cursor="pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedSegmentId(seg.id);
                      setSelectedPointId(null);
                    }}
                  />

                  {/* Curva Visible (Siempre Negra) */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="2.5"
                    className="curve-path transition-opacity duration-300"
                    style={{
                      opacity: !selectedSegmentId || isSelected ? 1 : 0.25,
                    }}
                  />

                  {/* Puntos y UI Interactiva */}
                  {seg.points.map((p, index) => {
                    const isFirst = index === 0;
                    const isLast = index === seg.points.length - 1;
                    const isFinBoundary = isFirst || isLast;

                    let bType = "closed";
                    if (isFirst) bType = seg.startType || "closed";
                    if (isLast) bType = seg.endType || "closed";

                    const sx = toScreenX(p.x);
                    const sy = toScreenY(p.y);

                    const pSelected = isSelected && selectedPointId === p.id;
                    const pHovered = hoveredPointId === p.id;

                    // Lógica de visibilidad (proyecciones y valores)
                    const isZeroX = Math.abs(p.x) < 1e-5;
                    const isZeroY = Math.abs(p.y) < 1e-5;

                    const showTickX = !isZeroX && p.valX !== false;
                    const showTickY = !isZeroY && p.valY !== false;

                    const showDashedX =
                      !isZeroX && !isZeroY && p.projX !== false;
                    const showDashedY =
                      !isZeroY && !isZeroX && p.projY !== false;

                    const showCp1 = pSelected && index > 0;
                    const showCp2 = pSelected && index < seg.points.length - 1;

                    let cp1x = sx,
                      cp1y = sy,
                      cp2x = sx,
                      cp2y = sy;
                    if (showCp1) {
                      const raw1X = toScreenX(p.x + p.cp1.dx),
                        raw1Y = toScreenY(p.y + p.cp1.dy);
                      if (
                        Math.sqrt((raw1X - sx) ** 2 + (raw1Y - sy) ** 2) < 12
                      ) {
                        cp1x = sx - STUB_LENGTH;
                        cp1y = sy;
                      } else {
                        cp1x = raw1X;
                        cp1y = raw1Y;
                      }
                    }
                    if (showCp2) {
                      const raw2X = toScreenX(p.x + p.cp2.dx),
                        raw2Y = toScreenY(p.y + p.cp2.dy);
                      if (
                        Math.sqrt((raw2X - sx) ** 2 + (raw2Y - sy) ** 2) < 12
                      ) {
                        cp2x = sx + STUB_LENGTH;
                        cp2y = sy;
                      } else {
                        cp2x = raw2X;
                        cp2y = raw2Y;
                      }
                    }

                    const isBlockingCp1 =
                      collision &&
                      collision.segmentId === seg.id &&
                      collision.pointId === p.id &&
                      collision.handle === "cp1";
                    const isBlockingCp2 =
                      collision &&
                      collision.segmentId === seg.id &&
                      collision.pointId === p.id &&
                      collision.handle === "cp2";

                    return (
                      <g
                        key={p.id}
                        className={
                          !selectedSegmentId || isSelected
                            ? "opacity-100"
                            : "opacity-25"
                        }
                      >
                        {/* TICS Y TEXTOS EN EJES */}
                        {showTickX && (
                          <g>
                            <line
                              x1={sx}
                              y1={originY - 5}
                              x2={sx}
                              y2={originY + 5}
                              stroke="black"
                              strokeWidth="1"
                            />
                            <text
                              x={sx}
                              y={xLabelY}
                              textAnchor="middle"
                              fontSize={tickFontSize}
                              fontFamily={MATH_FONT}
                              fill="#000"
                            >
                              {formatNumber(p.x)}
                            </text>
                          </g>
                        )}
                        {showTickY && (
                          <g>
                            <line
                              x1={originX - 5}
                              y1={sy}
                              x2={originX + 5}
                              y2={sy}
                              stroke="black"
                              strokeWidth="1"
                            />
                            <text
                              x={originX - 10}
                              y={sy + tickFontSize / 3}
                              textAnchor="end"
                              fontSize={tickFontSize}
                              fontFamily={MATH_FONT}
                              fill="#000"
                            >
                              {formatNumber(p.y)}
                            </text>
                          </g>
                        )}

                        {/* LÍNEAS DE PROYECCIÓN */}
                        {showDashedX && (
                          <line
                            x1={sx}
                            y1={sy}
                            x2={sx}
                            y2={originY}
                            stroke="#bbb"
                            strokeWidth="1.5"
                            strokeDasharray="6,4"
                            className="projection-line"
                          />
                        )}
                        {showDashedY && (
                          <line
                            x1={sx}
                            y1={sy}
                            x2={originX}
                            y2={sy}
                            stroke="#bbb"
                            strokeWidth="1.5"
                            strokeDasharray="6,4"
                            className="projection-line"
                          />
                        )}

                        {/* Puntos Visibles Permanentes (Solo Extremos Finitos) */}
                        {isFinBoundary && bType !== "none" && (
                          <circle
                            cx={sx}
                            cy={sy}
                            r={POINT_RADIUS}
                            fill={bType === "open" ? "white" : "#000000"}
                            stroke="#000000"
                            strokeWidth={bType === "open" ? 2 : 0}
                            className="segment-boundary"
                          />
                        )}

                        {/* Capa Interactiva (Se Oculta al Exportar) */}
                        {isSelected && (
                          <g
                            className="ui-layer"
                            onMouseEnter={() => setHoveredPointId(p.id)}
                            onMouseLeave={() => setHoveredPointId(null)}
                          >
                            {/* Área Base del Punto (Para seleccionarlos fácilmente) */}
                            <circle
                              cx={sx}
                              cy={sy}
                              r={18}
                              fill="transparent"
                              stroke="transparent"
                              cursor="pointer"
                              onMouseDown={(e) =>
                                handlePointMouseDown(e, p.id, seg.id, sx, sy)
                              }
                            />

                            {/* Círculo interno visual para edición (azul) */}
                            {!isFinBoundary && (
                              <circle
                                cx={sx}
                                cy={sy}
                                r={4}
                                fill={COLOR_SELECTED}
                                stroke="none"
                                className="internal-point"
                                pointerEvents="none"
                              />
                            )}

                            {(pSelected || pHovered) && (
                              <circle
                                cx={sx}
                                cy={sy}
                                r={
                                  pSelected
                                    ? 6
                                    : isFinBoundary
                                      ? Math.max(POINT_RADIUS + 2, 6)
                                      : 6
                                }
                                fill={pSelected ? COLOR_SELECTED : COLOR_HOVER}
                                stroke={pSelected ? "white" : "transparent"}
                                strokeWidth={pSelected ? 2 : 0}
                                className="internal-point"
                                pointerEvents="none"
                                style={{ transition: "all 0.1s" }}
                              />
                            )}

                            {/* Manijas (Dibujadas ENCIMA) */}
                            {showCp1 && (
                              <g>
                                <line
                                  x1={sx}
                                  y1={sy}
                                  x2={cp1x}
                                  y2={cp1y}
                                  stroke={
                                    p.type === "smooth" ? "#ef4444" : "#f97316"
                                  }
                                  strokeWidth={isBlockingCp1 ? "2" : "1"}
                                  className={
                                    isBlockingCp1 ? "blink-line-handle" : ""
                                  }
                                  pointerEvents="none"
                                />
                                <circle
                                  cx={cp1x}
                                  cy={cp1y}
                                  r={5}
                                  fill={isBlockingCp1 ? "#fee2e2" : "white"}
                                  stroke={
                                    isBlockingCp1
                                      ? "#dc2626"
                                      : p.type === "smooth"
                                        ? "#ef4444"
                                        : "#f97316"
                                  }
                                  strokeWidth={isBlockingCp1 ? "3" : "2"}
                                  className={
                                    isBlockingCp1 ? "blink-handle" : ""
                                  }
                                  pointerEvents="none"
                                />
                                <circle
                                  cx={cp1x}
                                  cy={cp1y}
                                  r={16}
                                  fill="transparent"
                                  cursor="pointer"
                                  onMouseDown={(e) =>
                                    handleHandleMouseDown(
                                      e,
                                      "cp1",
                                      p.id,
                                      seg.id,
                                      cp1x,
                                      cp1y,
                                    )
                                  }
                                />
                              </g>
                            )}
                            {showCp2 && (
                              <g>
                                <line
                                  x1={sx}
                                  y1={sy}
                                  x2={cp2x}
                                  y2={cp2y}
                                  stroke={
                                    p.type === "smooth" ? "#ef4444" : "#f97316"
                                  }
                                  strokeWidth={isBlockingCp2 ? "2" : "1"}
                                  className={
                                    isBlockingCp2 ? "blink-line-handle" : ""
                                  }
                                  pointerEvents="none"
                                />
                                <circle
                                  cx={cp2x}
                                  cy={cp2y}
                                  r={5}
                                  fill={isBlockingCp2 ? "#fee2e2" : "white"}
                                  stroke={
                                    isBlockingCp2
                                      ? "#dc2626"
                                      : p.type === "smooth"
                                        ? "#ef4444"
                                        : "#f97316"
                                  }
                                  strokeWidth={isBlockingCp2 ? "3" : "2"}
                                  className={
                                    isBlockingCp2 ? "blink-handle" : ""
                                  }
                                  pointerEvents="none"
                                />
                                <circle
                                  cx={cp2x}
                                  cy={cp2y}
                                  r={16}
                                  fill="transparent"
                                  cursor="pointer"
                                  onMouseDown={(e) =>
                                    handleHandleMouseDown(
                                      e,
                                      "cp2",
                                      p.id,
                                      seg.id,
                                      cp2x,
                                      cp2y,
                                    )
                                  }
                                />
                              </g>
                            )}
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Línea de Colisión */}
            {collision && (
              <line
                x1={toScreenX(collision.x)}
                y1={0}
                x2={toScreenX(collision.x)}
                y2={height}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="6,4"
                className="blink-line ui-layer"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default FunctionGrapher;
