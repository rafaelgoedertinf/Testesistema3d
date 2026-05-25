import { useEffect, useMemo, useState } from "react";
import { calculateLayout, calculateScaleFactor } from "./layoutCalculator";
import PointCloudViewer from "./PointCloudViewer";
import type { CustomerProject, RoofSettings, ScaleReference, SolarPanel } from "./types";

const STORAGE_KEY = "solarfit-3d-mvp-state";

const defaultPanels: SolarPanel[] = [
  {
    id: "canadian-575",
    manufacturer: "Canadian Solar",
    model: "575 W",
    widthMeters: 1.134,
    heightMeters: 2.278,
    powerWatts: 575,
  },
  {
    id: "longi-550",
    manufacturer: "LONGi",
    model: "550 W",
    widthMeters: 1.134,
    heightMeters: 2.256,
    powerWatts: 550,
  },
  {
    id: "jinko-580",
    manufacturer: "Jinko Solar",
    model: "580 W",
    widthMeters: 1.134,
    heightMeters: 2.278,
    powerWatts: 580,
  },
];

type SavedState = {
  project: CustomerProject;
  panels: SolarPanel[];
  selectedPanelId: string;
  roof: RoofSettings;
  scale: ScaleReference;
  disabledPanelIds: string[];
};

type ReconstructionJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  photoCount: number;
  message: string;
  currentStep?: string;
  errorCode?: "ENGINE_MISSING" | "PROCESS_FAILED";
  outputFiles: string[];
};

const initialProject: CustomerProject = {
  customerName: "",
  phone: "",
  email: "",
  address: "",
};

const initialRoof: RoofSettings = {
  lengthMeters: 8,
  widthMeters: 5,
  setbackMeters: 0.3,
  gapMeters: 0.03,
  orientation: "auto",
};

const initialScale: ScaleReference = {
  modelDistance: 1,
  realDistanceMeters: 1,
};

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function createPanelId(panel: Omit<SolarPanel, "id">) {
  return `${panel.manufacturer}-${panel.model}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function loadState(): SavedState | null {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    return rawState ? (JSON.parse(rawState) as SavedState) : null;
  } catch {
    return null;
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 180);
  throw new Error(
    preview.startsWith("<!DOCTYPE") || preview.startsWith("<html")
      ? "O servidor respondeu uma pagina HTML em vez de JSON. Se voce enviou fotos grandes, provavelmente o limite do link temporario de teste foi atingido. Tente enviar 10 fotos menores para validar o fluxo."
      : preview || "Resposta inesperada do servidor.",
  );
}

export default function App() {
  const savedState = useMemo(loadState, []);
  const [project, setProject] = useState<CustomerProject>(savedState?.project ?? initialProject);
  const [panels, setPanels] = useState<SolarPanel[]>(savedState?.panels ?? defaultPanels);
  const [selectedPanelId, setSelectedPanelId] = useState(
    savedState?.selectedPanelId ?? defaultPanels[0].id,
  );
  const [roof, setRoof] = useState<RoofSettings>(savedState?.roof ?? initialRoof);
  const [scale, setScale] = useState<ScaleReference>(savedState?.scale ?? initialScale);
  const [disabledPanelIds, setDisabledPanelIds] = useState<string[]>(
    savedState?.disabledPanelIds ?? [],
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [reconstructionJob, setReconstructionJob] = useState<ReconstructionJob | null>(null);
  const [reconstructionError, setReconstructionError] = useState("");
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [newPanel, setNewPanel] = useState<Omit<SolarPanel, "id">>({
    manufacturer: "",
    model: "",
    widthMeters: 1.134,
    heightMeters: 2.278,
    powerWatts: 575,
  });

  const selectedPanel = panels.find((panel) => panel.id === selectedPanelId) ?? panels[0];
  const layout = useMemo(() => calculateLayout(selectedPanel, roof), [roof, selectedPanel]);
  const gridPanelIds = useMemo(() => {
    return Array.from({ length: layout.rows * layout.columns }, (_, index) => `panel-${index}`);
  }, [layout.columns, layout.rows]);
  const enabledPanelCount = gridPanelIds.filter((id) => !disabledPanelIds.includes(id)).length;
  const scaleFactor = calculateScaleFactor(scale.modelDistance, scale.realDistanceMeters);
  const projectIsValid = project.customerName.trim().length > 0 && project.phone.trim().length > 0;
  const totalPhotoSizeMb = photoFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024;
  const pointCloudFile = reconstructionJob?.outputFiles.find((file) => file.endsWith(".ply"));
  const reconstructionIsRunning =
    reconstructionJob?.status === "queued" || reconstructionJob?.status === "running";

  useEffect(() => {
    const validIds = new Set(gridPanelIds);
    setDisabledPanelIds((current) => current.filter((id) => validIds.has(id)));
  }, [gridPanelIds]);

  useEffect(() => {
    const state: SavedState = {
      project,
      panels,
      selectedPanelId,
      roof,
      scale,
      disabledPanelIds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [disabledPanelIds, panels, project, roof, scale, selectedPanelId]);

  useEffect(() => {
    if (!reconstructionJob || !["queued", "running"].includes(reconstructionJob.status)) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/reconstructions/${reconstructionJob.id}`);
        if (!response.ok) {
          return;
        }

        const job = await readApiResponse<ReconstructionJob>(response);
        setReconstructionJob(job);
      } catch {
        // The UI keeps the last known status if polling temporarily fails.
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [reconstructionJob]);

  function updateProject(field: keyof CustomerProject, value: string) {
    setProject((current) => ({ ...current, [field]: value }));
  }

  function updateRoof(field: keyof RoofSettings, value: number | RoofSettings["orientation"]) {
    setRoof((current) => ({ ...current, [field]: value }));
  }

  function updateScale(field: keyof ScaleReference, value: number) {
    setScale((current) => ({ ...current, [field]: value }));
  }

  function handlePhotoSelection(files: FileList | null) {
    setPhotoFiles(files ? Array.from(files) : []);
    setReconstructionJob(null);
    setReconstructionError("");
  }

  async function handleStartReconstruction() {
    if (photoFiles.length < 10) {
      setReconstructionError("Selecione pelo menos 10 fotos antes de gerar o 3D.");
      return;
    }

    if (totalPhotoSizeMb > 80 && window.location.hostname.endsWith("trycloudflare.com")) {
      setReconstructionError(
        "Para este link temporario de teste, envie ate aproximadamente 80 MB de fotos. Depois, no app instalado, esse limite sera diferente.",
      );
      return;
    }

    setIsUploadingPhotos(true);
    setReconstructionError("");
    setReconstructionJob(null);

    try {
      const formData = new FormData();
      photoFiles.forEach((file) => formData.append("photos", file));

      const response = await fetch("/api/reconstructions", {
        method: "POST",
        body: formData,
      });

      const payload = await readApiResponse<{ message?: string } | ReconstructionJob>(response);

      if (!response.ok) {
        throw new Error(payload.message ?? "Nao foi possivel iniciar a geracao 3D.");
      }

      setReconstructionJob(payload as ReconstructionJob);
    } catch (error) {
      setReconstructionError(
        error instanceof Error ? error.message : "Nao foi possivel iniciar a geracao 3D.",
      );
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  function handleAddPanel() {
    if (!newPanel.manufacturer.trim() || !newPanel.model.trim()) {
      return;
    }

    const panel: SolarPanel = {
      ...newPanel,
      id: createPanelId(newPanel),
    };

    setPanels((current) => [...current, panel]);
    setSelectedPanelId(panel.id);
    setNewPanel({
      manufacturer: "",
      model: "",
      widthMeters: 1.134,
      heightMeters: 2.278,
      powerWatts: 575,
    });
  }

  function togglePanel(panelId: string) {
    setDisabledPanelIds((current) =>
      current.includes(panelId)
        ? current.filter((id) => id !== panelId)
        : [...current, panelId],
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <span className="eyebrow">MVP local para MacBook</span>
          <h1>SolarFit 3D</h1>
          <p>
            Base inicial para validar se placas solares cabem no telhado do cliente. O upload real
            de fotos agora cria uma tarefa de reconstrucao 3D para integrar com o motor COLMAP.
          </p>
        </div>
        <div className="status-card">
          <strong>{projectIsValid ? "Projeto pronto para simular" : "Preencha nome e telefone"}</strong>
          <span>{enabledPanelCount} placas ativas no layout atual</span>
        </div>
      </section>

      <section className="grid two-columns">
        <div className="card">
          <div className="card-header">
            <span>1</span>
            <h2>Novo projeto</h2>
          </div>
          <label>
            Nome do cliente *
            <input
              value={project.customerName}
              onChange={(event) => updateProject("customerName", event.target.value)}
              placeholder="Ex.: Maria Silva"
            />
          </label>
          <label>
            Telefone *
            <input
              value={project.phone}
              onChange={(event) => updateProject("phone", event.target.value)}
              placeholder="Ex.: (47) 99999-0000"
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={project.email}
              onChange={(event) => updateProject("email", event.target.value)}
              placeholder="cliente@email.com"
            />
          </label>
          <label>
            Endereco
            <input
              value={project.address}
              onChange={(event) => updateProject("address", event.target.value)}
              placeholder="Rua, numero, cidade"
            />
          </label>
        </div>

        <div className="card">
          <div className="card-header">
            <span>2</span>
            <h2>Fotos de drone</h2>
          </div>
          <label className="upload-box">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => handlePhotoSelection(event.target.files)}
            />
            <strong>Selecionar fotos</strong>
            <small>Importe pelo menos 10 fotos para um projeto real.</small>
          </label>
          <div className={photoFiles.length >= 10 ? "notice success" : "notice warning"}>
            {photoFiles.length === 0
              ? "Nenhuma foto selecionada ainda."
              : `${photoFiles.length} fotos selecionadas (${formatNumber(totalPhotoSizeMb, 1)} MB).`}
            {photoFiles.length > 0 && photoFiles.length < 10 && " Recomendacao: adicionar mais fotos."}
          </div>
          <ul className="file-list">
            {photoFiles.slice(0, 6).map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
            {photoFiles.length > 6 && <li>+ {photoFiles.length - 6} arquivos</li>}
          </ul>
          <button
            type="button"
            className="primary-action"
            onClick={handleStartReconstruction}
            disabled={isUploadingPhotos || reconstructionIsRunning || photoFiles.length < 10}
          >
            {isUploadingPhotos
              ? "Enviando fotos..."
              : reconstructionIsRunning
                ? "Processando 3D..."
                : "Gerar 3D das fotos"}
          </button>
          {reconstructionError && <div className="notice error">{reconstructionError}</div>}
          {reconstructionJob && (
            <div className={`reconstruction-status ${reconstructionJob.status}`}>
              <div>
                <strong>
                  {reconstructionJob.status === "completed"
                    ? "3D gerado"
                    : reconstructionJob.status === "failed"
                      ? "Geracao 3D interrompida"
                      : "Gerando 3D"}
                </strong>
                <span>{reconstructionJob.currentStep}</span>
              </div>
              <p>{reconstructionJob.message}</p>
              {reconstructionJob.errorCode === "ENGINE_MISSING" && (
                <p>
                  Este ambiente de teste ainda nao tem o motor 3D instalado. No Mac, a proxima
                  etapa sera empacotar COLMAP/OpenDroneMap junto ao instalador.
                </p>
              )}
              {reconstructionJob.outputFiles.length > 0 && (
                <ul>
                  {reconstructionJob.outputFiles.map((file) => (
                    <li key={file}>
                      <a href={`/api/reconstructions/${reconstructionJob.id}/files/${file}`}>
                        Baixar {file}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {reconstructionJob.status === "completed" && pointCloudFile && (
                <div className="viewer-block">
                  <strong>Previa tecnica da nuvem de pontos</strong>
                  <p>
                    Esta visualizacao ainda nao e a versao final para cliente: faltam superficie
                    densa e textura. Ela serve para validar se as fotos foram reconstruidas.
                  </p>
                  <PointCloudViewer
                    url={`/api/reconstructions/${reconstructionJob.id}/files/${pointCloudFile}`}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid two-columns">
        <div className="card">
          <div className="card-header">
            <span>3</span>
            <h2>Escala e area do telhado</h2>
          </div>
          <div className="inline-fields">
            <label>
              Distancia no modelo
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={scale.modelDistance}
                onChange={(event) => updateScale("modelDistance", Number(event.target.value))}
              />
            </label>
            <label>
              Medida real (m)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={scale.realDistanceMeters}
                onChange={(event) => updateScale("realDistanceMeters", Number(event.target.value))}
              />
            </label>
          </div>
          <p className="helper">
            Fator de escala atual: <strong>{formatNumber(scaleFactor, 3)} m por unidade</strong>.
            Futuramente este clique sera feito direto no 3D.
          </p>
          <div className="inline-fields">
            <label>
              Comprimento util do telhado (m)
              <input
                type="number"
                min="0"
                step="0.1"
                value={roof.lengthMeters}
                onChange={(event) => updateRoof("lengthMeters", Number(event.target.value))}
              />
            </label>
            <label>
              Largura util do telhado (m)
              <input
                type="number"
                min="0"
                step="0.1"
                value={roof.widthMeters}
                onChange={(event) => updateRoof("widthMeters", Number(event.target.value))}
              />
            </label>
          </div>
          <div className="inline-fields">
            <label>
              Recuo das bordas (m)
              <input
                type="number"
                min="0"
                step="0.05"
                value={roof.setbackMeters}
                onChange={(event) => updateRoof("setbackMeters", Number(event.target.value))}
              />
            </label>
            <label>
              Espaco entre placas (m)
              <input
                type="number"
                min="0"
                step="0.01"
                value={roof.gapMeters}
                onChange={(event) => updateRoof("gapMeters", Number(event.target.value))}
              />
            </label>
          </div>
          <label>
            Orientacao das placas
            <select
              value={roof.orientation}
              onChange={(event) => updateRoof("orientation", event.target.value as RoofSettings["orientation"])}
            >
              <option value="auto">Automatico: escolher maior quantidade</option>
              <option value="portrait">Retrato</option>
              <option value="landscape">Paisagem</option>
            </select>
          </label>
        </div>

        <div className="card">
          <div className="card-header">
            <span>4</span>
            <h2>Placas solares</h2>
          </div>
          <label>
            Placa selecionada
            <select value={selectedPanelId} onChange={(event) => setSelectedPanelId(event.target.value)}>
              {panels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {panel.manufacturer} {panel.model} - {panel.powerWatts} W
                </option>
              ))}
            </select>
          </label>
          <div className="panel-details">
            <span>{formatNumber(selectedPanel.widthMeters)} m x {formatNumber(selectedPanel.heightMeters)} m</span>
            <span>{selectedPanel.powerWatts} W por placa</span>
          </div>
          <div className="new-panel-form">
            <h3>Cadastrar nova placa</h3>
            <div className="inline-fields">
              <label>
                Fabricante
                <input
                  value={newPanel.manufacturer}
                  onChange={(event) =>
                    setNewPanel((current) => ({ ...current, manufacturer: event.target.value }))
                  }
                  placeholder="Ex.: JA Solar"
                />
              </label>
              <label>
                Modelo
                <input
                  value={newPanel.model}
                  onChange={(event) => setNewPanel((current) => ({ ...current, model: event.target.value }))}
                  placeholder="Ex.: 585 W"
                />
              </label>
            </div>
            <div className="inline-fields three">
              <label>
                Largura (m)
                <input
                  type="number"
                  min="0.1"
                  step="0.001"
                  value={newPanel.widthMeters}
                  onChange={(event) =>
                    setNewPanel((current) => ({ ...current, widthMeters: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                Altura (m)
                <input
                  type="number"
                  min="0.1"
                  step="0.001"
                  value={newPanel.heightMeters}
                  onChange={(event) =>
                    setNewPanel((current) => ({ ...current, heightMeters: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                Potencia (W)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newPanel.powerWatts}
                  onChange={(event) =>
                    setNewPanel((current) => ({ ...current, powerWatts: Number(event.target.value) }))
                  }
                />
              </label>
            </div>
            <button type="button" onClick={handleAddPanel}>
              Adicionar placa
            </button>
          </div>
        </div>
      </section>

      <section className="card layout-card">
        <div className="card-header">
          <span>5</span>
          <h2>Simulacao de encaixe no telhado</h2>
        </div>
        <div className="summary-grid">
          <div>
            <strong>{enabledPanelCount}</strong>
            <span>placas ativas</span>
          </div>
          <div>
            <strong>{formatNumber((enabledPanelCount * selectedPanel.powerWatts) / 1000, 2)} kWp</strong>
            <span>potencia total</span>
          </div>
          <div>
            <strong>{layout.columns} x {layout.rows}</strong>
            <span>grade sugerida</span>
          </div>
          <div>
            <strong>{layout.orientation === "portrait" ? "Retrato" : "Paisagem"}</strong>
            <span>orientacao usada</span>
          </div>
        </div>

        {layout.totalPanels === 0 ? (
          <div className="empty-state">
            Area insuficiente para esta placa com os recuos e espacamentos configurados.
          </div>
        ) : (
          <div
            className="roof-preview"
            style={{
              gridTemplateColumns: `repeat(${layout.columns}, minmax(28px, 1fr))`,
            }}
          >
            {gridPanelIds.map((panelId) => {
              const disabled = disabledPanelIds.includes(panelId);
              return (
                <button
                  key={panelId}
                  type="button"
                  className={disabled ? "panel-cell disabled" : "panel-cell"}
                  onClick={() => togglePanel(panelId)}
                  title={disabled ? "Clique para recolocar" : "Clique para remover"}
                >
                  {disabled ? "" : "PV"}
                </button>
              );
            })}
          </div>
        )}
        <p className="helper">
          Clique em uma placa para remover ou recolocar manualmente. Na etapa 3D, esta grade sera
          projetada sobre o plano real do telhado.
        </p>
      </section>
    </main>
  );
}
