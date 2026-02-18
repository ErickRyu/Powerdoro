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
  const presetBtns = document.querySelectorAll('.preset-btn')
  
  if (!bridge || !timeInput || !submitBtn || !errorMsg || !form) {
    console.error('Powerdoro tray renderer failed to initialize required elements or bridge')
    return
  }

  function validateAndSend() {
    const value = parseInt(timeInput.value, 10)
    if (isNaN(value) || value < 1 || value > 180) {
      timeInput.classList.add('invalid')
      errorMsg.textContent = 'Enter 1-180 minutes'
      return
    }
    timeInput.classList.remove('invalid')
    errorMsg.textContent = ''
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
      bridge.sendTime(minutes)
    })
  })

  function setTimerRunning(running) {
    timeInput.type = running ? 'text' : 'number'
    timeInput.disabled = running
    submitBtn.disabled = running
    presetBtns.forEach((btn) => { btn.disabled = running })
  }

  bridge.onTimeUpdate((time) => {
    timeInput.value = time
    setTimerRunning(true)
  })

  bridge.onSettingsChanged((settings) => {
    if (settings && settings.timerPresets) {
      const btns = document.querySelectorAll('.preset-btn')
      const presets = settings.timerPresets
      btns.forEach((btn, i) => {
        if (presets[i] !== undefined) {
          btn.setAttribute('data-minutes', presets[i])
          btn.textContent = presets[i] + 'm'
        }
      })
    }
  })

  bridge.onTimerStopped(() => {
    timeInput.value = ''
    setTimerRunning(false)
    timeInput.focus()

    if (Notification.permission === 'granted') {
      new Notification('Powerdoro', { body: 'Timer completed!' })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('Powerdoro', { body: 'Timer completed!' })
        }
      })
    }
  })
})
