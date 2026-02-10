/**
 * Tests for src/preload/stats-preload.ts
 *
 * Verifies that the stats preload script correctly exposes a getStats function
 * via contextBridge that delegates to ipcRenderer.invoke with the correct channel.
 */

// Mock electron module before importing the preload script
const mockInvoke = jest.fn();
const mockExposeInMainWorld = jest.fn();

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
  ipcRenderer: {
    invoke: mockInvoke,
  },
}));

describe('stats-preload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call contextBridge.exposeInMainWorld with "powerdoro" namespace', () => {
    // Re-require to trigger the module-level side effects
    jest.isolateModules(() => {
      require('../src/preload/stats-preload');
    });

    expect(mockExposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(mockExposeInMainWorld).toHaveBeenCalledWith('powerdoro', expect.any(Object));
  });

  it('should expose a getStats function in the API object', () => {
    jest.isolateModules(() => {
      require('../src/preload/stats-preload');
    });

    const [, api] = mockExposeInMainWorld.mock.calls[0];
    expect(api).toHaveProperty('getStats');
    expect(typeof api.getStats).toBe('function');
  });

  it('should call ipcRenderer.invoke with stats:get when getStats is called', () => {
    jest.isolateModules(() => {
      require('../src/preload/stats-preload');
    });

    const [, api] = mockExposeInMainWorld.mock.calls[0];
    api.getStats();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('stats:get');
  });

  it('should return the promise from ipcRenderer.invoke', () => {
    const fakeStatsData = { today: { sessionCount: 5 } };
    mockInvoke.mockResolvedValue(fakeStatsData);

    jest.isolateModules(() => {
      require('../src/preload/stats-preload');
    });

    const [, api] = mockExposeInMainWorld.mock.calls[0];
    const result = api.getStats();

    expect(result).toBeInstanceOf(Promise);
    return expect(result).resolves.toEqual(fakeStatsData);
  });
});
