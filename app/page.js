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

/* MUSIC (loop) */
const MUSIC = {
  IDLE:   "https://files.catbox.moe/ind1d6.mp3",
  ACTION: "https://files.catbox.moe/7d9x1a.mp3",
  TENSE:  "https://files.catbox.moe/x1p9qz.mp3",
  WIN:    "https://files.catbox.moe/l9f5a2.mp3",
};

/* SFX (one shot) */
const SFX = {
  SMASH: "https://files.catbox.moe/8bq3r2.mp3",
  WIN:   "https://files.catbox.moe/z9w8x1.mp3",
};

/* ================= GAME ================= */
function Game() {
  /* ---------- REFS ---------- */
  const videoRef = useRef(null);

  const musicRef = useRef({});
  const sfxRef = useRef({});
  const currentMusicRef = useRef(null);

  const unlockedRef = useRef(false);

  /* ---------- STATE ---------- */
  const [audioReady, setAudioReady] = useState(false);
  const [gameState, setGameState] = useState("IDLE");
  const [status, setStatus] = useState("");
  const [perf, setPerf] = useState("HIGH");

  /* =====================================================
     🔓 UNLOCK MEDIA (ABSOLUTE SAFE)
     CHỈ GỌI TRONG USER GESTURE
  ===================================================== */
  const unlockMedia = useCallback(() => {
    if (unlockedRef.current) return;

    // Init music
    Object.entries(MUSIC).forEach(([key, src]) => {
      const a = new Audio(src);
      a.loop = true;
      a.volume = 0.6;
      musicRef.current[key] = a;
    });

    // Init SFX
    Object.entries(SFX).forEach(([key, src]) => {
      const a = new Audio(src);
      a.volume = 1.0;
      sfxRef.current[key] = a;
    });

    // HARD UNLOCK (no promise trust)
    try {
      const a = musicRef.current.IDLE;
      a.muted = true;
      a.play();
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    } catch (e) {}

    unlockedRef.current = true;
    setAudioReady(true);
  }, []);

  /* =====================================================
     🎼 MUSIC ENGINE (NO OVERLAP – NO FAIL)
  ===================================================== */
  const playMusic = useCallback((state) => {
    if (!unlockedRef.current) return;
    if (currentMusicRef.current === state) return;

    Object.values(musicRef.current).forEach(a => {
      a.pause();
      a.currentTime = 0;
    });

    const track = musicRef.current[state];
    if (track) {
      try {
        track.play();
        currentMusicRef.current = state;
      } catch {}
    }
  }, []);

  /* =====================================================
     🔊 SFX ENGINE
  ===================================================== */
  const playSFX = (name) => {
    if (!unlockedRef.current) return;
    const s = sfxRef.current[name];
    if (!s) return;
    try {
      s.currentTime = 0;
      s.play();
    } catch {}
  };

  /* =====================================================
     GAME STATE → MUSIC
  ===================================================== */
  useEffect(() => {
    if (!audioReady) return;
    playMusic(gameState);
  }, [gameState, audioReady, playMusic]);

  /* =====================================================
     ⚡ PERFORMANCE MONITOR (SAFE)
  ===================================================== */
  useEffect(() => {
    let frames = 0;
    let last = performance.now();

    const loop = (now) => {
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
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, []);

  /* =====================================================
     VIDEO GOVERNOR
  ===================================================== */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (perf === "CRITICAL") {
      v.pause();
      v.style.display = "none";
    } else {
      v.style.display = "block";
      v.style.filter = perf === "LOW" ? "brightness(0.6)" : "none";
      v.play().catch(() => {});
    }
  }, [perf]);

  /* =====================================================
     VISIBILITY (PHANTOM SAFE)
  ===================================================== */
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        Object.values(musicRef.current).forEach(a => a.pause());
      } else if (audioReady) {
        playMusic(gameState);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [audioReady, gameState, playMusic]);

  /* =====================================================
     🎮 ACTIONS
  ===================================================== */
  const onSmash = () => {
    playSFX("SMASH");
    setGameState("ACTION");
    setStatus("💥 SMASH!");
    setTimeout(() => setGameState("IDLE"), 1200);
  };

  const onTense = () => {
    setGameState("TENSE");
    setStatus("😈 FINAL SECONDS...");
  };

  const onWin = () => {
    playSFX("WIN");
    setGameState("WIN");
    setStatus("🏆 YOU WIN!");
  };

  /* =====================================================
     UI
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

        {!audioReady && (
          <button
            onPointerDown={unlockMedia}
            className="mb-6 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl animate-pulse"
          >
            🔊 TAP TO ENABLE SOUND
          </button>
        )}

        {status && (
          <div className="mb-4 text-yellow-400 font-bold animate-pulse">
            {status}
          </div>
        )}

        <button
          onPointerDown={() => {
            if (!audioReady) unlockMedia();
            onSmash();
          }}
          className="px-10 py-4 bg-red-600 text-white font-black text-2xl rounded-xl mb-3"
        >
          👊 SMASH
        </button>

        <button
          onPointerDown={onTense}
          className="px-8 py-3 bg-purple-600 text-white rounded-xl mb-3"
        >
          😈 FINAL SECONDS
        </button>

        <button
          onPointerDown={onWin}
          className="px-8 py-3 bg-yellow-500 text-black rounded-xl"
        >
          🏆 WIN
        </button>
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
