import { BehaviorLayersSection } from '../components/sections/BehaviorLayersSection'
import { CtaBannerSection } from '../components/sections/CtaBannerSection'
import { FooterSection } from '../components/sections/FooterSection'
import { HeroSection } from '../components/sections/HeroSection'
import { LandscapeSection } from '../components/sections/LandscapeSection'
import { PredictionSection } from '../components/sections/PredictionSection'
import { ProductsSection } from '../components/sections/ProductsSection'
import { ProofSection } from '../components/sections/ProofSection'
import { UseCasesSection } from '../components/sections/UseCasesSection'
import { ValuePropositionSection } from '../components/sections/ValuePropositionSection'

type HomePageProps = {
  landscapeBackground?: 'image' | 'shader'
}

export function HomePage({ landscapeBackground = 'image' }: HomePageProps) {
  return (
    <main>
      <HeroSection />
      <ValuePropositionSection />
      <UseCasesSection />
      <PredictionSection />
      <LandscapeSection background={landscapeBackground} />
      <BehaviorLayersSection />
      <ProductsSection />
      <ProofSection />
      <CtaBannerSection />
      <FooterSection />
    </main>
  )
}
