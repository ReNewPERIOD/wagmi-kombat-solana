"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/* =================== CONFIG =================== */
const PROGRAM_ID = new PublicKey("FB2JH7H2zKfsiXfx6YazryNYR3TziJrVM542pQbb6TTN");
const GAME_ADDRESS = new PublicKey("DQeCu4DA43CeMFmBghXqcFtz123tgRGruCxhvqcGoW1Y");

/* Assets */
const VIDEO_BG = "/v4.mp4"; // Đảm bảo file này có trong thư mục public
const AUDIO_BATTLE_THEME = "https://files.catbox.moe/ind1d6.mp3";

/* =================== CSS (Inject Font & Animation) =================== */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&display=swap');
  
  /* Animation rung lắc khi đấm */
  @keyframes shake {
    0% { transform: translate(0, 0); }
    25% { transform: translate(-5px, 5px); }
    75% { transform: translate(5px, -5px); }
    100% { transform: translate(0, 0); }
  }
  .animate-shake { animation: shake 0.2s ease-in-out; }
`;

/* =================== MAIN COMPONENT =================== */
function GameContent() {
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();

  const [game, setGame] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [armor, setArmor] = useState(100);
  const [isClient, setIsClient] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHit, setIsHit] = useState(false); // State hiệu ứng đấm

  const audioRef = useRef(null);

  /* --------------------- INIT (FIXED: USEMEMO) --------------------- */
  // Sửa lỗi Cascading Render: Dùng useMemo thay vì useState+useEffect
  const program = useMemo(() => {
    if (!wallet) return null;
    // Chuyển về Devnet để test. Nếu muốn Mainnet thì đổi lại clusterApiUrl("mainnet-beta")
    const connection = new Connection(clusterApiUrl("devnet"), "processed");
    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: "processed",
    });
    return new Program(idl, PROGRAM_ID, provider);
  }, [wallet]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  /* --------------------- MUSIC SETUP --------------------- */
  useEffect(() => {
    if (!isClient) return;
    // Khởi tạo Audio object
    audioRef.current = new Audio(AUDIO_BATTLE_THEME);
    audioRef.current.volume = 0.6;
    audioRef.current.loop = true;
    
    // Thử tự phát nhạc
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => console.log("Audio autoplay blocked"));
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

  /* --------------------- FETCH GAME STATE --------------------- */
  const fetchGameState = useCallback(async () => {
    if (!program) return;

    try {
      const acc = await program.account.gameData.fetch(GAME_ADDRESS);
      setGame(acc);

      // Compute TTL
      const lastFed = acc.lastFedTimestamp.toNumber();
      const ttl = acc.timeToLive.toNumber();
      
      // Logic First Blood: Nếu lastFed = 0 tức là đang chờ
      if (lastFed === 0) {
         setTimeLeft(ttl);
         setArmor(100);
      } else {
         const now = Math.floor(Date.now() / 1000);
         const left = Math.max(0, (lastFed + ttl) - now);
         setTimeLeft(left);
         setArmor(left > 0 ? Math.min(100, (left / ttl) * 100) : 0);
      }
    } catch (e) {
      console.log("fetchGameState error:", e);
    }
  }, [program]);

  /* --------------------- SUBSCRIPTION --------------------- */
  useEffect(() => {
    if (!program) return;
    fetchGameState();
    const interval = setInterval(fetchGameState, 1000); // Update mỗi giây để đếm ngược mượt hơn
    return () => clearInterval(interval);
  }, [program, fetchGameState]);

  /* --------------------- ACTIONS --------------------- */
  const smash = async () => {
    if (!program || !publicKey) return alert("Wallet not connected.");

    try {
      // Bật nhạc nếu chưa bật
      if(audioRef.current && audioRef.current.paused && !isMuted) audioRef.current.play();
      
      // Hiệu ứng rung
      setIsHit(true); 
      setTimeout(() => setIsHit(false), 200);

      await program.methods.feed().accounts({
          gameAccount: GAME_ADDRESS,
          player: publicKey,
          systemProgram: web3.SystemProgram.programId,
        }).rpc();

      fetchGameState();
    } catch (e) {
      console.error("Feed error:", e);
      alert("Feed failed: " + e.message);
    }
  };

  const claim = async () => {
    if (!program || !publicKey || !game) return;
    if (timeLeft > 0) return alert("Wait for timer to hit 0s!");

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
      alert("Claim failed: " + e.message);
    }
  };

  if (!isClient) return null;

  return (
    <div className={`relative w-full h-screen overflow-hidden ${isHit ? 'animate-shake' : ''}`}>
      {/* Inject Styles */}
      <style>{styles}</style>

      {/* BACKGROUND VIDEO */}
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "brightness(0.6)" }}
      >
        <source src={VIDEO_BG} type="video/mp4" />
      </video>

      {/* TOP BAR: SOUND & WALLET */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50">
        <button
          onClick={toggleSound}
          className="px-4 py-2 bg-black/60 text-[#00e5ff] rounded-lg border border-[#00e5ff] font-['Rajdhani'] font-bold"
        >
          {isMuted || (audioRef.current && audioRef.current.paused) ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
        </button>

        {/* NÚT KẾT NỐI VÍ (QUAN TRỌNG) */}
        <WalletMultiButton style={{ backgroundColor: "#0072ff", fontFamily: "Rajdhani", fontWeight: "bold" }} />
      </div>

      {/* CENTER CONTENT */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 pointer-events-none">
        
        {/* LOGO / TITLE */}
        <h1 className="text-4xl md:text-6xl font-['Press_Start_2P'] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 drop-shadow-[0_0_10px_rgba(0,229,255,0.8)] mb-8 text-center">
            DOOMSDAY PET
        </h1>

        {/* ARMOR BAR */}
        <div className="w-[80%] max-w-[400px] h-[30px] bg-black/60 rounded-none border-2 border-red-600 overflow-hidden mb-2 relative skew-x-[-10deg]">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-300"
            style={{ width: `${armor}%` }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-['Rajdhani'] tracking-widest">
              BOSS ARMOR {armor.toFixed(0)}%
          </div>
        </div>

        {/* TIME LEFT */}
        <div className="text-2xl md:text-3xl font-['Rajdhani'] font-bold mb-8 text-[#00e5ff] drop-shadow-md">
          {timeLeft > 0 ? (
            <>⏳ {timeLeft}s UNTIL DOOM</>
          ) : (
            <span className="text-yellow-400 animate-pulse">💀 FATALITY — CLAIM BOUNTY!</span>
          )}
        </div>

        {/* ACTION BUTTONS (Pointer events auto để bấm được) */}
        <div className="flex flex-col items-center gap-4 pointer-events-auto">
          {timeLeft > 0 ? (
             <button
                onClick={smash}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-['Rajdhani'] font-black text-2xl uppercase tracking-wider clip-path-polygon hover:scale-105 transition-transform active:scale-95 shadow-[0_0_20px_rgba(0,114,255,0.5)]"
                style={{ clipPath: "polygon(10% 0, 100% 0, 100% 80%, 90% 100%, 0 100%, 0 20%)" }}
              >
                👊 SMASH (0.005 SOL)
             </button>
          ) : (
             <button
                onClick={claim}
                className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-['Press_Start_2P'] text-sm hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,215,0,0.6)] border-2 border-white"
              >
                🏆 CLAIM REWARD
             </button>
          )}
        </div>

        {/* LAST FEEDER */}
        {game && (
          <div className="mt-8 p-4 bg-black/70 border border-[#00e5ff] text-[#00e5ff] font-['Rajdhani'] text-center rounded-lg backdrop-blur-sm">
            <p className="text-sm text-gray-400">LAST HITTER</p>
            <p className="text-xl font-bold tracking-widest">
              {game.lastFeeder.toString().slice(0, 4)}...{game.lastFeeder.toString().slice(-4)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap component chính trong Provider
export default function Home() {
  const endpoint = clusterApiUrl("devnet");
  const wallets = [new PhantomWalletAdapter()]; // Nếu bạn import thêm ví khác thì điền vào đây

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