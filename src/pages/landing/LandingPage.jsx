import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "@/components/layout/Navbar";
import PillButton from "@/components/ui/PillButton";
import { useLocomotiveScroll } from "@/hooks/useLocomotiveScroll";

gsap.registerPlugin(ScrollTrigger);

const PARALLAX_STRENGTH = 12;
const PARALLAX_EPSILON = 0.05;

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

const featuresSectionId = "features";


export default function LandingPage() {
  useLocomotiveScroll();

  // Lower value = slower marquee (pixels moved per second).
  const marqueePixelsPerSecond = 200;

  const pageRef = useRef(null);
  const imageWrapRef = useRef(null);
  const imageRef = useRef(null);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frameId = 0;
    let running = true;
    let animating = false;

    const applyTransform = () => {
      if (!imageRef.current) return;
      const { x, y } = currentOffset.current;
      imageRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(-2deg)`;
    };

    const tick = () => {
      if (!running) {
        animating = false;
        return;
      }

      const dx = targetOffset.current.x - currentOffset.current.x;
      const dy = targetOffset.current.y - currentOffset.current.y;

      if (Math.abs(dx) < PARALLAX_EPSILON && Math.abs(dy) < PARALLAX_EPSILON) {
        currentOffset.current.x = targetOffset.current.x;
        currentOffset.current.y = targetOffset.current.y;
        applyTransform();
        animating = false;
        return;
      }

      currentOffset.current.x += dx * 0.12;
      currentOffset.current.y += dy * 0.12;
      applyTransform();
      frameId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!running || animating) return;
      animating = true;
      frameId = requestAnimationFrame(tick);
    };

    const onMouseMove = (event) => {
      handleMouseMove(event);
      startLoop();
    };

    window.addEventListener("mousemove", onMouseMove);

    return () => {
      running = false;
      animating = false;
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, [handleMouseMove]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      const headlineLines = headlineRef.current?.querySelectorAll("span");
      const subtitleLines = subtitleRef.current?.querySelectorAll("span");
      const sideLines = sideBlockRef.current?.querySelectorAll(
        ".hero-side-text span",
      );

      if (prefersReducedMotion) {
        gsap.set(
          [
            ...(headlineLines ?? []),
            ...(subtitleLines ?? []),
            ...(sideLines ?? []),
            imageWrapRef.current,
            ".hero-side-cross",
            ".pill-button",
            ".hero-marquee-stack",
            ".features-headline-line--systems",
            ".features-headline-line--you-can",
            ".features-headline-line--see",
            ".features-glass-card",
          ],
          { clearProps: "all", opacity: 1, y: 0, scale: 1 },
        );
      } else {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

        if (headlineLines?.length) {
          intro.from(headlineLines, {
            y: 72,
            opacity: 0,
            duration: 0.6,
            stagger: 0.04,
          });
        }

        if (subtitleLines?.length) {
          intro.from(
            subtitleLines,
            {
              y: 28,
              opacity: 0,
              duration: 0.5,
              stagger: 0.03,
            },
            "-=0.4",
          );
        }

        if (imageWrapRef.current) {
          intro.from(
            imageWrapRef.current,
            {
              y: 48,
              opacity: 0,
              scale: 0.94,
              duration: 0.7,
            },
            "-=0.5",
          );
        }

        if (sideLines?.length) {
          intro.from(
            sideLines,
            {
              y: 24,
              opacity: 0,
              duration: 0.5,
              stagger: 0.03,
            },
            "-=0.45",
          );
        }

        intro.from(
          ".hero-side-cross",
          {
            scale: 0.6,
            opacity: 0,
            duration: 0.4,
          },
          "-=0.35",
        );

        intro.from(
          ".pill-button",
          {
            y: 12,
            opacity: 0,
            duration: 0.45,
            stagger: 0.05,
          },
          "-=0.3",
        );

        intro.from(
          ".hero-marquee-stack",
          {
            y: 16,
            opacity: 0,
            duration: 0.5,
          },
          "-=0.3",
        );

        gsap.utils.toArray(".scroll-panel").forEach((panel) => {
          const title = panel.querySelector(".scroll-panel-title");
          const body = panel.querySelector(".scroll-panel-body");
          const asciiCat = panel.querySelector(".hero-ascii-cat");

          if (title && body) {
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
          }

          if (asciiCat) {
            gsap.from(asciiCat, {
              y: 46,
              opacity: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: panel,
                start: "top 74%",
                toggleActions: "play none none reverse",
              },
            });
          }
        });

        // Features headline lines slide-in from left (reversible parallax scroll - speed optimized)
        const root = pageRef.current;
        const featuresSection = root?.querySelector(".features-section");
        const lineSystems = root?.querySelector(".features-headline-line--systems");
        const lineYouCan = root?.querySelector(".features-headline-line--you-can");
        const lineSee = root?.querySelector(".features-headline-line--see");

        if (lineSystems && lineYouCan && lineSee && featuresSection) {
          gsap.from(lineSystems, {
            x: -300,
            opacity: 0,
            ease: "none",
            scrollTrigger: {
              trigger: featuresSection,
              start: "top bottom",
              end: "top 25%",
              scrub: 0.8,
            },
          });
          gsap.from(lineYouCan, {
            x: -450,
            opacity: 0,
            ease: "none",
            scrollTrigger: {
              trigger: featuresSection,
              start: "top bottom",
              end: "top 25%",
              scrub: 1.0,
            },
          });
          gsap.from(lineSee, {
            x: -600,
            opacity: 0,
            ease: "none",
            scrollTrigger: {
              trigger: featuresSection,
              start: "top bottom",
              end: "top 25%",
              scrub: 1.2,
            },
          });
        }

        // Features glass cards reveal (reversible staggered parallax rise - speed optimized)
        const cards = root?.querySelectorAll(".features-glass-card");
        if (cards?.length && featuresSection) {
          gsap.from(cards, {
            y: "+=150",
            opacity: 0,
            scale: 0.92,
            stagger: 0.12,
            ease: "none",
            scrollTrigger: {
              trigger: featuresSection,
              start: "top bottom",
              end: "top 35%",
              scrub: 0.8,
            },
          });
        }
      }

      ScrollTrigger.refresh();
    }, pageRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const track = marqueeTrackRef.current;
    if (!track) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let marqueeTween = null;

    const setupMarquee = () => {
      const segment = track.querySelector(".hero-marquee-content");
      const loopWidth = segment?.offsetWidth ?? 0;
      if (loopWidth <= 0 || marqueePixelsPerSecond <= 0) return;

      const duration = loopWidth / marqueePixelsPerSecond;

      marqueeTween?.kill();
      gsap.set(track, { x: -loopWidth });
      marqueeTween = gsap.to(track, {
        x: 0,
        duration,
        ease: "none",
        repeat: -1,
      });
    };

    let cancelled = false;

    const initMarquee = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Fall back to the current layout if font loading fails.
      }

      if (cancelled) return;

      setupMarquee();
    };

    initMarquee();

    window.addEventListener("resize", setupMarquee);

    const handleViewportChange = () => {
      setupMarquee();
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", setupMarquee);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      marqueeTween?.kill();
      if (track.isConnected) {
        gsap.set(track, { clearProps: "transform" });
      }
    };
  }, [marqueePixelsPerSecond]);

  return (
    <div ref={pageRef} className="page">
      <Navbar />

      <section
        id="home"
        className="hero-section relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-black"
      >
        <main
          className="landing-main hero-above-marquee relative z-10 flex flex-1 items-center justify-center px-6 md:px-12"
        >
          <div className="hero-content-grid">
            <div className="hero-copy">
              <h1 ref={headlineRef} className="headline">
                <span className="block text-white">Interactive Atlas</span>
                <span className="block text-white">For Engineers.</span>
                <span className="block text-[#666]">Built to Explain</span>
                <span className="headline-line headline-line--nowrap block text-[#666]">
                  Complex Systems.
                </span>
              </h1>
              <p ref={subtitleRef} className="subtitle">
                <span className="block">
                  Engineering concepts explained through interactive articles,
                </span>
                <span className="block">
                  visualizations, and practical case studies.
                </span>
              </p>
              <PillButton
                href="/project-docs"
                label="read project-docs"
                variant="primary"
              />
            </div>

            <div ref={imageWrapRef} className="hero-logo-wrap">
              <img
                ref={imageRef}
                src="/images/final-a.png"
                alt=""
                aria-hidden="true"
                className="hero-logo will-change-transform"
                width={1023}
                height={1537}
                style={{ transform: "translate3d(0px, 0px, 0) rotate(-2deg)" }}
                draggable={false}
              />
            </div>

            <div ref={sideBlockRef} className="hero-side-wrap">
              <div className="hero-side-block">
                <p className="hero-side-text">
                  <span className="block">Learn from first principles</span>
                  <span className="block">
                    through interactive explanations,
                  </span>
                  <span className="block">architecture breakdowns,</span>
                  <span className="block">and real-world examples.</span>
                </p>
                <PillButton
                  href="/blog"
                  label="read articles"
                  variant="accent"
                  size="sm"
                />
                <img
                  src="/images/decorative-cross.png"
                  alt=""
                  aria-hidden="true"
                  className="hero-side-cross"
                  width={1024}
                  height={1024}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </main>

        <div className="hero-marquee-stack mt-auto">
          <div className="hero-marquee" aria-label="Atlas highlights">
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
                        width={1024}
                        height={1024}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id={featuresSectionId}
        className="features-section scroll-panel flex min-h-[100dvh] items-center"
      >
        <div className="features-image-wrap" aria-hidden="true">
          <img
            src="/images/features-page.png"
            alt=""
            className="features-image"
            width={1680}
            height={936}
            decoding="async"
            draggable={false}
          />
        </div>

        <div className="features-section-layout flex flex-col justify-center items-center">
          <div className="features-copy">
            <h2 className="features-headline" aria-label="Systems you can see">
              <span className="features-headline-line features-headline-line--systems">SYSTEMS</span>
              <span className="features-headline-line features-headline-line--you-can">YOU CAN</span>
              <span className="features-headline-line features-headline-line--see">SEE</span>
            </h2>
          </div>

          {/* Staggered Glassmorphism Cards */}
          <div className="features-cards-container">
            {[
              {
                num: "01",
                title: "Interactive Articles",
                desc: "Learn complex engineering concepts through visual explanations and interactive diagrams.",
              },
              {
                num: "02",
                title: "Architecture Deep Dives",
                desc: "Explore production-inspired designs behind distributed systems, databases, and modern infrastructure.",
              },
              {
                num: "03",
                title: "Engineering Projects",
                desc: "Complete implementations built from scratch, with source code, benchmarks, and design decisions.",
              },
              {
                num: "04",
                title: "Case Studies",
                desc: "Understand how real systems work through practical breakdowns, trade-offs, and failure analysis.",
              },
              {
                num: "05",
                title: "Visual Simulations",
                desc: "See write paths, compaction, consensus, networking, and recovery come alive with animations.",
              },
            ].map((card) => (
              <div key={card.num} className="features-glass-card">
                <span className="features-card-num">{card.num}</span>
                <div className="features-card-body">
                  <h3 className="features-card-title">{card.title}</h3>
                  <p className="features-card-desc">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
