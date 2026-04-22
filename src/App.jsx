import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Trash2, RefreshCw, Settings, Activity, AlertTriangle, Check, MousePointer2, Plus, Scaling, Type, CornerUpLeft, ChevronDown, ChevronRight, CircleDot } from 'lucide-react';

// --- Paleta de Colores para Tramos ---
const PALETTE = [
  { hex: "#2563eb", name: "Azul" },
  { hex: "#dc2626", name: "Rojo" },
  { hex: "#16a34a", name: "Verde" },
  { hex: "#ea580c", name: "Naranja" },
  { hex: "#9333ea", name: "Púrpura" }
];

// --- Helpers de Formato Matemático ---
const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "0";
  if (Math.abs(val) < 1e-10) return "0";
  const rounded = Math.round(val * 100) / 100;
  return rounded.toString().replace(/-/g, '–');
};

const parseInput = (str) => {
  if (typeof str !== 'string') return str;
  if (!str) return NaN;
  const sanitized = str.replace(/–/g, '-').replace(',', '.');
  return parseFloat(sanitized);
};

const getConfigNum = (val, fallback) => {
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
};

// --- Componente Auxiliar: Input Genérico Editable ---
const EditableValue = ({ value, onChange, onInteractionStart, label, className = "", width = "w-full" }) => {
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
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleMouseDown = (e) => {
      e.stopPropagation();
      if (onInteractionStart) onInteractionStart();
  };

  return (
    <div className={`flex flex-col gap-1 text-gray-600 font-mono text-xs ${className}`}>
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
        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</span>
        <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
            <button onClick={() => onChange('closed')} className={`flex-1 text-xs py-1 rounded-sm transition ${value === 'closed' ? 'bg-white shadow-sm font-bold text-black' : 'text-gray-500 hover:text-gray-700'}`}>● Cerrado</button>
            <button onClick={() => onChange('open')} className={`flex-1 text-xs py-1 rounded-sm transition ${value === 'open' ? 'bg-white shadow-sm font-bold text-black' : 'text-gray-500 hover:text-gray-700'}`}>○ Abierto</button>
            <button onClick={() => onChange('none')} className={`flex-1 text-xs py-1 rounded-sm transition ${value === 'none' ? 'bg-white shadow-sm font-bold text-black' : 'text-gray-500 hover:text-gray-700'}`}>Nada</button>
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
  });

  const [draftConfig, setDraftConfig] = useState({
    xMin: "–10",
    xMax: "10",
    yMin: "–7.1",
    yMax: "7.1",
  });

  const [configError, setConfigError] = useState(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  // --- Configuración Visual en Tiempo Real ---
  const [valFontSize, setValFontSize] = useState("24");
  const [valArrowSize, setValArrowSize] = useState("10");
  const [valPointSize, setValPointSize] = useState("5");

  const getLiveNum = (str, min, max, defaultVal) => {
      const num = parseInput(str);
      if (isNaN(num)) return defaultVal;
      return Math.min(Math.max(num, min), max);
  };

  const fontSizeBase = getLiveNum(valFontSize, 8, 48, 24);
  const arrowSizeBase = getLiveNum(valArrowSize, 5, 30, 10);
  const POINT_RADIUS = getLiveNum(valPointSize, 2, 30, 5);
  const tickFontSize = Math.max(10, fontSizeBase - 3); 

  // Asíntotas y Etiquetas
  const [asymptotesX, setAsymptotesX] = useState([]); 
  const [asymptotesY, setAsymptotesY] = useState([]); 
  const [newAsymX, setNewAsymX] = useState("");
  const [newAsymY, setNewAsymY] = useState("");

  const [labels, setLabels] = useState([]); // [{id, text, x, y, isItalic}]
  const [newLabelText, setNewLabelText] = useState("");
  const labelsRef = useRef([]);

  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);

  // Cálculo Dinámico de Altura para Escala 1:1
  const xMinVal = getConfigNum(config.xMin, -10);
  const xMaxVal = getConfigNum(config.xMax, 10);
  const yMinVal = getConfigNum(config.yMin, -10);
  const yMaxVal = getConfigNum(config.yMax, 10);

  const xRangeSafe = Math.max(1e-5, xMaxVal - xMinVal);
  const yRangeSafe = Math.max(1e-5, yMaxVal - yMinVal);
  
  const pixelsPerUnit = (FIXED_WIDTH - 2 * PADDING) / xRangeSafe;
  const calculatedHeight = (yRangeSafe * pixelsPerUnit) + (2 * PADDING);

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
  
  const MATH_FONT = "'KaTeX_Main', 'Latin Modern Math', 'Computer Modern', 'Cambria Math', 'Times New Roman', serif";
  const COLOR_SELECTED = "#2563eb"; 
  const COLOR_HOVER = "rgba(37, 99, 235, 0.2)"; 

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // --- Helpers Funcionales Generales ---
  const formatSlope = (dx, dy, handleSide) => {
    if (Math.abs(dx) < 1e-5) {
        if (handleSide === 'left') return dy <= 0 ? "+∞" : "-∞";
        return dy >= 0 ? "+∞" : "-∞"; 
    }
    const m = dy / dx;
    if (Math.abs(m) < 0.005) return "0";
    return formatNumber(m);
  };

  const createPoint = (x, y, type = 'smooth') => ({
      id: Date.now() + Math.random(),
      x, y, type,
      cp1: { dx: -1, dy: 0 },
      cp2: { dx: 1, dy: 0 },
      projX: true,
      valX: true,
      projY: true,
      valY: true
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

    const p1 = createPoint(startX, defaultY, 'smooth');
    const p2 = createPoint(endX, defaultY, 'smooth');
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
          startType: 'closed', 
          endType: 'closed',
          points: generateDefaultPoints()
      };
      setSegments(prev => [...prev, newSegment]);
      setSelectedSegmentId(newId);
      setSelectedPointId(null);
  };

  const resetAll = () => {
      const initId = Date.now().toString();
      setSegments([{
          id: initId,
          startType: 'closed', 
          endType: 'closed',
          points: generateDefaultPoints()
      }]);
      setAsymptotesX([]);
      setAsymptotesY([]);
      setLabels([]);
      setSelectedSegmentId(initId);
      setSelectedPointId(null);
  };

  useEffect(() => {
      if (segments.length === 0) resetAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteSegment = (id) => {
      setSegments(prev => {
          const filtered = prev.filter(s => s.id !== id);
          if (selectedSegmentId === id) {
              if (filtered.length > 0) setSelectedSegmentId(filtered[filtered.length - 1].id);
              else setSelectedSegmentId(null);
              setSelectedPointId(null);
          }
          return filtered;
      });
  };

  // --- Funciones de Conversión y SVG ---
  const toScreenX = useCallback((val) => {
    if (xMaxVal === xMinVal) return padding;
    return padding + ((val - xMinVal) / (xMaxVal - xMinVal)) * (width - 2 * padding);
  }, [xMinVal, xMaxVal, width, padding]);

  const toScreenY = useCallback((val) => {
    if (yMaxVal === yMinVal) return height - padding;
    return height - padding - ((val - yMinVal) / (yMaxVal - yMinVal)) * (height - 2 * padding);
  }, [yMinVal, yMaxVal, height, padding]);

  const toLogicX = useCallback((pixel) => {
    return xMinVal + ((pixel - padding) / (width - 2 * padding)) * (xMaxVal - xMinVal);
  }, [xMinVal, xMaxVal, width, padding]);

  const toLogicY = useCallback((pixel) => {
    return yMinVal + ((height - padding - pixel) / (height - 2 * padding)) * (yMaxVal - yMinVal);
  }, [yMinVal, yMaxVal, height, padding]);

  const getSvgCoordinates = useCallback((clientX, clientY) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const svg = svgRef.current;
      let pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
          pt = pt.matrixTransform(ctm.inverse());
      }
      return { x: pt.x, y: pt.y };
  }, []);

  // --- Manejo del Borrador de Configuración Global ---
  const handleDraftChange = (key, value) => {
      if (!/^[0-9.\-–]*$/.test(value)) return; 
      const formattedValue = value.replace(/-/g, '–');
      setDraftConfig(prev => ({ ...prev, [key]: formattedValue }));
      if (configError) setConfigError(null);
  };

  const applyConfiguration = () => {
      const xM = parseInput(draftConfig.xMin);
      const xMx = parseInput(draftConfig.xMax);
      const yM = parseInput(draftConfig.yMin);
      const yMx = parseInput(draftConfig.yMax);

      if (isNaN(xM) || isNaN(xMx) || isNaN(yM) || isNaN(yMx)) {
          setConfigError("Los límites de los ejes deben ser numéricos."); return;
      }
      if (xM >= xMx) { setConfigError("X Mín debe ser menor que X Máx."); return; }
      if (yM >= yMx) { setConfigError("Y Mín debe ser menor que Y Máx."); return; }
      if (xM > 0 || xMx < 0 || yM > 0 || yMx < 0) {
          setConfigError("El rango debe incluir el 0 (min ≤ 0, max ≥ 0) para mostrar los ejes."); return;
      }

      setConfig({ xMin: xM, xMax: xMx, yMin: yM, yMax: yMx });
      setDraftConfig({
          xMin: formatNumber(xM), xMax: formatNumber(xMx),
          yMin: formatNumber(yM), yMax: formatNumber(yMx)
      });
      setConfigError(null);

      // Conservar los puntos y etiquetas que queden dentro de los nuevos límites
      setSegments(prev => {
          const newSegments = prev.map(seg => {
              const keptPoints = seg.points.filter(p => p.x >= xM && p.x <= xMx && p.y >= yM && p.y <= yMx);
              return { ...seg, points: keptPoints };
          }).filter(seg => seg.points.length > 0);
          
          if (selectedSegmentId) {
              const segStillExists = newSegments.find(s => s.id === selectedSegmentId);
              if (!segStillExists) {
                  setSelectedSegmentId(null);
                  setSelectedPointId(null);
              } else if (selectedPointId) {
                  const pointStillExists = segStillExists.points.find(p => p.id === selectedPointId);
                  if (!pointStillExists) {
                      setSelectedPointId(null);
                  }
              }
          }
          return newSegments;
      });

      setLabels(prev => prev.filter(l => l.x >= xM && l.x <= xMx && l.y >= yM && l.y <= yMx));
  };

  const handleAxisKeyDown = (e) => {
      if (e.key === 'Enter') {
          e.target.blur();
          applyConfiguration();
      }
  };

  const addAsymptoteX = () => {
      const val = parseInput(newAsymX);
      if (!isNaN(val)) {
          setAsymptotesX(prev => [...prev, { val, extent: 'full', showVal: true }]);
          setNewAsymX("");
      }
  };

  const addAsymptoteY = () => {
      const val = parseInput(newAsymY);
      if (!isNaN(val)) {
          setAsymptotesY(prev => [...prev, { val, extent: 'full', showVal: true }]);
          setNewAsymY("");
      }
  };

  const updateAsymptoteXExtent = (index, extent) => {
      setAsymptotesX(prev => prev.map((a, i) => i === index ? { ...a, extent } : a));
  };

  const updateAsymptoteYExtent = (index, extent) => {
      setAsymptotesY(prev => prev.map((a, i) => i === index ? { ...a, extent } : a));
  };
  
  const toggleAsymXVal = (index) => {
      setAsymptotesX(prev => prev.map((a, i) => i === index ? { ...a, showVal: !a.showVal } : a));
  };
  
  const toggleAsymYVal = (index) => {
      setAsymptotesY(prev => prev.map((a, i) => i === index ? { ...a, showVal: !a.showVal } : a));
  };

  const handleLabelChange = (e) => {
      const val = e.target.value;
      if (/^[a-zA-Z0-9+\-.,\s(){}\[\];ñÑáéíóúÁÉÍÓÚ]*$/.test(val)) {
          setNewLabelText(val);
      }
  };

  const addLabel = () => {
      if (newLabelText.trim() === "") return;
      setLabels(prev => [...prev, {
          id: Date.now().toString(),
          text: newLabelText,
          x: (xMinVal + xMaxVal) / 2,
          y: (yMinVal + yMaxVal) / 2,
          isItalic: true
      }]);
      setNewLabelText("");
  };

  const toggleLabelItalic = (id) => {
      setLabels(prev => prev.map(l => l.id === id ? { ...l, isItalic: !l.isItalic } : l));
  };

  // --- Cambios de Bordes del Tramo Seleccionado ---
  const updateBoundaryType = (key, value) => {
      if (!selectedSegmentId) return;
      setSegments(prev => prev.map(seg => {
          if (seg.id !== selectedSegmentId) return seg;
          return { ...seg, [key]: value };
      }));
  };

  // --- State Updates de Puntos ---
  const updateSelectedPoint = (updaterFn) => {
      if (!selectedSegmentId || !selectedPointId) return;
      setSegments(prevSegments => prevSegments.map(seg => {
          if (seg.id !== selectedSegmentId) return seg;
          
          const index = seg.points.findIndex(p => p.id === selectedPointId);
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
      }));
  };

  const updateCoordinate = (pointId, axis, valueStr) => {
    const val = parseInput(valueStr);
    if (isNaN(val)) return;

    updateSelectedPoint((p, index, pointsArr) => {
        const prev = pointsArr[index - 1];
        const next = pointsArr[index + 1];

        if (axis === 'x') {
            const minX = Math.max(xMinVal, prev ? prev.x + MIN_DIST : xMinVal);
            const maxX = Math.min(xMaxVal, next ? next.x - MIN_DIST : xMaxVal);
            return { ...p, x: Math.max(minX, Math.min(maxX, val)) };
        } else {
            return { ...p, y: Math.max(yMinVal, Math.min(yMaxVal, val)) };
        }
    });
  };

  const updateSlope = (pointId, slopeStr, handleSide) => {
    let targetM = 0;
    let isInfinite = false;
    let infiniteSign = 1; 

    const s = slopeStr.trim().toLowerCase();
    if (s.includes('inf') || s.includes('∞')) {
        isInfinite = true;
        if (s.startsWith('-')) infiniteSign = -1;
    } else {
        const parsed = parseInput(s);
        if (isNaN(parsed)) return;
        targetM = parsed;
    }

    updateSelectedPoint((p, index, pointsArr) => {
        const prev = pointsArr[index-1];
        const next = pointsArr[index+1];
        
        const applySlope = (currentDx, currentDy, isRightHandle) => {
            let len = Math.sqrt(currentDx**2 + currentDy**2);
            if (len < MIN_DIST) {
                const safe = getSafeHandleDist(p, prev, next);
                len = safe > 0 ? safe : 1; 
            }

            if (isInfinite) {
                let sign = isRightHandle ? infiniteSign : -infiniteSign;
                return { dx: 0, dy: len * sign };
            } else {
                const norm = Math.sqrt(1 + targetM**2);
                let uDx = 1 / norm;
                let uDy = targetM / norm;
                if (isRightHandle && uDx < 0) { uDx = -uDx; uDy = -uDy; }
                if (!isRightHandle && uDx > 0) { uDx = -uDx; uDy = -uDy; }
                return { dx: uDx * len, dy: uDy * len };
            }
        };

        const newP = { ...p };
        if (handleSide === 'right' || handleSide === 'both') newP.cp2 = applySlope(p.cp2.dx, p.cp2.dy, true);
        if (handleSide === 'left' || handleSide === 'both') newP.cp1 = applySlope(p.cp1.dx, p.cp1.dy, false);
        return newP;
    });
  };

  const togglePointType = (id) => {
      updateSelectedPoint((p, index, pointsArr) => {
          const newType = p.type === 'smooth' ? 'sharp' : 'smooth';
          const newP = { ...p, type: newType };
          
          if (newType === 'smooth') {
              const len1 = Math.sqrt(p.cp1.dx**2 + p.cp1.dy**2);
              const len2 = Math.sqrt(p.cp2.dx**2 + p.cp2.dy**2);
              if (len1 < 1 || len2 < 1) {
                  const safeDist = getSafeHandleDist(p, pointsArr[index - 1], pointsArr[index + 1]);
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
      setSegments(prev => prev.map(seg => {
          if (seg.id !== selectedSegmentId) return seg;
          if (seg.points.length <= 2) return seg;
          return { ...seg, points: seg.points.filter(p => p.id !== id) };
      }));
      setSelectedPointId(null);
  };

  // --- Funciones Lógicas de Geometría ---
  const getSafeHandleDist = (p, prev, next) => {
    const leftSpace = prev ? (p.x - prev.x) : 2;
    const rightSpace = next ? (next.x - p.x) : 2;
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
        setTimeout(() => { isInteractingRef.current = false; }, 100);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleWindowMouseMove = (e) => {
        if (!svgRef.current) return;
        const { x: mouseX, y: mouseY } = getSvgCoordinates(e.clientX, e.clientY);
        
        const lx = toLogicX(mouseX) + (dragging.offsetX || 0);
        const ly = toLogicY(mouseY) + (dragging.offsetY || 0);

        if (dragging.type === 'label') {
            const nextLabels = JSON.parse(JSON.stringify(labelsRef.current));
            const lblIndex = nextLabels.findIndex(l => l.id === dragging.id);
            if (lblIndex !== -1) {
                nextLabels[lblIndex].x = Math.max(xMinVal, Math.min(xMaxVal, lx));
                nextLabels[lblIndex].y = Math.max(yMinVal, Math.min(yMaxVal, ly));
                setLabels(nextLabels);
            }
            return;
        }

        let newCollision = null;

        const nextSegments = JSON.parse(JSON.stringify(segmentsRef.current)); 
        const segIndex = nextSegments.findIndex(s => s.id === dragging.segmentId);
        if (segIndex === -1) return;

        const seg = nextSegments[segIndex];
        const index = seg.points.findIndex(p => p.id === dragging.pointId);
        if (index === -1) return;

        const p = seg.points[index];
        const prevP = seg.points[index - 1];
        const nextP = seg.points[index + 1];

        if (dragging.type === 'point') {
            const minX = Math.max(xMinVal, prevP ? prevP.x + MIN_DIST : xMinVal); 
            const maxX = Math.min(xMaxVal, nextP ? nextP.x - MIN_DIST : xMaxVal);
            
            p.y = Math.max(yMinVal, Math.min(yMaxVal, ly)); // Constreñir al área visual
            p.x = Math.max(minX, Math.min(maxX, lx)); // Libre constreñido por vecinos

            if (prevP) squashHandlesInInterval(prevP, p);
            if (nextP) squashHandlesInInterval(p, nextP);

        } else {
            const isCp2 = dragging.type === 'cp2';
            let dx = lx - p.x;
            let dy = ly - p.y;
            
            const distInPixels = Math.sqrt(dx*dx + dy*dy) * pixelsPerUnit;

            if (distInPixels < HANDLE_SNAP_THRESHOLD) {
                dx = 0; dy = 0;
                if (p.type === 'smooth') p.type = 'sharp';
            }

            if (isCp2) {
                    const rightLimit = nextP ? (nextP.x + nextP.cp1.dx) : xMaxVal;
                    if (p.x + dx >= rightLimit - 0.001 && nextP) newCollision = { x: rightLimit, segmentId: seg.id, pointId: nextP.id, handle: 'cp1' };
                    const clamped = clampHandleVector(dx, dy, p.x, rightLimit, true);
                    p.cp2 = clamped;

                    if (p.type === 'smooth') {
                        const angle = Math.atan2(clamped.dy, clamped.dx);
                        const len1 = Math.sqrt(p.cp1.dx**2 + p.cp1.dy**2);
                        const leftLimit = prevP ? (prevP.x + prevP.cp2.dx) : xMinVal;
                        let dx1 = Math.cos(angle + Math.PI) * len1;
                        let dy1 = Math.sin(angle + Math.PI) * len1;
                        if (p.x + dx1 <= leftLimit + 0.001 && prevP) newCollision = { x: leftLimit, segmentId: seg.id, pointId: prevP.id, handle: 'cp2' };
                        p.cp1 = clampHandleVector(dx1, dy1, p.x, leftLimit, false);
                    }
            } else {
                    const leftLimit = prevP ? (prevP.x + prevP.cp2.dx) : xMinVal;
                    if (p.x + dx <= leftLimit + 0.001 && prevP) newCollision = { x: leftLimit, segmentId: seg.id, pointId: prevP.id, handle: 'cp2' };
                    const clamped = clampHandleVector(dx, dy, p.x, leftLimit, false);
                    p.cp1 = clamped;

                    if (p.type === 'smooth') {
                        const angle = Math.atan2(clamped.dy, clamped.dx);
                        const len2 = Math.sqrt(p.cp2.dx**2 + p.cp2.dy**2);
                        const rightLimit = nextP ? (nextP.x + nextP.cp1.dx) : xMaxVal;
                        let dx2 = Math.cos(angle + Math.PI) * len2;
                        let dy2 = Math.sin(angle + Math.PI) * len2;
                        if (p.x + dx2 >= rightLimit - 0.001 && nextP) newCollision = { x: rightLimit, segmentId: seg.id, pointId: nextP.id, handle: 'cp1' };
                        p.cp2 = clampHandleVector(dx2, dy2, p.x, rightLimit, true);
                    }
            }
        }
        
        setCollision(newCollision);
        setSegments(nextSegments);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    return () => window.removeEventListener('mousemove', handleWindowMouseMove);
  }, [dragging, toLogicX, toLogicY, xMinVal, xMaxVal, yMinVal, yMaxVal, pixelsPerUnit, getSvgCoordinates]);


  // --- Handlers Locales (Eventos de Mouse con Offset) ---
  const handlePointMouseDown = (e, pointId, segmentId, cx, cy) => {
    e.stopPropagation(); e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    
    const { x: mouseX, y: mouseY } = getSvgCoordinates(e.clientX, e.clientY);
    const lx = toLogicX(mouseX);
    const ly = toLogicY(mouseY);
    
    const vlx = toLogicX(cx);
    const vly = toLogicY(cy);
    
    isInteractingRef.current = true;
    setSelectedSegmentId(segmentId);
    setSelectedPointId(pointId);
    setDragging({ type: 'point', pointId, segmentId, offsetX: vlx - lx, offsetY: vly - ly });
  };

  const handleHandleMouseDown = (e, type, pointId, segmentId, cx, cy) => {
    e.stopPropagation(); e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    
    const { x: mouseX, y: mouseY } = getSvgCoordinates(e.clientX, e.clientY);
    const lx = toLogicX(mouseX);
    const ly = toLogicY(mouseY);
    
    const vlx = toLogicX(cx);
    const vly = toLogicY(cy);
    
    isInteractingRef.current = true;
    setSelectedSegmentId(segmentId);
    setSelectedPointId(pointId);
    setDragging({ type, pointId, segmentId, offsetX: vlx - lx, offsetY: vly - ly });
  };

  const handleLabelMouseDown = (e, id, cx, cy) => {
    e.stopPropagation(); e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    
    const { x: mouseX, y: mouseY } = getSvgCoordinates(e.clientX, e.clientY);
    const lx = toLogicX(mouseX);
    const ly = toLogicY(mouseY);
    
    const vlx = toLogicX(cx);
    const vly = toLogicY(cy);
    
    isInteractingRef.current = true;
    setDragging({ type: 'label', id, offsetX: vlx - lx, offsetY: vly - ly });
  };

  const handleSvgClick = (e) => {
      if (isInteractingRef.current) return;
      setSelectedPointId(null);
  };
  
  const handleSvgDoubleClick = (e) => {
    if (!selectedSegmentId) return;

    const { x: mouseX, y: mouseY } = getSvgCoordinates(e.clientX, e.clientY);
    const lx = toLogicX(mouseX);
    const ly = toLogicY(mouseY);
    
    if (lx < xMinVal || lx > xMaxVal || ly < yMinVal || ly > yMaxVal) return;

    setSegments(prev => {
        let updateFired = false;
        const newSegments = prev.map(seg => {
            if (seg.id !== selectedSegmentId) return seg;
            
            const insertIndex = seg.points.findIndex(p => p.x > lx);
            if (insertIndex <= 0) return seg; 
            
            const newPoints = [...seg.points];
            const prevPoint = { ...newPoints[insertIndex - 1] };
            const nextPoint = { ...newPoints[insertIndex] };
            
            const newPoint = createPoint(lx, ly, 'smooth');
            const dist = (nextPoint.x - prevPoint.x) * 0.15;
            newPoint.cp1 = { dx: -dist, dy: 0 };
            newPoint.cp2 = { dx: dist, dy: 0 };

            newPoints[insertIndex - 1] = prevPoint;
            newPoints[insertIndex] = nextPoint;
            newPoints.splice(insertIndex, 0, newPoint);

            squashHandlesInInterval(newPoints[insertIndex - 1], newPoints[insertIndex]);
            squashHandlesInInterval(newPoints[insertIndex], newPoints[insertIndex + 1]);

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointId && selectedSegmentId) {
        if (e.target.tagName === 'INPUT') return;

        const seg = segmentsRef.current.find(s => s.id === selectedSegmentId);
        if (seg) {
            const index = seg.points.findIndex(p => p.id === selectedPointId);
            if (index > 0 && index < seg.points.length - 1) {
                deletePoint(selectedPointId);
            }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true);
    
    const uiElements = clone.querySelectorAll('.ui-layer, .hit-area, .internal-point');
    uiElements.forEach(el => el.remove());
    
    clone.querySelectorAll('.curve-path').forEach(el => {
        el.style.opacity = '1';
        el.setAttribute('stroke', '#000000');
    });
    clone.querySelectorAll('.segment-boundary').forEach(el => {
        if (el.getAttribute('fill') !== 'white' && el.getAttribute('fill') !== 'transparent') {
            el.setAttribute('fill', '#000000');
        }
        if (el.getAttribute('stroke') !== 'none' && el.getAttribute('stroke') !== 'transparent') {
            el.setAttribute('stroke', '#000000');
        }
    });
    clone.querySelectorAll('.projection-line, .asymptote-line').forEach(el => {
        el.setAttribute('stroke', '#000000');
    });
    clone.style.backgroundColor = "white";

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "grafico_funciones.svg";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const originY = toScreenY(0);
  const originX = toScreenX(0);

  const activeSegment = segments.find(s => s.id === selectedSegmentId);
  const activePoint = activeSegment?.points.find(p => p.id === selectedPointId);
  const activePointIndex = activeSegment?.points.findIndex(p => p.id === selectedPointId);
  
  const selIsBoundary = activePointIndex === 0 || (activeSegment && activePointIndex === activeSegment.points.length - 1);

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
    <div className="flex flex-col items-center p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen font-sans" tabIndex="0" ref={containerRef}>
      
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
            <Activity className="text-blue-600" /> Graficador
        </h1>
        <div className="flex gap-2">
            <button onClick={resetAll} className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition border border-gray-300"><RefreshCw size={16} /> <span className="hidden sm:inline">Reiniciar</span></button>
            <button onClick={downloadSVG} className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition border border-gray-300"><Download size={16} /> SVG</button>
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
                    {isWorkspaceOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>}
                </div>
                
                {isWorkspaceOpen && (
                    <div className="mt-4">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">X Mín</label>
                                <input type="text" value={draftConfig.xMin} onChange={(e) => handleDraftChange('xMin', e.target.value)} onKeyDown={handleAxisKeyDown} className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">X Máx</label>
                                <input type="text" value={draftConfig.xMax} onChange={(e) => handleDraftChange('xMax', e.target.value)} onKeyDown={handleAxisKeyDown} className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Y Mín</label>
                                <input type="text" value={draftConfig.yMin} onChange={(e) => handleDraftChange('yMin', e.target.value)} onKeyDown={handleAxisKeyDown} className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Y Máx</label>
                                <input type="text" value={draftConfig.yMax} onChange={(e) => handleDraftChange('yMax', e.target.value)} onKeyDown={handleAxisKeyDown} className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                        </div>
                        
                        {configError && (
                            <div className="flex items-center gap-1.5 p-2 mb-3 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded leading-tight">
                                <AlertTriangle size={12} className="shrink-0" /> <span>{configError}</span>
                            </div>
                        )}
                        <button onClick={applyConfiguration} className="w-full py-1.5 bg-gray-800 text-white rounded text-xs font-semibold hover:bg-gray-700 transition flex justify-center items-center gap-1.5 mb-4">
                            <Check size={14} /> Aplicar Ejes
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase flex items-center gap-1" title="Tamaño de Fuente">
                                    <Type size={10}/> Fuente
                                </label>
                                <input type="number" value={valFontSize} onChange={(e) => setValFontSize(e.target.value)} min="8" max="48" className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase flex items-center gap-1" title="Tamaño de Flechas en Ejes">
                                    Flechas
                                </label>
                                <input type="number" value={valArrowSize} onChange={(e) => setValArrowSize(e.target.value)} min="5" max="30" className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase flex items-center gap-1" title="Tamaño de los puntos del gráfico">
                                    <CircleDot size={10}/> Tamaño de Puntos
                                </label>
                                <input type="number" value={valPointSize} onChange={(e) => setValPointSize(e.target.value)} min="2" max="30" className="w-full p-1.5 border border-gray-300 rounded text-sm text-center shadow-inner focus:ring-1 focus:ring-blue-500"/>
                            </div>
                        </div>

                        {/* ASÍNTOTAS */}
                        <div className="mt-4 border-t border-gray-200 pt-3">
                            <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">Asíntotas</label>
                            
                            {/* Asíntota Vertical */}
                            <div className="flex gap-2 mb-2">
                                <span className="text-xs text-gray-500 font-semibold self-center w-4">X=</span>
                                <input 
                                    type="text" placeholder="Vertical" value={newAsymX} onChange={e => setNewAsymX(e.target.value.replace(/-/g, '–'))}
                                    className="flex-1 p-1.5 border border-gray-300 rounded text-sm shadow-inner focus:ring-1 focus:ring-blue-500"
                                    onKeyDown={e => { if (e.key === 'Enter') addAsymptoteX(); }}
                                />
                                <button onClick={addAsymptoteX} className="px-2 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-100 transition text-xs font-semibold">Añadir</button>
                            </div>
                            {asymptotesX.length > 0 && (
                                <div className="flex flex-col gap-1.5 mb-3">
                                    {asymptotesX.map((a, i) => {
                                        const val = a.val !== undefined ? a.val : a;
                                        const extent = a.extent || 'full';
                                        const showVal = a.showVal !== false;
                                        return (
                                            <div key={`ax-${i}`} className="flex items-center justify-between bg-white border border-gray-200 px-2 py-1 rounded text-xs shadow-sm w-full">
                                                <span className="font-mono text-gray-600">x = {formatNumber(val)}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-500 mr-1">
                                                        <input type="checkbox" checked={showVal} onChange={() => toggleAsymXVal(i)} className="rounded text-blue-600"/> Valor
                                                    </label>
                                                    <select 
                                                        value={extent} 
                                                        onChange={(e) => updateAsymptoteXExtent(i, e.target.value)}
                                                        className="bg-gray-50 border border-gray-300 rounded text-[10px] p-0.5 outline-none"
                                                    >
                                                        <option value="full">Comp.</option>
                                                        <option value="top">Arr.</option>
                                                        <option value="bottom">Aba.</option>
                                                    </select>
                                                    <button onClick={() => setAsymptotesX(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Asíntota Horizontal */}
                            <div className="flex gap-2 mb-2 mt-2">
                                <span className="text-xs text-gray-500 font-semibold self-center w-4">Y=</span>
                                <input 
                                    type="text" placeholder="Horizontal" value={newAsymY} onChange={e => setNewAsymY(e.target.value.replace(/-/g, '–'))}
                                    className="flex-1 p-1.5 border border-gray-300 rounded text-sm shadow-inner focus:ring-1 focus:ring-blue-500"
                                    onKeyDown={e => { if (e.key === 'Enter') addAsymptoteY(); }}
                                />
                                <button onClick={addAsymptoteY} className="px-2 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-100 transition text-xs font-semibold">Añadir</button>
                            </div>
                            {asymptotesY.length > 0 && (
                                <div className="flex flex-col gap-1.5 mt-1">
                                    {asymptotesY.map((asym, i) => {
                                        const val = asym.val !== undefined ? asym.val : asym;
                                        const extent = asym.extent || 'full';
                                        const showVal = asym.showVal !== false;

                                        return (
                                            <div key={`ay-${i}`} className="flex items-center justify-between bg-white border border-gray-200 px-2 py-1 rounded text-xs shadow-sm w-full">
                                                <span className="font-mono text-gray-600">y = {formatNumber(val)}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-500 mr-1">
                                                        <input type="checkbox" checked={showVal} onChange={() => toggleAsymYVal(i)} className="rounded text-blue-600"/> Val
                                                    </label>
                                                    <select 
                                                        value={extent} 
                                                        onChange={(e) => updateAsymptoteYExtent(i, e.target.value)}
                                                        className="bg-gray-50 border border-gray-300 rounded text-[10px] p-0.5 outline-none"
                                                    >
                                                        <option value="full">Comp.</option>
                                                        <option value="left">Izq.</option>
                                                        <option value="right">Der.</option>
                                                    </select>
                                                    <button onClick={() => setAsymptotesY(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ETIQUETAS LIBRES */}
                        <div className="mt-4 border-t border-gray-200 pt-3">
                            <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">Etiquetas Libres</label>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" placeholder="Ej: f(x)" value={newLabelText} onChange={handleLabelChange}
                                    className="flex-1 p-1.5 border border-gray-300 rounded text-sm shadow-inner focus:ring-1 focus:ring-blue-500"
                                    onKeyDown={e => { if (e.key === 'Enter') addLabel(); }}
                                />
                                <button onClick={addLabel} className="px-2 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-100 transition text-xs font-semibold">Añadir</button>
                            </div>
                            {labels.length > 0 && (
                                <div className="flex flex-col gap-1.5 mb-1">
                                    {labels.map((lbl, i) => (
                                        <div key={lbl.id} className="flex items-center justify-between bg-white border border-gray-200 px-2 py-1 rounded text-xs shadow-sm w-full">
                                            <span className="font-mono text-gray-600 truncate">{lbl.text}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-500 mr-1">
                                                    <input type="checkbox" checked={lbl.isItalic !== false} onChange={() => toggleLabelItalic(lbl.id)} className="rounded text-blue-600"/> Itálica
                                                </label>
                                                <button onClick={() => setLabels(prev => prev.filter(l => l.id !== lbl.id))} className="text-gray-400 hover:text-red-500 ml-1 shrink-0"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
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
                    <button onClick={addSegment} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition" title="Añadir nuevo tramo">
                        <Plus size={16} />
                    </button>
                </div>
                
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {segments.map((seg, i) => (
                        <div 
                            key={seg.id}
                            onClick={() => { setSelectedSegmentId(seg.id); setSelectedPointId(null); }} 
                            className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer border transition-colors ${selectedSegmentId === seg.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`text-sm ${selectedSegmentId === seg.id ? 'font-semibold text-blue-900' : 'font-medium text-gray-700'}`}>
                                    Tramo {i + 1}
                                </span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteSegment(seg.id); }} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">
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
                            label="Borde izquierdo" 
                            value={activeSegment.startType || 'closed'} 
                            onChange={(val) => updateBoundaryType('startType', val)} 
                        />
                        <BoundaryControl 
                            label="Borde derecho" 
                            value={activeSegment.endType || 'closed'} 
                            onChange={(val) => updateBoundaryType('endType', val)} 
                        />
                    </div>

                    {/* SECCIÓN 4: PROPIEDADES DEL PUNTO SELECCIONADO */}
                    <div className={`p-3 rounded-lg border transition-all ${activePoint ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-gray-50 border-dashed border-gray-200 opacity-50'}`}>
                        <div className="flex items-center gap-2 mb-3 text-yellow-800 border-b border-yellow-200/50 pb-2">
                            <MousePointer2 size={14} />
                            <h3 className="text-xs font-bold uppercase tracking-wide">Punto Seleccionado</h3>
                        </div>
                        
                        {activePoint ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <EditableValue 
                                        label="Coordenada X:" 
                                        value={formatNumber(activePoint.x)} 
                                        onChange={(val) => updateCoordinate(activePoint.id, 'x', val)} 
                                        onInteractionStart={() => { isInteractingRef.current = true; }}
                                    />
                                    <EditableValue 
                                        label="Coordenada Y:" 
                                        value={formatNumber(activePoint.y)} 
                                        onChange={(val) => updateCoordinate(activePoint.id, 'y', val)} 
                                        onInteractionStart={() => { isInteractingRef.current = true; }}
                                    />
                                </div>

                                <div className="p-2 bg-white rounded shadow-sm border border-yellow-100">
                                    {activePointIndex === 0 ? (
                                        <EditableValue label="Pendiente (Der):" onInteractionStart={() => { isInteractingRef.current = true; }} value={formatSlope(activePoint.cp2.dx, activePoint.cp2.dy, 'right')} onChange={(val) => updateSlope(activePoint.id, val, 'right')} />
                                    ) : activePointIndex === activeSegment.points.length - 1 ? (
                                        <EditableValue label="Pendiente (Izq):" onInteractionStart={() => { isInteractingRef.current = true; }} value={formatSlope(activePoint.cp1.dx, activePoint.cp1.dy, 'left')} onChange={(val) => updateSlope(activePoint.id, val, 'left')} />
                                    ) : activePoint.type === 'smooth' ? (
                                        <EditableValue label="Pendiente (m):" onInteractionStart={() => { isInteractingRef.current = true; }} value={formatSlope(activePoint.cp2.dx, activePoint.cp2.dy, 'right')} onChange={(val) => updateSlope(activePoint.id, val, 'both')} />
                                    ) : (
                                        <div className="flex gap-2">
                                            <EditableValue label="m (Izq):" onInteractionStart={() => { isInteractingRef.current = true; }} value={formatSlope(activePoint.cp1.dx, activePoint.cp1.dy, 'left')} onChange={(val) => updateSlope(activePoint.id, val, 'left')} />
                                            <EditableValue label="m (Der):" onInteractionStart={() => { isInteractingRef.current = true; }} value={formatSlope(activePoint.cp2.dx, activePoint.cp2.dy, 'right')} onChange={(val) => updateSlope(activePoint.id, val, 'right')} />
                                        </div>
                                    )}
                                    
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-yellow-200/50">
                                    <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={activePoint.projX !== false} onChange={() => togglePointProp(activePoint.id, 'projX')} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Mostrar proy. X
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={activePoint.valX !== false} onChange={() => togglePointProp(activePoint.id, 'valX')} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Mostrar valor X
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={activePoint.projY !== false} onChange={() => togglePointProp(activePoint.id, 'projY')} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Mostrar proy. Y
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[10px] text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={activePoint.valY !== false} onChange={() => togglePointProp(activePoint.id, 'valY')} className="rounded text-blue-600 focus:ring-blue-500" />
                                        Mostrar valor Y
                                    </label>
                                </div>

                                {!selIsBoundary && (
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => togglePointType(activePoint.id)} className="flex-1 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 shadow-sm transition">
                                            {activePoint.type === 'smooth' ? <CornerUpLeft size={12}/> : <Activity size={12}/>}
                                            {activePoint.type === 'smooth' ? 'Puntiagudo' : 'Suavizar'}
                                        </button>
                                        <button onClick={() => deletePoint(activePoint.id)} className="flex-1 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 hover:bg-red-100 flex items-center justify-center gap-1.5 shadow-sm transition">
                                            <Trash2 size={12}/> Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                        <ul className="text-xs text-center text-gray-400 italic">
                            <li>Haz doble clic en un tramo para agregar un punto.</li>
                            <li>Haz clic en un punto para editarlo.</li>
                            <li>Arrastra un punto para moverlo.</li></ul>
                            
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-6 flex-1 flex flex-col items-center justify-center text-center text-gray-400 opacity-50">
                    <Activity size={32} className="mb-2"/>
                    <p className="text-sm">Selecciona un tramo arriba para configurarlo.</p>
                </div>
            )}
        </div>

        {/* ÁREA DE GRÁFICO EXPANDIDA */}
        <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-gray-200 overflow-auto relative select-none w-full" style={{ maxHeight: '85vh' }}>
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
                <style>
                    {`
                        @font-face {
    font-family: 'KaTeX_Main';
    src: url('data:font/woff2;charset=utf-8;base64,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') format('woff2');
    font-weight: normal;
    font-style: italic;
    font-display: swap;
}

@font-face {
    font-family: 'KaTeX_Main';
    src: url('data:font/woff2;charset=utf-8;base64,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') format('woff2');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'KaTeX_Main';
    src: url('data:font/woff2;charset=utf-8;base64,d09GMgABAAAAADuoABAAAAAAfdQAADtFAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP0ZGVE0cGh4GYACCegg6CZcXEQgKgchggaxlC4EYAAE2AiQDgiwEIAWNcAeBOAyBChspbkVHc9g4ADKgP9YopJeTU3fi/1OCJjEGaMf2Zok2DGFrM4vGOGBVn7WdtceJFVTkosPHbpnatHEcx8GOqqbRXjypX3/DTyWCKnLTMW57r1avfoRRNYl/7z1CY5/kcgdoTjtNLn6aOHEsSASTOMFDSDANwbTiQEtLqdjE+qNmv3bzyo+2m3dfmRkzozOP//81te599H9VSSqDrEkZAuw0EBgDqCiyncmUO2GdamdoTbTlzXqW+5nUWXmBTBgCy7JMECesLFDoiGD6r6/qnrLXdd+UzxN0b76Z3X8MlwQrHqZyRDpYBEs3ClBAf/z7/+penZMRSYWnvgDZBfrNcUmfgiAVpQDAsKowdpmv3PKy1f83Z+99ssxJhj1A+ePIAWmAAqh+lV0YBOczbDZzuluU17/bRf/XVP1YgYwf+EeeJCrmiUeJVGsupYKCe53SVmrlZWRzLR3k2aGf8/a8vfJ87k7s5NQzfQK/rba0S9XyrgXnO+r4b3v6WMUypKKjjg6x+jT9t9h2twWw1FHJFqVsK6QLKUDC2UVlSN3ygyAXxFzDi+ZM9f+9qWb7/oISIeoCpXOIdMQFnoNiH+JcUdqVx02z+9+m/3eRdkkesKBOwDKcSIgKgJKhhKQAipcUHCIdUgZBRZCXwIu8mCqHnKoYuhSnd1G6qz2uere9u842RqMMwNxEGS7+2xd/riuOhRvIfEnL/VW1IaaVdK30c/d+g4QADQjfvQEAAHuBj+WRzbemd1NPfIwLGT8RMYM2mtM2kNEyao5kNxSgp14EANvfngz8YwmUO5aAm8vkvy6uRaCTfgzNmuVGl/xJdm/wp6cMTfHDL4ayTAGACYOHKevujp3EWyNOQjwdPTc1W70K6THZgm0yhvbzjX7y3rvvvP3aqzfE5rUVNhNAdKSQMxPgMSELEDAX4wDckC8QinCCpAB6cwYjlvw/9b+OtDq9wRgbF5+QaEpKTkkFzAAAWKy2tPSMzKzsnNy8/IJCu8Ppcnu8Rb7iEuDBggxGGp4RoX/B89FfowUQAwDQf9GvZ039JWr7ICVvQBFwrIuGaPwPCqfjcA7faOzMo3JuN8gfn4EJ99eD5+EqrwgpgXPAcCEDMVbFIIVithGDKVojfPGDJ2+yCgWmuFqce6slS+HPitjb0xL6XBCaEyua54YCXcKtobKrzBAhwgbfIIYvq9EG+Tu3goDZTV5czIMJoQ71dwJrjBEgaQwDe3rdmBiWoiKBC7dGsM2Mhh0rOLESUhpQFoMrlixpLdgPFI2yfvpGgohXAlZNmq6EIV+8+71Chg1bgCez2s4IN2c0G0BUH+rKhV+ycok2txVcM5iBoQOO7qY4E1CWO7AHG8wetgjsWnNcRXZmhGb1D8cDEuJCZ4bKtoXhcJ7K3BCmqAYk3uDn4m8GgqIk2XQwcGGp6OMhrYFlYR7QVSjOQ0MkSqdgV9AykFBCGCVHgoJbyFGfymdhYH2jpWBpBiRtlFeBsW/wCJiIUVAtRMSWGZMg6aKHY5CfQQ5IXjySI4owispG9IfjoY+Hrg80lnymFzDA5UbV+IIO/FHBdHk1PuYrfWyzc1aPz5/CQjbPxMnHVcDI3qI+omSAhgoj0vjUy4QKuTPJbwSKmGCJyQN+6eBC+TvSHK1J9lQnTUECTHrhuLpBzpSRj5IhT7SKieGIAWjiAsgA/YyILkeeUFEAO1jQGIkVFREq0yKIQZkie6MMf46OVqDgvvLZH+OOxGcp7pgYkypgYjDGlAp0gEhgMC1YMCNwmBVsmBMcmBdcWBA8WBT81auKEtA1e2rw3iPhw+v0korQl2aSZbJEinSAewKDFcGCWOBQEmwQggOJ4EJZ8KAi+LqKkEIGqykWoxnlreD5iNAaxFXKbbSmsCqxWpMHriuichHBcNnluCUrnigipBnBjQgNTxHWa8GmqaK+Z3wMboJTmKJjS9Fjk9k2dC/8Ro8DkvoLL3IR/cDjy6fwgnNhi6YGYuwoSqlscgQwRaxvpV2VtKUx6tQJkFn12LihAkPUTYk4QJzcFUf9XTkusyO9IlrGMcYqqxNNNQ/EaCogAhfggqo8fDO47tdiotQ3EXO0WigR44LHitAhZFW+qt7X31mxsii+s6RyzqhmMOkZ8jFDiEt9j9zUJm6bIrm9L8OMXWNYxq0VaR12grhthvKyRRxTORpPuORyguGZEpjQUNFeLW1NbvB0flL4o7Zwr7x0DnjilCHs8AorN3RZ6nRzQtuLSORWO4EhwmnO4ulMAy9WRFSi+mjAeHcR+qCAejgc6YRSlgJs/hMRbNTDjtgoGV0By7EqmMRKcHicybx3R8CVkds1dF4v1WhG+oqhFLiypTlNqUnCGk0OWuoHc830oxkKk734rxSaUm7mfYWW9MVimi97881hDXCTYA0dNEkGiZaFcaaUij8nMf61Cl4/u1U2/lOUE5B6QJuYF0w5J2TIW6Uxk3+DhwqB8G2r5J3iiuY1+c6cqp9WhqqoN5m8O7UF+X75DyqA1mHsUuJHhYYG6aEQFZkSKvl4CJX1k8rIMNLVGj+rDCgI+UUg+LWBQPYE4vtkpCgc0AKHDQRyJBA/LuS1cEILnDYQyJlA/LyQvHBBC1w2EMiVQPy6kJJwQwvcNhBIJhAfFqKEB7TAwwYCeSTQmY8V2kjzJ9Nh9KvnKRnAMwtRIRqeBzsM8KKuAy/rOsargWh4Heze4E1dF97WdeFdXRfe1/fgQ10PPtb14FNdb73P6rvP2f9Puprre49hlWauVisV4qgCrUQeDeOR9xsOsBJp2Y60//eYpRp6K8HsWrHrj01SQjr0Yy3OHYAVW7Q32oQ2FGT8wJt8iQdkQ810x6MDOzr1tLXQ29w83Fi9PFbVam0aS8T27sev/c6XwYv1NvGy8ylVZeLjjB65/vKwe/Pms46u1iev2+O647R9trpb3dpNLt82tI235NrTUmHuxUc7b6rskJ9UWfqxyG5XGRj3mNYLCgWQtLonBpXOtQiIYLHIQqqmhEG1yxTVIlBAwtuqAE0e/gOvciYSOWWGiYXXJYWR/51oUQqSOouKC19+QWUIoNXxHY67GFA9tdPNDFFxPMXgvk+ldRrsQXVEXAoDNyFvYchtX3By6Z1tpFSC3PmJ+RDEnXHzbqb9LO8K8qftXeMYnEsYjm+cjraN8TJkQOxPfWdYsCCw+BFIPcUrAMWJKkcL47tNvig+00+Aq8vwHFuEmFu0428kqGQ65fmbetXbHO/PEabMBFH9cYxLwtMF0WeTKyZz19VOj6pOQbgwuquOm3SAGXtku3FGtiMPCuLEMANliI8L2guwbHuew27GJTEldzoAR8+Oj7OCTpPi1v3A8ZxUkaoLqtTnQF3eDvhXwGonKjYYBoLq5QkvU0DCW09B5Sr1mT48wjHjCBLnHL1UmV0Mjp8mt6yEZzQPTzZ9V9CMqgDjUOBHEbZQwmEVJEopox4RlstghZaZKtQ65VkwK8AuNmxPLHQzM9UeJ7wRNGbLMKqaVTtGzeFi4dpOJ+MCJMrNqVWev4ZZVCwqw3H0re5B7/TXBWX+Bo61s285jt1m4LrutIzK8V3ubXA8pUUgopaFsJdNbZhhvLRN5Y5FWyxauDKWsSR6849jVAMM08Y0FnSyviC1IMMPFhhpJsYX57HBqQ3gumXJtmBX0Q30t+QWHLR2+ghevmLJnWICtT0C3Eo4jevRgogeo0/KjKaLSV0G99bLj4LCODOImlMjP8ek1bFxv9kJz5dSxycdGL6GDRRuTlYcE5Ouf5Kszxk6LupRI8c2kSP3NwF3jW5c0D52PJhkWfWQAeWL31OgOrW6k69GoiS7zOSxdIW5JzyjvSftI8BfxMSB1Ev+lZ52PF5GURPb8rqBj6MIYjBiWXTsQkAvPowqld1k/lAfdnQohfcbpXnZTCWjk9ad7Muj22o9q9MrujsKWM6PO6GAAjE9TvwnA7VouDDFNTDVcLyS4wpVYqVGwfMwzrq2rC6tBRny8F6E1R79BFWO+lZbrcAEQLkxrUNqx9b2kJqzUQyGvZPKibVnE7Rop3ZqdYe2kJrnMEvMBZJhfWoutbJxMluKrJDisp6PSrRhSgyqUzF3LHfEYuubYOPMEo9cbZhCfXhxgrbP01mLFT0zYXCvr8YRfeQgL+m3DZP1YRkiObZkzI16kSzx6PRavpvUNcmNAT3RDxHap+mTujiXoCeJUomVUmQqPmMrd8TITXToPaf6+VhOU8v8sKO0myYMF6HNynFV9Tttnb5G2X4cgywikGcV2qydYyUGqua45CLtM/9PQPSRY0PUqVpRi1ouyuhJ2JtdQeI4nCrr+AD6UnguWTRCJUtDoyMj8Q0UbisI0GrFuME+lycUQY16iqSnFRTYa7MaNj5uGQ0pvVHxER5apR6DuNOH8WbggvQBlsAiD1FiZaJD7xfs2clscsWESK/nK9lcNcDnklpMi0YD/TyUDsm498QMEmsiXjnhGqpcDg9nK0QdZip3FG6vKzhYhdE7ufquNrSM828xtu5xwPALFWwCLS4sil8ISt0hbfmjLjR2JZ2WpTxqT/JIwBx3f5E107LJYaNNswKtauvEiQaI+9v/qGau/12Fj2CKT7iRCHUZq2oAd/XoRzmSycqavnt/GHcM6pNsPlzXjzuoCcM87l1sbd07Sdw7NO/6ERXIrZmebYF8kINvmgep6KOUuXDOIDQuA8sDh+smPsYU1OaLgKGUVZjrsHE5yzTlNZju2cmp9sM2MwSBFE1pIDxC25RcUMUdOASxhBk1SeRlGc00I5mjOA/yZeFsk+jFXcRA3Bf9tgoFNTfrMwFuUZSV8MvLYEyOuImR/I41BzpLelOjuEiiTjOJMHB23STG+Vl7/oPn3q+5eIXBTDN1evE3cK8PIUNm9aextQfgC3rutx/HSubPRMmYhsVKI83MeaJVHW4fhrF4jQl8ukSkb5G16AvMFaGU89iaerYpe/ZjDqTDEByZ6OfvXmygjyHLNDbvwXiZUetUekJyQUpvpcuFqf00t8LgVAKTFW+cO4P+LLFznH6CD26CbbuOERr3mWu4Fd+jy5atPIR7Z9GDoVc9Eo52IWdEiKg8voOXk9Nt+isIwwXu7yMvqYJRDMe/WBDW0v/sgzmvSYjOAzfXBOCrMuzCWDYM+ApraD5oKHairZCw7znTQdZ2sjMpw1COcx9LND8nwXo6y2+VhubsaUf37AMI/IXgezNFojAMuUVsoqVitRqdspfhpOvHLUeNpo9qSyU4TIVPfHg2MqS11QtyH+xwQH3QfmYmda9D7ZJ4o84xDNUZVNWXuxYzEgtoYcNjLvDv4HnMioxW+nbiA2Urq4jH5rDTUXynwO7DbrQsNEKyrD4l8zfSkwqMzqdoXoTw344h5OLvs9TvxnWNH0ZquneJ/a6MA1Wq1SgQFu3oTS0MZY87AsHua/kPJgGy1ShD+//UPURRZNc0JKnwyQCvEIriPKejg9Dp2NRODxRObtPejLYVJlQebzNHXj1qDmdtCGrWET4+v8gx3bDaQmWbdf7htCe78+whVpGJKKttljKFvNju7NNlnUI/gTIJKzrJCrlKje683FJFAA+N950yNrUSiFb3cjHvDH0y/2ISBydtvD2s4+pL5NBUCE0JjTtbN7v/9ZD9Lp/FQJyX1/Cqm80ckjy7Lp6MLXPBNOxybzFlSRi54RN3Pc7Ye5aQu7PqPo1lv41sW9N5BKc4ejBeUbhRG9tgVI2jo7BX9pIRvxXaNtqOTo/ieI/B+ax6OcaePMqHc3l/SI44DIfDXAYLeDe59iF0mXfnyzNckaQSOU5+/f5hHz48P9gkyu/EGnHcyoyPC300ay0qp4M+9n2jdGcS0+RC0b9Gep6nyY62BmPAjdA38HGzurLuOApklLI6aVSQJecxZEWr0b20Xh7oistOqd8UaqxKTWSZE5ruAsaxGHc5vxSViCap0uSNPZSyhx08r+6/7oot3jdc46V05qB0Hg9tO7kThdBK6iGcONdggIKrUdef7I4bLdap+riH1EaDs8YZx6l+2mdlvNRrjO8kFWw5M4cFpacVfHr/bteRxIJViXiHHVCX+4nB/rgUKqqj4NSL9ERkX0VJGBqG3mWGcSwsbTxu1pFM8BB0avxgjv6MEQzZsl+TZzd4yTHy/ZHAOBf9HzL977DyGN6qVnskqN3QmMz5VjoeG6ba/DreqeUCPRgd+3aMY61PKCdubIZb8MiJazWSkQ/JSt2scqul5XLx0Yd0D6BJ4VTvRl4aSLiq1rIU8f29aaSWG0uxseRPcdicCb2y7EzQ5/YER9r32IwAiFV9rQHTRu1F61r91hLZ1wyxifw7y4BAM5ZLnUG7VhB4Cz6uz8wM3Kp9vWgyTkh7nsMoUDAjHS7c3vHRpirFVslLjn2TqMEBp8fHHD7h188zB9EYV7XoSrHbD0aDM1RpmD34vVqJGTkMD+DXDuM9e8plcL32+uP27esKjJ3ewHeHcQS2byQ3ji7KWNrWHeIOLay0J0EkCMzaRMSxLgNqdOxA+qTFKMTNvuKxSveQ/bhWk8/hfnA2oeUdJ8cvhUJbynTVqoMKeYumpbxkscWs2+Uq/vDETr070ICbhJRMvtfaRgUFihSvntoxpe4CTJh7ddjp6UYja8qswYm7zN4ZVaQ1/BrMLiFC0DEdSh4Dw+BOph3TTu0Plpw0rTIBzJ1F0TTz4s9gbyDVaMf9VOSOrRZby/Fdg5GAul3kCDYPa9xOXe4p5XFVpeZ3Gog79tlk8htc6KORyqg2Z8pqc1Nq4vZSomz6ag1nV9+O9jPV3rGg9+4LC6i8pwVReHHV/WphmlQoPsoYuUtOp8V6zop9/8f71nsayok6y48zx301rmQ+1qZHkeqJXu+xigvEgkRXoej7IQ3FaInuj6vNKi/glyXaQwAUADlOO4Ly+/pvTz/NHHUFfeaYZVnYKYylmdJMz8xon5U+q52b085qtxiyBNgpNlTwbzy0acbymPQxy9xWGHJx4eIVj6xMc5EKqrnA+1GAhXwCI8eV/9llygUh7ad8yTGxMnMG3J1f/mcERp4m6fnmUasNRmvrIuoHmPMS8vP9WuYlseoly/577njIruiPP+QK2uw+cplMlV6nhtZnnpfPxNUk1K/N+eKNDON+tRD979LLtlvxh5PUby+30yrbr29ZX1Gvm4jd/NvXNE+4AdFAc25lum8VaEGEGM+nLo5D2G2HAF0dhA+6eWQ9qNOGQB0P6gEZeTbd1rPsBjjx1PCblbIf5JhkXh6YBb4LxHlqWkqkDScylvoLjud/71gFsrSNXoGasj9xcz7XzZO4oSRJMPVJC9xhORN+mCNY8e2BXIhh8BCM5NBF4bVFiYHUv47xylqk8dMG3sNPVoZa/pSL+ngBVTfMEQ36KCgG5T1GiiSf51e8Gm2lCuF+ED6najM3iSW7JExxseK8UyJ6N40i7ycFa/teOo5yPhPqvHr5TzE4w7M70+yp3nRv6tsrxJLd79iLj7z+ZaBx+/parE2Y4cz4L0rX5Oud8ttjsPPtWOKuv5Z/T1VckVt2VAGsUUgY9f99WHufG1p5ND67IrVD+wuMqefdN5+s739JL9IKQQTskpeGfjpxoltoeksMo3QF7lq54n1KkMrHmAamDoB81ey0c9X9KPvn9Tghcr2xtft9WnX1amoYhYPVkBGB78je9MejCBSCqHuvNSU/buErDrcjpsT7XUyoJyfNeakisv1AMw470GxPUUGbiwoRMoMEZltfNrJuchVvMPWE26A+pihKd3c7+LdvxCTioN5NfCszv/GRYQhCV8D/DeLFRk9poqxR4MxqYC84c4xn2pUUx6dOfnC0xZvtY/OUdgliiNcRUtITfyXmpop9zpjnzTlH98o07Jj4FxTi0pinxn9a4j2jaflETmV31z7fDxAECaIYkjnxxHGcwEPwp1rrrkw/T6Godh3VclMczWSGlvCz2HgIRvYf+amhdfQaIY2juA7ri0dZ81HmwXvzSwuzWrpdex8B2lbWujhiob0x/BnXkFVmeScsNVw0Ng1mPvfS73J50V/drV/ZX7AFfamC9rI3tlQF3ZrqZDhbFbdG86cplJDTUPowiktGGojW35E9xRZZydx9x7cSbpzeiVjQL35XCB8uf8+uiqCJMORKK5a3E9rslrb0JOUpOnTK5y3GIJy1jnU8pO5LOrisozTHU7phSMjRYpX7S3It9fQawsM0qtSAKnbpLfVZbRT5Mp25QKteVjEvMap372OpT8ak5IkbqercolXkOITcRNB/o8eMAgDXtLUh4uODj4Ep7VwBF+4FGOKTd+oBaK8eJx1aXYggXGSxBVyWQkRg7B6d4KMAXQ6QOAYrIClkMLehdgmajPje+F0JZWDyPXwjmZpcwxWAMCRUE2aLqbL6TrC5efidu/NCjz8GnOshqZCEVrYutpY/dPBAlqconQkqelqcoq6Rg0CkFQVAwI7E7rQjQramy0fNmRAQhEKZZFC8v7PktL+EtEvA+Uwq92cCKisD9vB95Xula582N9QC0MoO3TYQCQKucz/bfV2FCd3bFr4tzWko7G6qgzTFCR2cCFvcsECU+NdvkgaSqkUMg3TLA1ObAvSMTuEv5/a0U2VbYhkJvrV1PP6xSGiMh+tGvIJMIwSkeSEALbAR9Sb9HEgHRHiIzfDT73v77rzQQ4+0BdiRTV3j+YO53Q1ZT3h4k48ArQ2TWcKMTobAccWF0AJNOhsPW1JnYlq5ZTaBx131JiheVC4y8/sLvyOrMz+C4INpMeYun26rbtYj4Zun/RqGTLVbiGg0ginfBMWMaBmCplTqzPG/Ep0Z9huxZN4PMKimC08viOwmo54kMkBAs1E9pQd0OK6rdm0gif//lpvk5giQUqDhk0pe4NXY1nu0FqHAEkI6/glpWf/xAgRXbm34rdqUISTVFPnp9SdaYTaEcNAiafrRALSbFmn94EKsQb1BPWne/UvkzpOQDKJZI2xRGIULopSYEUXQea2i65css3q9eo3wCqSjDrB4YRqnGgCtxg/8ZyvTP7tvufb9CtuO46KmSV7K8Tml1U1hf3KFCW46fZGNna1OEuvwOrl5TCvIBBycEJKaFxKYmtNvGGBkiXimpOS2knOtwwqQ6S7QYcke5bJ9U5IZjwd2SNp6owUF0PR03hc4CEI/t0kEwbboVOZwpmHOhMJ6h38eE6Jqhkx1WDQcOgTKmqe445UHnRgETk9rNms3YdD1qNq4k4LUy6YRfqJEYu9KVlw01ehbnNdWsUPcjaPb/UhVHTlnQtgHbsWLM+AkixM0w3QTKG89x4tgvYRV5Z+Z0W/IoQtj3Gp6CiFTzE6cuNwqdQPCEQ4chMTT5EijcfWXtLGt8qs2OsebZY1t1tJ3Qor4MbsuGooVOZ7Mej121acnPADuDIXVNCVnlGPnu2df1XiX8R7w4NY1PRUZElAYwGPyu5xBgBeBEptlcRoTDRpp/5v1IQvY6m+pjNe15R+XF4HPzlNeSJMX4l/2kaUAJWDIpEIvL0UOW7aaZ+FDr8JgzdMupo4FO89NMqjSKK85kaVBUgGcsuCvtlDbJmsEGIKNNABM3PyR8SxomxlC7O6wi3TVqevze7R1EFz7N0DJF85vKgKEAdID0NSPUMZGAu1qXG1tWh1oNcAHyKo5/1bgDuB8BMHu1pGySaje1pePZZ4eUXohjSki1NaJywCSz5Ap2DW2uYTuVqCGpBjKVkY7onYM1BzCGd4FBB8VU3bgrvwIZsoPi36EMjerNB9pQ7AmL1Tn89NE3a/1v4NUfu/TuONs2k2e2sGxplnzQrzpDK4Z455dhDCX+xsHN+dmt2b6tLjHsG/mDrGYiNh2qUKNvTpw7W+weh/FkKmgGKZALWyG8SKQLnPMKp7mq27W8nu29/hkxYahUE15Wb3ydmrzUlHR2nWb3mvOq7B9eaPS1+HCg+vCLVpPaodoA6MqzW7N8ZPi0X9WeL1xEzFN7HL26gL9HwdCF/HcWeBASKh1iAzG7OmO8v/PtAA1quWPp4hBOm//Uf9wtd8OiECDu4tA3XbCQ3ggh6ftF/c13HuRTaKndskul0I1qnI9qnFsi2+V9R9jQTZfdbNVkOZXRJLdDAtbUzJYOj5oPYxmZ7g1XBNRsyYH40jZ+5P31PDMX96Oz3MlqQNpA/K7ahypM4oKjj+dLC3sWOnnV5dVNLYaH3sko/2DRQR8gK3fo5b55FqdNj3Kmumv8YPHgI/xqe+KK6zaaGLtVKK1etzJ598Byd9gxK/9tEmexMWy3kSetfMLSzMy6W/+FeTi7YsF6mnNpC4ulsVhZlE1oLRxjzzZMLLCP8KfJ8uH6UA/VUqWvw7uVuZlLN0gr49Fxcf3mrz5hWT7Vq9/r1ySv8l5w8eY9sTYy/g7e+sf/4Eb3P7B9lcI0A8JhFmf6nQ4xq6iEDaSpZoezKpvz1c84N0cP/CdnRDqanBnbc/dfEPX0lZi6yWbAdcgEB+Ds79IeO+a1KKT5x51U6jzpcrIQ2sQEICIZXgTGJuERodTHNucKiZuBZOebHfoiW3JCKSLeID4ZZxB7lke0wNIyaX3Mzj8h6bt8EW32EOyYbgqucNUr26+19a4iqmKDPilNlZ4H+Ze1uuJxy/LB96F7HRag8X76l55Ndy6ShizGAbvsQX2rINxF7esFFce+fGv4tzlpzZEoISPEHD289mvDXEsyThPb7MiTNJt0+AEjt48Ro5d21EfYeh0SJGrKABV8UKaoUDIBElBGnIg6K304R+lGYJv3/bVWnoaY0nGOgKitODGbiy+iyU3zgDYDHEMn3j1q/ROEUjBSp1IpKt25YV4HVlDEGe2MsWm5WfOY19jXwPZrPdMeaatzRDMEm3byBcrVfBDURq+OIaNdzU351qmzVEdYogQwf6W87bk8zUNx790rlaBERqfYCPSZWDWFbuQh5jyqxdLIR3Zs6pjPDc2eUvSBt3sDTl6fPTz9ubwdnP5Gg3EnXWYQvN72PFiqPA8NPMffR+bl7/AiyWTIClM41oEFvkgWfo5fJQGYN4DGIi9vX/Gb7grLfNAxrxt6w1VBpTksmjOAmWKckCUp8nUguBZ+Cb+Fgus+BR4PVDbQ2awpYSQi5ryQvybmbGJ9/9wLCmQP174w+Ho2gdW3iWL9Dw7CHKmHk4wMyk0OYtqXPauEnDNGzXSiO1M2hlq1Q0dFzKZ04S3skYhLtGd5Kb27NvDgkIx0At/pYEHWLRGwGUnSKAMP0tw9/mTbpg/CP2W+FuCHWhjO0TyN2JaI0U8lpF1JL5DWLSPEjqYFSHAT8hoGjDnKwPaijirQpLysNYilHBhMP9NG4IQr93bdBkSunYBUFnN9yXlhrKztTaIK7Jdd+lWuju+dBeCusAr7f82147wK8VeaYpErLp89aKeLKk2azgoQegQUCUJLUVU5skbHBAIEh0ZJLPDUpkdcx/uDAzVjymNo5t/Tth1+q849WKN0oG7yEoFltp+nKByFw5d7mDqpJ0swer9J0Ev4kH5pGajfg4J3TLlehpcQXNV+SZBSpo76Jarex/iVx9aYEKwxqnID2QJ2nees4obCF+cWHwqjvPprt463Cnvn9i/fmya+cXJaAOrhPVsqljTThq+7Zy8H7NRhg9aaslNaunUanvIqSgSlnSsdElVUm4jYadFKlROdBBGdc0DJ0EP4kX5+L5KlFJfme6+uCyvC6Oqhtc4BaOUCqZp6zVU1vPijomXVw29ohY8m+naZ7C8gOqjXPsgqqt0mEXMVJUgzSHkB26et0s4KSuIELXGDR/Wd/3+903wLAzHde6MFagLUj1PPjst/ltKMk6xqvw8F5Q1Qs7PbS2tMTWxKP5clsAunwPTbEFxQb7Lny6f0z/1pqT9+6V+B65/XaP4RUkESTa86mmIRoWfD98lKE6hGtiJih3SjVBSkt9HrymSnAIhTLpUvKb7av8etv4XjQpREME/eyvwcVwK1EBjjhh09tJp+MvXQRDQ4pNm8uA3toAdCjbtjP47Dd1AP/0cSOMSfz6Fzv4m+0Oo4I27Wy05M06Zs+tyeTp/ert7PwBtXIU54R9N0Aj0/P9+lfcR7t/s/77G4ek263dBy7j2tOcsykt/Kv0CXIGQBJl6P2k3uXksgrBh8drREskoHnshlvkjad0yqYxE5pWY3YmZg4celPfKBx9c/j4l0PD3Bi3x3Tb3VQ2jlxBdhMQhJkLUdsOZWBKB6n6GqnEapzT9Jy7pBcmYEcAgzu/haYhtvEIrQJZK3islwbRyaymnloYlVBcpaaNJz5OpIZgdtXSWCfZgBcE2odz87AnF0FUwWu2VjTL6ebXcKiE6cO2VKlQR/vr73I45TpJQI4kVZH/ejOMc9kYV/C6Ph+/QzfDXILtjtcrP1Lo/VXgHLnkobbKmKFDdMrmw8GQn7PAPyypFBUMSTEljloPkzZ5g0K7BUAhiow4YJsxK++hneEKcidODpbzmuGpHQEkHXT2nFnP3uOjqj04hUN86bII2UYS6VCtzf9BMs4Y6/NrNjMoeV9bn2YXOmdv27FMrdp8DZs/7hD9w+7B2lvLS36pKEQWxQApPVw6a3Hzdfl6SKvSQ1vi+nqtgZnOSJsdMd00toYMPyvrU6+PeyVNiHhkqZ+Slr4kVa5/V2x+clPVc+wVxRRZbxdMygh0IHQBBWoBAVX4mBPP+hiI9MYVhhkauRXw2z8mVYDQ0dn/cATiZrxXDH7977N+hbnTvW5NFWeXuQFNJ09SJZuoncZG/sURRxPRnXUl0GmI+HZfXKZqsKStsMfBuKPYdE/QE1OJts1L30ULPis4MRBtnUxw5+nY9RQfoagTD2YjMC6eaarh4EUi6tVjGfKHVZrwkM+uL3C+5KVwtwzsz509k9VFeMF0ZYF2gSpHvuo/qZ6s+4WZ7Gp2yNH5x7frTY8rM6Oy9M7E8LsZxU17FUEcqtJjZQjcolzkBQWAgtz59g0Tq0WomRFVuPjs+jlbcZfcfG8Vjyro8M8eTcOE0RyxJOGlUiOV4Bx7/Twe0pOaYf4+vXK+d027JUuXD0JhrSNrx72qgxKPWoS/+rbL2TRPid1eIi7aKiORYY9FEgy8hRfTeOon6cyURJgyifejsaqt2Tf9tmfiDpXt8my6+P6kwL70SSH4vQXFLohppnozASA9AL8SlkpUix9yK9ymNEiNLqQoAWk2JIOJr7frdoYc2DtpBlNJcfuTX5W9zS6pFBBEcPv7W4uxiTLw+XmDYq9sOQKthY40HySHdm5f0ie8koHx9+9pGqceSzGOx4OLYWPe7uUsSWCmkCudFvnuOh4MhgiAsKGwn/TEZsR3d/08ATx5Ly/kuy3Dt5+KBJBGjA4zruGV6ijakrFbFkpWqiUTXxn2fxRU67bla0h1T3ZJIibjys3TMcJm0Hcd0O40oX+W/Z0ZZlouduz9tmAn2y9D/XUtcl+jOdXoKCmzmGe4b0xBer8UDDk7V113FOCxGNNmfG19SxyhZZJlmal4l5qsQGXxrgKtee1fPhlDEq2WkaxQDd+h8dkZsFic3GpaVcXOLutOMiXoVK2jcUGvW7NupiBc749PfVEgJS2KcdP81qYUgVpTv2j+yM8H7RO8pS7xB7vKzjALvwBPzA8vvIngdZ1Tx6bdSU0SWJO5oisq+gIIhgoYA1FPuXDxy+zge+enUewuNdxv25YwG9R6Tl6+NuOOXjyCcGLY53wqVp605lkiMie6h7ScEoNWq16P/G/+d8yEY7Usonlo/Psr5liuWOgsZXCeibFT+T7cPqrHR4APbfpxads/yZhhn8fAQhAyk3Do+2H8iY9U83pgn1m57ID4g4ra5EIr/ysB1FX/60LenbITgy/zCC+aPbuE2Hh8g/2MZIW9KLAPEkZB8AmANq621WJK4OL4CchsEj4TAE0EzTZxmp60Yysmfde0urkAoR0GHv1QS4FhJYs8I4tpK+mcDgyrNV5ARThxCZJHtrkj4kZ5cxyyAdazvtOTE2IpGTv7U3jUsWITgCCKDHZALtLsye8JQ7GNgiGaazDhJJ3kMJS4xPQ23JTwFZVwFMIe5us+yeIvGYury4AF2V+bA8EATTBE50GMPBjJxFaogYqP0dyDCKcgR7a5I5PKyF6ECbU/zD2nOrfNjFynjS1x4dXJXwxxxURTzVIERjWzHDkS+SeB5UpFto6w8GFaDdCCPkJFBm1QHaqhh5YAsl6DwMhjeZZPrv99nc5HfiEYu74BFye2dP+/eNZzAIDDpUFSEFWghCJdokTOnJvSgLBdTyvBpovvItoPMWzNDmYtcFp2YvBKI5p2+6kQumdt7vnExQJr91F3WF6nhOr5Y6uETGcq1Pzy8ef38Ag+brcBHsF4tF5gKL/iiF83DMx9CCuxs7q7lJDCfLBW5SHkkoEgoWpA+hTsyqy2mhJnsNIrMvaGcYw8RI2c4mVKoUpSYwhK0IX85mYPqVCQVNS4GSLN/OmLdICNy/HRj8114ryl7fwrFCOoQGICMNYnZY6R8g0SFblo9gkBBigAmAANxOJnvwX20LGIBgkgDZO8R2vSIoxDxQnhis1ddo1sLHuaHe+pJdfJcNYcsF2zFilzWKafqRjrs+WvXUrY4dlNA/u4WKY12RLWFkVJ24zBuIEhZkoA846KDNPurQ44u1Rhf7NCmrGYBwGVcvjQpN03kFMhYlctVGjwmFTawTIM9BqAt2d+Be4uAnqLPbSOW6yZk2E92O6J68JpSwBTtfhFAmj3rBukGAQm5PzD755juTn1pEtoIwe4iUb3mDegANOljEE/PpE7DxCM3pZF7Ix3QiXOJbKBa77JIfvaMYKKJNbp8PdCVLZtGunCQpk0bVNJePz9+hLLXx3APwODGRCeXmlovq1mmNoXtWJWY3PoqWtxyFa7aVZpNkSB7WqpEkUDPQiHt9QUIhtmSwiVxgMoEpj6vhVSBK/iiB7tmVxaJ83TOiaFcKhRurkzgEkLisZ11MGlV38skbQ9mIy4IuYZB/1wJ2DWiOfSTKTzUVcbcc+Ehzb5qRNllxvF3jHbNJjUphI3vBp04tGGpQJf4iD7ydGA3yDByGgE8gJWgPRXRChOQYYeWwbL1udFekTObYdYrPJscFavHQekRZfnumw0FZVheRn+dfP4PILKUbrkqiakVkq+tV4ZkOaLLJcEEruY8x63ru7jbSmNLr5QUiSqwZRvl9Jo4hl/KKhwhHq1RFRMA/Z3EH89g96aco4YhlYnB3O3QljqbhM78sosXVy4sTg5wr57YsJxvbMeSXB6DAWn8wFZOB9Hc5zsDYFOn2VJKkNg94NDX16TZkzZJJZQLhKFDlyrH5A71KmA1vzDvQd1qUKlwSXpVOY5+TDGlUECdqxBQwIn0Y4o4yM6zc9XT3spmLI8y1BBBZWgHdcrwGcqccgkoIyMnzODIpefWSELwd5D+TkGgmvRYVYNqd0X3+2Di3R3CtrOsHmBY+wSrAB7j4YO7Vy+Zs5ppAcMETKwFqQaQaIwZkpgk62AhFjPkgkVe5sMVOYrWKaKTBmU3Ma32FQNKmZm6dSeVtpcsVhhiBjnm+/vXrixmRwe9Vuw0asWCIlEJT/nD43zY86S2T48J4SppHEFNxqypy0wFw1O0MONUSC6lcLxeSWAEGxbNM0ftaUjmZzBHPZHjPi9FooBDu62QMKW1TDnRobVkGw8uEm7fnM+mR7s423WsRi2fYyoc8KBatU0ROYmdOYAP2iJMHcPNSfWzZ26kX1pba7o4LtD2KXotoOddk6GtEQFSm+47yF6AnPr0jaED+Dvw9+1bptav+/n5/euXTx4/unv98uRUODaaQLiMhOxQTYBM+3KMwI6nM6i6du2BCZxLMmcNQ9y4vXIhlGivYT55qrEnqPwk3FV0X17JzgC7dgPTsET27JF1Fiasrz0NycQSSkIs59ybrlN0qfr423W9NkGBZuulzPhaHwYLrRXRH2cXPKRoA525t+aHa+BwczJdWR39Xqnv1kAaSl6AdB41Gdq6chWfz4oqLQ3V3i3TJPxmw+DLJ3dvXDs92d/bHTQzBBv1WlGVqYS/gX8UxVCK9obgBB2dQhKxrWKSGDGIZwHSOWsYSlGl6oAofS3npL+qcAA+x6dRDnxGYltjndS1NaYrLVRaNk/L+DqhzNFdpEpbP9DNXSu/eTF4GdRQfgL/BI5qvHxxdrLXb6SODZp5TeS3A094+Bh0NpMxj3PLjsqsHTfRD8mHSNOqLDSlQXrPpZu7JkNLF6/Rr2cBYUtAZbp0MoBDHLa3UU39paylMaBjzUiWgiTyWQFYOkq4Xl8Hm+c2IhRU3idjcj5HOQCvrc/+ml1bj2NyF/kGCigKbbN7RN2Ez5yWSVph4rlr/InWIIjuQtgy5KOSdXGtr+zsj/A5Pj8JExsgQMWKxMyDLxprOZ3xhOYraREsM+9aGglu3cGRsqd2b9O2lNZhYNQOLDjQdjPX13M0JAsWvJIMamYn8rlH7XFpJZa83MhDIeW6idmdm9enJ71W4FnINPmd+InE5BmK3rsEFUDywEAYWE8b1Iu2MtSknDYrpv1SimJQhArgGLjZ567rh9CoCtSeTBx5z6JKP0Uy75v2+V45FK5+/8fwNVGtAvz86NlD4j7uH1y/eC55gH565DkAAVYrD1whtc26pMVzzJaI5aQLdI9ZErW0Ihnqa1n+/hCtlgSsB7hjTO/Ar9pvlPNrF88fHSRbFmzWC7nE+J4Uxa2CAt52F7tDjsPw8GcibLbpMlEYKN2EtCdGR5GaX0w+I2kZK/7ZBWXz1Vr00gGRQMx+wkMKz6h/U81RexoCz18N5Gwhl2ZPunJZS3zqC8iX294aD5ot361XCzVDYnsYc1y2JoIKS3H31mngNFxiuBa+818Xak9D4NJ/pzSYOChXm+sSFPpScvWMbUwJY8TVvfpM58ZutmL4uHgY+uePH/XulQtblVAZxSAnlX586gVbZo0m1jDC78JUnhoaVYPyJZW2uyJamrDWjxiql98oKf4L/VE41D/GXSccdQ/v37pxeXF60m3GUeh7rgk0hc34NX89SJk/H7HTWRW92xPKb1shTTbciudyHJPCqQo5ju+V/UM4d42nUbpI32ggzaXA80cj99sf05P94Tu3Lp4/OT7abTd+KTXAM9FITN/72FbiHZLA3hIUkZhkdHothst77918dHPWZGjr4iX6xGJdDgEG9g6OyTjlqT5sZY4F9GYlr1EFfmYPnvYyTlq1OtpUpWL+2TmD6prHahT+8gwGbPr6mgz3pJukFBZeUM21PZVbQzN8gg8rtpbB0XEVAoXoA4DEGClrBfDqUl0H63GMqJXw+FQRvQ3VLs+l8rY1+T7RT1Kw+l5FBz2c0SUCc4sdMUQp/bUqG4OIRnMLdCxFEGNt5V6b3/fbw0BQLko88SF9+GgqkJgJMm3XDNORg/06I8qg7ePzks6/psNaDENWrJYViS5NcYadeTaeudAKrvMqwZwSz6x5BqhadbMgScbk92s7lrhhikNQ75KkE45k8dyQhz1vTmYnsjeCFFh+xPiGtwDQDzWQKo5xgeo27fBQSjccUQQrikPG2ZquXdnf7bejwNBLBVlYV3zJLx8VcIBINITBN7Ug6lXZBdUwT7vAR/XQJ17FK1t5J9l2nwqUsMC6WHVrZFcKUIAoHsPNh0kHOZnzUrpZAIFE62OTzciyfJoh6+ONXVtgFqzes3bZ1sxAkdHCpTHYKC0L3mmpePO6JbqmngdJk9zH3gdSJHLaHK8wiu5vp/RbWQjqHVu8MdK2bNdHj3O9HcFHtG0A06SWOv7t+mP7ueYc4oSH1wg726Neu+XYeuN2svsJfeKvWjiCrHr5w1lomB6fs7YqtVuJZL4ongWoafGyRobd7f3drG6jRrWQYypTXJNrjxA+Zm+KJFJYlJVo54HZ7Rjs9PTMZuA5zn7vi16WWma9ktfojf7G2ZWdGElMNpTidfJjzaZaz93u9vDIAzfBPY/K4XjOw3zW4hPM5+6Mb3vfrEe6i6SAlY+DekDJd0JcMeTVcDV1U/BxqlPMQr6JWBTPgtT4dpSHh3duTU5wbzNQJK4fpj6Vp+de6uj8hioQUxPt0Jd4oJ9fFUXjqemc+wSG9TLg3Oc19pqz6Tw/wWgVP1z7Y8Meq7CoTOmUWfCPOq0fVowVSd5rAfBLvHzx8tFDNFeBsWNoRp2yVrxHM/sGTWS7YHb1rB10AD7zqQ5Mye4qiNg0aDbPj4r3MD42V4SpbUAyw7NLqOQqxOrOuONYxajHy4x5P5QUK3Sveog3yDZKpsghZxaMGKUl5ziRlaDDwsjAZDyfEtvYuFi+fAxLcIvagdOcuHJLxC4C4cDBNCfPuV1YRAm0WuhbjVJO5KkCH9AH/mNrsqToOlnAcKU6REPlcWIolM860sRTbo+YDbJ9jK7JhZdZP8GHMzmog9yMAnFcIBWyNmnCIfDH1QFcg0oakHvzydQJ91m6lj7B7HffjHpFT0cDmzug+wgEEqBWBTyCqat5l0Jk9oi6XyytUDlCfHYa9PCUb8E63+BLVXbK+6Acx6Zbo5w+qa0y/93gTY3JOIOIaRTnYGs5e6MX8O/85eUsyKRJcoDruHaxnINQQ84HcH1xUe9w6w+npgbgtKZhQCQWC730BxZfqywHROg1AYRGIYz7XpIkay51dtmh7HncBmnmSnUiS1HUlSeYXl8sOCgzjPrOCjsA8/naaraFvKj5YU+DU2Rzyw/0yrxKrcQqmYHqjIcF8caZS0n36tpjTzaEZsa6Z+/ac2iis3YpJrhKuHNrNtnFnUYcuja4pZXqivu8318QFrdq0LUo+Gqy+v9AkOKJdYCELyrc7bFRgXilMUXEPLjL6i1N2Z/7MO9am257Rv4/tofbnPjI7Ddw/WLVMoBa8WibBLdBBBJuHunaYWcw5GS5BZC2pbunaVnIjemflADu4s65it4oeapqUbEmCQIg8N/Hry5v5T79H+Pp/ys6Fxk1byyyZrhLIJkA0+NA/yvLvfEFAEbzd9GRLPUnKzU7jOTP6LPdr6GJRm2LzUEigmrfy0QNFVJG2kgK6SMrySzpZP3wK3fYL+R0QXavuas/yepRGd0hY7CAf5iHysg0SwXAlQGayPjUKTmJRt2ZjMy35O01rU57zanMrrwmvQIDRKzTPgd18cfmZPX1R1BXoGwg+rsnWb+JfaVSM5kHSiZsMQ/hCYDaYTXpy06UBViSGzu6NdS9ylKmtjKT7SmlvSd5Q04+X2xkANis1E6wU0IuavvauTVNHstI/8G8tMrhSR+oDN8HiRh9sFMZ8SHm87gP1c+nPpb5in2CWOfO8xdaXn4D4+QAAA4C/nw09L9P9CLxqa+T5DOns9fnlvMCC9OEH339hht/Uw68u1zmMmzEKmN6desxQcP0UIKaSCDQ4Y4sTOk1+7qMk7MhgYtSIl0zd+qSpObkaUtBCr9nKCFtNoEZ7YLJONouXF5g0CrAD3BpPUz4AAvc7cVK7gNZ6Y1I/qFl8tI3hMk67dqkxx18nDUa8trbBXWp06pcu15DgNKzhXX98fPC9ERAsQkLGyjQqX6nimlWI8Br2BC+TY7p1uWM4UHzlLtqgvtJlkY/Y434+jhONtfJ6gW1bk2tP1a03YIKMbIaJ2MsOJ7hWMB7WZogOlIMmT05JxIVOzJVzibngKJifV+felK81p6iPfrUpSulgP0vUgAlVT6l/peEJe37XOVRBwk2ek1zNC64hoCz5QoLTzU1mmvMtRssCDRWDFYaWE8qHWdlFxckwlZMMubXEGFIEDj/uDr2ORphAwyNSUaXgGixsuQsjJDnCi+dCoGk/MlCQhKicYVVJzXuWz6wAQU6cHYWKMZ9pY5D1aSUnRxkgKTCRjLzH7GPOgPHRkTMRooBwQGYX3OpFrzKKvvunV1cY/a/3vRb1zo77qpbuf1/kdACKLysf9d0W5nfcsgOA9V+v2l1pT2sZlWJWMLl9q6Gi9VfLUrtHzKr5zSnunjiM4QivfL9AdUaGbJ4DypPYw/Sdw3X2+u6jllqnxjmdgSp/DQe+jgQu3R7PlR6JyKsi5ZpQx6PNboxsgqU9oX4H02lZ6A2RyCRKVSanLyCopIKHWCATIjF5nB5fIFQJJZItWTaOrp6+gaGMDcPryI+xUqUKlOuQiW/KgHVgkJq1KpTr0GjJs1Kv/FCQAcCd+7OUu8dFW4CWNvXGQKX3q94CzEQ202eCpe9/bX8YcUB2DGwl4eBb19KnD2tg549KxAWktX+eZPAues8DGoqtruP9j2PgfzEbzB6C9vxIq6OHd4HAAA=') format('woff2');
    font-weight: normal;
    font-style: italic;
    font-display: swap;
}

@font-face {
    font-family: 'KaTeX_Main';
    src: url('data:font/woff2;charset=utf-8;base64,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') format('woff2');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
                    `}
                </style>
                <defs>
                    <marker id="arrowhead" viewBox="0 0 15 8" refX="4" refY="4" markerWidth={arrowSizeBase} markerHeight={arrowSizeBase * 0.6} orient="auto">
                        <path d="M 0 0 L 15 4 L 0 8 L 4 4 z" fill="black" />
                    </marker>
                </defs>
                
                {/* ASÍNTOTAS VERTICALES Y HORIZONTALES */}
                {asymptotesX.map((a, i) => {
                    const val = a.val !== undefined ? a.val : a;
                    const extent = a.extent || 'full';
                    const showVal = a.showVal !== false;

                    let y1 = padding;
                    let y2 = height - padding;
                    if (extent === 'top') y2 = originY;
                    if (extent === 'bottom') y1 = originY;
                    const sx = toScreenX(val);

                    return (
                        <g key={`asym-x-${i}`}>
                            <line x1={sx} y1={y1} x2={sx} y2={y2} stroke="#bbb" strokeWidth="1.5" strokeDasharray="6,4" className="asymptote-line" />
                            {showVal && (
                                <g>
                                    <line x1={sx} y1={originY - 5} x2={sx} y2={originY + 5} stroke="black" strokeWidth="1" />
                                    <text x={sx} y={xLabelY} textAnchor="middle" fontSize={tickFontSize} fontFamily={MATH_FONT} fill="#000">{formatNumber(val)}</text>
                                </g>
                            )}
                        </g>
                    )
                })}
                {asymptotesY.map((asym, i) => {
                    const val = asym.val !== undefined ? asym.val : asym;
                    const extent = asym.extent || 'full';
                    const showVal = asym.showVal !== false;

                    let x1 = padding;
                    let x2 = width - padding;
                    if (extent === 'left') x2 = originX;
                    if (extent === 'right') x1 = originX;
                    const sy = toScreenY(val);

                    return (
                        <g key={`asym-y-${i}`}>
                            <line x1={x1} y1={sy} x2={x2} y2={sy} stroke="#bbb" strokeWidth="1.5" strokeDasharray="6,4" className="asymptote-line" />
                            {showVal && (
                                <g>
                                    <line x1={originX - 5} y1={sy} x2={originX + 5} y2={sy} stroke="black" strokeWidth="1" />
                                    <text x={originX - 10} y={sy + (tickFontSize/3)} textAnchor="end" fontSize={tickFontSize} fontFamily={MATH_FONT} fill="#000">{formatNumber(val)}</text>
                                </g>
                            )}
                        </g>
                    )
                })}

                {/* ETIQUETAS LIBRES */}
                {labels.map(lbl => {
                    const sx = toScreenX(lbl.x);
                    const sy = toScreenY(lbl.y);
                    return (
                        <text 
                            key={lbl.id}
                            x={sx} 
                            y={sy} 
                            fontSize={fontSizeBase} 
                            fontFamily={MATH_FONT} 
                            fontStyle={lbl.isItalic !== false ? "italic" : "normal"}
                            fill="black"
                            cursor="move"
                            onMouseDown={(e) => handleLabelMouseDown(e, lbl.id, sx, sy)}
                            className="draggable-label"
                            style={{ userSelect: 'none' }}
                        >
                            {lbl.text}
                        </text>
                    );
                })}

                {/* EJES Y ETIQUETAS GLOBALES */}
                <line x1={padding} y1={originY} x2={width - padding} y2={originY} stroke="black" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                <text x={width - padding} y={originY - 15} fontSize={fontSizeBase} fontFamily={MATH_FONT} fontStyle="italic" fill="black">x</text>
                
                <line x1={originX} y1={height - padding} x2={originX} y2={padding} stroke="black" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                <text x={originX + 15} y={padding} textAnchor="start" fontSize={fontSizeBase} fontFamily={MATH_FONT} fontStyle="italic" fill="black">y</text>
                
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
                                onMouseDown={(e) => { e.stopPropagation(); setSelectedSegmentId(seg.id); setSelectedPointId(null); }}
                            />
                            
                            {/* Curva Visible (Siempre Negra) */}
                            <path 
                                d={pathData} 
                                fill="none" 
                                stroke="#000000" 
                                strokeWidth="1.5" 
                                className="curve-path transition-opacity duration-300"
                                style={{ opacity: (!selectedSegmentId || isSelected) ? 1 : 0.25 }}
                            />

                            {/* Puntos y UI Interactiva */}
                            {seg.points.map((p, index) => {
                                const isFirst = index === 0;
                                const isLast = index === seg.points.length - 1;
                                const isFinBoundary = isFirst || isLast;
                                
                                let bType = 'closed';
                                if (isFirst) bType = seg.startType || 'closed';
                                if (isLast) bType = seg.endType || 'closed';

                                const sx = toScreenX(p.x);
                                const sy = toScreenY(p.y);
                                
                                const pSelected = isSelected && selectedPointId === p.id;
                                const pHovered = hoveredPointId === p.id;

                                // Lógica de visibilidad (proyecciones y valores)
                                const isZeroX = Math.abs(p.x) < 1e-5;
                                const isZeroY = Math.abs(p.y) < 1e-5;
                                
                                const showTickX = !isZeroX && p.valX !== false;
                                const showTickY = !isZeroY && p.valY !== false;
                                
                                const showDashedX = !isZeroX && !isZeroY && p.projX !== false;
                                const showDashedY = !isZeroY && !isZeroX && p.projY !== false;

                                const showCp1 = (pSelected && index > 0);
                                const showCp2 = (pSelected && index < seg.points.length - 1);
                                
                                let cp1x = sx, cp1y = sy, cp2x = sx, cp2y = sy;
                                if (showCp1) {
                                    const raw1X = toScreenX(p.x + p.cp1.dx), raw1Y = toScreenY(p.y + p.cp1.dy);
                                    if (Math.sqrt((raw1X - sx)**2 + (raw1Y - sy)**2) < 12) {
                                        cp1x = sx - STUB_LENGTH; cp1y = sy; 
                                    } else { cp1x = raw1X; cp1y = raw1Y; }
                                }
                                if (showCp2) {
                                    const raw2X = toScreenX(p.x + p.cp2.dx), raw2Y = toScreenY(p.y + p.cp2.dy);
                                    if (Math.sqrt((raw2X - sx)**2 + (raw2Y - sy)**2) < 12) {
                                        cp2x = sx + STUB_LENGTH; cp2y = sy; 
                                    } else { cp2x = raw2X; cp2y = raw2Y; }
                                }

                                const isBlockingCp1 = collision && collision.segmentId === seg.id && collision.pointId === p.id && collision.handle === 'cp1';
                                const isBlockingCp2 = collision && collision.segmentId === seg.id && collision.pointId === p.id && collision.handle === 'cp2';

                                return (
                                    <g key={p.id} className={(!selectedSegmentId || isSelected) ? 'opacity-100' : 'opacity-25'}>
                                        
                                        {/* TICS Y TEXTOS EN EJES */}
                                        {showTickX && (
                                            <g>
                                                <line x1={sx} y1={originY - 5} x2={sx} y2={originY + 5} stroke="black" strokeWidth="1" />
                                                <text x={sx} y={xLabelY} textAnchor="middle" fontSize={tickFontSize} fontFamily={MATH_FONT} fill="#000">{formatNumber(p.x)}</text>
                                            </g>
                                        )}
                                        {showTickY && (
                                            <g>
                                                <line x1={originX - 5} y1={sy} x2={originX + 5} y2={sy} stroke="black" strokeWidth="1" />
                                                <text x={originX - 10} y={sy + (tickFontSize/3)} textAnchor="end" fontSize={tickFontSize} fontFamily={MATH_FONT} fill="#000">{formatNumber(p.y)}</text>
                                            </g>
                                        )}

                                        {/* LÍNEAS DE PROYECCIÓN */}
                                        {showDashedX && <line x1={sx} y1={sy} x2={sx} y2={originY} stroke="#bbb" strokeWidth="1.5" strokeDasharray="6,4" className="projection-line" />}
                                        {showDashedY && <line x1={sx} y1={sy} x2={originX} y2={sy} stroke="#bbb" strokeWidth="1.5" strokeDasharray="6,4" className="projection-line" />}

                                        {/* Puntos Visibles Permanentes (Solo Extremos Finitos) */}
                                        {isFinBoundary && bType !== 'none' && (
                                            <circle cx={sx} cy={sy} r={POINT_RADIUS} fill={bType === 'open' ? "white" : "#000000"} stroke="#000000" strokeWidth={bType === 'open' ? 2 : 0} className="segment-boundary" />
                                        )}

                                        {/* Capa Interactiva (Se Oculta al Exportar) */}
                                        {isSelected && (
                                            <g className="ui-layer" onMouseEnter={() => setHoveredPointId(p.id)} onMouseLeave={() => setHoveredPointId(null)}>
                                                {/* Área Base del Punto (Para seleccionarlos fácilmente) */}
                                                <circle 
                                                    cx={sx} cy={sy} 
                                                    r={18} 
                                                    fill="transparent" 
                                                    stroke="transparent"
                                                    cursor="pointer" 
                                                    onMouseDown={(e) => handlePointMouseDown(e, p.id, seg.id, sx, sy)} 
                                                />
                                                
                                                {/* Círculo interno visual para edición (azul) */}
                                                {!isFinBoundary && (
                                                    <circle cx={sx} cy={sy} r={4} fill={COLOR_SELECTED} stroke="none" className="internal-point" pointerEvents="none" />
                                                )}
                                                
                                                {(pSelected || pHovered) && (
                                                    <circle 
                                                        cx={sx} cy={sy} 
                                                        r={pSelected ? 6 : (isFinBoundary ? Math.max(POINT_RADIUS + 2, 6) : 6)} 
                                                        fill={pSelected ? COLOR_SELECTED : COLOR_HOVER} 
                                                        stroke={pSelected ? "white" : "transparent"}
                                                        strokeWidth={pSelected ? 2 : 0}
                                                        className="internal-point"
                                                        pointerEvents="none"
                                                        style={{ transition: 'fill 0.1s, stroke 0.1s, r 0.1s' }} 
                                                    />
                                                )}

                                                {/* Manijas (Dibujadas ENCIMA) */}
                                                {showCp1 && (
                                                    <g>
                                                        <line x1={sx} y1={sy} x2={cp1x} y2={cp1y} stroke={p.type === 'smooth' ? "#ef4444" : "#f97316"} strokeWidth={isBlockingCp1 ? "2" : "1"} className={isBlockingCp1 ? "blink-line-handle" : ""} pointerEvents="none" />
                                                        <circle cx={cp1x} cy={cp1y} r={5} fill={isBlockingCp1 ? "#fee2e2" : "white"} stroke={isBlockingCp1 ? "#dc2626" : (p.type === 'smooth' ? "#ef4444" : "#f97316")} strokeWidth={isBlockingCp1 ? "3" : "2"} className={isBlockingCp1 ? "blink-handle" : ""} pointerEvents="none" />
                                                        <circle cx={cp1x} cy={cp1y} r={16} fill="transparent" cursor="pointer" onMouseDown={(e) => handleHandleMouseDown(e, 'cp1', p.id, seg.id, cp1x, cp1y)} />
                                                    </g>
                                                )}
                                                {showCp2 && (
                                                    <g>
                                                        <line x1={sx} y1={sy} x2={cp2x} y2={cp2y} stroke={p.type === 'smooth' ? "#ef4444" : "#f97316"} strokeWidth={isBlockingCp2 ? "2" : "1"} className={isBlockingCp2 ? "blink-line-handle" : ""} pointerEvents="none" />
                                                        <circle cx={cp2x} cy={cp2y} r={5} fill={isBlockingCp2 ? "#fee2e2" : "white"} stroke={isBlockingCp2 ? "#dc2626" : (p.type === 'smooth' ? "#ef4444" : "#f97316")} strokeWidth={isBlockingCp2 ? "3" : "2"} className={isBlockingCp2 ? "blink-handle" : ""} pointerEvents="none" />
                                                        <circle cx={cp2x} cy={cp2y} r={16} fill="transparent" cursor="pointer" onMouseDown={(e) => handleHandleMouseDown(e, 'cp2', p.id, seg.id, cp2x, cp2y)} />
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
                    <line x1={toScreenX(collision.x)} y1={0} x2={toScreenX(collision.x)} y2={height} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6,4" className="blink-line ui-layer" />
                )}
            </svg>
        </div>
      </div>
    </div>
  );
};

export default FunctionGrapher;