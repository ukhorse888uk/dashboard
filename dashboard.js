let activeTab = localStorage.getItem('activeTab') || 'races';

let masterJockeyMap = {};
let masterTrainerMap = {};
let raceNumberMap = {}; // Maps race keys to their assigned numbers

function buildMasterMaps(data) {
  masterJockeyMap = {};
  masterTrainerMap = {};

  data.forEach(row => {
    const jockeyName = row[34] || ''; // Column AI
    const jockeyCount = row[35] || '0'; // Column AJ
    if (jockeyName && jockeyName.trim() !== '' && jockeyName.trim().toUpperCase() !== 'NON-RUNNER') {
      // Process jockey races from columns AK to AU
      const jockeyRaces = row.slice(36, 47)
        .filter(r => r && r.trim() !== '')
        .map(raceStr => {
          // Parse race string: "14:20 | Aintree | horsename"
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

    const trainerName = row[47] || ''; // Column AV
    const trainerCount = row[48] || '0'; // Column AW
    if (trainerName && trainerName.trim() !== '' && trainerName.trim().toUpperCase() !== 'NON-RUNNER') {
      masterTrainerMap[trainerName.trim()] = { raceCount: trainerCount };
    }
  });
}

function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const validRows = results.data
        .filter(row => row && row.length > 0)
        .filter(row => row[1] && String(row[1]).trim() !== "");

      if (!validRows || validRows.length <= 1) {
        document.getElementById('sidebar').innerHTML = '';
        return;
      }

      const raceRows = validRows.slice(1); // Skip header

      // Build master lookup maps for jockeys and trainers
      buildMasterMaps(raceRows);

      // 2. Group races by course and raceKey
      const courseMap = {};
      raceRows.forEach(row => {
        const course = (row[1] || '').trim();
        if (!course) return;

        const raceTime = (row[2] || '').trim();
        const raceKey = `${course} ${raceTime}`;
        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);
      });

      // 3. Build sidebar UI
      const sidebar = document.getElementById('sidebar');
      sidebar.innerHTML = '';

      let raceCounter = 1; // global race counter
      raceNumberMap = {}; // Reset race number map

      Object.keys(courseMap).forEach(course => {
        const btn = document.createElement('button');
        btn.textContent = course;
        btn.className = 'course-button';

        const raceListDiv = document.createElement('div');
        raceListDiv.className = 'race-list';
        raceListDiv.style.display = 'none';

        Object.keys(courseMap[course]).forEach(raceKey => {
          // Store race number mapping
          raceNumberMap[raceKey] = raceCounter;

          const raceBtn = document.createElement('button');
          raceBtn.className = 'race-button';
          raceBtn.setAttribute('data-race-number', raceCounter);
          raceBtn.innerHTML = `<span class="race-number">${raceCounter}</span> ${raceKey}`;

          raceBtn.addEventListener('click', () => {
            // Scroll page to top immediately
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Remove active class from all race buttons
            document.querySelectorAll('.race-list button').forEach(b => b.classList.remove('active'));
            raceBtn.classList.add('active');

            // Display the race
            displayRace(courseMap[course][raceKey], raceKey);

            // Save active race to localStorage
            localStorage.setItem('activeRace', raceKey);
          });

          raceListDiv.appendChild(raceBtn);
          raceCounter++; // increment global counter
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

      // 4. Restore last opened course & race
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
        const raceBtn = [...document.querySelectorAll('.race-list button')].find(b => b.textContent.includes(savedRace));
        if (raceBtn) raceBtn.click();
      }
    }
  });
}


function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  raceDetails.innerHTML = ''; // Clear previous content

  // Get race metadata from first row
  const raceData = raceRows[0];
  const distance = raceData[5] || 'N/A';
  const raceClass = raceData[4] || 'N/A';
  const going = raceData[7] || 'N/A';
  const raceName = raceData[3] || '';
  const rawPrize = raceData[6] || '';
  const prizeValue = rawPrize.replace(/[^0-9]/g, '');
  const formattedPrize = prizeValue ? `£${parseInt(prizeValue).toLocaleString()}` : 'N/A';

  // Header
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

  // Table + header row
  const table = document.createElement('table');
  table.className = 'race-table';
  const headerRow = document.createElement('tr');
  ['號碼(檔)', '馬名', '年齡', '近戰績', '隔夜', '最近'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Process ONLY horse rows
  const horseRows = raceRows.filter(row => {
    const horseNumber = row[11];
    return horseNumber && horseNumber.toString().trim() !== '' &&
      horseNumber.toString().trim() !== 'Jockey' &&
      horseNumber.toString().trim() !== 'Trainer';
  });

  horseRows.forEach((row, index) => {
    const horseNumber = row[11] || '';
    const draw = row[16] || '';
    const horseName = row[12] || '';
    const age = row[13] || '';
    const latestRecord = row[26] || '';
    const lastnightOdds = row[18] || '-';
    const nowOdds = row[19] || '-';
    const jockeyRaw = (row[14] || '').trim();
    const trainerRaw = (row[15] || '').trim();
    const silkUrl = row[9] || '';

    const jockey = jockeyRaw.replace(/^騎\s*/, '').replace(/\s*\(.*?\)/g, '').trim();
    const trainer = trainerRaw.replace(/^練\s*/, '').replace(/\s*\(.*?\)/g, '').trim();

    const jockeyData = masterJockeyMap[jockey] || { raceCount: '0', races: [] };
    const trainerData = masterTrainerMap[trainer] || { raceCount: '0', races: [] };

    const horseRow = document.createElement('tr');
    horseRow.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';

    // Col 1
    const numCell = document.createElement('td');
    numCell.innerHTML = `
            <div style="font-weight:bold">${horseNumber} (${draw})</div>
            <div style="height:24px">${silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : ''}</div>
            <div></div>
        `;
    horseRow.appendChild(numCell);

    // Col 2
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `
            <div style="font-weight:bold">${horseName}</div>
            <div><span class="jockey-badge">騎 ${jockeyRaw}</span></div>
            <div><span class="trainer-badge">練 ${trainerRaw}</span></div>
        `;
    horseRow.appendChild(nameCell);

    // Col 3
    const ageCell = document.createElement('td');
    ageCell.innerHTML = `
            <div>${age}</div>
            <div style="font-size: 14px; color: #666; font-weight: bold;">騎師場次 ${jockeyData.raceCount}</div>
            <div style="font-size: 14px; color: #666; font-weight: bold;">練馬師場次 ${trainerData.raceCount}</div>
        `;
    horseRow.appendChild(ageCell);

    // Col 4
    const recordCell = document.createElement('td');
    let racePillsHTML = '';
    if (jockeyData.races && jockeyData.races.length > 0) {
      racePillsHTML = '<div class="race-pills">';
      jockeyData.races.forEach(race => {
        const raceKeyOther = `${race.course} ${race.time}`;
        const raceNumber = raceNumberMap[raceKeyOther];
        if (raceNumber) {
          racePillsHTML += `<span class="race-pill" data-race-key="${raceKeyOther}" data-jockey="${jockey}">${raceNumber}</span>`;
        }
      });
      racePillsHTML += '</div>';
    }
    recordCell.innerHTML = `<div>${latestRecord}</div>${racePillsHTML}`;
    horseRow.appendChild(recordCell);

    // Cols 5-6
    [lastnightOdds, nowOdds].forEach(text => {
      const cell = document.createElement('td');
      cell.innerHTML = `<div>${text}</div><div></div><div></div>`;
      horseRow.appendChild(cell);
    });

    table.appendChild(horseRow);
  });

  raceDetails.appendChild(table);

  // Pill click event
  document.querySelectorAll('.race-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const raceKey = pill.getAttribute('data-race-key');
      const jockeyName = pill.getAttribute('data-jockey');
      const pillNumber = pill.getAttribute('data-number');

      // Remove 'current' and 'disabled-pill' from all pills
      document.querySelectorAll('.race-pill').forEach(p => p.classList.remove('current', 'disabled-pill'));

      // Add 'current' to clicked pill
      pill.classList.add('current');

      // Find and click corresponding race button
      const raceBtn = [...document.querySelectorAll('.race-button')]
        .find(btn => btn.textContent.includes(raceKey));

      if (raceBtn) {
        // Remove active from all buttons
        document.querySelectorAll('.race-button').forEach(b => b.classList.remove('active'));
        // Add active to this button
        raceBtn.classList.add('active');

        // Trigger race button click
        raceBtn.click();

        // Highlight first horse row with that jockey
        setTimeout(() => {
          const raceTable = document.querySelector('.race-table');
          if (raceTable) {
            const rows = raceTable.querySelectorAll('tr');
            rows.forEach((r, i) => {
              if (i === 0) return; // skip header
              const jockeyCell = r.querySelector('td:nth-child(2) .jockey-badge');
              if (jockeyCell && jockeyCell.textContent.includes(jockeyName)) {
                r.classList.add('highlight-jockey');
                r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => r.classList.remove('highlight-jockey'), 10000);
              }
            });
          }

          // Disable and grey out pill(s) matching the current race number
          const currentRaceNumber = raceNumberMap[raceKey];
          document.querySelectorAll(`.race-pill[data-number="${currentRaceNumber}"]`)
            .forEach(p => p.classList.add('disabled-pill'));
        }, 50);
      }
    });
  });
}




function loadDropOdds() {
  const container = document.getElementById("drop-odds-container");
  container.innerHTML = '<div class="loading">載入中...</div>';

  const csvUrl = "https://ukhorse888uk.github.io/dashboard/csv/dropodds.csv?cb=" + Date.now();

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      let data = results.data;

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="error">沒有數據 (Empty)</div>';
        return;
      }

      // Trim keys and values, skip fully empty rows, ensure first horse row is included
      data = data
        .map(row => {
          const trimmedRow = {};
          Object.keys(row).forEach(k => {
            const key = k.trim();
            trimmedRow[key] = row[k] ? row[k].toString().trim() : '';
          });
          return trimmedRow;
        })
        .filter(row =>
          row['Horse Name'] && row['Horse Name'] !== '' &&
          row['Time'] && row['Time'] !== '' &&
          row['Horse Name'] !== 'Horse Name'
        );

      // Sort by Time
      data.sort((a, b) => a['Time'].localeCompare(b['Time'], undefined, { numeric: true, sensitivity: 'base' }));

      if (data.length === 0) {
        container.innerHTML = '<div class="error">沒有有效馬匹數據</div>';
        return;
      }

      let tableHTML = `
  <table class="drop-odds-table">
    <thead>
      <tr>
        <th>賽時</th>
        <th>場地</th>
        <th>號碼</th>
        <th>馬名</th>
        <th>隔夜價格</th>
        <th>現時價格</th>
        <th>變動</th>
        <th>變動 %</th>
        <th>賽果</th>
        <th>跑出賠率</th>
      </tr>
    </thead>
    <tbody>
`;

      data.forEach(row => {
        const original = parseFloat(row['Original']) || 0;
        const now = parseFloat(row['NOW']) || 0;
        const change = parseFloat(row['Change']) || (now - original);
        const pctChange = parseFloat(row['%']) || (original ? (change / original) * 100 : 0);
        const colorClass = pctChange <= -48 ? 'green' : pctChange >= 48 ? 'red' : '';

        tableHTML += `<tr>
    <td>${row['Time'] || '--'}</td>
    <td>${row['Course'] || '--'}</td>
    <td>${row['Num'] || '--'}</td>
    <td>${row['Horse Name']}</td>
    <td>${original.toFixed(2)}</td>
    <td>${now.toFixed(2)}</td>
    <td class="${colorClass}">${change.toFixed(2)}</td>
    <td class="${colorClass}">${pctChange.toFixed(2)}%</td>
    <td>${row['FIN'] || '--'}</td>
    <td>${row['SP Odds'] || '--'}</td>
  </tr>`;
      });

      tableHTML += '</tbody></table>';
      container.innerHTML = tableHTML;
    },
    error: function (err) {
      container.innerHTML = `<div class="error">加載失敗 (Error)<br>${err.message}</div>`;
      console.error(err);
    }
  });
}

// ===== Tab Switching and Auto Refresh =====
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
  const savedTab = localStorage.getItem('activeTab') || 'races';
  const tabElement = document.querySelector(`.tab-bar .tab[data-tab="${savedTab}"]`);
  if (tabElement) tabElement.click();
});

// Auto-refresh every 30 seconds
setInterval(() => {
  const activeTab = localStorage.getItem('activeTab') || 'races';
  if (activeTab === 'races') loadRacecard();
  else if (activeTab === 'drops') loadDropOdds();
}, 30000);






