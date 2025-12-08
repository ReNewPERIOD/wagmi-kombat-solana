"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/* =================== CONFIG =================== */
const PROGRAM_ID = new PublicKey("FB2JH7H2zKfsiXfx6YazryNYR3TziJrVM542pQbb6TTN");
const GAME_ADDRESS = new PublicKey("DQeCu4DA43CeMFmBghXqcFtz123tgRGruCxhvqcGoW1Y");

/* Single video v4 */
const VIDEO_BG = "/v4.mp4";

/* Assets unchanged */
const IMG_FIST = "https://img.upanh.moe/1fdsF7NQ/FIST2-removebg-webp.webp";
const IMG_HERO = "https://img.upanh.moe/HTQcpVQD/web3-removebg-webp.webp";
const AUDIO_BATTLE_THEME = "https://files.catbox.moe/ind1d6.mp3";

/* =================== CSS =================== */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&display=swap');

body{
  margin:0;
  background:#000;
  overflow:hidden;
}
.video-bg{
  position:absolute;
  top:0; left:0;
  width:100%; height:100%;
  object-fit:cover;
  z-index:0;
  filter:brightness(0.7);
}
.game-wrapper{
  position:relative;
  width:100vw; height:100vh;
  overflow:hidden;
}
.hero-layer{
  position:absolute;
  right:2%;
  bottom:20%;
  width:25%;
  max-width:300px;
  z-index:4;
  pointer-events:none;
  filter:drop-shadow(0 0 20px #00e5ff);
}
.fist-layer{
  position:absolute;
  right:18%;
  bottom:25%;
  width:45%;
  max-width:700px;
  z-index:6;
  pointer-events:none;
  filter:drop-shadow(0 0 15px #00e5ff);
}
.hud-overlay{
  position:absolute;
  width:100%;
  bottom:0;
  padding:20px 40px 30px;
  background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);
  z-index:20;
  display:flex;
  gap:20px;
}
.chart-hp-frame{
  width:100%;
  height:26px;
  border:2px solid red;
  background:rgba(40,0,0,0.5);
}
.chart-hp-fill{
  height:100%;
  background:red;
  transition:width .25s;
  box-shadow:0 0 20px red;
}
.combat-btn{
  width:100%;
  padding:18px;
  font-size:1.3rem;
  font-family:'Rajdhani'; font-weight:800;
  background:#0072ff;
  color:white;
  border:none;
  cursor:pointer;
  transition:.15s;
}
.combat-btn:active{ transform:scale(.96); }
.combat-btn:disabled{ background:#333; color:#999; }
.btn-loot{ background:gold; color:black; }

.extra-hud{
  position:fixed;
  top:70px; right:20px;
  width:260px;
  padding:14px;
  z-index:9999;
  background:rgba(0,0,0,0.6);
  border:1px solid #00e5ff;
  backdrop-filter:blur(4px);
  color:#00e5ff;
  font-family:'Rajdhani';
  text-transform:uppercase;
}
.music-btn{
  position:fixed;
  top:70px; left:20px;
  z-index:9999;
  background:rgba(0,0,0,0.6);
  border:1px solid #00e5ff;
  color:#00e5ff;
  padding:10px;
  border-radius:50%;
  cursor:pointer;
  font-size:.9rem;
}
`;
/* =================== MAIN COMPONENT =================== */
export default function Home() {
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();

  const [provider, setProvider] = useState(null);
  const [program, setProgram] = useState(null);
  const [game, setGame] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [armor, setArmor] = useState(100);
  const [isClient, setIsClient] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef(null);

  /* --------------------- INIT CLIENT --------------------- */
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const connection = new Connection("https://api.mainnet-beta.solana.com");

    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: "processed",
    });
    const program = new Program(idl, PROGRAM_ID, provider);

    setProvider(provider);
    setProgram(program);
  }, [wallet]);

  /* --------------------- MUSIC SETUP --------------------- */
  useEffect(() => {
    if (!isClient) return;
    if (!audioRef.current) return;

    audioRef.current.volume = 0.6;
    audioRef.current.loop = true;
    if (!isMuted) audioRef.current.play().catch(() => {});
  }, [isClient, isMuted]);

  const toggleSound = () => {
    setIsMuted((v) => !v);
    if (audioRef.current) {
      if (!isMuted) audioRef.current.pause();
      else audioRef.current.play().catch(() => {});
    }
  };

  /* --------------------- FETCH GAME STATE --------------------- */
  const fetchGameState = useCallback(async () => {
    if (!program) return;

    try {
      const acc = await program.account.gameData.fetch(GAME_ADDRESS.toString());
      setGame(acc);

      // Compute TTL
      const now = Math.floor(Date.now() / 1000);
      const expire = acc.lastFedTimestamp.toNumber() + acc.timeToLive;
      const left = expire - now;

      setTimeLeft(left > 0 ? left : 0);
      setArmor(left > 0 ? Math.min(100, (left / acc.timeToLive) * 100) : 0);
    } catch (e) {
      console.log("fetchGameState error:", e);
    }
  }, [program]);

  /* --------------------- SUBSCRIPTION --------------------- */
  useEffect(() => {
    if (!program) return;

    fetchGameState();

    const interval = setInterval(fetchGameState, 4000);
    return () => clearInterval(interval);
  }, [program, fetchGameState]);

  /* --------------------- ACTION: FEED --------------------- */
  const smash = async () => {
    if (!program || !provider) return alert("Wallet not connected.");

    try {
      await program.methods
        .feed()
        .accounts({
          gameAccount: GAME_ADDRESS,
          player: publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      fetchGameState();
    } catch (e) {
      console.error("Feed error:", e);
      alert("Feed failed.");
    }
  };

  /* --------------------- ACTION: CLAIM --------------------- */
  const claim = async () => {
    if (!program || !provider) return alert("Wallet not connected.");
    if (!game) return;

    try {
      await program.methods
        .claimReward()
        .accounts({
          gameAccount: GAME_ADDRESS,
          hunter: publicKey,
          winner: game.lastFeeder,
        })
        .rpc();

      fetchGameState();
      alert("Claim complete!");
    } catch (e) {
      console.error("Claim error:", e);
      alert("Claim failed.");
    }
  };

  /* --------------------- RENDER LOADING --------------------- */
  if (!isClient) return null;
  /* =================== RENDER =================== */

  return (
    <div className="relative w-full h-screen overflow-hidden">

      {/* BACKGROUND VIDEO */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/v4.mp4" type="video/mp4" />
      </video>

      {/* MUSIC */}
      <audio ref={audioRef} src="/music.mp3" />

      {/* TOP BAR */}
      <div className="absolute top-4 left-4 flex gap-4">
        <button
          onClick={toggleSound}
          className="px-4 py-2 bg-black/60 text-white rounded-lg border border-white/40"
        >
          {isMuted ? "🔇 Sound Off" : "🔊 Sound On"}
        </button>
      </div>

      {/* CENTER CONTENT */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">

        {/* ARMOR BAR */}
        <div className="w-[300px] h-[20px] bg-black/50 rounded-full border border-white/40 overflow-hidden mb-4">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${armor}%` }}
          ></div>
        </div>

        {/* TIME LEFT */}
        <div className="text-3xl font-bold mb-6 drop-shadow-lg">
          {timeLeft > 0 ? (
            <>⏳ {timeLeft}s Until Doom</>
          ) : (
            <>💀 GAME OVER — CLAIM NOW!</>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col items-center gap-4">

          {/* SMASH */}
          <button
            onClick={smash}
            className="px-8 py-4 text-3xl bg-red-600 hover:bg-red-700 shadow-xl border border-white/40 rounded-xl"
          >
            🔥 FEED / SMASH
          </button>

          {/* CLAIM */}
          <button
            onClick={claim}
            className="px-8 py-3 text-2xl bg-yellow-500 hover:bg-yellow-600 shadow-xl border border-white/40 rounded-xl"
          >
            🏆 CLAIM REWARD
          </button>
        </div>

        {/* LAST FEEDER */}
        {game && (
          <div className="mt-6 text-lg opacity-90">
            Last feeder:
            <br />
            {game.lastFeeder.toString().slice(0, 4)}...
            {game.lastFeeder.toString().slice(-4)}
          </div>
        )}
      </div>
    </div>
  );
}

