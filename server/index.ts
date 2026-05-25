import cors from "cors";
import express from "express";
import multer from "multer";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import { getJob, saveJob } from "./reconstructionStore";
import type { ReconstructionJob } from "./reconstructionStore";
import { runPhotogrammetry } from "./photogrammetry";

const port = Number(process.env.API_PORT ?? 3001);
const rootDirectory = process.cwd();
const reconstructionRoot = path.join(rootDirectory, "data", "reconstructions");

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
