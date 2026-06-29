import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "./Navbar";

gsap.registerPlugin(ScrollTrigger);

const PARALLAX_STRENGTH = 12;

const marqueeItems = [
  "DISTRIBUTED SYSTEMS",
  "DATABASES",
  "AI INFRASTRUCTURE",
  "NETWORKING",
  "OPERATING SYSTEMS",
  "SYSTEM DESIGN",
  "OPEN SOURCE",
];

const MARQUEE_REPEATS = 4;
const MARQUEE_DURATION = 4;

const scrollPanels = [
  {
    id: "features",
    title: "Interactive by design",
    body: "Step through algorithms, data flows, and system boundaries with visuals that respond as you learn.",
  },
  {
    id: "blogs",
    title: "Real-world case studies",
    body: "See how complex systems are reasoned about, decomposed, and explained from first principles.",
  },
  {
    id: "project-docs",
    title: "Architecture breakdowns",
    body: "Follow layered explanations that connect theory to production patterns engineers actually use.",
  },
];

export default function LandingPage() {
  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const imageWrapRef = useRef(null);
  const imageRef = useRef(null);
  const marqueeRef = useRef(null);
  const marqueeTrackRef = useRef(null);
  const headlineRef = useRef(null);
  const subtitleRef = useRef(null);
  const sideBlockRef = useRef(null);
  const targetOffset = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;

    targetOffset.current = {
      x: -x * PARALLAX_STRENGTH,
      y: -y * PARALLAX_STRENGTH,
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    let running = true;

    const animate = () => {
      if (!running) return;

      currentOffset.current.x +=
        (targetOffset.current.x - currentOffset.current.x) * 0.12;
      currentOffset.current.y +=
        (targetOffset.current.y - currentOffset.current.y) * 0.12;

      if (imageRef.current) {
        const { x, y } = currentOffset.current;
        imageRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(-2deg)`;
      }

      frameId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    frameId = requestAnimationFrame(animate);

    return () => {
      running = false;
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, [handleMouseMove]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const headlineLines = headlineRef.current?.querySelectorAll("span");
      const subtitleLines = subtitleRef.current?.querySelectorAll("span");
      const sideLines = sideBlockRef.current?.querySelectorAll(
        ".hero-side-text span",
      );

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (headlineLines?.length) {
        intro.from(headlineLines, {
          y: 72,
          opacity: 0,
          duration: 1,
          stagger: 0.08,
        });
      }

      if (subtitleLines?.length) {
        intro.from(
          subtitleLines,
          {
            y: 28,
            opacity: 0,
            duration: 0.85,
            stagger: 0.06,
          },
          "-=0.55",
        );
      }

      intro.from(
        imageWrapRef.current,
        {
          y: 48,
          opacity: 0,
          scale: 0.94,
          duration: 1.1,
        },
        "-=0.7",
      );

      if (sideLines?.length) {
        intro.from(
          sideLines,
          {
            y: 24,
            opacity: 0,
            duration: 0.8,
            stagger: 0.05,
          },
          "-=0.65",
        );
      }

      intro.from(
        ".hero-side-cross",
        {
          scale: 0.6,
          opacity: 0,
          duration: 0.7,
        },
        "-=0.5",
      );

      intro.from(
        ".hero-marquee",
        {
          y: 16,
          opacity: 0,
          duration: 0.85,
        },
        "-=0.45",
      );

      if (marqueeRef.current && heroRef.current) {
        gsap.to(marqueeRef.current, {
          y: () => window.innerHeight * -0.55,
          ease: "none",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      gsap.utils.toArray(".scroll-panel").forEach((panel) => {
        const title = panel.querySelector(".scroll-panel-title");
        const body = panel.querySelector(".scroll-panel-body");

        gsap.from(title, {
          y: 56,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: panel,
            start: "top 78%",
            toggleActions: "play none none reverse",
          },
        });

        gsap.from(body, {
          y: 36,
          opacity: 0,
          duration: 0.9,
          delay: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: panel,
            start: "top 72%",
            toggleActions: "play none none reverse",
          },
        });
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const track = marqueeTrackRef.current;
    if (!track) return;

    let marqueeTween = null;

    const setupMarquee = () => {
      const segment = track.querySelector(".hero-marquee-content");
      const loopWidth = segment?.offsetWidth ?? 0;
      if (loopWidth <= 0) return;

      marqueeTween?.kill();
      gsap.set(track, { x: -loopWidth });
      marqueeTween = gsap.to(track, {
        x: 0,
        duration: MARQUEE_DURATION,
        ease: "none",
        repeat: -1,
      });
    };

    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(setupMarquee);
    });

    window.addEventListener("resize", setupMarquee);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", setupMarquee);
      marqueeTween?.kill();
      gsap.set(track, { clearProps: "transform" });
    };
  }, []);

  return (
    <div ref={pageRef} className="page">
      <Navbar />

      <section
        id="home"
        ref={heroRef}
        className="hero-section relative flex min-h-screen w-full flex-col overflow-hidden bg-black"
      >
        <main className="landing-main hero-above-marquee relative z-10 flex flex-1 items-center justify-center px-8 md:px-12">
          <div className="flex w-full max-w-[1400px] items-center justify-center gap-10 md:gap-16 lg:gap-20">
            <div
              className="relative top-[-6vh] left-[3vw] shrink-0"
              data-scroll
              data-scroll-repeat
              data-scroll-speed="0.2"
            >
              <h1 ref={headlineRef} className="headline">
                <span className="block text-white">Interactive Atlas</span>
                <span className="block text-white">For Engineers.</span>
                <span className="block text-[#666]">Built to Explain</span>
                <span className="block text-[#666]">Complex Systems.</span>
              </h1>
              <p ref={subtitleRef} className="subtitle">
                <span className="block">
                  Engineering concepts explained through interactive articles,
                </span>
                <span className="block">
                  visualizations, and practical case studies.
                </span>
              </p>
            </div>

            <div
              ref={imageWrapRef}
              className="relative -top-[2vh] -left-[2vw] shrink-0"
              data-scroll
              data-scroll-repeat
              data-scroll-speed="0.15"
            >
              <img
                ref={imageRef}
                src="/images/final-a.png"
                alt=""
                aria-hidden="true"
                className="hero-logo will-change-transform"
                style={{ transform: "translate3d(0px, 0px, 0) rotate(-2deg)" }}
                draggable={false}
              />
            </div>

            <div
              ref={sideBlockRef}
              className="relative -top-[6vh] -left-[6.5vw] shrink-0"
              data-scroll
              data-scroll-repeat
              data-scroll-speed="0.22"
            >
              <div className="hero-side-block">
                <p className="hero-side-text">
                  <span className="block">Learn from first principles</span>
                  <span className="block">
                    through interactive explanations,
                  </span>
                  <span className="block">architecture breakdowns,</span>
                  <span className="block">and real-world examples.</span>
                </p>
                <img
                  src="/images/decorative-cross.png"
                  alt=""
                  aria-hidden="true"
                  className="hero-side-cross"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </main>

        <div
          ref={marqueeRef}
          className="hero-marquee mt-auto"
          aria-label="Atlas highlights"
        >
          <div ref={marqueeTrackRef} className="hero-marquee-track">
            {Array.from({ length: MARQUEE_REPEATS }, (_, copy) => (
              <div
                key={copy}
                className="hero-marquee-content"
                aria-hidden={copy > 0}
              >
                {marqueeItems.map((item) => (
                  <span
                    key={`${copy}-${item}`}
                    className="hero-marquee-segment"
                  >
                    <span className="hero-marquee-item">{item}</span>
                    <img
                      src="/images/decorative-cross.png"
                      alt=""
                      aria-hidden="true"
                      className="hero-marquee-cross"
                      draggable={false}
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex w-full justify-end px-8 pb-8 md:px-12 md:pb-10">
          <p className="font-poppins text-[11px] font-normal text-white/35 md:text-xs">
            Atlas 2026
          </p>
        </footer>
      </section>

      {scrollPanels.map((panel) => (
        <section
          key={panel.id}
          id={panel.id}
          className="scroll-panel flex min-h-screen items-center bg-black px-8 md:px-12"
        >
          <div className="mx-auto w-full max-w-[1400px]">
            <h2 className="scroll-panel-title">{panel.title}</h2>
            <p className="scroll-panel-body">{panel.body}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
