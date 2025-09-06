import { Logger, LogLevel } from './logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger('TestLogger');
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Logger.resetGlobalSettings();
  });

  describe('initialization', () => {
    it('should create a new Logger instance with a name', () => {
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.getName()).toBe('TestLogger');
    });

    it('should create a logger with default log level', () => {
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it('should create a logger with custom log level', () => {
      const customLogger = new Logger('CustomLogger', LogLevel.DEBUG);
      expect(customLogger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('log levels', () => {
    it('should respect DEBUG level', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestLogger] [DEBUG]', 'debug message');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[TestLogger] [INFO]', 'info message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestLogger] [WARN]', 'warn message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestLogger] [ERROR]', 'error message');
    });

    it('should respect INFO level', () => {
      logger.setLevel(LogLevel.INFO);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith('[TestLogger] [INFO]', 'info message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestLogger] [WARN]', 'warn message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestLogger] [ERROR]', 'error message');
    });

    it('should respect WARN level', () => {
      logger.setLevel(LogLevel.WARN);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestLogger] [WARN]', 'warn message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestLogger] [ERROR]', 'error message');
    });

    it('should respect ERROR level', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestLogger] [ERROR]', 'error message');
    });

    it('should respect NONE level', () => {
      logger.setLevel(LogLevel.NONE);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('global log level', () => {
    it('should set global log level for all loggers', () => {
      const logger1 = new Logger('Logger1');
      const logger2 = new Logger('Logger2');

      Logger.setGlobalLevel(LogLevel.ERROR);

      logger1.info('info from logger1');
      logger2.info('info from logger2');
      logger1.error('error from logger1');
      logger2.error('error from logger2');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should allow individual logger level override', () => {
      Logger.setGlobalLevel(LogLevel.ERROR);
      
      const debugLogger = new Logger('DebugLogger');
      debugLogger.setLevel(LogLevel.DEBUG);

      debugLogger.debug('debug message');
      debugLogger.info('info message');

      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe('logging methods', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should log debug messages', () => {
      logger.debug('debug message', { extra: 'data' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[TestLogger] [DEBUG]',
        'debug message',
        { extra: 'data' }
      );
    });

    it('should log info messages', () => {
      logger.info('info message', { extra: 'data' });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[TestLogger] [INFO]',
        'info message',
        { extra: 'data' }
      );
    });

    it('should log warn messages', () => {
      logger.warn('warning message', { extra: 'data' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TestLogger] [WARN]',
        'warning message',
        { extra: 'data' }
      );
    });

    it('should log error messages', () => {
      const error = new Error('test error');
      logger.error('error message', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TestLogger] [ERROR]',
        'error message',
        error
      );
    });

    it('should log multiple arguments', () => {
      logger.info('message', 'arg1', 'arg2', { obj: 'data' });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[TestLogger] [INFO]',
        'message',
        'arg1',
        'arg2',
        { obj: 'data' }
      );
    });
  });

  describe('formatting', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should include timestamp when enabled', () => {
      logger.enableTimestamp(true);
      const now = new Date();
      
      logger.info('message');

      const call = consoleInfoSpy.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
      expect(call[0]).toContain('[TestLogger]');
      expect(call[0]).toContain('[INFO]');
    });

    it('should not include timestamp when disabled', () => {
      logger.enableTimestamp(false);
      
      logger.info('message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[TestLogger] [INFO]', 'message');
    });

    it('should use custom prefix', () => {
      logger.setPrefix('[CUSTOM]');
      
      logger.info('message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[CUSTOM] [TestLogger] [INFO]', 'message');
    });

    it('should format objects properly', () => {
      const obj = { key: 'value', nested: { data: 123 } };
      
      logger.info('object data', obj);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[TestLogger] [INFO]',
        'object data',
        obj
      );
    });

    it('should format errors properly', () => {
      const error = new Error('test error');
      error.stack = 'Error: test error\n  at test.js:1:1';
      
      logger.error('error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TestLogger] [ERROR]',
        'error occurred',
        error
      );
    });
  });

  describe('performance logging', () => {
    it('should measure performance with time/timeEnd', () => {
      logger.time('operation');
      
      // Simulate some work
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Wait ~10ms
      }
      
      logger.timeEnd('operation');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger] [INFO]'),
        expect.stringContaining('operation:'),
        expect.stringMatching(/\d+ms/)
      );
    });

    it('should handle nested timers', () => {
      logger.time('outer');
      logger.time('inner');
      
      logger.timeEnd('inner');
      logger.timeEnd('outer');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
    });

    it('should warn when ending non-existent timer', () => {
      logger.timeEnd('nonexistent');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestLogger] [WARN]'),
        expect.stringContaining('Timer "nonexistent" does not exist')
      );
    });
  });

  describe('grouping', () => {
    it('should support log grouping', () => {
      const consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
      const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      logger.group('Group Title');
      logger.info('grouped message 1');
      logger.info('grouped message 2');
      logger.groupEnd();

      expect(consoleGroupSpy).toHaveBeenCalledWith('[TestLogger] Group Title');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should support collapsed groups', () => {
      const consoleGroupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation();

      logger.groupCollapsed('Collapsed Group');
      logger.info('hidden message');
      logger.groupEnd();

      expect(consoleGroupCollapsedSpy).toHaveBeenCalledWith('[TestLogger] Collapsed Group');
    });
  });

  describe('filtering', () => {
    it('should filter messages by pattern', () => {
      logger.setFilter(/important/);
      logger.setLevel(LogLevel.DEBUG);

      logger.info('important message');
      logger.info('regular message');
      logger.info('another important one');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        'important message'
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.any(String),
        'another important one'
      );
    });

    it('should clear filter', () => {
      logger.setFilter(/test/);
      logger.clearFilter();

      logger.info('any message');

      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe('child loggers', () => {
    it('should create child logger with parent name', () => {
      const childLogger = logger.child('SubComponent');
      
      expect(childLogger.getName()).toBe('TestLogger:SubComponent');
    });

    it('should inherit parent log level', () => {
      logger.setLevel(LogLevel.WARN);
      const childLogger = logger.child('SubComponent');
      
      expect(childLogger.getLevel()).toBe(LogLevel.WARN);
    });

    it('should allow independent child logger level', () => {
      logger.setLevel(LogLevel.ERROR);
      const childLogger = logger.child('SubComponent');
      childLogger.setLevel(LogLevel.DEBUG);
      
      childLogger.debug('debug from child');
      logger.debug('debug from parent');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('SubComponent'),
        'debug from child'
      );
    });
  });

  describe('environment detection', () => {
    it('should detect production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodLogger = new Logger('ProdLogger');
      expect(prodLogger.isProduction()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should detect development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devLogger = new Logger('DevLogger');
      expect(devLogger.isProduction()).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it('should adjust log level based on environment', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'production';
      const prodLogger = new Logger('ProdLogger');
      expect(prodLogger.getLevel()).toBe(LogLevel.WARN);

      process.env.NODE_ENV = 'development';
      const devLogger = new Logger('DevLogger');
      expect(devLogger.getLevel()).toBe(LogLevel.DEBUG);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('error handling', () => {
    it('should handle null/undefined messages', () => {
      logger.info(null as any);
      logger.info(undefined as any);

      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle circular references in objects', () => {
      const obj: any = { name: 'test' };
      obj.circular = obj;

      expect(() => logger.info('circular', obj)).not.toThrow();
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should handle logging errors', () => {
      consoleErrorSpy.mockImplementation(() => {
        throw new Error('Console error failed');
      });

      expect(() => logger.error('test')).not.toThrow();
    });
  });

  describe('memory management', () => {
    it('should clear timers on destroy', () => {
      logger.time('timer1');
      logger.time('timer2');
      
      logger.destroy();
      
      // Timers should be cleared
      logger.timeEnd('timer1');
      logger.timeEnd('timer2');
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle large number of log messages', () => {
      for (let i = 0; i < 1000; i++) {
        logger.debug(`Message ${i}`);
      }
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(0); // Because default level is INFO
      
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('Final message');
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });
  });
});