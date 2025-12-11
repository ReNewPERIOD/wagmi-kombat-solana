"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import confetti from "canvas-confetti"; // Hiệu ứng nổ vàng

// IMPORT VÍ
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets"; 
import { useAnchorWallet, useWallet, ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/* =================== CẤU HÌNH =================== */
const PROGRAM_ID = new PublicKey("CrwC7ekPmUmmuQPutMzBXqQ4MTydjw1EVS2Zs3wpk9fc");
const GAME_ADDRESS = new PublicKey("AeMy2SpyKG2fyEESiEsWRtj6JsRUrXQrC4MwjZj2AnR4");

/* Assets */
const VIDEO_BG = "/v4.mp4"; 
const VIDEO_POSTER = "/poster.jpg"; 
const AUDIO_BATTLE_THEME = "https://files.catbox.moe/ind1d6.mp3";

const IMG_HERO = "https://img.upanh.moe/HTQcpVQD/web3-removebg-webp.webp";
const IMG_FIST = "https://img.upanh.moe/1fdsF7NQ/FIST2-removebg-webp.webp";

/* =================== CSS (FIXED ANIMATION & MARQUEE) =================== */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&display=swap');
  
  * { box-sizing: border-box; }
  html, body { 
    margin: 0; padding: 0; width: 100%; height: 100%; 
    overflow: hidden; background: #000; touch-action: none;
  }

  /* Rung màn hình */
  @keyframes shake {
    0% { transform: translate(0, 0); }
    25% { transform: translate(-5px, 5px); }
    75% { transform: translate(5px, -5px); }
    100% { transform: translate(0, 0); }
  }
  .animate-shake { animation: shake 0.2s ease-in-out; }
  
  /* --- CÚ ĐẤM 3D (REALISTIC PUNCH) --- */
  /* Xuất phát từ vị trí Hero (nhỏ) -> Phóng to ra giữa (lớn) -> Thu về */
  @keyframes punch-3d {
    0% { 
      transform: translate(0, 0) scale(0.5); /* Bắt đầu nhỏ tại chỗ */
      opacity: 0.8;
    }
    10% { opacity: 1; }
    50% { 
      transform: translate(-30vw, -10vh) scale(1.8); /* Đấm ra xa & Phóng to cực đại */
    }
    100% { 
      transform: translate(0, 0) scale(0.5); /* Thu về nhỏ lại */
      opacity: 0.8;
    }
  }

  /* --- CHỮ CHẠY (MARQUEE) --- */
  @keyframes marquee {
    0% { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
  .marquee-container {
    position: absolute; top: 70px; left: 0; width: 100%; height: 30px;
    background: rgba(255, 215, 0, 0.2); /* Nền vàng mờ */
    border-top: 1px solid rgba(255, 215, 0, 0.5);
    border-bottom: 1px solid rgba(255, 215, 0, 0.5);
    display: flex; align-items: center; overflow: hidden; z-index: 40;
    pointer-events: none;
  }
  .marquee-text {
    white-space: nowrap;
    font-family: 'Press Start 2P'; font-size: 10px; color: #FFD700;
    text-shadow: 0 0 5px #000;
    animation: marquee 15s linear infinite;
    padding-left: 100%; /* Bắt đầu từ ngoài màn hình */
  }

  .bg-video { 
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
    object-fit: cover; z-index: 0;
    filter: brightness(0.9); background: #000;
  }

  .hero-layer { 
    position: absolute; right: 5%; bottom: 15%; width: 25%; max-width: 250px; 
    z-index: 10; pointer-events: none; filter: drop-shadow(0 0 20px #00e5ff); 
  }
  
  /* Cấu hình lại vị trí nắm đấm để khớp với Hero */
  .fist-layer { 
    position: absolute; right: 5%; bottom: 20%; /* Đặt gốc trùng với Hero */
    width: 40%; max-width: 600px; 
    z-index: 20; pointer-events: none; 
    filter: drop-shadow(0 0 15px #00e5ff);
    transform-origin: bottom right; /* Phóng to từ góc dưới phải */
    animation: punch-3d 0.6s infinite ease-in-out !important; /* Tốc độ đấm nhanh hơn xíu */
  }

  @media (max-width: 768px) {
    .hero-layer { width: 35%; bottom: 12%; right: -5%; }
    .fist-layer { width: 60%; bottom: 18%; right: -5%; }
    .bg-video { object-position: center center; } 
    .marquee-text { font-size: 9px; animation-duration: 10s; }
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
  const [statusMsg, setStatusMsg] = useState("");

  const [topHitters, setTopHitters] = useState([{ address: 'Wait...', hits: 0 }]);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const program = useMemo(() => {
    if (!wallet) return null;
    const connection = new Connection(clusterApiUrl("devnet"), "processed");
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    return new Program(idl, PROGRAM_ID, provider);
  }, [wallet]);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient) return;
    audioRef.current = new Audio(AUDIO_BATTLE_THEME);
    audioRef.current.volume = 0.6;
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {}); 

    if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(e => console.log("Video autoplay blocked:", e));
    }
  }, [isClient]);

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setIsMuted(false); } 
    else { audioRef.current.pause(); setIsMuted(true); }
  };

  /* --- HIỆU ỨNG VÀNG BAY (X10 SỨC MẠNH) --- */
  const triggerGoldExplosion = () => {
    const duration = 5000; // Nổ trong 5 giây
    const end = Date.now() + duration;

    // Hàm bắn pháo hoa liên tục
    (function frame() {
      // Bắn từ trái sang
      confetti({
        particleCount: 10, // Tăng số lượng hạt mỗi lần bắn
        angle: 60,
        spread: 80, // Tán rộng hơn
        origin: { x: 0, y: 0.6 },
        colors: ['#FFD700', '#FDB931', '#FFFF00'], // Màu vàng kim các loại
        scalar: 1.5, // Hạt to gấp 1.5 lần
        shapes: ['circle', 'square'], // Đa dạng hình
      });
      
      // Bắn từ phải sang
      confetti({
        particleCount: 10,
        angle: 120,
        spread: 80,
        origin: { x: 1, y: 0.6 },
        colors: ['#FFD700', '#FDB931', '#FFFFFF'],
        scalar: 1.5,
        shapes: ['circle', 'square'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const fetchGameState = useCallback(async () => {
    if (!program) return;
    try {
      const acc = await program.account.gameData.fetch(GAME_ADDRESS);
      const balance = await program.provider.connection.getBalance(GAME_ADDRESS);
      setGame({ ...acc, balance });

      const ttl = acc.timeToLive.toNumber();
      const lastFed = acc.lastFedTimestamp.toNumber();
      
      if (lastFed === 0) {
         setTimeLeft(ttl); setArmor(100);
      } else {
         const now = Math.floor(Date.now() / 1000);
         const left = Math.max(0, (lastFed + ttl) - now);
         setTimeLeft(left);
         setArmor(left > 0 ? Math.min(100, (left / ttl) * 100) : 0);
      }
      setTopHitters([{ address: 'Ff3r...1a2b', hits: 15 }, { address: 'Aa2d...4e5f', hits: 12 }, { address: 'Cc9t...7y8z', hits: 8 }]);
    } catch (e) { console.log("Fetch error:", e); }
  }, [program]);

  useEffect(() => {
    if (!program) return;
    fetchGameState();
    const interval = setInterval(() => {
        fetchGameState();
        if (game && game.lastFedTimestamp.toNumber() !== 0) {
             setTimeLeft((prev) => Math.max(0, prev - 1));
        }
    }, 2000);
    return () => clearInterval(interval);
  }, [program, fetchGameState]);

  const isWaiting = game && game.lastFedTimestamp.toNumber() === 0;
  const isDead = timeLeft === 0 && !isWaiting;

  // --- SMASH ---
  const smash = async () => {
    if (!program || !publicKey || isProcessing) return;
    setIsProcessing(true);
    setStatusMsg("ATTACKING...");
    try {
      if(audioRef.current && audioRef.current.paused && !isMuted) audioRef.current.play();
      setIsHit(true); setTimeout(() => setIsHit(false), 200);
      await program.methods.feed().accounts({
          gameAccount: GAME_ADDRESS, player: publicKey, systemProgram: web3.SystemProgram.programId,
      }).rpc();
      setStatusMsg("HIT CONFIRMED!");
      setTimeout(() => setStatusMsg(""), 2000);
      setTimeout(fetchGameState, 1000);
    } catch (e) {
      console.error(e);
      alert("Failed: " + e.message);
      setStatusMsg("");
    } finally { setIsProcessing(false); }
  };

  // --- CLAIM (X10 GOLD EFFECT) ---
  const claim = async () => {
    if (!program || !publicKey || !game || isProcessing) return;
    if (timeLeft > 0) return alert(`Wait! Game ends in ${timeLeft}s`);

    setIsProcessing(true);
    setStatusMsg("CLAIMING...");

    try {
      await program.methods.claimReward().accounts({
          gameAccount: GAME_ADDRESS, hunter: publicKey, winner: game.lastFeeder,
      }).rpc();
      
      triggerGoldExplosion(); // Kích hoạt hiệu ứng vàng x10

      const isWinner = publicKey.toString() === game.lastFeeder.toString();
      if (isWinner) {
          alert(`🏆 CHAMPION! BẠN ĐÃ CHIẾN THẮNG & NHẬN THƯỞNG!`);
      } else {
          alert(`⚡ BÀN TAY VÀNG! BẠN ĐÃ CƯỚP ĐƯỢC 2% GIẢI THƯỞNG!`);
      }
      
      setStatusMsg("GAME RESETTING...");
      setTimeout(fetchGameState, 2000);
      
    } catch (e) {
      console.error("Claim Error:", e);
      if (e.message && e.message.includes("GameIsAlive")) {
          setStatusMsg("Syncing... Retrying...");
          setTimeout(async () => {
             try {
                await program.methods.claimReward().accounts({
                    gameAccount: GAME_ADDRESS, hunter: publicKey, winner: game.lastFeeder,
                }).rpc();
                triggerGoldExplosion();
                alert("🏆 SUCCESS! Bounty Claimed!");
                setTimeout(fetchGameState, 2000);
             } catch (retryErr) { alert("⚠️ Syncing. Click again!"); } 
             finally { setIsProcessing(false); setStatusMsg(""); }
          }, 2500);
          return;
      } 
      alert("Error: " + e.message);
      setIsProcessing(false);
      setStatusMsg("");
    }
    if (!isProcessing) setIsProcessing(false);
  };

  if (!isClient) return null;

  return (
    <div className={`relative w-full h-screen overflow-hidden ${isHit ? 'animate-shake' : ''}`}>
      <style>{styles}</style>
      
      <video ref={videoRef} className="bg-video" poster={VIDEO_POSTER} autoPlay loop muted playsInline preload="auto">
          <source src={VIDEO_BG} type="video/mp4" />
      </video>

      {/* DÒNG CHỮ CHẠY (MARQUEE) */}
      <div className="marquee-container">
          <div className="marquee-text">
              📢 ALL PLAYERS PARTICIPATING IN WAGMI KOMBAT WILL RECEIVE 2000 $KOMBAT TOKENS AIRDROP AFTER 1 WEEK! 🚀 PLAY NOW TO EARN! 💎
          </div>
      </div>

      {!isDead && <img src={IMG_HERO} className="hero-layer" alt="Hero" />}
      
      {/* NẮM ĐẤM 3D: Chỉ hiện khi đánh đấm */}
      {(!isDead && !isWaiting) && <img src={IMG_FIST} className="fist-layer" alt="Fist" />}

      {/* TOP BAR */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-50 pointer-events-auto">
        <button onClick={toggleSound} className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 bg-black/60 text-[#00e5ff] rounded-full md:rounded-lg border border-[#00e5ff] font-['Rajdhani'] font-bold flex items-center justify-center backdrop-blur-md">
          {isMuted || (audioRef.current && audioRef.current.paused) ? "🔇" : "🔊"}
        </button>

        <div className="flex flex-col items-end gap-1 md:gap-2">
            <WalletMultiButton style={{ backgroundColor: "#0072ff", fontFamily: "Rajdhani", fontWeight: "bold", fontSize: "12px", height: "32px", padding: "0 12px" }} />
            
            <div className="w-[140px] md:w-[200px] p-1.5 md:p-2 bg-black/70 border border-[#00e5ff] text-[#00e5ff] font-['Rajdhani'] rounded backdrop-blur-md flex justify-between items-center text-[10px] md:text-sm">
                <span className="text-gray-400">POOL</span>
                <span className="font-bold text-yellow-400">{game?.balance ? (game.balance / 1000000000).toFixed(3) : "0.0"} SOL</span>
            </div>
            {game && (
              <div className="w-[140px] md:w-[200px] p-1.5 md:p-2 bg-black/70 border border-[#00e5ff] text-[#00e5ff] font-['Rajdhani'] rounded backdrop-blur-md flex justify-between items-center text-[10px] md:text-sm">
                <span className="text-gray-400">HIT</span>
                <span className="font-bold truncate max-w-[80px]">{shortenAddress(game.lastFeeder)}</span>
              </div>
            )}
            <div className="w-[140px] md:w-[200px] p-2 bg-black/80 border border-red-500 text-white font-['Rajdhani'] rounded backdrop-blur-md text-[10px] md:text-xs">
                <p className="text-red-400 border-b border-red-500/30 mb-1 pb-1">TOP HITTERS</p>
                {topHitters.map((h, i) => (
                    <div key={i} className="flex justify-between mb-0.5">
                        <span>{i+1}. {shortenAddress(h.address)}</span>
                        <span className="text-yellow-400">{h.hits}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="absolute bottom-[5%] left-0 right-0 flex flex-col items-center justify-end z-30 pointer-events-none pb-2">
        {statusMsg && <div className="mb-2 text-yellow-400 font-bold font-['Rajdhani'] animate-pulse bg-black/80 border border-yellow-400 px-4 py-1 rounded-full text-sm shadow-[0_0_10px_gold]">{statusMsg}</div>}

        <div className="w-[85%] max-w-[500px] h-[25px] md:h-[35px] bg-black/60 border-2 border-red-600 overflow-hidden mb-2 relative skew-x-[-10deg]">
          <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-300" style={{ width: `${armor}%` }}></div>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] md:text-sm font-bold font-['Rajdhani'] tracking-widest text-white drop-shadow-md">
              BOSS HP {armor.toFixed(0)}%
          </div>
        </div>

        <div className="text-2xl md:text-4xl font-['Rajdhani'] font-black mb-4 text-[#00e5ff] drop-shadow-[0_0_10px_#00e5ff]">
          {isWaiting ? <span className="text-green-400 animate-pulse">WAITING...</span> : timeLeft > 0 ? <>⏳ {timeLeft}s</> : <span className="text-yellow-400 animate-pulse">💀 FINISH HIM!</span>}
        </div>

        <div className="pointer-events-auto">
          {isDead ? (
             <button onClick={claim} disabled={isProcessing} className="px-8 py-3 md:px-10 md:py-5 bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-['Press_Start_2P'] text-xs md:text-sm hover:scale-105 transition-transform border-2 md:border-4 border-white rounded-xl disabled:opacity-50">
                {isProcessing ? "PROCESSING..." : "🏆 CLAIM BOUNTY"}
              </button>
          ) : (
             <button onClick={smash} disabled={isProcessing} className={`group relative px-10 py-4 md:px-12 md:py-5 text-white font-['Rajdhani'] font-black text-2xl md:text-3xl uppercase tracking-wider clip-path-polygon hover:scale-105 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isWaiting ? 'bg-green-600 btn-glow' : 'bg-gradient-to-r from-blue-600 to-blue-800'}`} style={{ clipPath: "polygon(10% 0, 100% 0, 100% 80%, 90% 100%, 0 100%, 0 20%)" }}>
                {isProcessing ? "..." : (isWaiting ? "🚀 START" : "👊 SMASH")}
              </button>
          )}
        </div>
        {!isDead && <p className="text-gray-400 text-[10px] mt-2 font-['Rajdhani']">Fee: 0.005 SOL</p>}
      </div>
    </div>
  );
}

export default function Home() {
  const endpoint = clusterApiUrl("devnet");
  const wallets = [new PhantomWalletAdapter()];
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider><GameContent /></WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}