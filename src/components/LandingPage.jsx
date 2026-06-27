import { useEffect, useRef, useCallback } from "react";

const PARALLAX_STRENGTH = 22;

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

    const animate = () => {
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
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, [handleMouseMove]);

  return (
    <div
      className="relative flex h-full min-h-screen w-full flex-col bg-black"
      onMouseMove={handleMouseMove}
    >
      <main className="flex flex-1 items-center justify-center px-8 md:px-12">
        <div className="flex w-full max-w-[1400px] items-center justify-center gap-8 md:gap-12 lg:gap-16">
          <p className="max-w-[220px] shrink-0 text-left text-[clamp(1.1rem,2.2vw,1.75rem)] leading-[1.35] font-medium tracking-tight text-white md:max-w-[280px]">
            The Interactive Atlas
            <br />
            of Modern Software
            <br />
            Engineering.
          </p>

          <div className="relative top-[4vh] left-[2vw] shrink-0">
            <img
              ref={imageRef}
              src="/images/second_a.png"
              alt=""
              className="h-[clamp(22rem,72vmin,92rem)] w-auto object-contain will-change-transform"
              style={{ transform: "translate3d(0px, 0px, 0) rotate(-2deg)" }}
              draggable={false}
            />
          </div>
        </div>
      </main>

      <footer className="flex w-full justify-end px-8 pb-8 md:px-12 md:pb-10">
        <p className="text-[11px] text-white/35 md:text-xs">Atlas 2026</p>
      </footer>
    </div>
  );
}
