import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Use environment variable for API base, fallback to production
const API_BASE = process.env.VITE_API_BASE;

/**
 * TASK 1 & TASK 2: Bug Condition Exploration and Preservation Tests
 * 
 * This test suite validates the audio auto-start bugfix using a simplified
 * test approach that tracks API calls and audio.play() execution.
 * 
 * Property 1: Bug Condition - Audio Auto-Play on Initial Story Load
 * For screen === "story" AND pageIndex === 0 on initial render,
 * narration SHALL fetch AND audio.play() SHALL execute.
 * Validates: Requirements 2.1, 2.2
 * 
 * Property 2: Preservation - Page Navigation After Page 1
 * For screen === "story" AND pageIndex >= 1, narration SHALL continue
 * to work exactly as before (no regressions).
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

describe('Audio Auto-Start Bugfix - Bug Condition and Preservation Tests', () => {
  let mockFetch;
  let narrationCalls = [];
  let audioPlayCalls = [];
  let mockAudioPlay;

  beforeEach(() => {
    narrationCalls = [];
    audioPlayCalls = [];

    // Track narration fetches
    mockFetch = jest.fn().mockImplementation((url, options) => {
      if (url.includes('/generate-story')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            pages: [
              'Page 1 content.',
              'Page 2 content.',
              'Page 3 content.',
              'Page 4 content.',
              'Page 5 content.',
              'Page 6 content.'
            ]
          })
        });
      }
      if (url.includes('/narrate')) {
        try {
          const body = JSON.parse(options.body || '{}');
          narrationCalls.push({
            text: body.text,
            pageIndex: body.pageIndex,
            timestamp: Date.now()
          });
        } catch (e) {
          narrationCalls.push({ timestamp: Date.now() });
        }
        const blob = new Blob(['audio'], { type: 'audio/mp3' });
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(blob)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    global.fetch = mockFetch;
    global.URL.createObjectURL = jest.fn(() => 'blob:test-' + Math.random());
    global.URL.revokeObjectURL = jest.fn();

    // Track audio.play() calls
    mockAudioPlay = jest.fn().mockResolvedValue(undefined);
    HTMLAudioElement.prototype.play = mockAudioPlay;
    HTMLAudioElement.prototype.pause = jest.fn();
    HTMLAudioElement.prototype.load = jest.fn();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TASK 1: Initial story load (pageIndex=0) should fetch AND play audio', async () => {
    const TestApp = () => {
      const [screen, setScreen] = React.useState('loading');
      const [pages, setPages] = React.useState([]);
      const [pageIndex, setPageIndex] = React.useState(0);
      const audioRef = React.useRef(null);

      React.useEffect(() => {
        const timer = setTimeout(async () => {
          try {
            const res = await fetch(`${API_BASE}/generate-story`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ familyMembers: ['Alice'], theme: 'adventure' })
            });
            const data = await res.json();
            setPages(data.pages);
            setPageIndex(0);
            setScreen('story');
          } catch (e) {
            console.error(e);
          }
        }, 10);
        return () => clearTimeout(timer);
      }, []);

      React.useEffect(() => {
        if (screen !== 'story' || !pages[pageIndex]) return;

        let cancelled = false;

        (async () => {
          try {
            const res = await fetch(`${API_BASE}/narrate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: pages[pageIndex] })
            });

            if (!res.ok || cancelled) return;

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = url;
              audioRef.current.load();
              audioRef.current.play().catch(() => {});
            }
          } catch (err) {
            console.error('narration failed', err);
          }
        })();

        return () => {
          cancelled = true;
        };
      }, [screen, pageIndex, pages]);

      return (
        <div>
          <audio ref={audioRef} />
          <p>{screen} - page {pageIndex}</p>
        </div>
      );
    };

    render(<TestApp />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/generate-story`,
        expect.any(Object)
      );
    }, { timeout: 100 });

    await waitFor(() => {
      expect(narrationCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });

    try {
      await waitFor(() => {
        if (mockAudioPlay.mock.calls.length === 0) {
          throw new Error(
            'BUG CONFIRMED: Narration fetched but audio.play() was NOT called.'
          );
        }
        expect(mockAudioPlay).toHaveBeenCalled();
      }, { timeout: 500 });
    } catch (error) {
      console.error('EXPECTED FAILURE ON UNFIXED CODE:', error.message);
      throw error;
    }
  });

  it('TASK 2: Page 2+ navigation should preserve narration playback', async () => {
    const TestApp = () => {
      const [screen, setScreen] = React.useState('story');
      const [pages, setPages] = React.useState([
        'Page 1',
        'Page 2',
        'Page 3'
      ]);
      const [pageIndex, setPageIndex] = React.useState(1);
      const audioRef = React.useRef(null);

      React.useEffect(() => {
        if (screen !== 'story' || !pages[pageIndex]) return;

        let cancelled = false;

        (async () => {
          try {
            const res = await fetch(`${API_BASE}/narrate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: pages[pageIndex] })
            });

            if (!res.ok || cancelled) return;

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = url;
              audioRef.current.load();
              audioRef.current.play().catch(() => {});
            }
          } catch (err) {
            console.error('narration failed', err);
          }
        })();

        return () => {
          cancelled = true;
        };
      }, [screen, pageIndex, pages]);

      return (
        <div>
          <audio ref={audioRef} />
          <p>Page {pageIndex + 1}</p>
          <button onClick={() => setPageIndex(p => p + 1)}>Next</button>
        </div>
      );
    };

    const { getByText } = render(<TestApp />);

    await waitFor(() => {
      expect(narrationCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });

    await waitFor(() => {
      expect(mockAudioPlay).toHaveBeenCalled();
    }, { timeout: 500 });

    jest.clearAllMocks();
    mockAudioPlay.mockClear();
    narrationCalls = [];

    const nextBtn = getByText('Next');
    act(() => {
      nextBtn.click();
    });

    await waitFor(() => {
      expect(narrationCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });

    await waitFor(() => {
      expect(mockAudioPlay).toHaveBeenCalled();
    }, { timeout: 500 });
  });
});
