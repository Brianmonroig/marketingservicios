"use client";

import { useEffect } from "react";

// Efectos de la landing, portados de main.js de la referencia North Scale:
// barra fija, menú móvil, degradado que sigue al ratón, apariciones al hacer scroll,
// acordeón de servicios, halo en los pasos y contadores.
export function LandingEffects() {
  useEffect(() => {
    const $ = <T extends Element>(selector: string, scope: ParentNode = document) => scope.querySelector<T>(selector);
    const $$ = <T extends Element>(selector: string, scope: ParentNode = document) => Array.from(scope.querySelectorAll<T>(selector));
    const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cleanups: Array<() => void> = [];
    const root = document.documentElement;

    (window as unknown as { __NS_BOOT__?: boolean }).__NS_BOOT__ = true;

    // Barra: se vuelve sólida al hacer scroll. Menú móvil.
    const nav = $<HTMLElement>("[data-nav]");
    const burger = $<HTMLButtonElement>("[data-burger]");
    if (nav) {
      const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 24);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));

      if (burger) {
        const close = () => {
          nav.classList.remove("is-open");
          burger.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        };
        const toggle = () => {
          const open = !nav.classList.contains("is-open");
          nav.classList.toggle("is-open", open);
          burger.setAttribute("aria-expanded", String(open));
          document.body.style.overflow = open ? "hidden" : "";
        };
        const onKey = (event: KeyboardEvent) => {
          if (event.key === "Escape") close();
        };
        burger.addEventListener("click", toggle);
        window.addEventListener("keydown", onKey);
        const links = $$<HTMLAnchorElement>(".nav-links a");
        links.forEach((link) => link.addEventListener("click", close));
        cleanups.push(() => {
          burger.removeEventListener("click", toggle);
          window.removeEventListener("keydown", onKey);
          links.forEach((link) => link.removeEventListener("click", close));
          document.body.style.overflow = "";
        });
      }
    }

    // Degradado aurora que sigue al ratón, con inercia.
    const gradient = $<HTMLElement>("[data-mouse-gradient]");
    if (gradient?.parentElement) {
      const hero = gradient.parentElement;
      let tx = 70;
      let ty = 30;
      let x = 70;
      let y = 30;
      let raf: number | null = null;
      const tick = () => {
        x += (tx - x) * 0.06;
        y += (ty - y) * 0.06;
        gradient.style.setProperty("--mx", `${x.toFixed(2)}%`);
        gradient.style.setProperty("--my", `${y.toFixed(2)}%`);
        raf = Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05 ? requestAnimationFrame(tick) : null;
      };
      const aim = (nx: number, ny: number) => {
        tx = nx;
        ty = ny;
        if (!raf) raf = requestAnimationFrame(tick);
      };
      if (fineHover) {
        const onMove = (event: PointerEvent) => {
          const rect = hero.getBoundingClientRect();
          aim(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
        };
        hero.addEventListener("pointermove", onMove);
        cleanups.push(() => hero.removeEventListener("pointermove", onMove));
      } else {
        const onScroll = () => {
          const progress = Math.min(1, window.scrollY / window.innerHeight);
          aim(70 - progress * 40, 30 + progress * 40);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener("scroll", onScroll));
      }
      cleanups.push(() => {
        if (raf) cancelAnimationFrame(raf);
      });
    }

    // Apariciones al entrar en pantalla, escalonadas dentro de cada grupo.
    const reveals = $$<HTMLElement>(".reveal");
    $$<HTMLElement>(".hero-title, .hero-pillars, .compare, .steps, .fit-grid, .ai-points, .figures-grid, .faq-list, .svc-list").forEach((group) => {
      $$<HTMLElement>(".reveal", group).forEach((el, index) => el.style.setProperty("--d", `${(index * 0.08).toFixed(2)}s`));
    });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              io.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.05, rootMargin: "0px 0px -6% 0px" },
      );
      reveals.forEach((el) => io.observe(el));

      const steps = $$<HTMLElement>(".step");
      const stepsObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              stepsObserver.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.05 },
      );
      steps.forEach((step) => stepsObserver.observe(step));

      const counters = $$<HTMLElement>("[data-count-to]");
      const counterObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            counterObserver.unobserve(entry.target);
            const el = entry.target as HTMLElement;
            const to = parseFloat(el.dataset.countTo ?? "0") || 0;
            const start = performance.now();
            const step = (now: number) => {
              const progress = Math.min(1, (now - start) / 1400);
              el.textContent = String(Math.round(to * (1 - Math.pow(1 - progress, 4))));
              if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        },
        { threshold: 0.05 },
      );
      counters.forEach((counter) => counterObserver.observe(counter));
      cleanups.push(() => {
        io.disconnect();
        stepsObserver.disconnect();
        counterObserver.disconnect();
      });
    } else {
      reveals.forEach((el) => el.classList.add("is-in"));
    }

    // Acordeón de servicios: el primero empieza abierto.
    $$<HTMLElement>(".svc").forEach((item, index) => {
      const head = $<HTMLButtonElement>(".svc-head", item);
      if (!head) return;
      const onClick = () => {
        const open = !item.classList.contains("is-open");
        item.classList.toggle("is-open", open);
        head.setAttribute("aria-expanded", String(open));
      };
      head.addEventListener("click", onClick);
      cleanups.push(() => head.removeEventListener("click", onClick));
      if (index === 0) {
        item.classList.add("is-open");
        head.setAttribute("aria-expanded", "true");
      }
    });

    // Halo que sigue al cursor en los pasos.
    if (fineHover) {
      $$<HTMLElement>(".step").forEach((card) => {
        const onMove = (event: PointerEvent) => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty("--sx", `${event.clientX - rect.left}px`);
          card.style.setProperty("--sy", `${event.clientY - rect.top}px`);
        };
        card.addEventListener("pointermove", onMove);
        cleanups.push(() => card.removeEventListener("pointermove", onMove));
      });
    }

    root.classList.add("is-ready");
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
