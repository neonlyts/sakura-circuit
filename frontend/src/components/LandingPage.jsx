import React from "react";
import { Keyboard, Flag, Trophy, ChevronDown } from "lucide-react";

const PETALS = [
  { left: "8%", top: "15%", delay: "0s", dur: "4s", size: 10 },
  { left: "18%", top: "5%", delay: "0.8s", dur: "5s", size: 7 },
  { left: "75%", top: "12%", delay: "1.2s", dur: "4.5s", size: 9 },
  { left: "88%", top: "8%", delay: "0.4s", dur: "6s", size: 6 },
  { left: "50%", top: "3%", delay: "2s", dur: "5.5s", size: 8 },
  { left: "35%", top: "18%", delay: "1.5s", dur: "4.2s", size: 7 },
  { left: "62%", top: "6%", delay: "0.6s", dur: "4.8s", size: 10 },
];

export default function LandingPage({ gameRef }) {
  const scrollToGame = () => {
    gameRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative overflow-hidden flex flex-col items-center justify-center text-center py-24 px-6"
        style={{
          background: "linear-gradient(160deg, #5BBCDD 0%, #87CEEB 35%, #A8D8EF 60%, #75D481 100%)",
          minHeight: "90vh",
        }}
      >
        {/* Floating petals */}
        {PETALS.map((p, i) => (
          <div
            key={i}
            className="petal"
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.delay,
              animationDuration: p.dur,
              width: p.size,
              height: p.size,
              opacity: 0.7,
            }}
          />
        ))}

        {/* Mountain silhouettes (SVG) */}
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 900 160"
          preserveAspectRatio="none"
          style={{ height: 160, opacity: 0.25 }}
        >
          <polygon points="0,160 120,40 240,160" fill="#3B7A8A" />
          <polygon points="200,160 380,10 560,160" fill="#4A8FA0" />
          <polygon points="520,160 700,50 880,160" fill="#3B7A8A" />
          <polygon points="800,160 900,70 900,160" fill="#4A8FA0" />
          <polygon points="340,65 380,10 420,65" fill="white" opacity="0.6" />
          <polygon points="650,62 700,50 750,62" fill="white" opacity="0.6" />
        </svg>

        {/* Cherry blossom tree shapes */}
        <div className="absolute left-4 bottom-20 opacity-40">
          <div className="w-4 h-16 bg-amber-800 mx-auto rounded-sm" />
          <div className="w-16 h-16 rounded-full bg-pink-300 -mt-8 -ml-6" />
          <div className="w-12 h-12 rounded-full bg-pink-200 -mt-14 ml-2" />
        </div>
        <div className="absolute right-6 bottom-20 opacity-40">
          <div className="w-4 h-14 bg-amber-800 mx-auto rounded-sm" />
          <div className="w-14 h-14 rounded-full bg-pink-300 -mt-7 -ml-5" />
          <div className="w-10 h-10 rounded-full bg-pink-200 -mt-12 ml-1" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl">
          <p
            className="text-white/80 text-xs font-semibold tracking-[0.4em] uppercase mb-4"
            style={{ letterSpacing: "0.4em" }}
          >
            JAPAN RACING CHAMPIONSHIP
          </p>

          <h1
            className="font-black text-white tracking-tight drop-shadow-xl leading-none mb-4"
            style={{
              fontFamily: "Unbounded, sans-serif",
              fontSize: "clamp(3rem, 8vw, 6rem)",
              textShadow: "0 4px 30px rgba(0,0,0,0.3)",
            }}
          >
            TOKYO
            <br />
            <span style={{ color: "#FFD0DC" }}>CIRCUIT</span>
          </h1>

          <p
            className="text-white/90 text-lg sm:text-xl font-medium mb-10 max-w-lg mx-auto"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Race through the streets of Tokyo. Cherry blossoms, mountain views,
            and fierce AI opponents await.
          </p>

          <button
            onClick={scrollToGame}
            data-testid="play-now-btn"
            className="group inline-flex items-center gap-3 px-10 py-5 text-white font-black text-lg uppercase tracking-widest rounded-2xl transition-all duration-200 hover:-translate-y-2 hover:shadow-2xl active:scale-95"
            style={{
              fontFamily: "Unbounded, sans-serif",
              background: "linear-gradient(135deg, #FF9EBB, #FF6B9D)",
              boxShadow: "0 8px 30px rgba(255,158,187,0.5)",
            }}
          >
            PLAY NOW
            <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-60">
          <ChevronDown className="w-6 h-6 text-white" />
        </div>
      </section>

      {/* How to Play */}
      <section
        className="py-16 px-6"
        style={{ background: "linear-gradient(180deg, #EAF5FF 0%, #F5F8FA 100%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-center font-black text-[#1E293B] mb-2 tracking-tight"
            style={{ fontFamily: "Unbounded, sans-serif", fontSize: "1.5rem" }}
          >
            HOW TO PLAY
          </h2>
          <p className="text-center text-[#475569] text-sm mb-10">
            Choose your car, race 3 laps, beat the AI
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Controls */}
            <div
              className="p-6 rounded-2xl bg-white shadow-md border border-[#E2E8F0] hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              data-testid="instructions-controls"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, #4DA8DA22, #4DA8DA44)" }}
              >
                <Keyboard className="w-5 h-5 text-[#4DA8DA]" />
              </div>
              <h3 className="font-bold text-[#1E293B] mb-3" style={{ fontFamily: "Unbounded, sans-serif", fontSize: "0.85rem" }}>
                CONTROLS
              </h3>
              <div className="text-[#475569] text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">W</kbd>
                  <span className="text-xs">/</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">↑</kbd>
                  <span className="text-xs text-[#64748B]">Accelerate</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">S</kbd>
                  <span className="text-xs">/</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">↓</kbd>
                  <span className="text-xs text-[#64748B]">Brake / Reverse</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">A</kbd>
                  <span className="text-xs">/</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">←</kbd>
                  <span className="text-xs text-[#64748B]">Steer Left</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">D</kbd>
                  <span className="text-xs">/</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-xs font-mono border border-[#E2E8F0]">→</kbd>
                  <span className="text-xs text-[#64748B]">Steer Right</span>
                </div>
              </div>
            </div>

            {/* Race */}
            <div
              className="p-6 rounded-2xl bg-white shadow-md border border-[#E2E8F0] hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              data-testid="instructions-race"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, #FF9EBB22, #FF9EBB44)" }}
              >
                <Flag className="w-5 h-5 text-[#FF6B9D]" />
              </div>
              <h3 className="font-bold text-[#1E293B] mb-3" style={{ fontFamily: "Unbounded, sans-serif", fontSize: "0.85rem" }}>
                RACE
              </h3>
              <p className="text-[#475569] text-sm leading-relaxed">
                Complete <strong>3 laps</strong> around the classic Tokyo Circuit.
                Go off-track and you slow down — stay on the asphalt!
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-[#64748B]">
                <span className="w-2 h-2 rounded-full bg-[#75D481] inline-block" />
                3 laps to complete
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[#64748B]">
                <span className="w-2 h-2 rounded-full bg-[#4DA8DA] inline-block" />
                2 AI opponents (medium)
              </div>
            </div>

            {/* Win */}
            <div
              className="p-6 rounded-2xl bg-white shadow-md border border-[#E2E8F0] hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              data-testid="instructions-win"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, #75D48122, #75D48144)" }}
              >
                <Trophy className="w-5 h-5 text-[#4CAF50]" />
              </div>
              <h3 className="font-bold text-[#1E293B] mb-3" style={{ fontFamily: "Unbounded, sans-serif", fontSize: "0.85rem" }}>
                WIN
              </h3>
              <p className="text-[#475569] text-sm leading-relaxed">
                Finish in <strong>1st place</strong> to claim the Tokyo Championship!
                Any other position is a loss.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                <div className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#FFD70022", color: "#B8860B" }}>1st WIN</div>
                <div className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#FF525222", color: "#D32F2F" }}>2nd LOSE</div>
                <div className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#FF525222", color: "#D32F2F" }}>3rd LOSE</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
