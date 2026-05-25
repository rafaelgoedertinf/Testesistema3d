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
    ]);

    await runColmapStep(job, "Comparando fotos", [
      "exhaustive_matcher",
      "--database_path",
      databasePath,
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

    updateJob(job.id, {
      status: "completed",
      currentStep: "Reconstrucao concluida",
      message: "Nuvem de pontos 3D gerada com sucesso.",
      outputFiles: ["sparse-point-cloud.ply"],
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
