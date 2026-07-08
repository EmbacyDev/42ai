import { BehaviorLayersSection } from '../components/sections/BehaviorLayersSection'
import { CtaBannerSection } from '../components/sections/CtaBannerSection'
import { FooterSection } from '../components/sections/FooterSection'
import { HeroSection } from '../components/sections/HeroSection'
import { PredictionSection } from '../components/sections/PredictionSection'
import { ProductsSection } from '../components/sections/ProductsSection'
import { ProofSection } from '../components/sections/ProofSection'
import { ShaderLandscapeSection } from '../components/sections/ShaderLandscapeSection'
import { UseCasesSection } from '../components/sections/UseCasesSection'
import { ValuePropositionSection } from '../components/sections/ValuePropositionSection'
import styles from './ShaderHomePage.module.css'

export function ShaderHomePage() {
  return (
    <main>
      <HeroSection />
      <ValuePropositionSection />
      <UseCasesSection />
      <PredictionSection />
      <ShaderLandscapeSection />
      <BehaviorLayersSection className={styles.behaviorLayers} />
      <ProductsSection />
      <ProofSection />
      <CtaBannerSection />
      <FooterSection />
    </main>
  )
}
