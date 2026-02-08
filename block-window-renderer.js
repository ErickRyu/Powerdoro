'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('retrospect-form')
  const retrospectInput = document.getElementById('retrospect')
  const errorMsg = document.getElementById('error-msg')

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const text = retrospectInput.value.trim()
    if (!text) {
      retrospectInput.classList.add('invalid')
      errorMsg.textContent = 'Please write what you accomplished'
      return
    }
    retrospectInput.classList.remove('invalid')
    errorMsg.textContent = ''
    window.powerdoro.sendRetrospect(text)
  })
})
