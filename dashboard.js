let activeTab = localStorage.getItem('activeTab') || 'races';
let masterJockeyMap = {};
let masterTrainerMap = {};
let raceNumberMap = {}; // Maps race keys to assigned numbers
let raceFormData = {}; // Store race form data by horse name

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

// Load race form data
function loadRaceFormData() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/raceform2.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const data = results.data;
      if (!data || data.length === 0) return;

      let currentHorse = '';
      raceFormData = {};

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const horseName = row[0] ? row[0].trim() : '';

        if (horseName !== '') {
          // New horse found → start new array
          currentHorse = horseName;
          raceFormData[currentHorse] = [];
          // Add this first row for the horse
          raceFormData[currentHorse].push({
            date: row[1] || '',
            colC: row[2] || '',
            colD: row[3] || '',
            colE: row[4] || '',
            colG: row[6] || '',
            colH: row[7] || '',
            colI: row[8] || ''
          });
        } else if (currentHorse !== '' && row[1] && row[1].trim() !== '') {
          // Subsequent rows for the same horse
          raceFormData[currentHorse].push({
            date: row[1] || '',
            colC: row[2] || '',
            colD: row[3] || '',
            colE: row[4] || '',
            colG: row[6] || '',
            colH: row[7] || '',
            colI: row[8] || ''
          });
        }
      }
    }
  });
}


// ==============================
// Load Racecard and Build Dropdown
// ==============================
function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard2.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const dataWithoutHeader = results.data.slice(1).filter(row => row && row.length > 0);
      if (!dataWithoutHeader || dataWithoutHeader.length === 0) return;

      const raceRows = dataWithoutHeader;
      buildMasterMaps(raceRows);

      const courseMap = {};
      raceRows.forEach(row => {
        const course = (row[0] || '').trim();
        if (!course) return;

        const raceTime = (row[2] || '').trim();
        if (!raceTime) return;

        const raceKey = `${raceTime}  ${course}`;

        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);
      });

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
          const timeOnly = raceKey.split('  ')[0];
          const timeSpan = document.createElement('span');
          timeSpan.className = 'race-time';
          timeSpan.textContent = timeOnly;
          timeSpan.setAttribute('data-race-key', raceKey);

          const activeRace = localStorage.getItem('activeRace');
          if (activeRace === raceKey) {
            timeSpan.classList.add('selected-race');
          }

          if (timeOnly.toLowerCase() === "off_time") {
            timeSpan.style.pointerEvents = "none";
            timeSpan.style.userSelect = "none";
            timeSpan.style.fontWeight = "bold";
            timeSpan.style.cursor = "default";
          } else {
            timeSpan.addEventListener('click', () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.querySelectorAll('#race-dropdown .race-time').forEach(t => t.classList.remove('selected-race'));
              timeSpan.classList.add('selected-race');

              displayRace(courseMap[course][raceKey], raceKey);
              localStorage.setItem('activeRace', raceKey);

              dropdown.classList.remove('open');
              updateRaceArrow();
            });
          }

          courseRow.appendChild(timeSpan);
          courseRow.appendChild(document.createTextNode(' '));
        });

        dropdown.appendChild(courseRow);
      });
    }
  });
}

function updateRaceArrow() {
  const raceTab = document.querySelector('.tab[data-tab="races"]');
  const arrow = raceTab.querySelector('.arrow');
  if (!arrow) return;

  const dropdown = document.getElementById('race-dropdown');

  if (dropdown.classList.contains('open')) {
    arrow.classList.add('open');
  } else {
    arrow.classList.remove('open');
  }

  if (dropdown.classList.contains('open')) {
    raceTab.classList.add('active');
  } else {
    raceTab.classList.remove('active');
  }
}

// ==============================
// Clean CSV cell (for column J like ="9-6")
// Clean column J value
// Clean Excel CSV-style weight
function cleanWeight(value) {
  if (!value) return '';
  // Remove leading =' and trailing '
  if (value.startsWith("='") && value.endsWith("'")) {
    return value.slice(2, -1);
  }
  return value;
}

// ==============================
// Create Race Form Table with column 3 fixed
function createRaceFormTable(horseName) {
  const formData = raceFormData[horseName] || [];
  if (formData.length === 0) {
    return '<div>No race form data available</div>';
  }

  let html = '<table class="race-form-table"><thead><tr>';
  html += '<th>日期</th>';
  html += '<th>賽事資料</th>';
  html += '<th>重量</th>';
  html += '<th>賽果</th>';
  html += '<th>騎師</th>';
  html += '<th>OR</th>';
  html += '<th>TS</th>';
  html += '<th>RPR</th>';
  html += '</tr></thead><tbody>';

  formData.slice(0, 6).forEach(race => {
    // Format date
    let formattedDate = race.date || '';

    // Column 2 → merged data as before
    const merged = [race.colC, race.colH, race.colI, race.colD, race.colE]
      .filter(x => x && x.toString().trim() !== '')
      .join(' ');

    // Column 3 → weight from colJ
    const weight = cleanWeight(race.colJ);

    html += `<tr>
      <td>${formattedDate}</td>
      <td>${merged}</td>
      <td>${weight}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>`;
  });

  html += '</tbody></table>';
  return html;
}




// ==============================
// Display Race Table
// ==============================
function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  raceDetails.innerHTML = '';
  const raceData = raceRows[0];
  const distance = raceData[4] || 'N/A';
  const raceClass = raceData[6] || 'N/A';
  const going = raceData[12] || 'N/A';
  const raceName = raceData[3] || '';
  const rawPrize = raceData[10] || '';
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

  const headerRow = document.createElement('tr');
  ['號碼(檔位)', '', '馬名/資訊', '年齡', '近戰績', '隔夜', '最近', '練馬師', '騎師', '繁育者'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const horseRows = raceRows.filter(row => {
    const horseNumber = row[32];
    return horseNumber && horseNumber.toString().trim() !== '' &&
      horseNumber.toString().trim() !== 'Jockey' &&
      horseNumber.toString().trim() !== 'Trainer';
  });

  horseRows.forEach((row, index) => {
    const horseNumber = row[32] || '';
    const draw = row[33] || '';
    const horseName = row[20] || '';
    const age = row[22] || '';
    const form = row[43] || '';
    const owner = row[31] || '';
    const sire = row[27] || '';
    const dam = row[28] || '';
    const damsire = row[29] || '';
    const silkUrl = row[41] || '';
    const lastRun = row[42] || '';
    const gender = row[23] || '';
    const color = row[24] || '';
    const nationality = row[25] || '';
    const trainer = row[30] || '';
    const jockey = row[40] || '';
    const rating = row[26] || '';
    const lastnightOdds = row[51] || '-';
    const nowOdds = row[52] || '-';

    const jockeyData = masterJockeyMap[jockey] || { raceCount: '0', races: [] };
    const trainerData = masterTrainerMap[trainer] || { raceCount: '0', races: [] };

    const horseRow = document.createElement('tr');
    horseRow.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';

    const col1 = document.createElement('td');
    col1.innerHTML = `<div style="font-weight:bold">${horseNumber} (${draw})</div><div>${form}</div>`;
    horseRow.appendChild(col1);

    const silkCell = document.createElement('td');
    silkCell.innerHTML = silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : '';
    horseRow.appendChild(silkCell);

    const infoCell = document.createElement('td');
    infoCell.innerHTML = `<div>${horseName}</div><div>${lastRun} 天</div><div>${gender} | ${color} | ${nationality}</div>`;
    horseRow.appendChild(infoCell);

    const ageCell = document.createElement('td');
    ageCell.innerHTML = `<div>${age}</div><div>騎師: ${jockeyData.raceCount}</div><div>練馬師: ${trainerData.raceCount}</div>`;
    horseRow.appendChild(ageCell);

    const formCell = document.createElement('td');
    formCell.innerHTML = `<div>${form}</div>`;
    horseRow.appendChild(formCell);

    const lastNightOddsCell = document.createElement('td');
    lastNightOddsCell.innerHTML = `<div>${lastnightOdds}</div>`;
    horseRow.appendChild(lastNightOddsCell);

    const nowOddsCell = document.createElement('td');
    nowOddsCell.innerHTML = `<div>${nowOdds}</div>`;
    horseRow.appendChild(nowOddsCell);

    const trainerCell = document.createElement('td');
    trainerCell.innerHTML = `<div>${trainer}</div>`;
    horseRow.appendChild(trainerCell);

    const jockeyCell = document.createElement('td');
    jockeyCell.innerHTML = `<div>${jockey}</div>`;
    horseRow.appendChild(jockeyCell);

    const ratingCell = document.createElement('td');
    ratingCell.innerHTML = `<div>${rating}</div>`;
    horseRow.appendChild(ratingCell);

    table.appendChild(horseRow);

    const detailsRow = document.createElement('tr');
    detailsRow.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 10;
    detailsCell.style.textAlign = 'left';
    detailsCell.style.padding = '8px';

    // NOTE: removed per-horse toggle button (as requested), kept the container
    detailsCell.innerHTML = `
      <div>馬主: ${owner}</div>
      <div>父 ${sire} - 母 ${dam} (母父 ${damsire})</div>
      <div id="race-form-${index}" class="race-form-container" data-horse="${horseName}" style="display:none; margin-top:8px;"></div>
    `;

    detailsRow.appendChild(detailsCell);
    table.appendChild(detailsRow);
  });

  raceDetails.appendChild(table);

  // ONE global toggle button under the first horse
  const firstDetailsCell = document.querySelector('#race-form-0')?.parentNode;
  if (firstDetailsCell) {
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = "顯示/隱藏 賽績表";
    toggleBtn.className = "toggle-all-race-form";
    toggleBtn.style.marginTop = "8px";

    firstDetailsCell.insertBefore(toggleBtn, firstDetailsCell.firstChild);

    toggleBtn.addEventListener('click', function () {
      const containers = document.querySelectorAll('.race-form-container');

      // If any is hidden, we will show all; else hide all
      const anyHidden = Array.from(containers).some(c => c.style.display === 'none');

      containers.forEach(c => {
        // Lazy-fill content the first time we show it
        if (anyHidden && (!c.innerHTML || c.innerHTML.trim() === '')) {
          const horseName = c.getAttribute('data-horse') || '';
          c.innerHTML = createRaceFormTable(horseName);
        }
        c.style.display = anyHidden ? 'block' : 'none';
      });

      toggleBtn.textContent = anyHidden ? "顯示/隱藏 賽績表 ✔" : "顯示/隱藏 賽績表";
    });
  }
}


// ==============================
// Load Drop Odds
// ==============================
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
          row['Horse Name'] !== 'Horse Name' &&
          row['NOW'] && row['NOW'] !== ''
        );

      data.sort((a, b) =>
        a['Time'].localeCompare(b['Time'], undefined, { numeric: true, sensitivity: 'base' })
      );

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

        tableHTML += `
          <tr>
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
          </tr>
        `;
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

// ==============================
// Tab Switching & Auto Refresh
// ==============================
document.addEventListener('DOMContentLoaded', function () {
  // Load race form data on page load
  loadRaceFormData();

  const raceTab = document.querySelector('.tab-bar .tab[data-tab="races"]');
  const dropsTab = document.querySelector('.tab-bar .tab[data-tab="drops"]');
  const resultsTab = document.querySelector('.tab-bar .tab[data-tab="results"]');
  const dropdown = document.getElementById('race-dropdown');
  const raceDetails = document.getElementById('race-details');
  const dropOddsDiv = document.getElementById('drop-odds');

  dropdown.classList.remove('open');
  updateRaceArrow();

  raceTab.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    updateRaceArrow();
  });

  document.addEventListener('click', (e) => {
    if (!raceTab.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      updateRaceArrow();
    }
  });

  [dropsTab, resultsTab].forEach(tab => {
    tab.addEventListener('click', () => {
      dropdown.classList.remove('open');
      updateRaceArrow();
    });
  });

  const tabs = document.querySelectorAll('.tab-bar .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const activeTabName = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (activeTabName === 'drops') {
        raceDetails.style.display = 'none';
        dropOddsDiv.style.display = 'block';
        loadDropOdds();
      } else if (activeTabName === 'results') {
        raceDetails.style.display = 'none';
        dropOddsDiv.style.display = 'none';
      } else {
        raceDetails.style.display = 'block';
        dropOddsDiv.style.display = 'none';
        if (typeof loadRacecard === 'function') loadRacecard();
      }

      localStorage.setItem('activeTab', activeTabName);
    });
  });

  const savedTab = localStorage.getItem('activeTab') || 'races';
  document.querySelector(`.tab-bar .tab[data-tab="${savedTab}"]`)?.click();

  setInterval(() => {
    const activeTab = localStorage.getItem('activeTab') || 'races';
    if (activeTab === 'races') loadRacecard();
    else if (activeTab === 'drops') loadDropOdds();
  }, 30000);
});


