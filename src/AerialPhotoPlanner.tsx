import { useEffect, useMemo, useState } from "react";
import { calculateLayout } from "./layoutCalculator";
import type { SolarPanel } from "./types";

type Point = {
  x: number;
  y: number;
};

type OrientationMode = "auto" | "portrait" | "landscape";

type RoofCandidate = {
  id: string;
  name: string;
  confidence: number;
  polygon: [Point, Point, Point, Point];
  lengthFactor: number;
  widthFactor: number;
};

type AerialPhotoPlannerProps = {
  selectedPanel: SolarPanel;
};

const demoImageUrl = "/api/odm-test/files/images/image_001.jpg";

export default function AerialPhotoPlanner({ selectedPanel }: AerialPhotoPlannerProps) {
  const [imageUrl, setImageUrl] = useState(demoImageUrl);
  const [imageName, setImageName] = useState("Imagem aérea do teste ODM");
  const [selectionPoints, setSelectionPoints] = useState<Point[]>([]);
  const [detectionStarted, setDetectionStarted] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [orientation, setOrientation] = useState<OrientationMode>("auto");
  const [setbackMeters, setSetbackMeters] = useState(0.35);
  const [gapMeters, setGapMeters] = useState(0.04);
  const [baseLengthMeters, setBaseLengthMeters] = useState(14);
  const [baseWidthMeters, setBaseWidthMeters] = useState(8);
  const [disabledPanelIds, setDisabledPanelIds] = useState<string[]>([]);

  const candidates = useMemo(() => {
    if (!detectionStarted || selectionPoints.length < 3) {
      return [];
    }

    return createRoofCandidates(selectionPoints);
  }, [detectionStarted, selectionPoints]);

  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0];

  const layout = useMemo(() => {
    if (!selectedCandidate) {
      return undefined;
    }

    return calculateLayout(selectedPanel, {
      lengthMeters: baseLengthMeters * selectedCandidate.lengthFactor,
      widthMeters: baseWidthMeters * selectedCandidate.widthFactor,
      setbackMeters,
      gapMeters,
      orientation,
    });
  }, [
    baseLengthMeters,
    baseWidthMeters,
    gapMeters,
    orientation,
    selectedCandidate,
    selectedPanel,
    setbackMeters,
  ]);

  const panelPolygons = useMemo(() => {
    if (!selectedCandidate || !layout) {
      return [];
    }

    return buildPanelPolygons(
      selectedCandidate,
      layout,
      baseLengthMeters * selectedCandidate.lengthFactor,
      baseWidthMeters * selectedCandidate.widthFactor,
      setbackMeters,
      gapMeters,
    );
  }, [baseLengthMeters, baseWidthMeters, gapMeters, layout, selectedCandidate, setbackMeters]);

  const activePanelCount = panelPolygons.filter((panel) => !disabledPanelIds.includes(panel.id)).length;
  const totalKwp = (activePanelCount * selectedPanel.powerWatts) / 1000;

  useEffect(() => {
    if (candidates.length > 0 && !candidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(candidates[0].id);
    }
  }, [candidates, selectedCandidateId]);

  useEffect(() => {
    setDisabledPanelIds([]);
  }, [selectedCandidateId, orientation, setbackMeters, gapMeters, baseLengthMeters, baseWidthMeters]);

  function handleImageUpload(files: FileList | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setImageUrl((currentUrl) => {
      if (currentUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
      return nextUrl;
    });
    setImageName(file.name);
    setSelectionPoints([]);
    setDetectionStarted(false);
    setSelectedCandidateId("");
  }

  function handleStageClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setSelectionPoints((current) => [...current, { x: clamp(x, 0, 100), y: clamp(y, 0, 100) }]);
    setDetectionStarted(false);
  }

  function startDetection() {
    if (selectionPoints.length < 3) {
      return;
    }

    setDetectionStarted(true);
  }

  function togglePanel(panelId: string) {
    setDisabledPanelIds((current) =>
      current.includes(panelId)
        ? current.filter((id) => id !== panelId)
        : [...current, panelId],
    );
  }

  return (
    <section className="card aerial-planner-card">
      <div className="card-header">
        <span>Foto</span>
        <h2>Fluxo rapido com foto aerea</h2>
      </div>
      <p className="helper">
        Novo fluxo comercial: carregue uma foto de cima, selecione a casa com cliques/toques e deixe
        o sistema sugerir os telhados e preencher as placas automaticamente.
      </p>

      <div className="aerial-toolbar">
        <label className="secondary-upload">
          <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event.target.files)} />
          Escolher foto aerea em alta resolucao
        </label>
        <button type="button" onClick={() => setSelectionPoints((current) => current.slice(0, -1))}>
          Desfazer ponto
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectionPoints([]);
            setDetectionStarted(false);
          }}
        >
          Limpar selecao
        </button>
        <button type="button" className="primary-mini-action" disabled={selectionPoints.length < 3} onClick={startDetection}>
          Detectar telhados e placas
        </button>
      </div>

      <div className="aerial-planner-layout">
        <div className="aerial-stage" onClick={handleStageClick}>
          <img src={imageUrl} alt={imageName} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {selectionPoints.length > 1 && (
              <polyline className="house-selection-line" points={toSvgPoints(selectionPoints)} />
            )}
            {selectionPoints.length > 2 && (
              <polygon className="house-selection-fill" points={toSvgPoints(selectionPoints)} />
            )}
            {selectionPoints.map((point, index) => (
              <circle key={`${point.x}-${point.y}-${index}`} className="selection-point" cx={point.x} cy={point.y} r="1.2" />
            ))}
            {selectedCandidate && (
              <polygon className="roof-candidate-polygon" points={toSvgPoints(selectedCandidate.polygon)} />
            )}
            {panelPolygons.map((panel) => {
              const disabled = disabledPanelIds.includes(panel.id);
              return (
                <polygon
                  key={panel.id}
                  className={disabled ? "auto-panel disabled" : "auto-panel"}
                  points={toSvgPoints(panel.points)}
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePanel(panel.id);
                  }}
                />
              );
            })}
          </svg>
        </div>

        <aside className="auto-planner-sidebar">
          <div className="aerial-instructions">
            <strong>{imageName}</strong>
            <p>
              Clique nos 4 cantos do telhado que voce quer preencher. O sistema agora usa esses
              pontos como o plano principal e encaixa as placas acompanhando a perspectiva.
            </p>
          </div>

          {selectedCandidate && layout ? (
            <>
              <label>
                Telhado sugerido
                <select value={selectedCandidate.id} onChange={(event) => setSelectedCandidateId(event.target.value)}>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {Math.round(candidate.confidence * 100)}%
                    </option>
                  ))}
                </select>
              </label>

              <div className="auto-kpis">
                <div>
                  <strong>{activePanelCount}</strong>
                  <span>placas</span>
                </div>
                <div>
                  <strong>{totalKwp.toFixed(2)} kWp</strong>
                  <span>potencia</span>
                </div>
                <div>
                  <strong>
                    {layout.columns} x {layout.rows}
                  </strong>
                  <span>grade</span>
                </div>
              </div>
            </>
          ) : (
            <div className="auto-notes">
              <p>Aguardando selecao da casa para sugerir os telhados.</p>
            </div>
          )}

          <div className="inline-fields">
            <label>
              Comprimento base (m)
              <input
                type="number"
                min="1"
                step="0.1"
                value={baseLengthMeters}
                onChange={(event) => setBaseLengthMeters(Number(event.target.value))}
              />
            </label>
            <label>
              Largura base (m)
              <input
                type="number"
                min="1"
                step="0.1"
                value={baseWidthMeters}
                onChange={(event) => setBaseWidthMeters(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="inline-fields">
            <label>
              Recuo (m)
              <input
                type="number"
                min="0"
                step="0.05"
                value={setbackMeters}
                onChange={(event) => setSetbackMeters(Number(event.target.value))}
              />
            </label>
            <label>
              Espaco (m)
              <input
                type="number"
                min="0"
                step="0.01"
                value={gapMeters}
                onChange={(event) => setGapMeters(Number(event.target.value))}
              />
            </label>
          </div>

          <label>
            Orientacao
            <select value={orientation} onChange={(event) => setOrientation(event.target.value as OrientationMode)}>
              <option value="auto">Automatico</option>
              <option value="portrait">Retrato</option>
              <option value="landscape">Paisagem</option>
            </select>
          </label>
        </aside>
      </div>
    </section>
  );
}

function createRoofCandidates(points: Point[]): RoofCandidate[] {
  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const insetX = width * 0.04;
  const insetY = height * 0.04;
  const midY = bounds.minY + height * 0.52;
  const midX = bounds.minX + width * 0.5;
  const selectedPolygon = pointsToRoofQuad(points);
  const selectedBounds = getBounds(selectedPolygon);
  const selectedWidth = selectedBounds.maxX - selectedBounds.minX;
  const selectedHeight = selectedBounds.maxY - selectedBounds.minY;
  const splitTop = [
    interpolateQuad(selectedPolygon, 0, 0),
    interpolateQuad(selectedPolygon, 1, 0),
    interpolateQuad(selectedPolygon, 1, 0.5),
    interpolateQuad(selectedPolygon, 0, 0.5),
  ] as [Point, Point, Point, Point];
  const splitBottom = [
    interpolateQuad(selectedPolygon, 0, 0.5),
    interpolateQuad(selectedPolygon, 1, 0.5),
    interpolateQuad(selectedPolygon, 1, 1),
    interpolateQuad(selectedPolygon, 0, 1),
  ] as [Point, Point, Point, Point];

  return [
    {
      id: "selected-roof",
      name: "Area marcada pelo vendedor",
      confidence: points.length === 4 ? 0.92 : 0.78,
      lengthFactor: 1,
      widthFactor: 1,
      polygon: selectedPolygon,
    },
    {
      id: "upper-plane",
      name: "Plano superior provavel",
      confidence: 0.68,
      lengthFactor: selectedWidth / Math.max(width, 1),
      widthFactor: 0.48,
      polygon: splitTop,
    },
    {
      id: "lower-plane",
      name: "Plano inferior provavel",
      confidence: 0.64,
      lengthFactor: selectedWidth / Math.max(width, 1),
      widthFactor: 0.48,
      polygon: splitBottom,
    },
    {
      id: "left-plane",
      name: "Plano lateral provavel",
      confidence: 0.58,
      lengthFactor: 0.5,
      widthFactor: 1,
      polygon: [
        { x: bounds.minX + insetX, y: bounds.minY + insetY },
        { x: midX, y: bounds.minY + insetY },
        { x: midX, y: bounds.maxY - insetY },
        { x: bounds.minX + insetX, y: bounds.maxY - insetY },
      ],
    },
  ];
}

function pointsToRoofQuad(points: Point[]): [Point, Point, Point, Point] {
  if (points.length === 4) {
    return points as [Point, Point, Point, Point];
  }

  const bounds = getBounds(points);
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

function buildPanelPolygons(
  candidate: RoofCandidate,
  layout: NonNullable<ReturnType<typeof calculateLayout>>,
  roofLength: number,
  roofWidth: number,
  setbackMeters: number,
  gapMeters: number,
) {
  const panels: Array<{ id: string; points: [Point, Point, Point, Point] }> = [];
  const uStart = setbackMeters / roofLength;
  const vStart = setbackMeters / roofWidth;
  const moduleU = layout.moduleLength / roofLength;
  const moduleV = layout.moduleWidth / roofWidth;
  const gapU = gapMeters / roofLength;
  const gapV = gapMeters / roofWidth;

  for (let row = 0; row < layout.rows; row += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      const u0 = uStart + column * (moduleU + gapU);
      const v0 = vStart + row * (moduleV + gapV);
      const u1 = Math.min(u0 + moduleU, 1 - uStart);
      const v1 = Math.min(v0 + moduleV, 1 - vStart);

      panels.push({
        id: `aerial-${row}-${column}`,
        points: [
          interpolateQuad(candidate.polygon, u0, v0),
          interpolateQuad(candidate.polygon, u1, v0),
          interpolateQuad(candidate.polygon, u1, v1),
          interpolateQuad(candidate.polygon, u0, v1),
        ],
      });
    }
  }

  return panels;
}

function getBounds(points: Point[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function interpolateQuad([topLeft, topRight, bottomRight, bottomLeft]: RoofCandidate["polygon"], u: number, v: number) {
  const top = mixPoint(topLeft, topRight, u);
  const bottom = mixPoint(bottomLeft, bottomRight, u);
  return mixPoint(top, bottom, v);
}

function mixPoint(start: Point, end: Point, amount: number): Point {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

function toSvgPoints(points: Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
