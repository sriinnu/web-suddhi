// WebSuddhi - Import/Export Module
// Handles full settings backup and restore

(function() {
  'use strict';

  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.importExport) self.WebSuddhi.importExport = {};

  const importExport = self.WebSuddhi.importExport;

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
    'toastDuration',
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

  // Export all settings
  importExport.exportSettings = function() {
    return new Promise((resolve, reject) => {
      if (!storageApi || !storageApi.storage) {
        reject(new Error('Storage API not available'));
        return;
      }

      storageApi.storage.local.get(EXPORT_KEYS, (data) => {
        if (storageApi.runtime.lastError) {
          reject(storageApi.runtime.lastError);
          return;
        }

        const exportData = {
          version: '2.1.0',
          exportedAt: new Date().toISOString(),
          settings: {}
        };

        // Only include keys that exist
        for (const key of EXPORT_KEYS) {
          if (data[key] !== undefined) {
            exportData.settings[key] = data[key];
          }
        }

        resolve(exportData);
      });
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
              case 'loggingEnabled':
              case 'syncEnabled':
                if (typeof settings[key] !== 'boolean') {
                  console.warn(`Skipping ${key}: expected boolean`);
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
          storageApi.storage.local.get(Object.keys(importData), (existing) => {
            if (storageApi.runtime.lastError) {
              reject(storageApi.runtime.lastError);
              return;
            }

            // Merge arrays, replace others
            for (const key of Object.keys(importData)) {
              if (Array.isArray(importData[key]) && Array.isArray(existing[key])) {
                importData[key] = [...new Set([...existing[key], ...importData[key]])];
              }
            }

            storageApi.storage.local.set(importData, () => {
              if (storageApi.runtime.lastError) {
                reject(storageApi.runtime.lastError);
              } else {
                resolve({ success: true, imported: Object.keys(importData).length });
              }
            });
          });
        } else {
          storageApi.storage.local.set(importData, () => {
            if (storageApi.runtime.lastError) {
              reject(storageApi.runtime.lastError);
            } else {
              resolve({ success: true, imported: Object.keys(importData).length });
            }
          });
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
