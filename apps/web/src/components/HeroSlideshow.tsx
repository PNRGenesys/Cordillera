import { styled } from '@linaria/react'
import type { CSSProperties } from 'react'
import { toSrcSet } from '../lib/image'
import { driftFor, HERO_SLIDE_COUNT, HERO_SLIDE_SECONDS, type HeroSlide } from '../lib/hero-slides'

/** `style` carries the per slide values as custom properties, which the CSS below reads. */
type SlideVariables = CSSProperties & Record<`--${string}`, string>

const Stage = styled.div`
  background: var(--color-surface);
  height: 100%;
  min-height: 420px;
  overflow: hidden;
  position: relative;
`
const Slide = styled.img`
  /* A single delay and duration feed both animations, so the fade and the drift stay in phase. */
  animation-delay: var(--hero-delay);
  animation-duration: var(--hero-duration);
  animation-iteration-count: infinite;
  animation-name: heroCrossfade, heroDrift;
  animation-timing-function: ease, linear;
  height: 100%;
  inset: 0;
  object-fit: var(--hero-fit);
  opacity: 0;
  position: absolute;
  width: 100%;

  /*
   * Written for HERO_SLIDE_COUNT slides: each one owns a quarter of the cycle and spends 8% of it
   * fading. A slide starts fading in exactly when the previous one starts fading out, so the two
   * overlap and the panel is never empty.
   */
  @keyframes heroCrossfade {
    0% {
      opacity: 0;
    }
    8% {
      opacity: 1;
    }
    25% {
      opacity: 1;
    }
    33% {
      opacity: 0;
    }
    100% {
      opacity: 0;
    }
  }

  /*
   * The image zooms and travels while it is on screen, reaching its closest point right as it fades
   * out. It starts already part way through the movement, so during a crossfade both images are
   * drifting instead of one of them sitting still. The scale always exceeds the displacement, so the
   * panel never uncovers an edge, and the reset back to the start happens while the slide is invisible.
   * A slide meant to be read whole passes the same scale twice and no displacement, so it stays still.
   */
  @keyframes heroDrift {
    0% {
      transform: scale(var(--hero-scale-from)) translate3d(var(--hero-from-x), var(--hero-from-y), 0);
    }
    33% {
      transform: scale(var(--hero-scale-to)) translate3d(var(--hero-to-x), var(--hero-to-y), 0);
    }
    100% {
      transform: scale(var(--hero-scale-to)) translate3d(var(--hero-to-x), var(--hero-to-y), 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: none;

    &:first-child {
      opacity: 1;
    }
  }
`

export type HeroSlideshowProps = {
  slides: HeroSlide[]
}

export function HeroSlideshow({ slides }: HeroSlideshowProps) {
  const duration = `${HERO_SLIDE_COUNT * HERO_SLIDE_SECONDS}s`

  return (
    <Stage>
      {slides.map((slide, index) => {
        const drift = driftFor(slide, index)
        const variables: SlideVariables = {
          // The negative delay starts every slide already in its own phase, so the first cycle looks like the rest.
          '--hero-delay': `-${index * HERO_SLIDE_SECONDS}s`,
          '--hero-duration': duration,
          '--hero-fit': slide.fit,
          '--hero-from-x': drift.fromX,
          '--hero-from-y': drift.fromY,
          '--hero-to-x': drift.toX,
          '--hero-to-y': drift.toY,
          '--hero-scale-from': drift.scaleFrom,
          '--hero-scale-to': drift.scaleTo,
        }

        return (
          <Slide
            key={`${index}-${slide.url}`}
            src={slide.url}
            srcSet={toSrcSet(slide.url)}
            sizes="(max-width: 760px) 100vw, 55vw"
            alt={slide.alt}
            decoding="async"
            style={variables}
          />
        )
      })}
    </Stage>
  )
}
