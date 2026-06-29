import { useLayoutEffect } from "react";
import LocomotiveScroll from "locomotive-scroll";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const NAVBAR_OFFSET = 72;

export function useLocomotiveScroll() {
  useLayoutEffect(() => {
    const root = document.documentElement;

    const locomotiveScroll = new LocomotiveScroll({
      lenisOptions: {
        duration: 1.35,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.72,
        touchMultiplier: 0.95,
      },
      rafRootMargin: "400% 0% 400% 0%",
      scrollCallback: () => {
        ScrollTrigger.update();
      },
    });

    const lenis = locomotiveScroll.lenisInstance;

    ScrollTrigger.scrollerProxy(root, {
      scrollTop(value) {
        if (arguments.length && lenis) {
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis?.scroll ?? 0;
      },
      getBoundingClientRect() {
        return {
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        };
      },
    });

    ScrollTrigger.defaults({ scroller: root });

    const handleResize = () => {
      locomotiveScroll.resize();
      ScrollTrigger.refresh();
    };

    const handleAnchorClick = (event) => {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      locomotiveScroll.scrollTo(target, { offset: -NAVBAR_OFFSET });
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    document.addEventListener("click", handleAnchorClick);

    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        locomotiveScroll.resize();
        ScrollTrigger.refresh();
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      document.removeEventListener("click", handleAnchorClick);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      ScrollTrigger.clearScrollMemory();
      ScrollTrigger.defaults({ scroller: undefined });
      locomotiveScroll.destroy();
    };
  }, []);
}
