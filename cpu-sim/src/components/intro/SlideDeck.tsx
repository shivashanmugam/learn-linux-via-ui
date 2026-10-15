import { useState, type ReactNode } from 'react';

export interface Slide {
  id: string;
  title: string;
  content: ReactNode;
}

interface Props {
  slides: Slide[];
  initialIndex?: number;
  onChange?: (index: number) => void;
  /** Shown in the footer of the last slide. */
  finalAction?: ReactNode;
}

export function SlideDeck({ slides, initialIndex = 0, onChange, finalAction }: Props) {
  const clamp = (i: number) => Math.max(0, Math.min(slides.length - 1, i));
  const [index, setIndex] = useState(() => clamp(initialIndex));
  const slide = slides[index];
  const go = (i: number) => {
    const next = clamp(i);
    setIndex(next);
    onChange?.(next);
  };

  return (
    <section className="panel deck" aria-roledescription="carousel" aria-label="The big picture">
      <header className="deck-head">
        <div>
          <span className="deck-kicker">
            Part 1 · The big picture · slide {index + 1} of {slides.length}
          </span>
          <h2 className="deck-title">{slide.title}</h2>
        </div>
        <nav className="deck-nav" aria-label="Slides">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">
            ‹
          </button>
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`deck-dot${i === index ? ' active' : ''}`}
              onClick={() => go(i)}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              aria-current={i === index}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Next slide">
            ›
          </button>
        </nav>
      </header>
      <div className="deck-slide" key={slide.id} role="group" aria-roledescription="slide">
        {slide.content}
      </div>
      <div className="deck-footer">
        {index < slides.length - 1 ? (
          <button type="button" className="primary" onClick={() => go(index + 1)}>
            Next: {slides[index + 1].title} ›
          </button>
        ) : (
          finalAction
        )}
      </div>
    </section>
  );
}
