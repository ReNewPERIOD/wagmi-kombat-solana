"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

/* ================= ASSETS ================= */
const VIDEO_BG = "/v4.mp4";

/* --- MUSIC (loop) --- */
const MUSIC = {
  IDLE:   "https://files.catbox.moe/ind1d6.mp3",
  ACTION: "https://files.catbox.moe/7d9x1a.mp3",
  TENSE:  "https://files.catbox.moe/x1p9qz.mp3",
  WIN:    "https://files.catbox.moe/l9f5a2.mp3",
};

/* --- SFX (one-shot) --- */
const SFX = {
  SMASH: "https://files.catbox.moe/8bq3r2.mp3",
  WIN:   "https://files.catbox.moe/z9w8x1.mp3",
};

/* ================= GAME ================= */
function Game() {
  /* ---------- MEDIA REFS ---------- */
  const videoRef = useRef(null);

  const musicRef = useRef({});
  const sfxRef = useRef({});
  const currentMusic = useRef(null);

  const unlockedRef = useRef(false);

  /* ---------- STATE ---------- */
  const [soundOn, setSoundOn] = useState(false);
  const [gameState, setGameState] = useState("IDLE");
  const [perf, setPerf] = useState("HIGH");
  const [status, setStatus] = useState("");

  /* =====================================================
     🔓 USER GESTURE UNLOCK (PHANTOM CORE)
  ===================================================== */
  const unlockMedia = useCallback(() => {
    if (unlockedRef.current) return;

    // init music
    Object.keys(MUSIC).forEach(k => {
      const a = new Audio(MUSIC[k]);
      a.loop = true;
      a.volume = 0.6;
      musicRef.current[k] = a;
    });

    // init sfx
    Object.keys(SFX).forEach(k => {
      const a = new Audio(SFX[k]);
      a.loop = false;
      a.volume = 0.9;
      sfxRef.current[k] = a;
    });

    // start idle silently to unlock
    musicRef.current.IDLE
      .play()
      .then(() => {
        musicRef.current.IDLE.pause();
        unlockedRef.current = true;
        setSoundOn(true);
      })
      .catch(() => {});
  }, []);

  /* =====================================================
     🎼 MUSIC ENGINE (NO OVERLAP)
  ===================================================== */
  const playMusic = useCallback((state) => {
    if (!soundOn || !unlockedRef.current) return;
    if (currentMusic.current === state) return;

    Object.values(musicRef.current).forEach(a => {
      a.pause();
      a.currentTime = 0;
    });

    const track = musicRef.current[state];
    if (track) {
      track.play().catch(() => {});
      currentMusic.current = state;
    }
  }, [soundOn]);

  /* =====================================================
     🔊 SFX ENGINE
  ===================================================== */
  const playSFX = (name) => {
    if (!soundOn || !unlockedRef.current) return;
    const s = sfxRef.current[name];
    if (!s) return;
    s.currentTime = 0;
    s.play().catch(() => {});
  };

  /* =====================================================
     🎧 GAME STATE → MUSIC
  ===================================================== */
  useEffect(() => {
    playMusic(gameState);
  }, [gameState, playMusic]);

  /* =====================================================
     ⚡ PERFORMANCE AI (FPS)
  ===================================================== */
  useEffect(() => {
    let last = performance.now();
    let frames = 0;

    const tick = (now) => {
      frames++;
      if (now - last >= 1000) {
        const fps = frames;
        frames = 0;
        last = now;

        if (fps < 15) setPerf("CRITICAL");
        else if (fps < 25) setPerf("LOW");
        else if (fps < 40) setPerf("MID");
        else setPerf("HIGH");
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  /* =====================================================
     🎥 VIDEO GOVERNOR
  ===================================================== */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (perf === "CRITICAL") {
      v.pause();
      v.style.display = "none";
    } else {
      v.style.display = "block";
      v.style.filter =
        perf === "LOW" ? "brightness(0.6)" : "none";
      v.play().catch(() => {});
    }
  }, [perf]);

  /* =====================================================
     👁 VISIBILITY (PHANTOM BACKGROUND)
  ===================================================== */
  useEffect(() => {
    const onHide = () => {
      Object.values(musicRef.current).forEach(a => a.pause());
    };
    const onShow = () => {
      playMusic(gameState);
    };
    document.addEventListener("visibilitychange", () => {
      document.hidden ? onHide() : onShow();
    });
    return () => {};
  }, [gameState, playMusic]);

  /* =====================================================
     🎮 ACTIONS
  ===================================================== */
  const smash = () => {
    unlockMedia();
    playSFX("SMASH");
    setGameState("ACTION");
    setStatus("💥 SMASH!");
    setTimeout(() => setGameState("IDLE"), 1200);
  };

  const tense = () => {
    setGameState("TENSE");
    setStatus("😈 FINAL SECONDS...");
  };

  const win = () => {
    playSFX("WIN");
    setGameState("WIN");
    setStatus("🏆 YOU WIN!");
  };

  /* =====================================================
     🖥 UI
  ===================================================== */
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src={VIDEO_BG} type="video/mp4" />
      </video>

      <div className="relative z-10 h-full flex flex-col justify-end items-center pb-20">
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
          <div className="text-xs text-white/60">
            PERF: {perf}
          </div>
          <WalletMultiButton />
        </div>

        {status && (
          <div className="mb-4 text-yellow-400 font-bold animate-pulse">
            {status}
          </div>
        )}

        <button
          onClick={smash}
          className="px-10 py-4 bg-red-600 text-white font-black text-2xl rounded-xl mb-3"
        >
          👊 SMASH
        </button>

        <button
          onClick={tense}
          className="px-8 py-3 bg-purple-600 text-white rounded-xl mb-3"
        >
          😈 FINAL SECONDS
        </button>

        <button
          onClick={win}
          className="px-8 py-3 bg-yellow-500 text-black rounded-xl"
        >
          🏆 WIN
        </button>

        <p className="mt-4 text-xs text-white/40">
          Tap once to unlock sound (Phantom Safe)
        </p>
      </div>
    </div>
  );
}

/* ================= PROVIDER ================= */
export default function Page() {
  const endpoint = clusterApiUrl("devnet");
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Game />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
