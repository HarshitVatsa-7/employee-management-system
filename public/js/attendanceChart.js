(async function(){
  const ctx = document.getElementById('attendanceChart').getContext('2d');
  try {
    const res = await fetch('/attendance/data');
    const json = await res.json();
    const data = json.data;

    // Prepare labels and durations (minutes)
    const labels = data.map(r => {
      const d = new Date(r.in_time);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    });

    const durations = data.map(r => {
      // convert seconds to minutes; if null, show 0
      return r.duration_seconds ? Math.round(r.duration_seconds / 60) : 0;
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Duration (minutes)',
          data: durations,
          // Chart.js default colors will be used
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    console.error('Failed to load attendance data', err);
  }
})();
