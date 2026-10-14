import { Environment, Lightformer } from '@react-three/drei'

export default function Studio({ intensity = 1, neutral = false, children }) {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#777b82']} />
      {/* One front-left strip creates moving reflections across the bevels. */}
      <Lightformer
        form="rect"
        intensity={9 * intensity}
        color={neutral ? '#ffffff' : '#fff6ec'}
        position={[-4, 3.5, 5]}
        scale={[1.2, 7, 1]}
        target={[0, 0, 0]}
      />
      {/* Studio sources: 2, 3, 4, 5, 6 and 7. */}
      <Lightformer form="rect" intensity={(5.5 / 1.5) * intensity}
        color={neutral ? '#e6e6e6' : '#ffb066'}
        position={[4.5, -2, 2.5]} scale={[2.5, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="circle" intensity={4 * intensity}
        color={neutral ? '#dcdcdc' : '#ff7ea8'}
        position={[3.2, 2.8, -2.5]} scale={[2.2, 2.2, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={6 * intensity}
        color={neutral ? '#d4d4d4' : '#5cc8ff'}
        position={[-4.5, 0.5, -3]} scale={[1.6, 7, 1]} target={[0, 0, 0]} />
      <Lightformer form="circle" intensity={3.5 * intensity}
        color={neutral ? '#cccccc' : '#9b7dff'}
        position={[-2.5, -3.5, -2]} scale={[2, 2, 1]} target={[0, 0, 0]} />
      {/* Source 6: narrow rear-left rim, slightly above the centre. */}
      <Lightformer form="rect" intensity={5 * intensity} color="#ffffff"
        position={[-5, 1, -5]} scale={[1.2, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.6 * intensity}
        color={neutral ? '#e2e2e2' : '#e8ecff'}
        position={[0, -5.5, 0]} scale={[9, 9, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0} color="#000000"
        position={[-4.5, 0, 1]} scale={[5, 14, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0} color="#000000"
        position={[4.5, 0, 1]} scale={[5, 14, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0} color="#000000"
        position={[0, -2.5, 4.5]} scale={[10, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0} color="#000000"
        position={[0, 3.5, 4.5]} scale={[10, 3, 1]} target={[0, 0, 0]} />
      {children}
    </Environment>
  )
}
