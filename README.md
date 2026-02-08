# Powerdoro
Pomodoro + small timer

Type in time as much as you need. And after the time's up, this will GRAB YOUR ATTENTION as 'small timer' does. But here is the difference! You MUST TYPE IN RETROSPECT or some records of what you did during this time. Then your screen blocker will be gone. You can find your records in retrospect.txt

I'll make this timer repeat automatically like pomodoro timer. I've got many things to do. You can check roadmap below this README (It is written in Korean) and feel free to add issues.

Enjoy your flow!

## Product Vision

Powerdoro aims to be an intuitive and powerful focusing app, leveraging the Pomodoro technique to boost user productivity and concentration. It will provide customizable work/break cycles, session tracking, and motivating feedback, empowering users to manage their time effectively and achieve deep work states.

## MVP Definition

Our Minimum Viable Product (MVP) focuses on delivering the core Pomodoro timer functionality with customization and notifications.

### Core MVP Features:
*   Manual start/pause/reset for focus, short break, and long break timers.
*   Configurable durations for focus sessions (e.g., default 25 mins), short breaks (e.g., default 5 mins), and long breaks (e.g., default 15 mins).
*   Configurable number of focus sessions before a long break (e.g., default 4).
*   Basic audio/visual notifications upon completion of each session/break.
*   Persistent settings (locally stored).

### Conceptual Endpoints:
*   `timer.start(type: "focus" | "short_break" | "long_break")`
*   `timer.pause()`
*   `timer.reset()`
*   `timer.getStatus()` -> `{ current_type, time_remaining, is_running }`
*   `settings.update(focus_duration, short_break_duration, long_break_duration, pomos_before_long_break)`
*   `settings.get()` -> `{ focus_duration, short_break_duration, long_break_duration, pomos_before_long_break }`

### Constraints:
*   Timer durations: Positive integers (e.g., 1-120 minutes).
*   Focus sessions before long break: Positive integer (e.g., 1-8).
*   Core timer functionality must work offline.
*   Settings should persist across app restarts.

### Acceptance Tests (Gherkin style examples):

1.  **AT1: Start and Complete Focus Session**
    *   **Given** the focus duration is set to 25 minutes.
    *   **When** the user starts a focus session.
    *   **Then** the timer should display "25:00" and begin counting down.
    *   **And when** the timer reaches "00:00".
    *   **Then** a "focus session complete" notification should be triggered.
    *   **And** the app should suggest starting a short break.

2.  **AT2: Automatic Cycle to Short Break**
    *   **Given** a focus session has just completed, and it's not time for a long break.
    *   **When** the user confirms to start the next phase.
    *   **Then** a short break timer should start with the configured duration (e.g., 5 minutes).

*(...and so on for other Acceptance Tests as previously outlined)*

## Security Considerations

### A03:2021 – Injection (Cross-Site Scripting - XSS)
*   **Risk Scenario:** If the app allows user input for elements like task names or custom notifications, and this input is rendered in an HTML-based UI without proper sanitization, malicious JavaScript could be injected.
*   **Mitigation:**
    1.  **Output Encoding:** Ensure user-supplied data is contextually encoded when displayed (e.g., HTML entity encoding).
    2.  **Input Validation/Sanitization:** Validate input formats and sanitize by stripping malicious patterns or allowing only safe subsets of characters/tags.
    3.  **Use Safe APIs and Frameworks:** Rely on framework features that provide auto-escaping (e.g., React, Vue, Angular). Avoid `innerHTML` with unvalidated content.
    4.  **Content Security Policy (CSP):** Implement a strict CSP for web-based components to restrict script execution.

# Installation and Usage
## Installation
### Option 1. Source code
```
$ git clone https://github.com/ErickRyu/Powerdoro.git
$ cd Powerdoro
$ npm install
$ npm start
```

### Option 2. pkg 
[Download pkg](https://drive.google.com/drive/folders/1yGCQRAMzCLOV0-r4-fp4iaba9AvK9jDc?usp=sharing)

## Usage
### Click tray, enter time and start
![alt text](screenshots/step01.png "step1 image")

### Time's over
![alt text](screenshots/step02.png "step2 image")

### You should enter retrospect and then it will be closed
![alt text](screenshots/step03.png "step3 image")

### You can read your retrospect in retrospect.txt at your desktop

# Roadmap
[Trello board](https://trello.com/b/zDA1vG6u)
