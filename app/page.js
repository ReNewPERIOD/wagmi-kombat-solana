"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";

// --- IMPORT VÍ ---
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets"; 
import { useAnchorWallet, useWallet, ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/* =================== CẤU HÌNH =================== */
const PROGRAM_ID = new PublicKey("CrwC7ekPmUmmuQPutMzBXqQ4MTydjw1EVS2Zs3wpk9fc");
// ĐỊA CHỈ GAME (Lấy từ client.ts mới nhất)
const GAME_ADDRESS = new PublicKey("5QpRbTGvAMq6EbYFjUhK7YH9SKBEGvRrW3KHjwtrK711");

/* Assets */
const VIDEO_BG = "/v4.mp4"; 
const AUDIO_BATTLE_THEME = "https://files.catbox.moe/ind1d6.mp3";

const IMG_HERO = "https://img.upanh.moe/HTQcpVQD/web3-removebg-webp.webp";
const IMG_FIST = "https://img.upanh.moe/1fdsF7NQ/FIST2-removebg-webp.webp";

/* =================== CSS =================== */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&display=swap');
  
  @keyframes shake {
    0% { transform: translate(0, 0); }
    25% { transform: translate(-5px, 5px); }
    75% { transform: translate(5px, -5px); }
    100% { transform: translate(0, 0); }
  }
  .animate-shake { animation: shake 0.2s ease-in-out; }
  
  @keyframes punch-loop {
    0% { transform: translateX(0) scale(1); }
    20% { transform: translateX(30px) scale(0.9); } 
    40% { transform: translateX(-180px) scale(1.1); } 
    100% { transform: translateX(0) scale(1); }
  }

  .bg-video { 
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
    object-fit: cover; filter: brightness(0.6); z-index: 0;
  }

  /* Layer nhân vật */
  .hero-layer { 
    position: absolute; right: 5%; bottom: 10%; width: 25%; max-width: 250px; 
    z-index: 10; pointer-events: none; filter: drop-shadow(0 0 20px #00e5ff); 
  }
  
  /* Nắm đấm */
  .fist-layer { 
    position: absolute; right: 20%; bottom: 15%; width: 40%; max-width: 600px; 
    z-index: 20; pointer-events: none; filter: drop-shadow(0 0 15px #00e5ff);
    animation: punch-loop 0.8s infinite ease-in-out !important; 
  }

  /* Responsive Mobile */
  @media (max-width: 768px) {
    .hero-layer { width: 35%; bottom: 15%; right: -5%; }
    .fist-layer { width: 60%; bottom: 25%; right: 10%; }
    .bg-video { object-position: 65% center; }
  }

  .btn-glow { animation: glow 2s infinite; }
  @keyframes glow {
    0% { box-shadow: 0 0 5px #00e5ff; }
    50% { box-shadow: 0 0 20px #00e5ff, 0 0 40px #00e5ff; }
    100% { box-shadow: 0 0 5px #00e5ff; }
  }
`;

const shortenAddress = (address) => {
  if (!address) return "WAITING...";
  const str = address.toString();
  return str.slice(0, 4) + ".." + str.slice(-4);
};

/* =================== MAIN COMPONENT =================== */
function GameContent() {
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();

  const [game, setGame] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [armor, setArmor] = useState(100);
  const [isClient, setIsClient] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [topHitters, setTopHitters] = useState([
      { address: 'Wait...', hits: 0 }
  ]);

  const audioRef = useRef(null);

  /* --------------------- INIT --------------------- */
  const program = useMemo(() => {
    if (!wallet) return null;
    const connection = new Connection(clusterApiUrl("devnet"), "processed");
    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: "processed",
    });
    return new Program(idl, PROGRAM_ID, provider);
  }, [wallet]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  /* --------------------- AUDIO --------------------- */
  useEffect(() => {
    if (!isClient) return;
    audioRef.current = new Audio(AUDIO_BATTLE_THEME);
    audioRef.current.volume = 0.6;
    audioRef.current.loop = true;
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => console.log("Autoplay blocked"));
    }
  }, [isClient]);

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsMuted(false);
    } else {
      audioRef.current.pause();
      setIsMuted(true);
    }
  };

  /* --------------------- FETCH DATA --------------------- */
  const fetchGameState = useCallback(async () => {
    if (!program) return;

    try {
      const acc = await program.account.gameData.fetch(GAME_ADDRESS);
      const balance = await program.provider.connection.getBalance(GAME_ADDRESS);
      
      // Update Game State + Balance
      setGame({ ...acc, balance });

      const ttl = acc.timeToLive.toNumber();
      const lastFed = acc.lastFedTimestamp.toNumber();
      
      // Logic First Blood
      if (lastFed === 0) {
         setTimeLeft(ttl);
         setArmor(100);
      } else {
         const now = Math.floor(Date.now() / 1000);
         const left = Math.max(0, (lastFed + ttl) - now);
         setTimeLeft(left);
         setArmor(left > 0 ? Math.min(100, (left / ttl) * 100) : 0);
      }

      setTopHitters([
          { address: 'Ff3r...1a2b', hits: 15 },
          { address: 'Aa2d...4e5f', hits: 12 },
          { address: 'Cc9t...7y8z', hits: 8 }
      ]);

    } catch (e) {
      console.log("Fetch error:", e);
    }
  }, [program]);

  useEffect(() => {
    if (!program) return;
    fetchGameState();
    const interval = setInterval(() => {
        fetchGameState();
        if (game && game.lastFedTimestamp.toNumber() !== 0) {
             setTimeLeft((prev) => Math.max(0, prev - 1));
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [program, fetchGameState]);

  /* --------------------- LOGIC & ACTIONS --------------------- */
  const isWaiting = game && game.lastFedTimestamp.toNumber() === 0;
  const isDead = timeLeft === 0 && !isWaiting;

  const smash = async () => {
    if (!program || !publicKey || isProcessing) return;
    setIsProcessing(true);

    try {
      if(audioRef.current && audioRef.current.paused && !isMuted) audioRef.current.play();
      
      setIsHit(true); 
      setTimeout(() => setIsHit(false), 200);

      await program.methods.feed().accounts({
          gameAccount: GAME_ADDRESS,
          player: publicKey,
          systemProgram: web3.SystemProgram.programId,
        }).rpc();

      setTimeout(fetchGameState, 1000);
    } catch (e) {
      console.error("Feed error:", e);
      alert("Action Failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const claim = async () => {
    if (!program || !publicKey || !game || isProcessing) return;
    if (timeLeft > 0) return alert("Wait for timer to hit 0s!");

    setIsProcessing(true);
    try {
      await program.methods.claimReward().accounts({
          gameAccount: GAME_ADDRESS,
          hunter: publicKey,
          winner: game.lastFeeder,
        }).rpc();

      alert("🏆 Claim complete! Game Resetting...");
      setTimeout(fetchGameState, 2000);
    } catch (e) {
      console.error("Claim error:", e);
      if (e.message && e.message.includes("GameIsAlive")) {
          alert("⚠️ Syncing... Please wait 3s!");
      } else {
          alert("Claim failed: " + e.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isClient) return null;

  /* =================== GIAO DIỆN (UI) MỚI =================== */
  return (
    <div className={`relative w-full h-screen overflow-hidden ${isHit ? 'animate-shake' : ''}`}>
      <style>{styles}</style>

      {/* BACKGROUND VIDEO */}
      <video className="bg-video" autoPlay loop muted playsInline>
          <source src={VIDEO_BG} type="video/mp4" />
      </video>

      {/* LAYERS (Hero & Fist) */}
      {!isDead && <img src={IMG_HERO} className="hero-layer" alt="Hero" />}
      {(!isDead && !isWaiting) && <img src={IMG_FIST} className="fist-layer" alt="Fist" />}

      {/* --- TOP BAR --- */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-50">
        
        {/* Nút Sound (Góc trái) */}
        <button
          onClick={toggleSound}
          className="px-4 py-2 bg-black/60 text-[#00e5ff] rounded-lg border border-[#00e5ff] font-['Rajdhani'] font-bold hover:bg-black/80 backdrop-blur-md"
        >
          {isMuted || (audioRef.current && audioRef.current.paused) ? "🔇 OFF" : "🔊 ON"}
        </button>

        {/* CỘT PHẢI: Ví + HUB THÔNG TIN (Gom nhóm lại ở đây) */}
        <div className="flex flex-col items-end gap-2">
            {/* Nút Ví */}
            <WalletMultiButton style={{ backgroundColor: "#0072ff", fontFamily: "Rajdhani", fontWeight: "bold" }} />

            {/* --- HUB THÔNG TIN (Ngay dưới ví) --- */}
            {/* 1. Total Loot */}
            <div className="w-[200px] p-2 bg-black/70 border border-[#00e5ff] text-[#00e5ff] font-['Rajdhani'] rounded backdrop-blur-md flex justify-between items-center">
                <span className="text-xs text-gray-400">POOL</span>
                <span className="text-lg font-bold text-yellow-400">
                  {game?.balance ? (game.balance / 1000000000).toFixed(4) : "0.0000"} SOL
                </span>
            </div>

            {/* 2. Last Hitter */}
            {game && (
              <div className="w-[200px] p-2 bg-black/70 border border-[#00e5ff] text-[#00e5ff] font-['Rajdhani'] rounded backdrop-blur-md flex justify-between items-center">
                <span className="text-xs text-gray-400">LAST HIT</span>
                <span className="text-sm font-bold truncate ml-2">
                  {shortenAddress(game.lastFeeder)}
                </span>
              </div>
            )}

            {/* 3. Top Hitters */}
            <div className="w-[200px] p-3 bg-black/80 border border-red-500 text-white font-['Rajdhani'] rounded backdrop-blur-md">
                <p className="text-xs text-red-400 border-b border-red-500/30 mb-2 pb-1">TOP DAMAGES</p>
                {topHitters.map((h, i) => (
                    <div key={i} className="flex justify-between text-xs mb-1">
                        <span>{i+1}. {h.address}</span>
                        <span className="text-yellow-400">{h.hits}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* --- BOTTOM CENTER (THANH MÁU + NÚT BẤM) --- */}
      <div className="absolute bottom-[10%] left-0 right-0 flex flex-col items-center justify-end z-30 pointer-events-none pb-4">
        
        {/* Thanh Máu */}
        <div className="w-[90%] max-w-[500px] h-[35px] bg-black/60 rounded-none border-2 border-red-600 overflow-hidden mb-2 relative skew-x-[-10deg] shadow-[0_0_15px_rgba(255,0,0,0.5)]">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-300"
            style={{ width: `${armor}%` }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold font-['Rajdhani'] tracking-widest text-white drop-shadow-md">
              BOSS HP {armor.toFixed(0)}%
          </div>
        </div>

        {/* Đồng Hồ */}
        <div className="text-3xl md:text-4xl font-['Rajdhani'] font-black mb-6 text-[#00e5ff] drop-shadow-[0_0_10px_#00e5ff]">
          {isWaiting ? (
             <span className="text-green-400 animate-pulse">WAITING...</span>
          ) : timeLeft > 0 ? (
             <>⏳ {timeLeft}s</>
          ) : (
             <span className="text-yellow-400 animate-pulse">💀 FINISH HIM!</span>
          )}
        </div>

        {/* Nút Hành Động (Pointer events auto để bấm được) */}
        <div className="pointer-events-auto">
          {isDead ? (
             <button
                onClick={claim}
                disabled={isProcessing}
                className="px-10 py-5 bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-['Press_Start_2P'] text-sm hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,215,0,0.8)] border-4 border-white rounded-xl disabled:opacity-50"
              >
                {isProcessing ? "PROCESSING..." : "🏆 CLAIM BOUNTY"}
              </button>
          ) : (
             <button
                onClick={smash}
                disabled={isProcessing}
                className={`group relative px-12 py-5 text-white font-['Rajdhani'] font-black text-3xl uppercase tracking-wider clip-path-polygon hover:scale-105 transition-transform active:scale-95 shadow-[0_0_30px_rgba(0,114,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed ${isWaiting ? 'bg-green-600 btn-glow' : 'bg-gradient-to-r from-blue-600 to-blue-800'}`}
                style={{ clipPath: "polygon(10% 0, 100% 0, 100% 80%, 90% 100%, 0 100%, 0 20%)" }}
              >
                {isProcessing ? "..." : (isWaiting ? "🚀 START" : "👊 SMASH")}
              </button>
          )}
        </div>
        
        {/* Fee Info */}
        {!isDead && <p className="text-gray-400 text-xs mt-2 font-['Rajdhani']">Fee: 0.005 SOL / HIT</p>}

      </div>

    </div>
  );
}

// Wrapper Provider
export default function Home() {
  const endpoint = clusterApiUrl("devnet");
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <GameContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}