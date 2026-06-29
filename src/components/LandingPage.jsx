import { useEffect, useRef, useCallback } from "react";
import Navbar from "./Navbar";

const PARALLAX_STRENGTH = 12;

export default function LandingPage() {
  const imageRef = useRef(null);
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
    let frameId;
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

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-black">
      <Navbar />

      <main className="landing-main flex flex-1 items-center justify-center px-8 md:px-12">
        <div className="flex w-full max-w-[1400px] items-center justify-center gap-10 md:gap-16 lg:gap-20">
          <div className="relative -top-[12vh] -left-[4vw] shrink-0">
            <h1 className="headline">
              <span className="block text-white">Interactive Atlas</span>
              <span className="block text-white">For Engineers.</span>
              <span className="block text-[#666]">Built to Explain</span>
              <span className="block text-[#666]">Complex Systems.</span>
            </h1>
            <p className="subtitle">
              <span className="block">
                Engineering concepts explained through interactive articles,
              </span>
              <span className="block">
                visualizations, and practical case studies.
              </span>
            </p>
          </div>

          <div className="relative -top-[2vh] -left-[9vw] shrink-0">
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
        </div>
      </main>

      <footer className="flex w-full justify-end px-8 pb-8 md:px-12 md:pb-10">
        <p className="font-poppins text-[11px] font-normal text-white/35 md:text-xs">
          Atlas 2026
        </p>
      </footer>
    </div>
  );
}
