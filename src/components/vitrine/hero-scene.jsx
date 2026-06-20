"use client"

import { Suspense, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Float, Environment, Lightformer, MeshDistortMaterial,
  Sparkles, ContactShadows, OrbitControls,
} from "@react-three/drei"
import { BRAND } from "./theme"

function Coin({ position, color, scale = 1, speed = 1 }) {
  const spin = useRef()
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * speed
  })
  return (
    <Float speed={2.2} rotationIntensity={0.5} floatIntensity={1.6}>
      <group position={position} scale={scale}>
        <group ref={spin}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1, 1, 0.18, 56]} />
            <meshStandardMaterial color={color} metalness={0.95} roughness={0.22}
              emissive={color} emissiveIntensity={0.12} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.001]} scale={0.78}>
            <torusGeometry args={[1, 0.05, 16, 64]} />
            <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.15}
              emissive={color} emissiveIntensity={0.25} />
          </mesh>
        </group>
      </group>
    </Float>
  )
}

function Blob() {
  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.9}>
      <mesh castShadow scale={1.45}>
        <icosahedronGeometry args={[1, 12]} />
        <MeshDistortMaterial
          color={BRAND.green}
          distort={0.34}
          speed={1.8}
          roughness={0.12}
          metalness={0.55}
          envMapIntensity={1.2}
        />
      </mesh>
    </Float>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 6, 5]} intensity={1.3} castShadow
        shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-5, -2, -3]} intensity={28} color={BRAND.amber} />
      <pointLight position={[4, 4, 3]} intensity={18} color={BRAND.greenLight} />

      <Blob />

      <Coin position={[-2.7, 1.4, 0.6]}  color={BRAND.amber}      scale={0.58} speed={1.2} />
      <Coin position={[2.8, 1.0, -0.4]}  color={BRAND.greenLight} scale={0.5}  speed={-1.0} />
      <Coin position={[2.3, -1.7, 0.7]}  color={BRAND.amber}      scale={0.44} speed={1.6} />
      <Coin position={[-2.5, -1.3, -0.3]} color={BRAND.greenLight} scale={0.62} speed={-1.3} />
      <Coin position={[0.4, 2.5, -1]}    color={BRAND.amberLight} scale={0.36} speed={1.4} />

      <Sparkles count={42} scale={[9, 6, 5]} size={3} speed={0.35} color={BRAND.amberLight} opacity={0.7} />

      <ContactShadows position={[0, -2.5, 0]} opacity={0.32} scale={14} blur={2.8} far={4.5}
        color={BRAND.greenDarker} />

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 4, 4]} scale={[9, 3, 1]} />
        <Lightformer form="circle" intensity={3} color={BRAND.amberLight} position={[-5, 1, 3]} scale={3} />
        <Lightformer form="circle" intensity={3} color={BRAND.greenLight} position={[5, -1, 2]} scale={3} />
      </Environment>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.9}
        minPolarAngle={Math.PI / 2.7}
        maxPolarAngle={Math.PI / 1.75}
      />
    </>
  )
}

export function HeroScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
