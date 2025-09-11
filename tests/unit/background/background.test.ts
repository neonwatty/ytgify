import { chromeMock } from '../__mocks__/chrome-mocks';

describe('Background Service Worker Framework Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Chrome API mocks for each test
    chromeMock.runtime.onInstalled.addListener.mockClear();
    chromeMock.runtime.onMessage.addListener.mockClear();
  });

  it('should have Chrome API mocks available', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.runtime.onInstalled).toBeDefined();
    expect(chrome.runtime.onMessage).toBeDefined();
    expect(chrome.runtime.sendMessage).toBeDefined();
  });

  it('should be able to register message listeners', () => {
    const mockListener = jest.fn();
    chrome.runtime.onMessage.addListener(mockListener);
    
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockListener);
  });

  it('should be able to send messages', async () => {
    const message = { type: 'TEST', data: 'test' };
    const response = await chrome.runtime.sendMessage(message);
    
    expect(response).toEqual({ success: true });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message);
  });

  it('should handle installation events', () => {
    const mockCallback = jest.fn();
    chrome.runtime.onInstalled.addListener(mockCallback);
    
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(mockCallback);
  });

  it('should provide extension manifest data', () => {
    const manifest = chrome.runtime.getManifest();
    
    expect(manifest).toBeDefined();
    expect(manifest.name).toBe('YouTube GIF Maker');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.manifest_version).toBe(3);
  });

  it('should generate extension URLs', () => {
    const url = chrome.runtime.getURL('popup.html');
    
    expect(url).toBe('chrome-extension://mock-extension-id/popup.html');
  });

  it('should have storage API available', async () => {
    const testData = { key: 'value' };
    
    await chrome.storage.sync.set(testData);
    const result = await chrome.storage.sync.get('key');
    
    expect(result).toEqual(testData);
  });

  it('should have tabs API available', async () => {
    const tabs = await chrome.tabs.query({ active: true });
    
    expect(Array.isArray(tabs)).toBe(true);
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs[0]).toHaveProperty('id');
    expect(tabs[0]).toHaveProperty('url');
  });
});