let activeTab = localStorage.getItem('activeTab') || 'races';
let masterJockeyMap = {};
let masterTrainerMap = {};
let raceNumberMap = {}; // Maps race keys to assigned numbers
let raceFormData = {}; // Store race form data by horse name
let scrollPosition = 0; // Store scroll position
let raceFormVisibilityState = {}; // 添加全局变量来保存赛绩表可见性状态

function buildMasterMaps(data) {
  masterJockeyMap = {};
  masterTrainerMap = {};

  data.forEach(row => {
    const jockeyName = row[63] || '';
    const jockeyCount = row[64] || '0';
    if (jockeyName && jockeyName.trim() !== '' && jockeyName.trim().toUpperCase() !== 'NON-RUNNER') {
      const jockeyRaces = row.slice(65, 76)
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

    const trainerName = row[76] || '';
    const trainerCount = row[77] || '0';
    if (trainerName && trainerName.trim() !== '' && trainerName.trim().toUpperCase() !== 'NON-RUNNER') {
      masterTrainerMap[trainerName.trim()] = { raceCount: trainerCount };
    }
  });
}

// ==============================
// Persistent Race Form Toggle
// ==============================
const raceDetails = document.getElementById('race-details');

// Load persisted state from localStorage
let showRaceForm = localStorage.getItem('showRaceForm') === 'true';

// Ensure the race form shows if previously chosen
updateRaceFormDisplay();

function updateRaceFormDisplay() {
  if (showRaceForm) {
    raceDetails.style.display = 'block';
  } else {
    raceDetails.style.display = 'none';
  }
}

// Function to toggle the race form visibility
window.toggleRaceForm = function () {
  showRaceForm = !showRaceForm;
  localStorage.setItem('showRaceForm', showRaceForm);
  updateRaceFormDisplay();
};

// ==============================
// Load Racecard and Build Dropdown
// ==============================
function loadRacecard() {
  // Save scroll position before refresh
  scrollPosition = window.scrollY || document.documentElement.scrollTop;

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

      // Preserve active race key
      const activeRaceKey = localStorage.getItem('activeRace');

      // Clear dropdown but rebuild DOM nodes directly
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

          if (activeRaceKey === raceKey) {
            timeSpan.classList.add('selected-race');
          }

          if (timeOnly.toLowerCase() !== "off_time") {
            timeSpan.addEventListener('click', () => {
              document.querySelectorAll('#race-dropdown .race-time').forEach(t => t.classList.remove('selected-race'));
              timeSpan.classList.add('selected-race');

              displayRace(courseMap[course][raceKey], raceKey);
              localStorage.setItem('activeRace', raceKey);

              dropdown.classList.remove('open');
              updateRaceArrow();

              if (showRaceForm) {
                document.querySelectorAll('.race-form-container').forEach(c => c.style.display = 'block');
              }
            });
          }

          courseRow.appendChild(timeSpan);
          courseRow.appendChild(document.createTextNode(' '));
        });

        dropdown.appendChild(courseRow);
      });

      if (activeRaceKey) {
        Object.keys(courseMap).forEach(course => {
          if (courseMap[course][activeRaceKey]) {
            displayRace(courseMap[course][activeRaceKey], activeRaceKey);
          }
        });
      }

      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);
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

function loadRaceFormData() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/raceform2.csv?cb=" + Date.now(), {
    download: true,
    encoding: "UTF-8",
    complete: function (results) {
      const data = results.data;
      if (!data || data.length === 0) return;

      raceFormData = {};
      let currentHorse = '';

      for (let i = 1; i < data.length; i++) {
        const row = data[i];

        const horseName = row[0] ? row[0].trim() : '';

        const raceEntry = {
          date: row[1] || '',
          colC: row[2] || '',
          colD: row[3] || '',
          colE: row[4] || '',
          colG: row[6] || '',
          colH: row[7] || '',
          colI: row[8] || '',
          colJ: row[9] || '',
          colK: row[10] || '',
          colL: row[11] || '',
          colN: row[13] || '',
          colO: row[14] || '',
          colP: row[15] || '',
          colQ: row[16] || '',
          colX: row[23] || '',
          colZ: row[25] || '',
          colAA: row[26] || '',
          colAB: row[27] || ''
        };

        if (horseName !== '') {
          currentHorse = horseName;
          raceFormData[currentHorse] = [];
          raceFormData[currentHorse].push(raceEntry);
        } else if (currentHorse !== '') {
          raceFormData[currentHorse].push(raceEntry);
        }
      }
    }
  });
}

// Helper to replace invalid characters with '-'
function cleanText(str) {
  if (!str) return '';
  // replace any non-standard dash-like characters with a simple "-"
  return str.replace(/[^\x20-\x7E]/g, '-');
}

// ==============================
// New helper: Update all race form containers
// ==============================
function updateAllRaceForms() {
  document.querySelectorAll('.race-form-container').forEach(c => {
    const horseName = c.getAttribute('data-horse') || '';
    const horseId = c.getAttribute('data-horse-id');

    if (raceFormVisibilityState[horseId] === false) {
      c.style.display = 'none';
    } else {
      c.style.display = 'block';
      if (!c.innerHTML || c.innerHTML.trim() === '') {
        c.innerHTML = createRaceFormTable(horseName);
      }
      raceFormVisibilityState[horseId] = true; // persist state
    }
  });
}

// ==============================
// The rest of your existing code remains exactly the same...
// ==============================
function formatWeight(weightStr) {
  if (!weightStr) return '';

  // Case 1: Already in "9-4" style
  if (weightStr.includes('-')) {
    const parts = weightStr.split('-');
    if (parts.length === 2) {
      return `${parts[0]} st ${parts[1]} lb`;
    }
  }

  // Case 2: Pure number in pounds (e.g. "130")
  const lbs = parseInt(weightStr, 10);
  if (!isNaN(lbs)) {
    const stones = Math.floor(lbs / 14);
    const pounds = lbs % 14;
    return `${stones} st ${pounds} lb`;
  }

  return weightStr; // fallback
}


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
    // Column 1 → format date mm/dd/yyyy → dd/mm/yyyy
    let formattedDate = '';
    if (race.date) {
      const parts = race.date.split('/');
      if (parts.length === 3) {
        formattedDate = `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
      } else {
        formattedDate = race.date; // fallback
      }
    }

    // Column 2 → merged info
    const merged = [race.colC, race.colH, race.colI, race.colD, race.colE]
      .filter(x => x && x.toString().trim() !== '')
      .map(cleanText)
      .join(' ');

    // Column 3 → weight
    const weight = cleanText(race.colJ || '');

    // Column 4 → your logic with K/L
    let col4 = '';
    if (race.colK === '1') {
      const kL = `${race.colK}/${race.colL}`;
      const qL = race.colQ ? race.colQ + 'L' : '';
      const p = race.colP || '';
      col4 = [kL, qL, p].filter(Boolean).map(cleanText).join(' ');
    } else {
      const kL = `${race.colK}/${race.colL}`;
      const nL = race.colN ? race.colN + 'L' : '';
      const o = race.colO || '';
      col4 = [kL, nL, o].filter(Boolean).map(cleanText).join(' ');
    }

    // Columns 5–8
    const col5 = cleanText(race.colX);
    const col6 = cleanText(race.colZ);
    const col7 = cleanText(race.colAB);
    const col8 = cleanText(race.colAA);

    html += `<tr>
      <td>${formattedDate}</td>
      <td>${merged}</td>
      <td>${weight}</td>
      <td>${col4}</td>
      <td>${col5}</td>
      <td>${col6}</td>
      <td>${col7}</td>
      <td>${col8}</td>
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

  if (!raceRows || raceRows.length === 0) return;

  const raceData = raceRows[0];
  const distance = raceData[4] || 'N/A';
  const raceClass = raceData[6] || 'N/A';
  const going = raceData[12] || 'N/A';
  const raceName = raceData[3] || '';
  const rawPrize = raceData[10] || '';
  const prizeValue = rawPrize.replace(/[^0-9]/g, '');
  const formattedPrize = prizeValue ? `£${parseInt(prizeValue).toLocaleString()}` : 'N/A';

  // Format race date dd/mm/yyyy
  let formattedDate = '';
  const rawDate = raceData[1] || '';
  if (rawDate) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      formattedDate = `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
    } else {
      formattedDate = rawDate;
    }
  }

  // Race header
  const raceHeader = document.createElement('div');
  raceHeader.className = 'race-header';
  raceHeader.innerHTML = `
    <div class="race-title">${raceKey} ${formattedDate ? `(${formattedDate})` : ''}</div>
    <div class="race-meta">
      <span>距離: ${distance} Furlong </span>
      <span>班數: ${raceClass}</span>
      <span>地質: ${going}</span>
      <span>獎金: ${formattedPrize}</span>
    </div>
    ${raceName ? `<div class="race-name">${raceName}</div>` : ''}
  `;
  raceDetails.appendChild(raceHeader);

  // Main race table
  const table = document.createElement('table');
  table.className = 'race-table';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['號碼(檔位)', '', '馬名/資訊', '年齡', '重量', '騎師', '練馬師', '隔夜', '最近'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Filter valid horse rows
  const horseRows = raceRows.filter(row => {
    const horseNumber = row[32];
    return horseNumber && horseNumber.toString().trim() !== '' &&
      horseNumber.toString().trim() !== 'Jockey' &&
      horseNumber.toString().trim() !== 'Trainer';
  });

  // Mapping for Chinese translations
  const genderMap = { 'horse': '雄馬', 'mare': '母馬', 'gelding': '閹馬', 'colt': '小雄駒', 'filly': '小雌馬' };
  const colorMap = { 'b': '棗色', 'ch': '栗色', 'gr': '灰色', 'bl': '黑色', 'br': '棕色', 'ro': '雜色' };
  const nationalityMap = { 'GB': '英國', 'IRE': '愛爾蘭', 'FR': '法國', 'HK': '香港' };

  horseRows.forEach((row, index) => {
    const horseNumber = row[32] || '';
    const draw = row[33] || '';
    const horseName = row[20] || '';
    const age = row[22] || '';
    const form = row[43] || '';
    const owner = row[31] || '';
    const sire = row[28] || '';
    const dam = row[27] || '';
    const damsire = row[29] || '';
    const silkUrl = row[41] || '';
    const lastRun = row[42] || '';
    const gender = row[23] || '';
    const color = row[24] || '';
    const nationality = row[25] || '';
    const trainer = row[30] || '';
    const jockey = row[40] || '';
    const weights = row[34] || '';
    const lastnightOdds = row[51] || '-';
    const nowOdds = row[52] || '-';
    const region = row[45] || '';     // AT
    const reach14 = row[44] || '';    // AS
    const runs14 = row[46] || '';     // AU
    const wins14 = row[47] || '';     // AV

    // Calculate win percentage (防止除以零)
    let winPct = '-';
    if (runs14 && !isNaN(runs14) && runs14 !== '0') {
      winPct = ((parseInt(wins14, 10) / parseInt(runs14, 10)) * 100).toFixed(1) + '%';
    }

    const jockeyData = masterJockeyMap[jockey] || { raceCount: '0', races: [] };
    const trainerData = masterTrainerMap[trainer] || { raceCount: '0', races: [] };

    // ===== Horse row
    const horseRow = document.createElement('tr');
    horseRow.style.backgroundColor = 'white';

    // Column 1: Horse Number + Draw + Form
    const col1 = document.createElement('td');
    const drawDisplay = (draw && draw !== '0') ? `(${draw})` : '';
    col1.innerHTML = `<div class="horse-num-draw">${horseNumber} ${drawDisplay}</div>最近戰績<div>${form}</div>`;
    horseRow.appendChild(col1);

    // Column 2: Silk
    const col2 = document.createElement('td');
    col2.innerHTML = silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : '';
    horseRow.appendChild(col2);

    // ===== Column 3: Horse Name + Gender / Color / Nationality (multi-line)
    const infoCell = document.createElement('td');

    // Translate gender, color, nationality
    const genderCN = genderMap[gender] || gender;
    const colorCN = colorMap[color] || color;
    const nationalityCN = nationalityMap[nationality] || nationality;

    // Format lastRun properly
    let lastRunDisplay = '-';
    if (lastRun) {
      const match = lastRun.match(/^(\d+)\s*\(?(\d+)?([A-Z])?\)?$/i);
      if (match) {
        const mainDays = match[1];
        const otherDays = match[2];
        const letter = match[3];
        if (otherDays && letter && letter.toUpperCase() === 'F') {
          lastRunDisplay = `${mainDays} 天前同類 <br>（${otherDays} 天前不同類賽事）`;
        } else {
          lastRunDisplay = `${mainDays} 天前`;
          if (otherDays && letter) lastRunDisplay += ` (${otherDays}${letter})`;
        }
      } else {
        lastRunDisplay = `${lastRun}天前`;
      }
    }

    // Apply proper CSS classes
    infoCell.innerHTML = `
  <div class="horse-name">${horseName}</div>
  <div class="last-run">
    上次出賽 <span class="last-run-number">${lastRunDisplay}</span>
  </div>
  <div>${genderCN} | ${colorCN} | ${nationalityCN}</div>
`;

    horseRow.appendChild(infoCell);


    // Column 4: Age
    const col4 = document.createElement('td');
    col4.textContent = age;
    horseRow.appendChild(col4);

    // Column 5: Weight
    const col5 = document.createElement('td');
    col5.textContent = formatWeight(weights);
    horseRow.appendChild(col5);

    // Column 6: Jockey (with race count)
    const col6 = document.createElement('td');
    col6.innerHTML = `
  <div>${jockey}</div>
  <div>今日騎師策騎: ${jockeyData.raceCount} 匹</div>
`;
    horseRow.appendChild(col6);

    // Column 7: Trainer (with race count + extra rows)
    const col7 = document.createElement('td');
    col7.innerHTML = `
  <div>${trainer}</div>
  <div>今日練馬師出賽: ${trainerData.raceCount}匹</div>
  <div>過去14天：</div>
  <div>達標: ${reach14}%</div>
  <div>參賽: ${runs14}匹  勝出: ${wins14}匹  勝出%: ${winPct}</div>
  <div>地區: ${region}</div>
`;
    horseRow.appendChild(col7);

    // Column 8: Last night odds
    const col8 = document.createElement('td');
    col8.textContent = lastnightOdds;
    horseRow.appendChild(col8);

    // Column 9: Now odds
    const col9 = document.createElement('td');
    col9.textContent = nowOdds;
    horseRow.appendChild(col9);


    table.appendChild(horseRow);

    // ===== Always show race form directly
    const formRow = document.createElement('tr');
    const formCell = document.createElement('td');
    formCell.colSpan = 9;
    formCell.style.padding = '8px';
    formCell.innerHTML = `
      <div>馬主: ${owner}</div>
      <div>父系 ${sire} - 母系 ${dam} (外祖父 ${damsire})</div>
      ${createRaceFormTable(horseName)}
    `;
    formRow.appendChild(formCell);
    table.appendChild(formRow);
  });

  raceDetails.appendChild(table);
}

// ==============================
// Load Drop Odds
// ==============================
function loadDropOdds() {
  const container = document.getElementById("drop-odds-container");

  // Save scroll position before refresh
  scrollPosition = window.scrollY || document.documentElement.scrollTop;

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

      // Restore scroll position after table is rendered
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);
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
// ==============================
// Tab Switching & Auto Refresh
// ==============================
document.addEventListener('DOMContentLoaded', function () {
  // 加载赛绩表可见性状态
  const savedVisibilityState = localStorage.getItem('raceFormVisibilityState');
  if (savedVisibilityState) {
    raceFormVisibilityState = JSON.parse(savedVisibilityState);
  }

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

      if (showRaceForm) {
        document.querySelectorAll('.race-form-container').forEach(c => c.style.display = 'block');
      }
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

        if (showRaceForm) {
          document.querySelectorAll('.race-form-container').forEach(c => {
            c.style.display = 'block';
            if (!c.innerHTML || c.innerHTML.trim() === '') {
              const horseName = c.getAttribute('data-horse') || '';
              c.innerHTML = createRaceFormTable(horseName);
            }
          });
        }
      } else if (activeTabName === 'results') {
        raceDetails.style.display = 'none';
        dropOddsDiv.style.display = 'none';
      } else {
        raceDetails.style.display = 'block';
        dropOddsDiv.style.display = 'none';
        if (typeof loadRacecard === 'function') loadRacecard();

        if (showRaceForm) {
          document.querySelectorAll('.race-form-container').forEach(c => {
            c.style.display = 'block';
            if (!c.innerHTML || c.innerHTML.trim() === '') {
              const horseName = c.getAttribute('data-horse') || '';
              c.innerHTML = createRaceFormTable(horseName);
            }
          });
        }
      }

      localStorage.setItem('activeTab', activeTabName);
    });
  });

  const savedTab = localStorage.getItem('activeTab') || 'races';
  document.querySelector(`.tab-bar .tab[data-tab="${savedTab}"]`)?.click();

  // ✅ Removed the 30-second interval here
});

// Save scroll position before page refresh
window.addEventListener('beforeunload', function () {
  localStorage.setItem('scrollPosition', window.scrollY || document.documentElement.scrollTop);
});

// Restore scroll position on page load
window.addEventListener('load', function () {
  const savedPosition = localStorage.getItem('scrollPosition');
  if (savedPosition) {
    setTimeout(() => {
      window.scrollTo(0, parseInt(savedPosition));
    }, 0);
  }
});

// ==============================
// 10-minute refresh
setInterval(() => {
  const activeTab = localStorage.getItem('activeTab') || 'races';
  if (activeTab === 'races') {
    loadRacecard();
    loadRaceFormData();
  } else if (activeTab === 'drops') {
    loadDropOdds();
  }
}, 600000); // every 10 minutes
