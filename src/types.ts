export interface PlayerStats {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissType?: 'bowled' | 'caught' | 'run out' | 'lbw' | 'stumped' | 'other';
  dismissBowler?: string;
}

export interface BowlerStats {
  id: string;
  name: string;
  balls: number; // total balls bowled
  maidens: number;
  runs: number;
  wickets: number;
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface Innings {
  battingTeamId: 'A' | 'B';
  bowlingTeamId: 'A' | 'B';
  runs: number;
  wickets: number;
  balls: number; // total balls bowled in this innings
  extras: Extras;
  battingOrder: PlayerStats[];
  bowlingOrder: BowlerStats[];
  currentBatter1Id: string | null; // striker or non-striker
  currentBatter2Id: string | null;
  strikerId: string | null; // who is facing
  currentBowlerId: string | null;
  overHistory: string[]; // balls in current over, e.g. ['0', '1', 'Wd', '4', 'W']
}

export interface BallRecord {
  inningIndex: 1 | 2;
  ballNumberInInnings: number;
  overNumber: number;
  ballNumberInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runs: number; // runs off the bat
  extrasType: 'wd' | 'nb' | 'by' | 'lb' | null;
  extrasRuns: number;
  isWicket: boolean;
  wicketType?: 'bowled' | 'caught' | 'run out' | 'lbw' | 'stumped' | 'other';
  dismissedPlayerId?: string;
  description: string;
}

export interface CricketMatch {
  id: string;
  matchName: string;
  teamAName: string;
  teamBName: string;
  overs: number;
  playersPerTeam: number;
  status: 'created' | 'toss' | 'scoring' | 'completed';
  tossWinner: 'A' | 'B' | null;
  tossDecision: 'bat' | 'bowl' | null;
  innings1: Innings | null;
  innings2: Innings | null;
  currentInningsIndex: 1 | 2;
  winner: 'A' | 'B' | 'tie' | null;
  marginOfVictory: string;
  createdAt: number;
  updatedAt: number;
  ballHistory: BallRecord[]; // for full undo log and viewers
  enableHalfwayRules?: boolean;
  creatorId?: string;
}
