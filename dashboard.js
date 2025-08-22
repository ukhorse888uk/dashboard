// ===== Active tab =====
let activeTab = localStorage.getItem('activeTab') || 'races';

let masterJockeyMap = {};
let masterTrainerMap = {};

function buildMasterMaps(data) {
  masterJockeyMap = {};
  masterTrainerMap = {};

  data.forEach(row => {
    const jockeyName = row[34] || ''; // Column AI
    const jockeyCount = row[35] || '0'; // Column AJ
    if (jockeyName && jockeyName.trim() !== '' && jockeyName.trim().toUpperCase() !== 'NON-RUNNER') {
      masterJockeyMap[jockeyName.trim()] = { raceCount: jockeyCount };  // store as object
    }

    const trainerName = row[47] || ''; // Column AV
    const trainerCount = row[48] || '0'; // Column AW
    if (trainerName && trainerName.trim() !== '' && trainerName.trim().toUpperCase() !== 'NON-RUNNER') {
      masterTrainerMap[trainerName.trim()] = { raceCount: trainerCount }; // store as object
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

      Object.keys(courseMap).forEach(course => {
        const btn = document.createElement('button');
        btn.textContent = course;
        btn.className = 'course-button';

        const raceListDiv = document.createElement('div');
        raceListDiv.className = 'race-list';
        raceListDiv.style.display = 'none';

        Object.keys(courseMap[course]).forEach(raceKey => {
          const raceBtn = document.createElement('button');
          raceBtn.className = 'race-button';
          raceBtn.setAttribute('data-race-number', raceCounter); // number for half-circle
          raceBtn.textContent = raceKey;

          raceBtn.addEventListener('click', () => {
            document.querySelectorAll('.race-list button').forEach(b => b.classList.remove('active'));
            raceBtn.classList.add('active');
            displayRace(courseMap[course][raceKey], raceKey);
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
        const raceBtn = [...document.querySelectorAll('.race-list button')].find(b => b.textContent === savedRace);
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
    const horseNumber = row[11]; // Column L
    return horseNumber && horseNumber.toString().trim() !== '' &&
      horseNumber.toString().trim() !== 'Jockey' &&
      horseNumber.toString().trim() !== 'Trainer';
  });

  horseRows.forEach((row, index) => {
    const horseNumber = row[11] || '';     // L
    const draw = row[16] || '';            // Q
    const horseName = row[12] || '';       // M
    const age = row[13] || '';             // N
    const latestRecord = row[26] || '';    // AA
    const lastnightOdds = row[18] || '-';  // S
    const nowOdds = row[19] || '-';        // T
    const jockeyRaw = (row[14] || '').trim(); // O
    const trainerRaw = (row[15] || '').trim(); // P
    const silkUrl = row[9] || '';          // J

    // Strip "騎 ", "練 " prefixes and remove parentheses before lookup
    const jockey = jockeyRaw.replace(/^騎\s*/, '').replace(/\s*\(.*?\)/g, '').trim();
    const trainer = trainerRaw.replace(/^練\s*/, '').replace(/\s*\(.*?\)/g, '').trim();

    // Get jockey/trainer data from master maps
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

    // Col 3 (age + race counts)
    const ageCell = document.createElement('td');
    ageCell.innerHTML = `
      <div>${age}</div>
      <div style="font-size: 14px; color: #666; font-weight: bold;">騎師場次 ${jockeyData.raceCount}</div>
      <div style="font-size: 14px; color: #666; font-weight: bold;">練馬師場次 ${trainerData.raceCount}</div>
    `;
    horseRow.appendChild(ageCell);

    // Col 4 (latest record only)
    const recordCell = document.createElement('td');
    recordCell.innerHTML = `<div>${latestRecord}</div>`;
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
        .filter(row => Object.keys(row).length > 0 && row['Horse Name'] && row['Horse Name'] !== '');

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
              <th>最早掉價<br>時/賠</th>
              <th>最低價格<br>時/賠</th>
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
          <td>${row['first'] || '--'}</td>
          <td>${row['LOWEST'] || '--'}</td>
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






