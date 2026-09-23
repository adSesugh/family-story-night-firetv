/**
 * Alexa Voice Synchronization Service
 * Manages active Fire TV voice pairing sessions and real-time command queues.
 */

class AlexaSyncService {
  constructor() {
    this.sessions = new Map(); // sessionId -> { sessionId, pairingCode, lastActive, queue }
    this.codeToSession = new Map(); // pairingCode -> sessionId
  }

  generatePairingCode() {
    let code;
    let attempts = 0;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
    } while (this.codeToSession.has(code) && attempts < 100);
    return code;
  }

  createOrTouchSession(sessionId) {
    if (!sessionId) {
      throw new Error("sessionId is required");
    }

    this.cleanupStaleSessions();

    let session = this.sessions.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
      return {
        sessionId: session.sessionId,
        pairingCode: session.pairingCode,
        isNew: false,
      };
    }

    const pairingCode = this.generatePairingCode();
    session = {
      sessionId,
      pairingCode,
      lastActive: Date.now(),
      queue: [],
    };

    this.sessions.set(sessionId, session);
    this.codeToSession.set(pairingCode, sessionId);

    return {
      sessionId: session.sessionId,
      pairingCode: session.pairingCode,
      isNew: true,
    };
  }

  findActiveSession(target) {
    this.cleanupStaleSessions();

    // 1. Direct match by pairing code
    if (target && this.codeToSession.has(target)) {
      const sessionId = this.codeToSession.get(target);
      return this.sessions.get(sessionId) || null;
    }

    // 2. Direct match by sessionId
    if (target && this.sessions.has(target)) {
      return this.sessions.get(target);
    }

    // 3. If no target specified or not found, fall back to the most recent active session
    // This allows zero-friction voice commands ("Alexa, tell Family Story Night to start the story")
    if (this.sessions.size > 0) {
      let mostRecent = null;
      for (const session of this.sessions.values()) {
        if (!mostRecent || session.lastActive > mostRecent.lastActive) {
          mostRecent = session;
        }
      }
      return mostRecent;
    }

    return null;
  }

  queueCommand(target, command) {
    const session = this.findActiveSession(target);
    if (!session) {
      return {
        success: false,
        error: "NO_ACTIVE_SESSION",
        message: "No active Fire TV session found. Please open Family Story Night on your TV.",
      };
    }

    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...command,
    };

    session.queue.push(event);
    session.lastActive = Date.now();

    return {
      success: true,
      sessionId: session.sessionId,
      pairingCode: session.pairingCode,
      event,
    };
  }

  consumeCommands(sessionId) {
    this.cleanupStaleSessions();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    session.lastActive = Date.now();
    const commands = [...session.queue];
    session.queue = [];
    return commands;
  }

  cleanupStaleSessions(maxAgeMs = 15 * 60 * 1000) {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActive > maxAgeMs) {
        this.codeToSession.delete(session.pairingCode);
        this.sessions.delete(sessionId);
      }
    }
  }

  reset() {
    this.sessions.clear();
    this.codeToSession.clear();
  }
}

export const alexaSyncService = new AlexaSyncService();
export default alexaSyncService;
