// ===============================
// 🔵 GLOBAL VARIABLES
// ===============================
let activeTab = localStorage.getItem('activeTab') || 'races';
let masterJockeyMap = {};
let masterTrainerMap = {};
let raceFormData = {};
let allTimes = [];
let courseToTimes = {};
let selectedCourse = "LATEST";
let selectedTime = "";
let allResultsRows = [];
let globalRaceRows = {};
let resultsDataLoaded = false;
let horseRaceMap = {};
let racecardDataLoaded = false;
let dropOddsDataLoaded = false;
let debounceTimers = {};

// ===============================
// 🔵 UTILITY FUNCTIONS (Used by multiple pages)
// ===============================
function debounce(func, wait, immediate = false) {
  return function () {
    const context = this, args = arguments;
    clearTimeout(debounceTimers[func.name]);
    if (immediate && !debounceTimers[func.name]) {
      func.apply(context, args);
    }
    debounceTimers[func.name] = setTimeout(() => {
      debounceTimers[func.name] = null;
      if (!immediate) func.apply(context, args);
    }, wait);
  };
}

function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

function processRaceDataChunked(data, chunkSize = 100, callback) {
  return new Promise((resolve) => {
    let index = 0;
    function processChunk() {
      const chunkEnd = Math.min(index + chunkSize, data.length);
      for (let i = index; i < chunkEnd; i++) {
        callback(data[i], i);
      }
      index = chunkEnd;
      if (index < data.length) {
        setTimeout(processChunk, 0);
      } else {
        resolve();
      }
    }
    processChunk();
  });
}

function cleanName(name) {
  return name ? name.trim() : '';
}

const fractionalOddsMap = new Map([
  // Whole number decimal odds
  ["2", "Evens"], ["3", "2/1"], ["4", "3/1"], ["5", "4/1"], ["6", "5/1"],
  ["7", "6/1"], ["8", "7/1"], ["9", "8/1"], ["10", "9/1"], ["11", "10/1"],
  ["12", "11/1"], ["13", "12/1"], ["14", "13/1"], ["15", "14/1"], ["16", "15/1"],
  ["17", "16/1"], ["18", "17/1"], ["19", "18/1"], ["20", "19/1"],

  // Other decimal odds
  ["1.91", "10/11"], ["2.62", "13/8"], ["1.44", "4/9"], ["2.50", "6/4"], ["1.53", "8/15"],
  ["6.5", "11/2"], ["2.375", "11/8"], ["1.83", "5/6"], ["4.33", "10/3"], ["2.5", "6/4"], ["2.88", "15/8"], ["1.72", "8/11"], ["1.73", "8/11"], ["2.0", "Evens"], ["1.62", "8/13"], ["3.12", "85/40"],


  // Fractional string mappings
  ["333/100", "10/3"], ["500/100", "5/1"], ["100/33", "3/1"], ["250/100", "5/2"],
  ["163/100", "13/8"], ["3/2", "6/4"], ["69/50", "11/8"], ["47/25", "15/8"],
  ["91/100", "10/11"], ["73/100", "8/13"], ["81/50", "13/8"], ["4/2", "2/1"],
  ["6/2", "3/1"], ["1/1", "Evens"]
]);

const decimalToFractional = memoize(function decimalToFractional(raw) {
  if (raw === null || raw === undefined || raw === "") return "-";
  let s = String(raw).trim();
  if (s === "" || s === "NaN") return "-";
  const d = parseFloat(s);
  if (isNaN(d)) return "-";

  // Handle whole number odds
  if (Math.abs(d - Math.round(d)) < 1e-6 && d >= 2) {
    return `${Math.round(d) - 1}/1`;
  }

  // Check the map for specific decimal matches
  if (fractionalOddsMap.has(s)) return fractionalOddsMap.get(s);

  // Handle fractional strings directly
  if (s.includes("/")) return s;

  // Check mapped values with tolerance
  const EPS = 1e-6;
  for (const [k, v] of fractionalOddsMap) {
    const kn = parseFloat(k);
    if (!isNaN(kn) && Math.abs(kn - d) < EPS) return v;
  }

  // Convert decimal to fractional for values not in map
  if (d <= 1) return "-";

  const fracVal = d - 1;
  if (Math.abs(fracVal - Math.round(fracVal)) < EPS) {
    return `${Math.round(fracVal)}/1`;
  }

  // For other decimal odds, calculate the fraction
  const tolerance = 1.0E-6;
  let numerator = 1;
  let denominator = 1;
  let fraction = fracVal;

  // Find approximate fraction
  for (let denom = 1; denom <= 100; denom++) {
    let numer = Math.round(fraction * denom);
    if (Math.abs(fraction - numer / denom) < tolerance) {
      numerator = numer;
      denominator = denom;
      break;
    }
  }

  // Simplify the fraction
  const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  };

  const divisor = gcd(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;

  return `${numerator}/${denominator}`;
});

const lbsToStoneLb = memoize(function lbsToStoneLb(lbs) {
  if (!lbs || isNaN(lbs)) return lbs;
  lbs = parseInt(lbs);
  let stone = Math.floor(lbs / 14);
  let remaining = lbs % 14;
  return `${stone}st ${remaining}lb`;
});

const convertRaceTime = memoize(function convertRaceTime(t) {
  if (!t || !t.includes(":")) return t;
  let [h, m] = t.split(":");
  h = parseInt(h, 10);
  m = (m || "00").padStart(2, "0");
  if (h >= 0 && h <= 9) return `${h + 12}:${m}`;
  return `${h}:${m}`;
});

function sortTimes(a, b) {
  const [ha, ma] = a.split(":").map(Number);
  const [hb, mb] = b.split(":").map(Number);
  return ha === hb ? ma - mb : ha - hb;
}

function formatDecimal(num) {
  if (num % 1 === 0) return num.toString();
  return num.toFixed(2).replace(/\.?0+$/, '');
}

// ===============================
// 🔵 TAB MANAGEMENT
// ===============================
function showTab(tab) {
  console.log('Switching to tab:', tab);

  // Hide all sections
  document.getElementById('race-details-wrapper').style.display = 'none';
  document.getElementById('drop-odds').style.display = 'none';
  document.getElementById('result-section').style.display = 'none';

  // Show active section
  if (tab === 'races') {
    document.getElementById('race-details-wrapper').style.display = 'block';
  } else if (tab === 'drops') {
    document.getElementById('drop-odds').style.display = 'block';
  } else if (tab === 'results') {
    document.getElementById('result-section').style.display = 'block';
  }

  // Update tab classes
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const activeTabElement = document.getElementById(tab + "-tab");
  if (activeTabElement) activeTabElement.classList.add("active");

  localStorage.setItem("activeTab", tab);
}

function updateRaceArrow() {
  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    const raceList = document.getElementById('race-list');
    const arrowTab = document.querySelector('.tab-button.arrow-tab');
    const arrow = arrowTab?.querySelector('.arrow');
    if (arrow && raceList) {
      arrow.classList.toggle('open', raceList.classList.contains('open'));
    }
  } else {
    const raceTab = document.querySelector('.tab[data-tab="races"]');
    const arrow = raceTab?.querySelector('.arrow');
    const dropdown = document.getElementById('race-dropdown');
    if (arrow && dropdown) {
      arrow.classList.toggle('open', dropdown.classList.contains('open'));
    }
  }
}

function isDataReadyForNavigation() {
  return racecardDataLoaded && dropOddsDataLoaded && Object.keys(horseRaceMap).length > 0;
}

// ===============================
// 🔵 RACE CARD PAGE FUNCTIONS
// ===============================
function buildMasterMaps(data) {
  masterJockeyMap = {};
  masterTrainerMap = {};

  data.forEach(row => {
    let jockeyNameRaw = row[63] || '';
    const jockeyName = cleanName(jockeyNameRaw);
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

    let trainerNameRaw = row[76] || '';
    const trainerName = cleanName(trainerNameRaw);
    const trainerCount = row[77] || '0';

    if (trainerName && trainerName.toUpperCase() !== 'NON-RUNNER') {
      masterTrainerMap[trainerName] = { raceCount: trainerCount };
    }
  });
}

function buildHorseRaceMapping(raceRows) {
  if (!raceRows || !Array.isArray(raceRows)) return;

  horseRaceMap = {};
  console.log('Building horse mapping with', raceRows.length, 'rows');

  processRaceDataChunked(raceRows, 200, (raceRow, index) => {
    const course = (raceRow[0] || '').trim();
    const time = (raceRow[2] || '').trim();
    const horseName = (raceRow[20] || '').trim();

    if (!course || !time || !horseName) return;

    const raceKey = `${time}  ${course}`;
    const horseID = (raceRow[50] || '').trim();
    const raceID = (raceRow[49] || '').trim();
    const cleanHorseName = horseName.toLowerCase().trim();

    if (horseID && horseID !== '') {
      horseRaceMap[horseID] = {
        raceKey: raceKey,
        course: course,
        time: time,
        horseName: horseName,
        raceID: raceID
      };

      horseRaceMap[cleanHorseName] = horseRaceMap[horseID];
    }
  }).then(() => {
    console.log('Horse mapping complete. Total mapped:', Object.keys(horseRaceMap).length);
  });
}

const loadRacecard = debounce(function loadRacecard() {
  const cacheKey = 'racecardData';
  const cacheTimeKey = 'racecardDataTime';
  const cacheExpiry = 2 * 60 * 1000;

  // Check cache first
  const cachedData = localStorage.getItem(cacheKey);
  const cachedTime = localStorage.getItem(cacheTimeKey);

  if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime)) < cacheExpiry) {
    console.log('📦 Using cached racecard data');
    processRacecardData(JSON.parse(cachedData));
    return;
  }

  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard2.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      if (results.errors && results.errors.length > 0) {
        console.error('Racecard CSV parsing errors:', results.errors);
        return;
      }

      localStorage.setItem(cacheKey, JSON.stringify(results.data));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
      processRacecardData(results.data);
    },
    error: function (err) {
      console.error('Failed to load racecard CSV:', err);
      racecardDataLoaded = false;
    }
  });
}, 500);

function processRacecardData(data) {
  const dataWithoutHeader = data.slice(1).filter(row => row && row.length > 0);
  if (!dataWithoutHeader || dataWithoutHeader.length === 0) {
    console.warn('No racecard data found');
    return;
  }

  buildMasterMaps(dataWithoutHeader);
  buildHorseRaceMapping(dataWithoutHeader);

  const courseMap = {};
  globalRaceRows = {};

  processRaceDataChunked(dataWithoutHeader, 100, (row) => {
    const course = (row[0] || '').trim();
    const raceTime = (row[2] || '').trim();
    if (!course || !raceTime) return;

    const raceKey = `${raceTime}  ${course}`;
    if (!courseMap[course]) courseMap[course] = {};
    if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
    courseMap[course][raceKey].push(row);
    globalRaceRows[raceKey] = courseMap[course][raceKey];
  }).then(() => {
    console.log('📊 Races loaded:', Object.keys(globalRaceRows).length);
    updateRaceDropdown(courseMap);
    racecardDataLoaded = true;

    if (dropOddsDataLoaded) {
      setTimeout(addHorseClickHandlers, 100);
    }
  });
}

function updateRaceDropdown(courseMap) {
  const dropdown = document.getElementById('race-dropdown');
  const activeRaceKey = localStorage.getItem('activeRace');
  const fragment = document.createDocumentFragment();

  Object.keys(courseMap).forEach(course => {
    const courseRow = document.createElement('div');
    courseRow.className = 'course-row';

    const courseName = document.createElement('span');
    courseName.className = 'course-name';
    courseName.textContent = course;
    courseRow.appendChild(courseName);

    Object.keys(courseMap[course]).forEach(raceKey => {
      const timeOnly = raceKey.split('  ')[0];
      if (timeOnly.toLowerCase() === "off_time") return;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'race-time';
      timeSpan.textContent = timeOnly;
      timeSpan.setAttribute('data-race-key', raceKey);

      if (activeRaceKey === raceKey) timeSpan.classList.add('selected-race');

      timeSpan.addEventListener('click', () => handleRaceSelection(raceKey, course, courseMap));
      courseRow.appendChild(timeSpan);
      courseRow.appendChild(document.createTextNode(' '));
    });

    fragment.appendChild(courseRow);
  });

  dropdown.innerHTML = '';
  dropdown.appendChild(fragment);

  if (activeRaceKey) {
    const courseName = activeRaceKey.split('  ')[1];
    if (activeTab === 'races') {
      showCourseSubbar(courseName, courseMap);
    }
    if (courseMap[courseName] && courseMap[courseName][activeRaceKey]) {
      displayRace(courseMap[courseName][activeRaceKey], activeRaceKey);
    }
  }
}

function handleRaceSelection(raceKey, course, courseMap) {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  document.querySelectorAll('#race-dropdown .race-time').forEach(t => t.classList.remove('selected-race'));
  document.querySelector(`[data-race-key="${raceKey}"]`)?.classList.add('selected-race');

  localStorage.setItem('activeRace', raceKey);
  displayRace(globalRaceRows[raceKey], raceKey);

  if (activeTab === 'races') {
    showCourseSubbar(course, courseMap);
  }

  const dropdown = document.getElementById('race-dropdown');
  dropdown.classList.remove('open');
  updateRaceArrow();

  setTimeout(() => window.scrollTo(0, scrollTop), 0);
}

function showCourseSubbar(courseName, courseMap) {
  if (!courseMap[courseName]) return;

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

  subbar.innerHTML = '';

  const courseLabel = document.createElement('span');
  courseLabel.textContent = courseName;
  courseLabel.style.fontWeight = 'bold';
  courseLabel.style.marginRight = '10px';
  subbar.appendChild(courseLabel);

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
        subbar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('activeRace', raceKey);
        displayRace(globalRaceRows[raceKey], raceKey);
        setTimeout(() => window.scrollTo(0, scrollTop), 0);
      });

      subbar.appendChild(btn);
    });

  subbar.style.display = 'flex';
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E]/g, '-');
}

function formatWeight(weightStr) {
  if (!weightStr) return '';

  const match = weightStr.match(/(\d+)\s*st\s*(\d+)\s*lb/i);
  if (match) {
    const stones = match[1];
    const pounds = match[2];
    return `${stones}-${pounds}`;
  }

  const lbs = parseInt(weightStr, 10);
  if (!isNaN(lbs)) {
    const stones = Math.floor(lbs / 14);
    const pounds = lbs % 14;
    return `${stones}-${pounds}`;
  }

  return weightStr;
}

function loadRaceFormData() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/raceform2.csv?cb=" + Date.now(), {
    download: true,
    encoding: "UTF-8",
    complete: function (results) {
      console.log('Race form CSV loaded:', results.data.length, 'rows');

      if (results.errors && results.errors.length > 0) {
        console.error('Race form CSV parsing errors:', results.errors);
        return;
      }

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
          colT: row[19] || ''
        };

        if (horseName !== '') {
          currentHorse = horseName;
          raceFormData[currentHorse] = [];
          raceFormData[currentHorse].push(raceEntry);
        } else if (currentHorse !== '') {
          raceFormData[currentHorse].push(raceEntry);
        }
      }
    },
    error: function (err) {
      console.error('Failed to load race form CSV:', err);
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



function createRaceFormTable(horseName) {
  if (Object.keys(raceFormData).length === 0) {
    return '<div class="loading-race-form">Race form data loading...</div>';
  }

  const formData = raceFormData[horseName] || [];
  if (formData.length === 0) {
    return '<div class="no-race-form">No race form data available for ' + horseName + '</div>';
  }

  const translationMap = {
    "Good To Soft": "好至軟地", "Good To Firm": "好至快地", "Soft To Heavy": "軟至爛地",
    "Good To Yielding": "好至黏地", "Yield To Soft": "黏至軟地", "Standard To Slow": "標準至慢",
    "Yielding": "黏地", "Good": "好地", "Soft": "軟地", "Firm": "快地", "Heavy": "爛地",
    "To": "至", "Hurdle": "跨欄", "Flat": "平路", "Chase": "追逐赛", "NH": "無障",
    "(IRE)": "愛爾蘭", "(FR)": "法國", "(AW)": "沙地", "Standard": "標準", "Class 1": "一班", "Class 2": "二班",
    "Class 3": "三班", "Class 4": "四班", "Class 5": "五班", "Class 6": "六班",
  };

  function translatePhrase(text) {
    let result = text;
    for (const phrase in translationMap) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      result = result.replace(regex, translationMap[phrase]);
    }
    return result;
  }

  // Detect screen mode ONCE at the beginning
  const isMobilePortrait = window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;

  let html = '<table class="race-form-table"><thead><tr>';
  html += '<th>日期</th><th>賽事資料</th><th>重量</th>';
  html += '<th><span class="full-header">（1L = 1個馬位）</span><span class="simplified-header">賽果</span></th>';
  html += '<th>騎師</th><th>OR</th><th>TS</th><th>RPR</th>';
  html += '</tr></thead><tbody>';

  formData.forEach(race => {
    let formattedDate = '';
    if (race.date) {
      const parts = race.date.split('/');
      if (parts.length === 3) {
        formattedDate = `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2].slice(-2)}`;
      } else {
        formattedDate = race.date;
      }
    }

    const mergedRaw = [race.colC, race.colH, race.colI, race.colD, race.colE]
      .filter(x => x && x.toString().trim() !== '')
      .map(cleanText)
      .join(' ');
    const mergedTranslated = translatePhrase(mergedRaw);
    const weight = formatWeight(race.colJ || '');
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

    // DECIDE HERE what to show based on screen mode
    // Create full text for web/landscape
    let fullText = details ? `${kL}(${details})` : kL;
    if (race.colT) {
      const fraction = decimalToFraction(parseFloat(race.colT) - 1);
      fullText += ' ' + fraction;
    }

    // Create simplified text for mobile portrait
    const simplifiedText = `(${kL})`; // Just (12/13)

    // Use both spans so CSS can toggle between them
    const col4 = `<span class="full-text">${fullText}</span><span class="simplified-text">${simplifiedText}</span>`;

    const col5 = cleanText(race.colX);
    const col6 = cleanText(race.colZ);
    const col7 = cleanText(race.colAB);
    const col8 = cleanText(race.colAA);

    html += `<tr>
        <td>${formattedDate}</td>
        <td>${mergedTranslated}</td>
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

async function translateToChinese(text) {
  if (!text) return "";
  try {
    const response = await fetch("https://translate.argosopentech.com/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "zh",
        format: "text"
      }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await response.json();
    return data.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
}

function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  if (!raceDetails) {
    console.error('❌ race-details element not found');
    return;
  }

  // Clear and show loading immediately
  raceDetails.innerHTML = '<div class="loading"></div>';
  raceDetails.style.display = 'block';

  const raceData = raceRows[0];

  const labelCN = { distance: '距離', class: '班數', going: '地質', prize: '獎金', furlong: 'f', runners: '參賽', ground: '地質', surface: '地種' };
  const countryMap = { GB: '英國', IRE: '愛爾蘭', CAN: '加拿大', USA: '美國' };
  const country = raceData[5] || '';
  const translatedCountry = countryMap[country] || country;

  const goingMap = {
    "Firm": "快地", "Good To Firm": "好至快地", "Good": "好地", "Good To Yielding": "好至黏地",
    "Yielding": "黏地", "Yield To Soft": "黏至軟地", "Soft": "軟地", "Heavy": "大爛地", "Good To Soft": "好至軟地"
  };

  const classMap = {
    "Class 1": "一班", "Class 2": "二班", "Class 3": "三班", "Class 4": "四班",
    "Class 5": "五班", "Class 6": "六班", "Class 7": "七班", "Class 8": "八班", "Class 9": "九班"
  };

  const surfaceMap = { "Turf": "草地", "AW": "全天候" };
  const typeMap = { "Hurdle": "跨欄", "Flat": "平路", "Chase": "追逐赛" };

  const fractionalOddsMap = {
    // Whole number decimal odds
    "2": "Evens", "3": "2/1", "4": "3/1", "5": "4/1", "6": "5/1",
    "7": "6/1", "8": "7/1", "9": "8/1", "10": "9/1", "11": "10/1",
    "12": "11/1", "13": "12/1", "14": "13/1", "15": "14/1", "16": "15/1",
    "17": "16/1", "18": "17/1", "19": "18/1", "20": "19/1",

    // Other decimal odds
    "1.91": "10/11", "2.62": "13/8", "1.44": "4/9", "2.50": "6/4", "1.53": "8/15",
    "6.5": "11/2", "2.38": "11/8", "1.83": "5/6", "4.33": "10/3", "1.5": "6/4", "2.63": "13/8",
    "3.75": "11/4", "3.5": "5/2", "3.25": "9/4", "5.5": "9/2", "6.5": "11/2", "7.5": "13/2", "8.5": "15/2", "9.5": "17/2", "2.75": "7/4", "1.67": "4/6", "1.62": "8/13", "2.75": "7/4", "1.73": "8/11",

    // Fractional string mappings
    "333/100": "10/3", "500/100": "5/1", "100/33": "3/1", "250/100": "5/2",
    "163/100": "13/8", "3/2": "6/4", "69/50": "11/8", "47/25": "15/8",
    "91/100": "10/11", "73/100": "8/13", "81/50": "13/8", "4/2": "2/1",
    "6/2": "3/1"
  };

  function mapFractionalOdds(fractionStr) {
    if (!fractionStr) return fractionStr;

    // Check if it's already a fractional string with a slash
    if (fractionStr.includes("/")) {
      return fractionalOddsMap[fractionStr] || fractionStr;
    }

    // Check if it's a decimal number in our map
    if (fractionalOddsMap[fractionStr]) {
      return fractionalOddsMap[fractionStr];
    }

    // If it's a decimal not in our map, convert it properly to fractional
    const decimalValue = parseFloat(fractionStr);
    if (!isNaN(decimalValue) && decimalValue > 1) {
      // Convert decimal to fractional
      const fracVal = decimalValue - 1;

      const commonFractions = [
        { decimal: 0.09, fraction: "1/11" }, { decimal: 0.1, fraction: "1/10" },
        { decimal: 0.11, fraction: "1/9" }, { decimal: 0.125, fraction: "1/8" },
        { decimal: 0.14, fraction: "1/7" }, { decimal: 0.166, fraction: "1/6" },
        { decimal: 0.2, fraction: "1/5" }, { decimal: 0.25, fraction: "1/4" },
        { decimal: 0.33, fraction: "1/3" }, { decimal: 0.375, fraction: "3/8" },
        { decimal: 0.4, fraction: "2/5" }, { decimal: 0.44, fraction: "4/9" },
        { decimal: 0.5, fraction: "1/2" }, { decimal: 0.53, fraction: "8/15" },
        { decimal: 0.57, fraction: "4/7" }, { decimal: 0.6, fraction: "3/5" },
        { decimal: 0.625, fraction: "5/8" }, { decimal: 0.67, fraction: "2/3" },
        { decimal: 0.75, fraction: "3/4" }, { decimal: 0.8, fraction: "4/5" },
        { decimal: 0.83, fraction: "5/6" }, { decimal: 0.875, fraction: "7/8" },
        { decimal: 0.91, fraction: "10/11" }, { decimal: 0.93, fraction: "8/13" },
        { decimal: 1.0, fraction: "1/1" }, { decimal: 1.25, fraction: "5/4" },
        { decimal: 1.33, fraction: "4/3" }, { decimal: 1.38, fraction: "11/8" },
        { decimal: 1.5, fraction: "3/2" }, { decimal: 1.62, fraction: "13/8" },
        { decimal: 1.63, fraction: "13/8" }, { decimal: 1.67, fraction: "5/3" },
        { decimal: 1.75, fraction: "7/4" }, { decimal: 2.0, fraction: "2/1" },
        { decimal: 2.25, fraction: "9/4" }, { decimal: 2.38, fraction: "11/8" },
        { decimal: 2.5, fraction: "5/2" }, { decimal: 2.62, fraction: "13/8" },
        { decimal: 2.63, fraction: "13/8" }, { decimal: 2.75, fraction: "11/4" },
        { decimal: 3.0, fraction: "3/1" }, { decimal: 3.25, fraction: "13/4" },
        { decimal: 3.33, fraction: "10/3" }, { decimal: 3.5, fraction: "7/2" },
        { decimal: 3.75, fraction: "15/4" }, { decimal: 4.0, fraction: "4/1" },
        { decimal: 4.33, fraction: "16/3" }, { decimal: 4.5, fraction: "9/2" },
        { decimal: 5.0, fraction: "5/1" }, { decimal: 5.5, fraction: "11/2" },
        { decimal: 6.0, fraction: "6/1" }, { decimal: 6.5, fraction: "13/2" },
        { decimal: 7.0, fraction: "7/1" }, { decimal: 7.5, fraction: "15/2" },
        { decimal: 8.0, fraction: "8/1" }, { decimal: 8.5, fraction: "17/2" },
        { decimal: 9.0, fraction: "9/1" }, { decimal: 9.5, fraction: "19/2" },
        { decimal: 10.0, fraction: "10/1" }
      ];

      // Find the closest common fraction
      let closestFraction = null;
      let smallestDiff = Infinity;

      for (const common of commonFractions) {
        const diff = Math.abs(fracVal - common.decimal);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestFraction = common.fraction;
        }
      }

      // If we found a close match (within reasonable tolerance)
      if (closestFraction && smallestDiff < 0.1) {
        return closestFraction;
      }

      // Fallback: try to represent as simplified fraction
      const tolerance = 0.01;
      for (let denom = 1; denom <= 100; denom++) {
        const numerator = Math.round(fracVal * denom);
        const actualValue = numerator / denom;
        if (Math.abs(fracVal - actualValue) < tolerance) {
          return `${numerator}/${denom}`;
        }
      }

      // Final fallback: return as decimal-1/1 for whole numbers
      if (Math.abs(fracVal - Math.round(fracVal)) < 1e-6) {
        return `${Math.round(fracVal)}/1`;
      }
    }

    // Finally, return the original if no mapping found
    return fractionStr;
  }

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
  const typeText = raceData[7] || '';
  const translatedType = typeMap[typeText] || typeText;

  const translatedGoing = goingMap[rawGoing] || rawGoing;
  const translatedClass = classMap[rawClass] || rawClass;
  const translatedSurface = surfaceMap[surface] || surface;

  const prizeValue = rawPrize.replace(/[^0-9]/g, '');
  const formattedPrize = prizeValue ? `£${parseInt(prizeValue).toLocaleString()}` : 'N/A';

  let formattedDate = '';
  if (rawDate) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      formattedDate = `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
    } else {
      formattedDate = rawDate;
    }
  }

  const raceHeader = document.createElement('div');
  raceHeader.className = 'race-header';
  const leftDiv = document.createElement('div');
  leftDiv.className = 'race-left';
  leftDiv.innerHTML = `
    <div class="race-title">
      ${raceTime ? raceTime + ' ' : ''}${translatedCountry ? translatedCountry + ' ' : ''}${courseName} ${formattedDate ? `(${formattedDate})` : ''}
    </div>
    <div class="race-meta">
      <span>${distance}${labelCN.furlong}</span>
      <span>${translatedClass}</span>
      <span>${translatedGoing}</span>
      <span>${translatedType}</span>
      <span>${labelCN.prize}: ${formattedPrize}</span>
    </div>
  `;
  raceHeader.appendChild(leftDiv);

  const rightDiv = document.createElement('div');
  rightDiv.className = 'race-right';
  rightDiv.innerHTML = `
    <div>${labelCN.runners}: ${runners}匹</div>
    <span>${labelCN.going}: ${translatedGoing}</span>
    <div>${labelCN.surface}: ${translatedSurface}</div>
  `;
  raceHeader.appendChild(rightDiv);

  raceDetails.appendChild(raceHeader);

  // Create race form slider with 3 positions
  const formToggleContainer = document.createElement('div');
  formToggleContainer.className = 'form-toggle-container';
  formToggleContainer.innerHTML = `
    <div class="form-toggle-label">顯示賽績表</div>
    <div class="slider-container">
      <div class="slider-labels">
        <span class="slider-label">不顯示戰績</span>
        <span class="slider-label">顯示6場</span>
        <span class="slider-label">顯示所有</span>
      </div>
      <div class="slider-track">
        <input type="range" id="race-form-slider" class="form-slider" min="1" max="3" value="1">
        <div class="slider-positions">
          <span class="slider-position"></span>
          <span class="slider-position"></span>
          <span class="slider-position"></span>
        </div>
      </div>
    </div>
  `;
  raceDetails.appendChild(formToggleContainer);

  // Load saved slider state from localStorage
  const savedSliderState = localStorage.getItem('raceFormSlider');
  const slider = document.getElementById('race-form-slider');
  if (savedSliderState) {
    slider.value = savedSliderState;
  }

  // Function to update race form display based on slider value
  function updateRaceFormDisplay() {
    const value = parseInt(slider.value);
    const raceFormTables = document.querySelectorAll('.race-form-table');

    raceFormTables.forEach(table => {
      if (value === 1) {
        // Position 1: Hide all race forms
        table.style.display = 'none';
      } else if (value === 2) {
        // Position 2: Show max 6 races
        table.style.display = 'table';
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
          row.style.display = index < 6 ? 'table-row' : 'none';
        });
      } else if (value === 3) {
        // Position 3: Show ALL races (no limit)
        table.style.display = 'table';
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          row.style.display = 'table-row';
        });
      }
    });

    // Update labels active state
    const labels = document.querySelectorAll('.slider-label');
    labels.forEach((label, index) => {
      if (index + 1 === value) {
        label.style.color = '#4CAF50';
        label.style.fontWeight = 'bold';
      } else {
        label.style.color = '#666';
        label.style.fontWeight = '500';
      }
    });
  }

  // Save slider state and update display when changed
  slider.addEventListener('change', function () {
    localStorage.setItem('raceFormSlider', this.value);
    updateRaceFormDisplay();
  });

  // Make slider snap to positions 1, 2, 3
  slider.addEventListener('input', function () {
    const value = parseInt(this.value);

    // Snap to nearest position (1, 2, or 3)
    let snappedValue;
    if (value <= 1.5) {
      snappedValue = 1;
    } else if (value <= 2.5) {
      snappedValue = 2;
    } else {
      snappedValue = 3;
    }

    this.value = snappedValue;
    localStorage.setItem('raceFormSlider', snappedValue);
    updateRaceFormDisplay();
  });

  // Also add click event to the track for direct position selection
  const sliderTrack = document.querySelector('.slider-track');
  sliderTrack.addEventListener('click', function (e) {
    const rect = this.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;

    let newValue;
    if (percentage < 0.33) {
      newValue = 1;
    } else if (percentage < 0.66) {
      newValue = 2;
    } else {
      newValue = 3;
    }

    slider.value = newValue;
    localStorage.setItem('raceFormSlider', newValue);
    updateRaceFormDisplay();
  });

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
  raceDetails.appendChild(table);

  const horseRows = raceRows.filter(row => {
    const horseNumber = row[32];
    return horseNumber && horseNumber.toString().trim() !== '' &&
      horseNumber.toString().trim() !== 'Jockey' &&
      horseNumber.toString().trim() !== 'Trainer';
  });

  const genderMap = { 'horse': '雄馬', 'mare': '母馬', 'gelding': '閹馬', 'colt': '小雄駒', 'filly': '小雌馬' };
  const colorMap = { 'b': '棗色', 'ch': '栗色', 'gr': '灰色', 'bl': '黑色', 'br': '棕色', 'ro': '雜色', 'b/br': '黑棕色', 'gr/ro': '雜灰色', 'b/ro': '雜棗色', 'ch/ro': '雜栗色', 'br/ro': '雜棕色' };
  const nationalityMap = { 'GB': '英國', 'IRE': '愛爾蘭', 'FR': '法國', 'HK': '香港', 'USA': '美國' };

  // Enhanced sorting that handles all fraction formats consistently
  horseRows.sort((a, b) => {
    const parseFraction = (fractionStr) => {
      if (!fractionStr || fractionStr === '-' || fractionStr === '' || fractionStr === 'NaN') {
        return Number.MAX_VALUE;
      }

      // Convert to string and trim
      const str = fractionStr.toString().trim();

      // If it's already a decimal number (like 2.5, 3.33, etc.)
      if (!isNaN(parseFloat(str)) && !str.includes('/')) {
        return parseFloat(str);
      }

      // Handle fractional formats like "5/2", "10/3", "3/1"
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 2) {
          const numerator = parseFloat(parts[0]);
          const denominator = parseFloat(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return numerator / denominator;
          }
        }
      }

      return Number.MAX_VALUE;
    };

    // Parse both current odds
    const oddsA = parseFraction(a[52]); // nowOdds
    const oddsB = parseFraction(b[52]); // nowOdds

    console.log(`Sorting: ${a[20]} (${a[52]}) = ${oddsA}, ${b[20]} (${b[52]}) = ${oddsB}`);

    return oddsA - oddsB;
  });

  for (let i = 0; i < horseRows.length; i++) {
    let row = horseRows[i];
    let horseNumber = row[32] || '';
    let draw = row[33] || '';
    let horseName = row[20] || '';
    let age = row[22] || '';
    let form = row[43] || '';
    let owner = row[31] || '';
    let sire = row[28] || '';
    let dam = row[27] || '';
    let damsire = row[29] || '';
    let horsecomment = row[35] || '';
    let silkUrl = row[41] || '';
    let lastRun = row[42] || '';
    let gender = row[23] || '';
    let color = row[24] || '';
    let nationality = row[25] || '';
    let trainer = row[30] || '';
    let jockey = row[40] || '';
    let weights = row[34] || '';
    let lastnightOdds = row[51] || '-';
    let nowOdds = row[52] || '-';
    let region = row[45] || '';
    let reach14 = row[44] || '';
    let runs14 = row[46] || '';
    let wins14 = row[47] || '';

    let winPct = '-';
    if (runs14 && !isNaN(runs14) && runs14 !== '0') {
      winPct = ((parseInt(wins14) / parseInt(runs14)) * 100).toFixed(1) + '%';
    }

    let jockeyData = masterJockeyMap[jockey] || { raceCount: '0', races: [] };
    let trainerData = masterTrainerMap[trainer] || { raceCount: '0', races: [] };

    let horseRow = document.createElement('tr');
    let isNR = horseNumber.trim().toUpperCase() === "NR";
    if (isNR) horseRow.classList.add("nr-row");
    horseRow.style.backgroundColor = isNR ? "#d3d3d3" : "white";
    horseRow.style.color = isNR ? "#555" : "black";

    let col1 = document.createElement('td');
    let drawDisplay = (draw && draw !== '0') ? `(${draw})` : '';
    col1.innerHTML = `<div class="horse-num-draw">${horseNumber} ${drawDisplay}</div>記錄<div>${form}</div>`;
    horseRow.appendChild(col1);

    let col2 = document.createElement('td');
    col2.innerHTML = silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : '';
    horseRow.appendChild(col2);

    let infoCell = document.createElement('td');
    const genderCN = genderMap[gender] || gender;
    const colorCN = colorMap[color] || color;
    const nationalityCN = nationalityMap[nationality] || nationality;

    infoCell.innerHTML = `
      <div class="horse-name">${horseName}</div>
      <div>${genderCN} | ${colorCN} | ${nationalityCN}</div>
    `;
    horseRow.appendChild(infoCell);

    horseRow.appendChild(createTd(age));
    horseRow.appendChild(createTd(formatWeight(weights)));
    horseRow.appendChild(createTd(`<div>${jockey}</div><div>今日騎師策騎: ${jockeyData.raceCount} 匹</div>`));
    horseRow.appendChild(createTd(`
  <div>${trainer}</div>
  <div>今日練馬師出賽: ${trainerData.raceCount}匹</div>
  <div>達標: ${reach14}%</div>
  <div>參賽: ${runs14}匹  勝出: ${wins14}匹  勝出%: ${winPct}</div>
  <div>地區: ${region}</div>
`));

    const lastnightFraction = mapFractionalOdds(lastnightOdds);
    horseRow.appendChild(createTd(lastnightFraction));

    const nowFraction = mapFractionalOdds(nowOdds);
    horseRow.appendChild(createTd(`<span class="red-odd">${nowFraction}</span>`));

    table.appendChild(horseRow);

    let formRow = document.createElement('tr');
    let formCell = document.createElement('td');
    formCell.colSpan = 9;

    // Create race form table immediately with all data
    const raceFormTableHTML = createRaceFormTable(horseName);
    formCell.innerHTML = `
      <div class="horse-comment">翻譯中…</div>
      <div class="race-form-table">${raceFormTableHTML}</div>
    `;
    formRow.appendChild(formCell);
    table.appendChild(formRow);

    (async function (cell, isNR, owner, sire, dam, damsire, horseName, horsecomment, formRow) {
      const translatedComment = await translateToChinese(horsecomment || '');

      if (!isNR) {
        cell.innerHTML = `
      <div class="horse-info">馬主: ${owner}</div>
      <div class="horse-pedigree">父系 ${sire} - 母系 ${dam} (外祖父 ${damsire})</div>
      <div class="horse-comment">${translatedComment}</div>
      <div class="race-form-table">${createRaceFormTable(horseName)}</div>
    `;
      } else {
        cell.innerHTML = `
      <div class="horse-info">馬主: ${owner}</div>
      <div class="horse-pedigree">父系 ${sire} - 母系 ${dam} (外祖父 ${damsire})</div>
      <div class="horse-comment">${translatedComment}</div>
    `;
        formRow.classList.add("nr-row");
      }
    })(formCell, isNR, owner, sire, dam, damsire, horseName, horsecomment, formRow);
  }

  function createTd(content) {
    let td = document.createElement('td');
    td.innerHTML = content;
    return td;
  }

  // Initial update of race form display
  setTimeout(() => {
    updateRaceFormDisplay();
  }, 100);

  // Auto-highlight horse if one was requested from navigation
  setTimeout(() => {
    const horseToHighlight = sessionStorage.getItem('horseToHighlight');
    const horseRaceKey = sessionStorage.getItem('horseRaceKey');

    console.log('🔍 Auto-highlight check - Horse:', horseToHighlight, 'RaceKey:', horseRaceKey, 'Current Race:', raceKey);

    if (horseToHighlight && horseRaceKey === raceKey) {
      console.log('🚀 Auto-highlighting horse:', horseToHighlight);
      highlightHorseInRace(horseToHighlight);
      sessionStorage.removeItem('horseToHighlight');
      sessionStorage.removeItem('horseRaceKey');
      console.log('✅ Auto-highlight completed for:', horseToHighlight);
    } else if (horseToHighlight) {
      console.log('❌ Race key mismatch - Expected:', horseRaceKey, 'Got:', raceKey);
    } else {
      console.log('ℹ️ No horse to auto-highlight');
    }
  }, 500);
}

// ===============================
// 🔵 HORSE NAVIGATION FUNCTIONS
// ===============================
function navigateToHorse(horseID, horseName) {
  console.log('=== NAVIGATING TO HORSE ===');
  console.log('Input - HorseID:', horseID, 'HorseName:', horseName);
  console.log('Total available mappings:', Object.keys(horseRaceMap).length);

  let horseData = null;
  const cleanHorseName = horseName.toLowerCase().trim();

  // Strategy 1: Exact name match
  const exactMatch = Object.values(horseRaceMap).find(horse =>
    horse.horseName.toLowerCase() === cleanHorseName
  );

  if (exactMatch) {
    horseData = exactMatch;
    console.log('✅ Found by exact name match');
  }
  // Strategy 2: HorseID match (if available)
  else if (horseID && horseID !== '' && horseRaceMap[horseID]) {
    horseData = horseRaceMap[horseID];
    console.log('✅ Found by HorseID');
  }
  // Strategy 3: Partial name match
  else {
    console.log('🔍 Trying partial name matching...');
    const partialMatches = Object.values(horseRaceMap).filter(horse =>
      horse.horseName.toLowerCase().includes(cleanHorseName) ||
      cleanHorseName.includes(horse.horseName.toLowerCase())
    );

    if (partialMatches.length === 1) {
      horseData = partialMatches[0];
      console.log('✅ Found by partial name match');
    } else if (partialMatches.length > 1) {
      console.log('❌ Multiple matches found:', partialMatches.map(h => h.horseName));
      horseData = partialMatches[0];
      console.log('✅ Using first partial match');
    }
  }

  if (!horseData) {
    console.error('❌ Horse not found in mapping');
    console.log('Available horse names:', Object.values(horseRaceMap).map(h => h.horseName).slice(0, 10));

    const availableHorses = Object.values(horseRaceMap).map(h => h.horseName);
    const similarHorses = availableHorses.filter(name =>
      name.toLowerCase().includes(cleanHorseName.substring(0, 4))
    );

    let errorMsg = `Horse "${horseName}" not found in current racecard data.\n\n`;
    errorMsg += `Possible reasons:\n`;
    errorMsg += `• Horse may not be running today\n`;
    errorMsg += `• Names may not match exactly\n`;
    errorMsg += `• Data may still be loading\n\n`;

    if (similarHorses.length > 0) {
      errorMsg += `Similar horses found:\n${similarHorses.slice(0, 3).join('\n')}`;
    }

    alert(errorMsg);
    return;
  }

  console.log('✅ Found horse data:', horseData);

  // Store the horse to highlight after race loads
  sessionStorage.setItem('horseToHighlight', horseData.horseName);
  sessionStorage.setItem('horseRaceKey', horseData.raceKey);

  // Switch to races tab first
  showTab('races');

  // Force a small delay to ensure tab switch completes
  setTimeout(() => {
    const raceKey = horseData.raceKey;
    console.log('🎯 Loading race:', raceKey);

    if (globalRaceRows[raceKey]) {
      console.log('✅ Race found in globalRaceRows, displaying immediately...');
      localStorage.setItem('activeRace', raceKey);

      // Clear current display and show loading
      const raceDetails = document.getElementById('race-details');
      if (raceDetails) {
        raceDetails.innerHTML = '<div class="loading">Loading race...</div>';
      }

      // Display the race immediately
      displayRace(globalRaceRows[raceKey], raceKey);

      // Update the race dropdown to show selected race
      updateRaceSelection(raceKey);

    } else {
      console.error('❌ Race not found in globalRaceRows:', raceKey);
      console.log('Available races:', Object.keys(globalRaceRows));
      alert(`Race ${raceKey} not found. Please try refreshing the page to reload racecard data.`);
    }
  }, 100);
}

function updateRaceSelection(raceKey) {
  // Update dropdown selection
  const allRaceTimes = document.querySelectorAll('#race-dropdown .race-time');
  allRaceTimes.forEach(timeSpan => {
    timeSpan.classList.remove('selected-race');
    if (timeSpan.getAttribute('data-race-key') === raceKey) {
      timeSpan.classList.add('selected-race');
    }
  });

  // Update subbar if it exists
  const subbarButtons = document.querySelectorAll('#race-subbar-container .subbar-btn');
  subbarButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === raceKey.split('  ')[0]) {
      btn.classList.add('active');
    }
  });

  console.log('✅ Updated race selection for:', raceKey);
}

function highlightHorseInRace(horseName) {
  console.log('🔍 Looking for horse to highlight:', horseName);

  let attempts = 0;
  const maxAttempts = 15;

  const findAndHighlight = () => {
    attempts++;

    const horseNameElements = document.querySelectorAll('.horse-name');
    let targetRow = null;

    for (let element of horseNameElements) {
      const elementHorseName = element.textContent.trim();
      if (elementHorseName.toLowerCase().includes(horseName.toLowerCase())) {
        targetRow = element.closest('tr');
        console.log('✅ Found horse row:', elementHorseName);
        break;
      }
    }

    if (targetRow) {
      // Scroll to horse with smooth animation
      targetRow.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Highlight effect
      const originalBackground = targetRow.style.backgroundColor;
      targetRow.style.transition = 'all 0.5s ease';
      targetRow.style.backgroundColor = '#ffff99';
      targetRow.style.boxShadow = '0 0 20px rgba(255, 204, 0, 0.9)';

      // Remove highlight after 4 seconds
      setTimeout(() => {
        targetRow.style.backgroundColor = originalBackground;
        targetRow.style.boxShadow = '';
      }, 4000);

      console.log('🎯 Horse highlighted successfully');
    } else if (attempts < maxAttempts) {
      console.log('⏳ Horse not found yet, attempt', attempts);
      setTimeout(findAndHighlight, 300);
    } else {
      console.warn('❌ Horse not found after', maxAttempts, 'attempts:', horseName);
    }
  };

  findAndHighlight();
}

function addHorseClickHandlers() {
  const clickableHorses = document.querySelectorAll('.clickable-horse');
  console.log('🔄 Adding click handlers to', clickableHorses.length, 'horses');
  console.log('📊 Data status - Racecard:', racecardDataLoaded, 'DropOdds:', dropOddsDataLoaded, 'Horse mappings:', Object.keys(horseRaceMap).length);

  clickableHorses.forEach((horseElement, index) => {
    horseElement.style.cursor = 'pointer';
    horseElement.style.textDecoration = 'underline';
    horseElement.style.color = '#0066cc';

    // Remove any existing click handlers to prevent duplicates
    horseElement.replaceWith(horseElement.cloneNode(true));
    const newHorseElement = document.querySelectorAll('.clickable-horse')[index];

    newHorseElement.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const horseID = this.getAttribute('data-horse-id');
      const horseName = this.getAttribute('data-horse-name');

      console.log(`🐎 Horse clicked: "${horseName}"`);

      // ✅ CHECK IF DATA IS READY
      if (!isDataReadyForNavigation()) {
        console.warn('❌ Data not fully loaded yet');
        console.log('Racecard loaded:', racecardDataLoaded);
        console.log('DropOdds loaded:', dropOddsDataLoaded);
        console.log('Horse mappings:', Object.keys(horseRaceMap).length);

        alert('Racecard data is still loading. Please wait a moment and try again.');
        return;
      }

      navigateToHorse(horseID, horseName);
    });

    newHorseElement.addEventListener('mouseenter', function () {
      this.style.color = '#004499';
    });

    newHorseElement.addEventListener('mouseleave', function () {
      this.style.color = '#0066cc';
    });
  });
}

// ===============================
// 🔵 DROP ODDS PAGE FUNCTIONS
// ===============================
const loadDropOdds = debounce(function loadDropOdds() {
  const container = document.getElementById("drop-odds-container");
  const scrollPosition = window.scrollY || document.documentElement.scrollTop;
  container.innerHTML = '<div class="loading">載入中...</div>';

  const cacheKey = 'dropOddsData';
  const cacheTimeKey = 'dropOddsDataTime';
  const cacheExpiry = 2 * 60 * 1000;

  // Check cache first
  const cachedData = localStorage.getItem(cacheKey);
  const cachedTime = localStorage.getItem(cacheTimeKey);

  if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime)) < cacheExpiry) {
    console.log('📦 Using cached drop odds data');
    processDropOddsData(JSON.parse(cachedData), scrollPosition);
    return;
  }

  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/dropodds.csv?cb=" + Date.now(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.errors && results.errors.length > 0) {
        console.error('Dropodds CSV parsing errors:', results.errors);
        container.innerHTML = '<div class="error">數據加載錯誤</div>';
        return;
      }

      localStorage.setItem(cacheKey, JSON.stringify(results.data));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
      processDropOddsData(results.data, scrollPosition);
    },
    error: function (err) {
      console.error('Failed to load dropodds CSV:', err);
      dropOddsDataLoaded = false;
    }
  });
}, 500);

function processDropOddsData(data, scrollPosition) {
  const processedData = data
    .map(row => {
      const trimmedRow = {};
      Object.keys(row).forEach(k => {
        const key = k.trim();
        trimmedRow[key] = row[k] ? row[k].toString().trim() : '';
      });
      return trimmedRow;
    })
    .filter(row => {
      if (!row['Horse Name'] || !row['Time'] || row['Horse Name'] === 'Horse Name' || !row['NOW']) {
        return false;
      }

      const originalDec = parseFloat(row['Original']) || 0;
      const nowDec = parseFloat(row['NOW']) || 0;
      if (!originalDec || !nowDec) return false;

      const origFracVal = originalDec > 1 ? originalDec - 1 : 0;
      const nowFracVal = nowDec > 1 ? nowDec - 1 : 0;
      if (!origFracVal || !nowFracVal) return false;

      const pctDrop = ((origFracVal - nowFracVal) / origFracVal) * 100;
      return pctDrop >= 48;
    })
    .sort((a, b) => a['Time'].localeCompare(b['Time'], undefined, { numeric: true }));

  renderDropOddsTable(processedData);
  dropOddsDataLoaded = true;

  // Add click handlers after a brief delay to ensure DOM is ready
  setTimeout(addHorseClickHandlers, 100);

  setTimeout(() => window.scrollTo(0, scrollPosition), 0);
}

function renderDropOddsTable(data) {
  const container = document.getElementById("drop-odds-container");
  const isMobilePortrait = window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;

  if (data.length === 0) {
    container.innerHTML = '<div class="error">沒有數據 (Empty)</div>';
    return;
  }

  let tableHTML = `
        <table class="drop-odds-table">
            <thead>
                <tr>
                    <th>賽時</th>
                    ${isMobilePortrait ? '<th>場地</th>' : '<th>場地</th>'}
                    <th>號</th>
                    <th>馬名</th>
                    <th>隔夜</th>
                    <th>最近</th>
                    <th>變動</th>
                    <th>變 %</th>
                    <th>賽果</th>
                    ${isMobilePortrait ? '' : '<th>贏賠率</th>'}
                </tr>
            </thead>
            <tbody>
    `;

  data.forEach((row, index) => {
    const originalDec = parseFloat(row['Original']) || 0;
    const nowDec = parseFloat(row['NOW']) || 0;
    const changeDec = parseFloat(row['Change']) || (nowDec - originalDec);
    const origFracVal = originalDec > 1 ? originalDec - 1 : 0;
    const nowFracVal = nowDec > 1 ? nowDec - 1 : 0;
    const pctChange = parseFloat(row['%']) || (origFracVal ? ((nowFracVal - origFracVal) / origFracVal) * 100 : 0);

    const colorClass = pctChange >= 70 ? 'gold' : pctChange >= 60 ? 'red' : pctChange >= 48 ? 'green' : '';

    const originalFrac = decimalToFractional(originalDec);
    const nowFrac = decimalToFractional(nowDec);
    const spFrac = decimalToFractional(parseFloat(row['SP Odds']));

    const timeCellContent = row['Time'] || '--';

    const horseID = row['HorseID'] || '';
    const horseName = row['Horse Name'] || '';
    const clickableHorse = horseName ?
      `<span class="clickable-horse" data-horse-id="${horseID}" data-horse-name="${horseName}">${horseName}</span>` :
      '--';

    tableHTML += `
            <tr>
                <td class="time-cell">${timeCellContent}</td>
                <td class="course-cell">${row['Course'] || '--'}</td>
                <td>${row['Num'] || '--'}</td>
                <td>${clickableHorse}</td>
                <td>${originalFrac}</td>
                <td>${nowFrac}</td>
                <td class="${colorClass}">${formatDecimal(changeDec)}</td>
                <td class="${colorClass}">${Math.round(pctChange)}%</td>
                <td>${row['FIN'] || '--'}</td>
                ${isMobilePortrait ? '' : `<td>${spFrac || '--'}</td>`}
            </tr>
        `;
  });

  tableHTML += '</tbody></table>';
  container.innerHTML = tableHTML;
}

// ===============================
// 🔵 RESULTS PAGE FUNCTIONS
// ===============================
const loadResultsCSV = debounce(function loadResultsCSV() {
  const cacheKey = 'resultsCSV';
  const cacheTimeKey = 'resultsCSVTime';
  const cacheExpiry = 2 * 60 * 1000;

  // Check cache first
  const cachedData = localStorage.getItem(cacheKey);
  const cachedTime = localStorage.getItem(cacheTimeKey);

  if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime)) < cacheExpiry) {
    console.log('📦 Using cached results data');
    processResultsData(JSON.parse(cachedData));
    return;
  }

  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/result.csv?cb=" + Date.now(), {
    download: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.errors && results.errors.length > 0) {
        console.error('CSV parsing errors:', results.errors);
        return;
      }

      localStorage.setItem(cacheKey, JSON.stringify(results.data));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
      processResultsData(results.data);
    },
    error: function (err) {
      console.error('Failed to load results CSV:', err);
    }
  });
}, 500);

function processResultsData(data) {
  const rows = data.slice(1).filter(r => r.length > 3);
  allResultsRows = rows;
  allTimes = [];
  courseToTimes = {};

  processRaceDataChunked(rows, 200, (r) => {
    const course = r[1]?.trim();
    const t = r[3]?.trim();
    if (!course || !t) return;

    const converted = convertRaceTime(t);
    allTimes.push({ course, time: converted });

    if (!courseToTimes[course]) courseToTimes[course] = new Set();
    courseToTimes[course].add(converted);
  }).then(() => {
    // Convert Sets to Arrays and sort
    Object.keys(courseToTimes).forEach(c => {
      courseToTimes[c] = Array.from(courseToTimes[c]).sort(sortTimes);
    });

    resultsDataLoaded = true;
    buildCourseTabs(["LATEST", ...Object.keys(courseToTimes)]);
    buildTimeTabsForLatest();
  });
}

function fixTime12(t) {
  if (!t || t.length < 4) return t;
  let [hh, mm] = t.split(":");
  hh = parseInt(hh, 10);
  if (hh <= 9) hh += 12;
  return (hh < 10 ? "0" + hh : hh) + ":" + mm;
}

function formatRaceDate(csvDate) {
  if (!csvDate) return "";
  csvDate = csvDate.trim();
  const parts = csvDate.includes("/") ? csvDate.split("/") : csvDate.split("-");
  if (parts.length !== 3) return csvDate;

  const day = parseInt(parts[2], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[0], 10);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let suffix = "th";
  if (day === 1 || day === 21 || day === 31) suffix = "st";
  else if (day === 2 || day === 22) suffix = "nd";
  else if (day === 3 || day === 23) suffix = "rd";

  return `${day}${suffix} ${months[monthIndex]} ${year}`;
}

function buildCourseTabs(list) {
  const container = document.getElementById("smallTabsContainer");
  container.innerHTML = "";

  list.forEach(course => {
    const tab = document.createElement("div");
    tab.className = "small-tab" + (course === "LATEST" ? " latest-tab active" : "");
    tab.textContent = course;

    tab.addEventListener("click", () => {
      document.querySelectorAll(".small-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      selectedCourse = course;
      if (course === "LATEST") buildTimeTabsForLatest();
      else buildTimeTabsForCourse(course);
    });

    container.appendChild(tab);
  });
}

function buildTimeTabsForLatest() {
  const container = document.getElementById("sideTabsContainer");
  container.innerHTML = "";

  // Check if data is loaded
  if (!resultsDataLoaded || allResultsRows.length === 0) {
    container.innerHTML = '<div class="loading">Loading results data...</div>';
    return;
  }

  const now = new Date();
  const nowHM = now.getHours() * 100 + now.getMinutes();
  let finished = allTimes.filter(t => {
    const [h, m] = t.time.split(":").map(Number);
    return (h * 100 + m) < nowHM;
  });
  if (finished.length === 0) finished = [...allTimes];

  finished.sort((a, b) => {
    const [ha, ma] = a.time.split(":").map(Number);
    const [hb, mb] = b.time.split(":").map(Number);
    return (hb * 100 + mb) - (ha * 100 + ma);
  });

  const uniqueTimes = [];
  const seen = new Set();
  for (const item of finished) {
    if (!seen.has(item.time)) {
      uniqueTimes.push(item.time);
      seen.add(item.time);
    }
  }

  const latest3 = uniqueTimes.slice(0, 10);

  if (latest3.length === 0) {
    container.innerHTML = '<div class="no-data">No recent races found</div>';
    return;
  }

  latest3.forEach((time, i) => {
    const tab = document.createElement("div");
    tab.className = "side-tab" + (i === 0 ? " active" : "");
    tab.textContent = time;
    if (i === 0) selectedTime = time;

    tab.addEventListener("click", () => {
      document.querySelectorAll(".side-tab").forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      selectedTime = time;
      updateContentPlaceholder();
    });

    container.appendChild(tab);
  });

  updateContentPlaceholder();
}

function buildTimeTabsForCourse(course) {
  const container = document.getElementById("sideTabsContainer");
  container.innerHTML = "";

  const list = courseToTimes[course] || [];
  list.forEach((time, index) => {
    const tab = document.createElement("div");
    tab.className = "side-tab" + (index === 0 ? " active" : "");
    tab.textContent = time;
    if (index === 0) selectedTime = time;

    tab.addEventListener("click", () => {
      document.querySelectorAll(".side-tab").forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      selectedTime = time;
      updateContentPlaceholder();
    });

    container.appendChild(tab);
  });

  updateContentPlaceholder();
}

function updateContentPlaceholder() {
  const content = document.querySelector(".tab-display-area .tab-placeholder");
  content.innerHTML = "";

  // Check if data is ready
  if (!resultsDataLoaded || allResultsRows.length === 0) {
    content.innerHTML = '<div class="loading">Loading race results...</div>';
    return;
  }

  const rowsToShow = allResultsRows.filter(r => {
    const course = r[1]?.trim();
    const time = convertRaceTime(r[3]?.trim());
    if (selectedCourse === "LATEST") return selectedTime === time;
    return course === selectedCourse && time === selectedTime;
  });

  if (rowsToShow.length === 0) {
    content.innerHTML = '<div class="no-data">No results available for this race.</div>';
    return;
  }

  const raceContainer = document.createElement("div");
  raceContainer.className = "race-container";
  const first = rowsToShow[0];
  const raceDate = formatRaceDate(first[2]);
  const fixedTime = fixTime12(first[3]);
  const courseName = first[1];
  const classDistanceGoingSurface = `${first[5]} | ${first[6]} | ${first[7]} | ${first[8]}`;

  raceContainer.innerHTML = `
    <div class="race-topline-date">${raceDate}</div>
    <div class="race-topline-time-course">${fixedTime} - ${courseName}</div>
    <div class="race-topline-details">${classDistanceGoingSurface}</div>
  `;

  const table = document.createElement("table");
  table.className = "results-table";
  const header = document.createElement("tr");
  ["Pos", "Horse", "SP", "Jockey", "Trainer", "Age", "Wgt"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    header.appendChild(th);
  });
  table.appendChild(header);

  rowsToShow.forEach((r, rowIndex) => {
    const tr = document.createElement("tr");
    const silkUrl = r[21];
    const horseName = r[10];
    const horseWithSilk = silkUrl
      ? `<img src="${silkUrl}" class="silk-icon" onerror="this.style.display='none'"> ${horseName}`
      : horseName;

    const draw = r[14] ? ` (${r[14]})` : "";
    const spRaw = r[13] ?? "";
    const fracOdds = decimalToFractional(spRaw);
    const newWeight = lbsToStoneLb(r[17]);

    const tdMapping = [
      r[12] + draw,
      horseWithSilk,
      fracOdds,
      r[15],
      r[16],
      r[11],
      newWeight
    ];

    tdMapping.forEach((val, colIndex) => {
      const td = document.createElement("td");
      td.innerHTML = val;

      if (colIndex === 0 && rowIndex !== 0) {
        const beatenBy = r[18] || "";
        if (beatenBy) td.innerHTML += `<div class="beaten-by"><small>輸距離: ${beatenBy}</small></div>`;
      }

      tr.appendChild(td);
    });

    table.appendChild(tr);

    const infoRow = document.createElement("tr");
    const infoCell = document.createElement("td");
    infoCell.colSpan = 7;
    const comment = r[19] || "";
    const finish = r[20] || "";
    infoCell.innerHTML = `
      <div class="extra-info">
        ${comment ? `<div><b>Comment:</b> ${comment}</div>` : ""}
        ${finish ? `<div><b>Finish Time:</b> ${finish}</div>` : ""}
      </div>
    `;
    infoRow.appendChild(infoCell);
    table.appendChild(infoRow);
  });

  raceContainer.appendChild(table);
  content.appendChild(raceContainer);
}

// ===============================
// 🔵 INITIALIZATION & EVENT HANDLERS
// ===============================
document.addEventListener("DOMContentLoaded", function () {
  // Initialize tab handlers
  const tabHandlers = {
    "race-tab": () => showTab("races"),
    "drops-tab": () => showTab("drops"),
    "results-tab": () => {
      showTab("results");
      loadResultsCSV();
    }
  };

  Object.entries(tabHandlers).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) element.addEventListener("click", handler);
  });

  // Load initial data
  horseRaceMap = {};
  loadRacecard();
  loadDropOdds();

  // Load secondary data after a delay
  setTimeout(() => {
    loadRaceFormData();
    if (activeTab === 'results') {
      loadResultsCSV();
    }
  }, 1000);

  // Set up race dropdown interactions
  const raceTab = document.querySelector('.tab[data-tab="races"]');
  const dropdown = document.getElementById('race-dropdown');
  const arrow = raceTab?.querySelector('.arrow');
  const raceCourses = document.getElementById('race-courses');

  if (arrow) {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      updateRaceArrow();
    });
  }

  if (raceCourses) {
    raceCourses.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('race-time')) {
        const prevSelected = raceCourses.querySelector('.selected-race');
        if (prevSelected) prevSelected.classList.remove('selected-race');
        target.classList.add('selected-race');

        const raceKey = target.dataset.raceKey;
        if (!raceTab.classList.contains('active')) raceTab.click();

        if (globalRaceRows[raceKey]) {
          displayRace(globalRaceRows[raceKey], raceKey);
        }

        const isMobile = window.innerWidth <= 1024;
        if (isMobile) {
          const raceList = document.getElementById('race-list');
          if (raceList) raceList.classList.remove('open');
        } else {
          dropdown.classList.remove('open');
        }
        updateRaceArrow();
      }
    });
  }

  // Set up auto-refresh intervals
  function startAutoRefresh() {
    setInterval(() => {
      const activeTab = localStorage.getItem('activeTab') || 'races';
      if (activeTab === 'races') {
        loadRacecard();
        loadRaceFormData();
      } else if (activeTab === 'drops' || activeTab === 'drop-log') {
        loadDropOdds();
      }
    }, 10 * 60 * 1000);
  }

  // Set interval for results refresh
  setInterval(() => {
    if (activeTab === 'results') {
      loadResultsCSV();
    }
  }, 10 * 60 * 1000);

  startAutoRefresh();

  // Restore last position
  const lastPosition = localStorage.getItem('scrollPosition');
  if (lastPosition) setTimeout(() => window.scrollTo(0, parseInt(lastPosition)), 0);

  // Save scroll position before unload
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('scrollPosition', window.scrollY || document.documentElement.scrollTop);
  });

  // Memory cleanup
  window.addEventListener('beforeunload', function () {
    allResultsRows = [];
    globalRaceRows = {};
    horseRaceMap = {};
    masterJockeyMap = {};
    masterTrainerMap = {};
  });

  showTab(activeTab);
});

// Global function for manual refresh
function refreshAllData() {
  console.log('🔄 Manually refreshing all data...');
  racecardDataLoaded = false;
  dropOddsDataLoaded = false;
  horseRaceMap = {};

  // Clear cache
  localStorage.removeItem('racecardData');
  localStorage.removeItem('racecardDataTime');
  localStorage.removeItem('dropOddsData');
  localStorage.removeItem('dropOddsDataTime');
  localStorage.removeItem('resultsCSV');
  localStorage.removeItem('resultsCSVTime');

  loadRacecard();
  loadDropOdds();

  setTimeout(() => {
    addHorseClickHandlers();
  }, 2000);
}

// Global function for race form toggle
window.toggleRaceForm = function () {
  const showRaceForm = localStorage.getItem('showRaceForm') === 'true';
  const newValue = !showRaceForm;
  localStorage.setItem('showRaceForm', newValue);
  const raceDetails = document.getElementById('race-details');
  if (raceDetails) raceDetails.style.display = newValue ? 'block' : 'none';
};