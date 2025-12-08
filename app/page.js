// page.js (Final version using ONLY v4.mp4)
// - Realtime optimized (Websocket + light polling)
// - Single video for stability (v4.mp4)
// - HUD fixed top-right under wallet
// - All effects preserved
// - Compatible with your PDA game account

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/* ====================================================== */
/* CONFIG — YOUR PROGRAM & PDA (DO NOT CHANGE)            */
/* ====================================================== */
const PROGRAM_ID = new PublicKey("CrwC7ekPmUmmuQPutMzBXqQ4MTydjw1EVS2Zs3wpk9fc");
const GAME_ADDRESS = new PublicKey("DQeCu4DA43CeMFmBghXqcFtz123tgRGruCxhvqcGoW1Y");

/* Assets — now only 1 video */
const VIDEO_MAIN = "/v4.mp4";

const IMG_FIST = "https://img.upanh.moe/1fdsF7NQ/FIST2-removebg-webp.webp";
const IMG_HERO = "https://img.upanh.moe/HTQcpVQD/web3-removebg-webp.webp";

const AUDIO_BATTLE_THEME = "https://files.catbox.moe/ind1d6.mp3";

/* ====================================================== */
/* STYLES AND ANIMATIONS                                  */
/* ====================================================== */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&display=swap');
body { margin: 0; background: #000; overflow: hidden; touch-action: none; }

/* animations */
@keyframes punch-loop {0%{transform:translateX(0) scale(1);}20%{transform:translateX(30px) scale(0.9);}40%{transform:translateX(-180px) scale(1.1);}100%{transform:translateX(0) scale(1);}}

/* shake animation */
@keyframes screen-shake-light {0%{transform:translate(0,0);}25%{transform:translate(-3px,3px);}75%{transform:translate(3px,-3px);}100%{transform:translate(0,0);}}
@keyframes screen-shake-strong {0%{transform:translate(0,0);}20%{transform:translate(-7px,7px);}40%{transform:translate(7px,-7px);}60%{transform:translate(-7px,7px);}80%{transform:translate(7px,-7px);}100%{transform:translate(0,0);}}

/* layout */
.game-wrapper { position: relative; width: 100vw; height: 100vh; overflow: hidden; display:flex; flex-direction:column; justify-content:flex-end; }
.video-stack { position:absolute; top:0; left:0; width:100%; height:100%; z-index:0; }

/* background video */
.bg-video-layer {
  position:absolute; top:0; left:0;
  width:100%; height:100%;
  object-fit:cover;
  opacity:1;
  z-index:1;
  filter:brightness(.6);
  transition: opacity .45s ease-in-out;
}

/* shake effects */
.bg-hit-light { animation: screen-shake-light .3s ease-out; }
.bg-hit-strong { animation: screen-shake-strong .4s ease-in-out; filter: hue-rotate(-20deg) contrast(1.2) brightness(1.2); }

/* hero & fist */
.hero-layer { position:absolute; right:2%; bottom:20%; width:25%; max-width:300px; z-index:4; filter:drop-shadow(0 0 20px #00e5ff); pointer-events:none; }
.fist-layer { position:absolute; right:18%; bottom:25%; width:45%; max-width:700px; z-index:6; animation:punch-loop .8s infinite ease-in-out; pointer-events:none; }

/* responsive */
@media (max-width:768px) {
  .fist-layer { width:70%; bottom:35%; right:5%; }
  .hero-layer { width:40%; bottom:25%; right:-10%; }
}

/* HUD */
.hud-overlay { position:relative; z-index:20; width:100%; padding:20px 40px 30px; background:linear-gradient(to top, rgba(0,0,0,.98) 70%, transparent); border-top:1px solid rgba(0,229,255,.3); display:flex; gap:20px; align-items:flex-end; flex-wrap:wrap; }
.chart-hp-frame { width:100%; height:25px; background:rgba(20,0,0,.6); border:2px solid #ff3300; transform:skewX(-10deg); overflow:hidden; }
.chart-hp-fill { height:100%; background:repeating-linear-gradient(45deg,#ff0000 0,#ff0000 5px,#990000 5px,#990000 10px); box-shadow:0 0 30px #ff0000; transition:width .25s ease-out; }

/* buttons */
.combat-btn { width:100%; padding:20px; font-size:1.5rem; font-family:'Rajdhani'; font-weight:800; border:none; cursor:pointer; color:white; background:linear-gradient(90deg,#00c6ff,#0072ff); clip-path: polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); box-shadow:0 0 20px rgba(0,198,255,.5); letter-spacing:2px; }

/* extra HUD top-right */
.extra-hud {
  position: fixed !important;
  top: 70px !important;
  right: 20px !important;
  z-index: 99999 !important;
  width: 280px;
  padding: 12px;
  border: 1px solid rgba(0,229,255,0.9);
  color: #00e5ff;
  font-family: 'Rajdhani'; font-weight:700;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(4px);
  pointer-events:none;
}

.music-btn {
  position: fixed; top: 70px; left: 20px;
  background:rgba(0,0,0,.6);
  border:1px solid #00e5ff;
  color:#00e5ff;
  padding:10px;
  cursor:pointer;
  border-radius:50%;
  width:40px; height:40px;
}
`;

/* ====================================================== */
/* HELPER SHORTEN FN                                       */
/* ====================================================== */
const shortenAddress = (address) => {
  if (!address) return "WAITING...";
  const s = address.toString();
  return s.slice(0, 6) + ".." + s.slice(-4);
};

/* ====================================================== */
/* BACKGROUND VIDEO COMPONENT (single file)                */
/* ====================================================== */
const BackgroundVideo = ({ src }) => {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (v && v.paused) v.play().catch(()=>{});
  }, []);
  return <video ref={ref} className="bg-video-layer" autoPlay loop muted playsInline src={src} />;
};

/* ====================================================== */
/* MAIN PAGE                                               */
/* ====================================================== */
export default function Home() {
  const { publicKey, connect } = useWallet();
  const anchorWallet = useAnchorWallet();

  const [gameState, setGameState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime, setMaxTime] = useState(60);
  const [potBalance, setPotBalance] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [lastHitter, setLastHitter] = useState(null);
  const [topHitters, setTopHitters] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef(null);

  /* Connection */
  const endpoint = clusterApiUrl("devnet");
  const connectionRef = useRef(new Connection(endpoint, "processed"));
  const connection = connectionRef.current;

  /* Dummy wallet (read-only) */
  const dummyWallet = {
    publicKey: new PublicKey("11111111111111111111111111111111"),
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };

  /* Provider helper */
  const getProvider = useCallback(
    (needSigner = false) => {
      const wallet = anchorWallet || (needSigner ? null : dummyWallet);
      if (needSigner && !anchorWallet) return null;
      return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    },
    [anchorWallet, connection]
  );

  /* preload assets */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const list = [
      { href: IMG_FIST, as: "image" },
      { href: IMG_HERO, as: "image" },
      { href: VIDEO_MAIN, as: "video", type: "video/mp4" },
      { href: AUDIO_BATTLE_THEME, as: "audio" },
    ];
    list.forEach((p) => {
      const l = document.createElement("link");
      l.rel = "preload";
      l.as = p.as;
      l.href = p.href;
      if (p.type) l.type = p.type;
      document.head.appendChild(l);
    });
  }, []);

  /* audio init */
  useEffect(() => {
    audioRef.current = new Audio(AUDIO_BATTLE_THEME);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.6;
    audioRef.current.muted = isMuted;
    setIsClient(true);
  }, []);

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.muted = false;
      audioRef.current.play().catch(()=>{});
      setIsMuted(false);
    } else {
      audioRef.current.pause();
      setIsMuted(true);
    }
  };

  /* fetch game state */
  const fetchGameState = useCallback(async () => {
    try {
      const provider = getProvider(false);
      const program = new Program(idl, PROGRAM_ID, provider);
      const acc = await program.account.gameData.fetch(GAME_ADDRESS);

      const bal = await connection.getBalance(GAME_ADDRESS);

      setGameState(acc);
      setPotBalance(bal / 1e9);

      const ttl = acc.timeToLive.toNumber();
      if (ttl > 0) setMaxTime(ttl);

      const lastFed = acc.lastFedTimestamp.toNumber();
      if (lastFed === 0) setTimeLeft(ttl);
      else setTimeLeft(Math.max(0, lastFed + ttl - Math.floor(Date.now() / 1000)));

      setLastHitter(acc.lastFeeder?.toString() || null);

      // fake topHitters for now
      if (!topHitters.length) {
        setTopHitters([
          { address: "Ff3r...1a2b", hits: 15 },
          { address: "Aa2d...4e5f", hits: 12 },
          { address: "Cc9t...7y8z", hits: 8 },
        ]);
      }
    } catch (err) {}
  }, [connection, getProvider, topHitters]);

  /* realtime updates */
  useEffect(() => {
    if (!isClient) return;
    fetchGameState();

    let subId = null;
    try {
      subId = connection.onAccountChange(
        GAME_ADDRESS,
        () => fetchGameState(),
        "processed"
      );
    } catch (e) {}

    const poll = setInterval(() => fetchGameState(), 4000);
    const ticker = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);

    return () => {
      clearInterval(poll);
      clearInterval(ticker);
      if (subId) connection.removeAccountChangeListener(subId).catch(()=>{});
    };
  }, [isClient, connection, fetchGameState]);

  /* derived UI state */
  const hpPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 100;
  const isWaiting = gameState && gameState.lastFedTimestamp.toNumber() === 0;
  const isDead = timeLeft === 0 && !isWaiting;

  const shakeClass = !isHit ? "" : hpPercent < 50 ? "bg-hit-strong" : "bg-hit-light";

  /* optimistic UI */
  const optimisticFeed = (wallet) => {
    setLastHitter(wallet.toString());
    setTimeLeft(maxTime);
  };

  /* feed action */
  const feedBeast = async () => {
    if (!anchorWallet || !publicKey) {
      try { await connect(); } catch {}
    }
    if (!publicKey) return alert("Connect wallet to smash!");
    if (isProcessing) return;

    setIsProcessing(true);
    setIsHit(true);
    setTimeout(() => setIsHit(false), 400);

    try {
      const provider = getProvider(true);
      const program = new Program(idl, PROGRAM_ID, provider);

      await program.methods
        .feed()
        .accounts({ gameAccount: GAME_ADDRESS, player: publicKey, systemProgram: web3.SystemProgram.programId })
        .rpc();

      optimisticFeed(publicKey);
      setTimeout(() => fetchGameState(), 900);
    } catch (err) {
      alert("SMASH failed: " + (err?.message || err));
      setTimeout(() => fetchGameState(), 800);
    } finally {
      setIsProcessing(false);
    }
  };

  /* claim action */
  const claimPrize = async () => {
    if (!gameState) return;
    if (timeLeft > 0) return alert("Wait for 0 seconds!");

    if (!anchorWallet || !publicKey) {
      try { await connect(); } catch {}
    }
    if (!publicKey) return;

    setIsProcessing(true);
    try {
      const provider = getProvider(true);
      const program = new Program(idl, PROGRAM_ID, provider);
      const winnerAddress = new PublicKey(gameState.lastFeeder);

      await program.methods
        .claimReward()
        .accounts({ gameAccount: GAME_ADDRESS, hunter: publicKey, winner: winnerAddress })
        .rpc();

      alert("🎉 Claim success!");
      await fetchGameState();
    } catch (err) {
      alert("Claim failed: " + (err?.message || err));
      await fetchGameState();
    } finally {
      setIsProcessing(false);
    }
  };

  /* render */
  const styleEl = useMemo(() => <style>{styles}</style>, []);

  if (!isClient) return null;

  return (
    <div className="game-wrapper">
      {styleEl}

      {/* background video single layer */}
      <div className={`video-stack ${shakeClass}`}>
        <BackgroundVideo src={VIDEO_MAIN} />
      </div>

      {/* hero & fist */}
      {!isDead && <img src={IMG_HERO} className="hero-layer" alt="" />}
      {!isDead && <img src={IMG_FIST} className="fist-layer" alt="" />}

      {/* TOP BAR */}
      <div style={{ position:"absolute", top:0, left:0, width:"100%", padding:"20px", display:"flex", justifyContent:"space-between", zIndex:30 }}>
        <h1 className="font-pixel" style={{ margin:0, fontSize:"1.2rem", color:"#fff", textShadow:"0 0 20px #00e5ff" }}>
          WEB3 <span style={{ color:"#00e5ff" }}>FIGHTER</span>
        </h1>
        <WalletMultiButton style={{ background:"rgba(0,0,0,0.5)", border:"2px solid #00e5ff", fontFamily:"Rajdhani", fontSize:"0.8rem" }} />
      </div>

      {/* MUSIC BUTTON */}
      <button className="music-btn" onClick={toggleSound}>
        {(isMuted || audioRef.current?.paused) ? "🔇" : "🔊"}
      </button>

      {/* BOTTOM HUD */}
      <div className="hud-overlay">
        <div style={{ flex:2 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px", color:"#ff3300" }}>
            <span className="font-tech">BTC ARMOR</span>
            <span className="font-tech">{isWaiting ? `${maxTime}s` : `${timeLeft}s`}</span>
          </div>
          <div className="chart-hp-frame">
            <div className="chart-hp-fill" style={{ width:`${hpPercent}%` }} />
          </div>
        </div>

        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"8px" }}>
          <button className="combat-btn" disabled={isProcessing || isDead} onClick={feedBeast}>
            {isDead ? "☠️ DEAD" : "SMASH"}
          </button>
          <button className="combat-btn" disabled={isProcessing || timeLeft>0} onClick={claimPrize}
            style={{ background: "linear-gradient(90deg,#f1c40f,#f39c12)", color: "#000" }}>
            CLAIM
          </button>
        </div>
      </div>

      {/* EXTRA HUD FIXED TOP-RIGHT */}
      <div className="extra-hud">
        <div style={{ marginBottom:6 }}>Pot: <span style={{ color:"#fff" }}>{potBalance.toFixed(2)} SOL</span></div>
        <div style={{ marginBottom:6 }}>Last: <span style={{ color:"#fff" }}>{shortenAddress(lastHitter)}</span></div>
        <div style={{ fontSize:"0.85rem", marginTop:6 }}>Top Hitters:</div>
        <div style={{ marginTop:6 }}>
          {topHitters.map((t,i)=>(
            <div key={i}>{shortenAddress(t.address)} <span style={{ color:"#fff" }}>({t.hits})</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
