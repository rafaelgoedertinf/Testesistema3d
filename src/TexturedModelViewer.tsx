import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type TexturedModelViewerProps = {
  materialUrl: string;
  modelUrl: string;
  resourcePath: string;
};

type CropBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
};

const defaultCrop: CropBounds = {
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
  zMin: 0,
  zMax: 100,
};

export default function TexturedModelViewer({
  materialUrl,
  modelUrl,
  resourcePath,
}: TexturedModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelBoundsRef = useRef<THREE.Box3 | null>(null);
  const materialsRef = useRef<THREE.Material[]>([]);
  const clippingPlanesRef = useRef([
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  ]);
  const [brightness, setBrightness] = useState(1.7);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [crop, setCrop] = useState<CropBounds>(defaultCrop);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x101827);
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.01,
      100000,
    );
    camera.position.set(0, -4, 2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x6b7280, 4.2);
    scene.add(ambientLight);
    scene.add(hemisphereLight);

    let model: THREE.Group | null = null;
    let disposed = false;

    const mtlLoader = new MTLLoader();
    mtlLoader.setResourcePath(resourcePath);
    mtlLoader.setPath("");
    mtlLoader.load(materialUrl, (materials) => {
      if (disposed) {
        return;
      }

      materials.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load(modelUrl, (object) => {
        if (disposed) {
          return;
        }

        model = object;
        const box = new THREE.Box3().setFromObject(object);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        object.position.sub(center);
        modelBoundsRef.current = new THREE.Box3(
          box.min.clone().sub(center),
          box.max.clone().sub(center),
        );
        materialsRef.current = collectMaterials(object);
        applyBrightness(materialsRef.current, brightness);
        scene.add(object);

        const maxAxis = Math.max(size.x, size.y, size.z, 1);
        camera.position.set(0, -maxAxis * 1.7, maxAxis * 0.8);
        camera.near = maxAxis / 1000;
        camera.far = maxAxis * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
      });
    });

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
      disposed = true;
      window.removeEventListener("resize", handleResize);
      renderer.setAnimationLoop(null);
      controls.dispose();
      model?.traverse((child) => {
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
      rendererRef.current = null;
      modelBoundsRef.current = null;
      materialsRef.current = [];
      renderer.domElement.remove();
    };
  }, [materialUrl, modelUrl, resourcePath]);

  useEffect(() => {
    applyBrightness(materialsRef.current, brightness);
  }, [brightness]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const bounds = modelBoundsRef.current;

    if (!renderer || !bounds) {
      return;
    }

    updateClippingPlanes(bounds, crop, clippingPlanesRef.current);
    renderer.clippingPlanes = cropEnabled ? clippingPlanesRef.current : [];
  }, [crop, cropEnabled]);

  function updateCrop(field: keyof CropBounds, value: number) {
    setCrop((current) => normalizeCrop({ ...current, [field]: value }, field));
  }

  return (
    <div className="model-viewer-shell">
      <div className="viewer-controls">
        <label>
          Claridade
          <input
            type="range"
            min="0.8"
            max="3"
            step="0.1"
            value={brightness}
            onChange={(event) => setBrightness(Number(event.target.value))}
          />
          <span>{brightness.toFixed(1)}x</span>
        </label>
        <button type="button" onClick={() => setCropEnabled((current) => !current)}>
          {cropEnabled ? "Desativar recorte" : "Ativar recorte"}
        </button>
        <button
          type="button"
          onClick={() => {
            setCrop(defaultCrop);
            setCropEnabled(false);
          }}
        >
          Resetar visualizacao
        </button>
      </div>

      {cropEnabled && (
        <div className="crop-controls">
          <CropSlider label="Cortar esquerda/direita" minField="xMin" maxField="xMax" crop={crop} onChange={updateCrop} />
          <CropSlider label="Cortar frente/fundo" minField="yMin" maxField="yMax" crop={crop} onChange={updateCrop} />
          <CropSlider label="Cortar baixo/cima" minField="zMin" maxField="zMax" crop={crop} onChange={updateCrop} />
          <p>
            Recorte visual: esconda ruas, vizinhos e partes fora da casa. Nesta etapa ele nao altera
            o arquivo original; depois podemos exportar somente a area selecionada.
          </p>
        </div>
      )}

      <div className="textured-model-viewer" ref={containerRef} />
    </div>
  );
}

type CropSliderProps = {
  label: string;
  minField: keyof CropBounds;
  maxField: keyof CropBounds;
  crop: CropBounds;
  onChange: (field: keyof CropBounds, value: number) => void;
};

function CropSlider({ label, minField, maxField, crop, onChange }: CropSliderProps) {
  return (
    <div className="crop-slider">
      <strong>{label}</strong>
      <label>
        Inicio
        <input
          type="range"
          min="0"
          max="98"
          step="1"
          value={crop[minField]}
          onChange={(event) => onChange(minField, Number(event.target.value))}
        />
        <span>{crop[minField]}%</span>
      </label>
      <label>
        Fim
        <input
          type="range"
          min="2"
          max="100"
          step="1"
          value={crop[maxField]}
          onChange={(event) => onChange(maxField, Number(event.target.value))}
        />
        <span>{crop[maxField]}%</span>
      </label>
    </div>
  );
}

function normalizeCrop(crop: CropBounds, changedField: keyof CropBounds): CropBounds {
  const normalized = { ...crop };
  const pairs: Array<[keyof CropBounds, keyof CropBounds]> = [
    ["xMin", "xMax"],
    ["yMin", "yMax"],
    ["zMin", "zMax"],
  ];

  pairs.forEach(([minField, maxField]) => {
    if (normalized[minField] > normalized[maxField] - 2) {
      if (changedField === minField) {
        normalized[minField] = normalized[maxField] - 2;
      } else {
        normalized[maxField] = normalized[minField] + 2;
      }
    }
  });

  return normalized;
}

function updateClippingPlanes(bounds: THREE.Box3, crop: CropBounds, planes: THREE.Plane[]) {
  const xMin = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, crop.xMin / 100);
  const xMax = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, crop.xMax / 100);
  const yMin = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, crop.yMin / 100);
  const yMax = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, crop.yMax / 100);
  const zMin = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, crop.zMin / 100);
  const zMax = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, crop.zMax / 100);

  planes[0].constant = -xMin;
  planes[1].constant = xMax;
  planes[2].constant = -yMin;
  planes[3].constant = yMax;
  planes[4].constant = -zMin;
  planes[5].constant = zMax;
}

function collectMaterials(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
        materials.add(material);
      });
    }
  });

  return [...materials];
}

function applyBrightness(materials: THREE.Material[], brightness: number) {
  materials.forEach((material) => {
    if ("color" in material && material.color instanceof THREE.Color) {
      material.color.setScalar(brightness);
    }

    if (material instanceof THREE.MeshPhongMaterial) {
      material.emissive.setScalar(Math.max(0, brightness - 1) * 0.18);
      material.shininess = 0;
    }

    material.needsUpdate = true;
  });
}
