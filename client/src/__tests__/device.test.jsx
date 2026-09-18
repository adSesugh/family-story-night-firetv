import { isFireTVDevice } from "../utils/device";

describe("Fire TV Device Detection", () => {
  test("returns false for standard desktop or mobile browsers", () => {
    expect(isFireTVDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
    expect(isFireTVDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(false);
    expect(isFireTVDevice("")).toBe(false);
  });

  test("detects Amazon Fire TV device codes (AFTS, AFTT, AFTMM, AFTN)", () => {
    // Fire TV Stick (AFTT)
    expect(isFireTVDevice("Mozilla/5.0 (Linux; Android 5.1; AFTT Build/LVY48F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/59.0.3071.125 Mobile Safari/537.36")).toBe(true);
    // Fire TV 4K (AFTMM)
    expect(isFireTVDevice("Mozilla/5.0 (Linux; Android 7.1.2; AFTMM Build/NS6264) AppleWebKit/537.36 (KHTML, like Gecko) Silk/73.6.1 like Chrome/73.0.3683.90 Safari/537.36")).toBe(true);
    // Fire TV Cube (AFTR)
    expect(isFireTVDevice("Mozilla/5.0 (Linux; Android 9; AFTR) AppleWebKit/537.36")).toBe(true);
  });

  test("detects AmazonWebAppRuntime user agent", () => {
    expect(isFireTVDevice("Mozilla/5.0 (Linux; U; Android 7.1.2; en-US; AFTN) AppleWebKit/537.36 AmazonWebAppRuntime")).toBe(true);
  });

  test("detects Silk browser on Android TV", () => {
    expect(isFireTVDevice("Mozilla/5.0 (Linux; Android 9; SmartTV) AppleWebKit/537.36 Silk/80.0 Mobile Safari/537.36")).toBe(true);
  });
});
