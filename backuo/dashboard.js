// ===== Active tab =====
let activeTab = localStorage.getItem('activeTab') || 'races';

// ===== Load Racecard =====
function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const data = results.data;
      if (!data || data.length <= 1) return;

      const raceRows = data.slice(1).filter(r => r && r.length > 0);

      // Group races by course and raceKey
      const courseMap = {};
      raceRows.forEach(row => {
        const course = row[1] || '';
        const raceTime = row[2] || '';
        const raceKey = `${course} ${raceTime}`;
        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);
      });

      // Build sidebar
      const sidebar = document.getElementById('sidebar');
      sidebar.innerHTML = '';

      Object.keys(courseMap).forEach(course => {
        const btn = document.createElement('button');
        btn.textContent = course;
        btn.className = 'course-button';

        const raceListDiv = document.createElement('div');
        raceListDiv.className = 'race-list';
        raceListDiv.style.display = 'none';

        Object.keys(courseMap[course]).forEach(raceKey => {
          const raceBtn = document.createElement('button');
          raceBtn.textContent = raceKey;

          raceBtn.addEventListener('click', () => {
            document.querySelectorAll('.race-list button').forEach(b => b.classList.remove('active'));
            raceBtn.classList.add('active');
            displayRace(courseMap[course][raceKey], raceKey);
            localStorage.setItem('activeRace', raceKey);
          });

          raceListDiv.appendChild(raceBtn);
        });

        btn.addEventListener('click', () => {
          document.querySelectorAll('.course-button').forEach(b => {
            if (b !== btn) {
              b.classList.remove('active');
              b.nextSibling.style.display = 'none';
            }
          });

          const isActive = btn.classList.toggle('active');
          raceListDiv.style.display = isActive ? 'block' : 'none';
          if (isActive) localStorage.setItem('activeCourse', course);
          else localStorage.removeItem('activeCourse');
        });

        sidebar.appendChild(btn);
        sidebar.appendChild(raceListDiv);
      });

      // Restore last opened course & race
      const savedCourse = localStorage.getItem('activeCourse');
      const savedRace = localStorage.getItem('activeRace');

      if (savedCourse) {
        const courseBtn = [...document.querySelectorAll('.course-button')].find(b => b.textContent === savedCourse);
        if (courseBtn) {
          courseBtn.classList.add('active');
          courseBtn.nextSibling.style.display = 'block';
        }
      }

      if (savedRace) {
        const raceBtn = [...document.querySelectorAll('.race-list button')].find(b => b.textContent === savedRace);
        if (raceBtn) raceBtn.click();
      }
    }
  });
}

// ===== Display race details =====
function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  raceDetails.innerHTML = `<h2>${raceKey}</h2>`;

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '4px';

  raceRows.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? 'white' : '#f9f9f9';

    const horseNumber = row[11] || '';
    const draw = row[16] || '';
    const horseName = row[12] || '';
    const age = row[13] || '';
    const latestRecord = row[26] || '';
    const lastnightOdds = row[18] || '-';
    const nowOdds = row[19] || '-';
    const jockey = row[14] || '';
    const trainer = row[15] || '';

    const horseDiv = document.createElement('div');
    horseDiv.style.backgroundColor = bgColor;
    horseDiv.style.padding = '6px';
    horseDiv.style.borderRadius = '4px';
    horseDiv.style.display = 'flex';
    horseDiv.style.flexDirection = 'column';
    horseDiv.style.gap = '2px';

    const line1 = document.createElement('div');
    line1.textContent = `${horseNumber} (${draw}) - ${horseName}`;
    line1.style.fontWeight = 'bold';
    horseDiv.appendChild(line1);

    const line2 = document.createElement('div');
    line2.textContent = `Age: ${age} | Record: ${latestRecord}`;
    horseDiv.appendChild(line2);

    const line3 = document.createElement('div');
    line3.textContent = `Lastnight: ${lastnightOdds} | Now: ${nowOdds} | J: ${jockey} | T: ${trainer}`;
    horseDiv.appendChild(line3);

    container.appendChild(horseDiv);
  });

  raceDetails.appendChild(container);
}

// ===== Load Drop Odds =====
function loadDropOdds() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/dropodds.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const data = results.data;
      const grid = document.getElementById("drop-odds-grid");
      grid.innerHTML = "";
      if (!data || data.length <= 1) { grid.textContent = "沒有資料"; return; }

      const rows = data.slice(1).filter(r => r && r.length > 0 && r[1]);
      rows.sort((a, b) => {
        const [aH, aM] = a[1].split(":").map(n => parseInt(n, 10));
        const [bH, bM] = b[1].split(":").map(n => parseInt(n, 10));
        return (aH * 60 + aM) - (bH * 60 + bM);
      });

      rows.forEach(row => {
        const lastnightPrice = parseFloat(row[5]) || 0;
        const nowOdd = parseFloat(row[12] || 0) || 0;
        const change = nowOdd - lastnightPrice;
        const percentChange = lastnightPrice ? (change / lastnightPrice * 100) : 0;
        const colorClass = percentChange <= -48 ? 'green' : percentChange >= 48 ? 'red' : '';

        const values = [row[1], row[2], row[3], row[4], row[5], row[12], change.toFixed(2), percentChange.toFixed(2), row[6], row[0]];
        values.forEach(val => {
          const div = document.createElement("div");
          div.className = 'grid-item ' + colorClass;
          div.textContent = val;
          grid.appendChild(div);
        });
      });
    }
  });
}

// ===== Top tab switching =====
document.querySelectorAll('.tab-bar .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    activeTab = tab.dataset.tab;
    localStorage.setItem('activeTab', activeTab);

    document.getElementById('race-details').style.display = activeTab === 'races' ? 'block' : 'none';
    document.getElementById('drop-odds').style.display = activeTab === 'drops' ? 'block' : 'none';

    if (activeTab === 'races') loadRacecard();
    else if (activeTab === 'drops') loadDropOdds();
  });
});

// ===== Initial load =====
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector(`.tab-bar .tab[data-tab="${activeTab}"]`).classList.add('active');
  if (activeTab === 'races') loadRacecard();
  else if (activeTab === 'drops') loadDropOdds();
});

// ===== Auto refresh every 30s =====
setInterval(() => {
  if (activeTab === 'races') loadRacecard();
  else if (activeTab === 'drops') loadDropOdds();
}, 30000);




