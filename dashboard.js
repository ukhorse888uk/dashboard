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
// ==============================
// Load Racecard and Build Dropdown
function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard2.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {

      // --- Skip CSV header row immediately ---
      const dataWithoutHeader = results.data.slice(1).filter(row => row && row.length > 0);
      if (!dataWithoutHeader || dataWithoutHeader.length === 0) return;

      const raceRows = dataWithoutHeader; // row 0 (header) is skipped
      buildMasterMaps(raceRows);

      // Group races by course
      const courseMap = {};
      raceRows.forEach(row => {
        const course = (row[0] || '').trim(); // Column A
        if (!course) return;

        const raceTime = (row[2] || '').trim(); // Column C
        if (!raceTime) return;

        const raceKey = `${raceTime}  ${course}`;

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
          const timeOnly = raceKey.split('  ')[0]; // first part = time
          const timeSpan = document.createElement('span');
          timeSpan.className = 'race-time';
          timeSpan.textContent = timeOnly;
          timeSpan.setAttribute('data-race-key', raceKey);

          // --- Make off_time non-clickable and unselectable ---
          if (timeOnly.toLowerCase() === "off_time") {
            timeSpan.style.pointerEvents = "none";    // disable click
            timeSpan.style.userSelect = "none";       // disable text selection
            timeSpan.style.fontWeight = "bold";       // optional styling
            timeSpan.style.cursor = "default";        // optional: normal cursor
          } else {
            // Click handler for race times
            timeSpan.addEventListener('click', () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });

              document.querySelectorAll('#race-dropdown .race-time').forEach(t => t.classList.remove('active'));
              timeSpan.classList.add('active');

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


// ==============================
// Display Race Table
// ==============================
// Display Race Table (UPDATED FOR 9-COLUMN LAYOUT)
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

  // Create table header with 10 columns now (added silk column)
  const headerRow = document.createElement('tr');
  ['號碼(檔位)', '', '馬名/資訊', '年齡', '近戰績', '隔夜', '最近', '練馬師', '騎師', '評分'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const horseRows = raceRows.filter(row => {
    const horseNumber = row[32]; // Column AG
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

    // Column 1: Horse number, form, owner and pedigree
    const col1 = document.createElement('td');
    col1.innerHTML = `
      <div style="font-weight:bold">${horseNumber} (${draw})</div>
      <div>${form}</div>
    `;
    horseRow.appendChild(col1);

    // Column 2: Silk (standalone column)
    const silkCell = document.createElement('td');
    silkCell.innerHTML = silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : '';
    horseRow.appendChild(silkCell);

    // Column 3: Horse name, last run, gender, color, nationality
    const infoCell = document.createElement('td');
    infoCell.innerHTML = `
      <div>${horseName}</div>
      <div>${lastRun} 天</div>
      <div>${gender} | ${color} | ${nationality}</div>
    `;
    horseRow.appendChild(infoCell);

    // Column 4: Age and stats
    const ageCell = document.createElement('td');
    ageCell.innerHTML = `
      <div>${age}</div>
      <div>騎師: ${jockeyData.raceCount}</div>
      <div>練馬師: ${trainerData.raceCount}</div>
    `;
    horseRow.appendChild(ageCell);

    // Column 5: Form (duplicate)
    const formCell = document.createElement('td');
    formCell.innerHTML = `<div>${form}</div>`;
    horseRow.appendChild(formCell);

    // Column 6: Last Night Odds
    const lastNightOddsCell = document.createElement('td');
    lastNightOddsCell.innerHTML = `<div>${lastnightOdds}</div>`;
    horseRow.appendChild(lastNightOddsCell);

    // Column 7: Now Odds
    const nowOddsCell = document.createElement('td');
    nowOddsCell.innerHTML = `<div>${nowOdds}</div>`;
    horseRow.appendChild(nowOddsCell);

    // Column 8: Trainer
    const trainerCell = document.createElement('td');
    trainerCell.innerHTML = `<div>${trainer}</div>`;
    horseRow.appendChild(trainerCell);

    // Column 9: Jockey
    const jockeyCell = document.createElement('td');
    jockeyCell.innerHTML = `<div>${jockey}</div>`;
    horseRow.appendChild(jockeyCell);

    // Column 10: Rating
    const ratingCell = document.createElement('td');
    ratingCell.innerHTML = `<div>${rating}</div>`;
    horseRow.appendChild(ratingCell);

    table.appendChild(horseRow);

    // Second row for owner and pedigree that spans columns 1-2
    const detailsRow = document.createElement('tr');
    detailsRow.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';

    // Owner and pedigree info that spans columns 1-2 (will expand to column 2 if needed)
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 5; // This spans both column 1 and 2
    detailsCell.style.textAlign = 'left';
    detailsCell.innerHTML = `
      <div>馬主: ${owner}</div>
      <div>父 ${sire} - 母 ${dam} (母父 ${damsire})</div>
    `;
    detailsRow.appendChild(detailsCell);

    // Add empty cells for the rest of the columns to maintain table structure
    for (let i = 0; i < 8; i++) {
      const emptyCell = document.createElement('td');
      detailsRow.appendChild(emptyCell);
    }

    table.appendChild(detailsRow);
  });

  raceDetails.appendChild(table);










  // Pill click events
  setTimeout(() => {
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
                const jockeyCell = r.querySelector('td:nth-child(3) .jockey-badge');
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
    if (currentRaceNumber !== undefined) {
      document.querySelectorAll(`.race-pill[data-number="${currentRaceNumber}"]`).forEach(pill => {
        const isCurrent = true;
        pill.classList.add('disabled-pill', isCurrent ? 'gold' : 'green');
      });
    }
  }, 0);
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

      // Trim keys and values, filter out invalid rows
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
          row['Horse Name'] !== 'Horse Name' // remove accidental header rows
        );

      // Sort by Time
      data.sort((a, b) => a['Time'].localeCompare(b['Time'], undefined, { numeric: true, sensitivity: 'base' }));

      if (data.length === 0) {
        container.innerHTML = '<div class="error">沒有有效馬匹數據</div>';
        return;
      }

      // Build table
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


// ===== Tab Switching and Auto Refresh =====
document.addEventListener('DOMContentLoaded', function () {
  const raceTab = document.querySelector('.tab-bar .tab[data-tab="races"]');
  const dropsTab = document.querySelector('.tab-bar .tab[data-tab="drops"]');
  const resultsTab = document.querySelector('.tab-bar .tab[data-tab="results"]');
  const arrow = raceTab.querySelector('.arrow');
  const dropdown = document.getElementById('race-dropdown');
  const raceDetails = document.getElementById('race-details');
  const dropOddsDiv = document.getElementById('drop-odds');

  // --- Initialize race dropdown ---
  dropdown.classList.remove('open');
  updateRaceArrow();

  raceTab.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    updateRaceArrow();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!raceTab.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      updateRaceArrow();
    }
  });

  // Close dropdown when switching to other tabs
  [dropsTab, resultsTab].forEach(tab => {
    tab.addEventListener('click', () => {
      dropdown.classList.remove('open');
      updateRaceArrow();
    });
  });

  // --- Tab switching logic ---
  const tabs = document.querySelectorAll('.tab-bar .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const activeTab = tab.dataset.tab;
      localStorage.setItem('activeTab', activeTab);

      if (activeTab === 'drops') {
        raceDetails.style.display = 'none';
        dropOddsDiv.style.display = 'block';
        loadDropOdds();
      } else {
        raceDetails.style.display = 'block';
        dropOddsDiv.style.display = 'none';
        if (typeof loadRacecard === 'function') loadRacecard();
      }
    });
  });

  // --- Load the saved tab initially ---
  const savedTab = localStorage.getItem('activeTab') || 'races';
  document.querySelector(`.tab-bar .tab[data-tab="${savedTab}"]`)?.click();

  // --- Auto-refresh ---
  setInterval(() => {
    const activeTab = localStorage.getItem('activeTab') || 'races';
    if (activeTab === 'races') loadRacecard();
    else if (activeTab === 'drops') loadDropOdds();
  }, 30000);
});


// Arrow update function
function updateRaceArrow() {
  const raceTab = document.querySelector('.tab-bar .tab[data-tab="races"] .arrow');
  const dropdown = document.getElementById('race-dropdown');
  if (raceTab && dropdown) {
    if (dropdown.classList.contains('open')) raceTab.classList.add('open');
    else raceTab.classList.remove('open');
  }
}

document.addEventListener("DOMContentLoaded", () => {

  const raceTable = document.querySelector('.race-table tbody');
  if (!raceTable) return;

  const horseRows = Array.from(raceTable.querySelectorAll('tr'));

  horseRows.forEach(tr => {
    // Build a simple subtable
    let html = '<table class="subtable">';
    html += `
      <tr>
        <th>Col1</th>
        <th>Col2</th>
        <th>Col3</th>
      </tr>
      <tr>
        <td>Data 1</td>
        <td>Data 2</td>
        <td>Data 3</td>
      </tr>
      <tr>
        <td>Data 4</td>
        <td>Data 5</td>
        <td>Data 6</td>
      </tr>
    `;
    html += '</table>';

    // Insert as a new row under the horse row
    const subRow = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = tr.children.length;
    td.innerHTML = html;
    subRow.appendChild(td);

    tr.parentNode.insertBefore(subRow, tr.nextSibling);
  });

});


