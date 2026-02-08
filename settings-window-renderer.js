'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const hotkeyDisplay = document.getElementById('hotkey-display');
  const hotkeyReset = document.getElementById('hotkey-reset');
  const autoLaunchCheckbox = document.getElementById('auto-launch');
  const autoLaunchLabel = document.getElementById('auto-launch-label');
  const preset1 = document.getElementById('preset-1');
  const preset2 = document.getElementById('preset-2');
  const preset3 = document.getElementById('preset-3');
  const dirDisplay = document.getElementById('dir-display');
  const dirBrowse = document.getElementById('dir-browse');
  const btnSave = document.getElementById('btn-save');
  const btnCancel = document.getElementById('btn-cancel');
  const feedback = document.getElementById('feedback');

  let currentHotkey = 'CommandOrControl+Shift+P';
  let isRecording = false;

  // Platform-aware display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  function formatAcceleratorForDisplay(accel) {
    if (!accel) return '';
    let display = accel;
    if (isMac) {
      display = display.replace(/CommandOrControl/g, 'Cmd');
      display = display.replace(/CmdOrCtrl/g, 'Cmd');
    } else {
      display = display.replace(/CommandOrControl/g, 'Ctrl');
      display = display.replace(/CmdOrCtrl/g, 'Ctrl');
    }
    return display;
  }

  function loadSettings() {
    window.powerdoro.getSettings().then((settings) => {
      currentHotkey = settings.hotkey;
      hotkeyDisplay.textContent = formatAcceleratorForDisplay(settings.hotkey);

      autoLaunchCheckbox.checked = settings.autoLaunch;
      autoLaunchLabel.textContent = settings.autoLaunch ? 'On' : 'Off';

      preset1.value = settings.timerPresets[0];
      preset2.value = settings.timerPresets[1];
      preset3.value = settings.timerPresets[2];

      if (settings.retrospectDir) {
        dirDisplay.textContent = settings.retrospectDir;
      } else {
        dirDisplay.textContent = '~/Desktop/retrospect/ (default)';
      }
    });
  }

  loadSettings();

  // Auto-launch label update
  autoLaunchCheckbox.addEventListener('change', () => {
    autoLaunchLabel.textContent = autoLaunchCheckbox.checked ? 'On' : 'Off';
  });

  // --- Hotkey Recorder ---
  function startRecording() {
    isRecording = true;
    hotkeyDisplay.classList.add('recording');
    hotkeyDisplay.textContent = 'Press key combination...';
  }

  function stopRecording(newAccelerator) {
    isRecording = false;
    hotkeyDisplay.classList.remove('recording');
    if (newAccelerator) {
      currentHotkey = newAccelerator;
      hotkeyDisplay.textContent = formatAcceleratorForDisplay(newAccelerator);
    } else {
      hotkeyDisplay.textContent = formatAcceleratorForDisplay(currentHotkey);
    }
  }

  hotkeyDisplay.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    }
  });

  hotkeyDisplay.addEventListener('keydown', (e) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    // Escape cancels recording
    if (e.key === 'Escape') {
      stopRecording(null);
      return;
    }

    // Build accelerator parts
    const parts = [];
    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Check if a non-modifier key is pressed
    const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta', 'OS'];
    if (modifierKeys.includes(e.key)) {
      // Only modifiers pressed so far — show feedback
      hotkeyDisplay.textContent = parts.join('+') + '+...';
      return;
    }

    if (parts.length === 0) {
      // No modifier pressed, ignore
      return;
    }

    // Map key to Electron accelerator format
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'ArrowUp') key = 'Up';
    else if (key === 'ArrowDown') key = 'Down';
    else if (key === 'ArrowLeft') key = 'Left';
    else if (key === 'ArrowRight') key = 'Right';
    else if (key === 'Enter') key = 'Return';
    else if (key === 'Backspace') key = 'Backspace';
    else if (key === 'Delete') key = 'Delete';
    else if (key === 'Tab') key = 'Tab';

    parts.push(key);
    stopRecording(parts.join('+'));
  });

  hotkeyReset.addEventListener('click', () => {
    stopRecording('CommandOrControl+Shift+P');
  });

  // --- Directory Picker ---
  dirBrowse.addEventListener('click', () => {
    window.powerdoro.selectDirectory().then((dirPath) => {
      if (dirPath) {
        dirDisplay.textContent = dirPath;
      }
    });
  });

  // --- Save / Cancel ---
  function showFeedback(msg, type) {
    feedback.textContent = msg;
    feedback.className = 'feedback ' + type;
    setTimeout(() => {
      feedback.textContent = '';
      feedback.className = 'feedback';
    }, 2000);
  }

  btnSave.addEventListener('click', () => {
    const p1 = parseInt(preset1.value, 10);
    const p2 = parseInt(preset2.value, 10);
    const p3 = parseInt(preset3.value, 10);

    // Client-side validation
    for (const val of [p1, p2, p3]) {
      if (isNaN(val) || val < 1 || val > 180) {
        showFeedback('Presets must be 1-180 minutes', 'error');
        return;
      }
    }

    const settings = {
      hotkey: currentHotkey,
      autoLaunch: autoLaunchCheckbox.checked,
      timerPresets: [p1, p2, p3],
      retrospectDir: dirDisplay.textContent.includes('(default)') ? '' : dirDisplay.textContent,
    };

    window.powerdoro.saveSettings(settings).then((result) => {
      if (result && result.error) {
        showFeedback(result.error, 'error');
      } else {
        showFeedback('Settings saved!', 'success');
        setTimeout(() => window.close(), 600);
      }
    }).catch(() => {
      showFeedback('Failed to save settings', 'error');
    });
  });

  btnCancel.addEventListener('click', () => {
    window.close();
  });
});
