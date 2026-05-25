export type CustomerProject = {
  customerName: string;
  phone: string;
  email: string;
  address: string;
};

export type SolarPanel = {
  id: string;
  manufacturer: string;
  model: string;
  widthMeters: number;
  heightMeters: number;
  powerWatts: number;
};

export type RoofSettings = {
  lengthMeters: number;
  widthMeters: number;
  setbackMeters: number;
  gapMeters: number;
  orientation: "portrait" | "landscape" | "auto";
};

export type ScaleReference = {
  modelDistance: number;
  realDistanceMeters: number;
};

export type LayoutResult = {
  orientation: "portrait" | "landscape";
  moduleLength: number;
  moduleWidth: number;
  usableLength: number;
  usableWidth: number;
  columns: number;
  rows: number;
  totalPanels: number;
};
