import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Stars } from '@react-three/drei'
import * as THREE from 'three'

function WireframeGlobe() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.06
    ref.current.rotation.x += delta * 0.03
  })
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[9, 2]} />
      <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.045} />
    </mesh>
  )
}

function OrbitRing({ radius, color, speed, tiltX, tiltY }: {
  radius: number; color: string; speed: number; tiltX: number; tiltY: number
}) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => { ref.current.rotation.z += delta * speed })
  return (
    <mesh ref={ref} rotation={[tiltX, tiltY, 0]}>
      <torusGeometry args={[radius, 0.04, 16, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} />
    </mesh>
  )
}

/* ── 3D Quadcopter Drone ── */
function PropellerDisc({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => { ref.current.rotation.y += delta * 25 })
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.35, 0.02, 8, 32]} />
      <meshBasicMaterial color="#06b6d4" transparent opacity={0.5} />
    </mesh>
  )
}

function DroneModel() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    groupRef.current.rotation.y += 0.008
    groupRef.current.rotation.x = Math.sin(t * 0.5) * 0.1
    groupRef.current.rotation.z = Math.cos(t * 0.3) * 0.05
    groupRef.current.position.y = 3 + Math.sin(t * 0.7) * 1.2
    groupRef.current.position.x = 7 + Math.cos(t * 0.4) * 1.0
  })

  const armMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#8b5cf6', transparent: true, opacity: 0.35 }), [])
  const bodyMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#06b6d4', transparent: true, opacity: 0.4 }), [])
  const ledMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.8 }), [])

  const armPositions: [number, number, number][] = [
    [0.7, 0, 0.7], [-0.7, 0, 0.7], [-0.7, 0, -0.7], [0.7, 0, -0.7],
  ]

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.4}>
      <group ref={groupRef} position={[7, 3, -4]} scale={1.8}>
        {/* Central body */}
        <mesh material={bodyMat}>
          <boxGeometry args={[0.5, 0.12, 0.5]} />
        </mesh>
        {/* Camera pod bottom */}
        <mesh position={[0, -0.12, 0.05]} material={bodyMat}>
          <sphereGeometry args={[0.1, 12, 12]} />
        </mesh>

        {/* Arms + motors + propellers */}
        {armPositions.map((pos, i) => (
          <group key={i}>
            {/* Arm */}
            <mesh position={[pos[0] * 0.5, 0, pos[2] * 0.5]} material={armMat}
              rotation={[0, Math.atan2(pos[0], pos[2]), 0]}>
              <boxGeometry args={[0.06, 0.04, 1.0]} />
            </mesh>
            {/* Motor housing */}
            <mesh position={pos} material={armMat}>
              <cylinderGeometry args={[0.08, 0.1, 0.08, 12]} />
            </mesh>
            {/* Propeller disc */}
            <PropellerDisc position={[pos[0], 0.06, pos[2]]} />
            {/* LED light */}
            <mesh position={[pos[0], -0.04, pos[2]]} material={i < 2 ? ledMat : new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.8 })}>
              <sphereGeometry args={[0.025, 8, 8]} />
            </mesh>
          </group>
        ))}

        {/* Landing gear legs */}
        {[[-0.3, -0.15, 0.35], [0.3, -0.15, 0.35], [-0.3, -0.15, -0.35], [0.3, -0.15, -0.35]].map((p, i) => (
          <mesh key={`leg${i}`} position={p as [number, number, number]} material={armMat}>
            <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
          </mesh>
        ))}
        {/* Landing skids */}
        {[[-0.3, -0.24, 0], [0.3, -0.24, 0]].map((p, i) => (
          <mesh key={`skid${i}`} position={p as [number, number, number]} material={armMat} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.7, 6]} />
          </mesh>
        ))}
      </group>
    </Float>
  )
}

function ParticleField() {
  const count = 500
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80
      arr[i * 3 + 1] = (Math.random() - 0.5) * 80
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80
    }
    return arr
  }, [])

  const ref = useRef<THREE.Points>(null!)
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.008 })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#06b6d4" size={0.06} transparent opacity={0.4} sizeAttenuation />
    </points>
  )
}

export default function Background3D() {
  return (
    <div className="canvas-bg">
      <Canvas camera={{ position: [0, 0, 28], fov: 60 }} dpr={[1, 1.5]}>
        <WireframeGlobe />
        <OrbitRing radius={13} color="#8b5cf6" speed={0.15} tiltX={1.1} tiltY={0} />
        <OrbitRing radius={11} color="#3b82f6" speed={-0.1} tiltX={-0.8} tiltY={0.4} />
        <OrbitRing radius={16} color="#06b6d4" speed={0.08} tiltX={0.5} tiltY={-0.3} />
        <DroneModel />
        <ParticleField />
        <Stars radius={60} depth={50} count={1500} factor={2} saturation={0} fade speed={0.5} />
      </Canvas>
    </div>
  )
}
