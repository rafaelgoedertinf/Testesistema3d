import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { calculateLayout } from "./layoutCalculator";
import type { OrientationMode, RoofArea } from "./AerialPhotoPlanner";
import type { SolarPanel } from "./types";

type CleanTechnicalModelViewerProps = {
  areas: RoofArea[];
  selectedPanel: SolarPanel;
  setbackMeters: number;
  gapMeters: number;
  orientation: OrientationMode;
};

export default function CleanTechnicalModelViewer({
  areas,
  selectedPanel,
  setbackMeters,
  gapMeters,
  orientation,
}: CleanTechnicalModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0xf5f9f6);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      1000,
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(5, 7, 8);
    scene.add(sun);

    const modelGroup = buildTechnicalModel({
      areas,
      gapMeters,
      orientation,
      selectedPanel,
      setbackMeters,
    });
    scene.add(modelGroup);

    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    controls.target.copy(center);

    const maxAxis = Math.max(size.x, size.y, size.z, 1);
    camera.position.set(center.x + maxAxis * 0.8, center.y + maxAxis * 0.9, center.z + maxAxis * 1.55);
    camera.near = maxAxis / 1000;
    camera.far = maxAxis * 100;
    camera.updateProjectionMatrix();
    controls.update();

    const grid = new THREE.GridHelper(maxAxis * 2.2, 16, 0xb7c6bc, 0xdbe5df);
    grid.position.y = box.min.y - 0.02;
    scene.add(grid);

    function handleResize() {
      if (!container) {
        return;
      }

      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }

    function animate() {
      controls.update();
      renderer.render(scene, camera);
    }

    window.addEventListener("resize", handleResize);
    renderer.setAnimationLoop(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.setAnimationLoop(null);
      controls.dispose();
      modelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [areas, gapMeters, orientation, selectedPanel, setbackMeters]);

  return <div className="clean-technical-viewer" ref={containerRef} />;
}

function buildTechnicalModel({
  areas,
  gapMeters,
  orientation,
  selectedPanel,
  setbackMeters,
}: CleanTechnicalModelViewerProps) {
  const group = new THREE.Group();
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8ded8,
    metalness: 0.05,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x173f2a });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1457a8,
    metalness: 0.15,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const disabledPanelMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9c4c0,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const blockMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0eadf,
    roughness: 0.8,
  });

  let xOffset = 0;

  areas.forEach((area) => {
    const correctedWidthMeters = correctWidthForSlope(area.projectedWidthMeters, area.slopeDegrees);
    const projectedWidthMeters = area.projectedWidthMeters;
    const slopeRadians = (area.slopeDegrees * Math.PI) / 180;
    const layout = calculateLayout(selectedPanel, {
      lengthMeters: area.lengthMeters,
      widthMeters: correctedWidthMeters,
      setbackMeters,
      gapMeters,
      orientation,
    });
    const centerX = xOffset + area.lengthMeters / 2;

    const block = new THREE.Mesh(
      new THREE.BoxGeometry(area.lengthMeters, 0.45, projectedWidthMeters),
      blockMaterial,
    );
    block.position.set(centerX, -0.25, 0);
    group.add(block);

    const roof = new THREE.Mesh(
      createSlopedQuadGeometry(area.lengthMeters, correctedWidthMeters, slopeRadians, 0),
      roofMaterial,
    );
    roof.position.x = centerX;
    group.add(roof);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), edgeMaterial);
    edges.position.copy(roof.position);
    group.add(edges);

    for (let row = 0; row < layout.rows; row += 1) {
      for (let column = 0; column < layout.columns; column += 1) {
        const panelId = `${area.id}-${row}-${column}`;
        const disabled = area.disabledPanelIds.includes(panelId);
        const moduleLength = layout.moduleLength;
        const moduleWidth = layout.moduleWidth;
        const startX = -area.lengthMeters / 2 + setbackMeters + moduleLength / 2;
        const startSurface = -correctedWidthMeters / 2 + setbackMeters + moduleWidth / 2;
        const localX = startX + column * (moduleLength + gapMeters);
        const surfaceY = startSurface + row * (moduleWidth + gapMeters);
        const panel = new THREE.Mesh(
          createSlopedQuadGeometry(moduleLength, moduleWidth, slopeRadians, 0.035),
          disabled ? disabledPanelMaterial : panelMaterial,
        );
        panel.position.set(centerX + localX, surfaceY * Math.sin(slopeRadians), surfaceY * Math.cos(slopeRadians));
        group.add(panel);
      }
    }

    xOffset += area.lengthMeters + 1.2;
  });

  return group;
}

function createSlopedQuadGeometry(lengthMeters: number, surfaceWidthMeters: number, slopeRadians: number, lift: number) {
  const halfLength = lengthMeters / 2;
  const halfWidth = surfaceWidthMeters / 2;
  const points = [
    surfacePoint(-halfLength, -halfWidth, slopeRadians, lift),
    surfacePoint(halfLength, -halfWidth, slopeRadians, lift),
    surfacePoint(halfLength, halfWidth, slopeRadians, lift),
    surfacePoint(-halfLength, halfWidth, slopeRadians, lift),
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((point) => [point.x, point.y, point.z]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function surfacePoint(x: number, surfaceY: number, slopeRadians: number, lift: number) {
  return new THREE.Vector3(
    x,
    surfaceY * Math.sin(slopeRadians) + lift,
    surfaceY * Math.cos(slopeRadians),
  );
}

function correctWidthForSlope(projectedWidthMeters: number, slopeDegrees: number) {
  const radians = (slopeDegrees * Math.PI) / 180;
  const cosine = Math.max(Math.cos(radians), 0.35);
  return projectedWidthMeters / cosine;
}
