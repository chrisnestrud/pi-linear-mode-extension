/**
 * Logger utility for pi-linear-mode-extension.
 * 
 * Provides consistent logging with debug mode support.
 */

const DEBUG = process.env.PI_LINEAR_MODE_DEBUG === 'true';

export const logger = {
  debug: (...args: any[]) => {
    if (DEBUG) {
      console.debug('[pi-linear-mode:debug]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    console.info('[pi-linear-mode:info]', ...args);
  },
  
  warn: (...args: any[]) => {
    console.warn('[pi-linear-mode:warn]', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('[pi-linear-mode:error]', ...args);
  },
};