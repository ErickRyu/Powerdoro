/* global Chart */

// Chart.js dark theme defaults
Chart.defaults.color = '#aaa';
Chart.defaults.borderColor = '#333';
Chart.defaults.plugins.legend.display = false;

let dailyChart = null;
let hourlyChart = null;
let monthlyChart = null;
let statsData = null;

function formatDateLabel(dateStr) {
  // YYYY_MM_DD → MM/DD
  const parts = dateStr.split('_');
  return parts[1] + '/' + parts[2];
}

function formatHourLabel(hour) {
  if (hour === 0) return '12AM';
  if (hour < 12) return hour + 'AM';
  if (hour === 12) return '12PM';
  return (hour - 12) + 'PM';
}

function updateSummaryCards(data) {
  document.getElementById('today-sessions').textContent = data.today.sessionCount + ' sessions';
  document.getElementById('today-minutes').textContent = data.today.totalMinutes + ' min total';
  document.getElementById('today-avg').textContent = data.today.averageSessionMinutes + ' min avg';

  document.getElementById('week-sessions').textContent = data.thisWeek.sessionCount + ' sessions';
  document.getElementById('week-minutes').textContent = data.thisWeek.totalMinutes + ' min total';
  document.getElementById('week-avg').textContent = data.thisWeek.averageSessionMinutes + ' min avg';

  document.getElementById('current-streak').textContent = data.currentStreak + ' days';
  document.getElementById('longest-streak').textContent = 'Longest: ' + data.longestStreak + ' days';
}

function createDailyChart(days) {
  if (dailyChart) {
    dailyChart.destroy();
  }

  const sliced = statsData.dailyStats.slice(-days);
  const ctx = document.getElementById('daily-chart').getContext('2d');

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sliced.map(function(d) { return formatDateLabel(d.date); }),
      datasets: [{
        label: 'Minutes',
        data: sliced.map(function(d) { return d.totalMinutes; }),
        backgroundColor: '#6c8aff',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#333' },
          ticks: { color: '#888' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#888', maxRotation: 45 },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              var idx = context.dataIndex;
              var stat = sliced[idx];
              return stat.totalMinutes + ' min (' + stat.sessionCount + ' sessions)';
            },
          },
        },
      },
    },
  });
}

function createHourlyChart(data) {
  if (hourlyChart) {
    hourlyChart.destroy();
  }

  var ctx = document.getElementById('hourly-chart').getContext('2d');

  hourlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.hourlyDistribution.map(function(h) { return formatHourLabel(h.hour); }),
      datasets: [{
        label: 'Minutes',
        data: data.hourlyDistribution.map(function(h) { return h.totalMinutes; }),
        backgroundColor: '#4caf50',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#333' },
          ticks: { color: '#888' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#888', maxRotation: 45 },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              var idx = context.dataIndex;
              var h = data.hourlyDistribution[idx];
              return h.totalMinutes + ' min (' + h.sessionCount + ' sessions)';
            },
          },
        },
      },
    },
  });
}

function createMonthlyChart(data) {
  if (monthlyChart) {
    monthlyChart.destroy();
  }

  var ctx = document.getElementById('monthly-chart').getContext('2d');

  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.monthlyTrends.map(function(m) { return m.month; }),
      datasets: [{
        label: 'Minutes',
        data: data.monthlyTrends.map(function(m) { return m.totalMinutes; }),
        backgroundColor: '#f0a030',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#333' },
          ticks: { color: '#888' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#888' },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              var idx = context.dataIndex;
              var m = data.monthlyTrends[idx];
              return m.totalMinutes + ' min (' + m.sessionCount + ' sessions)';
            },
          },
        },
      },
    },
  });
}

// Toggle buttons
document.querySelectorAll('.toggle-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.toggle-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    var days = parseInt(btn.getAttribute('data-days'), 10);
    createDailyChart(days);
  });
});

// Load stats
window.powerdoro.getStats().then(function(data) {
  statsData = data;
  updateSummaryCards(data);
  createDailyChart(7);
  createHourlyChart(data);
  createMonthlyChart(data);
});
