import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

type PointCloudViewerProps = {
  url: string;
};

export default function PointCloudViewer({ url }: PointCloudViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x111827);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.01,
      10000,
    );
    camera.position.set(0, -4, 2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const light = new THREE.HemisphereLight(0xffffff, 0x597060, 2.2);
    scene.add(light);

    const loader = new PLYLoader();
    let pointCloud: THREE.Points | null = null;
    let disposed = false;

    loader.load(
      url,
      (geometry) => {
        if (disposed) {
          geometry.dispose();
          return;
        }

        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();

        if (box) {
          box.getCenter(center);
          box.getSize(size);
          geometry.translate(-center.x, -center.y, -center.z);
        }

        const maxAxis = Math.max(size.x, size.y, size.z, 1);
        const material = new THREE.PointsMaterial({
          color: geometry.getAttribute("color") ? 0xffffff : 0x56d190,
          size: Math.max(maxAxis / 260, 0.01),
          sizeAttenuation: true,
          vertexColors: Boolean(geometry.getAttribute("color")),
        });

        pointCloud = new THREE.Points(geometry, material);
        pointCloud.rotation.x = -Math.PI / 2;
        scene.add(pointCloud);

        camera.position.set(0, -maxAxis * 1.6, maxAxis * 0.9);
        camera.near = maxAxis / 1000;
        camera.far = maxAxis * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
      },
      undefined,
      (error) => {
        console.error("Nao foi possivel carregar a nuvem de pontos.", error);
      },
    );

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
      pointCloud?.geometry.dispose();
      const material = pointCloud?.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  return <div className="point-cloud-viewer" ref={containerRef} />;
}
