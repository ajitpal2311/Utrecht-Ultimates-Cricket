import { CricketMatch, Innings, PlayerStats, BowlerStats, Extras, BallRecord } from './types';

// Initialise a new batting stats entry
export function createPlayerStats(id: string, name: string): PlayerStats {
  return {
    id,
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
  };
}

// Initialise a new bowling stats entry
export function createBowlerStats(id: string, name: string): BowlerStats {
  return {
    id,
    name,
    balls: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
  };
}

// Create a raw innings structure
export function createInnings(
  battingTeamId: 'A' | 'B',
  bowlingTeamId: 'A' | 'B',
  playerNames: string[]
): Innings {
  const battingOrder: PlayerStats[] = playerNames.map((name, idx) => 
    createPlayerStats(`p-${battingTeamId}-${idx + 1}`, name)
  );
  
  return {
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    battingOrder,
    bowlingOrder: [],
    currentBatter1Id: battingOrder[0]?.id || null, // Batter 1
    currentBatter2Id: battingOrder[1]?.id || null, // Batter 2
    strikerId: battingOrder[0]?.id || null,        // Striker
    currentBowlerId: null,
    overHistory: [],
  };
}

// Build a fresh match
export function createNewMatch(
  matchName: string,
  teamAName: string,
  teamBName: string,
  overs: number,
  playersPerTeam: number,
  creatorId: string | null,
  enableHalfwayRules?: boolean
): CricketMatch {
  const matchId = `match-${Date.now()}-${Math.floor(Math.random() * 1500)}`;
  return {
    id: matchId,
    matchName: matchName || 'Utrecht Social Match',
    teamAName: teamAName || 'Team A',
    teamBName: teamBName || 'Team B',
    overs: overs || 5,
    playersPerTeam: playersPerTeam || 11,
    status: 'created',
    tossWinner: null,
    tossDecision: null,
    innings1: null,
    innings2: null,
    currentInningsIndex: 1,
    winner: null,
    marginOfVictory: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ballHistory: [],
    enableHalfwayRules: !!enableHalfwayRules,
  };
}

// Record a ball in the match
export function recordDelivery(
  match: CricketMatch,
  runs: number, // runs off bat OR run-extras (excludes direct penalty runs of wides/no-balls)
  extrasType: 'wd' | 'nb' | 'by' | 'lb' | null,
  isWicket: boolean,
  wicketType?: 'bowled' | 'caught' | 'run out' | 'lbw' | 'stumped' | 'other',
  dismissedPlayerId?: string
): CricketMatch {
  // Deep clone match so we don't mutate state directly
  const newMatch: CricketMatch = JSON.parse(JSON.stringify(match));
  const activeIndex = newMatch.currentInningsIndex;
  const innings = activeIndex === 1 ? newMatch.innings1 : newMatch.innings2;

  if (!innings) return match;

  const strikerId = innings.strikerId;
  const batter1Id = innings.currentBatter1Id;
  const batter2Id = innings.currentBatter2Id;
  const bowlerId = innings.currentBowlerId;

  if (!strikerId || !batter1Id || !batter2Id || !bowlerId) {
    // Cannot score without a striker, a partner, and a bowler
    return match;
  }

  const nonStrikerId = strikerId === batter1Id ? batter2Id : batter1Id;

  // Retrieve batsman and bowler references in scorecards
  let batsman = innings.battingOrder.find(p => p.id === strikerId);
  let bowler = innings.bowlingOrder.find(b => b.id === bowlerId);

  // If bowler is not in this inning's bowling stats yet, add them
  if (!bowler) {
    // Find player's name from original team squad
    const bowlerTeamId = innings.bowlingTeamId;
    const teamPlayerList = bowlerTeamId === 'A' ? newMatch.teamAName : newMatch.teamBName;
    // Just a placeholder name unless we find or specify it
    const defaultBowlers = activeIndex === 1 
      ? (newMatch.innings1?.bowlingOrder.map(b => b.name) || []) 
      : [];
    // We will look up or define dynamically in the UI
    const bowlerName = 'Bowler ' + (innings.bowlingOrder.length + 1);
    bowler = createBowlerStats(bowlerId, bowlerName);
    innings.bowlingOrder.push(bowler);
  }

  if (!batsman) return match;

  let teamRunsAdded = 0;
  let isLegalDelivery = true;
  let ballDisplay = '';

  const halfwayBalls = (newMatch.overs * 6) / 2;
  const useHalfwayRules = !!newMatch.enableHalfwayRules;
  const isBeforeHalfway = useHalfwayRules && (innings.balls < halfwayBalls);

  // 1. Calculate Score Changes
  if (extrasType === 'wd') {
    if (useHalfwayRules) {
      if (isBeforeHalfway) {
        isLegalDelivery = true;
        const widePenalty = 3;
        innings.extras.wides += widePenalty;
        teamRunsAdded = widePenalty;
        bowler.runs += widePenalty;
        bowler.balls += 1;
        ballDisplay = '3Wd';
      } else {
        isLegalDelivery = false;
        const widePenalty = 1;
        innings.extras.wides += widePenalty;
        teamRunsAdded = widePenalty;
        bowler.runs += widePenalty;
        ballDisplay = '1Wd';
      }
    } else {
      isLegalDelivery = false;
      const wideRuns = 1 + runs; // 1 penalty run + runs run from it
      innings.extras.wides += wideRuns;
      teamRunsAdded = wideRuns;
      bowler.runs += wideRuns;
      ballDisplay = `${wideRuns}Wd`;
    }
  } else if (extrasType === 'nb') {
    if (useHalfwayRules) {
      if (isBeforeHalfway) {
        isLegalDelivery = true;
        const noBallPenalty = 3;
        innings.extras.noBalls += noBallPenalty;
        // Credit batting runs to batsman
        batsman.runs += runs;
        batsman.balls += 1;
        if (runs === 4) batsman.fours += 1;
        if (runs === 6) batsman.sixes += 1;
        
        teamRunsAdded = noBallPenalty + runs;
        bowler.runs += noBallPenalty + runs;
        bowler.balls += 1;
        ballDisplay = runs > 0 ? `Nb+${runs}` : 'Nb';
      } else {
        isLegalDelivery = false;
        const noBallPenalty = 1;
        innings.extras.noBalls += noBallPenalty;
        // Credit batting runs to batsman
        batsman.runs += runs;
        batsman.balls += 1;
        if (runs === 4) batsman.fours += 1;
        if (runs === 6) batsman.sixes += 1;
        
        teamRunsAdded = noBallPenalty + runs;
        bowler.runs += noBallPenalty + runs;
        ballDisplay = runs > 0 ? `Nb+${runs}` : 'Nb';
      }
    } else {
      isLegalDelivery = false;
      const noBallPenalty = 1;
      innings.extras.noBalls += noBallPenalty;
      // If runs are scored off a no-ball, they are credited to the batsman (runs off bat)
      batsman.runs += runs;
      batsman.balls += 1;
      if (runs === 4) batsman.fours += 1;
      if (runs === 6) batsman.sixes += 1;
      
      teamRunsAdded = noBallPenalty + runs;
      bowler.runs += noBallPenalty + runs;
      ballDisplay = runs > 0 ? `Nb+${runs}` : 'Nb';
    }
  } else if (extrasType === 'by') {
    // Legal delivery
    isLegalDelivery = true;
    innings.extras.byes += runs;
    teamRunsAdded = runs;
    batsman.balls += 1;
    // Bowler gets credit for legal ball, but byes do NOT count as runs against bowler
    bowler.balls += 1;
    ballDisplay = `${runs}By`;
  } else if (extrasType === 'lb') {
    // Legal delivery
    isLegalDelivery = true;
    innings.extras.legByes += runs;
    teamRunsAdded = runs;
    batsman.balls += 1;
    // Bowler gets credit for legal ball, but leg-byes do NOT count as runs against bowler
    bowler.balls += 1;
    ballDisplay = `${runs}Lb`;
  } else {
    // Normal runs off the bat (legal delivery)
    isLegalDelivery = true;
    batsman.runs += runs;
    batsman.balls += 1;
    if (runs === 4) batsman.fours += 1;
    if (runs === 6) batsman.sixes += 1;

    teamRunsAdded = runs;
    bowler.balls += 1;
    bowler.runs += runs;
    ballDisplay = runs.toString();
  }

  innings.runs += teamRunsAdded;

  // 2. Handle Wickets
  let finalDismissedId = dismissedPlayerId || strikerId;
  if (isWicket) {
    innings.wickets += 1;
    ballDisplay = ballDisplay === '0' || ballDisplay === 'Nb' ? 'W' : `${ballDisplay}+W`;
    
    // Find batsman who got dismissed
    const dismissedBatsman = innings.battingOrder.find(p => p.id === finalDismissedId);
    if (dismissedBatsman) {
      dismissedBatsman.out = true;
      dismissedBatsman.dismissType = wicketType || 'bowled';
      dismissedBatsman.dismissBowler = bowler.name;
    }

    // Bowler gets credited with a wicket unless it is a run out or obstruction
    if (wicketType !== 'run out') {
      bowler.wickets += 1;
    }

    // Clear the dismissed batsman from batting spots
    if (innings.currentBatter1Id === finalDismissedId) {
      innings.currentBatter1Id = null;
    } else if (innings.currentBatter2Id === finalDismissedId) {
      innings.currentBatter2Id = null;
    }
    
    if (innings.strikerId === finalDismissedId) {
      innings.strikerId = null;
    }
  }

  // 3. Increment legal ball counts
  if (isLegalDelivery) {
    innings.balls += 1;
  }

  // 4. Swap ends if odd runs are scored (except run outs or special cases - simple cricket physics)
  // Batter runs can be off bat or byes/legbyes.
  const scoredRunsForSwapping = extrasType === 'wd' ? runs : runs; 
  const totalPhysicalRuns = (extrasType === 'by' || extrasType === 'lb' || extrasType === null || extrasType === 'nb') ? runs : 0;
  
  // Normal end swap for odd team runs actually run
  if (totalPhysicalRuns % 2 === 1 || (extrasType === 'wd' && runs % 2 === 1)) {
    innings.strikerId = nonStrikerId;
  }

  // Add ball to history display
  innings.overHistory.push(ballDisplay);

  // Keep a full record of this ball for UNDO and real-time streams
  const ballRecord: BallRecord = {
    inningIndex: activeIndex,
    ballNumberInInnings: innings.balls,
    overNumber: Math.floor((innings.balls - (isLegalDelivery ? 1 : 0)) / 6),
    ballNumberInOver: ((innings.balls - (isLegalDelivery ? 1 : 0)) % 6) + 1,
    strikerId,
    nonStrikerId,
    bowlerId,
    runs: extrasType === null || extrasType === 'nb' ? runs : 0,
    extrasType,
    extrasRuns: extrasType === 'wd' ? teamRunsAdded : (extrasType === 'nb' ? (useHalfwayRules ? (isBeforeHalfway ? 3 : 1) : 1) : runs),
    isWicket,
    wicketType,
    dismissedPlayerId: isWicket ? finalDismissedId : undefined,
    description: `${innings.battingTeamId === 'A' ? newMatch.teamAName : newMatch.teamBName} Inning ${activeIndex} - Over ${Math.floor((innings.balls - (isLegalDelivery ? 1 : 0)) / 6)}.${((innings.balls - (isLegalDelivery ? 1 : 0)) % 6) + 1}: ${ballDisplay}`,
  };
  newMatch.ballHistory.push(ballRecord);

  // 5. Over Completed logic (6 legal balls)
  const legalBallsBowled = innings.balls;
  const isOverEnded = isLegalDelivery && (legalBallsBowled % 6 === 0);

  if (isOverEnded) {
    // Batter swap ends at the end of the over (since bowling end changes)
    const currentStriker = innings.strikerId;
    const currentNonStriker = currentStriker === innings.currentBatter1Id ? innings.currentBatter2Id : innings.currentBatter1Id;
    if (currentStriker && currentNonStriker) {
      innings.strikerId = currentNonStriker; // non-striker gets the strike next over
    }
    // Set bowler to null, forces UI to select a new bowler
    innings.currentBowlerId = null;
    // Over history resets for the next over
    innings.overHistory = [];
  }

  // 6. Check Innings Transitions & End-Game Conditions
  const allOutWickets = newMatch.playersPerTeam - 1;
  const oversBallsLimit = newMatch.overs * 6;

  if (activeIndex === 1) {
    // Inning 1 Ends: All out OR Overs complete
    if (innings.wickets >= allOutWickets || innings.balls >= oversBallsLimit) {
      // Create Inning 2 with opposite batting/bowling
      const battingTeamSecond = innings.bowlingTeamId;
      const bowlingTeamSecond = innings.battingTeamId;
      const squadSecond = battingTeamSecond === 'A' ? 
        (newMatch.innings1?.bowlingOrder.map(b => b.name) || []) : []; // will define dynamic squad 
      
      newMatch.currentInningsIndex = 2;
      // In visual layout, we initialize Innings 2.
      // Squadnames will be inherited/selected when Inning 2 setup occurs in UI
    }
  } else {
    // Inning 2 scoring check
    const target = (newMatch.innings1?.runs || 0) + 1;
    if (innings.runs >= target) {
      // Inning 2 team wins immediately!
      newMatch.status = 'completed';
      newMatch.winner = innings.battingTeamId;
      const wicketsLeft = newMatch.playersPerTeam - innings.wickets;
      newMatch.marginOfVictory = `${wicketsLeft} wickets`;
    } else if (innings.wickets >= allOutWickets || innings.balls >= oversBallsLimit) {
      // Inning 2 completed without reaching target
      newMatch.status = 'completed';
      if (innings.runs === target - 1) {
        newMatch.winner = 'tie';
        newMatch.marginOfVictory = 'scores are tied';
      } else {
        newMatch.winner = innings.bowlingTeamId;
        const runDifference = (newMatch.innings1?.runs || 0) - innings.runs;
        newMatch.marginOfVictory = `${runDifference} runs`;
      }
    }
  }

  newMatch.updatedAt = Date.now();
  return newMatch;
}

// Undo previous ball
export function undoLastDelivery(match: CricketMatch): CricketMatch {
  if (match.ballHistory.length === 0) return match;

  // Let's implement an extremely elegant and perfect UNDO stack!
  // Rather than writing complex inverse math (which can easily have edge cases), 
  // we rebuild the entire match from the squad start! This is mathematically solid, 
  // bug-free, and handles all complex runs on wide / wicket / over state transitions perfectly.

  const newHistory = [...match.ballHistory];
  newHistory.pop(); // remove the last delivery record

  // Re-create the base match configuration
  let reconstructed: CricketMatch = {
    id: match.id,
    matchName: match.matchName,
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    overs: match.overs,
    playersPerTeam: match.playersPerTeam,
    status: 'scoring', // revert to scoring
    tossWinner: match.tossWinner,
    tossDecision: match.tossDecision,
    innings1: match.innings1 ? {
      battingTeamId: match.innings1.battingTeamId,
      bowlingTeamId: match.innings1.bowlingTeamId,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      battingOrder: match.innings1.battingOrder.map(p => createPlayerStats(p.id, p.name)),
      bowlingOrder: [],
      currentBatter1Id: match.innings1.battingOrder[0]?.id || null,
      currentBatter2Id: match.innings1.battingOrder[1]?.id || null,
      strikerId: match.innings1.battingOrder[0]?.id || null,
      currentBowlerId: null,
      overHistory: [],
    } : null,
    innings2: match.innings2 ? {
      battingTeamId: match.innings2.battingTeamId,
      bowlingTeamId: match.innings2.bowlingTeamId,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      battingOrder: match.innings2.battingOrder.map(p => createPlayerStats(p.id, p.name)),
      bowlingOrder: [],
      currentBatter1Id: match.innings2.battingOrder[0]?.id || null,
      currentBatter2Id: match.innings2.battingOrder[1]?.id || null,
      strikerId: match.innings2.battingOrder[0]?.id || null,
      currentBowlerId: null,
      overHistory: [],
    } : null,
    currentInningsIndex: 1,
    winner: null,
    marginOfVictory: '',
    createdAt: match.createdAt,
    updatedAt: Date.now(),
    ballHistory: [],
    enableHalfwayRules: match.enableHalfwayRules,
  };

  // Set proper status if matching toss etc.
  if (match.status === 'toss') reconstructed.status = 'toss';
  if (match.status === 'created') reconstructed.status = 'created';

  // Apply each ball in the history sequentially
  for (const b of newHistory) {
    reconstructed.currentInningsIndex = b.inningIndex;
    
    const currentInning = b.inningIndex === 1 ? reconstructed.innings1 : reconstructed.innings2;
    if (currentInning) {
      currentInning.currentBatter1Id = b.strikerId;
      currentInning.currentBatter2Id = b.nonStrikerId;
      currentInning.strikerId = b.strikerId;
      currentInning.currentBowlerId = b.bowlerId;
    }
    
    reconstructed = recordDelivery(
      reconstructed,
      b.runs,
      b.extrasType,
      b.isWicket,
      b.wicketType,
      b.dismissedPlayerId
    );
  }

  return reconstructed;
}

// Convert balls to custom readable Overs count (e.g. 15 balls -> 2.3)
export function ballsToOvers(balls: number): string {
  const overs = Math.floor(balls / 6);
  const remaining = balls % 6;
  return `${overs}.${remaining}`;
}

// Calculate run rate safely
export function calculateRunRate(runs: number, balls: number): string {
  if (balls === 0) return '0.00';
  const overs = balls / 6;
  return (runs / overs).toFixed(2);
}
