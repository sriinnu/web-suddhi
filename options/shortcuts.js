// WebSuddhi - Keyboard Shortcuts Manager

(function() {
  'use strict';

  const STORAGE_KEYS = ['shortcuts'];

  const DEFAULT_SHORTCUTS = {
    'toggle-pick-mode': { key: 'Alt+P', description: 'Toggle element picker' },
    'toggle-whitelist': { key: 'Alt+W', description: 'Toggle whitelist for current site' },
    'open-settings': { key: 'Alt+S', description: 'Open settings' }
  };

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // Get storage
  function getStorage(keys) {
    return new Promise((resolve) => {
      api.storage.local.get(keys, (data) => {
        resolve(data || {});
      });
    });
  }

  // Set storage
  function setStorage(data) {
    return new Promise((resolve) => {
      api.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  // Get all commands
  async function getCommands() {
    return new Promise((resolve) => {
      if (api.commands) {
        api.commands.getAll((commands) => {
          resolve(commands || []);
        });
      } else {
        // Fallback for browsers without commands API
        resolve(Object.entries(DEFAULT_SHORTCUTS).map(([name, data]) => ({
          name,
          description: data.description,
          shortcut: data.key
        })));
      }
    });
  }

  // Render shortcuts list
  async function renderShortcuts() {
    const container = document.getElementById('shortcuts-list');
    const commands = await getCommands();

    container.innerHTML = commands.map(cmd => `
      <div class="shortcut-card">
        <div class="shortcut-info">
          <h3>${formatCommandName(cmd.name)}</h3>
          <p>${cmd.description || ''}</p>
        </div>
        <div>
          <span class="shortcut-key ${cmd.shortcut ? '' : 'empty'}"
                data-command="${cmd.name}"
                ${!cmd.shortcut ? 'title="Click to set shortcut"' : ''}>
            ${cmd.shortcut || 'Not set'}
          </span>
        </div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.shortcut-key').forEach(el => {
      el.addEventListener('click', () => startRecording(el));
    });
  }

  // Format command name for display
  function formatCommandName(name) {
    return name
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Start recording shortcut
  function startRecording(element) {
    const command = element.dataset.command;
    element.textContent = 'Press keys...';
    element.classList.add('recording');

    const handleKeyDown = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Build shortcut string
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('MacCtrl');

      // Get key
      let key = e.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();

      // Ignore modifier-only keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        return;
      }

      parts.push(key);

      const shortcut = parts.join('+');

      try {
        // Update command shortcut
        if (api.commands) {
          await new Promise((resolve) => {
            api.commands.update({
              name: command,
              suggested_key: { default: shortcut }
            }, () => resolve());
          });
        }

        // Update local storage
        const storage = await getStorage(STORAGE_KEYS);
        const shortcuts = storage.shortcuts || {};
        shortcuts[command] = shortcut;
        await setStorage({ shortcuts });

        element.textContent = shortcut;
        element.classList.remove('recording');
      } catch (err) {
        element.textContent = 'Error';
        element.classList.remove('recording');
        console.error('Failed to update shortcut:', err);
      }

      document.removeEventListener('keydown', handleKeyDown);
    };

    document.addEventListener('keydown', handleKeyDown);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    renderShortcuts();
  });

})();
