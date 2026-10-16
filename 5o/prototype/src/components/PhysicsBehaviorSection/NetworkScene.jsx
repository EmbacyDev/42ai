import BehaviorNetworkTransition from './BehaviorNetworkTransition.jsx'
import NetworkLightShader from './NetworkLightShader.jsx'
export default function NetworkScene(props){return <>
 <NetworkLightShader {...props}/><BehaviorNetworkTransition {...props}/>
</>}
