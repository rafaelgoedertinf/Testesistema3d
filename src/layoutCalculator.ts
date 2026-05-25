import type { LayoutResult, RoofSettings, SolarPanel } from "./types";

function floorModules(usableMeters: number, moduleMeters: number, gapMeters: number) {
  if (usableMeters <= 0 || moduleMeters <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor((usableMeters + gapMeters) / (moduleMeters + gapMeters)));
}

function calculateForOrientation(
  panel: SolarPanel,
  settings: RoofSettings,
  orientation: "portrait" | "landscape",
): LayoutResult {
  const usableLength = Math.max(0, settings.lengthMeters - settings.setbackMeters * 2);
  const usableWidth = Math.max(0, settings.widthMeters - settings.setbackMeters * 2);
  const moduleLength = orientation === "portrait" ? panel.heightMeters : panel.widthMeters;
  const moduleWidth = orientation === "portrait" ? panel.widthMeters : panel.heightMeters;
  const columns = floorModules(usableLength, moduleLength, settings.gapMeters);
  const rows = floorModules(usableWidth, moduleWidth, settings.gapMeters);

  return {
    orientation,
    moduleLength,
    moduleWidth,
    usableLength,
    usableWidth,
    columns,
    rows,
    totalPanels: columns * rows,
  };
}

export function calculateLayout(panel: SolarPanel, settings: RoofSettings): LayoutResult {
  if (settings.orientation !== "auto") {
    return calculateForOrientation(panel, settings, settings.orientation);
  }

  const portrait = calculateForOrientation(panel, settings, "portrait");
  const landscape = calculateForOrientation(panel, settings, "landscape");

  if (landscape.totalPanels > portrait.totalPanels) {
    return landscape;
  }

  return portrait;
}

export function calculateScaleFactor(modelDistance: number, realDistanceMeters: number) {
  if (modelDistance <= 0 || realDistanceMeters <= 0) {
    return 0;
  }

  return realDistanceMeters / modelDistance;
}
