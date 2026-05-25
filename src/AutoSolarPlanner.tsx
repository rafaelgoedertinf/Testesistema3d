import { useMemo, useState } from "react";
import { calculateLayout } from "./layoutCalculator";
import type { SolarPanel } from "./types";

type Point = {
  x: number;
  y: number;
};

export type RoofAnalysis = {
  available: boolean;
  imageUrl?: string;
  candidates?: RoofCandidate[];
};

type RoofCandidate = {
  id: string;
  name: string;
  confidence: number;
  dimensionsMeters: {
    length: number;
    width: number;
  };
  polygon: [Point, Point, Point, Point];
  notes: string[];
};

type AutoSolarPlannerProps = {
  analysis: RoofAnalysis;
  selectedPanel: SolarPanel;
};

type OrientationMode = "auto" | "portrait" | "landscape";

export default function AutoSolarPlanner({ analysis, selectedPanel }: AutoSolarPlannerProps) {
  const candidates = analysis.candidates ?? [];
  const [selectedCandidateId, setSelectedCandidateId] = useState(candidates[0]?.id ?? "");
  const [orientation, setOrientation] = useState<OrientationMode>("auto");
  const [setbackMeters, setSetbackMeters] = useState(0.35);
  const [gapMeters, setGapMeters] = useState(0.04);
  const [disabledPanelIds, setDisabledPanelIds] = useState<string[]>([]);
  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0];

  const layout = useMemo(() => {
    if (!selectedCandidate) {
      return undefined;
    }

    return calculateLayout(selectedPanel, {
      lengthMeters: selectedCandidate.dimensionsMeters.length,
      widthMeters: selectedCandidate.dimensionsMeters.width,
      setbackMeters,
      gapMeters,
      orientation,
    });
  }, [gapMeters, orientation, selectedCandidate, selectedPanel, setbackMeters]);

  const panelPolygons = useMemo(() => {
    if (!layout || !selectedCandidate) {
      return [];
    }

    return buildPanelPolygons(selectedCandidate, layout, setbackMeters, gapMeters);
  }, [gapMeters, layout, selectedCandidate, setbackMeters]);

  const activePanelCount = panelPolygons.filter((panel) => !disabledPanelIds.includes(panel.id)).length;
  const totalKwp = (activePanelCount * selectedPanel.powerWatts) / 1000;

  if (!analysis.available || !analysis.imageUrl || candidates.length === 0 || !selectedCandidate || !layout) {
    return null;
  }

  function togglePanel(panelId: string) {
    setDisabledPanelIds((current) =>
      current.includes(panelId)
        ? current.filter((id) => id !== panelId)
        : [...current, panelId],
    );
  }

  return (
    <section className="card auto-planner-card">
      <div className="card-header">
        <span>AI</span>
        <h2>Analise automatica do telhado</h2>
      </div>
      <p className="helper">
        Prototipo do fluxo do vendedor: o sistema sugere uma area de telhado, preenche com a placa
        selecionada e permite remover placas com um clique.
      </p>

      <div className="auto-planner-layout">
        <div className="roof-image-stage">
          <img src={analysis.imageUrl} alt="Imagem base do telhado analisado" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon className="roof-candidate-polygon" points={toSvgPoints(selectedCandidate.polygon)} />
            {panelPolygons.map((panel) => {
              const disabled = disabledPanelIds.includes(panel.id);
              return (
                <polygon
                  key={panel.id}
                  className={disabled ? "auto-panel disabled" : "auto-panel"}
                  points={toSvgPoints(panel.points)}
                  onClick={() => togglePanel(panel.id)}
                />
              );
            })}
          </svg>
        </div>

        <aside className="auto-planner-sidebar">
          <label>
            Area detectada
            <select
              value={selectedCandidate.id}
              onChange={(event) => {
                setSelectedCandidateId(event.target.value);
                setDisabledPanelIds([]);
              }}
            >
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
              <span>placas sugeridas</span>
            </div>
            <div>
              <strong>{totalKwp.toFixed(2)} kWp</strong>
              <span>potencia estimada</span>
            </div>
            <div>
              <strong>
                {layout.columns} x {layout.rows}
              </strong>
              <span>grade automatica</span>
            </div>
          </div>

          <div className="inline-fields">
            <label>
              Recuo (m)
              <input
                type="number"
                min="0"
                step="0.05"
                value={setbackMeters}
                onChange={(event) => {
                  setSetbackMeters(Number(event.target.value));
                  setDisabledPanelIds([]);
                }}
              />
            </label>
            <label>
              Espaco (m)
              <input
                type="number"
                min="0"
                step="0.01"
                value={gapMeters}
                onChange={(event) => {
                  setGapMeters(Number(event.target.value));
                  setDisabledPanelIds([]);
                }}
              />
            </label>
          </div>

          <label>
            Orientacao
            <select
              value={orientation}
              onChange={(event) => {
                setOrientation(event.target.value as OrientationMode);
                setDisabledPanelIds([]);
              }}
            >
              <option value="auto">Automatico</option>
              <option value="portrait">Retrato</option>
              <option value="landscape">Paisagem</option>
            </select>
          </label>

          <div className="auto-notes">
            {selectedCandidate.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildPanelPolygons(
  candidate: RoofCandidate,
  layout: NonNullable<ReturnType<typeof calculateLayout>>,
  setbackMeters: number,
  gapMeters: number,
) {
  const panels: Array<{ id: string; points: [Point, Point, Point, Point] }> = [];
  const roofLength = candidate.dimensionsMeters.length;
  const roofWidth = candidate.dimensionsMeters.width;
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
        id: `auto-${row}-${column}`,
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
