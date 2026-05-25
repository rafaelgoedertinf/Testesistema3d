import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ReconstructionJob } from "./reconstructionStore";
import { updateJob } from "./reconstructionStore";

async function commandExists(command: string) {
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter);

  for (const entry of pathEntries) {
    try {
      await access(path.join(entry, command));
      return true;
    } catch {
      // Continue searching in the remaining PATH entries.
    }
  }

  return false;
}

function runCommand(command: string, args: string[], onOutput: (line: string) => void) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => onOutput(chunk.toString()));
    child.stderr.on("data", (chunk) => onOutput(chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function runCommandWithOutput(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    let output = "";
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function runColmapStep(job: ReconstructionJob, step: string, args: string[]) {
  updateJob(job.id, {
    currentStep: step,
    message: `Executando COLMAP: ${step}`,
  });

  await runCommand("colmap", args, (line) => {
    const cleanLine = line.trim();
    if (cleanLine) {
      updateJob(job.id, {
        message: cleanLine.slice(0, 500),
      });
    }
  });
}

export async function runPhotogrammetry(job: ReconstructionJob) {
  updateJob(job.id, {
    status: "running",
    currentStep: "Verificando motor 3D",
    message: "Verificando se o COLMAP esta instalado neste ambiente.",
  });

  if (!(await commandExists("colmap"))) {
    updateJob(job.id, {
      status: "failed",
      errorCode: "ENGINE_MISSING",
      currentStep: "Motor 3D nao encontrado",
      message:
        "COLMAP nao esta instalado neste ambiente. O upload real ja funciona; o proximo passo e instalar/empacotar o motor 3D no Mac para gerar a nuvem de pontos.",
    });
    return;
  }

  try {
    const databasePath = path.join(job.outputDirectory, "database.db");
    const sparsePath = path.join(job.outputDirectory, "sparse");
    const pointCloudPath = path.join(job.outputDirectory, "sparse-point-cloud.ply");

    await mkdir(sparsePath, { recursive: true });

    await runColmapStep(job, "Extraindo pontos das fotos", [
      "feature_extractor",
      "--database_path",
      databasePath,
      "--image_path",
      job.inputDirectory,
      "--ImageReader.single_camera",
      "1",
      "--SiftExtraction.use_gpu",
      "0",
    ]);

    await runColmapStep(job, "Comparando fotos", [
      "exhaustive_matcher",
      "--database_path",
      databasePath,
      "--SiftMatching.use_gpu",
      "0",
    ]);

    await runColmapStep(job, "Reconstruindo cameras e pontos", [
      "mapper",
      "--database_path",
      databasePath,
      "--image_path",
      job.inputDirectory,
      "--output_path",
      sparsePath,
    ]);

    await runColmapStep(job, "Exportando nuvem de pontos", [
      "model_converter",
      "--input_path",
      path.join(sparsePath, "0"),
      "--output_path",
      pointCloudPath,
      "--output_type",
      "PLY",
    ]);

    const diagnostics = await buildDiagnostics(job, path.join(sparsePath, "0"));
    const qualityMessage =
      diagnostics.quality === "low"
        ? "A reconstrucao ficou com baixa qualidade para apresentacao ao cliente. Veja as recomendacoes abaixo."
        : "Nuvem de pontos colorida gerada com sucesso. Esta e uma previa tecnica esparsa; ainda falta gerar superficie densa e textura para apresentacao ao cliente.";

    updateJob(job.id, {
      status: "completed",
      currentStep: "Reconstrucao concluida",
      message: qualityMessage,
      outputFiles: ["sparse-point-cloud.ply"],
      diagnostics,
    });
  } catch (error) {
    updateJob(job.id, {
      status: "failed",
      errorCode: "PROCESS_FAILED",
      currentStep: "Falha no processamento",
      message: error instanceof Error ? error.message : "Erro desconhecido durante a reconstrucao.",
    });
  }
}

async function buildDiagnostics(job: ReconstructionJob, sparseModelPath: string) {
  const analyzerOutput = await runCommandWithOutput("colmap", [
    "model_analyzer",
    "--path",
    sparseModelPath,
  ]);
  const pointCount = parseMetric(analyzerOutput, /Points:\s+(\d+)/);
  const registeredImages = parseMetric(analyzerOutput, /Registered images:\s+(\d+)/);
  const totalImages = parseMetric(analyzerOutput, /Images:\s+(\d+)/);
  const meanReprojectionErrorPx = parseFloatMetric(
    analyzerOutput,
    /Mean reprojection error:\s+([\d.]+)px/,
  );
  const recommendations = [...(job.diagnostics?.recommendations ?? [])];

  if (pointCount !== undefined && pointCount < 50000) {
    recommendations.push(
      `A nuvem gerou apenas ${pointCount.toLocaleString("pt-BR")} pontos. Para telhado apresentavel, precisamos de uma nuvem densa/malha com muito mais detalhes.`,
    );
  }

  if (
    totalImages !== undefined &&
    registeredImages !== undefined &&
    registeredImages < totalImages
  ) {
    recommendations.push(
      `Somente ${registeredImages} de ${totalImages} fotos foram usadas na reconstrucao. Capture fotos com mais sobreposicao e menos mudanca brusca de angulo.`,
    );
  }

  const quality =
    recommendations.length > 0 || (pointCount !== undefined && pointCount < 50000)
      ? "low"
      : "medium";

  return {
    ...job.diagnostics,
    pointCount,
    registeredImages,
    totalImages,
    meanReprojectionErrorPx,
    quality,
    recommendations,
  };
}

function parseMetric(output: string, regex: RegExp) {
  const match = output.match(regex);
  return match ? Number(match[1]) : undefined;
}

function parseFloatMetric(output: string, regex: RegExp) {
  const match = output.match(regex);
  return match ? Number.parseFloat(match[1]) : undefined;
}
