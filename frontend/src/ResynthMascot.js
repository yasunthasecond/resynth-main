import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ResynthMascot({ size = 400, className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

    // ── Lighting ──────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x1a0033, 2);
    scene.add(ambientLight);

    const purpleLight = new THREE.PointLight(0x7c3aed, 80, 20);
    purpleLight.position.set(0, 0, 0);
    scene.add(purpleLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 40, 20);
    cyanLight.position.set(3, 2, 2);
    scene.add(cyanLight);

    const rimLight = new THREE.PointLight(0x4f46e5, 30, 15);
    rimLight.position.set(-3, -2, -1);
    scene.add(rimLight);

    // ── Main Orb (Icosahedron) ────────────────────────────────────────────────
    const orbGeo = new THREE.IcosahedronGeometry(1.4, 1);

    // Slightly offset each vertex for a faceted, shattered look
    const posAttr = orbGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const noise = (Math.random() - 0.5) * 0.08;
      posAttr.setXYZ(i, x + x * noise, y + y * noise, z + z * noise);
    }
    orbGeo.computeVertexNormals();

    const orbMat = new THREE.MeshPhongMaterial({
      color: 0x0d0d1a,
      specular: 0x7c3aed,
      shininess: 120,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });

    const orb = new THREE.Mesh(orbGeo, orbMat);
    scene.add(orb);

    // ── Inner glowing core ────────────────────────────────────────────────────
    const coreGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x5b21b6,
      transparent: true,
      opacity: 0.6,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Innermost bright light orb
    const innerGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6 });
    const innerOrb = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerOrb);

    // ── Face: V-shaped eyes (two glowing capsules / boxes) ────────────────────
    const eyeGroup = new THREE.Group();

    const eyeGeo = new THREE.CapsuleGeometry(0.04, 0.22, 4, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc4b5fd });

    // Left eye — tilted inward (V shape)
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.22, 0.04, 1.32);
    leftEye.rotation.z = Math.PI / 5;
    eyeGroup.add(leftEye);

    // Right eye — mirrored
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.22, 0.04, 1.32);
    rightEye.rotation.z = -Math.PI / 5;
    eyeGroup.add(rightEye);

    // Eye glow
    const eyeGlowGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const eyeGlowMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.18,
    });
    const eyeGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
    eyeGlow.position.set(0, 0.04, 1.2);
    eyeGroup.add(eyeGlow);

    scene.add(eyeGroup);

    // ── Floating shards ───────────────────────────────────────────────────────
    const shards = [];
    const shardCount = 18;

    for (let i = 0; i < shardCount; i++) {
      const shardGeo = new THREE.TetrahedronGeometry(Math.random() * 0.14 + 0.04, 0);
      const shardMat = new THREE.MeshPhongMaterial({
        color: Math.random() > 0.5 ? 0x4c1d95 : 0x1e1b4b,
        specular: 0x7c3aed,
        shininess: 200,
        flatShading: true,
        transparent: true,
        opacity: Math.random() * 0.5 + 0.4,
      });
      const shard = new THREE.Mesh(shardGeo, shardMat);

      // Scatter shards in a sphere shell at radius 1.7 – 2.5
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      const r = Math.random() * 0.8 + 1.7;
      shard.position.set(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(theta)
      );
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      const meta = {
        mesh: shard,
        phi,
        theta,
        r,
        speed: Math.random() * 0.004 + 0.001,
        rotSpeed: (Math.random() - 0.5) * 0.02,
      };
      shards.push(meta);
      scene.add(shard);
    }

    // ── Mouse tracking ────────────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };

    const handleMouseMove = (e) => {
      const rect = mount.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouse.x = (e.clientX - cx) / (window.innerWidth / 2);
      mouse.y = (e.clientY - cy) / (window.innerHeight / 2);
      targetRotation.y = mouse.x * 0.6;
      targetRotation.x = -mouse.y * 0.4;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // ── Animation loop ────────────────────────────────────────────────────────
    let frameId;
    let t = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.016;

      // Smooth mouse tracking
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08;

      // Apply rotation to whole orb group (idle bob + mouse look)
      orb.rotation.y = currentRotation.y + t * 0.08;
      orb.rotation.x = currentRotation.x + Math.sin(t * 0.5) * 0.06;
      core.rotation.y = -t * 0.12;
      core.rotation.x = Math.cos(t * 0.4) * 0.1;
      innerOrb.rotation.y = t * 0.2;

      // Eyes always face forward (counter-rotate slightly for look-at effect)
      eyeGroup.rotation.y = currentRotation.y * 0.7;
      eyeGroup.rotation.x = currentRotation.x * 0.7;

      // Eye glow pulsing
      eyeGlowMat.opacity = 0.12 + Math.sin(t * 2) * 0.06;

      // Hover bob
      const bob = Math.sin(t * 0.9) * 0.06;
      orb.position.y = bob;
      core.position.y = bob;
      innerOrb.position.y = bob;
      eyeGroup.position.y = bob;

      // Animate shards orbit
      shards.forEach((s) => {
        s.phi += s.speed;
        const x = s.r * Math.sin(s.theta) * Math.cos(s.phi);
        const y = s.r * Math.sin(s.theta) * Math.sin(s.phi);
        const z = s.r * Math.cos(s.theta);
        s.mesh.position.set(x, y + bob * 0.5, z);
        s.mesh.rotation.x += s.rotSpeed;
        s.mesh.rotation.y += s.rotSpeed * 0.7;
      });

      // Pulsing inner light
      purpleLight.intensity = 70 + Math.sin(t * 2.5) * 20;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: size, height: size, cursor: 'none' }}
    />
  );
}
