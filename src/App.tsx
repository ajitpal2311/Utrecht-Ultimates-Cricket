import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Plus, 
  Minus, 
  Users, 
  History, 
  Share2, 
  RotateCcw, 
  Copy, 
  Check, 
  Sun, 
  Moon, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Award, 
  ChevronRight, 
  Home, 
  UserPlus, 
  TrendingUp, 
  Sparkles,
  ArrowRightLeft,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { CricketMatch, PlayerStats, BowlerStats } from './types';
import { 
  createNewMatch, 
  recordDelivery, 
  undoLastDelivery, 
  ballsToOvers, 
  calculateRunRate 
} from './matchEngine';
import { saveMatch, fetchAllMatches, listenToMatch, deleteMatch } from './firebaseService';
import { isFirebaseEnabled } from './firebase';

export default function App() {
  // Views: 'home' | 'create' | 'squads' | 'toss' | 'scoring' | 'result' | 'viewer'
  const [currentView, setCurrentView] = useState<'home' | 'create' | 'squads' | 'toss' | 'scoring' | 'result' | 'viewer'>('home');
  const [matchesList, setMatchesList] = useState<CricketMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState<CricketMatch | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preference settings for outdoors
  const [themeMode, setThemeMode] = useState<'sunlight' | 'night'>('sunlight');
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true);

  // Reusable custom confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmBtnStyle?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmBtnStyle: 'danger',
    onConfirm: () => {}
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmBtnStyle: 'danger' | 'warning' | 'primary' = 'danger'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmBtnStyle,
      onConfirm
    });
  };

  // Creation Form State
  const [matchName, setMatchName] = useState('Utrecht Champions League');
  const [teamAName, setTeamAName] = useState('Utrecht Ultimates');
  const [teamBName, setTeamBName] = useState('Amstelveen CC');
  const [oversCount, setOversCount] = useState<number>(5);
  const [playersLimit, setPlayersLimit] = useState<number>(11);
  const [enableHalfwayRules, setEnableHalfwayRules] = useState<boolean>(true);
  const [noBallPromptOpen, setNoBallPromptOpen] = useState<boolean>(false);

  // Squad setup state
  const [teamASquad, setTeamASquad] = useState<string[]>([]);
  const [teamBSquad, setTeamBSquad] = useState<string[]>([]);

  // Intermediate setup choices
  const [tossWonBy, setTossWonBy] = useState<'A' | 'B' | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null);

  // Live Score screen helpers
  const [scoringExtrasMode, setScoringExtrasMode] = useState<'wd' | 'nb' | 'by' | 'lb' | null>(null);
  const [wicketConfig, setWicketConfig] = useState<{
    showOptions: boolean;
    type: 'bowled' | 'caught' | 'run out' | 'lbw' | 'stumped' | 'other' | null;
    batsmanId: string | null;
  }>({ showOptions: false, type: null, batsmanId: null });

  const [activeScorecardTab, setActiveScorecardTab] = useState<'batting' | 'bowling' | 'summary'>('summary');
  const [showDetailedScorecard, setShowDetailedScorecard] = useState<boolean>(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Read Deep-Link/Spectator parameters on Mount
  useEffect(() => {
    const handleUrlLoading = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      let matchId = queryParams.get('matchId');
      
      if (!matchId) {
        const hash = window.location.hash;
        if (hash && hash.includes('matchId=')) {
          matchId = hash.split('matchId=')[1];
        }
      }

      if (matchId) {
        setLoading(true);
        setCurrentView('viewer');
        // Set up real-time subscribe
        const unsubscribe = listenToMatch(
          matchId,
          (updatedMatch) => {
            setCurrentMatch(updatedMatch);
            setLoading(false);
          },
          (err) => {
            triggerToast("Match not found or offline");
            setLoading(false);
          }
        );
        return () => unsubscribe();
      }
    };

    handleUrlLoading();
    loadAllMatches();
  }, []);

  // Periodic match lookup for lists
  const loadAllMatches = async () => {
    const list = await fetchAllMatches();
    setMatchesList(list);
  };

  // Helper helper to trigger sound/vibration
  const triggerHapticFeedback = () => {
    if (!hapticFeedback) return;
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(55);
      } catch (err) {
        // Ignored
      }
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Create match action
  const handleInitiateMatchCreation = () => {
    triggerHapticFeedback();
    const cleanMatch = createNewMatch(matchName, teamAName, teamBName, oversCount, playersLimit, null, enableHalfwayRules);
    
    // Generate default player names to save outdoor typing time
    const initialASquad = Array.from({ length: playersLimit }, (_, i) => `Player ${i + 1}`);
    const initialBSquad = Array.from({ length: playersLimit }, (_, i) => `Player ${i + 1}`);
    
    // Customize first 2 players to look realistic instantly
    if (playersLimit >= 2) {
      initialASquad[0] = 'S. de Witt';
      initialASquad[1] = 'A. Pal';
      initialBSquad[0] = 'H. van den Berg';
      initialBSquad[1] = 'M. Jansen';
    }

    setTeamASquad(initialASquad);
    setTeamBSquad(initialBSquad);
    setCurrentMatch(cleanMatch);
    setTossWonBy(null);
    setTossDecision(null);
    setCurrentView('squads');
  };

  // Start match from toss configuration
  const handleFinalizeTossAndStart = async () => {
    if (!currentMatch || !tossWonBy || !tossDecision) {
      triggerToast("Please pick toss winner and decision first!");
      return;
    }

    triggerHapticFeedback();
    setLoading(true);

    const matchObj = { ...currentMatch };
    matchObj.tossWinner = tossWonBy;
    matchObj.tossDecision = tossDecision;
    matchObj.status = 'scoring';

    // Figure out who is batting first in Inning 1
    // If Team A wins and chooses Bat: A bats, B bowls
    // If Team A wins and chooses Bowl: B bats, A bowls
    // If Team B wins and chooses Bat: B bats, A bowls
    // If Team B wins and chooses Bowl: A bats, B bowls
    let firstInningsBatting: 'A' | 'B' = 'A';
    if (tossWonBy === 'A') {
      firstInningsBatting = tossDecision === 'bat' ? 'A' : 'B';
    } else {
      firstInningsBatting = tossDecision === 'bat' ? 'B' : 'A';
    }

    const firstInningsBowling = firstInningsBatting === 'A' ? 'B' : 'A';
    const battingSquad = firstInningsBatting === 'A' ? teamASquad : teamBSquad;

    // Create Inning 1 scoring structure
    const innings1Stats = {
      battingTeamId: firstInningsBatting,
      bowlingTeamId: firstInningsBowling,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      battingOrder: battingSquad.map((name, i) => ({
        id: `p-${firstInningsBatting}-${i + 1}`,
        name: name || `Batter ${i + 1}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false
      })),
      bowlingOrder: [],
      currentBatter1Id: `p-${firstInningsBatting}-1`,
      currentBatter2Id: `p-${firstInningsBatting}-2`,
      strikerId: `p-${firstInningsBatting}-1`,
      currentBowlerId: null,
      overHistory: []
    };

    matchObj.innings1 = innings1Stats;
    matchObj.currentInningsIndex = 1;
    setCurrentMatch(matchObj);

    await saveMatch(matchObj);
    setLoading(false);
    setCurrentView('scoring');
    triggerToast("🏏 Match Started! Please select Opening Bowler.");
  };

  // Quick Inline Squad Name editor helper
  const handleEditPlayerName = (team: 'A' | 'B', index: number, value: string) => {
    if (team === 'A') {
      const updated = [...teamASquad];
      updated[index] = value;
      setTeamASquad(updated);
    } else {
      const updated = [...teamBSquad];
      updated[index] = value;
      setTeamBSquad(updated);
    }
  };

  const handleAddPlayerSlot = (team: 'A' | 'B') => {
    triggerHapticFeedback();
    if (team === 'A') {
      setTeamASquad([...teamASquad, `Player ${teamASquad.length + 1}`]);
    } else {
      setTeamBSquad([...teamBSquad, `Player ${teamBSquad.length + 1}`]);
    }
  };

  const handleRemovePlayerSlot = (team: 'A' | 'B', index: number) => {
    triggerHapticFeedback();
    if (team === 'A') {
      if (teamASquad.length <= 2) {
        triggerToast("Minimum 2 players needed");
        return;
      }
      setTeamASquad(teamASquad.filter((_, idx) => idx !== index));
    } else {
      if (teamBSquad.length <= 2) {
        triggerToast("Minimum 2 players needed");
        return;
      }
      setTeamBSquad(teamBSquad.filter((_, idx) => idx !== index));
    }
  };

  // Perform Wide Scoring
  const handleWideClick = async () => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    if (!activeInnings.currentBowlerId) {
      triggerToast("⚠️ Tap 'CHOOSE BOWLER' below to assign a bowler!");
      return;
    }
    if (!activeInnings.currentBatter1Id || !activeInnings.currentBatter2Id || !activeInnings.strikerId) {
      triggerToast("⚠️ Assign new batsmen first!");
      return;
    }

    triggerHapticFeedback();
    const updated = recordDelivery(currentMatch, 0, 'wd', false);

    setCurrentMatch(updated);
    setScoringExtrasMode(null);
    await saveMatch(updated);

    if (updated.status === 'completed') {
      setCurrentView('result');
      loadAllMatches();
    } else if (updated.currentInningsIndex !== currentMatch.currentInningsIndex) {
      initializeInnings2(updated);
    }
  };

  // Perform No-Ball Runs Submission
  const submitNoBallRuns = async (battingRuns: number) => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    if (!activeInnings.currentBowlerId) {
      triggerToast("⚠️ Tap 'CHOOSE BOWLER' below to assign a bowler!");
      return;
    }
    if (!activeInnings.currentBatter1Id || !activeInnings.currentBatter2Id || !activeInnings.strikerId) {
      triggerToast("⚠️ Assign new batsmen first!");
      return;
    }

    triggerHapticFeedback();
    const updated = recordDelivery(currentMatch, battingRuns, 'nb', false);

    setNoBallPromptOpen(false);
    setCurrentMatch(updated);
    setScoringExtrasMode(null);
    await saveMatch(updated);

    if (updated.status === 'completed') {
      setCurrentView('result');
      loadAllMatches();
    } else if (updated.currentInningsIndex !== currentMatch.currentInningsIndex) {
      initializeInnings2(updated);
    }
  };

  // Perform scoring click
  const handleScoreEvent = async (runs: number) => {
    if (!currentMatch) return;
    
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    // Check if bowler is set
    if (!activeInnings.currentBowlerId) {
      triggerToast("⚠️ Tap 'CHOOSE BOWLER' below to assign a bowler!");
      return;
    }

    // Check if batsmen are available
    if (!activeInnings.currentBatter1Id || !activeInnings.currentBatter2Id || !activeInnings.strikerId) {
      triggerToast("⚠️ Assign new batsmen first!");
      return;
    }

    triggerHapticFeedback();
    
    // Normal Delivery or Extras calculation
    const updated = recordDelivery(
      currentMatch,
      runs,
      scoringExtrasMode,
      false // isWicket
    );

    // Save and update
    setCurrentMatch(updated);
    setScoringExtrasMode(null); // Clear selected extras modifier
    await saveMatch(updated);

    // If innings completed during the run scoring
    if (updated.status === 'completed') {
      setCurrentView('result');
      loadAllMatches();
    } else if (updated.currentInningsIndex !== currentMatch.currentInningsIndex) {
      // Innings 1 just completed! Initialize Innings 2.
      initializeInnings2(updated);
    }
  };

  // Wicket Trigger scoring Click
  const handleWicketPromptOpen = () => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    if (!activeInnings.currentBowlerId) {
      triggerToast("Assign a bowler first!");
      return;
    }

    triggerHapticFeedback();
    setWicketConfig({
      showOptions: true,
      type: null,
      batsmanId: activeInnings.strikerId // default striker out
    });
  };

  const submitWicketScoring = async () => {
    if (!currentMatch || !wicketConfig.type || !wicketConfig.batsmanId) {
      triggerToast("Specify wicket type first!");
      return;
    }

    triggerHapticFeedback();

    const updated = recordDelivery(
      currentMatch,
      0, // runs
      null, // extras
      true, // isWicket
      wicketConfig.type,
      wicketConfig.batsmanId
    );

    setWicketConfig({ showOptions: false, type: null, batsmanId: null });
    setCurrentMatch(updated);
    await saveMatch(updated);

    if (updated.status === 'completed') {
      setCurrentView('result');
      loadAllMatches();
    } else if (updated.currentInningsIndex !== currentMatch.currentInningsIndex) {
      initializeInnings2(updated);
    } else {
      triggerToast("🎯 Wicket recorded! Pick the incoming batsman card below.");
    }
  };

  // Setup Innings 2 automatic structure
  const initializeInnings2 = async (matchWithInningsCompleted: CricketMatch) => {
    const updated = { ...matchWithInningsCompleted };
    const secondBattingTeam = updated.innings1?.bowlingTeamId || 'B';
    const secondBowlingTeam = updated.innings1?.battingTeamId || 'A';
    const battingSquad = secondBattingTeam === 'A' ? teamASquad : teamBSquad;

    updated.innings2 = {
      battingTeamId: secondBattingTeam,
      bowlingTeamId: secondBowlingTeam,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      battingOrder: battingSquad.map((name, i) => ({
        id: `p-${secondBattingTeam}-${i + 1}`,
        name: name || `Batter ${i + 1}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false
      })),
      bowlingOrder: [],
      currentBatter1Id: `p-${secondBattingTeam}-1`,
      currentBatter2Id: `p-${secondBattingTeam}-2`,
      strikerId: `p-${secondBattingTeam}-1`,
      currentBowlerId: null,
      overHistory: []
    };
    updated.currentInningsIndex = 2;
    
    setCurrentMatch(updated);
    await saveMatch(updated);
    triggerToast("🏏 Innings 1 over! Starting Innings 2. Please select Opening Bowler.");
  };

  // Perform Undo
  const handleUndoEvent = async () => {
    if (!currentMatch || currentMatch.ballHistory.length === 0) {
      triggerToast("Nothing to undo!");
      return;
    }
    triggerHapticFeedback();
    
    triggerConfirm(
      "↩️ Undo Last Delivery",
      "Are you sure you want to undo the last recorded ball on the scorecard?",
      async () => {
        const restored = undoLastDelivery(currentMatch);
        setCurrentMatch(restored);
        await saveMatch(restored);
        triggerToast("↩ Last ball removed!");
      },
      'warning'
    );
  };

  // Quick Bowler Setter Actions
  const handleAssignActiveBowler = async (playerIdx: number) => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    triggerHapticFeedback();
    const fieldingTeam = activeInnings.bowlingTeamId;
    const fieldingSquad = fieldingTeam === 'A' ? teamASquad : teamBSquad;
    const bowlerName = fieldingSquad[playerIdx];
    const bowlerId = `p-${fieldingTeam}-${playerIdx + 1}`;

    const updatedMatch = { ...currentMatch };
    const inningsTarget = updatedMatch.currentInningsIndex === 1 ? updatedMatch.innings1 : updatedMatch.innings2;
    
    if (inningsTarget) {
      inningsTarget.currentBowlerId = bowlerId;
      
      // Ensure bowler is present in stats
      if (!inningsTarget.bowlingOrder.some(b => b.id === bowlerId)) {
        inningsTarget.bowlingOrder.push({
          id: bowlerId,
          name: bowlerName,
          balls: 0,
          maidens: 0,
          runs: 0,
          wickets: 0
        });
      }
    }

    setCurrentMatch(updatedMatch);
    await saveMatch(updatedMatch);
    triggerToast(`🥎 Bowler is now: ${bowlerName}`);
  };

  // Quick Batsman replacement selector (when a batter gets out)
  const handleAssignIncomingBatsman = async (playerIdx: number) => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    triggerHapticFeedback();
    const battingTeam = activeInnings.battingTeamId;
    const bId = `p-${battingTeam}-${playerIdx + 1}`;

    const updatedMatch = { ...currentMatch };
    const inn = updatedMatch.currentInningsIndex === 1 ? updatedMatch.innings1 : updatedMatch.innings2;

    if (inn) {
      // Find where we have a slot available
      if (!inn.currentBatter1Id && inn.currentBatter2Id !== bId) {
        inn.currentBatter1Id = bId;
        if (!inn.strikerId) inn.strikerId = bId;
      } else if (!inn.currentBatter2Id && inn.currentBatter1Id !== bId) {
        inn.currentBatter2Id = bId;
        if (!inn.strikerId) inn.strikerId = bId;
      } else {
        triggerToast("Batsmen spots are already filled!");
        return;
      }
    }

    setCurrentMatch(updatedMatch);
    await saveMatch(updatedMatch);
    triggerToast("🏏 New batsman assigned!");
  };

  // Toggle Strike manual swap (One Tap)
  const handleManualStrikeSwap = async () => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    if (!activeInnings.currentBatter1Id || !activeInnings.currentBatter2Id) {
      triggerToast("Need both batsmen in play first!");
      return;
    }

    triggerHapticFeedback();
    const currentStriker = activeInnings.strikerId;
    const partner = currentStriker === activeInnings.currentBatter1Id ? activeInnings.currentBatter2Id : activeInnings.currentBatter1Id;

    const updated = { ...currentMatch };
    const inn = updated.currentInningsIndex === 1 ? updated.innings1 : updated.innings2;
    if (inn) {
      inn.strikerId = partner;
    }
    
    setCurrentMatch(updated);
    await saveMatch(updated);
    triggerToast("🔄 Strike ends swapped!");
  };

  // Utility to generate direct deep spectator link
  const getShareLink = (matchId: string) => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?matchId=${matchId}`;
  };

  // Copy share match address
  const handleCopySpectatorLink = (matchId: string) => {
    const link = getShareLink(matchId);
    triggerHapticFeedback();
    navigator.clipboard.writeText(link);
    setCopiedId(matchId);
    triggerToast("📋 Shared Link Copied! Send to friends.");
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Delete matching telemetry logic
  const handleDeleteMatch = (matchId: string) => {
    triggerHapticFeedback();
    triggerConfirm(
      "🗑️ Delete Scorecard",
      "Are you sure you want to delete this match scorecard data permanently? This action is irreversible and will delete it both locally and from the database. Please select Confirm below.",
      async () => {
        triggerHapticFeedback();
        try {
          await deleteMatch(matchId);
          triggerToast("🗑️ Match deleted successfully!");
        } catch (error) {
          console.error("Match deletion failed:", error);
          triggerToast("⚠️ Deletion failed or you are not the creator.");
        }
        loadAllMatches();
      },
      'danger'
    );
  };

  // Load an existing match to score again
  const handleLoadMatchToScore = (matchObj: CricketMatch) => {
    triggerHapticFeedback();
    setCurrentMatch(matchObj);
    
    // Retrieve player arrays from name matching
    setCurrentView('scoring');
    triggerToast("🏏 Scoreboard Loaded! Pitch is ready.");
  };

  // Return Home
  const handleReturnHome = () => {
    triggerHapticFeedback();
    setCurrentMatch(null);
    setCurrentView('home');
    loadAllMatches();
  };

  // Theme support
  const isSunlight = themeMode === 'sunlight';

  return (
    <div className={`min-h-screen pb-16 transition-colors duration-200 ${
      isSunlight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      
      {/* HEADER BAR FOR UTRECHT ULTIMATES APP */}
      <header className={`sticky top-0 z-40 px-4 py-3 shadow-md border-b flex justify-between items-center transition-colors ${
        isSunlight ? 'bg-amber-400 border-amber-500 text-slate-950' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex items-center gap-2" id="header-logo">
          <Trophy className="w-7 h-7 text-red-700 fill-red-600 animate-pulse" />
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
              Utrecht Ultimates Cricket
            </h1>
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80">
              Outdoor Scoring MVP
            </p>
          </div>
        </div>

        {/* Toggles for sunlight legibility and click vibs */}
        <div className="flex items-center gap-2">
          {/* Haptic trigger */}
          <button 
            onClick={() => { setHapticFeedback(!hapticFeedback); triggerHapticFeedback(); }}
            className={`p-2.5 rounded-lg border flex items-center justify-center font-bold ${
              hapticFeedback 
                ? 'bg-emerald-500 text-white border-emerald-600' 
                : 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
            title="Toggle vibration clicks"
            id="vibration-toggle"
          >
            {hapticFeedback ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Sunlight theme selector */}
          <button
            onClick={() => { setThemeMode(isSunlight ? 'night' : 'sunlight'); triggerHapticFeedback(); }}
            className={`p-2.5 rounded-lg border flex items-center justify-center ${
              isSunlight 
                ? 'bg-slate-800 text-amber-300 border-slate-900' 
                : 'bg-amber-400 text-slate-900 border-amber-500'
            }`}
            id="theme-toggler"
          >
            {isSunlight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* FIXED TOAST MESSAGE FOR FRIENDLY ALERTS */}
      <AnimatePresence>
        {toastMessage && (
          <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 w-auto px-4 py-2 bg-slate-900 text-white rounded-full border border-slate-700 shadow-xl font-medium text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            {toastMessage}
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-2xl mx-auto px-4 pt-5">

        {/* ======================= SCREEN 1: HOME VIEW ======================= */}
        {currentView === 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
            id="home-screen"
          >
            {/* Quick banner welcoming outdoor users */}
            <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 select-none ${
              isSunlight 
                ? 'bg-white border-slate-300 shadow-sm' 
                : 'bg-slate-900 border-slate-800 shadow-xl'
            }`}>
              <div className="space-y-1">
                <span className="text-[12px] font-mono tracking-widest text-emerald-500 font-bold">OUTDOOR OPTIMISED</span>
                <h2 className="text-2xl font-bold font-display leading-tight">Sunlight Friendly Scorekeeper</h2>
                <p className="text-sm opacity-70">Perfect for scoring quick weekend club overs with friends on damp Dutch pitches.</p>
              </div>
              <span className="text-4xl">🌤️🏏</span>
            </div>

            {/* Core Grid Cards */}
            <div className="grid grid-cols-1 select-none gap-4">
              {/* PRIMARY BUTTON - CREATE MATCH */}
              <button
                onClick={() => { handleInitiateMatchCreation(); }}
                className="w-full text-left p-6 rounded-2xl flex items-center justify-between bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-500 active:scale-98 transition-all shadow-md group py-8"
                id="create-match-big-button"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-emerald-700/60 rounded-xl group-hover:scale-110 transition-transform">
                    <UserPlus className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold">New Scorecard</h3>
                    <p className="text-emerald-500 text-sm">Create match and setup teams</p>
                  </div>
                </div>
                <ChevronRight className="w-8 h-8 opacity-80" />
              </button>
            </div>

            {/* PREVIOUS MATCHES SECTIONS */}
            <div className={`p-4 rounded-2xl border space-y-4 ${
              isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center gap-2 border-b pb-2">
                <History className="w-6 h-6 text-indigo-500" />
                <h3 className="text-lg font-bold">Saved Scorecards</h3>
              </div>

              {matchesList.length === 0 ? (
                <div className="text-center py-8 opacity-60 flex flex-col items-center gap-2">
                  <span className="text-3xl">🏜️</span>
                  <p>No matches recorded yet on LocalStore.</p>
                  <p className="text-xs">Any scorecard you create will auto-save here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchesList.map(m => {
                    const hasStatus = m.status === 'completed';
                    const activeIndex = m.currentInningsIndex;
                    const inn1 = m.innings1;
                    const inn2 = m.innings2;

                    return (
                      <div 
                        key={m.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                          isSunlight ? 'bg-slate-55 border-slate-200' : 'bg-slate-950 border-slate-800'
                        }`}
                        id={`match-card-${m.id}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-base md:text-lg">{m.matchName}</h4>
                            <p className="text-xs opacity-60">
                              {m.overs} Overs • {m.playersPerTeam} Players • {new Date(m.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                            hasStatus 
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-850 dark:text-slate-300' 
                              : 'bg-emerald-500 text-white animate-pulse'
                          }`}>
                            {m.status}
                          </span>
                        </div>

                        {/* Summary of scores */}
                        <div className="grid grid-cols-2 gap-2 border-y py-2 text-sm font-mono select-none">
                          <div className="border-r pr-2">
                            <span className="text-[10px] text-slate-500 block uppercase">First Innings</span>
                            <span className="font-bold block text-base">
                              {inn1 ? `${inn1.runs}/${inn1.wickets}` : '0/0'} 
                              <span className="text-xs font-normal text-slate-500"> ({ballsToOvers(inn1?.balls || 0)} ov)</span>
                            </span>
                          </div>
                          <div className="pl-2">
                            <span className="text-[10px] text-slate-500 block uppercase">Second Innings</span>
                            <span className="font-bold block text-base text-cyan-600">
                              {inn2 ? `${inn2.runs}/${inn2.wickets}` : 'Not started'} 
                              {inn2 && <span className="text-xs font-normal text-slate-500"> ({ballsToOvers(inn2.balls)} ov)</span>}
                            </span>
                          </div>
                        </div>

                        {/* Winner/Margin announcement */}
                        {m.status === 'completed' && m.winner && (
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs font-semibold text-emerald-600 flex items-center gap-1.5 dark:text-emerald-400">
                            <Award className="w-4 h-4 fill-emerald-500/20" />
                            {m.winner === 'tie' ? 'Match Tied!' : `${m.winner === 'A' ? m.teamAName : m.teamBName} won by ${m.marginOfVictory}`}
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-sm">
                          {/* Sync / Viewer */}
                          <button
                            onClick={() => { handleCopySpectatorLink(m.id); }}
                            className="flex items-center gap-1.5 px-2 py-2 border rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350 font-bold active:scale-95 transition-transform"
                            title="Share Link"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>Share</span>
                          </button>

                          {/* Quick Score edit if not completed, or Load anyway */}
                          <button
                            onClick={() => { handleLoadMatchToScore(m); }}
                            className="col-span-1 flex items-center gap-1.5 px-2 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg active:scale-95 transition-transform"
                          >
                            <Trophy className="w-4 h-4" />
                            <span>{m.status === 'completed' ? 'Scorecard' : 'Score'}</span>
                          </button>

                          {/* Live Viewer preview */}
                          <button
                            onClick={() => {
                              // Deep check
                              window.location.hash = `matchId=${m.id}`;
                              window.location.search = `?matchId=${m.id}`;
                              window.location.reload();
                            }}
                            className="flex items-center gap-1.5 px-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg active:scale-95 transition-transform"
                          >
                            <TrendingUp className="w-4 h-4" />
                            <span>Live</span>
                          </button>

                          <button
                            onClick={() => handleDeleteMatch(m.id)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center font-bold"
                            title="Delete Scorecard"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}


        {/* ======================= SCREEN 2: CREATE MATCH ======================= */}
        {currentView === 'create' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`p-6 rounded-2xl border space-y-6 ${
              isSunlight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-xl'
            }`}
            id="match-registration-screen"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-2xl font-bold font-display">Create Match</h2>
              <button 
                onClick={() => setCurrentView('home')}
                className="p-1 px-3 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg dark:bg-slate-800 font-bold"
              >
                Back
              </button>
            </div>

            <div className="space-y-4">
              {/* Match Name Input */}
              <div className="space-y-1">
                <label className="text-sm font-bold uppercase tracking-wider block opacity-70">Match Identifier</label>
                <input 
                  type="text" 
                  value={matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                  className="w-full p-4 text-base md:text-lg border-2 rounded-xl focus:border-amber-400 focus:outline-none dark:bg-slate-800 dark:border-slate-700"
                  placeholder="e.g. Utrecht Derby League"
                />
              </div>

              {/* Team names inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold uppercase tracking-wider block text-sky-600 dark:text-sky-400">Team A Name</label>
                  <input 
                    type="text" 
                    value={teamAName}
                    onChange={(e) => setTeamAName(e.target.value)}
                    className="w-full p-4 border-2 rounded-xl focus:border-amber-400 focus:outline-none dark:bg-slate-800 dark:border-slate-700 font-bold"
                    placeholder="Home Team A"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold uppercase tracking-wider block text-rose-600 dark:text-rose-400 font-bold">Team B Name</label>
                  <input 
                    type="text" 
                    value={teamBName}
                    onChange={(e) => setTeamBName(e.target.value)}
                    className="w-full p-4 border-2 rounded-xl focus:border-amber-400 focus:outline-none dark:bg-slate-800 dark:border-slate-700 font-bold"
                    placeholder="Guest Team B"
                  />
                </div>
              </div>

              {/* Numerical Picker to avoid typing outdoors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                
                {/* OVERS PICKER */}
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider block opacity-70">Overs Count</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { triggerHapticFeedback(); setOversCount(prev => Math.max(1, prev - 1)); }}
                      className="p-4 bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold text-xl w-14"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-display font-bold text-2xl py-3 border-2 rounded-xl dark:bg-slate-800 dark:border-slate-700">
                      {oversCount} 
                    </span>
                    <button
                      type="button"
                      onClick={() => { triggerHapticFeedback(); setOversCount(prev => Math.min(100, prev + 1)); }}
                      className="p-4 bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold text-xl w-14"
                    >
                      +
                    </button>
                  </div>
                  {/* Quick-tap presets of typical cricket levels */}
                  <div className="flex gap-2 justify-center">
                    {[5, 10, 16, 20].map(ov => (
                      <button
                        key={ov}
                        type="button"
                        onClick={() => { triggerHapticFeedback(); setOversCount(ov); }}
                        className={`text-xs px-3 py-1.5 font-bold rounded-lg ${
                          oversCount === ov 
                            ? 'bg-amber-400 text-slate-950 font-bold' 
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        {ov} Ov
                      </button>
                    ))}
                  </div>
                </div>

                {/* PLAYERS LIMIT PICKER */}
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider block opacity-70">Players Per Team</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { triggerHapticFeedback(); setPlayersLimit(prev => Math.max(2, prev - 1)); }}
                      className="p-4 bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold text-xl w-14"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-display font-bold text-2xl py-3 border-2 rounded-xl dark:bg-slate-800 dark:border-slate-700">
                      {playersLimit}
                    </span>
                    <button
                      type="button"
                      onClick={() => { triggerHapticFeedback(); setPlayersLimit(prev => Math.min(30, prev + 1)); }}
                      className="p-4 bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold text-xl w-14"
                    >
                      +
                    </button>
                  </div>
                  {/* Presets */}
                  <div className="flex gap-2 justify-center">
                    {[6, 8, 11].map(pl => (
                      <button
                        key={pl}
                        type="button"
                        onClick={() => { triggerHapticFeedback(); setPlayersLimit(pl); }}
                        className={`text-xs px-3 py-1.5 font-bold rounded-lg ${
                          playersLimit === pl 
                            ? 'bg-amber-400 text-slate-950 font-bold' 
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        {pl} Players
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Custom Rules Section */}
              <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-850/50 border-slate-200 dark:border-slate-800 space-y-3.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>⚙️ Match Options & Rules</span>
                </h4>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableHalfwayRules}
                    onChange={(e) => { triggerHapticFeedback(); setEnableHalfwayRules(e.target.checked); }}
                    className="w-5 h-5 accent-emerald-500 rounded border-2 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 mt-0.5"
                    id="checkbox-enable-halfway-rules"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold block text-slate-800 dark:text-slate-100">
                      Enable Halfway Wide/No-Ball Rule
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block leading-normal mt-0.5">
                      Before halfway: wide/NB is worth 3 runs and counts as a legal delivery. 
                      After halfway: wide/NB is worth 1 run and must be bowled again.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action and trigger */}
              <button
                onClick={handleInitiateMatchCreation}
                className="w-full mt-6 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-display font-extrabold text-xl rounded-xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
                id="create-match-submit-button"
              >
                <Users className="w-6 h-6" />
                <span>Next: Setup Squads</span>
              </button>
            </div>
          </motion.div>
        )}


        {/* ======================= SCREEN 3: TEAM SQUAD BUILDER ======================= */}
        {currentView === 'squads' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
            id="squad-builder-screen"
          >
            {/* Top Prompt Card */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${
              isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-850'
            }`}>
              <div>
                <h2 className="text-xl font-extrabold font-display leading-tight">Config Playing Squads</h2>
                <p className="text-sm opacity-70">Edit names if you want, or immediately tap "Go to Toss" below!</p>
              </div>
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setCurrentView('toss');
                }}
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-base font-extrabold rounded-xl shadow"
              >
                Go to Toss 🎲
              </button>
            </div>

            {/* Squad lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* TEAM A SQUAD */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-sky-600 dark:text-sky-400 font-display text-lg">{teamAName}</h3>
                  <span className="text-xs font-mono font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 rounded">
                    {teamASquad.length} players
                  </span>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {teamASquad.map((player, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs font-mono w-6 text-slate-400 font-bold">{idx + 1}</span>
                      <input 
                        type="text"
                        value={player}
                        onChange={(e) => handleEditPlayerName('A', idx, e.target.value)}
                        className="flex-1 p-2 text-sm border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 font-bold text-slate-850 dark:text-slate-105"
                      />
                      <button
                        onClick={() => handleRemovePlayerSlot('A', idx)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded"
                        title="Remove Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAddPlayerSlot('A')}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Player Custom Slot
                </button>
              </div>

              {/* TEAM B SQUAD */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-rose-600 dark:text-rose-400 font-display text-lg">{teamBName}</h3>
                  <span className="text-xs font-mono font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded">
                    {teamBSquad.length} players
                  </span>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {teamBSquad.map((player, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs font-mono w-6 text-slate-400 font-bold">{idx + 1}</span>
                      <input 
                        type="text"
                        value={player}
                        onChange={(e) => handleEditPlayerName('B', idx, e.target.value)}
                        className="flex-1 p-2 text-sm border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 font-bold text-slate-850 dark:text-slate-105"
                      />
                      <button
                        onClick={() => handleRemovePlayerSlot('B', idx)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded"
                        title="Remove Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAddPlayerSlot('B')}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Player Custom Slot
                </button>
              </div>

            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentView('create')}
                className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-850 dark:text-white font-extrabold rounded-xl"
              >
                Back Settings
              </button>
              <button
                onClick={() => { triggerHapticFeedback(); setCurrentView('toss'); }}
                className="flex-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold font-display text-lg rounded-xl shadow-md"
              >
                Continue to Toss Screen 🎲
              </button>
            </div>
          </motion.div>
        )}


        {/* ======================= SCREEN 4: TOSS VIEW ======================= */}
        {currentView === 'toss' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-6 rounded-2xl border space-y-6 ${
              isSunlight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-xl'
            }`}
            id="toss-screen"
          >
            <div className="text-center space-y-1">
              <span className="text-4xl animate-bounce inline-block">🪙</span>
              <h2 className="text-2xl font-bold font-display">Toss Ceremony</h2>
              <p className="text-sm opacity-70">Which team won the coin toss flips outdoors?</p>
            </div>

            <div className="space-y-4">
              {/* Step 1: Who won toss */}
              <div className="space-y-2">
                <label className="text-center block text-sm font-bold uppercase tracking-wider opacity-60">Step 1: Pick Toss Winner</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { triggerHapticFeedback(); setTossWonBy('A'); }}
                    className={`p-6 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2 transition-all ${
                      tossWonBy === 'A'
                        ? 'bg-sky-50 border-sky-500 dark:bg-sky-950 text-sky-800 dark:text-sky-300 scale-102 ring-4 ring-sky-400/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <span className="text-lg font-extrabold font-display block uppercase">{teamAName}</span>
                    <span className="text-xs bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300 px-2 py-0.5 rounded font-bold">
                      Team A
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { triggerHapticFeedback(); setTossWonBy('B'); }}
                    className={`p-6 rounded-2xl border-2 text-center flex flex-col items-center justify-center gap-2 transition-all ${
                      tossWonBy === 'B'
                        ? 'bg-rose-50 border-rose-500 dark:bg-rose-950 text-rose-800 dark:text-rose-300 scale-102 ring-4 ring-rose-400/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <span className="text-lg font-extrabold font-display block uppercase">{teamBName}</span>
                    <span className="text-xs bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300 px-2 py-0.5 rounded font-bold">
                      Team B
                    </span>
                  </button>
                </div>
              </div>

              {/* Step 2: Decision */}
              {tossWonBy && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 pt-2 border-t border-dashed"
                >
                  <label className="text-center block text-sm font-bold uppercase tracking-wider opacity-60">
                    Step 2: {tossWonBy === 'A' ? teamAName : teamBName} Elected to:
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => { triggerHapticFeedback(); setTossDecision('bat'); }}
                      className={`p-5 rounded-xl border-2 text-center flex flex-col items-center justify-center gap-1 font-bold ${
                        tossDecision === 'bat'
                          ? 'bg-emerald-500 text-white border-emerald-600 scale-102 ring-4 ring-emerald-400/30 font-extrabold'
                          : 'border-slate-250 hover:bg-slate-55 dark:border-slate-800'
                      }`}
                    >
                      <span className="text-2xl">🏏</span>
                      <span className="text-lg font-display">Bat First</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { triggerHapticFeedback(); setTossDecision('bowl'); }}
                      className={`p-5 rounded-xl border-2 text-center flex flex-col items-center justify-center gap-1 font-bold ${
                        tossDecision === 'bowl'
                          ? 'bg-teal-600 text-white border-teal-700 scale-102 ring-4 ring-teal-400/30 font-extrabold'
                          : 'border-slate-250 hover:bg-slate-55 dark:border-slate-800'
                      }`}
                    >
                      <span className="text-2xl">🥎</span>
                      <span className="text-lg font-display">Bowl First</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setCurrentView('squads')}
                  className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 text-slate-850 dark:bg-slate-800 dark:text-white font-extrabold rounded-xl"
                >
                  Squad Setup
                </button>
                <button
                  type="button"
                  disabled={!tossDecision}
                  onClick={handleFinalizeTossAndStart}
                  className={`flex-2 py-4 text-white font-display font-black text-xl rounded-xl shadow-lg active:scale-98 transition-all ${
                    tossDecision 
                      ? 'bg-emerald-600 hover:bg-emerald-500' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-650'
                  }`}
                  id="start-match-ceremony-button"
                >
                  Let's Play! 🏏
                </button>
              </div>

            </div>
          </motion.div>
        )}


        {/* ======================= SCREEN 5: LIVE SCORING PANEL ======================= */}
        {currentView === 'scoring' && currentMatch && (
          <div className="space-y-4" id="scoring-dash-view">
            
            {/* MATCH SPEC BARS */}
            <div className={`p-2 px-3 rounded-lg flex justify-between items-center text-xs font-mono select-none ${
              isSunlight ? 'bg-slate-100' : 'bg-slate-900 border border-slate-800'
            }`}>
              <div className="flex items-center gap-1 font-bold text-slate-550">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span>{currentMatch.matchName}</span>
              </div>
              <div className="flex gap-2">
                <span>{currentMatch.overs} Overs Limit</span>
                <span>•</span>
                <span>{currentMatch.playersPerTeam} Players Max</span>
              </div>
            </div>

            {/* HIGH CONTRAST SCOREBOARD TOP SECTION */}
            {(() => {
              const innIdx = currentMatch.currentInningsIndex;
              const inn = innIdx === 1 ? currentMatch.innings1 : currentMatch.innings2;
              if (!inn) return null;

              const battingName = inn.battingTeamId === 'A' ? currentMatch.teamAName : currentMatch.teamBName;
              const bowlingName = inn.bowlingTeamId === 'A' ? currentMatch.teamAName : currentMatch.teamBName;

              const crr = calculateRunRate(inn.runs, inn.balls);
              
              // Target for Innings 2
              const isSecondInning = innIdx === 2;
              const firstInningScore = currentMatch.innings1?.runs || 0;
              const target = firstInningScore + 1;
              const requiredRuns = target - inn.runs;
              const remainingBalls = (currentMatch.overs * 6) - inn.balls;
              const rrr = remainingBalls > 0 ? ((requiredRuns / (remainingBalls / 6))).toFixed(2) : '0.00';

              return (
                <div className={`rounded-3xl border-2 shadow-lg select-none flex flex-col overflow-hidden ${
                  isSunlight 
                    ? 'bg-white border-slate-300 text-slate-950' 
                    : 'bg-slate-900 border-slate-800 text-white'
                }`} id="digital-scorebox">
                  
                  {/* Top Bar Team Info */}
                  <div className={`px-5 py-3 flex justify-between items-center border-b ${
                    isSunlight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-850'
                  }`}>
                    <div>
                      <span className="text-[11px] font-mono tracking-widest block uppercase text-slate-400 font-extrabold pb-0.5">BATTING CURRENTLY</span>
                      <h3 className="text-xl md:text-2xl font-bold font-display uppercase tracking-tight flex items-center gap-1.5 text-amber-500">
                        {battingName}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-bold px-2.5 py-1 rounded-full uppercase">
                        Innings {innIdx}
                      </span>
                    </div>
                  </div>

                  {/* Gigantic Score Display */}
                  <div className="p-6 pb-2 text-center flex flex-col md:flex-row justify-around items-center gap-4">
                    <div>
                      {/* HUGE NUMBERS FOR HIGH LEGIBILITY */}
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-6xl md:text-7xl font-display font-black tracking-tighter" id="huge-match-runs">
                          {inn.runs}
                        </span>
                        <span className="text-4xl md:text-5xl font-light text-slate-400">/</span>
                        <span className="text-4xl md:text-5xl font-bold text-red-500" id="huge-match-wickets">
                          {inn.wickets}
                        </span>
                      </div>
                      
                      {/* Innings completed trigger check */}
                      <p className="text-xl text-slate-500 font-semibold font-mono mt-0.5">
                        {ballsToOvers(inn.balls)} <span className="text-sm">Overs ({inn.balls} balls)</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-8 text-center md:text-left min-w-[200px]">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Run Rate (CRR)</span>
                        <span className="text-xl font-bold font-mono">{crr}</span>
                      </div>
                      <div className="text-left text-xs space-y-1 bg-slate-50 dark:bg-slate-850 p-2 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 min-w-[130px]">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-500 uppercase text-[9px] tracking-tight">Total Extras:</span>
                          <span className="font-mono text-indigo-500 font-extrabold">
                            {inn.extras.wides + inn.extras.noBalls + inn.extras.byes + inn.extras.legByes}
                          </span>
                        </div>
                        <div className="flex justify-between pl-1 text-[11px]">
                          <span className="text-slate-400">↳ Wides:</span>
                          <span className="font-bold font-mono">{inn.extras.wides}</span>
                        </div>
                        <div className="flex justify-between pl-1 text-[11px]">
                          <span className="text-slate-400">↳ No-Balls:</span>
                          <span className="font-bold font-mono">{inn.extras.noBalls}</span>
                        </div>
                        <div className="flex justify-between pl-1 text-[11px]">
                          <span className="text-slate-400">↳ Off-Bat NB:</span>
                          <span className="font-bold font-mono text-emerald-500">
                            {(() => {
                              const nbBattingRuns = currentMatch.ballHistory
                                .filter(b => b.inningIndex === innIdx && b.extrasType === 'nb')
                                .reduce((sum, b) => sum + b.runs, 0);
                              return nbBattingRuns;
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between pl-1 text-[10px] opacity-70">
                          <span className="text-slate-400">↳ Byes/LByes:</span>
                          <span className="font-semibold font-mono">{inn.extras.byes + inn.extras.legByes}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SPECS FOR FIRST INNING TARGET COMPLETED FOR SPECTATORS OR SECOND TEAM SCORES */}
                  {isSecondInning && (
                    <div className="bg-amber-400 text-slate-950 px-5 py-3 text-center border-t border-amber-500 font-extrabold flex flex-col sm:flex-row justify-around items-center gap-1.5 text-base shadow-inner">
                      <div>
                        Target: <span className="font-mono text-lg">{target}</span>
                      </div>
                      <div>
                        Need <span className="bg-white px-2 py-0.5 rounded font-mono text-lg text-red-700">{requiredRuns}</span> runs off <span className="font-mono text-lg">{remainingBalls}</span> legal deliveries
                      </div>
                      <div>
                        Req RR: <span className="font-mono text-lg">{rrr}</span>
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* ACTIVE BATSMEN & CURRENT BOWLER STATUS CONTAINER (HIGH CONTRAST INTERACTION) */}
            {(() => {
              const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
              if (!inn) return null;

              const b1 = inn.battingOrder.find(p => p.id === inn.currentBatter1Id);
              const b2 = inn.battingOrder.find(p => p.id === inn.currentBatter2Id);
              const bowler = inn.bowlingOrder.find(b => b.id === inn.currentBowlerId);

              const fieldingTeam = inn.bowlingTeamId;
              const fieldingSquad = fieldingTeam === 'A' ? teamASquad : teamBSquad;
              const battingTeam = inn.battingTeamId;
              const battingSquad = battingTeam === 'A' ? teamASquad : teamBSquad;

              // Check if batsman replacement is needed (e.g. striker is out but other spots are active)
              const hasNoBatsmanSlot = (!inn.currentBatter1Id || !inn.currentBatter2Id);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* BATSMEN CARD SELECTION */}
                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <h4 className="font-bold flex items-center gap-1 text-sm uppercase text-slate-500 tracking-wider">
                        <span>🏏 batsmen</span>
                      </h4>
                      <button
                        onClick={handleManualStrikeSwap}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-white rounded-md flex items-center gap-1 font-bold active:scale-95 transition-transform"
                        title="Swap strike ends manually"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Swap Strike</span>
                      </button>
                    </div>

                    <div className="space-y-2 select-none">
                      {/* BATTER 1 CARD CARD */}
                      {b1 ? (
                        <div 
                          onClick={() => {
                            triggerHapticFeedback();
                            const innRef = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                            if (innRef) {
                              innRef.strikerId = b1.id;
                              setCurrentMatch({ ...currentMatch });
                              triggerToast(`⭐️ ${b1.name} is on strike`);
                            }
                          }}
                          className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                            inn.strikerId === b1.id 
                              ? 'bg-amber-400 border-amber-500 text-slate-950 scale-101 shadow-sm font-extrabold' 
                              : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                          }`}
                          id={`batsman-row-${b1.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {inn.strikerId === b1.id ? '⭐️' : '🏏'}
                            </span>
                            <div>
                              <p className="font-bold truncate text-base">{b1.name}</p>
                              <span className="text-xs opacity-60">Striker click to change</span>
                            </div>
                          </div>
                          
                          <div className="text-right font-mono">
                            <p className="text-xl font-bold">{b1.runs} <span className="text-xs font-normal">({b1.balls})</span></p>
                            <p className="text-[10px] opacity-60">4s: {b1.fours} • 6s: {b1.sixes}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border-2 border-dashed border-rose-500 rounded-xl bg-rose-500/5 text-center text-rose-500 font-extrabold text-sm select-none py-4">
                          ⚠️ Batter 1 is Out! Click incoming batsman card below.
                        </div>
                      )}

                      {/* BATTER 2 CARD CARD */}
                      {b2 ? (
                        <div 
                          onClick={() => {
                            triggerHapticFeedback();
                            const innRef = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                            if (innRef) {
                              innRef.strikerId = b2.id;
                              setCurrentMatch({ ...currentMatch });
                              triggerToast(`⭐️ ${b2.name} is on strike`);
                            }
                          }}
                          className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                            inn.strikerId === b2.id 
                              ? 'bg-amber-400 border-amber-500 text-slate-950 scale-101 shadow-sm font-extrabold' 
                              : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                          }`}
                          id={`batsman-row-${b2.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {inn.strikerId === b2.id ? '⭐️' : '🏏'}
                            </span>
                            <div>
                              <p className="font-bold truncate text-base">{b2.name}</p>
                              <span className="text-xs opacity-60">Striker click to change</span>
                            </div>
                          </div>
                          
                          <div className="text-right font-mono">
                            <p className="text-xl font-bold">{b2.runs} <span className="text-xs font-normal">({b2.balls})</span></p>
                            <p className="text-[10px] opacity-60">4s: {b2.fours} • 6s: {b2.sixes}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border-2 border-dashed border-rose-500 rounded-xl bg-rose-500/5 text-center text-rose-500 font-extrabold text-sm select-none py-4">
                          ⚠️ Batter 2 is Out! Click incoming batsman card below.
                        </div>
                      )}

                    </div>

                    {/* SELECT INCOMING BATTER INTERNALLY */}
                    {hasNoBatsmanSlot && (
                      <div className="pt-2 border-t border-dashed space-y-2 select-none">
                        <span className="text-[10px] text-slate-400 uppercase block font-black">Choose replacement batsman:</span>
                        <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
                          {battingSquad.map((name, i) => {
                            const bId = `p-${battingTeam}-${i + 1}`;
                            const isOut = inn.battingOrder.some(p => p.id === bId && p.out);
                            const inPlay = inn.currentBatter1Id === bId || inn.currentBatter2Id === bId;

                            if (isOut || inPlay) return null;

                            return (
                              <button
                                key={bId}
                                onClick={() => handleAssignIncomingBatsman(i)}
                                className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-extrabold hover:bg-indigo-100 active:scale-95 transition-transform"
                                id={`assign-batsman-${bId}`}
                              >
                                {name} ({i + 1})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BOWLER CARD SECTION */}
                  <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
                    isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="border-b pb-1.5 flex justify-between items-center">
                      <h4 className="font-bold flex items-center gap-1 text-sm uppercase text-slate-500 tracking-wider">
                        <span>🥎 current bowler</span>
                      </h4>
                      {bowler && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    {bowler ? (
                      <div className="p-4 rounded-xl border flex justify-between items-center bg-slate-50 dark:bg-slate-950 select-none">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🥎</span>
                          <div>
                            <p className="font-extrabold text-lg text-indigo-600 dark:text-indigo-400">{bowler.name}</p>
                            <p className="text-xs opacity-60">Active Bowler stats</p>
                          </div>
                        </div>

                        <div className="text-right font-mono text-base font-bold">
                          <p className="text-lg font-extrabold">{bowler.wickets} <span className="text-xs font-normal">Wickets</span></p>
                          <p className="text-sm">{bowler.runs} Runs / {ballsToOvers(bowler.balls)} overs</p>
                          {bowler.balls > 0 && <p className="text-[10px] opacity-60">Econ: {calculateRunRate(bowler.runs, bowler.balls)}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-dashed border-indigo-400 bg-indigo-400/5 text-indigo-500 rounded-xl text-center font-extrabold text-sm select-none py-6">
                        🚨 No Bowler Assigned! Please pick one below.
                      </div>
                    )}

                    {/* SELECT FIELDING PLAYER AS BOWLER */}
                    <div className="pt-2 border-t border-dashed space-y-2 select-none">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                        {bowler ? '🔄 Assign Bowler for Current/New Over:' : '🥎 Select Active Bowler Card:'}
                      </span>
                      <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
                        {fieldingSquad.map((name, i) => {
                          const bId = `p-${fieldingTeam}-${i + 1}`;
                          const isCurrent = inn.currentBowlerId === bId;

                          return (
                            <button
                              key={bId}
                              onClick={() => { handleAssignActiveBowler(i); }}
                              className={`px-3 py-2 text-sm font-extrabold border rounded active:scale-95 transition-transform ${
                                isCurrent 
                                  ? 'bg-amber-400 text-slate-950 border-amber-500 font-bold shadow' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350'
                              }`}
                              id={`assign-bowler-${bId}`}
                            >
                              {name} ({i + 1})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* PREVIOUS 6 DELIVERIES DOT CHIPS */}
            {(() => {
              const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
              if (!inn) return null;

              return (
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-3 select-none ${
                  isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div>
                    <h5 className="text-[11px] font-mono tracking-widest text-slate-400 uppercase font-black">THIS OVER DEVELOPMENTS</h5>
                    <p className="text-xs opacity-60">Updated on every ball thrown</p>
                  </div>

                  <div className="flex gap-2.5 flex-wrap items-center">
                    {inn.overHistory.length === 0 ? (
                      <span className="text-xs italic text-slate-400">Waiting first ball...</span>
                    ) : (
                      inn.overHistory.map((val, i) => {
                        let badgeCol = 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100';
                        if (val.includes('4')) badgeCol = 'bg-emerald-500 text-white font-extrabold';
                        if (val.includes('6')) badgeCol = 'bg-cyan-500 text-white font-extrabold animate-bounce';
                        if (val.includes('Wd') || val.includes('Nb')) badgeCol = 'bg-amber-400 text-slate-950 font-bold';
                        if (val.includes('W')) badgeCol = 'bg-red-600 text-white font-black scale-105';

                        return (
                          <span 
                            key={i} 
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 border-transparent shadow-inner ${badgeCol}`}
                          >
                            {val}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* BIG GIANT colorful SCORING BUTTONS (ONE-HAND MODE, HUGE FONTS) */}
            <div className={`p-4 rounded-2xl border space-y-4 shadow-md ${
              isSunlight ? 'bg-amber-100/50 border-amber-300' : 'bg-slate-900/65 border-slate-800'
            }`}>
              
              {/* Secondary Extra scoring modifiers (Byes, Legbyes) */}
              <div className="flex items-center gap-2 select-none justify-between border-b pb-3 border-dashed border-slate-350 dark:border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">SECONDARY MODIFIERS:</span>
                <div className="flex gap-2">
                  {[
                    { id: 'by', label: '🏏 BYES' },
                    { id: 'lb', label: '🥎 LEGBYES' }
                  ].map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => {
                        triggerHapticFeedback();
                        setScoringExtrasMode(scoringExtrasMode === ex.id ? null : ex.id as any);
                      }}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                        scoringExtrasMode === ex.id 
                          ? 'bg-amber-400 text-slate-950 border border-amber-500 scale-102 font-bold' 
                          : 'bg-slate-200 text-slate-850 dark:bg-slate-800 dark:text-slate-350 hover:bg-slate-300'
                      }`}
                      id={`extra-modifier-${ex.id}`}
                    >
                      {ex.label}
                    </button>
                  ))}
                  {scoringExtrasMode && (
                    <span className="text-[9px] font-mono text-red-500 animate-pulse font-extrabold self-center">
                      *TAP RUNS BUTTON NEXT
                    </span>
                  )}
                </div>
              </div>

              {/* CORE SCORING RUN GRID (GIGANTIC BUTTONS MINIMUM 60x60PX) */}
              <div className="grid grid-cols-3 gap-3">
                {/* 0 dot runs */}
                <button
                  onClick={() => handleScoreEvent(0)}
                  className="p-5 bg-slate-200 hover:bg-slate-100 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow border-b-4 border-slate-350 dark:border-slate-900 select-none py-5"
                  id="score-btn-0"
                >
                  <span className="text-3xl font-display font-black">0</span>
                  <span className="text-[9px] font-mono uppercase opacity-75 font-semibold">Dot Ball</span>
                </button>

                {/* 1 runs */}
                <button
                  onClick={() => handleScoreEvent(1)}
                  className="p-5 bg-sky-200 hover:bg-sky-100 text-sky-950 dark:bg-sky-900 dark:hover:bg-sky-800 dark:text-sky-100 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow border-b-4 border-sky-350 dark:border-sky-950 select-none py-5"
                  id="score-btn-1"
                >
                  <span className="text-3xl font-display font-black">1</span>
                  <span className="text-[9px] font-mono uppercase opacity-75 font-semibold">Single</span>
                </button>

                {/* 2 runs */}
                <button
                  onClick={() => handleScoreEvent(2)}
                  className="p-5 bg-indigo-200 hover:bg-indigo-100 text-indigo-950 dark:bg-indigo-900 dark:hover:bg-indigo-800 dark:text-indigo-100 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow border-b-4 border-indigo-350 dark:border-indigo-950 select-none py-5"
                  id="score-btn-2"
                >
                  <span className="text-3xl font-display font-black">2</span>
                  <span className="text-[9px] font-mono uppercase opacity-75 font-semibold">Double</span>
                </button>

                {/* 3 runs */}
                <button
                  onClick={() => handleScoreEvent(3)}
                  className="p-5 bg-purple-200 hover:bg-purple-100 text-purple-950 dark:bg-purple-900 dark:hover:bg-purple-800 dark:text-purple-150 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow border-b-4 border-purple-350 dark:border-purple-950 select-none py-5"
                  id="score-btn-3"
                >
                  <span className="text-3xl font-display font-black">3</span>
                  <span className="text-[9px] font-mono uppercase opacity-75 font-semibold">Three</span>
                </button>

                {/* 4 runs (Bright boundary emerald!) */}
                <button
                  onClick={() => handleScoreEvent(4)}
                  className="p-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-md border-b-4 border-emerald-700 select-none py-5"
                  id="score-btn-4"
                >
                  <span className="text-3.5xl font-display font-black font-extrabold">4️⃣🏏</span>
                  <span className="text-[9px] font-mono uppercase opacity-85 font-black">Boundary</span>
                </button>

                {/* 6 runs (Neon boundary Indigo) */}
                <button
                  onClick={() => handleScoreEvent(6)}
                  className="p-5 bg-cyan-600 hover:bg-cyan-505 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-md border-b-4 border-cyan-805 select-none py-5"
                  id="score-btn-6"
                >
                  <span className="text-3.5xl font-display font-black font-extrabold">6️⃣🚀</span>
                  <span className="text-[9px] font-mono uppercase opacity-85 font-black">Maximum</span>
                </button>
              </div>

              {/* AUTOMATED EXTRA DELIVERIES row (WIDE, NO BALL) */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                {/* WIDE ACTION */}
                <button
                  onClick={handleWideClick}
                  className="p-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 font-extrabold text-sm shadow border-b-4 border-amber-600 select-none py-4"
                  id="score-btn-wide"
                >
                  <span className="text-2xl">🚫</span>
                  <span className="font-display font-black uppercase tracking-tight">WIDE (Wd)</span>
                  <span className="text-[9px] font-mono opacity-80 uppercase leading-none mt-1">
                    {(() => {
                      const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                      if (!inn) return '';
                      const halfwayBalls = (currentMatch.overs * 6) / 2;
                      const isBefore = currentMatch.enableHalfwayRules && inn.balls < halfwayBalls;
                      return currentMatch.enableHalfwayRules ? (isBefore ? '🔥 3 Runs (Legal)' : '❄️ 1 Run (Extra bowl)') : '1 Run (Extra bowl)';
                    })()}
                  </span>
                </button>

                {/* NO BALL ACTION */}
                <button
                  onClick={() => { triggerHapticFeedback(); setNoBallPromptOpen(true); }}
                  className="p-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-95 font-extrabold text-sm shadow border-b-4 border-amber-600 select-none py-4"
                  id="score-btn-noball"
                >
                  <span className="text-2xl">⚡</span>
                  <span className="font-display font-black uppercase tracking-tight">NO BALL (NB)</span>
                  <span className="text-[9px] font-mono opacity-80 uppercase leading-none mt-1">
                    {(() => {
                      const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                      if (!inn) return '';
                      const halfwayBalls = (currentMatch.overs * 6) / 2;
                      const isBefore = currentMatch.enableHalfwayRules && inn.balls < halfwayBalls;
                      return currentMatch.enableHalfwayRules ? (isBefore ? '🔥 3 Runs + Batter' : '❄️ 1 Run + Batter') : '1 Run + Batter';
                    })()}
                  </span>
                </button>
              </div>

              {/* SPECIAL ACTIONS ROW (WICKET OR UNDO) */}
              <div className="grid grid-cols-2 gap-3.5 select-none pt-1">
                {/* WICKET TRIGGER */}
                <button
                  onClick={handleWicketPromptOpen}
                  className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl flex items-center justify-center gap-2 active:scale-95 shadow-md border-b-4 border-red-800 py-4.5 font-extrabold text-base text-center"
                  id="score-btn-wicket"
                >
                  <span className="text-xl">❌</span>
                  <span>WICKET OUT!</span>
                </button>

                {/* UNDO RECORD */}
                <button
                  onClick={handleUndoEvent}
                  disabled={currentMatch.ballHistory.length === 0}
                  className={`p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 shadow border-b-4 py-4.5 font-bold text-base select-none ${
                    currentMatch.ballHistory.length > 0
                      ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-900'
                      : 'bg-slate-205 text-slate-400 border-transparent cursor-not-allowed dark:bg-slate-800 dark:text-slate-650'
                  }`}
                  id="score-btn-undo"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>UNDO BALL</span>
                </button>
              </div>

            </div>

            {/* WICKET SELECTION POPUP SUB-OVERLAY (IF ACTIVE) */}
            <AnimatePresence>
              {wicketConfig.showOptions && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-5 rounded-2xl border-2 space-y-4 ${
                    isSunlight ? 'bg-red-50 border-red-350 text-slate-900' : 'bg-slate-900 border-red-900 text-white'
                  }`}
                  id="wicket-editor-panel"
                >
                  <div className="flex justify-between items-center border-b pb-2 border-red-200/50">
                    <h5 className="font-extrabold text-red-600 text-lg flex items-center gap-1.5 uppercase tracking-tight">
                      <span>🎯 Dismissal Method</span>
                    </h5>
                    <button 
                      onClick={() => setWicketConfig({ showOptions: false, type: null, batsmanId: null })}
                      className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Pick Wicket Type */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'bowled', img: '🪵', label: 'Bowled' },
                      { id: 'caught', img: '🤲', label: 'Caught' },
                      { id: 'run out', img: '☄️', label: 'Run Out' },
                      { id: 'lbw', img: '🦵', label: 'LBW' },
                      { id: 'stumped', img: '🧤', label: 'Stumped' },
                      { id: 'other', img: '🏏', label: 'Other' }
                    ].map(wk => (
                      <button
                        key={wk.id}
                        onClick={() => setWicketConfig({ ...wicketConfig, type: wk.id as any })}
                        className={`p-3 rounded-lg border text-center font-bold flex flex-col items-center justify-center gap-1 text-sm ${
                          wicketConfig.type === wk.id
                            ? 'bg-rose-600 text-white border-rose-700 font-black scale-102 shadow-md'
                            : 'bg-white border-slate-300 dark:bg-slate-850 dark:border-slate-700'
                        }`}
                        id={`wicket-type-${wk.id}`}
                      >
                        <span className="text-xl">{wk.img}</span>
                        <span>{wk.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Pick which batsman got out */}
                  {currentMatch && (() => {
                    const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                    if (!inn) return null;
                    const b1 = inn.battingOrder.find(p => p.id === inn.currentBatter1Id);
                    const b2 = inn.battingOrder.find(p => p.id === inn.currentBatter2Id);

                    return (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider opacity-60">Which Batter is dismissed?</label>
                        <div className="grid grid-cols-2 gap-4">
                          {b1 && (
                            <button
                              onClick={() => setWicketConfig({ ...wicketConfig, batsmanId: b1.id })}
                              className={`p-3 rounded-xl border text-center font-extrabold ${
                                wicketConfig.batsmanId === b1.id
                                  ? 'bg-red-500 text-white border-red-600 font-black'
                                  : 'bg-white border-slate-300 dark:bg-slate-850 dark:border-slate-750'
                              }`}
                            >
                              {b1.name} (Striker end)
                            </button>
                          )}
                          {b2 && (
                            <button
                              onClick={() => setWicketConfig({ ...wicketConfig, batsmanId: b2.id })}
                              className={`p-3 rounded-xl border text-center font-extrabold ${
                                wicketConfig.batsmanId === b2.id
                                  ? 'bg-red-500 text-white border-red-600 font-black'
                                  : 'bg-white border-slate-300 dark:bg-slate-850 dark:border-slate-750'
                              }`}
                            >
                              {b2.name} (Non-striker)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    disabled={!wicketConfig.type || !wicketConfig.batsmanId}
                    onClick={submitWicketScoring}
                    className={`w-full py-3 text-white font-extrabold rounded-lg shadow-md ${
                      wicketConfig.type && wicketConfig.batsmanId
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800'
                    }`}
                    id="submit-wicket-confirm-button"
                  >
                    Confirm Dismissal Out ❌
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* NO-BALL BATTER RUNS SELECTOR POPUP (IF ACTIVE) */}
            <AnimatePresence>
              {noBallPromptOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-5 rounded-2xl border-2 space-y-4 ${
                    isSunlight ? 'bg-amber-50 border-amber-300 text-slate-905' : 'bg-slate-900 border-amber-900 text-white'
                  }`}
                  id="noball-runs-editor-panel"
                >
                  <div className="flex justify-between items-center border-b pb-2 border-amber-200/50">
                    <h5 className="font-extrabold text-amber-600 dark:text-amber-405 text-lg flex items-center gap-1.5 uppercase tracking-tight">
                      <span>⚡ No-Ball Batting Runs</span>
                    </h5>
                    <button
                      onClick={() => setNoBallPromptOpen(false)}
                      className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded dark:bg-slate-800 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                    Please select the number of runs scored by the batsman off this No Ball. This is in addition to the No Ball local extra run(s).
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2, 3, 4, 6].map(runsVal => (
                      <button
                        key={runsVal}
                        onClick={() => submitNoBallRuns(runsVal)}
                        className="py-4 rounded-xl border text-center font-black text-xl bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center"
                        id={`noball-runs-val-${runsVal}`}
                      >
                        <span className="text-2.5xl font-display">{runsVal}</span>
                        <span className="text-[9px] font-mono uppercase opacity-60 font-medium">
                          {runsVal === 4 ? 'FOUR🏏' : runsVal === 6 ? 'SIX🚀' : 'Runs'}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* DETAILED SCORECARD EXPANSION CARD */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
            }`}>
              <button
                onClick={() => { triggerHapticFeedback(); setShowDetailedScorecard(!showDetailedScorecard); }}
                className="w-full flex items-center justify-between text-base font-extrabold hover:text-indigo-650"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <span>Show Detailed Team Scorecards</span>
                </div>
                <span className="text-xl">{showDetailedScorecard ? '🔼' : '🔽'}</span>
              </button>

              {/* Collapsed table lists */}
              <AnimatePresence>
                {showDetailedScorecard && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 pt-3 border-t select-none"
                    id="detailed-scoreboard"
                  >
                    <div className="flex gap-2 justify-center border-b pb-2">
                      {['summary', 'batting', 'bowling'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveScorecardTab(tab as any)}
                          className={`px-4 py-2 text-xs font-black rounded-lg capitalize ${
                            activeScorecardTab === tab 
                              ? 'bg-amber-400 text-slate-950 font-bold border-2 border-amber-500' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-350'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Rendering of different tabs */}
                    {activeScorecardTab === 'batting' && (
                      <div className="space-y-4">
                        {/* Batting order list */}
                        {(() => {
                          const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                          if (!inn) return null;

                          return (
                            <table className="w-full text-left font-mono text-sm border-collapse">
                              <thead>
                                <tr className="border-b text-[10px] text-slate-500 uppercase tracking-tight font-black">
                                  <th className="py-2">Batsman</th>
                                  <th className="py-2 text-right">Runs</th>
                                  <th className="py-2 text-right">Balls</th>
                                  <th className="py-2 text-right">4s</th>
                                  <th className="py-2 text-right">6s</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inn.battingOrder.map(b => (
                                  <tr key={b.id} className="border-b border-dashed">
                                    <td className="py-2.5 font-sans font-bold flex flex-col">
                                      <span>
                                        {b.name} 
                                        {inn.currentBatter1Id === b.id && ' (striker)'}
                                        {inn.currentBatter2Id === b.id && ' (partner)'}
                                      </span>
                                      <span className="text-[10px] font-normal text-slate-400 capitalize">
                                        {b.out ? `dismissed: ${b.dismissType} (${b.dismissBowler})` : 'Not out'}
                                      </span>
                                    </td>
                                    <td className="py-2 text-right font-extrabold">{b.runs}</td>
                                    <td className="py-2 text-right">{b.balls}</td>
                                    <td className="py-2 text-right">{b.fours}</td>
                                    <td className="py-2 text-right">{b.sixes}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    )}

                    {activeScorecardTab === 'bowling' && (
                      <div>
                        {(() => {
                          const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                          if (!inn) return null;

                          return (
                            <table className="w-full text-left font-mono text-sm border-collapse">
                              <thead>
                                <tr className="border-b text-[10px] text-slate-500 uppercase tracking-tight font-black">
                                  <th className="py-2">Bowler</th>
                                  <th className="py-2 text-right">Overs</th>
                                  <th className="py-2 text-right">Runs</th>
                                  <th className="py-2 text-right">Wkts</th>
                                  <th className="py-2 text-right">Econ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inn.bowlingOrder.map(b => (
                                  <tr key={b.id} className="border-b border-dashed">
                                    <td className="py-2.5 font-sans font-bold">{b.name}</td>
                                    <td className="py-2 text-right">{ballsToOvers(b.balls)}</td>
                                    <td className="py-2 text-right">{b.runs}</td>
                                    <td className="py-2 text-right font-extrabold text-red-600">{b.wickets}</td>
                                    <td className="py-2 text-right">{b.balls > 0 ? calculateRunRate(b.runs, b.balls) : '0.00'}</td>
                                  </tr>
                                ))}
                                {inn.bowlingOrder.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="py-4 text-center opacity-65">Waiting opening ball...</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    )}

                    {activeScorecardTab === 'summary' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="border p-3 rounded-lg text-center">
                            <span className="text-xs text-slate-400 uppercase">First Innings</span>
                            <p className="text-xl font-bold font-mono">
                              {currentMatch.innings1?.runs}/{currentMatch.innings1?.wickets || 0}
                            </p>
                            <span className="text-xs text-slate-400">({ballsToOvers(currentMatch.innings1?.balls || 0)} ov)</span>
                          </div>
                          <div className="border p-3 rounded-lg text-center">
                            <span className="text-xs text-slate-400 uppercase">Second Innings</span>
                            <p className="text-xl font-bold font-mono text-cyan-600">
                              {currentMatch.innings2 ? `${currentMatch.innings2.runs}/${currentMatch.innings2.wickets}` : 'Not started'}
                            </p>
                            {currentMatch.innings2 && <span className="text-xs text-slate-400">({ballsToOvers(currentMatch.innings2.balls)} ov)</span>}
                          </div>
                        </div>

                        {/* Extras Breakdown Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200">
                          <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider mb-2">Inn Extras Breakdown</span>
                          <table className="w-full text-left font-mono">
                            <thead>
                              <tr className="border-b text-[10px] text-slate-500 uppercase font-black">
                                <th className="py-1">Category</th>
                                <th className="py-1 text-right text-indigo-500">Innings 1</th>
                                <th className="py-1 text-right text-cyan-600">Innings 2</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-dashed border-slate-200 dark:border-slate-800">
                                <td className="py-1.5 text-slate-400">Total Extras</td>
                                <td className="py-1.5 text-right font-bold">
                                  {currentMatch.innings1 ? (currentMatch.innings1.extras.wides + currentMatch.innings1.extras.noBalls + currentMatch.innings1.extras.byes + currentMatch.innings1.extras.legByes) : 0}
                                </td>
                                <td className="py-1.5 text-right font-bold">
                                  {currentMatch.innings2 ? (currentMatch.innings2.extras.wides + currentMatch.innings2.extras.noBalls + currentMatch.innings2.extras.byes + currentMatch.innings2.extras.legByes) : 0}
                                </td>
                              </tr>
                              <tr className="border-b border-dashed border-slate-200 dark:border-slate-800">
                                <td className="py-1 text-slate-400">↳ Wide Extras</td>
                                <td className="py-1 text-right">
                                  {currentMatch.innings1?.extras.wides || 0}
                                </td>
                                <td className="py-1 text-right">
                                  {currentMatch.innings2?.extras.wides || 0}
                                </td>
                              </tr>
                              <tr className="border-b border-dashed border-slate-250 dark:border-slate-850">
                                <td className="py-1 text-slate-400">↳ No-Ball Extras</td>
                                <td className="py-1 text-right">
                                  {currentMatch.innings1?.extras.noBalls || 0}
                                </td>
                                <td className="py-1 text-right">
                                  {currentMatch.innings2?.extras.noBalls || 0}
                                </td>
                              </tr>
                              <tr className="border-b border-dashed border-slate-255 dark:border-slate-855">
                                <td className="py-1 text-slate-400">↳ Off-Bat NB runs</td>
                                <td className="py-1 text-right text-emerald-500 font-bold">
                                  {currentMatch.ballHistory
                                    .filter(b => b.inningIndex === 1 && b.extrasType === 'nb')
                                    .reduce((sum, b) => sum + b.runs, 0)}
                                </td>
                                <td className="py-1 text-right text-emerald-500 font-bold">
                                  {currentMatch.ballHistory
                                    .filter(b => b.inningIndex === 2 && b.extrasType === 'nb')
                                    .reduce((sum, b) => sum + b.runs, 0)}
                                </td>
                              </tr>
                              <tr className="opacity-70">
                                <td className="py-1 text-slate-400">↳ Byes / LByte</td>
                                <td className="py-1 text-right">
                                  {(currentMatch.innings1?.extras.byes || 0) + (currentMatch.innings1?.extras.legByes || 0)}
                                </td>
                                <td className="py-1 text-right">
                                  {(currentMatch.innings2?.extras.byes || 0) + (currentMatch.innings2?.extras.legByes || 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Ball-by-ball history stream logs */}
                        <div className="space-y-2">
                          <span className="text-xs text-slate-400 block font-bold uppercase">Recent score changes log:</span>
                          <div className="max-h-[140px] overflow-y-auto text-xs font-mono space-y-1 bg-slate-50 dark:bg-slate-950 p-2 rounded">
                            {currentMatch.ballHistory.length === 0 ? (
                              <p className="opacity-50 italic">No balls bowled yet.</p>
                            ) : (
                              currentMatch.ballHistory.slice(-15).reverse().map((b, i) => (
                                <p key={i} className="border-b pb-0.5 opacity-80">
                                  {b.description}
                                </p>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* LIVE SHARE SPECTATOR LINK COMPONENT */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isSunlight ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-900 border-indigo-900/40'
            }`}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h5 className="font-extrabold text-sm text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <Share2 className="w-5 h-5 animate-pulse" />
                    <span>Live Match Spectator Link</span>
                  </h5>
                  <p className="text-xs opacity-75">Send this shared link to friends to watch ball-by-ball updates from home!</p>
                </div>
                
                <button
                  onClick={() => handleCopySpectatorLink(currentMatch.id)}
                  className={`px-3 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                    copiedId === currentMatch.id 
                      ? 'bg-emerald-500 text-white font-bold' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                  }`}
                >
                  {copiedId === currentMatch.id ? <Check className="w-4 h-4 animate-bounce" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedId === currentMatch.id ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* FINISH/EXIT BUTTONS */}
            <div className="flex gap-4">
              <button
                onClick={handleReturnHome}
                className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:text-white font-extrabold rounded-xl active:scale-95 transition-transform"
              >
                Back Dashboard
              </button>
              
              {/* Force complete match */}
              <button
                onClick={() => {
                  triggerConfirm(
                    "🏆 Declare Winner Manually",
                    "Complete the match right now manually and declare results based on current innings count?",
                    async () => {
                      triggerHapticFeedback();
                      const updated = { ...currentMatch };
                      updated.status = 'completed';
                      
                      // Decides winner
                      const i1 = updated.innings1?.runs || 0;
                      const i2 = updated.innings2?.runs || 0;
                      if (i1 > i2) {
                        updated.winner = 'A';
                        updated.marginOfVictory = `${i1 - i2} runs`;
                      } else if (i2 > i1) {
                        updated.winner = 'B';
                        const wicketsLeft = updated.playersPerTeam - (updated.innings2?.wickets || 0);
                        updated.marginOfVictory = `${wicketsLeft} wickets`;
                      } else {
                        updated.winner = 'tie';
                        updated.marginOfVictory = 'scores are tied';
                      }

                      setCurrentMatch(updated);
                      await saveMatch(updated);
                      setCurrentView('result');
                      loadAllMatches();
                    },
                    'warning'
                  );
                }}
                className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-display text-lg rounded-xl active:scale-95 transition-transform"
              >
                Declare Winner 🏆
              </button>
            </div>

          </div>
        )}


        {/* ======================= SCREEN 6: LIVE SPECTATOR VIEWER VIEW ======================= */}
        {currentView === 'viewer' && (
          <div className="space-y-4" id="spectator-view-panel">
            
            {loading ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="font-extrabold">Loading live telemetry changes...</p>
              </div>
            ) : currentMatch ? (
              <div className="space-y-4">
                
                {/* Live notice indicator */}
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl flex items-center justify-between text-sm select-none font-bold dark:text-red-400 animate-pulse">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                    <span>LIVE TELEMETRY VIEWING (Auto Refreshes)</span>
                  </div>
                  <span className="text-xs font-mono uppercase tracking-widest font-black">spectator</span>
                </div>

                {/* Score panel duplicated for read-only viewer */}
                {(() => {
                  const innIdx = currentMatch.currentInningsIndex;
                  const inn = innIdx === 1 ? currentMatch.innings1 : currentMatch.innings2;
                  if (!inn) return null;

                  const battingName = inn.battingTeamId === 'A' ? currentMatch.teamAName : currentMatch.teamBName;
                  const crr = calculateRunRate(inn.runs, inn.balls);

                  const isSecondInning = innIdx === 2;
                  const target = (currentMatch.innings1?.runs || 0) + 1;
                  const requiredRuns = target - inn.runs;
                  const remainingBalls = (currentMatch.overs * 6) - inn.balls;
                  const rrr = remainingBalls > 0 ? ((requiredRuns / (remainingBalls / 6))).toFixed(2) : '0.00';

                  return (
                    <div className={`rounded-3xl border-2 shadow-lg select-none flex flex-col overflow-hidden ${
                      isSunlight ? 'bg-white border-slate-300 text-slate-950' : 'bg-slate-900 border-slate-800 text-white'
                    }`}>
                      <div className="px-5 py-3 flex justify-between items-center border-b">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-black tracking-wider">batsmen batting</span>
                          <h3 className="text-2xl font-bold font-display uppercase text-indigo-500">{battingName}</h3>
                        </div>
                        <span className="text-xs font-bold uppercase bg-slate-150 px-2 rounded dark:bg-slate-850">
                          Inning {innIdx}
                        </span>
                      </div>

                      <div className="p-6 text-center">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-6.5xl font-black font-display tracking-tight text-slate-950 dark:text-white">
                            {inn.runs}
                          </span>
                          <span className="text-4xl text-slate-300">/</span>
                          <span className="text-4xl font-extrabold text-red-500">
                            {inn.wickets}
                          </span>
                        </div>
                        <p className="text-lg text-slate-500 font-bold font-mono">
                          {ballsToOvers(inn.balls)} / {currentMatch.overs} Overs ({inn.balls} deliveries)
                        </p>
                      </div>

                      {/* Display targets */}
                      {isSecondInning && (
                        <div className="bg-amber-400 text-slate-950 p-3.5 text-center font-extrabold text-sm uppercase">
                          Target: <span className="font-mono text-base">{target}</span> – Need{' '}
                          <span className="font-mono text-base text-red-700 bg-white px-2 py-0.5 rounded">{requiredRuns}</span> runs off{' '}
                          <span className="font-mono text-base">{remainingBalls}</span> deliveries (Req RR: {rrr})
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Scorecard table tabs */}
                <div className={`p-4 rounded-xl border space-y-3 ${
                  isSunlight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex gap-2 justify-center border-b pb-2">
                    {['summary', 'batting', 'bowling'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveScorecardTab(tab as any)}
                        className={`px-4 py-2 text-xs font-black rounded-lg capitalize ${
                          activeScorecardTab === tab 
                            ? 'bg-amber-400 text-slate-950 font-bold border-2 border-amber-500' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-750 dark:bg-slate-800 dark:text-slate-350'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {activeScorecardTab === 'batting' && (
                    <div className="space-y-4">
                      {(() => {
                        const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                        if (!inn) return null;

                        return (
                          <table className="w-full text-left font-mono text-sm border-collapse">
                            <thead>
                              <tr className="border-b text-[10px] text-slate-500 uppercase tracking-tight font-black">
                                <th className="py-2">Batsman</th>
                                <th className="py-2 text-right">Runs</th>
                                <th className="py-2 text-right">Balls</th>
                                <th className="py-2 text-right">4s</th>
                                <th className="py-2 text-right">6s</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inn.battingOrder.map(b => (
                                <tr key={b.id} className="border-b border-dashed">
                                  <td className="py-2 font-sans font-bold flex flex-col">
                                    <span>
                                      {b.name} 
                                      {inn.strikerId === b.id && ' ⭐️'}
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-400 capitalize">
                                      {b.out ? `dismissed: ${b.dismissType} (${b.dismissBowler})` : 'Not out'}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right font-extrabold">{b.runs}</td>
                                  <td className="py-2 text-right">{b.balls}</td>
                                  <td className="py-2 text-right">{b.fours}</td>
                                  <td className="py-2 text-right">{b.sixes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}

                  {activeScorecardTab === 'bowling' && (
                    <div>
                      {(() => {
                        const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                        if (!inn) return null;

                        return (
                          <table className="w-full text-left font-mono text-sm border-collapse">
                            <thead>
                              <tr className="border-b text-[10px] text-slate-500 uppercase tracking-tight font-black">
                                <th className="py-2">Bowler</th>
                                <th className="py-2 text-right">Overs</th>
                                <th className="py-2 text-right">Runs</th>
                                <th className="py-2 text-right">Wkts</th>
                                <th className="py-2 text-right">Econ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inn.bowlingOrder.map(b => (
                                <tr key={b.id} className="border-b border-dashed">
                                  <td className="py-2 font-sans font-bold">{b.name}</td>
                                  <td className="py-2 text-right">{ballsToOvers(b.balls)}</td>
                                  <td className="py-2 text-right">{b.runs}</td>
                                  <td className="py-2 text-right font-extrabold text-red-650">{b.wickets}</td>
                                  <td className="py-2 text-right">{b.balls > 0 ? calculateRunRate(b.runs, b.balls) : '0.00'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}

                  {activeScorecardTab === 'summary' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border p-3 rounded-lg text-center">
                          <span className="text-xs text-slate-400 uppercase">First Innings</span>
                          <p className="text-xl font-bold font-mono">
                            {currentMatch.innings1?.runs}/{currentMatch.innings1?.wickets || 0}
                          </p>
                          <span className="text-xs text-slate-400">({ballsToOvers(currentMatch.innings1?.balls || 0)} ov)</span>
                        </div>
                        <div className="border p-3 rounded-lg text-center">
                          <span className="text-xs text-slate-400 uppercase">Second Innings</span>
                          <p className="text-xl font-bold font-mono text-cyan-500">
                            {currentMatch.innings2 ? `${currentMatch.innings2.runs}/${currentMatch.innings2.wickets}` : 'Not started'}
                          </p>
                          {currentMatch.innings2 && <span className="text-xs text-slate-400">({ballsToOvers(currentMatch.innings2.balls)} ov)</span>}
                        </div>
                      </div>

                      {/* Extras Breakdown Table */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/20 text-xs text-slate-800 dark:text-slate-200">
                        <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider mb-2">Inn Extras Breakdown</span>
                        <table className="w-full text-left font-mono">
                          <thead>
                            <tr className="border-b text-[10px] text-slate-500 uppercase font-black">
                              <th className="py-1">Category</th>
                              <th className="py-1 text-right text-indigo-500">Innings 1</th>
                              <th className="py-1 text-right text-cyan-600">Innings 2</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-dashed border-slate-200 dark:border-slate-800">
                              <td className="py-1.5 text-slate-400">Total Extras</td>
                              <td className="py-1.5 text-right font-bold">
                                {currentMatch.innings1 ? (currentMatch.innings1.extras.wides + currentMatch.innings1.extras.noBalls + currentMatch.innings1.extras.byes + currentMatch.innings1.extras.legByes) : 0}
                              </td>
                              <td className="py-1.5 text-right font-bold">
                                {currentMatch.innings2 ? (currentMatch.innings2.extras.wides + currentMatch.innings2.extras.noBalls + currentMatch.innings2.extras.byes + currentMatch.innings2.extras.legByes) : 0}
                              </td>
                            </tr>
                            <tr className="border-b border-dashed border-slate-200 dark:border-slate-800">
                              <td className="py-1 text-slate-400">↳ Wide Extras</td>
                              <td className="py-1 text-right">
                                {currentMatch.innings1?.extras.wides || 0}
                              </td>
                              <td className="py-1 text-right">
                                {currentMatch.innings2?.extras.wides || 0}
                              </td>
                            </tr>
                            <tr className="border-b border-dashed border-slate-250 dark:border-slate-850">
                              <td className="py-1 text-slate-400">↳ No-Ball Extras</td>
                              <td className="py-1 text-right">
                                {currentMatch.innings1?.extras.noBalls || 0}
                              </td>
                              <td className="py-1 text-right">
                                {currentMatch.innings2?.extras.noBalls || 0}
                              </td>
                            </tr>
                            <tr className="border-b border-dashed border-slate-255 dark:border-slate-855">
                              <td className="py-1 text-slate-400">↳ Off-Bat NB runs</td>
                              <td className="py-1 text-right text-emerald-500 font-bold">
                                {currentMatch.ballHistory
                                  .filter(b => b.inningIndex === 1 && b.extrasType === 'nb')
                                  .reduce((sum, b) => sum + b.runs, 0)}
                              </td>
                              <td className="py-1 text-right text-emerald-500 font-bold">
                                {currentMatch.ballHistory
                                  .filter(b => b.inningIndex === 2 && b.extrasType === 'nb')
                                  .reduce((sum, b) => sum + b.runs, 0)}
                              </td>
                            </tr>
                            <tr className="opacity-70">
                              <td className="py-1 text-slate-400">↳ Byes / LByte</td>
                              <td className="py-1 text-right">
                                {(currentMatch.innings1?.extras.byes || 0) + (currentMatch.innings1?.extras.legByes || 0)}
                              </td>
                              <td className="py-1 text-right">
                                {(currentMatch.innings2?.extras.byes || 0) + (currentMatch.innings2?.extras.legByes || 0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Display live over chips */}
                      {(() => {
                        const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                        if (!inn) return null;

                        return (
                          <div className="flex gap-2 items-center flex-wrap">
                            <span className="text-xs text-slate-400 uppercase font-bold">This Over balls:</span>
                            {inn.overHistory.map((val, i) => (
                              <span key={i} className="px-2 py-1 bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-xs rounded font-bold">
                                {val}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Back button for viewers */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    // Clear query params to return home cleanly
                    window.location.search = '';
                    window.location.hash = '';
                    setCurrentView('home');
                  }}
                  className="w-full py-4 bg-slate-200 hover:bg-slate-300 text-slate-805 dark:bg-slate-800 dark:text-white font-extrabold rounded-xl"
                >
                  Return to Home Dashboard 🏠
                </button>

              </div>
            ) : (
              <div className="text-center py-16 opacity-65 space-y-4">
                <span className="text-5xl">🏜️</span>
                <h3 className="text-xl font-extrabold">Match scorecard not found</h3>
                <p className="text-sm">Please verify your shareable link and try again.</p>
                <button
                  onClick={() => { window.location.search = ''; window.location.hash = ''; setCurrentView('home'); }}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg"
                >
                  Return Home
                </button>
              </div>
            )}

          </div>
        )}


        {/* ======================= SCREEN 7: MATCH RESULT SCOREBOARD SUMMARY ======================= */}
        {currentView === 'result' && currentMatch && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-6 rounded-2xl border space-y-6 text-center select-none ${
              isSunlight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-xl'
            }`}
            id="victory-screen"
          >
            <div className="space-y-2">
              <span className="text-6xl inline-block animate-bounce">🏆🎉</span>
              <h2 className="text-3xl font-black font-display tracking-tight text-amber-500">
                Match Completed!
              </h2>
              <p className="text-xl font-bold uppercase text-slate-500">
                Utrecht Champions Cup
              </p>
            </div>

            {/* Victory banner */}
            <div className="p-5 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl space-y-2">
              <h3 className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400">
                {currentMatch.winner === 'tie' 
                  ? 'SCORES ARE TIED!' 
                  : `${currentMatch.winner === 'A' ? currentMatch.teamAName : currentMatch.teamBName} VICTORIOUS!`
                }
              </h3>
              {currentMatch.winner !== 'tie' && (
                <p className="text-base text-slate-600 dark:text-slate-300">
                  Won by <span className="font-extrabold text-emerald-700 dark:text-emerald-300">{currentMatch.marginOfVictory}</span>
                </p>
              )}
            </div>

            {/* Match Innings detail scores */}
            <div className="grid grid-cols-2 gap-4 text-left font-mono">
              <div className="border p-4 rounded-xl space-y-1">
                <span className="text-xs uppercase text-slate-400 block">{currentMatch.teamAName}</span>
                <p className="text-2xl font-black text-slate-850 dark:text-white">
                  {currentMatch.innings1?.runs}/{currentMatch.innings1?.wickets || 0}
                </p>
                <span className="text-xs text-slate-500">({ballsToOvers(currentMatch.innings1?.balls || 0)} ov)</span>
              </div>
              <div className="border p-4 rounded-xl space-y-1">
                <span className="text-xs uppercase text-slate-400 block">{currentMatch.teamBName}</span>
                <p className="text-2xl font-black text-slate-850 dark:text-white">
                  {currentMatch.innings2?.runs}/{currentMatch.innings2?.wickets || 0}
                </p>
                <span className="text-xs text-slate-500">({ballsToOvers(currentMatch.innings2?.balls || 0)} ov)</span>
              </div>
            </div>

            {/* Share and Reset buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleCopySpectatorLink(currentMatch.id)}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-display font-black text-lg shadow-md transition-all ${
                  copiedId === currentMatch.id 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {copiedId === currentMatch.id ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                <span>{copiedId === currentMatch.id ? 'Copied Spectator Link!' : 'Share Live Scorecard'}</span>
              </button>

              <button
                onClick={handleReturnHome}
                className="w-full py-4 bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-white font-extrabold rounded-xl active:scale-95 transition-transform"
              >
                Back Home Dashboard 🏠
              </button>
            </div>

          </motion.div>
        )}

      </main>

      {/* FOOTER WATERMARK BRAND */}
      <footer className="text-center py-10 opacity-50 space-y-1 font-mono text-[11px] select-none">
        <p>Utrecht Ultimates Cricket Outdoor Scorekeeper</p>
        <p>© 2026 Utrecht Ultimates • Standard MCC Cricket Laws</p>
        {isFirebaseEnabled && <p className="text-[10px] text-emerald-500 font-extrabold flex items-center justify-center gap-1">🟢 Firestore Synchronizer Active</p>}
      </footer>

      {/* Reusable Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            id="custom-confirm-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border text-center space-y-6 ${
                themeMode === 'sunlight' 
                  ? 'bg-white border-slate-200 text-slate-800' 
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
              id="custom-confirm-modal-content"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-bold font-display tracking-tight" id="confirm-modal-title">
                  {confirmModal.title}
                </h3>
                <p className="text-sm opacity-80" id="confirm-modal-message">
                  {confirmModal.message}
                </p>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className={`flex-1 py-3 font-bold rounded-xl active:scale-95 transition-all ${
                    themeMode === 'sunlight' 
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  id="confirm-modal-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    triggerHapticFeedback();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    await confirmModal.onConfirm();
                  }}
                  className={`flex-1 py-3 font-black rounded-xl shadow-lg active:scale-95 transition-all ${
                    confirmModal.confirmBtnStyle === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
                      : confirmModal.confirmBtnStyle === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                  }`}
                  id="confirm-modal-yes"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
