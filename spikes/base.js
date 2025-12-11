const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function countUp(el, end, duration = 1200) {
  if (!el || prefersReducedMotion) {
    el.textContent = end.toLocaleString();
    return;
  }
  const start = 0;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(start + (end - start) * progress);
    el.textContent = value.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function animateBars(selector) {
  if (prefersReducedMotion) return;
  document.querySelectorAll(selector).forEach((fill) => {
    const target = fill.dataset.value;
    fill.style.width = `${target}%`;
  });
}

export function typewriter(el, text, speed = 18) {
  if (!el) return;
  if (prefersReducedMotion) {
    el.textContent = text;
    return;
  }
  let i = 0;
  const tick = () => {
    el.textContent = text.slice(0, i);
    i += 1;
    if (i <= text.length) {
      setTimeout(tick, speed);
    }
  };
  tick();
}

export function sprinkleDots(progressSelector, activeIndex) {
  const dots = document.querySelectorAll(progressSelector);
  dots.forEach((dot, idx) => {
    dot.classList.toggle('is-active', idx === activeIndex);
  });
}
