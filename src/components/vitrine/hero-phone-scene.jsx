"use client"

import { Suspense, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Html, Float, Environment, ContactShadows, RoundedBox, Lightformer } from "@react-three/drei"
import { BRAND } from "./theme"

function PhoneBody() {
  const group = useRef()
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.18
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.06
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.08
    }
  })

  return (
    <group ref={group}>
      <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.6}>
        {/* Chassis métallique */}
        <RoundedBox args={[1.9, 3.9, 0.18]} radius={0.16} smoothness={8} castShadow receiveShadow>
          <meshStandardMaterial color="#1A1A2E" metalness={0.92} roughness={0.18} />
        </RoundedBox>

        {/* Cadre écran */}
        <RoundedBox args={[1.78, 3.78, 0.02]} radius={0.13} smoothness={8} position={[0, 0, 0.091]}>
          <meshStandardMaterial color="#0E1426" metalness={0.5} roughness={0.4} />
        </RoundedBox>

        {/* Écran */}
        <RoundedBox args={[1.66, 3.6, 0.01]} radius={0.11} smoothness={6} position={[0, 0, 0.098]}>
          <meshStandardMaterial color="#F8FAFB" metalness={0.05} roughness={0.2} />
        </RoundedBox>

        {/* Interface HTML */}
        <Html transform occlude position={[0, 0, 0.105]} style={{ width: 280, height: 580, pointerEvents: "none" }}>
          <div style={{ width: "100%", height: "100%", transform: "scale(0.85)", transformOrigin: "center" }}>
            <PhoneScreenHtml />
          </div>
        </Html>

        {/* Dynamic Island */}
        <mesh position={[0, 1.52, 0.11]}>
          <capsuleGeometry args={[0.14, 0.22, 4, 16]} />
          <meshStandardMaterial color="#0E1426" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Boutons latéraux */}
        <mesh position={[0.96, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 16]} />
          <meshStandardMaterial color="#1A1A2E" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-0.96, 0.75, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.04, 0.14, 4, 16]} />
          <meshStandardMaterial color="#1A1A2E" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-0.96, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.04, 0.14, 4, 16]} />
          <meshStandardMaterial color="#1A1A2E" metalness={0.9} roughness={0.2} />
        </mesh>
      </Float>
    </group>
  )
}

function PhoneScreenHtml() {
  return (
    <div style={{
      width: 280, height: 580, borderRadius: 36, overflow: "hidden",
      background: "linear-gradient(180deg, #F8FAFB 0%, #FFFFFF 100%)",
      display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif",
      boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.06)", position: "relative"
    }}>
      {/* Notch */}
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 85, height: 24,
        borderRadius: 12, background: "#0E1426", zIndex: 10 }} />

      {/* Header */}
      <div style={{ padding: "36px 22px 12px" }}>
        <div style={{ fontSize: 11, color: "#64748B" }}>Bonjour 👋</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>Kokou Mensah</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ color: "#1A6B4A", fontSize: 12 }}>✓</span>
          <span style={{ fontSize: 10, color: "#1A6B4A", fontWeight: 700 }}>Profil vérifié</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: "0 18px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "#1A6B4A", borderRadius: 12, padding: 12, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 80 }}>
          <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 500 }}>Revenus ce mois</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1 }}>45 000</div>
            <div style={{ fontSize: 10, opacity: 0.9 }}>FCFA</div>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: "1px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 80 }}>
          <div style={{ fontSize: 9, color: "#64748B", fontWeight: 500 }}>Missions</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: "#0F172A", lineHeight: 1.1 }}>3</div>
          <div style={{ fontSize: 10, color: "#1A6B4A", fontWeight: 700 }}>actives</div>
        </div>
      </div>

      {/* Missions */}
      <div style={{ flex: 1, padding: "0 18px", overflow: "hidden" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#64748B", textTransform: "uppercase", marginBottom: 8 }}>Missions disponibles</div>
        {[
          { icon: "🎓", title: "Cours particuliers", loc: "Cotonou", price: "15 000 F", color: "#EDE9FE" },
          { icon: "📊", title: "Saisie de données", loc: "Calavi", price: "8 000 F", color: "#DBEAFE" },
          { icon: "📱", title: "Community Mgmt", loc: "Porto-Novo", price: "20 000 F", color: "#FEF3C7" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 8, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(15,23,42,0.05)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 10, background: m.color, display: "grid", placeItems: "center", fontSize: 12, flexShrink: 0 }}>{m.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A" }}>{m.title}</div>
              <div style={{ fontSize: 9, color: "#64748B" }}>{m.loc}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#1A6B4A" }}>{m.price}</div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{ padding: "10px 18px", display: "flex", justifyContent: "space-around", borderTop: "1px solid rgba(15,23,42,0.05)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "#EAF7F0", color: "#1A6B4A", display: "grid", placeItems: "center" }}>🎓</div>
        <div style={{ width: 32, height: 32, borderRadius: 10, color: "#94A3B8", display: "grid", placeItems: "center" }}>📊</div>
      </div>
    </div>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 6]} intensity={1.8} castShadow />
      <pointLight position={[-4, 2, 4]} intensity={1.2} color={BRAND.greenLight} />
      <pointLight position={[4, -2, 3]} intensity={0.8} color={BRAND.amber} />

      <PhoneBody />

      <ContactShadows position={[0, -2.4, 0]} opacity={0.28} scale={12} blur={2.5} far={5} color={BRAND.greenDarker} />

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 5, 5]} scale={[10, 4, 1]} />
        <Lightformer form="circle" intensity={2.5} color={BRAND.amberLight} position={[-5, 0, 4]} scale={3} />
        <Lightformer form="circle" intensity={2.5} color={BRAND.greenLight} position={[5, 0, 4]} scale={3} />
      </Environment>
    </>
  )
}

export function HeroPhoneScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6.2], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
