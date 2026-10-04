import {
  getDeviceAlexaCode,
  saveDeviceAlexaCode,
  findDeviceIdByAlexaCode,
  getMostRecentActiveDeviceId,
} from "../db.js";

/**
 * Alexa Voice Synchronization Service
 * Manages active Fire TV voice pairing sessions and real-time command queues.
 * Supports persistent device pairing codes across server restarts and auto-routing.
 */

class AlexaSyncService {
  constructor() {
    this.sessions = new Map(); // sessionId -> { sessionId, pairingCode, lastActive, queue }
    this.codeToSession = new Map(); // pairingCode -> sessionId
  }

  derivePairingCode(sessionId) {
    if (!sessionId) return this.generateRandomPairingCode();
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash = (hash << 5) - hash + sessionId.charCodeAt(i);
      hash |= 0;
    }
    return (1000 + (Math.abs(hash) % 9000)).toString();
  }

  generateRandomPairingCode() {
    let code;
    let attempts = 0;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
    } while (this.codeToSession.has(code) && attempts < 100);
    return code;
  }

  generatePairingCode(sessionId = null) {
    if (sessionId) {
      return this.derivePairingCode(sessionId);
    }
    return this.generateRandomPairingCode();
  }

  createOrTouchSession(sessionId, preferredCode = null) {
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

    // 1. Check if device already has a persistent code in SQLite
    let pairingCode = getDeviceAlexaCode(sessionId);

    // 2. If no code in DB, check preferredCode from client (if valid 4 digits)
    if (!pairingCode && preferredCode && /^\d{4}$/.test(preferredCode)) {
      pairingCode = preferredCode;
    }

    // 3. If still no code, derive a deterministic 4-digit code from the persistent sessionId
    if (!pairingCode) {
      pairingCode = this.derivePairingCode(sessionId);
    }

    // Ensure the pairing code is not currently occupied in memory by another session
    if (this.codeToSession.has(pairingCode) && this.codeToSession.get(pairingCode) !== sessionId) {
      let codeNum = parseInt(pairingCode, 10);
      let attempts = 0;
      while (this.codeToSession.has(pairingCode) && this.codeToSession.get(pairingCode) !== sessionId && attempts < 100) {
        codeNum = 1000 + ((codeNum - 1000 + 1) % 9000);
        pairingCode = codeNum.toString();
        attempts++;
      }
    }

    // Persist code in SQLite so it never changes across server restarts
    saveDeviceAlexaCode(sessionId, pairingCode);

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

    // 1. Direct match by pairing code in memory
    if (target && this.codeToSession.has(target)) {
      const sessionId = this.codeToSession.get(target);
      return this.sessions.get(sessionId) || null;
    }

    // 2. Direct match by sessionId in memory
    if (target && this.sessions.has(target)) {
      return this.sessions.get(target);
    }

    // 3. Fallback: Lookup persistent pairing code in SQLite
    // (Recovers sessions after server restarts or when TV was idle)
    if (target && /^\d{4}$/.test(target)) {
      const dbDeviceId = findDeviceIdByAlexaCode(target);
      if (dbDeviceId) {
        this.createOrTouchSession(dbDeviceId, target);
        return this.sessions.get(dbDeviceId) || null;
      }
    }

    // 4. If no target specified or not found, fall back to the most recent active session
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

    // 5. Fallback: resurrect most recently active device from SQLite if memory is empty
    const recentDbDevice = getMostRecentActiveDeviceId();
    if (recentDbDevice?.device_id) {
      this.createOrTouchSession(recentDbDevice.device_id, recentDbDevice.paired_alexa_code);
      return this.sessions.get(recentDbDevice.device_id) || null;
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
