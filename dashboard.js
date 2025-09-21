let activeTab = localStorage.getItem('activeTab') || 'races';
let masterJockeyMap = {};
let masterTrainerMap = {};
let raceNumberMap = {}; // Maps race keys to assigned numbers
let raceFormData = {}; // Store race form data by horse name
let scrollPosition = 0; // Store scroll position
let raceFormVisibilityState = {}; // 添加全局变量来保存赛绩表可见性状态

// --- No longer remove brackets, keep names exactly as in CSV ---
function cleanName(name) {
  return name ? name.trim() : '';
}

function buildMasterMaps(data) {
  masterJockeyMap = {};
  masterTrainerMap = {};

  data.forEach(row => {
    // --- Jockey ---
    let jockeyNameRaw = row[63] || ''; // BL
    const jockeyName = cleanName(jockeyNameRaw); // keep brackets
    const jockeyCount = row[64] || '0';

    if (jockeyName && jockeyName.toUpperCase() !== 'NON-RUNNER') {
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

      masterJockeyMap[jockeyName] = {
        raceCount: jockeyCount,
        races: jockeyRaces
      };
    }

    // --- Trainer ---
    let trainerNameRaw = row[76] || ''; // BY
    const trainerName = cleanName(trainerNameRaw); // keep brackets
    const trainerCount = row[77] || '0';

    if (trainerName && trainerName.toUpperCase() !== 'NON-RUNNER') {
      masterTrainerMap[trainerName] = { raceCount: trainerCount };
    }
  });
}

// --- Lookup functions ---
// If site names may still include brackets, you can remove brackets for matching
function getJockeyRaceCount(siteName) {
  const key = siteName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase(); // clean site name
  for (let name in masterJockeyMap) {
    if (name.toLowerCase().startsWith(key)) return masterJockeyMap[name].raceCount;
  }
  return 0;
}

function getTrainerRaceCount(siteName) {
  const key = siteName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
  for (let name in masterTrainerMap) {
    if (name.toLowerCase().startsWith(key)) return masterTrainerMap[name].raceCount;
  }
  return 0;
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
// ==============================
// Load Racecard
// ==============================
let globalRaceRows = {}; // raceKey → array of rows

function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard2.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      const dataWithoutHeader = results.data.slice(1).filter(row => row && row.length > 0);
      if (!dataWithoutHeader || dataWithoutHeader.length === 0) return;

      const raceRows = dataWithoutHeader;
      buildMasterMaps(raceRows);

      const courseMap = {};
      globalRaceRows = {}; // reset global

      raceRows.forEach(row => {
        const course = (row[0] || '').trim();
        if (!course) return;

        const raceTime = (row[2] || '').trim();
        if (!raceTime) return;

        const raceKey = `${raceTime}  ${course}`;
        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);

        // populate global
        globalRaceRows[raceKey] = courseMap[course][raceKey];
      });

      const dropdown = document.getElementById('race-dropdown');
      const activeRaceKey = localStorage.getItem('activeRace');

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

          if (activeRaceKey === raceKey) timeSpan.classList.add('selected-race');

          if (timeOnly.toLowerCase() !== "off_time") {
            timeSpan.addEventListener('click', () => {
              const scrollTop = window.scrollY || document.documentElement.scrollTop;
              document.querySelectorAll('#race-dropdown .race-time').forEach(t => t.classList.remove('selected-race'));
              timeSpan.classList.add('selected-race');
              localStorage.setItem('activeRace', raceKey);
              displayRace(globalRaceRows[raceKey], raceKey);


              if (activeTab === 'races') {
                showCourseSubbar(course, courseMap);
              }

              dropdown.classList.remove('open');
              updateRaceArrow();
              if (showRaceForm) document.querySelectorAll('.race-form-container').forEach(c => c.style.display = 'block');
              setTimeout(() => window.scrollTo(0, scrollTop), 0);
            });
          }

          courseRow.appendChild(timeSpan);
          courseRow.appendChild(document.createTextNode(' '));
        });

        dropdown.appendChild(courseRow);
      });

      if (activeRaceKey) {
        const courseName = activeRaceKey.split('  ')[1];
        if (activeTab === 'races') {
          showCourseSubbar(courseName, courseMap);
        }
        if (courseMap[courseName][activeRaceKey]) {
          displayRace(courseMap[courseName][activeRaceKey], activeRaceKey);
        }
      }

      // --- Sub-bar ---
      function showCourseSubbar(courseName, courseMap) {
        if (!courseMap[courseName]) return; // no races for this course

        let subbar = document.getElementById('race-subbar-container');
        if (!subbar) {
          subbar = document.createElement('div');
          subbar.id = 'race-subbar-container';
          subbar.style.display = 'flex';
          subbar.style.alignItems = 'center';
          subbar.style.gap = '5px';
          subbar.style.margin = '10px 0';
          const wrapper = document.getElementById('race-details-wrapper');
          wrapper.insertBefore(subbar, wrapper.firstChild);
        }

        // Clear old buttons
        subbar.innerHTML = '';

        // Add course label
        const courseLabel = document.createElement('span');
        courseLabel.textContent = courseName;
        courseLabel.style.fontWeight = 'bold';
        courseLabel.style.marginRight = '10px';
        subbar.appendChild(courseLabel);

        // Loop through all races in this course
        Object.keys(courseMap[courseName])
          .sort()
          .forEach(raceKey => {
            const timeOnly = raceKey.split('  ')[0];
            if (!timeOnly || timeOnly.toLowerCase() === 'off_time') return;

            const btn = document.createElement('button');
            btn.textContent = timeOnly;
            btn.className = 'subbar-btn';
            if (raceKey === localStorage.getItem('activeRace')) btn.classList.add('active');

            btn.addEventListener('click', () => {
              const scrollTop = window.scrollY || document.documentElement.scrollTop;

              // Remove active from other buttons
              subbar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');

              // Set active race and display
              localStorage.setItem('activeRace', raceKey);
              displayRace(globalRaceRows[raceKey], raceKey);


              setTimeout(() => window.scrollTo(0, scrollTop), 0); // restore scroll
            });

            subbar.appendChild(btn);
          });

        subbar.style.display = 'flex';
      }
    }
  });
}












function decimalToFraction(decimal) {
  if (!decimal) return '';
  const tolerance = 1.0E-6;
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = decimal;
  do {
    const a = Math.floor(b);
    let temp = h1; h1 = a * h1 + h2; h2 = temp;
    temp = k1; k1 = a * k1 + k2; k2 = temp;
    b = 1 / (b - a);
  } while (Math.abs(decimal - h1 / k1) > decimal * tolerance);
  return h1 + '/' + k1;
}

function loadRaceFormData() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/raceform2.csv?cb=" + Date.now(), {
    download: true,
    encoding: "UTF-8",
    complete: function (results) {
      console.log('Race form CSV loaded:', results.data.length, 'rows');

      const data = results.data;
      if (!data || data.length === 0) {
        console.error('No race form data found');
        return;
      }

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
          colAB: row[27] || '',
          colT: row[19] || ''  // <<< added column T
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

  // If already in "X st Y lb" format
  const match = weightStr.match(/(\d+)\s*st\s*(\d+)\s*lb/i);
  if (match) {
    const stones = match[1];
    const pounds = match[2];
    return `${stones}-${pounds}`;
  }

  // Fallback: try parsing number as lbs
  const lbs = parseInt(weightStr, 10);
  if (!isNaN(lbs)) {
    const stones = Math.floor(lbs / 14);
    const pounds = lbs % 14;
    return `${stones}-${pounds}`;
  }

  return weightStr; // fallback if not recognized
}



function createRaceFormTable(horseName) {
  // Add this check at the beginning of the function
  if (Object.keys(raceFormData).length === 0) {
    return '<div class="loading-race-form">Race form data loading...</div>';
  }

  const formData = raceFormData[horseName] || [];
  if (formData.length === 0) {
    return '<div class="no-race-form">No race form data available for ' + horseName + '</div>';
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
    // Format date mm/dd/yyyy → dd/mm/yyyy
    let formattedDate = '';
    if (race.date) {
      const parts = race.date.split('/');
      if (parts.length === 3) {
        formattedDate = `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2].slice(-2)}`;
      } else {
        formattedDate = race.date;
      }
    }

    // Column 2 → merged info
    const merged = [race.colC, race.colH, race.colI, race.colD, race.colE]
      .filter(x => x && x.toString().trim() !== '')
      .map(cleanText)
      .join(' ');

    // Column 3 → weight
    const weight = formatWeight(race.colJ || '');

    // Column 4 → placing + (distance horseName weight) + column T as fraction
    const kL = `${race.colK}/${race.colL}`;

    function stripCountry(name) {
      return name ? name.replace(/\s*\([A-Z]{2,3}\)/g, '').trim() : '';
    }

    let details = '';
    if (race.colK === '1') {
      const qL = race.colQ ? race.colQ + 'L' : '';
      const p = stripCountry(race.colP_name || race.colP || '');
      const w = race.colP_weight || '';
      details = [qL, p, w].filter(Boolean).join(' ');
    } else {
      const nL = race.colN ? race.colN + 'L' : '';
      const o = stripCountry(race.colO_name || race.colO || '');
      const w = race.colO_weight || '';
      details = [nL, o, w].filter(Boolean).join(' ');
    }

    let col4 = details ? `${kL}(${details})` : kL;

    if (race.colT) {
      const fraction = decimalToFraction(parseFloat(race.colT) - 1);
      col4 += ' ' + fraction;
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



// 🔹 Attach once on page load to prevent auto-scroll
document.addEventListener('DOMContentLoaded', () => {
  const raceDetails = document.getElementById('race-details');
  raceDetails.addEventListener('mousedown', e => e.preventDefault());
});

function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  raceDetails.innerHTML = '';

  if (!raceRows || raceRows.length === 0) return;

  const raceData = raceRows[0];

  // --- Chinese Mapping ---
  const labelCN = {
    distance: '距離',
    class: '班數',
    going: '地質',
    prize: '獎金',
    furlong: 'F',
    runners: '參賽者',
    ground: '地質',
    surface: '地種'
  };

  // --- Country Translation ---
  const countryMap = { GB: '英國', IRE: '愛爾蘭', CAN: '加拿大', USA: '美國' };
  const country = raceData[5] || '';
  const translatedCountry = countryMap[country] || country;

  // --- Going Translation Map ---
  const goingMap = {
    "Firm": "快地",
    "Good To Firm": "好至快地",
    "Good": "好地",
    "Good To Yielding": "好至黏地",
    "Yield": "黏地",
    "Yield To Soft": "黏至軟地",
    "Soft": "軟地",
    "Heavy": "大爛地",
    "Good To Soft": "好至軟地"
  };

  // --- Class Translation ---
  const classMap = {
    "Class 1": "一班",
    "Class 2": "二班",
    "Class 3": "三班",
    "Class 4": "四班",
    "Class 5": "五班",
    "Class 6": "六班",
    "Class 7": "七班",
    "Class 8": "八班",
    "Class 9": "九班"
  };

  // --- Surface Translation ---
  const surfaceMap = {
    "Turf": "草地",
    "AW": "全天候"
  };

  // --- Extract CSV Data ---
  const raceTime = raceData[2] || '';
  const courseName = raceData[0] || '';
  const rawDate = raceData[1] || '';
  const distance = raceData[4] || 'N/A';
  const rawClass = raceData[6] || 'N/A';
  const rawGoing = raceData[12] || 'N/A';
  const rawPrize = raceData[10] || '';
  const raceName = raceData[3] || '';
  const runners = raceData[11] || '';
  const ground = raceData[12] || '';
  const surface = raceData[13] || '';

  // --- Translate ---
  const translatedGoing = goingMap[rawGoing] || rawGoing;
  const translatedClass = classMap[rawClass] || rawClass;
  const translatedSurface = surfaceMap[surface] || surface;

  // --- Format prize ---
  const prizeValue = rawPrize.replace(/[^0-9]/g, '');
  const formattedPrize = prizeValue ? `£${parseInt(prizeValue).toLocaleString()}` : 'N/A';

  // --- Format date dd/mm/yyyy ---
  let formattedDate = '';
  if (rawDate) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      formattedDate = `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
    } else {
      formattedDate = rawDate;
    }
  }

  // --- Create race header ---
  const raceHeader = document.createElement('div');
  raceHeader.className = 'race-header';

  // --- Left side (race info) ---
  const leftDiv = document.createElement('div');
  leftDiv.className = 'race-left';  // add class for CSS control
  leftDiv.innerHTML = `
  <div class="race-title">
    ${raceTime ? raceTime + ' ' : ''}${translatedCountry ? translatedCountry + ' ' : ''}${courseName} ${formattedDate ? `(${formattedDate})` : ''}
  </div>
  <div class="race-meta">
    <span>${distance}${labelCN.furlong}</span>
    <span>${translatedClass}</span>
    <span>${translatedGoing}</span>
    <span>${labelCN.prize}: ${formattedPrize}</span>
  </div>
  <div class="race-name">
    ${raceName}
  </div>
`;
  raceHeader.appendChild(leftDiv);

  // --- Right side (rectangle) ---
  const rightDiv = document.createElement('div');
  rightDiv.className = 'race-right';  // add class for CSS control
  rightDiv.innerHTML = `
  <div>${labelCN.runners}: ${runners}匹</div>
  <span>${labelCN.going}: ${translatedGoing}</span>
  <div>${labelCN.surface}: ${translatedSurface}</div>
`;
  raceHeader.appendChild(rightDiv);


  raceDetails.appendChild(raceHeader);

  // ===== Main race table =====
  const table = document.createElement('table');
  table.className = 'race-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['號碼(檔)', '', '馬名/資訊', '年齡', '重量', '騎師', '練馬師', '隔夜', '最近'].forEach(text => {
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
  const colorMap = { 'b': '棗色', 'ch': '栗色', 'gr': '灰色', 'bl': '黑色', 'br': '棕色', 'ro': '雜色', 'b/br': '黑棕色', 'gr/ro': '雜灰色', 'b/ro': '雜棗色', 'ch/ro': '雜栗色', 'br/ro': '雜棕色' };
  const nationalityMap = { 'GB': '英國', 'IRE': '愛爾蘭', 'FR': '法國', 'HK': '香港', 'USA': '美國' };

  horseRows.forEach((row) => {
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
    const region = row[45] || '';
    const reach14 = row[44] || '';
    const runs14 = row[46] || '';
    const wins14 = row[47] || '';

    // Calculate win percentage
    let winPct = '-';
    if (runs14 && !isNaN(runs14) && runs14 !== '0') {
      winPct = ((parseInt(wins14, 10) / parseInt(runs14, 10)) * 100).toFixed(1) + '%';
    }

    const jockeyData = masterJockeyMap[jockey] || { raceCount: '0', races: [] };
    const trainerData = masterTrainerMap[trainer] || { raceCount: '0', races: [] };

    // ===== Horse row
    const horseRow = document.createElement('tr');
    horseRow.style.backgroundColor = 'white';

    // Column 1
    const col1 = document.createElement('td');
    const drawDisplay = (draw && draw !== '0') ? `(${draw})` : '';
    col1.innerHTML = `<div class="horse-num-draw">${horseNumber} ${drawDisplay}</div>記錄<div>${form}</div>`;
    horseRow.appendChild(col1);

    // Column 2: Silk
    const col2 = document.createElement('td');
    col2.innerHTML = silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : '';
    horseRow.appendChild(col2);

    // Column 3: Horse info
    const infoCell = document.createElement('td');
    const genderCN = genderMap[gender] || gender;
    const colorCN = colorMap[color] || color;
    const nationalityCN = nationalityMap[nationality] || nationality;

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

    infoCell.innerHTML = `
      <div class="horse-name">${horseName}</div>
      <div class="last-run">
        上次出賽 <span class="last-run-number">${lastRunDisplay}</span>
      </div>
      <div>${genderCN} | ${colorCN} | ${nationalityCN}</div>
    `;
    horseRow.appendChild(infoCell);

    // Column 4-9
    const col4 = document.createElement('td'); col4.textContent = age; horseRow.appendChild(col4);
    const col5 = document.createElement('td'); col5.textContent = formatWeight(weights); horseRow.appendChild(col5);
    const col6 = document.createElement('td'); col6.innerHTML = `<div>${jockey}</div><div>今日騎師策騎: ${jockeyData.raceCount} 匹</div>`; horseRow.appendChild(col6);
    const col7 = document.createElement('td'); col7.innerHTML = `
      <div>${trainer}</div>
      <div>今日練馬師出賽: ${trainerData.raceCount}匹</div>
      <div>過去14天：</div>
      <div>達標: ${reach14}%</div>
      <div>參賽: ${runs14}匹  勝出: ${wins14}匹  勝出%: ${winPct}</div>
      <div>地區: ${region}</div>
    `; horseRow.appendChild(col7);
    const col8 = document.createElement('td'); col8.textContent = decimalToFraction(parseFloat(lastnightOdds)); horseRow.appendChild(col8);
    const col9 = document.createElement('td'); col9.innerHTML = `<span class="red-odd">${decimalToFraction(parseFloat(nowOdds))}</span>`; horseRow.appendChild(col9);

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

  console.log('race-details container before append:', raceDetails.innerHTML);
  raceDetails.appendChild(table);
  console.log('race-details container after append:', raceDetails.innerHTML);


  // ===== Helper Function =====
  function decimalToFraction(decimal) {
    if (!decimal || isNaN(decimal)) return '';
    const gcd = (a, b) => (b < 0.0000001 ? a : gcd(b, Math.floor(a % b)));
    const tolerance = 1.0E-6;
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
    let b = decimal;
    do {
      let a = Math.floor(b);
      let aux = h1; h1 = a * h1 + h2; h2 = aux;
      aux = k1; k1 = a * k1 + k2; k2 = aux;
      b = 1 / (b - a);
    } while (Math.abs(decimal - h1 / k1) > decimal * tolerance);
    return `${h1 - k1}/${k1}`;
  }
}


function loadDropOdds() {
  const container = document.getElementById("drop-odds-container");
  const scrollPosition = window.scrollY || document.documentElement.scrollTop;
  container.innerHTML = '<div class="loading">載入中...</div>';

  const csvUrl = "https://ukhorse888uk.github.io/dashboard/csv/dropodds.csv?cb=" + Date.now();

  // Convert decimal odds to fractional string (for display only)
  function decimalToFraction(decimal) {
    if (!decimal || decimal <= 1) return '--';
    const fractionValue = decimal - 1; // subtract 1 to get profit fraction
    if (fractionValue % 1 === 0) return fractionValue + '/1';
    const denominator = 2; // simplest fractions
    const numerator = Math.round(fractionValue * denominator);
    return numerator + '/' + denominator;
  }

  // Format change numbers (14.00 -> 14, 4.50 -> 4.5)
  function formatDecimal(num) {
    if (num % 1 === 0) return num.toString();
    return num.toFixed(2).replace(/\.?0+$/, '');
  }

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

      data.sort((a, b) => a['Time'].localeCompare(b['Time'], undefined, { numeric: true }));

      if (data.length === 0) {
        container.innerHTML = '<div class="error">沒有有效馬匹數據</div>';
        return;
      }

      const isMobilePortrait = window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;

      let tableHTML = `
        <table class="drop-odds-table">
          <thead>
            <tr>
              <th>${isMobilePortrait ? '賽時/場地' : '賽時'}</th>
      `;

      if (!isMobilePortrait) tableHTML += `<th>場地</th>`;

      tableHTML += `
              <th>號</th>
              <th>馬名</th>
              <th>隔夜</th>
              <th>最近</th>
              <th>變動</th>
              <th>變動%</th>
              <th>賽果</th>
              <th>贏賠率</th>
            </tr>
          </thead>
          <tbody>
      `;

      data.forEach(row => {
        const originalDec = parseFloat(row['Original']) || 0;
        const nowDec = parseFloat(row['NOW']) || 0;
        const changeDec = parseFloat(row['Change']) || (nowDec - originalDec);
        const pctChange = parseFloat(row['%']) || (originalDec ? (changeDec / originalDec) * 100 : 0);
        const colorClass = pctChange <= -48 ? 'green' : pctChange >= 48 ? 'red' : '';

        const originalFrac = decimalToFraction(originalDec);
        const nowFrac = decimalToFraction(nowDec);
        const spFrac = decimalToFraction(parseFloat(row['SP Odds'])); // Convert SP Odds
        const timeCellContent = isMobilePortrait
          ? `<span class="time-with-course">${row['Time'] || '--'}</span><span class="course-name">${row['Course'] || '--'}</span>`
          : (row['Time'] || '--');

        tableHTML += `
  <tr>
    <td class="time-cell">${timeCellContent}</td>
    ${!isMobilePortrait ? `<td class="course-cell">${row['Course'] || '--'}</td>` : ''}
    <td>${row['Num'] || '--'}</td>
    <td>${row['Horse Name']}</td>
    <td>${originalFrac}</td>
    <td>${nowFrac}</td>
    <td class="${colorClass}">${formatDecimal(changeDec)}</td>
    <td class="${colorClass}">${Math.round(pctChange)}%</td>
    <td>${row['FIN'] || '--'}</td>
    <td>${spFrac || '--'}</td>
  </tr>
`;
      });

      tableHTML += '</tbody></table>';
      container.innerHTML = tableHTML;

      window.addEventListener('resize', function () {
        const newIsMobilePortrait = window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;
        if (isMobilePortrait !== newIsMobilePortrait) loadDropOdds();
      });

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

loadDropOdds();






// ===============================
// UPDATE RACE ARROW (Single unified function)
// ===============================
function updateRaceArrow() {
  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    // Mobile version - check race list state
    const raceList = document.getElementById('race-list');
    const arrowTab = document.querySelector('.tab-button.arrow-tab');
    const arrow = arrowTab?.querySelector('.arrow');

    if (arrow && raceList) {
      arrow.classList.toggle('open', raceList.classList.contains('open'));
    }
  } else {
    // Desktop version - check dropdown state
    const raceTab = document.querySelector('.tab[data-tab="races"]');
    const arrow = raceTab?.querySelector('.arrow');
    const dropdown = document.getElementById('race-dropdown');

    if (arrow && dropdown) {
      arrow.classList.toggle('open', dropdown.classList.contains('open'));
    }
  }
}

// ===============================
// DOM CONTENT LOADED
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  loadRaceFormData();

  // -------------------------------
  // Elements
  // -------------------------------
  const raceTab = document.querySelector('.tab[data-tab="races"]');
  const dropdown = document.getElementById('race-dropdown');
  const arrow = raceTab?.querySelector('.arrow');
  const tabs = document.querySelectorAll('.tab-bar .tab');
  const raceDetails = document.getElementById('race-details');
  const dropOddsDiv = document.getElementById('drop-odds');
  const subbar = document.getElementById('race-subbar-container');
  const raceCourses = document.getElementById('race-courses');
  const raceArrowTab = document.querySelector('.tab-button.arrow-tab');
  const raceList = document.getElementById('race-list');

  // -------------------------------
  // Helpers
  // -------------------------------
  function updateSubbarVisibility(activeTabName) {
    if (!subbar) return;
    subbar.style.display = activeTabName === 'races' ? 'flex' : 'none';
  }

  function showRaceForms() {
    document.querySelectorAll('.race-form-container').forEach(c => {
      c.style.display = 'block';
      if (!c.innerHTML.trim()) {
        const horseName = c.getAttribute('data-horse') || '';
        c.innerHTML = createRaceFormTable(horseName);
      }
    });
  }

  function updateRaceListVisibility() {
    if (!raceArrowTab || !raceList) return;
    const activeTab = document.querySelector('.tab-bar .tab-button.active')?.dataset.tab;
    const isMobile = window.innerWidth <= 1024;

    if (isMobile) {
      raceArrowTab.style.display = (activeTab === 'races' || activeTab === 'race-card') ? 'flex' : 'none';
      if (activeTab !== 'races' && activeTab !== 'race-card') {
        raceList.classList.remove('open');
      }
    } else {
      raceArrowTab.style.display = '';
      raceList.classList.remove('open');
    }
    updateRaceArrow();
  }



  // -------------------------------
  // Arrow (desktop) toggle
  // -------------------------------
  if (arrow) {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      updateRaceArrow();
    });
  }

  // -------------------------------
  // Arrow (mobile) toggle - FIXED
  // -------------------------------
  if (raceArrowTab && raceList) {
    raceArrowTab.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent document click from firing
      raceList.classList.toggle('open');
      updateRaceArrow();
    });
  }



  // -------------------------------
  // Close race list if clicked outside (mobile) or clicked top tab
  // -------------------------------
  document.addEventListener('click', (e) => {
    const isMobile = window.innerWidth <= 1024;

    const topTabs = document.querySelectorAll('.tab-bar .tab-button');
    const clickedOnTopTab = Array.from(topTabs).some(tab => tab.contains(e.target));

    if (!isMobile) {
      // Desktop: close dropdown if clicked outside
      if (dropdown && raceTab && dropdown.classList.contains('open') &&
        !dropdown.contains(e.target) && !raceTab.contains(e.target)) {
        dropdown.classList.remove('open');
        updateRaceArrow();
      }
    } else {
      // Mobile: close race list if clicked outside or on any top tab
      if (raceList && raceArrowTab &&
        (clickedOnTopTab || (!raceList.contains(e.target) && !raceArrowTab.contains(e.target)))) {
        raceList.classList.remove('open');
        updateRaceArrow();
      }
    }
  });




  // -------------------------------
  // Dropdown race click
  // -------------------------------
  if (raceCourses) {
    raceCourses.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('race-time')) {
        const prevSelected = raceCourses.querySelector('.selected-race');
        if (prevSelected) prevSelected.classList.remove('selected-race');
        target.classList.add('selected-race');

        const raceKey = target.dataset.raceKey;
        if (!raceTab.classList.contains('active')) raceTab.click();

        if (typeof displayRace === 'function') {
          displayRace(raceRows[raceKey], raceKey);
          showRaceForms();
        }

        const isMobile = window.innerWidth <= 1024;
        if (isMobile) {
          raceList.classList.remove('open');
        } else {
          dropdown.classList.remove('open');
        }
        updateRaceArrow();
      }
    });
  }

  // -------------------------------
  // Tabs click
  // -------------------------------
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const activeTabName = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      updateSubbarVisibility(activeTabName);
      raceDetails.style.display = 'none';
      dropOddsDiv.style.display = 'none';

      if (activeTabName === 'drops') {
        dropOddsDiv.style.display = 'block';
        loadDropOdds();
        showRaceForms();
      } else if (activeTabName === 'races') {
        raceDetails.style.display = 'block';
        showRaceForms();
        if (typeof loadRacecard === 'function') {
          const prevScroll = window.scrollY || document.documentElement.scrollTop;
          loadRacecard();
          setTimeout(() => window.scrollTo(0, prevScroll), 200);
        }
      }

      localStorage.setItem('activeTab', activeTabName);
      updateRaceListVisibility();
    });
  });

  // -------------------------------
  // Init top tabs
  // -------------------------------
  function initTabs() {
    document.querySelectorAll('.tab-bar .tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-bar .tab-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('activeTab', btn.dataset.tab);
        updateRaceListVisibility();
      });
    });
  }

  // -------------------------------
  // Auto-refresh every 10 minutes
  // -------------------------------
  function startAutoRefresh() {
    setInterval(() => {
      const activeTab = localStorage.getItem('activeTab') || 'races';
      if (activeTab === 'races') {
        loadRacecard();
        loadRaceFormData();
      } else if (activeTab === 'drops' || activeTab === 'drop-log') {
        loadDropOdds();
      }
    }, 600000);
  }

  // -------------------------------
  // Init
  // -------------------------------
  initTabs();
  updateRaceListVisibility();
  startAutoRefresh();

  // Restore last tab and scroll
  const lastTab = localStorage.getItem('activeTab') || 'races';
  document.querySelector(`.tab-bar .tab[data-tab="${lastTab}"]`)?.click();

  const lastPosition = localStorage.getItem('scrollPosition');
  if (lastPosition) setTimeout(() => window.scrollTo(0, parseInt(lastPosition)), 0);

  window.addEventListener('beforeunload', () => {
    localStorage.setItem('scrollPosition', window.scrollY || document.documentElement.scrollTop);
  });

  window.addEventListener('resize', updateRaceListVisibility);
});