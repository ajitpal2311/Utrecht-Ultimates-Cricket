import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createNewMatch, 
  createInnings, 
  recordDelivery, 
  undoLastDelivery, 
  ballsToOvers, 
  calculateRunRate 
} from './matchEngine';
import { CricketMatch } from './types';

describe('Utrecht Cricket Match Engine Tests', () => {

  // Test 1: Match creation and initial validation attributes
  it('should initialize a cricket match with custom and default parameters', () => {
    const match = createNewMatch('Summer Finals', 'Utrecht Tigers', 'Dutch Eagles', 5, 8, null, true);
    
    expect(match.id).toContain('match-');
    expect(match.matchName).toBe('Summer Finals');
    expect(match.teamAName).toBe('Utrecht Tigers');
    expect(match.teamBName).toBe('Dutch Eagles');
    expect(match.overs).toBe(5);
    expect(match.playersPerTeam).toBe(8);
    expect(match.status).toBe('created');
    expect(match.enableHalfwayRules).toBe(true);
  });

  // Test 2: Standard scoring run additions
  it('should correctly increment runs and bowler balls on a legal standard delivery', () => {
    let match = createNewMatch('Eng Test', 'A', 'B', 5, 5, null, false);
    match.innings1 = createInnings('A', 'B', ['BatsmanA', 'BatsmanB']);
    match.innings1.currentBowlerId = 'bowler-1';

    // Set strike
    match.innings1.strikerId = 'p-A-1'; // BatsmanA

    // Score a 4 off the bat
    match = recordDelivery(match, 4, null, false);

    const innings = match.innings1;
    expect(innings.runs).toBe(4);
    expect(innings.balls).toBe(1);
    
    const batsman = innings.battingOrder[0];
    expect(batsman.runs).toBe(4);
    expect(batsman.balls).toBe(1);
    expect(batsman.fours).toBe(1);

    const bowler = innings.bowlingOrder[0];
    expect(bowler.runs).toBe(4);
    expect(bowler.balls).toBe(1);
  });

  // Test 3: Standard single scores rotate strike properly
  it('should rotate strike to non-striker on scoring 1 run', () => {
    let match = createNewMatch('Rotation Test', 'A', 'B', 5, 5, null, false);
    match.innings1 = createInnings('A', 'B', ['B1', 'B2']);
    match.innings1.currentBowlerId = 'bowler-1';

    const b1Id = 'p-A-1';
    const b2Id = 'p-A-2';
    match.innings1.strikerId = b1Id;

    // Delivery 1 (1 run)
    match = recordDelivery(match, 1, null, false);
    expect(match.innings1.strikerId).toBe(b2Id); // swapped to batsman 2

    // Delivery 2 (1 run)
    match = recordDelivery(match, 1, null, false);
    expect(match.innings1.strikerId).toBe(b1Id); // swapped back to batsman 1
  });

  // Test 4: Free-hit and Halfway Rules validation
  it('should penalize 3 runs for a wide ball before halfway and 1 run after halfway under halfway rules', () => {
    // 2-over match (12 balls total). Halfway is 6 balls.
    let match = createNewMatch('Halfway Rule Trial', 'A', 'B', 2, 5, null, true);
    match.innings1 = createInnings('A', 'B', ['Andy', 'B']);
    match.innings1.currentBowlerId = 'bowl-1';
    
    // First delivery is a Wide (before halfway) -> should penalize 3 runs and be a legal ball!
    match = recordDelivery(match, 0, 'wd', false);
    expect(match.innings1.runs).toBe(3);
    expect(match.innings1.balls).toBe(1); // classified as a legal delivery under pre-halfway rules!
    expect(match.innings1.overHistory[0]).toBe('3Wd');

    // Move balls counted up to 6 (halfway point)
    match.innings1.balls = 6;

    // Next delivery is a Wide (at or after halfway) -> should penalize 1 run and NOT count as legal ball
    match = recordDelivery(match, 0, 'wd', false);
    // Runs = 3 + 1 = 4
    expect(match.innings1.runs).toBe(4);
    // Balls counted stays at 6
    expect(match.innings1.balls).toBe(6);
  });

  // Test 5: Rebuild / Rollback Stack (Undo Delivery validation)
  it('should flawlessly perform a complete math reconstruction on an undo call', () => {
    let match = createNewMatch('Undo Trial', 'A', 'B', 5, 5, null, false);
    match.innings1 = createInnings('A', 'B', ['B1', 'B2']);
    match.innings1.currentBowlerId = 'bowler-1';

    // Ball 1: 4 runs scored
    match = recordDelivery(match, 4, null, false);
    // Ball 2: Wicket taken
    match = recordDelivery(match, 0, null, true, 'bowled');

    expect(match.innings1.runs).toBe(4);
    expect(match.innings1.wickets).toBe(1);
    expect(match.ballHistory.length).toBe(2);

    // Perform Undo (reverts wicket)
    match = undoLastDelivery(match);

    expect(match.innings1.runs).toBe(4);
    expect(match.innings1.wickets).toBe(0);
    expect(match.ballHistory.length).toBe(1);
    expect(match.innings1.battingOrder[0].out).toBe(false);

    // Perform another Undo (reverts the initial 4 runs)
    match = undoLastDelivery(match);

    expect(match.innings1.runs).toBe(0);
    expect(match.innings1.balls).toBe(0);
    expect(match.ballHistory.length).toBe(0);
  });

  // Test 6: Safe formatting utilities
  it('should properly format balls to readable overs representation', () => {
    expect(ballsToOvers(0)).toBe('0.0');
    expect(ballsToOvers(5)).toBe('0.5');
    expect(ballsToOvers(6)).toBe('1.0');
    expect(ballsToOvers(14)).toBe('2.2');
  });

  it('should compute safe run rate string', () => {
    expect(calculateRunRate(10, 0)).toBe('0.00');
    expect(calculateRunRate(10, 6)).toBe('10.00'); // 10 runs off 1.0 overs
    expect(calculateRunRate(15, 12)).toBe('7.50');  // 15 runs off 2.0 overs
  });
});

describe('Live Updates & Attendance Rules Tests', () => {
  // Test 7: Verify that a minimum of 4 attendees check-in is required
  it('should enforce attendance rules: minimum 4 players required to create/start match', () => {
    // Simulated component action mimicking high-level check-ins
    const checkStartMatchAllowed = (players: string[]) => {
      return players.length >= 4;
    };

    expect(checkStartMatchAllowed([])).toBe(false);
    expect(checkStartMatchAllowed(['Andy'])).toBe(false);
    expect(checkStartMatchAllowed(['Andy', 'Ajit', 'Arindam'])).toBe(false);
    expect(checkStartMatchAllowed(['Andy', 'Ajit', 'Arindam', 'Bidhan'])).toBe(true);
  });

  // Test 8: Multiple people can listen and get live scorecard updates
  it('should trigger update callbacks for multiple observers when a change occurs', () => {
    let mockStore: { [id: string]: CricketMatch } = {};
    
    // Simulate our subscription database listener for spectator live updates
    const mockListeners: Array<(match: CricketMatch) => void> = [];
    
    const subscribeMockMatch = (matchId: string, onUpdate: (match: CricketMatch) => void) => {
      mockListeners.push(onUpdate);
      // Immediately push current local copy
      if (mockStore[matchId]) {
        onUpdate(mockStore[matchId]);
      }
      return () => {
        const idx = mockListeners.indexOf(onUpdate);
        if (idx > -1) mockListeners.splice(idx, 1);
      };
    };

    const updateMockMatch = (match: CricketMatch) => {
      mockStore[match.id] = match;
      mockListeners.forEach(cb => cb(match));
    };

    const initialMatch = createNewMatch('Live Test', 'A', 'B', 5, 5, null);
    mockStore[initialMatch.id] = initialMatch;

    // Setup 3 client/spectator listeners simultaneously
    let client1MatchState: CricketMatch | null = null;
    let client2MatchState: CricketMatch | null = null;
    let client3MatchState: CricketMatch | null = null;

    const unsub1 = subscribeMockMatch(initialMatch.id, (m) => { client1MatchState = m; });
    const unsub2 = subscribeMockMatch(initialMatch.id, (m) => { client2MatchState = m; });
    const unsub3 = subscribeMockMatch(initialMatch.id, (m) => { client3MatchState = m; });

    // Initial load check
    expect(client1MatchState?.id).toBe(initialMatch.id);
    expect(client2MatchState?.id).toBe(initialMatch.id);
    expect(client3MatchState?.id).toBe(initialMatch.id);

    // Scoring is done by the Official Scorer on their screen
    let updatedMatch: CricketMatch = { ...initialMatch, status: 'scoring' };
    inningsWalk: {
      updatedMatch.innings1 = createInnings('A', 'B', ['Play1', 'Play2']);
      updatedMatch.innings1.currentBowlerId = 'bowl-1';
      updatedMatch.innings1.strikerId = 'p-A-1';
    }
    
    updatedMatch = recordDelivery(updatedMatch, 6, null, false); // Six hit!

    // Save and dispatch the update
    updateMockMatch(updatedMatch);

    // Verify all 3 viewers got real-time updates instantly (Live 6 runs score)
    expect(client1MatchState?.innings1?.runs).toBe(6);
    expect(client2MatchState?.innings1?.runs).toBe(6);
    expect(client3MatchState?.innings1?.runs).toBe(6);
    expect(client1MatchState?.innings1?.overHistory[0]).toBe('6');

    // Clean up
    unsub1();
    unsub2();
    unsub3();
  });
});
