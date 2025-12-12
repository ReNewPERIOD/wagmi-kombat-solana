"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import confetti from "canvas-confetti"; // Giữ lại hiệu ứng vàng

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

/* =================== CSS (PRO & ROBUST) =================== */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&display=swap');
  
  * { box-sizing: border-box; }
  html, body { 
    margin: 0; padding: 0; width: 100%; height: 100%; 
    overflow: hidden; background: #000; touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }

  @keyframes shake {
    0% { transform: translate(0, 0); }
    25% { transform: translate(-5px, 5px); }
    75% { transform: translate(5px, -5px); }
    100% { transform: translate(0, 0); }
  }
  .shake-active { animation: shake 0.2s ease-in-out; }
  
  @keyframes punch-mid {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-30vw, -20vh) scale(1.3); }
    100% { transform: translate(0, 0) scale(1); }
  }

  @keyframes marquee {
    0% { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
  
  .marquee-container {
    position: absolute; top: 70px; left: 0; width: 100%; height: 30px;
    background: rgba(0, 0, 0, 0.6);
    border-top: 1px solid #FFD700; border-bottom: 1px solid #FFD700;
    display: flex; align-items: center; overflow: hidden; z-index: 40; pointer-events: none;
  }
  .marquee-text {
    white-space: nowrap; font-family: 'Press Start 2P'; font-size: 10px; color: #39ff14; 
    text-shadow: 0 0 5px #000; animation: marquee 30s linear infinite; padding-left: 100%; 
  }

  /* --- PRO BACKGROUND SYSTEM --- */
  .bg-container {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: -1;
    /* Lớp bảo vệ cuối cùng: Set ảnh nền trực tiếp cho Div */
    background-image: url('${VIDEO_POSTER}');
    background-position: center;
    background-size: cover;
    background-color: #111; /* Màu tối nếu ảnh chưa load */
  }

  .bg-video { 
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    object-fit: cover; 
    opacity: 0; /* Mặc định ẩn */
    transition: opacity 1s ease-in-out; /* Hiện ra mượt mà */
  }
  
  /* Class này sẽ được thêm vào khi video đã sẵn sàng */
  .bg-video.ready {
    opacity: 1;
  }

  /* LAYERS GAME */
  .game-layer { position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: 5;}

  .hero-layer { 
    position: absolute; right: 5%; bottom: 15%; width: 25%; max-width: 250px; 
    z-index: 10; filter: drop-shadow(0 0 20px #00e5ff); 
  }
  .fist-layer { 
    position: absolute; right: 8%; bottom: 18%; width: 25%; max-width: 350px; 
    z-index: 20; filter: drop-shadow(0 0 10px #00e5ff);
    transform-origin: bottom right; animation: punch-mid 1.2s infinite ease-in-out !important; 
  }

  /* MODAL */
  .winner-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.9); z-index: 99999; 
    display: flex; justify-content: center; align-items: center;
  }
  .winner-box {
    background: #111; border: 2px solid #FFD700; border-radius: 15px;
    padding: 20px; text-align: center; width: 85%;
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
  }

  @media (max-width: 768px) {
    .hero-layer { width: 35%; bottom: 12%; right: -5%; }
    .fist-layer { width: 45%; bottom: 15%; right: 0%; } 
    .bg-video { object-position: center center; } 
    .marquee-text { font-size: 9px; animation-duration: 25s; } 
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
  
  // State kiểm soát video
  const [videoReady, setVideoReady] = useState(false);
  
  const [winnerModal, setWinnerModal] = useState({ show: false, title: "", msg: "" });
  const [topHitters, setTopHitters] = useState([{ address: 'Wait...', hits: 0 }]);
  
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const program = useMemo(() => {
    if (!wallet) return null;
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const provider = new AnchorProvider(connection, wallet, { 
        preflightCommitment: "confirmed", commitment: "confirmed"
    });
    return new Program(idl, PROGRAM_ID, provider);
  }, [wallet]);

  useEffect(() => { setIsClient(true); }, []);

  // --- AUDIO SETUP ---
  useEffect(() => {
    if (!isClient) return;
    audioRef.current = new Audio(AUDIO_BATTLE_THEME);
    audioRef.current.volume = 0.6;
    audioRef.current.loop = true;

    const enableAudio = () => {
        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().then(() => setIsMuted(false)).catch(() => {});
        }
        window.removeEventListener('click', enableAudio);
        window.removeEventListener('touchstart', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('touchstart', enableAudio);
    return () => {
        window.removeEventListener('click', enableAudio);
        window.removeEventListener('touchstart', enableAudio);
    };
  }, [isClient]);

  // --- VIDEO SETUP (PRO) ---
  useEffect(() => {
    if (!isClient || !videoRef.current) return;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;
    videoRef.current.setAttribute('playsinline', 'true');
    
    // Cố gắng play
    const p = videoRef.current.play();
    if (p !== undefined) {
        p.catch(error => {
            console.log("Video Play Error:", error);
            // Nếu lỗi, videoReady vẫn là false -> Vẫn hiện ảnh nền
        });
    }
  }, [isClient]);

  const handleVideoLoaded = () => {
      console.log("Video loaded data!");
      setVideoReady(true); // Kích hoạt fade-in
  };

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setIsMuted(false); } 
    else { audioRef.current.pause(); setIsMuted(true); }
  };

  /* --- HIỆU ỨNG VÀNG (SAFE MODE) --- */
  const triggerGoldExplosion = () => {
    try {
        const count = 200;
        const defaults = { origin: { y: 0.6 }, zIndex: 99999 };
        function fire(particleRatio, opts) {
          confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
        }
        fire(0.25, { spread: 26, startVelocity: 55, colors: ['#FFD700', '#FFF'] });
        fire(0.2, { spread: 60, colors: ['#FFD700', '#FFF'] });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#FFD700', '#FFF'] });
    } catch (e) {}
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

  // --- ACTIONS ---
  const smash = async () => {
    if (!program || !publicKey || isProcessing) return;
    setIsProcessing(true);
    setStatusMsg("CONFIRM WALLET...");

    try {
      await program.methods.feed().accounts({
          gameAccount: GAME_ADDRESS, player: publicKey, systemProgram: web3.SystemProgram.programId,
      }).rpc();
      
      if(audioRef.current && !isMuted) audioRef.current.play().catch(()=>{});
      
      // Force video nếu chưa chạy
      if(videoRef.current && videoRef.current.paused) videoRef.current.play().catch(()=>{});

      setIsHit(true); 
      setTimeout(() => setIsHit(false), 300);

      setStatusMsg("HIT CONFIRMED!");
      setTimeout(() => setStatusMsg(""), 2000);
      setTimeout(fetchGameState, 1000);

    } catch (e) {
      console.error(e);
      alert("Failed: " + e.message);
      setStatusMsg("");
    } finally { setIsProcessing(false); }
  };

  const claim = async () => {
    if (!program || !publicKey || !game || isProcessing) return;
    if (timeLeft > 0) return alert(`Wait! Game ends in ${timeLeft}s`);

    setIsProcessing(true);
    setStatusMsg("CLAIMING...");

    try {
      await program.methods.claimReward().accounts({
          gameAccount: GAME_ADDRESS, hunter: publicKey, winner: game.lastFeeder,
      }).rpc();
      
      triggerGoldExplosion();

      setTimeout(() => {
          const isWinner = publicKey.toString() === game.lastFeeder.toString();
          setWinnerModal({
              show: true,
              title: isWinner ? "🏆 CHAMPION! 🏆" : "⚡ FAST HANDS! ⚡",
              msg: isWinner ? "CONGRATULATIONS! YOU HAVE WON THE BATTLE!" : "NICE SNIPE! YOU GRABBED THE BOUNTY!"
          });
      }, 1000);
      
      setStatusMsg("RESETTING...");
      setTimeout(fetchGameState, 3000);
      
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
                setTimeout(() => {
                    setWinnerModal({ show: true, title: "🏆 SUCCESS!", msg: "BOUNTY CLAIMED VERIFIED!" });
                }, 1000);
                setTimeout(fetchGameState, 3000);
             } catch (retryErr) { alert("⚠️ Blockchain delay. Please click Claim again!"); } 
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
    <div className="relative w-full h-screen overflow-hidden">
      <style>{styles}</style>
      
      {/* PRO BACKGROUND SYSTEM:
          1. Div cha có background-image (AN TOÀN TUYỆT ĐỐI).
          2. Video con nằm đè lên, nhưng opacity=0.
          3. Video load xong -> opacity=1.
      */}
      <div className="bg-container">
          <video 
            ref={videoRef} 
            className={`bg-video ${videoReady ? 'ready' : ''}`} 
            poster={VIDEO_POSTER} 
            autoPlay loop muted playsInline 
            preload="auto"
            onLoadedData={handleVideoLoaded} // <--- CHỈA KHÓA CỦA VẤN ĐỀ
          >
              <source src={VIDEO_BG} type="video/mp4" />
          </video>
      </div>

      <div className={`game-layer ${isHit ? 'shake-active' : ''}`} style={{zIndex: 5}}>
          {!isDead && <img src={IMG_HERO} className="hero-layer" alt="Hero" />}
          {(!isDead && !isWaiting) && <img src={IMG_FIST} className="fist-layer" alt="Fist" />}
      </div>

      <div className="marquee-container">
          <div className="marquee-text">
              📢 ALL PLAYERS PARTICIPATING IN WAGMI KOMBAT WILL RECEIVE 2000 $KOMBAT TOKENS AIRDROP AFTER 1 WEEK! 🚀 PLAY NOW TO EARN! 💎
          </div>
      </div>

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

      {winnerModal.show && (
        <div className="winner-overlay" onClick={() => setWinnerModal({ ...winnerModal, show: false })}>
            <div className="winner-box">
                <div className="text-3xl md:text-4xl mb-4 animate-bounce font-['Press_Start_2P'] text-yellow-400 leading-tight">
                    {winnerModal.title}
                </div>
                <div className="text-[#00e5ff] font-['Rajdhani'] font-bold text-lg md:text-xl mb-6">
                    {winnerModal.msg}
                </div>
                <button 
                    onClick={() => setWinnerModal({ ...winnerModal, show: false })}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-bold rounded-lg hover:scale-105 font-['Press_Start_2P'] text-xs"
                >
                    CONTINUE
                </button>
            </div>
        </div>
      )}

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