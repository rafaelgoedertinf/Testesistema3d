export type ReconstructionStatus = "queued" | "running" | "completed" | "failed";

export type ReconstructionJob = {
  id: string;
  status: ReconstructionStatus;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  inputDirectory: string;
  outputDirectory: string;
  message: string;
  currentStep?: string;
  errorCode?: "ENGINE_MISSING" | "PROCESS_FAILED";
  outputFiles: string[];
  diagnostics?: ReconstructionDiagnostics;
};

export type ReconstructionDiagnostics = {
  pointCount?: number;
  registeredImages?: number;
  totalImages?: number;
  meanReprojectionErrorPx?: number;
  minImageWidth?: number;
  minImageHeight?: number;
  quality: "unknown" | "low" | "medium" | "good";
  recommendations: string[];
};

const jobs = new Map<string, ReconstructionJob>();

export function saveJob(job: ReconstructionJob) {
  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, patch: Partial<ReconstructionJob>) {
  const job = jobs.get(jobId);

  if (!job) {
    return undefined;
  }

  const updated: ReconstructionJob = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, updated);
  return updated;
}
