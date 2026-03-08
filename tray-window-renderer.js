'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const bridge = window.powerdoro
  const timeInput = document.getElementById('time')
  const submitBtn = document.getElementById('submit_btn')
  const errorMsg = document.getElementById('error-msg')
  const form = document.getElementById('time-form')
  const stopBtn = document.getElementById('stop-btn')
  const exitBtn = document.getElementById('exit-btn')
  const settingsBtn = document.getElementById('settings-btn')
  const statsBtn = document.getElementById('stats-btn')
  const trayCard = document.getElementById('tray-card')
  const timerDisplay = document.getElementById('timer-display')
  const timerStatus = document.getElementById('timer-status')
  const timerRing = document.getElementById('timer-ring')
  const healthBanner = document.getElementById('health-banner')
  const healthText = document.getElementById('health-text')
  const recoverBtn = document.getElementById('recover-btn')
  const restartBtn = document.getElementById('restart-btn')
  const presetBtns = document.querySelectorAll('.preset-btn')

  if (!bridge || !timeInput || !submitBtn || !errorMsg || !form) {
    console.error('Powerdoro tray renderer failed to initialize required elements or bridge')
    return
  }

  let totalSeconds = 0
  let heartbeatId = null

  function setHealthUi(state, reason) {
    if (!trayCard) return
    trayCard.classList.remove('is-degraded', 'is-recovering', 'is-restart-required')
    if (state === 'degraded') trayCard.classList.add('is-degraded')
    if (state === 'recovering') trayCard.classList.add('is-recovering')
    if (state === 'restart_required') trayCard.classList.add('is-restart-required')

    if (!healthText) return
    if (state === 'degraded') {
      healthText.textContent = 'App response is slow. Recovering...'
    } else if (state === 'recovering') {
      healthText.textContent = 'Recovering app state now...'
    } else if (state === 'restart_required') {
      healthText.textContent = 'Please restart to recover safely.'
    } else if (reason && reason !== 'none') {
      healthText.textContent = 'App health restored.'
    }
  }

  function formatTimeFromMinutes(minutes) {
    const safeMinutes = Math.max(0, Number(minutes) || 0)
    return String(safeMinutes).padStart(2, '0') + ':00'
  }

  function parseTimeToSeconds(value) {
    if (!value || typeof value !== 'string') return 0
    const parts = value.split(':')
    if (parts.length !== 2) return 0
    const minutes = parseInt(parts[0], 10)
    const seconds = parseInt(parts[1], 10)
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return 0
    return minutes * 60 + seconds
  }

  function setProgress(currentSeconds) {
    if (!timerRing) return
    const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, currentSeconds / totalSeconds)) : 0
    timerRing.style.setProperty('--progress', String(Math.round(ratio * 100)))
  }

  function setActivePresetByMinutes(minutes) {
    presetBtns.forEach((btn) => {
      const value = parseInt(btn.getAttribute('data-minutes'), 10)
      btn.classList.toggle('active', value === minutes)
    })
  }

  function validateAndSend() {
    const value = parseInt(timeInput.value, 10)
    if (Number.isNaN(value) || value < 1 || value > 180) {
      timeInput.classList.add('invalid')
      errorMsg.textContent = 'Enter 1-180 minutes'
      return
    }
    timeInput.classList.remove('invalid')
    errorMsg.textContent = ''
    setActivePresetByMinutes(value)
    totalSeconds = value * 60
    setProgress(totalSeconds)
    if (timerDisplay) {
      timerDisplay.textContent = formatTimeFromMinutes(value)
    }
    bridge.sendTime(value)
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    validateAndSend()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !timeInput.disabled) {
      e.preventDefault()
      validateAndSend()
    }
  })

  if (stopBtn) {
    stopBtn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      bridge.stopTimer()
    })
  }

  if (exitBtn) {
    exitBtn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      bridge.exitApp()
    })
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      bridge.openSettings()
    })
  }

  if (statsBtn) {
    statsBtn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      bridge.openStats()
    })
  }

  window.addEventListener('focus', () => {
    if (bridge.sendHealthPing) {
      bridge.sendHealthPing()
    }
    if (!timeInput.disabled) {
      timeInput.focus()
      timeInput.select()
    }
  })

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.getAttribute('data-minutes'), 10)
      timeInput.value = minutes
      timeInput.classList.remove('invalid')
      errorMsg.textContent = ''
      setActivePresetByMinutes(minutes)
      totalSeconds = minutes * 60
      setProgress(totalSeconds)
      if (timerDisplay) {
        timerDisplay.textContent = formatTimeFromMinutes(minutes)
      }
      bridge.sendTime(minutes)
    })
  })

  timeInput.addEventListener('input', () => {
    timeInput.classList.remove('invalid')
    errorMsg.textContent = ''
    const minutes = parseInt(timeInput.value, 10)
    if (!Number.isNaN(minutes)) {
      setActivePresetByMinutes(minutes)
    } else {
      setActivePresetByMinutes(-1)
    }
  })

  function setTimerRunning(running) {
    timeInput.type = running ? 'text' : 'number'
    timeInput.disabled = running
    submitBtn.disabled = running
    presetBtns.forEach((btn) => { btn.disabled = running })
    if (trayCard) {
      trayCard.classList.toggle('is-running', running)
    }
    if (timerStatus) {
      timerStatus.textContent = running ? 'FOCUS SESSION' : 'READY TO FOCUS'
    }
  }

  bridge.onTimeUpdate((time) => {
    const remainingSeconds = parseTimeToSeconds(time)
    if (totalSeconds === 0 || remainingSeconds > totalSeconds) {
      totalSeconds = remainingSeconds
    }
    if (timerDisplay) {
      timerDisplay.textContent = time
    }
    timeInput.value = time
    setProgress(remainingSeconds)
    setTimerRunning(true)
  })

  bridge.onSettingsChanged((settings) => {
    if (settings && settings.timerPresets) {
      const presets = settings.timerPresets
      presetBtns.forEach((btn, i) => {
        if (presets[i] !== undefined) {
          btn.setAttribute('data-minutes', presets[i])
          btn.textContent = presets[i] + 'm'
        }
      })
    }
  })

  bridge.onTimerStopped(() => {
    timeInput.value = ''
    totalSeconds = 0
    setProgress(0)
    setActivePresetByMinutes(-1)
    if (timerDisplay) {
      timerDisplay.textContent = '00:00'
    }
    setTimerRunning(false)
    timeInput.focus()
    // Notification is handled by the main process (stopTimer) to avoid duplicates
  })

  if (bridge.onHealthStateChanged) {
    bridge.onHealthStateChanged((state, reason) => {
      setHealthUi(state, reason)
    })
  }

  if (recoverBtn && bridge.recoverNow) {
    recoverBtn.addEventListener('click', () => {
      bridge.recoverNow()
    })
  }

  if (restartBtn && bridge.restartSafe) {
    restartBtn.addEventListener('click', () => {
      bridge.restartSafe()
    })
  }

  if (bridge.sendHealthPing) {
    bridge.sendHealthPing()
    heartbeatId = window.setInterval(() => {
      bridge.sendHealthPing()
    }, 15000)
    window.addEventListener('beforeunload', () => {
      if (heartbeatId) {
        clearInterval(heartbeatId)
      }
    })
  }
})
