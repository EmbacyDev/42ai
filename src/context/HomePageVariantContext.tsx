import { createContext, useContext, type ReactNode } from 'react'

export type HomePageVariant = 'production' | 'shader-preview'

type HomePageVariantValue = {
  variant: HomePageVariant
  landscapeBackground: 'image' | 'shader'
  useLiquidGlassButtons: boolean
}

const productionDefaults: HomePageVariantValue = {
  variant: 'production',
  landscapeBackground: 'image',
  useLiquidGlassButtons: true,
}

const shaderPreviewDefaults: HomePageVariantValue = {
  variant: 'shader-preview',
  landscapeBackground: 'shader',
  useLiquidGlassButtons: false,
}

const HomePageVariantContext = createContext<HomePageVariantValue>(productionDefaults)

type HomePageVariantProviderProps = {
  variant?: HomePageVariant
  children: ReactNode
}

export function HomePageVariantProvider({
  variant = 'production',
  children,
}: HomePageVariantProviderProps) {
  const value = variant === 'shader-preview' ? shaderPreviewDefaults : productionDefaults

  return (
    <HomePageVariantContext.Provider value={value}>{children}</HomePageVariantContext.Provider>
  )
}

export function useHomePageVariant() {
  return useContext(HomePageVariantContext)
}
