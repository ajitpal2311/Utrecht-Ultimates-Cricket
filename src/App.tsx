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
import { saveMatch, fetchAllMatches, listenToMatch, deleteMatch, saveAttendance, fetchAttendance, registerViewerHeartbeat, listenActiveViewers, listenAllMatches, listenAttendance } from './firebaseService';
import { isFirebaseEnabled } from './firebase';

export default function App() {
  // User Authentication Role: 'scorer' | 'player' | null
  const [userRole, setUserRole] = useState<'scorer' | 'player' | null>(() => {
    return localStorage.getItem('cricket_user_role') as any;
  });

  const [roleInput, setRoleInput] = useState<'scorer' | 'player' | null>(null);
  const [passphraseInput, setPassphraseInput] = useState<string>('');
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  // Levenshtein distance calculation for minor typos
  const calculateLevenshtein = (a: string, b: string): number => {
    const tmp = [];
    for (let i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1, // deletion
          tmp[i][j - 1] + 1, // insertion
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
        );
      }
    }
    return tmp[a.length][b.length];
  };

  const handleVerifyScorer = () => {
    const cleanIn = passphraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
    const target = "i am scorer";
    
    // Exact match or Levenshtein distance <= 2 for minor typos
    if (cleanIn === target || calculateLevenshtein(cleanIn, target) <= 2) {
      triggerHapticFeedback();
      setUserRole('scorer');
      localStorage.setItem('cricket_user_role', 'scorer');
      triggerToast("🔐 Scorer authentication successful!");
      setPassphraseInput('');
      setPassphraseError(null);
      setRoleInput(null);
    } else {
      triggerHapticFeedback();
      setPassphraseError("❌ Incorrect passphrase. Please write: 'I am scorer'");
    }
  };

  // Views: 'home' | 'create' | 'squads' | 'toss' | 'scoring' | 'result' | 'viewer'
  const [currentView, setCurrentView] = useState<'home' | 'create' | 'squads' | 'toss' | 'scoring' | 'result' | 'viewer'>('home');
  const [matchesList, setMatchesList] = useState<CricketMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState<CricketMatch | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preference settings for outdoors
  const [themeMode, setThemeMode] = useState<'sunlight' | 'night'>('sunlight');
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true);

  // Internet connectivity state tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Tab-specific viewer session tracking
  const [sessionId] = useState(() => 'sess-' + Math.random().toString(36).substring(2, 11));
  const [viewerCount, setViewerCount] = useState<number>(1);

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
  const [teamAName, setTeamAName] = useState('Team A');
  const [teamBName, setTeamBName] = useState('Team B');
  const [oversCount, setOversCount] = useState<number>(5);
  const [playersLimit, setPlayersLimit] = useState<number>(11);
  const [enableHalfwayRules, setEnableHalfwayRules] = useState<boolean>(true);
  const [noBallPromptOpen, setNoBallPromptOpen] = useState<boolean>(false);

  // Helper to generate a date key for daily attendance
  const getTodayDateId = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Today's Attendance State
  const [attendancePlayers, setAttendancePlayers] = useState<string[]>([]);
  const [attendanceInput, setAttendanceInput] = useState<string>('');
  const [attendanceTeamA, setAttendanceTeamA] = useState<string[]>([]);
  const [attendanceTeamB, setAttendanceTeamB] = useState<string[]>([]);

  // Squad setup state
  const [teamASquad, setTeamASquad] = useState<string[]>([]);
  const [teamBSquad, setTeamBSquad] = useState<string[]>([]);

  // Direct team player inputs
  const [directInputA, setDirectInputA] = useState<string>('');
  const [directInputB, setDirectInputB] = useState<string>('');

  const [tossWonBy, setTossWonBy] = useState<'A' | 'B' | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null);


  // Live Score screen helpers
  const [scoringExtrasMode, setScoringExtrasMode] = useState<'wd' | 'nb' | 'by' | 'lb' | null>(null);
  const [wicketConfig, setWicketConfig] = useState<{
    showOptions: boolean;
    type: 'bowled' | 'caught' | 'run out' | 'lbw' | 'stumped' | 'other' | null;
    batsmanId: string | null;
    incomingBatsmanId: string | null;
  }>({ showOptions: false, type: null, batsmanId: null, incomingBatsmanId: null });

  const [replacingBatterId, setReplacingBatterId] = useState<string | null>(null);
  const [tempReplaceName, setTempReplaceName] = useState<string>('');
  const [customIncomingName, setCustomIncomingName] = useState<string>('');
  const [customWicketIncomingName, setCustomWicketIncomingName] = useState<string>('');

  const [activeScorecardTab, setActiveScorecardTab] = useState<'batting' | 'bowling' | 'summary'>('summary');
  const [showDetailedScorecard, setShowDetailedScorecard] = useState<boolean>(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Route/View protection guard: if not scorer, redirect private screens to home
  useEffect(() => {
    if (userRole && userRole !== 'scorer') {
      const scoringViews = ['create', 'squads', 'toss', 'scoring'];
      if (scoringViews.includes(currentView)) {
        setCurrentView('home');
        triggerToast("🔐 View restricted to Official Scorers only.");
      }
    }
  }, [currentView, userRole]);

  // Track internet connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerToast("💚 Back online! Operations will sync automatically.");
    };
    const handleOffline = () => {
      setIsOnline(false);
      triggerToast("⚠️ Operating offline. Changes saved locally and will sync once connected.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Active Viewer Counter Heartbeat & Streaming
  useEffect(() => {
    // 1. Send initial tab heartbeat
    registerViewerHeartbeat(sessionId);

    // 2. Keep posting heartbeat every 15 seconds to stay alive
    const heartbeatInterval = setInterval(() => {
      registerViewerHeartbeat(sessionId);
    }, 15000);

    // 3. Subscribe to overall active viewer pool count
    const unsubViewers = listenActiveViewers((count) => {
      setViewerCount(count);
    });

    return () => {
      clearInterval(heartbeatInterval);
      unsubViewers();
    };
  }, [sessionId]);

  // 1. Deep-Link/Spectator Match Live Subscription
  useEffect(() => {
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
      
      const unsubscribe = listenToMatch(
        matchId,
        (updatedMatch) => {
          setCurrentMatch(updatedMatch);
          if (updatedMatch) {
            extractSquadsAndTeamNames(updatedMatch);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Could not load deep link match:", err);
          triggerToast("⚠️ Match not found or offline");
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    }
  }, []);

  // 2. Real-time Matches List Synchronization
  useEffect(() => {
    const unsubscribe = listenAllMatches((matches) => {
      setMatchesList(matches);
    });
    return () => unsubscribe();
  }, []);

  // 3. Real-time Daily Attendance & Roster Synchronization
  useEffect(() => {
    const todayId = getTodayDateId();
    const unsubscribe = listenAttendance(todayId, (todayAtt) => {
      if (todayAtt) {
        setAttendancePlayers(todayAtt.players || []);
        setAttendanceTeamA(todayAtt.teamA || []);
        setAttendanceTeamB(todayAtt.teamB || []);
      } else {
        setAttendancePlayers([]);
        setAttendanceTeamA([]);
        setAttendanceTeamB([]);
      }
    });
    return () => unsubscribe();
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

  const handleAddAttendancePlayers = async (inputRaw: string) => {
    if (userRole !== 'scorer') {
      triggerToast("🔐 Operation restricted to scorers only");
      return;
    }
    if (!inputRaw || !inputRaw.trim()) return;
    const names = inputRaw.split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);
    
    const currentLower = attendancePlayers.map(p => p.toLowerCase());
    const uniqueNew = names.filter(n => !currentLower.includes(n.toLowerCase()));
    
    if (uniqueNew.length === 0) {
      triggerToast("Names already in attendance / duplicate");
      return;
    }

    const updated = [...attendancePlayers, ...uniqueNew];
    setAttendancePlayers(updated);
    setAttendanceInput('');

    const attendanceDoc = {
      id: getTodayDateId(),
      players: updated,
      teamA: attendanceTeamA,
      teamB: attendanceTeamB,
      updatedAt: Date.now()
    };
    await saveAttendance(attendanceDoc);
    triggerToast(`Added ${uniqueNew.length} players to Today's Attendance!`);
  };

  const handleRemoveAttendancePlayer = async (nameToRemove: string) => {
    if (userRole !== 'scorer') {
      triggerToast("🔐 Operation restricted to scorers only");
      return;
    }
    const updated = attendancePlayers.filter(p => p !== nameToRemove);
    setAttendancePlayers(updated);

    // Also remove from saved team rosters if they were in Team A or Team B
    const updatedTeamA = attendanceTeamA.filter(p => p !== nameToRemove);
    const updatedTeamB = attendanceTeamB.filter(p => p !== nameToRemove);
    setAttendanceTeamA(updatedTeamA);
    setAttendanceTeamB(updatedTeamB);

    const attendanceDoc = {
      id: getTodayDateId(),
      players: updated,
      teamA: updatedTeamA,
      teamB: updatedTeamB,
      updatedAt: Date.now()
    };
    await saveAttendance(attendanceDoc);
    triggerToast(`Removed ${nameToRemove} from Today's Attendance`);
  };

  // Save squad changes helper
  const handleSaveSquadChanges = async (newTeamA: string[], newTeamB: string[]) => {
    const todayId = getTodayDateId();
    setAttendanceTeamA(newTeamA);
    setAttendanceTeamB(newTeamB);
    const doc = {
      id: todayId,
      players: attendancePlayers,
      teamA: newTeamA,
      teamB: newTeamB,
      updatedAt: Date.now()
    };
    await saveAttendance(doc);
  };

  // Create match action using Today's Attendance and matching assignments
  const handleInitiateMatchCreation = async () => {
    if (userRole !== 'scorer') {
      triggerToast("🔐 Operation restricted to scorers only");
      return;
    }
    if (attendancePlayers.length < 4) {
      triggerHapticFeedback();
      triggerToast("⚠️ Minimum 4 players required in today's attendance to start a match!");
      return;
    }
    triggerHapticFeedback();

    let initialASquad: string[] = [];
    let initialBSquad: string[] = [];
    let defaultTeamAName = 'Team A';
    let defaultTeamBName = 'Team B';

    // Use Today's Attendance as the player pool
    const pool = [...attendancePlayers];

    // If no teams exist yet today, automatically assign players randomly
    if (attendanceTeamA.length === 0 && attendanceTeamB.length === 0) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      shuffled.forEach((player, index) => {
        if (index % 2 === 0) {
          initialASquad.push(player);
        } else {
          initialBSquad.push(player);
        }
      });

      // Update and save Team A and B assignments back to Today's Attendance
      setAttendanceTeamA(initialASquad);
      setAttendanceTeamB(initialBSquad);
      
      const attendanceDoc = {
        id: getTodayDateId(),
        players: pool,
        teamA: initialASquad,
        teamB: initialBSquad,
        updatedAt: Date.now()
      };
      await saveAttendance(attendanceDoc);
      triggerToast("Created Team A & Team B automatically from Today's Attendance!");
    } else {
      // Reuse the previously created Team A and Team B assignments by default
      initialASquad = [...attendanceTeamA];
      initialBSquad = [...attendanceTeamB];
      triggerToast("Reused same day Team A and Team B rosters!");
    }

    const finalTeamAName = teamAName.trim() || 'Team A';
    const finalTeamBName = teamBName.trim() || 'Team B';

    setTeamAName(finalTeamAName);
    setTeamBName(finalTeamBName);

    const maxPlayers = Math.max(initialASquad.length, initialBSquad.length, 2);

    const cleanMatch = createNewMatch(
      matchName, 
      finalTeamAName, 
      finalTeamBName, 
      oversCount, 
      maxPlayers, 
      null, 
      enableHalfwayRules
    );

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
  const handleEditPlayerName = async (team: 'A' | 'B', index: number, value: string) => {
    let updated: string[];
    const todayId = getTodayDateId();
    if (team === 'A') {
      updated = [...teamASquad];
      const oldVal = updated[index];
      updated[index] = value;
      setTeamASquad(updated);
      
      // Sync with attendance list
      let updatedAtt = [...attendancePlayers];
      const attIdx = updatedAtt.indexOf(oldVal);
      if (attIdx !== -1 && !updatedAtt.includes(value)) {
        updatedAtt[attIdx] = value;
        setAttendancePlayers(updatedAtt);
      }
      
      setAttendanceTeamA(updated);
      const doc = {
        id: todayId,
        players: updatedAtt,
        teamA: updated,
        teamB: teamBSquad,
        updatedAt: Date.now()
      };
      await saveAttendance(doc);
    } else {
      updated = [...teamBSquad];
      const oldVal = updated[index];
      updated[index] = value;
      setTeamBSquad(updated);
      
      // Sync with attendance list
      let updatedAtt = [...attendancePlayers];
      const attIdx = updatedAtt.indexOf(oldVal);
      if (attIdx !== -1 && !updatedAtt.includes(value)) {
        updatedAtt[attIdx] = value;
        setAttendancePlayers(updatedAtt);
      }
      
      setAttendanceTeamB(updated);
      const doc = {
        id: todayId,
        players: updatedAtt,
        teamA: teamASquad,
        teamB: updated,
        updatedAt: Date.now()
      };
      await saveAttendance(doc);
    }
  };

  const handleAddPlayerSlot = async (team: 'A' | 'B') => {
    triggerHapticFeedback();
    const nextNum = (team === 'A' ? teamASquad.length : teamBSquad.length) + 1;
    const defaultName = `Player ${nextNum}`;
    
    // Auto add to Today's Attendance
    let updatedAtt = [...attendancePlayers];
    if (!updatedAtt.includes(defaultName)) {
      updatedAtt.push(defaultName);
      setAttendancePlayers(updatedAtt);
    }

    if (team === 'A') {
      const updated = [...teamASquad, defaultName];
      setTeamASquad(updated);
      await handleSaveSquadChanges(updated, teamBSquad);
    } else {
      const updated = [...teamBSquad, defaultName];
      setTeamBSquad(updated);
      await handleSaveSquadChanges(teamASquad, updated);
    }
  };

  const handleRemovePlayerSlot = async (team: 'A' | 'B', index: number) => {
    triggerHapticFeedback();
    if (team === 'A') {
      if (teamASquad.length <= 2) {
        triggerToast("Minimum 2 players needed");
        return;
      }
      const updated = teamASquad.filter((_, idx) => idx !== index);
      setTeamASquad(updated);
      await handleSaveSquadChanges(updated, teamBSquad);
    } else {
      if (teamBSquad.length <= 2) {
        triggerToast("Minimum 2 players needed");
        return;
      }
      const updated = teamBSquad.filter((_, idx) => idx !== index);
      setTeamBSquad(updated);
      await handleSaveSquadChanges(teamASquad, updated);
    }
  };

  // Move a player between A and B
  const handleMovePlayerColumn = async (fromTeam: 'A' | 'B', index: number) => {
    triggerHapticFeedback();
    if (fromTeam === 'A') {
      const player = teamASquad[index];
      const updatedA = teamASquad.filter((_, idx) => idx !== index);
      const updatedB = [...teamBSquad, player];
      setTeamASquad(updatedA);
      setTeamBSquad(updatedB);
      await handleSaveSquadChanges(updatedA, updatedB);
      triggerToast(`Moved ${player} to ${teamBName}`);
    } else {
      const player = teamBSquad[index];
      const updatedB = teamBSquad.filter((_, idx) => idx !== index);
      const updatedA = [...teamASquad, player];
      setTeamASquad(updatedA);
      setTeamBSquad(updatedB);
      await handleSaveSquadChanges(updatedA, updatedB);
      triggerToast(`Moved ${player} to ${teamAName}`);
    }
  };

  // Add custom player directly to a team and auto sync with attendance
  const handleAddPlayerToTeamDirect = async (team: 'A' | 'B', rawName: string) => {
    if (!rawName || !rawName.trim()) return;
    triggerHapticFeedback();
    const cleanName = rawName.trim();

    let updatedA = [...teamASquad];
    let updatedB = [...teamBSquad];

    // Check pre-existence in roster
    if (updatedA.includes(cleanName) || updatedB.includes(cleanName)) {
      triggerToast("Player is already in one of the teams");
      return;
    }

    if (team === 'A') {
      updatedA.push(cleanName);
      setTeamASquad(updatedA);
    } else {
      updatedB.push(cleanName);
      setTeamBSquad(updatedB);
    }

    // Auto-add to attendance players (ignore duplicates)
    let updatedAtt = [...attendancePlayers];
    const lowerAtt = updatedAtt.map(p => p.toLowerCase());
    if (!lowerAtt.includes(cleanName.toLowerCase())) {
      updatedAtt.push(cleanName);
      setAttendancePlayers(updatedAtt);
    }

    // Save of both states to Firestore/LocalStorage
    const todayId = getTodayDateId();
    setAttendanceTeamA(updatedA);
    setAttendanceTeamB(updatedB);

    const doc = {
      id: todayId,
      players: updatedAtt,
      teamA: updatedA,
      teamB: updatedB,
      updatedAt: Date.now()
    };
    await saveAttendance(doc);
    triggerToast(`Added ${cleanName} to ${team === 'A' ? teamAName : teamBName} & Today's Attendance`);
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

    let finalIncomingId = wicketConfig.incomingBatsmanId;

    // Create a new customized batter on the fly, if typed in
    if (customWicketIncomingName.trim()) {
      const cleanName = customWicketIncomingName.trim();
      const activeInningsIdx = updated.currentInningsIndex;
      const inn = activeInningsIdx === 1 ? updated.innings1 : updated.innings2;
      if (inn) {
        if (!inn.battingOrder.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
          const battingTeam = inn.battingTeamId;
          finalIncomingId = `p-${battingTeam}-custom-${Date.now()}`;
          const newPlayer = {
            id: finalIncomingId,
            name: cleanName,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            out: false
          };
          inn.battingOrder.push(newPlayer);
        } else {
          const existing = inn.battingOrder.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
          if (existing) finalIncomingId = existing.id;
        }
      }
    }

    // Auto-assign chosen incoming batsman
    if (finalIncomingId) {
      const activeInningsIdx = updated.currentInningsIndex;
      const inn = activeInningsIdx === 1 ? updated.innings1 : updated.innings2;
      if (inn) {
        if (!inn.currentBatter1Id) {
          inn.currentBatter1Id = finalIncomingId;
          if (!inn.strikerId) inn.strikerId = finalIncomingId;
        } else if (!inn.currentBatter2Id) {
          inn.currentBatter2Id = finalIncomingId;
          if (!inn.strikerId) inn.strikerId = finalIncomingId;
        }
      }
    }

    setWicketConfig({ showOptions: false, type: null, batsmanId: null, incomingBatsmanId: null });
    setCustomWicketIncomingName('');
    setCurrentMatch(updated);
    await saveMatch(updated);

    if (updated.status === 'completed') {
      setCurrentView('result');
      loadAllMatches();
    } else if (updated.currentInningsIndex !== currentMatch.currentInningsIndex) {
      initializeInnings2(updated);
    } else {
      if (finalIncomingId) {
        triggerToast("🎯 Wicket recorded and next batsman assigned!");
      } else {
        triggerToast("🎯 Wicket recorded! Pick the incoming batsman card below.");
      }
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

  // Dynamic Batsman replacement by ID (flexible batting order)
  const handleAssignIncomingBatsmanById = async (playerId: string) => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    triggerHapticFeedback();
    const updatedMatch = { ...currentMatch };
    const inn = updatedMatch.currentInningsIndex === 1 ? updatedMatch.innings1 : updatedMatch.innings2;

    if (inn) {
      // Find where we have a slot available
      if (!inn.currentBatter1Id && inn.currentBatter2Id !== playerId) {
        inn.currentBatter1Id = playerId;
        if (!inn.strikerId) inn.strikerId = playerId;
      } else if (!inn.currentBatter2Id && inn.currentBatter1Id !== playerId) {
        inn.currentBatter2Id = playerId;
        if (!inn.strikerId) inn.strikerId = playerId;
      } else {
        triggerToast("Batsmen spots are already filled!");
        return;
      }
    }

    setCurrentMatch(updatedMatch);
    await saveMatch(updatedMatch);
    triggerToast("🏏 New batsman assigned!");
  };

  // Quick Batsman replacement selector (kept for backward compatibility, delegates to ID-based)
  const handleAssignIncomingBatsman = async (playerIdx: number) => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;
    const battingTeam = activeInnings.battingTeamId;
    const bId = `p-${battingTeam}-${playerIdx + 1}`;
    await handleAssignIncomingBatsmanById(bId);
  };

  // Register completely new batsman on key-press/click
  const handleAddCustomIncomingBatsman = async () => {
    if (!currentMatch || !customIncomingName.trim()) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    triggerHapticFeedback();
    const cleanName = customIncomingName.trim();
    const battingTeam = activeInnings.battingTeamId;
    const newPlayerId = `p-${battingTeam}-custom-${Date.now()}`;

    const updatedMatch = { ...currentMatch };
    const inn = updatedMatch.currentInningsIndex === 1 ? updatedMatch.innings1 : updatedMatch.innings2;

    if (inn) {
      // Ensure name is not empty or duplicate
      if (inn.battingOrder.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
        triggerToast("A player with this name already exists in the scorecard!");
        return;
      }

      // Create and push new player to scorecard
      const newPlayer = {
        id: newPlayerId,
        name: cleanName,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false
      };
      inn.battingOrder.push(newPlayer);

      // Assign to empty slot
      if (!inn.currentBatter1Id) {
        inn.currentBatter1Id = newPlayerId;
        if (!inn.strikerId) inn.strikerId = newPlayerId;
      } else if (!inn.currentBatter2Id) {
        inn.currentBatter2Id = newPlayerId;
        if (!inn.strikerId) inn.strikerId = newPlayerId;
      } else {
        triggerToast("Batsmen spots are already filled!");
        return;
      }
    }

    setCurrentMatch(updatedMatch);
    await saveMatch(updatedMatch);
    triggerToast(`🏏 Added & assigned custom batsman: ${cleanName}`);
    setCustomIncomingName('');
  };

  // Switch active batsman on the fly at any time (e.g., retirement, opening switch, substitution)
  const handleSubstituteActiveBatsman = async (oldBatterId: string, newBatterId: string, newCustomName?: string) => {
    if (!currentMatch) return;
    const activeInnings = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
    if (!activeInnings) return;

    triggerHapticFeedback();
    const updatedMatch = { ...currentMatch };
    const inn = updatedMatch.currentInningsIndex === 1 ? updatedMatch.innings1 : updatedMatch.innings2;

    if (inn) {
      let finalNewId = newBatterId;
      
      // If we are adding a custom named player
      if (newCustomName && newCustomName.trim()) {
        const cleanName = newCustomName.trim();
        const battingTeam = inn.battingTeamId;
        finalNewId = `p-${battingTeam}-custom-${Date.now()}`;
        
        // Add them to the battingOrder
        const newPlayer = {
          id: finalNewId,
          name: cleanName,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          out: false
        };
        inn.battingOrder.push(newPlayer);
      }

      // Reassign active slot and striker if applicable
      if (inn.currentBatter1Id === oldBatterId) {
        inn.currentBatter1Id = finalNewId;
        if (inn.strikerId === oldBatterId) {
          inn.strikerId = finalNewId;
        }
      } else if (inn.currentBatter2Id === oldBatterId) {
        inn.currentBatter2Id = finalNewId;
        if (inn.strikerId === oldBatterId) {
          inn.strikerId = finalNewId;
        }
      }
    }

    setCurrentMatch(updatedMatch);
    await saveMatch(updatedMatch);
    triggerToast("🏏 Active batsman changed successfully!");
    setReplacingBatterId(null);
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
    if (userRole !== 'scorer') {
      triggerToast("🔐 Operation restricted to scorers only");
      return;
    }
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
          console.warn("Match deletion failed:", error);
          triggerToast("⚠️ Deletion failed or you are not the creator.");
        }
        loadAllMatches();
      },
      'danger'
    );
  };

  const extractSquadsAndTeamNames = (matchObj: CricketMatch) => {
    if (!matchObj) return;
    setTeamAName(matchObj.teamAName);
    setTeamBName(matchObj.teamBName);
    
    const squadA: string[] = [];
    const squadB: string[] = [];

    if (matchObj.innings1) {
      const inn1 = matchObj.innings1;
      const batId = inn1.battingTeamId;
      const bowlId = inn1.bowlingTeamId;

      inn1.battingOrder.forEach(p => {
        if (batId === 'A') {
          if (!squadA.includes(p.name)) squadA.push(p.name);
        } else {
          if (!squadB.includes(p.name)) squadB.push(p.name);
        }
      });

      inn1.bowlingOrder.forEach(b => {
        if (bowlId === 'A') {
          if (!squadA.includes(b.name)) squadA.push(b.name);
        } else {
          if (!squadB.includes(b.name)) squadB.push(b.name);
        }
      });
    }

    if (matchObj.innings2) {
      const inn2 = matchObj.innings2;
      const batId = inn2.battingTeamId;
      const bowlId = inn2.bowlingTeamId;

      inn2.battingOrder.forEach(p => {
        if (batId === 'A') {
          if (!squadA.includes(p.name)) squadA.push(p.name);
        } else {
          if (!squadB.includes(p.name)) squadB.push(p.name);
        }
      });

      inn2.bowlingOrder.forEach(b => {
        if (bowlId === 'A') {
          if (!squadA.includes(b.name)) squadA.push(b.name);
        } else {
          if (!squadB.includes(b.name)) squadB.push(b.name);
        }
      });
    }

    if (squadA.length > 0) setTeamASquad(squadA);
    if (squadB.length > 0) setTeamBSquad(squadB);
  };

  // Load an existing match to score again
  const handleLoadMatchToScore = (matchObj: CricketMatch) => {
    triggerHapticFeedback();
    setCurrentMatch(matchObj);
    extractSquadsAndTeamNames(matchObj);
    
    // Retrieve player arrays from name matching
    if (userRole === 'scorer') {
      setCurrentView('scoring');
      triggerToast("🏏 Scoreboard Loaded! Pitch is ready.");
    } else {
      setCurrentView('viewer');
      triggerToast("📊 Match Scorecard Loaded to View.");
    }
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

  if (!userRole) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
        isSunlight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        {/* FIXED TOAST MESSAGE IN ENTRY SCREEN */}
        <AnimatePresence>
          {toastMessage && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-auto px-4 py-2 bg-slate-900 text-white rounded-full border border-slate-705 shadow-xl font-medium text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-450 animate-ping"></span>
              {toastMessage}
            </div>
          )}
        </AnimatePresence>

        <div className={`w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
          isSunlight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
        }`} id="role-selection-card">
          <div className="text-center space-y-2 select-none">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-500 animate-bounce">
              <Trophy className="w-9 h-9 text-red-650 fill-red-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
              Utrecht Ultimates
            </h2>
            <p className="text-sm opacity-60">
              Utrecht Champions League Outdoor Scorekeeper!
            </p>
          </div>

          {!roleInput ? (
            <div className="space-y-4">
              <p className="text-xs uppercase font-extrabold tracking-widest opacity-40 text-center">
                Select your User Access Role
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                {/* OPTION 1: SCORER */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setRoleInput('scorer');
                    setPassphraseError(null);
                  }}
                  className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col gap-2 group ${
                    isSunlight 
                      ? 'bg-slate-50 border-slate-200 hover:border-red-400 hover:bg-slate-50 shadow-sm' 
                      : 'bg-slate-850 border-slate-800 hover:border-red-600 hover:bg-slate-800'
                  }`}
                  id="select-scorer-role-button"
                >
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-red-100 dark:bg-red-950/50 rounded-xl text-red-500">
                      <UserPlus className="w-5 h-5" />
                    </span>
                    <h3 className="text-lg font-bold font-display group-hover:text-red-500 transition-colors">
                      🏆 Official Scorer
                    </h3>
                  </div>
                  <p className="text-xs opacity-65 leading-relaxed">
                    Log in with passphrase. Grants full permissions to register matches, check-in players, manage tosses, record runs/wickets, and write telemetries.
                  </p>
                </button>

                {/* OPTION 2: SPECTATOR / PLAYER */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setUserRole('player');
                    localStorage.setItem('cricket_user_role', 'player');
                    triggerToast("👀 Welcome! You are loaded in read-only Spectator Mode.");
                  }}
                  className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col gap-2 group ${
                    isSunlight 
                      ? 'bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-slate-50 shadow-sm' 
                      : 'bg-slate-850 border-slate-800 hover:border-indigo-600 hover:bg-slate-800'
                  }`}
                  id="select-player-role-button"
                >
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl text-indigo-500">
                      <Users className="w-5 h-5" />
                    </span>
                    <h3 className="text-lg font-bold font-display group-hover:text-indigo-500 transition-colors">
                      👀 Match Player / Fan
                    </h3>
                  </div>
                  <p className="text-xs opacity-65 leading-relaxed">
                    Instant access without credentials. Grants real-time display to track active match scorecards, player pools, and view-only statistics.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-extrabold tracking-widest text-red-500">
                  Scorer Verification
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setRoleInput(null);
                    setPassphraseInput('');
                    setPassphraseError(null);
                  }}
                  className="text-xs hover:underline opacity-60 font-bold text-slate-500"
                >
                  ← Go Back
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold opacity-75">
                  Enter Scorer Pass Phrase:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type pass phrase..."
                    value={passphraseInput}
                    onChange={(e) => {
                      setPassphraseInput(e.target.value);
                      if (passphraseError) setPassphraseError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleVerifyScorer();
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium ${
                      isSunlight 
                        ? 'bg-slate-55 border-slate-300 text-slate-900 placeholder:text-slate-450' 
                        : 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-650'
                    }`}
                    id="scorer-passphrase-input"
                    autoFocus
                  />
                </div>
                {passphraseError && (
                  <p className="text-xs text-red-500 font-bold mt-1" id="passphrase-error-msg">
                    {passphraseError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleVerifyScorer}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl active:scale-97 transition-all shadow-md mt-2"
                id="submit-passphrase-button"
              >
                Log In as Official Scorer 🔓
              </button>
            </div>
          )}

          <div className="text-center pt-2">
            <span className="text-[10px] opacity-40 uppercase tracking-widest font-mono">
              Utrecht Ultimates v2.4.0
            </span>
          </div>
        </div>
      </div>
    );
  }

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
          </div>
        </div>

        {/* Toggles for sunlight legibility and click vibs */}
        <div className="flex items-center gap-2">
          {/* User Role switch/badge */}
          {userRole && (
            <button
              onClick={() => {
                triggerHapticFeedback();
                triggerConfirm(
                  "🔄 Switch Access Role",
                  `You are currently logged in as ${userRole === 'scorer' ? 'Official Scorer (Full Privileges)' : 'Player/Spectator (Read-Only)'}. Do you want to sign out and choose a role again?`,
                  () => {
                    setUserRole(null);
                    localStorage.removeItem('cricket_user_role');
                    setCurrentView('home');
                    triggerToast("Logged out of role! Select role again.");
                  },
                  'warning'
                );
              }}
              className={`px-3 py-2 border rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-1.5 transition-all outline-none ${
                userRole === 'scorer'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-700 font-extrabold shadow-sm'
                  : 'bg-indigo-600 hover:bg-indigo-550 dark:bg-indigo-950 dark:border-indigo-800 text-indigo-100 dark:text-indigo-400 border-indigo-700 font-bold shadow-sm'
              }`}
              title="Click to switch role or log out"
              id="role-switch-header-btn"
            >
              <span>{userRole === 'scorer' ? '🏆 SCORER' : '👀 PLAYER'}</span>
            </button>
          )}

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

            {/* Live Viewers Indicator */}
            <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between font-display text-sm ${
              isSunlight 
                ? 'bg-sky-50 border-sky-200 text-sky-950 shadow-sm' 
                : 'bg-slate-900 border-slate-800 text-slate-100 shadow-md'
            }`} id="live-viewers-indicator">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3.5 w-3.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}></span>
                </span>
                <span className="font-semibold select-none flex items-center gap-1">
                  <span>Live App Viewers</span>
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-end">
                {/* Connection Status Badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1 border select-none ${
                  isOnline 
                    ? (isSunlight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/40 border-emerald-800 text-emerald-400')
                    : (isSunlight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-950/40 border-amber-800 text-amber-400')
                }`} id="connection-status-badge">
                  {isOnline ? '● Online' : '▲ Offline (Local View)'}
                </span>

                <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider select-none ${
                  isSunlight ? 'bg-sky-100 text-sky-800' : 'bg-slate-950 text-emerald-400'
                }`}>
                  {viewerCount} {viewerCount === 1 ? 'person' : 'people'} online
                </span>
              </div>
            </div>

            {/* Today's Attendance Card */}
            <div className={`p-5 rounded-2xl border space-y-4 select-none ${
              isSunlight 
                ? 'bg-white border-slate-300 shadow-sm' 
                : 'bg-slate-900 border-slate-800 shadow-xl'
            }`} id="todays-attendance-container">
              <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-205 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <Users className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold font-display leading-tight">Today’s Attendance</h3>
                    <p className="text-xs opacity-60">Manage today's checked-in player pool</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  isSunlight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-950/40 text-emerald-400'
                }`}>
                  {attendancePlayers.length} Checked In
                </span>
              </div>

              {/* Attendance player chips grid */}
              {attendancePlayers.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <p className="text-sm opacity-60">No players checked in yet.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 py-1 px-1">
                  {attendancePlayers.map((name) => (
                    <div 
                      key={name}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all group/chip ${
                        isSunlight 
                          ? 'bg-slate-100 text-slate-800 hover:bg-red-50 hover:text-red-800' 
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-750 hover:text-red-300'
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{name}</span>
                      {userRole === 'scorer' && (
                        <button 
                          onClick={() => handleRemoveAttendancePlayer(name)}
                          className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/15 focus:outline-none transition-colors"
                          aria-label={`Remove ${name}`}
                        >
                          <X className="w-3.5 h-3.5 opacity-60 group-hover/chip:opacity-100" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Players inputs section */}
              {userRole === 'scorer' && (
                <div className="flex gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={attendanceInput}
                      onChange={(e) => setAttendanceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddAttendancePlayers(attendanceInput);
                        }
                      }}
                      placeholder="Add players (comma-separated, e.g. Andy, Ajit)"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        isSunlight 
                          ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:bg-slate-900'
                      }`}
                    />
                  </div>
                  <button
                    onClick={() => handleAddAttendancePlayers(attendanceInput)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-97 text-white font-medium text-sm rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>

            {/* Core Grid Cards */}
            {userRole === 'scorer' && (
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
            )}

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

                          {userRole === 'scorer' && (
                            <button
                              onClick={() => handleDeleteMatch(m.id)}
                              className="p-2 text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center font-bold"
                              title="Delete Scorecard"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

            {/* UNASSIGNED PLAYERS SECTION */}
            {(() => {
              const unassignedPlayers = attendancePlayers.filter(
                p => !teamASquad.includes(p) && !teamBSquad.includes(p)
              );
              return unassignedPlayers.length > 0 ? (
                <div className={`p-5 rounded-xl border space-y-3 ${
                  isSunlight ? 'bg-emerald-50/20 border-emerald-200' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-center pb-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 rounded text-emerald-600 dark:text-emerald-400">
                        <Users className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="font-bold font-display text-sm leading-tight">Unassigned Checked-In Players ({unassignedPlayers.length})</h3>
                        <p className="text-[10px] opacity-60">Today's checked-in players not yet assigned to any team roster</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 max-h-40 overflow-y-auto">
                    {unassignedPlayers.map(p => (
                      <div 
                        key={p} 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          isSunlight ? 'bg-slate-100 border border-slate-200 text-slate-800' : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">{p}</span>
                        <div className="flex items-center gap-1.5 border-l pl-2 border-slate-300 dark:border-slate-700">
                          <button
                            onClick={() => {
                              triggerHapticFeedback();
                              const updatedA = [...teamASquad, p];
                              setTeamASquad(updatedA);
                              handleSaveSquadChanges(updatedA, teamBSquad);
                              triggerToast(`Assigned ${p} to ${teamAName}`);
                            }}
                            className="px-1.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-black text-[10px] transition-colors"
                            title={`Assign to ${teamAName}`}
                          >
                            + A
                          </button>
                          <button
                            onClick={() => {
                              triggerHapticFeedback();
                              const updatedB = [...teamBSquad, p];
                              setTeamBSquad(updatedB);
                              handleSaveSquadChanges(teamASquad, updatedB);
                              triggerToast(`Assigned ${p} to ${teamBName}`);
                            }}
                            className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] transition-colors"
                            title={`Assign to ${teamBName}`}
                          >
                            + B
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

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
                        onClick={() => handleMovePlayerColumn('A', idx)}
                        className="p-2 text-sky-500 hover:bg-sky-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Move to Team B"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemovePlayerSlot('A', idx)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                        title="Remove Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handleAddPlayerSlot('A')}
                    className="w-full py-2 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Player Custom Slot
                  </button>

                  {/* Direct add field */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={directInputA}
                      onChange={(e) => setDirectInputA(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddPlayerToTeamDirect('A', directInputA);
                          setDirectInputA('');
                        }
                      }}
                      placeholder="Add player directly to Team A..."
                      className={`flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isSunlight 
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-105 focus:bg-slate-900'
                      }`}
                    />
                    <button
                      onClick={() => {
                        handleAddPlayerToTeamDirect('A', directInputA);
                        setDirectInputA('');
                      }}
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shrink-0 transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
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
                        onClick={() => handleMovePlayerColumn('B', idx)}
                        className="p-2 text-sky-500 hover:bg-sky-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Move to Team A"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemovePlayerSlot('B', idx)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                        title="Remove Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handleAddPlayerSlot('B')}
                    className="w-full py-2 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Player Custom Slot
                  </button>

                  {/* Direct add field */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={directInputB}
                      onChange={(e) => setDirectInputB(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddPlayerToTeamDirect('B', directInputB);
                          setDirectInputB('');
                        }
                      }}
                      placeholder="Add player directly to Team B..."
                      className={`flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        isSunlight 
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-105 focus:bg-slate-900'
                      }`}
                    />
                    <button
                      onClick={() => {
                        handleAddPlayerToTeamDirect('B', directInputB);
                        setDirectInputB('');
                      }}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shrink-0 transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
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
                        <div className="space-y-2">
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
                            
                            <div className="text-right font-mono flex items-center gap-3">
                              <div>
                                <p className="text-xl font-bold">{b1.runs} <span className="text-xs font-normal">({b1.balls})</span></p>
                                <p className="text-[10px] opacity-60">4s: {b1.fours} • 6s: {b1.sixes}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplacingBatterId(replacingBatterId === b1.id ? null : b1.id);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-indigo-600 rounded-lg text-xs font-extrabold flex items-center justify-center border dark:border-slate-700"
                                title="Change or Substitute this batsman"
                              >
                                🔄
                              </button>
                            </div>
                          </div>

                          {/* Inline Substitution menu */}
                          {replacingBatterId === b1.id && (
                            <div className="p-3 bg-indigo-50/50 dark:bg-slate-850 border border-indigo-100 dark:border-slate-805 rounded-xl space-y-2 text-slate-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-indigo-600 block uppercase">Substitute {b1.name} with:</span>
                                <button onClick={() => setReplacingBatterId(null)} className="text-[10px] font-bold text-slate-500 hover:underline">Close</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                                {inn.battingOrder
                                  .filter(p => !p.out && p.id !== b1.id && p.id !== inn.currentBatter2Id)
                                  .map(p => (
                                    <button
                                      key={p.id}
                                      onClick={() => handleSubstituteActiveBatsman(b1.id, p.id)}
                                      className="px-2 py-1 text-xs bg-white dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-800 dark:text-slate-100"
                                    >
                                      {p.name}
                                    </button>
                                  ))
                                }
                              </div>
                              <div className="flex gap-1.5 pt-1">
                                <input
                                  type="text"
                                  placeholder="Or type custom player name..."
                                  value={tempReplaceName}
                                  onChange={(e) => setTempReplaceName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && tempReplaceName.trim()) {
                                      handleSubstituteActiveBatsman(b1.id, '', tempReplaceName.trim());
                                      setTempReplaceName('');
                                    }
                                  }}
                                  className={`flex-1 px-2.5 py-1 text-xs rounded-md border focus:outline-none ${
                                    isSunlight ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700 text-white'
                                  }`}
                                />
                                <button
                                  onClick={() => {
                                    if (tempReplaceName.trim()) {
                                      handleSubstituteActiveBatsman(b1.id, '', tempReplaceName.trim());
                                      setTempReplaceName('');
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-505 rounded-md font-bold"
                                >
                                  Swap
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 border-2 border-dashed border-rose-500 rounded-xl bg-rose-500/5 text-center text-rose-500 font-extrabold text-sm select-none py-4">
                          ⚠️ Batter 1 is Out! Click incoming batsman card below.
                        </div>
                      )}

                      {/* BATTER 2 CARD CARD */}
                      {b2 ? (
                        <div className="space-y-2">
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
                            
                            <div className="text-right font-mono flex items-center gap-3">
                              <div>
                                <p className="text-xl font-bold">{b2.runs} <span className="text-xs font-normal">({b2.balls})</span></p>
                                <p className="text-[10px] opacity-60">4s: {b2.fours} • 6s: {b2.sixes}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplacingBatterId(replacingBatterId === b2.id ? null : b2.id);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-indigo-600 rounded-lg text-xs font-extrabold flex items-center justify-center border dark:border-slate-700"
                                title="Change or Substitute this batsman"
                              >
                                🔄
                              </button>
                            </div>
                          </div>

                          {/* Inline Substitution menu */}
                          {replacingBatterId === b2.id && (
                            <div className="p-3 bg-indigo-50/50 dark:bg-slate-850 border border-indigo-100 dark:border-slate-805 rounded-xl space-y-2 text-slate-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-indigo-600 block uppercase">Substitute {b2.name} with:</span>
                                <button onClick={() => setReplacingBatterId(null)} className="text-[10px] font-bold text-slate-500 hover:underline">Close</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                                {inn.battingOrder
                                  .filter(p => !p.out && p.id !== b2.id && p.id !== inn.currentBatter1Id)
                                  .map(p => (
                                    <button
                                      key={p.id}
                                      onClick={() => handleSubstituteActiveBatsman(b2.id, p.id)}
                                      className="px-2 py-1 text-xs bg-white dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-800 dark:text-slate-100"
                                    >
                                      {p.name}
                                    </button>
                                  ))
                                }
                              </div>
                              <div className="flex gap-1.5 pt-1">
                                <input
                                  type="text"
                                  placeholder="Or type custom player name..."
                                  value={tempReplaceName}
                                  onChange={(e) => setTempReplaceName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && tempReplaceName.trim()) {
                                      handleSubstituteActiveBatsman(b2.id, '', tempReplaceName.trim());
                                      setTempReplaceName('');
                                    }
                                  }}
                                  className={`flex-1 px-2.5 py-1 text-xs rounded-md border focus:outline-none ${
                                    isSunlight ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700 text-white'
                                  }`}
                                />
                                <button
                                  onClick={() => {
                                    if (tempReplaceName.trim()) {
                                      handleSubstituteActiveBatsman(b2.id, '', tempReplaceName.trim());
                                      setTempReplaceName('');
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-505 rounded-md font-bold"
                                >
                                  Swap
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 border-2 border-dashed border-rose-500 rounded-xl bg-rose-500/5 text-center text-rose-500 font-extrabold text-sm select-none py-4">
                          ⚠️ Batter 2 is Out! Click incoming batsman card below.
                        </div>
                      )}

                    </div>

                    {/* SELECT INCOMING BATTER INTERNALLY */}
                    {hasNoBatsmanSlot && (
                      <div className="pt-2 border-t border-dashed space-y-3 select-none">
                        <span className="text-[10px] text-indigo-500 font-black uppercase tracking-wider block">Choose replacement batsman:</span>
                        
                        <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
                          {inn.battingOrder.map((player) => {
                            const isOut = player.out;
                            const inPlay = inn.currentBatter1Id === player.id || inn.currentBatter2Id === player.id;

                            if (isOut || inPlay) return null;

                            return (
                              <button
                                key={player.id}
                                onClick={() => handleAssignIncomingBatsmanById(player.id)}
                                className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-extrabold active:scale-95 transition-transform flex items-center gap-1"
                                id={`assign-batsman-${player.id}`}
                              >
                                <span>🏏</span>
                                <span>{player.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom player addition right under selection */}
                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            placeholder="Type new batsman name here..."
                            value={customIncomingName}
                            onChange={(e) => setCustomIncomingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddCustomIncomingBatsman();
                              }
                            }}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              isSunlight 
                                ? 'bg-white border-slate-300 text-slate-900' 
                                : 'bg-slate-800 border-slate-750 text-white'
                            }`}
                            id="custom-incoming-batsman-input"
                          />
                          <button
                            onClick={handleAddCustomIncomingBatsman}
                            disabled={!customIncomingName.trim()}
                            className="px-3 py-1.5 text-xs bg-indigo-600 font-bold hover:bg-indigo-500 text-white rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                          >
                            + Put in Play
                          </button>
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
                      onClick={() => setWicketConfig({ showOptions: false, type: null, batsmanId: null, incomingBatsmanId: null })}
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

                  {/* Pick which batsman got out & select incoming batsman */}
                  {currentMatch && (() => {
                    const inn = currentMatch.currentInningsIndex === 1 ? currentMatch.innings1 : currentMatch.innings2;
                    if (!inn) return null;
                    const b1 = inn.battingOrder.find(p => p.id === inn.currentBatter1Id);
                    const b2 = inn.battingOrder.find(p => p.id === inn.currentBatter2Id);

                    const unusedPlayers = inn.battingOrder.filter(p => !p.out && p.id !== inn.currentBatter1Id && p.id !== inn.currentBatter2Id);

                    return (
                      <div className="space-y-4">
                        {/* 1. Which Batter is dismissed */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Which Batter is dismissed?</label>
                          <div className="grid grid-cols-2 gap-4">
                            {b1 && (
                              <button
                                onClick={() => setWicketConfig({ ...wicketConfig, batsmanId: b1.id })}
                                className={`p-3 rounded-xl border text-center font-extrabold ${
                                  wicketConfig.batsmanId === b1.id
                                    ? 'bg-red-500 text-white border-red-650 font-black'
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
                                    ? 'bg-red-500 text-white border-red-650 font-black'
                                    : 'bg-white border-slate-300 dark:bg-slate-850 dark:border-slate-750'
                                }`}
                              >
                                {b2.name} (Non-striker)
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. Choose next batsman */}
                        <div className="space-y-2 border-t pt-3 border-dashed border-red-200/40">
                          <label className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Who is the NEXT batsman (Incoming)? (Optional)</label>
                          
                          {unusedPlayers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pb-1">
                              {unusedPlayers.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => setWicketConfig({ ...wicketConfig, incomingBatsmanId: p.id })}
                                  className={`px-3 py-1.5 text-xs rounded-lg border font-bold transition-transform active:scale-95 ${
                                    wicketConfig.incomingBatsmanId === p.id
                                      ? 'bg-indigo-600 border-indigo-700 text-white font-black'
                                      : 'bg-white border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-white'
                                  }`}
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs italic text-rose-500 font-bold">No unused batsmen in squad. Team is all out or empty.</p>
                          )}

                          {/* Option to type custom batsman name on the fly */}
                          <div className="flex items-center gap-2 pt-1 border-t border-red-150/10">
                            <input
                              type="text"
                              placeholder="Or write a brand new batsman name..."
                              value={customWicketIncomingName}
                              onChange={(e) => setCustomWicketIncomingName(e.target.value)}
                              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-red-400 ${
                                isSunlight 
                                  ? 'bg-white border-slate-300 text-slate-900' 
                                  : 'bg-slate-805 border-slate-700 text-white'
                              }`}
                            />
                            {customWicketIncomingName.trim() && (
                              <span className="text-[10px] uppercase bg-green-500 text-white font-black px-1.5 py-0.5 rounded animate-pulse">
                                NEW PLAYER
                              </span>
                            )}
                          </div>
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
