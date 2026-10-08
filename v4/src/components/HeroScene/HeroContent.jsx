import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'

export default function HeroContent() {
  return (
    <div className="hero-content">
      <h1 className="hero-content__title">
        Behavioural intelligence
        <br />
        for unpredictable world.
      </h1>
      <div className="hero-content__reveal">
        <p className="hero-content__text">
          Access the world’s first Behavioral World Model that predicts humans
          and agents’ behaviors in volatile, novel, and unprecedented scenarios.
        </p>
        <RequestDemoButton className="hero-content__cta" />
      </div>
    </div>
  )
}
