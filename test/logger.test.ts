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
  
  it('should log debug messages only when debug mode is enabled', async () => {
    // Debug disabled by default
    logger.debug('test debug');
    expect(console.debug).not.toHaveBeenCalled();
    
    // Enable debug and re-import logger
    process.env.PI_LINEAR_MODE_DEBUG = 'true';
    vi.resetModules();
    const { logger: freshLogger } = await import('../src/lib/logger.ts');
    freshLogger.debug('test debug');
    expect(console.debug).toHaveBeenCalledWith('[pi-linear-mode:debug]', 'test debug');
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