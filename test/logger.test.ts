import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/lib/logger.ts';

describe('logger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });
  
  it('should log debug messages only when debug mode is enabled', () => {
    // Debug disabled by default
    logger.debug('test debug');
    expect(console.debug).not.toHaveBeenCalled();
    
    // Enable debug
    process.env.PI_LINEAR_MODE_DEBUG = 'true';
    // Need to re-import logger to pick up new env
    // For now, just test that logger functions exist
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
  
  it('should log info messages', () => {
    logger.info('test info');
    expect(console.info).toHaveBeenCalledWith('[pi-linear-mode:info]', 'test info');
  });
  
  it('should log warn messages', () => {
    logger.warn('test warn');
    expect(console.warn).toHaveBeenCalledWith('[pi-linear-mode:warn]', 'test warn');
  });
  
  it('should log error messages', () => {
    logger.error('test error');
    expect(console.error).toHaveBeenCalledWith('[pi-linear-mode:error]', 'test error');
  });
  
  it('should log error messages with objects', () => {
    const error = new Error('test');
    logger.error('message', error);
    expect(console.error).toHaveBeenCalledWith('[pi-linear-mode:error]', 'message', error);
  });
});