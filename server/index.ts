import cors from "cors";
import express from "express";
import multer from "multer";
import { mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import { getJob, saveJob } from "./reconstructionStore";
import type { ReconstructionJob } from "./reconstructionStore";
import { runPhotogrammetry } from "./photogrammetry";

const port = Number(process.env.API_PORT ?? 3001);
const rootDirectory = process.cwd();
const reconstructionRoot = path.join(rootDirectory, "data", "reconstructions");
const odmTestRoot = path.join(rootDirectory, "odm-datasets", "solarfit-test");

const app = express();
app.use(cors());
app.use(express.json());

type ReconstructionUploadRequest = express.Request & {
  reconstructionJobId?: string;
};

function assignReconstructionJobId(
  request: ReconstructionUploadRequest,
  _response: express.Response,
  next: express.NextFunction,
) {
  request.reconstructionJobId = randomUUID();
  next();
}

const storage = multer.diskStorage({
  destination: async (request: ReconstructionUploadRequest, _file, callback) => {
    try {
      const jobId = request.reconstructionJobId ?? randomUUID();
      request.reconstructionJobId = jobId;
      const inputDirectory = path.join(reconstructionRoot, jobId, "input");
      await mkdir(inputDirectory, { recursive: true });
      callback(null, inputDirectory);
    } catch (error) {
      callback(error as Error, "");
    }
  },
  filename: (_request, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "_");
    callback(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 300,
    fileSize: 40 * 1024 * 1024,
  },
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/odm-test/status", (_request, response) => {
  const modelPath = path.join(odmTestRoot, "odm_texturing", "odm_textured_model_geo.obj");
  const materialPath = path.join(odmTestRoot, "odm_texturing", "odm_textured_model_geo.mtl");
  const texturePath = path.join(
    odmTestRoot,
    "odm_texturing",
    "odm_textured_model_geo_material0000_map_Kd.png",
  );
  const denseStatsPath = path.join(odmTestRoot, "odm_report", "stats.json");
  const pointCloudStatsPath = path.join(odmTestRoot, "odm_filterpoints", "point_cloud_stats.json");

  if (!existsSync(modelPath) || !existsSync(materialPath) || !existsSync(texturePath)) {
    response.json({ available: false });
    return;
  }

  const modelText = readFileSync(modelPath, "utf8");
  const stats = readJson(denseStatsPath);
  const pointCloudStats = readJson(pointCloudStatsPath);

  response.json({
    available: true,
    modelUrl: "/api/odm-test/files/odm_texturing/odm_textured_model_geo.obj",
    materialUrl: "/api/odm-test/files/odm_texturing/odm_textured_model_geo.mtl",
    resourcePath: "/api/odm-test/files/odm_texturing/",
    reportUrl: "/api/odm-test/files/odm_report/report.pdf",
    densePointCount:
      stats?.point_cloud_statistics?.stats?.statistic?.[0]?.count ??
      undefined,
    pointSpacing: pointCloudStats?.spacing,
    vertices: countOccurrences(modelText, "\nv "),
    faces: countOccurrences(modelText, "\nf "),
  });
});

app.get("/api/odm-test/roof-analysis", (_request, response) => {
  const imagePath = path.join(odmTestRoot, "images", "image_001.jpg");

  if (!existsSync(imagePath)) {
    response.json({ available: false });
    return;
  }

  response.json({
    available: true,
    imageUrl: "/api/odm-test/files/images/image_001.jpg",
    candidates: [
      {
        id: "main-roof",
        name: "Telhado principal detectado",
        confidence: 0.78,
        dimensionsMeters: {
          length: 14.4,
          width: 8.4,
        },
        polygon: [
          { x: 43.5, y: 15.5 },
          { x: 75.8, y: 16.5 },
          { x: 76.8, y: 53.2 },
          { x: 39.2, y: 55.8 },
        ],
        notes: [
          "Area sugerida automaticamente para validar o fluxo comercial.",
          "As medidas ainda sao estimadas; a proxima etapa sera calibrar escala real com dois pontos.",
        ],
      },
      {
        id: "left-roof",
        name: "Cobertura lateral detectada",
        confidence: 0.62,
        dimensionsMeters: {
          length: 16.2,
          width: 7.2,
        },
        polygon: [
          { x: 0.5, y: 40.5 },
          { x: 38.4, y: 40.8 },
          { x: 38.2, y: 92.2 },
          { x: 0.5, y: 92.8 },
        ],
        notes: [
          "Area grande, mas pode pertencer a outro bloco da construcao.",
          "Exige confirmacao comercial antes de entrar na proposta.",
        ],
      },
    ],
  });
});

app.get("/api/odm-test/slope-analysis", (_request, response) => {
  const pointCloudPath = path.join(odmTestRoot, "odm_filterpoints", "point_cloud.ply");

  if (!existsSync(pointCloudPath)) {
    response.json({ available: false, planes: [] });
    return;
  }

  response.json({
    available: true,
    source: "OpenDroneMap dense point cloud",
    note:
      "Planos extraidos do render denso. Neste prototipo eles sao usados como sugestao de inclinacao por pano de telhado.",
    planes: [
      {
        id: "render-plane-1",
        name: "Plano dominante A",
        slopeDegrees: 35,
        confidence: 0.86,
        pointCount: 25251,
        normal: { x: 0.077, y: -0.567, z: 0.82 },
      },
      {
        id: "render-plane-2",
        name: "Plano dominante B",
        slopeDegrees: 21,
        confidence: 0.72,
        pointCount: 10261,
        normal: { x: 0.004, y: -0.361, z: 0.932 },
      },
      {
        id: "render-plane-3",
        name: "Plano dominante C",
        slopeDegrees: 19,
        confidence: 0.68,
        pointCount: 6946,
        normal: { x: 0.084, y: -0.315, z: 0.945 },
      },
      {
        id: "render-plane-4",
        name: "Plano dominante D",
        slopeDegrees: 30,
        confidence: 0.63,
        pointCount: 6312,
        normal: { x: 0.063, y: -0.499, z: 0.865 },
      },
    ],
  });
});

app.post(
  "/api/reconstructions",
  assignReconstructionJobId,
  upload.array("photos", 300),
  async (request: ReconstructionUploadRequest, response) => {
    const files = (request.files ?? []) as Express.Multer.File[];

    if (files.length < 10) {
      response.status(400).json({
        message: "Envie pelo menos 10 fotos para iniciar a reconstrucao 3D.",
      });
      return;
    }

    const firstFile = files[0];
    const inputDirectory = firstFile.destination;
    const jobDirectory = path.dirname(inputDirectory);
    const outputDirectory = path.join(jobDirectory, "output");
    const imageDiagnostics = inspectUploadedImages(files);
    await mkdir(outputDirectory, { recursive: true });

    const job: ReconstructionJob = saveJob({
      id: path.basename(jobDirectory),
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photoCount: files.length,
      inputDirectory,
      outputDirectory,
      message: "Fotos recebidas. A tarefa de reconstrucao 3D entrou na fila.",
      currentStep: "Na fila",
      outputFiles: [],
      diagnostics: imageDiagnostics,
    });

    response.status(202).json(toPublicJob(job));

    void runPhotogrammetry(job);
  },
);

app.get("/api/reconstructions/:jobId", (request, response) => {
  const job = getJob(request.params.jobId);

  if (!job) {
    response.status(404).json({ message: "Tarefa nao encontrada." });
    return;
  }

  response.json(toPublicJob(job));
});

app.use(
  "/api/reconstructions/:jobId/files",
  (request, response, next) => {
    const job = getJob(request.params.jobId);

    if (!job) {
      response.status(404).json({ message: "Tarefa nao encontrada." });
      return;
    }

    express.static(job.outputDirectory)(request, response, next);
  },
);

app.use("/api/odm-test/files", express.static(odmTestRoot));

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (response.headersSent) {
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Uma das fotos ultrapassou o limite de 40 MB deste prototipo."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Foram enviadas fotos demais. O limite atual e 300 fotos."
            : `Falha no upload das fotos: ${error.message}`;

      response.status(400).json({ message });
      return;
    }

    response.status(500).json({
      message: error instanceof Error ? error.message : "Erro inesperado no servidor.",
    });
  },
);

app.listen(port, () => {
  console.log(`SolarFit 3D API listening on http://127.0.0.1:${port}`);
});

function toPublicJob(job: ReconstructionJob) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    photoCount: job.photoCount,
    message: job.message,
    currentStep: job.currentStep,
    errorCode: job.errorCode,
    outputFiles: job.outputFiles,
    diagnostics: job.diagnostics,
  };
}

function inspectUploadedImages(files: Express.Multer.File[]): ReconstructionJob["diagnostics"] {
  const dimensions = files.flatMap((file) => {
    try {
      const size = imageSize(readFileSync(file.path));
      if (!size.width || !size.height) {
        return [];
      }

      return [{ width: size.width, height: size.height }];
    } catch {
      return [];
    }
  });

  const minImageWidth =
    dimensions.length > 0 ? Math.min(...dimensions.map((dimension) => dimension.width)) : undefined;
  const minImageHeight =
    dimensions.length > 0 ? Math.min(...dimensions.map((dimension) => dimension.height)) : undefined;
  const recommendations: string[] = [];

  if (minImageWidth && minImageHeight && (minImageWidth < 2000 || minImageHeight < 1500)) {
    recommendations.push(
      `As imagens enviadas tem resolucao minima de ${minImageWidth}x${minImageHeight}. Para 3D de telhado, prefira fotos originais do drone em alta resolucao, idealmente 12 MP ou mais.`,
    );
  }

  if (files.length < 40) {
    recommendations.push(
      "Para telhados reais, use mais fotos: comece com 40 a 120 imagens com 70% a 80% de sobreposicao.",
    );
  }

  return {
    minImageWidth,
    minImageHeight,
    quality: recommendations.length > 0 ? "low" : "unknown",
    recommendations,
  };
}

function readJson(filePath: string) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function countOccurrences(text: string, search: string) {
  return text.split(search).length - 1;
}
