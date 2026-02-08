'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const timeInput = document.getElementById('time')
  const submitBtn = document.getElementById('submit_btn')
  const errorMsg = document.getElementById('error-msg')
  const form = document.getElementById('time-form')
  const stopBtn = document.getElementById('stop-btn')
  const exitBtn = document.getElementById('exit-btn')
  const settingsBtn = document.getElementById('settings-btn')
  const presetBtns = document.querySelectorAll('.preset-btn')

  function validateAndSend() {
    const value = parseInt(timeInput.value, 10)
    if (isNaN(value) || value < 1 || value > 180) {
      timeInput.classList.add('invalid')
      errorMsg.textContent = 'Enter 1-180 minutes'
      return
    }
    timeInput.classList.remove('invalid')
    errorMsg.textContent = ''
    window.powerdoro.sendTime(value)
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    validateAndSend()
  })

  stopBtn.addEventListener('click', () => {
    window.powerdoro.stopTimer()
  })

  exitBtn.addEventListener('click', () => {
    window.powerdoro.exitApp()
  })

  settingsBtn.addEventListener('click', () => {
    window.powerdoro.openSettings()
  })

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.getAttribute('data-minutes'), 10)
      timeInput.value = minutes
      timeInput.classList.remove('invalid')
      errorMsg.textContent = ''
      window.powerdoro.sendTime(minutes)
    })
  })

  function setTimerRunning(running) {
    timeInput.disabled = running
    submitBtn.disabled = running
    presetBtns.forEach((btn) => { btn.disabled = running })
  }

  window.powerdoro.onTimeUpdate((time) => {
    timeInput.value = time
    setTimerRunning(true)
  })

  window.powerdoro.onSettingsChanged((settings) => {
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

  window.powerdoro.onTimerStopped(() => {
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
