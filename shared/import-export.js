// WebSuddhi - Import/Export Module
// Handles full settings backup and restore

(function() {
  'use strict';

  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.importExport) self.WebSuddhi.importExport = {};

  const importExport = self.WebSuddhi.importExport;
  const sharedUtils = self.WebSuddhi.utils || {};

  // Storage API
  const storageApi = (typeof browser !== 'undefined' && browser.runtime) ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  // Keys to export
  const EXPORT_KEYS = [
    'enabled',
    'paywallEnabled',
    'socialBlockingEnabled',
    'networkBlockingEnabled',
    'urlCleaningEnabled',
    'cookieConsentEnabled',
    'annoyanceBlockingEnabled',
    'phishingProtectionEnabled',
    'pingProtectionEnabled',
    'referrerStrippingEnabled',
    'webrtcProtectionEnabled',
    'telemetryBlockingEnabled',
    'thirdPartyCookieBlockingEnabled',
    'loggingEnabled',
    'syncEnabled',
    'theme',
    'toastDuration',
    'enabledLanguageFilters',
    'shortcuts',
    'aggressiveAntiAdblockEnabled',
    'whitelistedSites',
    'blockedDomains',
    'allowedDomains',
    'blockedSelectors',
    'filterSubscriptions',
    'maxBlockedCount',
    'maxLogEntries',
    'maxWhitelistSize',
    'maxBlockedDomains',
    'maxBlockedSelectors'
  ];

  function getLocalStorage(keys) {
    if (typeof sharedUtils.getStorage === 'function') {
      return sharedUtils.getStorage(keys);
    }

    return new Promise((resolve, reject) => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        storageApi.storage.local.get(keys).then((data) => resolve(data || {})).catch(reject);
      } else {
        storageApi.storage.local.get(keys, (data) => {
          if (storageApi.runtime.lastError) {
            reject(storageApi.runtime.lastError);
          } else {
            resolve(data || {});
          }
        });
      }
    });
  }

  function setLocalStorage(data) {
    if (typeof sharedUtils.setStorage === 'function') {
      return sharedUtils.setStorage(data);
    }

    return new Promise((resolve, reject) => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        storageApi.storage.local.set(data).then(resolve).catch(reject);
      } else {
        storageApi.storage.local.set(data, () => {
          if (storageApi.runtime.lastError) {
            reject(storageApi.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  }

  // Export all settings
  importExport.exportSettings = function() {
    return new Promise((resolve, reject) => {
      if (!storageApi || !storageApi.storage) {
        reject(new Error('Storage API not available'));
        return;
      }

      getLocalStorage(EXPORT_KEYS)
        .then((data) => {
          const exportData = {
            version: '2.2.0',
            exportedAt: new Date().toISOString(),
            settings: {}
          };

          for (const key of EXPORT_KEYS) {
            if (data[key] !== undefined) {
              exportData.settings[key] = data[key];
            }
          }

          resolve(exportData);
        })
        .catch(reject);
    });
  };

  // Import settings with validation
  importExport.importSettings = function(exportedData, options = {}) {
    return new Promise((resolve, reject) => {
      if (!storageApi || !storageApi.storage) {
        reject(new Error('Storage API not available'));
        return;
      }

      try {
        // Validate export format
        if (!exportedData || typeof exportedData !== 'object') {
          throw new Error('Invalid export format');
        }

        if (!exportedData.version) {
          throw new Error('Missing version information');
        }

        if (!exportedData.settings || typeof exportedData.settings !== 'object') {
          throw new Error('Missing settings data');
        }

        const settings = exportedData.settings;
        const importData = {};

        // Validate and import each setting
        for (const key of EXPORT_KEYS) {
          if (settings[key] !== undefined) {
            // Basic validation
            switch (key) {
              case 'enabledLanguageFilters':
                if (!Array.isArray(settings[key]) || settings[key].some((value) => typeof value !== 'string')) {
                  console.warn(`Skipping ${key}: expected string array`);
                  continue;
                }
                break;
              case 'whitelistedSites':
              case 'blockedDomains':
              case 'allowedDomains':
              case 'blockedSelectors':
                if (!Array.isArray(settings[key])) {
                  console.warn(`Skipping ${key}: expected array`);
                  continue;
                }
                break;
              case 'filterSubscriptions':
                if (!Array.isArray(settings[key])) {
                  console.warn(`Skipping ${key}: expected array`);
                  continue;
                }
                break;
              case 'shortcuts':
                if (!settings[key] || typeof settings[key] !== 'object' || Array.isArray(settings[key])) {
                  console.warn(`Skipping ${key}: expected object`);
                  continue;
                }
                break;
              case 'enabled':
              case 'paywallEnabled':
              case 'socialBlockingEnabled':
              case 'networkBlockingEnabled':
              case 'urlCleaningEnabled':
              case 'cookieConsentEnabled':
              case 'annoyanceBlockingEnabled':
              case 'phishingProtectionEnabled':
              case 'pingProtectionEnabled':
              case 'referrerStrippingEnabled':
              case 'webrtcProtectionEnabled':
              case 'telemetryBlockingEnabled':
              case 'thirdPartyCookieBlockingEnabled':
              case 'loggingEnabled':
              case 'syncEnabled':
              case 'aggressiveAntiAdblockEnabled':
                if (typeof settings[key] !== 'boolean') {
                  console.warn(`Skipping ${key}: expected boolean`);
                  continue;
                }
                break;
              case 'theme':
                if (typeof settings[key] !== 'string' || settings[key].length === 0) {
                  console.warn(`Skipping ${key}: expected string`);
                  continue;
                }
                break;
              case 'toastDuration':
              case 'maxBlockedCount':
              case 'maxLogEntries':
              case 'maxWhitelistSize':
              case 'maxBlockedDomains':
              case 'maxBlockedSelectors':
                if (typeof settings[key] !== 'number' || settings[key] < 0) {
                  console.warn(`Skipping ${key}: expected positive number`);
                  continue;
                }
                break;
            }

            importData[key] = settings[key];
          }
        }

        // Merge with existing settings based on options
        if (options.merge) {
          getLocalStorage(Object.keys(importData))
            .then(async (existing) => {
              for (const key of Object.keys(importData)) {
                if (Array.isArray(importData[key]) && Array.isArray(existing[key])) {
                  importData[key] = [...new Set([...existing[key], ...importData[key]])];
                }
              }

              await setLocalStorage(importData);
              resolve({ success: true, imported: Object.keys(importData).length });
            })
            .catch(reject);
        } else {
          setLocalStorage(importData)
            .then(() => resolve({ success: true, imported: Object.keys(importData).length }))
            .catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  // Generate downloadable JSON file
  importExport.downloadExport = async function(filename = 'websuddhi-backup.json') {
    try {
      const data = await importExport.exportSettings();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();

      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Import from file
  importExport.uploadImport = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const result = await importExport.importSettings(data);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

})();
