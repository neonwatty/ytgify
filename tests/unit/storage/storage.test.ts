/**
 * Chrome Storage Tests
 * 
 * Tests for Chrome storage API integration, including sync/local storage
 * and event listener functionality.
 */

import { chromeMock, simulateStorageChange } from '../__mocks__/chrome-mocks';

describe('Chrome Storage Framework Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Chrome storage mocks
    chromeMock.storage.sync.clear();
    chromeMock.storage.local.clear();
  });

  it('should have Chrome storage API available', () => {
    expect(chrome.storage).toBeDefined();
    expect(chrome.storage.sync).toBeDefined();
    expect(chrome.storage.local).toBeDefined();
    expect(chrome.storage.onChanged).toBeDefined();
  });

  it('should save and retrieve data from sync storage', async () => {
    const testData = { key: 'value', number: 42 };
    
    await chrome.storage.sync.set(testData);
    const result = await chrome.storage.sync.get(['key', 'number']);
    
    expect(result).toEqual(testData);
  });

  it('should save and retrieve data from local storage', async () => {
    const testData = { localKey: 'localValue', count: 100 };
    
    await chrome.storage.local.set(testData);
    const result = await chrome.storage.local.get(['localKey', 'count']);
    
    expect(result).toEqual(testData);
  });

  it('should remove items from storage', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    
    await chrome.storage.sync.set(testData);
    await chrome.storage.sync.remove('key1');
    
    const result = await chrome.storage.sync.get(['key1', 'key2']);
    
    expect(result.key1).toBeUndefined();
    expect(result.key2).toBe('value2');
  });

  it('should clear all storage', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    
    await chrome.storage.sync.set(testData);
    await chrome.storage.sync.clear();
    
    const result = await chrome.storage.sync.get(null);
    
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should calculate storage bytes in use', async () => {
    const bytes = await chrome.storage.sync.getBytesInUse();
    
    expect(typeof bytes).toBe('number');
    expect(bytes).toBeGreaterThanOrEqual(0);
  });

  it('should register and trigger storage change listeners', () => {
    const listener = jest.fn();
    chrome.storage.onChanged.addListener(listener);

    const changes = {
      testKey: {
        newValue: 'newValue',
        oldValue: 'oldValue'
      }
    };

    simulateStorageChange(chromeMock, changes, 'sync');

    expect(listener).toHaveBeenCalledWith(changes, 'sync');
  });

  it('should remove storage change listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    chrome.storage.onChanged.addListener(listener1);
    chrome.storage.onChanged.addListener(listener2);
    
    // Remove only listener1
    chrome.storage.onChanged.removeListener(listener1);

    const changes = { testKey: { newValue: 'test' } };
    simulateStorageChange(chromeMock, changes, 'sync');

    // listener1 should not be called after removal
    expect(listener1).not.toHaveBeenCalled();
    // listener2 should still be called
    expect(listener2).toHaveBeenCalledWith(changes, 'sync');
  });

  it('should handle storage errors gracefully', async () => {
    // Mock storage error
    chromeMock.storage.sync.get.mockRejectedValueOnce(new Error('Storage error'));
    
    await expect(chrome.storage.sync.get('test')).rejects.toThrow('Storage error');
  });

  it('should support different storage areas', async () => {
    const syncData = { syncKey: 'syncValue' };
    const localData = { localKey: 'localValue' };
    
    await chrome.storage.sync.set(syncData);
    await chrome.storage.local.set(localData);
    
    const syncResult = await chrome.storage.sync.get('syncKey');
    const localResult = await chrome.storage.local.get('localKey');
    
    expect(syncResult).toEqual(syncData);
    expect(localResult).toEqual(localData);
  });

  it('should handle multiple keys in get operations', async () => {
    const testData = { key1: 'value1', key2: 'value2', key3: 'value3' };
    
    await chrome.storage.sync.set(testData);
    const result = await chrome.storage.sync.get(['key1', 'key3']);
    
    expect(result).toEqual({
      key1: 'value1',
      key3: 'value3'
    });
  });
});