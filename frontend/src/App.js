import React, { useRef } from "react";
import "./App.css";
import LandingPage from "./components/LandingPage";
import RacingGame from "./components/RacingGame";

function App() {
  const gameRef = useRef(null);

  return (
    <div className="min-h-screen bg-[#F5F8FA]" style={{ fontFamily: "Outfit, sans-serif" }}>
      <LandingPage gameRef={gameRef} />
      <section
        ref={gameRef}
        className="py-10 px-4 flex flex-col items-center"
        style={{ background: "linear-gradient(180deg, #F5F8FA 0%, #EAF5FF 100%)" }}
      >
        <h2
          className="text-2xl font-black text-[#1E293B] mb-2 tracking-tight"
          style={{ fontFamily: "Unbounded, sans-serif" }}
        >
          SAKURA CIRCUIT
        </h2>
        <p className="text-[#475569] text-sm mb-6">Select your car and beat the AI!</p>
        <div className="w-full" style={{ maxWidth: 900 }}>
          <RacingGame />
        </div>
      </section>
      <footer className="text-center py-6 text-[#94A3B8] text-xs" style={{ fontFamily: "Outfit, sans-serif" }}>
        Sakura Circuit — Japan Racing Challenge
      </footer>
    </div>
  );
}

export default App;
