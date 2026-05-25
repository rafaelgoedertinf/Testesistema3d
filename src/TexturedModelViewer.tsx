import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type TexturedModelViewerProps = {
  materialUrl: string;
  modelUrl: string;
  resourcePath: string;
};

export default function TexturedModelViewer({
  materialUrl,
  modelUrl,
  resourcePath,
}: TexturedModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x101827);
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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x303040, 2.5));

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
      renderer.domElement.remove();
    };
  }, [materialUrl, modelUrl, resourcePath]);

  return <div className="textured-model-viewer" ref={containerRef} />;
}
