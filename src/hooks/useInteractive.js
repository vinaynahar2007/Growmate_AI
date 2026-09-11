import { useCallback, useEffect, useRef, useState } from "react";

/** Adds `.in` to elements with `.reveal` when they scroll into view. */
export function useReveal(deps = []) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Cursor spotlight + optional 3D tilt for a card. Spread returned props on the element. */
export function useSpotlight({ tilt = false, max = 6 } = {}) {
  const ref = useRef(null);
  const onMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      if (tilt) {
        const rx = ((y / r.height) - 0.5) * -max;
        const ry = ((x / r.width) - 0.5) * max;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
      }
    },
    [tilt, max]
  );
  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (el && tilt) el.style.transform = "";
  }, [tilt]);
  return { ref, onMouseMove, onMouseLeave, className: `spotlight ${tilt ? "tilt" : ""}` };
}

/** Animates a number from 0 → value when it first becomes visible. */
export function useCountUp(value, { duration = 1100 } = {}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    const run = () => {
      const start = performance.now();
      const from = 0;
      const to = Number(value) || 0;
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (started.current) {
      run();
      return;
    }
    if (!el || !("IntersectionObserver" in window)) {
      started.current = true;
      run();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        started.current = true;
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return [display, ref];
}
