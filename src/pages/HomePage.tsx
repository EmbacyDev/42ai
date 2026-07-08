import { HomePageVariantProvider, type HomePageVariant } from '../context/HomePageVariantContext'
import { ModelBehaviorSection } from '../components/sections/ModelBehaviorSection'
import { CtaBannerSection } from '../components/sections/CtaBannerSection'
import { FooterSection } from '../components/sections/FooterSection'
import { HeroSection } from '../components/sections/HeroSection'
import { PredictionSection } from '../components/sections/PredictionSection'
import { ProductsSection } from '../components/sections/ProductsSection'
import { ProofSection } from '../components/sections/ProofSection'
import { UseCasesSection } from '../components/sections/UseCasesSection'
import { ValuePropositionSection } from '../components/sections/ValuePropositionSection'

type HomePageProps = {
  variant?: HomePageVariant
}

function HomePageContent() {
  return (
    <main>
      <HeroSection />
      <ValuePropositionSection />
      <UseCasesSection />
      <PredictionSection />
      <ModelBehaviorSection />
      <ProductsSection />
      <ProofSection />
      <CtaBannerSection />
      <FooterSection />
    </main>
  )
}

export function HomePage({ variant = 'production' }: HomePageProps) {
  return (
    <HomePageVariantProvider variant={variant}>
      <HomePageContent />
    </HomePageVariantProvider>
  )
}
