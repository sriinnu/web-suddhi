// WebSuddhi - Dependency Injection Container
// Phase 0: Centralized module management with proper initialization order

(function() {
  'use strict';

  // Container for all WebSuddhi modules
  self.WebSuddhi = self.WebSuddhi || {};
  self.WebSuddhi.Container = {
    _modules: new Map(),
    _initialized: false,
    _initQueue: [],

    // Register a module with dependencies
    register(name, factory, dependencies = []) {
      this._modules.set(name, {
        name,
        factory,
        dependencies,
        instance: null,
        state: 'registered'
      });
      return this;
    },

    // Get a module instance (lazy initialization)
    get(name) {
      const module = this._modules.get(name);
      if (!module) {
        console.warn(`[WebSuddhi] Module "${name}" not registered`);
        return null;
      }
      if (!module.instance && module.state === 'registered') {
        this._initializeModule(name);
      }
      return module.instance;
    },

    // Initialize a single module
    _initializeModule(name) {
      const module = this._modules.get(name);
      if (!module || module.state !== 'registered') return;

      // Check dependencies
      for (const dep of module.dependencies) {
        if (!this._modules.has(dep)) {
          console.warn(`[WebSuddhi] Missing dependency: ${dep} for ${name}`);
        }
      }

      module.state = 'initializing';

      // Resolve dependencies
      const deps = {};
      for (const dep of module.dependencies) {
        deps[dep] = this.get(dep);
      }

      try {
        module.instance = module.factory(deps);
        module.state = 'initialized';
        console.log(`[WebSuddhi] Module "${name}" initialized`);
      } catch (e) {
        module.state = 'error';
        console.error(`[WebSuddhi] Failed to initialize "${name}":`, e);
      }
    },

    // Initialize all modules in correct order
    async initialize() {
      if (this._initialized) return;

      // Topological sort for initialization order
      const sorted = this._topologicalSort();
      const initialized = new Set();

      for (const name of sorted) {
        this._initializeModule(name);
        initialized.add(name);
      }

      this._initialized = true;
      console.log(`[WebSuddhi] All ${this._modules.size} modules initialized`);
    },

    // Topological sort based on dependencies
    _topologicalSort() {
      const visited = new Set();
      const result = [];
      const visiting = new Set();

      const visit = (name) => {
        if (visited.has(name)) return;
        if (visiting.has(name)) return; // Circular dependency check

        const module = this._modules.get(name);
        if (!module) return;

        visiting.add(name);

        for (const dep of module.dependencies) {
          visit(dep);
        }

        visiting.delete(name);
        visited.add(name);
        result.push(name);
      };

      for (const name of this._modules.keys()) {
        visit(name);
      }

      return result;
    },

    // Check if all modules are initialized
    isReady() {
      for (const module of this._modules.values()) {
        if (module.state !== 'initialized') return false;
      }
      return this._initialized;
    },

    // Get status of all modules
    getStatus() {
      const status = {};
      for (const [name, module] of this._modules) {
        status[name] = module.state;
      }
      return status;
    },

    // Reset all modules (for testing)
    reset() {
      for (const module of this._modules.values()) {
        module.instance = null;
        module.state = 'registered';
      }
      this._initialized = false;
    }
  };

  // Storage wrapper with transactional support
  self.WebSuddhi.Storage = {
    _cache: new Map(),
    _dirty: new Set(),

    async get(keys) {
      if (!Array.isArray(keys)) keys = [keys];
      const result = {};
      const uncached = [];

      for (const key of keys) {
        if (this._cache.has(key)) {
          result[key] = this._cache.get(key);
        } else {
          uncached.push(key);
        }
      }

      if (uncached.length > 0) {
        const storage = await this._read(uncached);
        for (const key of uncached) {
          const value = storage[key];
          this._cache.set(key, value);
          result[key] = value;
        }
      }

      return result;
    },

    async set(data) {
      const keys = Object.keys(data);
      for (const key of keys) {
        this._cache.set(key, data[key]);
        this._dirty.add(key);
      }
      await this._write(data);
      this._dirty.clear();
    },

    async _read(keys) {
      return new Promise((resolve) => {
        const api = (typeof browser !== 'undefined' && browser.runtime)
          ? browser : chrome;
        api.storage.local.get(keys, (data) => {
          resolve(data || {});
        });
      });
    },

    async _write(data) {
      return new Promise((resolve) => {
        const api = (typeof browser !== 'undefined' && browser.runtime)
          ? browser : chrome;
        api.storage.local.set(data, resolve);
      });
    },

    // Batch operations with transaction
    async transaction(operations) {
      const reads = [];
      const writes = [];

      for (const op of operations) {
        if (op.type === 'read') {
          reads.push(op.key);
        } else if (op.type === 'write') {
          writes.push(op);
        }
      }

      const current = await this.get(reads);
      const updates = {};

      for (const write of writes) {
        const currentVal = current[write.key] || write.default || write.defaultValue;
        const newVal = write.transform ? write.transform(currentVal) : write.value;
        updates[write.key] = newVal;
      }

      if (Object.keys(updates).length > 0) {
        await this.set(updates);
      }

      return updates;
    },

    // Invalidate cache
    invalidate(keys) {
      if (!keys) {
        this._cache.clear();
      } else {
        for (const key of keys) {
          this._cache.delete(key);
        }
      }
    }
  };

  // Event bus for module communication
  self.WebSuddhi.Events = {
    _listeners: new Map(),

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
      return () => this.off(event, callback);
    },

    off(event, callback) {
      const callbacks = this._listeners.get(event);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) callbacks.splice(idx, 1);
      }
    },

    emit(event, data) {
      const callbacks = this._listeners.get(event);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback(data);
          } catch (e) {
            console.error(`[WebSuddhi] Event handler error for "${event}":`, e);
          }
        }
      }
    },

    // Once - fire once then remove
    once(event, callback) {
      const wrapper = (data) => {
        this.off(event, wrapper);
        callback(data);
      };
      this.on(event, wrapper);
    }
  };

  // Logger with levels
  self.WebSuddhi.Logger = {
    _level: 'warn',
    levels: ['debug', 'info', 'warn', 'error'],

    setLevel(level) {
      if (this.levels.includes(level)) {
        this._level = level;
      }
    },

    debug(...args) {
      if (this._level === 'debug') console.debug('[WebSuddhi]', ...args);
    },
    info(...args) {
      if (this.levels.indexOf(this._level) <= 1) console.info('[WebSuddhi]', ...args);
    },
    warn(...args) {
      if (this.levels.indexOf(this._level) <= 2) console.warn('[WebSuddhi]', ...args);
    },
    error(...args) {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // Shared utilities
  self.WebSuddhi.utils = {
    // Safe storage wrapper
    getStorage: (keys) => self.WebSuddhi.Storage.get(keys),
    setStorage: (data) => self.WebSuddhi.Storage.set(data),

    // Logging
    log: (...args) => self.WebSuddhi.Logger.debug(...args),
    warn: (...args) => self.WebSuddhi.Logger.warn(...args),
    error: (...args) => self.WebSuddhi.Logger.error(...args),

    // Event bus
    on: (event, cb) => self.WebSuddhi.Events.on(event, cb),
    off: (event, cb) => self.WebSuddhi.Events.off(event, cb),
    emit: (event, data) => self.WebSuddhi.Events.emit(event, data),

    // Extract domain from URL
    extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return '';
      }
    },

    // Normalize hostname (remove www., lowercase)
    normalizeHostname(hostname) {
      return hostname.toLowerCase().replace(/^www\./, '');
    },

    // Check if domain matches whitelist pattern
    isWhitelisted(hostname, whitelist) {
      const normalized = this.normalizeHostname(hostname);
      return whitelist.some(site => {
        const normalizedSite = this.normalizeHostname(site);
        return normalized === normalizedSite || normalized.endsWith('.' + normalizedSite);
      });
    },

    // Debounce function
    debounce(fn, delay) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    // Throttle function
    throttle(fn, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          fn.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // Generate unique ID
    uid() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  };

  console.log('[WebSuddhi] Dependency Container loaded');
})();
