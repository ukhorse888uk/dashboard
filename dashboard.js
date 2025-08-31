let activeTab = localStorage.getItem('activeTab') || 'races';

let masterJockeyMap = {};
let masterTrainerMap = {};
let raceNumberMap = {}; // Maps race keys to assigned numbers

function buildMasterMaps(data) {
  masterJockeyMap = {};
  masterTrainerMap = {};

  data.forEach(row => {
    const jockeyName = row[34] || '';
    const jockeyCount = row[35] || '0';
    if (jockeyName && jockeyName.trim() !== '' && jockeyName.trim().toUpperCase() !== 'NON-RUNNER') {
      const jockeyRaces = row.slice(36, 47)
        .filter(r => r && r.trim() !== '')
        .map(raceStr => {
          const parts = raceStr.split('|').map(p => p.trim());
          return {
            time: parts[0] || '',
            course: parts[1] || '',
            horse: parts[2] || '',
            fullString: raceStr
          };
        });

      masterJockeyMap[jockeyName.trim()] = {
        raceCount: jockeyCount,
        races: jockeyRaces
      };
    }

    const trainerName = row[47] || '';
    const trainerCount = row[48] || '0';
    if (trainerName && trainerName.trim() !== '' && trainerName.trim().toUpperCase() !== 'NON-RUNNER') {
      masterTrainerMap[trainerName.trim()] = { raceCount: trainerCount };
    }
  });
}

// ==============================
// Load Racecard and Build Dropdown
function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const validRows = results.data
        .filter(row => row && row.length > 0)
        .filter(row => row[1] && String(row[1]).trim() !== "");

      if (!validRows || validRows.length <= 1) return;

      const raceRows = validRows.slice(1); // Skip header
      buildMasterMaps(raceRows);

      // Group races by course
      const courseMap = {};
      raceRows.forEach(row => {
        const course = (row[0] || '').trim(); // Column B (index 1)
        if (!course) return;

        const raceTime = (row[2] || '').trim(); // Column C (index 2)
        if (!raceTime) return;

        const raceKey = `${course}|${raceTime}`;

        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);
      });

      // Build dropdown UI
      const dropdown = document.getElementById('race-dropdown');
      dropdown.innerHTML = '';

      Object.keys(courseMap).forEach(course => {
        const courseRow = document.createElement('div');
        courseRow.className = 'course-row';

        const courseName = document.createElement('span');
        courseName.className = 'course-name';
        courseName.textContent = course;
        courseRow.appendChild(courseName);

        Object.keys(courseMap[course]).forEach(raceKey => {
          const timeOnly = raceKey.split('|')[1];
          const timeSpan = document.createElement('span');
          timeSpan.className = 'race-time';
          timeSpan.textContent = timeOnly;
          timeSpan.setAttribute('data-race-key', raceKey);

          timeSpan.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });

            document.querySelectorAll('#race-dropdown .race-time').forEach(t => t.classList.remove('active'));
            timeSpan.classList.add('active');

            displayRace(courseMap[course][raceKey], raceKey);
            localStorage.setItem('activeRace', raceKey);

            dropdown.classList.remove('open');
            updateRaceArrow(); // <-- arrow now points down
          });

          courseRow.appendChild(timeSpan);
          courseRow.appendChild(document.createTextNode(' '));
        });

        dropdown.appendChild(courseRow);
      });
    }
  });
}

// --- Sync arrow with dropdown ---
function updateRaceArrow() {
  const raceTab = document.querySelector('.tab-bar .tab[data-tab="races"]');
  const arrow = raceTab.querySelector('.arrow');
  const dropdown = document.getElementById('race-dropdown');

  if (dropdown.classList.contains('open')) {
    arrow.classList.add('open');   // arrow points up
  } else {
    arrow.classList.remove('open'); // arrow points down
  }
}

// --- Toggle Race Dropdown ---
document.addEventListener('DOMContentLoaded', function () {
  const raceTab = document.querySelector('.tab-bar .tab[data-tab="races"]');
  const arrow = raceTab.querySelector('.arrow');
  const dropdown = document.getElementById('race-dropdown');

  // Ensure dropdown is closed on page load
  dropdown.classList.remove('open');
  updateRaceArrow();

  raceTab.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    updateRaceArrow(); // <-- arrow sync
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!raceTab.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      updateRaceArrow();
    }
  });

  // Close dropdown when switching to other tabs
  document.querySelectorAll('.tab-bar .tab').forEach(tab => {
    if (tab.getAttribute('data-tab') !== 'races') {
      tab.addEventListener('click', () => {
        dropdown.classList.remove('open');
        updateRaceArrow();
      });
    }
  });

  loadRacecard();
});


// ==============================
// Display Race Table
// ==============================
// Display Race Table (UPDATED FOR 9-COLUMN LAYOUT)
function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  raceDetails.innerHTML = '';

  const raceData = raceRows[0];
  const distance = raceData[5] || 'N/A';
  const raceClass = raceData[4] || 'N/A';
  const going = raceData[7] || 'N/A';
  const raceName = raceData[3] || '';
  const rawPrize = raceData[6] || '';
  const prizeValue = rawPrize.replace(/[^0-9]/g, '');
  const formattedPrize = prizeValue ? `£${parseInt(prizeValue).toLocaleString()}` : 'N/A';

  const raceHeader = document.createElement('div');
  raceHeader.className = 'race-header';
  raceHeader.innerHTML = `
        <div class="race-title">${raceKey}</div>
        <div class="race-meta">
            <span>距離: ${distance} Furlong </span>
            <span>班數: ${raceClass}</span>
            <span>地質: ${going}</span>
            <span>獎金: ${formattedPrize}</span>
        </div>
        ${raceName ? `<div class="race-name">${raceName}</div>` : ''}
    `;
  raceDetails.appendChild(raceHeader);

  const table = document.createElement('table');
  table.className = 'race-table';

  // Create table header with 9 columns
  const headerRow = document.createElement('tr');
  ['號碼(檔)', '馬名', '年齡', '近戰績', '隔夜', '最近', '練馬師', '騎師', '評分'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const horseRows = raceRows.filter(row => {
    const horseNumber = row[32]; // Column AG (index 32)
    return horseNumber && horseNumber.toString().trim() !== '' &&
      horseNumber.toString().trim() !== 'Jockey' &&
      horseNumber.toString().trim() !== 'Trainer';
  });

  horseRows.forEach((row, index) => {
    // Get data from row using the column indices you specified
    const horseNumber = row[32] || '';        // Column AG (index 32)
    const draw = row[33] || '';               // Column AH (index 33)
    const horseName = row[20] || '';          // Column U (index 20)
    const age = row[22] || '';                // Age column (index 22)
    const form = row[43] || '';               // Column AR (index 43)
    const owner = row[31] || '';              // Column AF (index 31)
    const sire = row[27] || '';               // Column AB (index 27)
    const dam = row[28] || '';                // Column AC (index 28)
    const damsire = row[29] || '';            // Column AD (index 29)
    const silkUrl = row[41] || '';            // Column AP (index 41)
    const lastRun = row[42] || '';            // Column AQ (index 42)
    const trainer = row[30] || '';            // Trainer column (index 30)
    const jockey = row[40] || '';             // Jockey column (index 40)
    const rating = row[26] || '';             // Rating column (index 26)
    const lastnightOdds = row[51] || '-';     // Last night odds (index 51)
    const nowOdds = row[52] || '-';           // Now odds (index 52)

    const jockeyData = masterJockeyMap[jockey] || { raceCount: '0', races: [] };
    const trainerData = masterTrainerMap[trainer] || { raceCount: '0', races: [] };

    const horseRow = document.createElement('tr');
    horseRow.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';

    // Column 1: 號碼(檔) - with 4 lines of data
    const numCell = document.createElement('td');
    numCell.innerHTML = `
        <div style="font-weight:bold">${horseNumber} (${draw})</div>
        <div>${form}</div>
        <div></div>
        <div class="owner-info" colspan="2">${owner}</div>
        <div class="pedigree-info" colspan="2">${sire} - ${dam} (${damsire})</div>
    `;
    horseRow.appendChild(numCell);

    // Column 2: 馬名 - with silk image
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `
        <div style="font-weight:bold">${horseName}</div>
        <div>${silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : ''}</div>
        <div style="font-size: 0.85em; color: #666;">${lastRun}</div>
    <div></div>
    <div></div>
    `;
    horseRow.appendChild(nameCell);

    // Column 3: 年齡
    const ageCell = document.createElement('td');
    ageCell.innerHTML = `
        <div>${age}</div>
        <div style="font-size: 14px; color: #666; font-weight: bold;">騎師場次 ${jockeyData.raceCount}</div>
        <div style="font-size: 14px; color: #666; font-weight: bold;">練馬師場次 ${trainerData.raceCount}</div>
        <div></div>
    `;
    horseRow.appendChild(ageCell);

    // Column 4: 近戰績
    const formCell = document.createElement('td');
    formCell.innerHTML = `
        <div>${form}</div>
        <div></div>
        <div></div>
        <div></div>
    `;
    horseRow.appendChild(formCell);

    // Column 5: 隔夜 (Last Night Odds)
    const lastNightOddsCell = document.createElement('td');
    lastNightOddsCell.innerHTML = `
        <div>${lastnightOdds}</div>
        <div></div>
        <div></div>
        <div></div>
    `;
    horseRow.appendChild(lastNightOddsCell);

    // Column 6: 最近 (Now Odds)
    const nowOddsCell = document.createElement('td');
    nowOddsCell.innerHTML = `
        <div>${nowOdds}</div>
        <div></div>
        <div></div>
        <div></div>
    `;
    horseRow.appendChild(nowOddsCell);

    // Column 7: 練馬師 (Trainer)
    const trainerCell = document.createElement('td');
    trainerCell.innerHTML = `
        <div>${trainer}</div>
        <div></div>
        <div></div>
        <div></div>
    `;
    horseRow.appendChild(trainerCell);

    // Column 8: 騎師 (Jockey)
    const jockeyCell = document.createElement('td');
    jockeyCell.innerHTML = `
        <div>${jockey}</div>
        <div></div>
        <div></div>
        <div></div>
    `;
    horseRow.appendChild(jockeyCell);

    // Column 9: 評分 (Rating)
    const ratingCell = document.createElement('td');
    ratingCell.innerHTML = `
        <div>${rating}</div>
        <div></div>
        <div></div>
        <div></div>
    `;
    horseRow.appendChild(ratingCell);

    table.appendChild(horseRow);
  });

  raceDetails.appendChild(table);



  // Pill click events
  document.querySelectorAll('.race-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const raceKey = pill.getAttribute('data-race-key');
      const jockeyName = pill.getAttribute('data-jockey');

      document.querySelectorAll('.race-pill').forEach(p => p.classList.remove('current', 'disabled-pill'));
      pill.classList.add('current');

      const raceBtn = [...document.querySelectorAll('.race-button')]
        .find(btn => btn.textContent.includes(raceKey));

      if (raceBtn) {
        document.querySelectorAll('.race-button').forEach(b => b.classList.remove('active'));
        raceBtn.classList.add('active');
        raceBtn.click();

        setTimeout(() => {
          const raceTable = document.querySelector('.race-table');
          if (raceTable) {
            const rows = raceTable.querySelectorAll('tr');
            rows.forEach((r, i) => {
              if (i === 0) return;
              const jockeyCell = r.querySelector('td:nth-child(2) .jockey-badge');
              if (jockeyCell && jockeyCell.textContent.includes(jockeyName)) {
                r.classList.add('highlight-jockey');
                r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => r.classList.remove('highlight-jockey'), 10000);
              }
            });
          }
        }, 0);
      }
    });
  });

  const currentRaceNumber = raceNumberMap[raceKey];
  document.querySelectorAll(`.race-pill[data-number="${currentRaceNumber}"]`).forEach(pill => {
    const isCurrent = true; // replace with actual logic
    pill.classList.add('disabled-pill', isCurrent ? 'gold' : 'green');
  });
}

// ==============================
// Drop odds logic remains unchanged
function loadDropOdds() {
  // ... your existing code unchanged ...
}

// ==============================
// Tab switching & auto-refresh logic remains unchanged
document.addEventListener('DOMContentLoaded', function () {
  const tabs = document.querySelectorAll('.tab-bar .tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const activeTab = tab.dataset.tab;
      localStorage.setItem('activeTab', activeTab);

      const sidebar = document.getElementById('sidebar');
      const mainContent = document.getElementById('main-content');

      if (activeTab === 'drops') {
        sidebar.style.flex = '0 0 0';
        sidebar.style.width = '0';
        sidebar.style.opacity = '0';
        sidebar.style.overflow = 'hidden';

        mainContent.style.flex = '1 0 100%';
        mainContent.style.maxWidth = '100%';

        document.getElementById('race-details').style.display = 'none';
        document.getElementById('drop-odds').style.display = 'block';
        loadDropOdds();

      } else {
        sidebar.style.flex = '0 0 220px';
        sidebar.style.width = '220px';
        sidebar.style.opacity = '1';
        sidebar.style.overflow = 'auto';

        mainContent.style.flex = '1';
        mainContent.style.maxWidth = 'calc(100% - 220px)';

        document.getElementById('race-details').style.display = 'block';
        document.getElementById('drop-odds').style.display = 'none';

        if (typeof loadRacecard === 'function') loadRacecard();
      }
    });
  });

  // Initial tab load
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    const tabElement = document.querySelector(`.tab-bar .tab[data-tab="${savedTab}"]`);
    if (tabElement) tabElement.click();
  }

});

setInterval(() => {
  const activeTab = localStorage.getItem('activeTab') || 'races';
  if (activeTab === 'races') loadRacecard();
  else if (activeTab === 'drops') loadDropOdds();
}, 30000);







