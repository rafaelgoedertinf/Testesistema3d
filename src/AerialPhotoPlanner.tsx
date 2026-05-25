import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import CleanTechnicalModelViewer from "./CleanTechnicalModelViewer";
import { calculateLayout } from "./layoutCalculator";
import type { SolarPanel } from "./types";

type Point = {
  x: number;
  y: number;
};

export type OrientationMode = "auto" | "portrait" | "landscape";

export type RoofArea = {
  id: string;
  name: string;
  polygon: [Point, Point, Point, Point];
  lengthMeters: number;
  projectedWidthMeters: number;
  slopeDegrees: number;
  confidence: number;
  disabledPanelIds: string[];
};

type AerialPhotoPlannerProps = {
  selectedPanel: SolarPanel;
};

type RenderSlopePlane = {
  id: string;
  name: string;
  slopeDegrees: number;
  confidence: number;
  pointCount: number;
};

type RenderSlopeAnalysis = {
  available: boolean;
  source?: string;
  note?: string;
  planes: RenderSlopePlane[];
};

const demoImageUrl = "/api/odm-test/files/images/image_001.jpg";

export default function AerialPhotoPlanner({ selectedPanel }: AerialPhotoPlannerProps) {
  const [imageUrl, setImageUrl] = useState(demoImageUrl);
  const [imageName, setImageName] = useState("Imagem aerea do teste ODM");
  const [selectionPoints, setSelectionPoints] = useState<Point[]>([]);
  const [roofAreas, setRoofAreas] = useState<RoofArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [orientation, setOrientation] = useState<OrientationMode>("auto");
  const [setbackMeters, setSetbackMeters] = useState(0.35);
  const [gapMeters, setGapMeters] = useState(0.04);
  const [newAreaLengthMeters, setNewAreaLengthMeters] = useState(8);
  const [newAreaWidthMeters, setNewAreaWidthMeters] = useState(4);
  const [renderSlopeAnalysis, setRenderSlopeAnalysis] = useState<RenderSlopeAnalysis | null>(null);

  const selectedArea = roofAreas.find((area) => area.id === selectedAreaId) ?? roofAreas[0];
  const plannedAreas = useMemo(() => {
    return roofAreas.map((area) => {
      const correctedWidthMeters = correctWidthForSlope(area.projectedWidthMeters, area.slopeDegrees);
      const layout = calculateLayout(selectedPanel, {
        lengthMeters: area.lengthMeters,
        widthMeters: correctedWidthMeters,
        setbackMeters,
        gapMeters,
        orientation,
      });
      const panels = buildPanelPolygons(area, layout, area.lengthMeters, correctedWidthMeters, setbackMeters, gapMeters);
      const activePanelCount = panels.filter((panel) => !area.disabledPanelIds.includes(panel.id)).length;

      return {
        area,
        correctedWidthMeters,
        layout,
        panels,
        activePanelCount,
        totalKwp: (activePanelCount * selectedPanel.powerWatts) / 1000,
      };
    });
  }, [gapMeters, orientation, roofAreas, selectedPanel, setbackMeters]);

  const totalPanels = plannedAreas.reduce((total, item) => total + item.activePanelCount, 0);
  const totalKwp = (totalPanels * selectedPanel.powerWatts) / 1000;
  const renderSlopePlanes = renderSlopeAnalysis?.planes ?? [];

  useEffect(() => {
    void fetch("/api/odm-test/slope-analysis")
      .then((response) => response.json() as Promise<RenderSlopeAnalysis>)
      .then((analysis) => setRenderSlopeAnalysis(analysis))
      .catch(() => setRenderSlopeAnalysis(null));
  }, []);

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
    setRoofAreas([]);
    setSelectedAreaId("");
  }

  function handleStageClick(event: MouseEvent<HTMLDivElement>) {
    if (selectionPoints.length >= 4) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setSelectionPoints((current) => [...current, { x: clamp(x, 0, 100), y: clamp(y, 0, 100) }]);
  }

  function addSelectedRoofArea() {
    if (selectionPoints.length !== 4) {
      return;
    }

    const polygon = normalizeRoofQuad(selectionPoints as [Point, Point, Point, Point]);
    const nextIndex = roofAreas.length + 1;
    const slopeDegrees = renderSlopePlanes[0]?.slopeDegrees ?? estimateSlopeFromRender(polygon, nextIndex);
    const area: RoofArea = {
      id: `roof-area-${Date.now()}`,
      name: `Pano ${nextIndex}`,
      polygon,
      lengthMeters: newAreaLengthMeters,
      projectedWidthMeters: newAreaWidthMeters,
      slopeDegrees,
      confidence: 0.74,
      disabledPanelIds: [],
    };

    setRoofAreas((current) => [...current, area]);
    setSelectedAreaId(area.id);
    setSelectionPoints([]);
  }

  function removeSelectedArea() {
    if (!selectedArea) {
      return;
    }

    setRoofAreas((current) => current.filter((area) => area.id !== selectedArea.id));
    setSelectedAreaId("");
  }

  function updateSelectedArea(patch: Partial<Pick<RoofArea, "lengthMeters" | "projectedWidthMeters" | "slopeDegrees">>) {
    if (!selectedArea) {
      return;
    }

    setRoofAreas((current) =>
      current.map((area) =>
        area.id === selectedArea.id
          ? {
              ...area,
              ...patch,
              disabledPanelIds: [],
            }
          : area,
      ),
    );
  }

  function togglePanel(areaId: string, panelId: string) {
    setRoofAreas((current) =>
      current.map((area) => {
        if (area.id !== areaId) {
          return area;
        }

        const disabledPanelIds = area.disabledPanelIds.includes(panelId)
          ? area.disabledPanelIds.filter((id) => id !== panelId)
          : [...area.disabledPanelIds, panelId];

        return {
          ...area,
          disabledPanelIds,
        };
      }),
    );
  }

  return (
    <section className="card aerial-planner-card">
      <div className="card-header">
        <span>Foto</span>
        <h2>Fluxo rapido com foto aerea</h2>
      </div>
      <p className="helper">
        Selecione cada pano do telhado separadamente. O render/3D entra como assistente para estimar
        inclinacao e corrigir a area real antes de posicionar as placas.
      </p>

      <div className="aerial-toolbar">
        <label className="secondary-upload">
          <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event.target.files)} />
          Escolher foto aerea em alta resolucao
        </label>
        <button type="button" onClick={() => setSelectionPoints((current) => current.slice(0, -1))}>
          Desfazer ponto
        </button>
        <button type="button" onClick={() => setSelectionPoints([])}>
          Limpar pontos
        </button>
        <button
          type="button"
          className="primary-mini-action"
          disabled={selectionPoints.length !== 4}
          onClick={addSelectedRoofArea}
        >
          Adicionar area
        </button>
      </div>

      <div className="aerial-planner-layout">
        <div className="aerial-stage" onClick={handleStageClick}>
          <img src={imageUrl} alt={imageName} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {selectionPoints.length > 1 && <polyline className="house-selection-line" points={toSvgPoints(selectionPoints)} />}
            {selectionPoints.length > 2 && <polygon className="house-selection-fill" points={toSvgPoints(selectionPoints)} />}
            {selectionPoints.map((point, index) => (
              <circle key={`${point.x}-${point.y}-${index}`} className="selection-point" cx={point.x} cy={point.y} r="1.2" />
            ))}
            {plannedAreas.map(({ area, panels }) => (
              <g key={area.id} className={selectedArea?.id === area.id ? "roof-area active" : "roof-area"}>
                <polygon className="roof-candidate-polygon" points={toSvgPoints(area.polygon)} />
                <text className="roof-area-label" x={area.polygon[0].x} y={area.polygon[0].y - 1}>
                  {area.name} / {area.slopeDegrees} deg
                </text>
                {panels.map((panel) => {
                  const disabled = area.disabledPanelIds.includes(panel.id);
                  return (
                    <polygon
                      key={panel.id}
                      className={disabled ? "auto-panel disabled" : "auto-panel"}
                      points={toSvgPoints(panel.points)}
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePanel(area.id, panel.id);
                      }}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
        </div>

        <aside className="auto-planner-sidebar">
          <div className="aerial-instructions">
            <strong>{imageName}</strong>
            <p>
              Clique em 4 cantos de um pano do telhado e depois em Adicionar area. Repita para todos
              os panos onde placas podem ser instaladas.
            </p>
          </div>

          <div className="auto-kpis">
            <div>
              <strong>{totalPanels}</strong>
              <span>placas totais</span>
            </div>
            <div>
              <strong>{totalKwp.toFixed(2)} kWp</strong>
              <span>potencia total</span>
            </div>
            <div>
              <strong>{roofAreas.length}</strong>
              <span>areas</span>
            </div>
          </div>

          <label>
            Area selecionada
            <select value={selectedArea?.id ?? ""} onChange={(event) => setSelectedAreaId(event.target.value)}>
              {roofAreas.length === 0 && <option value="">Nenhuma area adicionada</option>}
              {roofAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} - inclinacao {area.slopeDegrees} deg
                </option>
              ))}
            </select>
          </label>

          <div className="inline-fields">
            <label>
              Comprimento da nova area (m)
              <input
                type="number"
                min="1"
                step="0.1"
                value={newAreaLengthMeters}
                onChange={(event) => setNewAreaLengthMeters(Number(event.target.value))}
              />
            </label>
            <label>
              Largura projetada nova (m)
              <input
                type="number"
                min="1"
                step="0.1"
                value={newAreaWidthMeters}
                onChange={(event) => setNewAreaWidthMeters(Number(event.target.value))}
              />
            </label>
          </div>

          {selectedArea ? (
            <>
              <div className="render-assist-box">
                <strong>Assistencia do render/3D</strong>
                <p>
                  Inclinacao estimada: {selectedArea.slopeDegrees} deg. Largura real corrigida:{" "}
                  {correctWidthForSlope(selectedArea.projectedWidthMeters, selectedArea.slopeDegrees).toFixed(2)} m.
                </p>
              </div>

              {renderSlopePlanes.length > 0 && (
                <div className="render-plane-list">
                  <strong>Planos identificados no render</strong>
                  <p>Escolha o plano que mais parece com este pano do telhado.</p>
                  {renderSlopePlanes.map((plane) => (
                    <button
                      key={plane.id}
                      type="button"
                      className={selectedArea.slopeDegrees === plane.slopeDegrees ? "selected" : ""}
                      onClick={() => updateSelectedArea({ slopeDegrees: plane.slopeDegrees })}
                    >
                      <span>{plane.name}</span>
                      <b>{plane.slopeDegrees} deg</b>
                      <small>{plane.pointCount.toLocaleString("pt-BR")} pontos</small>
                    </button>
                  ))}
                </div>
              )}

              <div className="inline-fields">
                <label>
                  Comprimento area (m)
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={selectedArea.lengthMeters}
                    onChange={(event) => updateSelectedArea({ lengthMeters: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Largura projetada (m)
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={selectedArea.projectedWidthMeters}
                    onChange={(event) => updateSelectedArea({ projectedWidthMeters: Number(event.target.value) })}
                  />
                </label>
              </div>

              <label>
                Inclinacao pelo render/3D (graus)
                <input
                  type="range"
                  min="0"
                  max="45"
                  step="1"
                  value={selectedArea.slopeDegrees}
                  onChange={(event) => updateSelectedArea({ slopeDegrees: Number(event.target.value) })}
                />
                <span>{selectedArea.slopeDegrees} deg</span>
              </label>

              <button type="button" className="danger-action" onClick={removeSelectedArea}>
                Remover area selecionada
              </button>
            </>
          ) : (
            <div className="auto-notes">
              <p>Nenhuma area adicionada. Marque 4 pontos no telhado para comecar.</p>
            </div>
          )}

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

      {roofAreas.length > 0 && (
        <div className="clean-model-section">
          <div>
            <h3>Modelo tecnico 3D limpo</h3>
            <p className="helper">
              Esta visualizacao redesenha os panos selecionados como superficies tecnicas limpas,
              usando a inclinacao detectada no render. E aqui que as placas devem ficar no produto final.
            </p>
          </div>
          <CleanTechnicalModelViewer
            areas={roofAreas}
            gapMeters={gapMeters}
            orientation={orientation}
            selectedPanel={selectedPanel}
            setbackMeters={setbackMeters}
          />
        </div>
      )}
    </section>
  );
}

function buildPanelPolygons(
  area: RoofArea,
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
        id: `${area.id}-${row}-${column}`,
        points: [
          interpolateQuad(area.polygon, u0, v0),
          interpolateQuad(area.polygon, u1, v0),
          interpolateQuad(area.polygon, u1, v1),
          interpolateQuad(area.polygon, u0, v1),
        ],
      });
    }
  }

  return panels;
}

function normalizeRoofQuad(points: [Point, Point, Point, Point]): [Point, Point, Point, Point] {
  const sortedByY = [...points].sort((a, b) => a.y - b.y);
  const top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

function correctWidthForSlope(projectedWidthMeters: number, slopeDegrees: number) {
  const radians = (slopeDegrees * Math.PI) / 180;
  const cosine = Math.max(Math.cos(radians), 0.35);
  return projectedWidthMeters / cosine;
}

function estimateSlopeFromRender(polygon: [Point, Point, Point, Point], index: number) {
  const centerY = polygon.reduce((total, point) => total + point.y, 0) / polygon.length;
  const baseSlope = centerY < 45 ? 18 : 12;
  return clamp(Math.round(baseSlope + (index % 3) * 3), 5, 35);
}

function interpolateQuad([topLeft, topRight, bottomRight, bottomLeft]: RoofArea["polygon"], u: number, v: number) {
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
