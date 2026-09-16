import {
  loadSettings,
  saveSettings,
  hashPin,
  verifyPin,
  setPin,
  DEFAULT_PARENT_SETTINGS,
  PARENT_SETTINGS_KEY,
} from "../utils/parentSettings";
import { StorageService } from "../utils/storage";

describe("parentSettings utility (Task 14.2)", () => {
  beforeEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
  });

  afterEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
  });

  it("loadSettings returns defaults when storage is empty", () => {
    const settings = loadSettings();
    expect(settings.pinHash).toBeNull();
    expect(settings.settings.allowCustomThemes).toBe(true);
    expect(settings.settings.allowHistory).toBe(true);
    expect(settings.settings.defaultVoice).toBe("Joanna");
  });

  it("verifyPin returns true for correct pin and false for wrong pin", () => {
    const pin = "1234";
    const hashed = hashPin(pin);
    expect(verifyPin("1234", hashed)).toBe(true);
    expect(verifyPin("0000", hashed)).toBe(false);
    expect(verifyPin("", hashed)).toBe(false);
    expect(verifyPin("1234", null)).toBe(false);
  });

  it("setPin stores hash and verifyPin validates it", () => {
    setPin("4321");
    const loaded = loadSettings();
    expect(loaded.pinHash).not.toBeNull();
    expect(verifyPin("4321", loaded.pinHash)).toBe(true);
    expect(verifyPin("1234", loaded.pinHash)).toBe(false);
  });

  it("saveSettings persists and loadSettings reads back correctly", () => {
    const custom = {
      pinHash: hashPin("9999"),
      settings: {
        allowCustomThemes: false,
        allowHistory: false,
        ageRestriction: "5+",
        defaultVoice: "Matthew",
        lockedUntil: null,
      },
    };
    saveSettings(custom);
    const loaded = loadSettings();
    expect(loaded.pinHash).toBe(custom.pinHash);
    expect(loaded.settings.allowCustomThemes).toBe(false);
    expect(loaded.settings.allowHistory).toBe(false);
    expect(loaded.settings.defaultVoice).toBe("Matthew");
    expect(loaded.settings.ageRestriction).toBe("5+");
  });
});
