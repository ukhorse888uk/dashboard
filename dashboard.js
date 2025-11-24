// ===============================
// 🔵 GLOBAL VARIABLES
// ===============================
let activeTab = localStorage.getItem('activeTab') || 'races';
let masterJockeyMap = {};
let masterTrainerMap = {};
let raceNumberMap = {};
let raceFormData = {};
let scrollPosition = 0;
let raceFormVisibilityState = {};
let showRaceForm = localStorage.getItem('showRaceForm') === 'true';
let allTimes = [];
let courseToTimes = {};
let selectedCourse = "LATEST";
let selectedTime = "";
let allResultsRows = [];
let globalRaceRows = {};
let resultsDataLoaded = false;

// 🔵 HORSE NAVIGATION VARIABLES
let horseRaceMap = {};
let raceHorseMap = {};

// =========================================
// TAB SWITCH FUNCTION — controls page views
// =========================================
function showTab(tab) {
  console.log('Switching to tab:', tab);

  // Safely get elements
  const raceDetailsWrapper = document.getElementById("race-details-wrapper");
  const dropOdds = document.getElementById("drop-odds");
  const resultSection = document.getElementById("result-section");

  if (raceDetailsWrapper) raceDetailsWrapper.style.display = "none";
  if (dropOdds) dropOdds.style.display = "none";
  if (resultSection) resultSection.style.display = "none";

  if (tab === "races" && raceDetailsWrapper) {
    raceDetailsWrapper.style.display = "block";
  }
  if (tab === "drops" && dropOdds) {
    dropOdds.style.display = "block";
  }
  if (tab === "results" && resultSection) {
    resultSection.style.display = "block";
  }

  // Safely update tab classes
  document.querySelectorAll(".tab").forEach(t => {
    if (t && t.classList) {
      t.classList.remove("active");
    }
  });

  const activeTabElement = document.getElementById(tab + "-tab");
  if (activeTabElement && activeTabElement.classList) {
    activeTabElement.classList.add("active");
  }

  localStorage.setItem("activeTab", tab);
}
// ===============================
// 🔵 DOM READY – TAB CLICK HANDLERS
// ===============================
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("race-tab").addEventListener("click", () => showTab("races"));
  document.getElementById("drops-tab").addEventListener("click", () => showTab("drops"));
  document.getElementById("results-tab").addEventListener("click", () => {
    showTab("results");
    loadResultsCSV();
  });

  // ==============================
  // 🔵 Persistent Race Form Toggle
  // ==============================
  const raceDetails = document.getElementById('race-details');

  function updateRaceFormDisplay() {
    raceDetails.style.display = showRaceForm ? 'block' : 'none';
  }

  updateRaceFormDisplay();
  showTab(activeTab);

  window.toggleRaceForm = function () {
    showRaceForm = !showRaceForm;
    localStorage.setItem('showRaceForm', showRaceForm);
    updateRaceFormDisplay();
  };
});

// ===============================
// 🔵 RESULTS SECTION
// ===============================

function loadResultsCSV() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/result.csv?cb=" + Date.now(), {
    download: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.errors && results.errors.length > 0) {
        console.error('CSV parsing errors:', results.errors);
        return;
      }

      const rows = results.data.slice(1).filter(r => r.length > 3);
      allResultsRows = rows;
      allTimes = [];
      courseToTimes = {};

      rows.forEach(r => {
        const course = r[1]?.trim();
        const t = r[3]?.trim();
        if (!course || !t) return;

        const converted = convertRaceTime(t);
        allTimes.push({ course, time: converted });

        if (!courseToTimes[course]) courseToTimes[course] = [];
        if (!courseToTimes[course].includes(converted))
          courseToTimes[course].push(converted);
      });

      Object.keys(courseToTimes).forEach(c => {
        courseToTimes[c].sort(sortTimes);
      });

      resultsDataLoaded = true;
      buildCourseTabs(["LATEST", ...Object.keys(courseToTimes)]);
      buildTimeTabsForLatest();
    },
    error: function (err) {
      console.error('Failed to load results CSV:', err);
    }
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

function convertRaceTime(t) {
  if (!t || !t.includes(":")) return t;
  let [h, m] = t.split(":");
  h = parseInt(h, 10);
  m = (m || "00").padStart(2, "0");
  if (h >= 0 && h <= 9) return `${h + 12}:${m}`;
  return `${h}:${m}`;
}

function sortTimes(a, b) {
  const [ha, ma] = a.split(":").map(Number);
  const [hb, mb] = b.split(":").map(Number);
  return ha === hb ? ma - mb : ha - hb;
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

const fractionalOddsMap = {
  "6.5": "11/2", "17": "16/1", "4.33": "10/3", "1.5": "6/4", "3/2": "6/4", "2": "1/1",
  "333/100": "10/3", "500/100": "5/1", "100/33": "3/1", "250/100": "5/2", "163/100": "13/8",
  "69/50": "11/8", "47/25": "15/8", "91/100": "10/11", "73/100": "8/13", "4/2": "7/4",
  "6/2": "11/4"
};

function decimalToFractional(raw) {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).trim();
  if (s === "") return "";
  if (s.includes("/")) return fractionalOddsMap[s] || s;

  const d = parseFloat(s);
  if (isNaN(d)) return s;

  const EPS = 1e-6;
  for (const k in fractionalOddsMap) {
    const kn = parseFloat(k);
    if (!isNaN(kn) && Math.abs(kn - d) < EPS) return fractionalOddsMap[k];
  }

  const fracVal = d - 1;
  if (Math.abs(fracVal - Math.round(fracVal)) < EPS) return `${Math.round(fracVal)}/1`;

  let numerator = fracVal;
  let denominator = 1;
  let limit = 12;
  while (Math.abs(Math.round(numerator) - numerator) > 1e-9 && limit > 0) {
    numerator *= 10;
    denominator *= 10;
    limit--;
  }
  numerator = Math.round(numerator);

  const gcd = (a, b) => {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a || 1;
  };
  const g = gcd(numerator, denominator);
  numerator /= g;
  denominator /= g;

  const frac = `${numerator}/${denominator}`;
  return fractionalOddsMap[frac] || frac;
}

function lbsToStoneLb(lbs) {
  if (!lbs || isNaN(lbs)) return lbs;
  lbs = parseInt(lbs);
  let stone = Math.floor(lbs / 14);
  let remaining = lbs % 14;
  return `${stone}st ${remaining}lb`;
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

// Update the DOMContentLoaded to restore Latest tab when switching back to results
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("results-tab").addEventListener("click", () => {
    showTab("results");
    loadResultsCSV();

    setTimeout(() => {
      if (selectedCourse === "LATEST" && resultsDataLoaded) {
        buildTimeTabsForLatest();
      }
    }, 100);
  });
});

setInterval(() => {
  loadResultsCSV();
}, 5 * 60 * 1000);

// ===============================
// 🔵 CLEAN NAME & MASTER MAPS
// ===============================
function cleanName(name) {
  return name ? name.trim() : '';
}

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

function getJockeyRaceCount(siteName) {
  const key = siteName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
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

function getJockeyRaceCount(siteName) {
  const key = siteName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
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

function validateRaceData(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('Invalid race data received');
    return false;
  }

  return data.every(row =>
    row &&
    Array.isArray(row) &&
    row.length > 0 &&
    row[0]
  );
}

function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard2.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      console.log('🔍 === RACECARD2.CSV DEBUG ===');

      if (results.errors && results.errors.length > 0) {
        console.error('Racecard CSV parsing errors:', results.errors);
        return;
      }

      const dataWithoutHeader = results.data.slice(1).filter(row => row && row.length > 0);
      if (!dataWithoutHeader || dataWithoutHeader.length === 0) {
        console.warn('No racecard data found');
        return;
      }

      const raceRows = dataWithoutHeader;

      // EXTENSIVE DEBUG: Check column structure
      if (raceRows.length > 0) {
        console.log('Total rows:', raceRows.length);
        console.log('First row column count:', raceRows[0].length);

        // Check first row to understand the structure
        console.log('🎯 FIRST ROW SAMPLE (first 15 columns):');
        for (let i = 0; i < Math.min(15, raceRows[0].length); i++) {
          console.log(`Column ${i}: "${raceRows[0][i]}"`);
        }

        // Check around HorseID/RaceID area (columns 45-55)
        console.log('🎯 HORSEID/RACEID AREA (columns 45-55):');
        for (let i = 45; i <= 55; i++) {
          if (i < raceRows[0].length) {
            console.log(`Column ${i}: "${raceRows[0][i]}"`);
          }
        }

        // ✅ UPDATED: Check specific columns with correct HorseID/RaceID
        console.log('🎯 UPDATED CODE COLUMNS:');
        console.log(`Column 0 (Course): "${raceRows[0][0]}"`);
        console.log(`Column 2 (Time): "${raceRows[0][2]}"`);
        console.log(`Column 20 (Horse Name): "${raceRows[0][20]}"`);
        console.log(`Column 48 AX (RaceID): "${raceRows[0][48]}"`);
        console.log(`Column 49 AY (HorseID): "${raceRows[0][49]}"`);

        // Check if HorseID is unique per horse in the first race
        const firstRaceCourse = raceRows[0][0];
        const firstRaceTime = raceRows[0][2];
        const firstRaceHorses = raceRows.filter(row =>
          row[0] === firstRaceCourse && row[2] === firstRaceTime
        );
        console.log('🎯 HorseIDs in first race:',
          firstRaceHorses.map(h => `${h[20]} (HorseID: ${h[49]})`)
        );

        // Check if we have headers in the first row
        console.log('🎯 CHECKING FOR HEADERS:');
        const mightBeHeaders = results.data[0]; // First row of original data
        if (mightBeHeaders && mightBeHeaders.length > 0) {
          console.log('First row might be headers:', mightBeHeaders.slice(0, 10));
        }

        // Check multiple rows to see if HorseID is consistent and unique
        console.log('🎯 HORSEID UNIQUENESS CHECK (first 3 rows):');
        for (let i = 0; i < Math.min(3, raceRows.length); i++) {
          console.log(`Row ${i} - Horse: "${raceRows[i][20]}", HorseID: "${raceRows[i][49]}", RaceID: "${raceRows[i][48]}"`);
        }
      }

      buildMasterMaps(raceRows);
      buildHorseRaceMapping(raceRows);

      const courseMap = {};
      globalRaceRows = {};

      raceRows.forEach(row => {
        const course = (row[0] || '').trim();
        if (!course) return;

        const raceTime = (row[2] || '').trim();
        if (!raceTime) return;

        const raceKey = `${raceTime}  ${course}`;
        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);
        globalRaceRows[raceKey] = courseMap[course][raceKey];
      });

      console.log('📊 Races loaded:', Object.keys(globalRaceRows).length);
      console.log('📊 Courses loaded:', Object.keys(courseMap).length);

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
        if (courseMap[courseName] && courseMap[courseName][activeRaceKey]) {
          displayRace(courseMap[courseName][activeRaceKey], activeRaceKey);
        }
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
    },
    error: function (err) {
      console.error('Failed to load racecard CSV:', err);
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

function cleanText(str) {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E]/g, '-');
}

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
      raceFormVisibilityState[horseId] = true;
    }
  });
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
    "(IRE)": "愛爾蘭", "(AW)": "沙地", "Standard": "標準", "Class 1": "一班", "Class 2": "二班",
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

  let html = '<table class="race-form-table"><thead><tr>';
  html += '<th>日期</th><th>賽事資料</th><th>重量</th><th>賽果（1L = 1個馬位）</th><th>騎師</th><th>OR</th><th>TS</th><th>RPR</th>';
  html += '</tr></thead><tbody>';

  formData.slice(0, 6).forEach(race => {
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

    let col4 = details ? `${kL}(${details})` : kL;
    if (race.colT) {
      const fraction = decimalToFraction(parseFloat(race.colT) - 1);
      col4 += ' ' + fraction;
    }

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

document.addEventListener('DOMContentLoaded', () => {
  const raceDetails = document.getElementById('race-details');
  raceDetails.addEventListener('mousedown', e => e.preventDefault());
});

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
    "333/100": "10/3", "500/100": "5/1", "100/33": "3/1", "250/100": "5/2", "163/100": "13/8",
    "3/2": "6/4", "69/50": "11/8", "47/25": "15/8", "91/100": "10/11", "73/100": "8/13",
    "4/2": "7/4", "6/2": "11/4",
  };

  function mapFractionalOdds(fractionStr) {
    if (!fractionStr) return fractionStr;
    return fractionalOddsMap[fractionStr] || fractionStr;
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

  horseRows.sort((a, b) => (parseFloat(a[52]) || Number.MAX_VALUE) - (parseFloat(b[52]) || Number.MAX_VALUE));

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

    const lastnightDecimal = parseFloat(lastnightOdds) - 1;
    horseRow.appendChild(createTd(mapFractionalOdds(decimalToFraction(lastnightDecimal))));

    const nowDecimal = parseFloat(nowOdds) - 1;
    const nowOddsFraction = mapFractionalOdds(decimalToFraction(nowDecimal));
    horseRow.appendChild(createTd(`<span class="red-odd">${nowOddsFraction}</span>`));

    table.appendChild(horseRow);

    let formRow = document.createElement('tr');
    let formCell = document.createElement('td');
    formCell.colSpan = 9;
    formCell.innerHTML = `<div class="horse-comment">翻譯中…</div>`;
    formRow.appendChild(formCell);
    table.appendChild(formRow);

    (async function (cell, isNR, owner, sire, dam, damsire, horseName, horsecomment, formRow) {
      const translatedComment = await translateToChinese(horsecomment || '');

      if (!isNR) {
        cell.innerHTML = `
      <div class="horse-info">馬主: ${owner}</div>
      <div class="horse-pedigree">父系 ${sire} - 母系 ${dam} (外祖父 ${damsire})</div>
      ${createRaceFormTable(horseName)}
    `;
      } else {
        cell.innerHTML = `
      <div class="horse-info">馬主: ${owner}</div>
      <div class="horse-pedigree">父系 ${sire} - 母系 ${dam} (外祖父 ${damsire})</div>
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

  // ✅ AUTO-HIGHLIGHT FEATURE - Add this at the end of the function
  console.log('🏁 Race display completed, checking for auto-highlight...');

  // Auto-highlight horse if one was requested from navigation
  setTimeout(() => {
    const horseToHighlight = sessionStorage.getItem('horseToHighlight');
    const horseRaceKey = sessionStorage.getItem('horseRaceKey');

    console.log('🔍 Auto-highlight check - Horse:', horseToHighlight, 'RaceKey:', horseRaceKey, 'Current Race:', raceKey);

    if (horseToHighlight && horseRaceKey === raceKey) {
      console.log('🚀 Auto-highlighting horse:', horseToHighlight);

      // Use the enhanced highlight function
      highlightHorseInRace(horseToHighlight);

      // Clear the session storage after highlighting
      sessionStorage.removeItem('horseToHighlight');
      sessionStorage.removeItem('horseRaceKey');

      console.log('✅ Auto-highlight completed for:', horseToHighlight);
    } else if (horseToHighlight) {
      console.log('❌ Race key mismatch - Expected:', horseRaceKey, 'Got:', raceKey);
    } else {
      console.log('ℹ️ No horse to auto-highlight');
    }
  }, 500); // Short delay to ensure DOM is fully rendered
}

// ===============================
// 🔵 HORSE NAVIGATION FUNCTIONS - IMPROVED
// ===============================

function buildHorseRaceMapping(raceRows) {
  if (!raceRows || !Array.isArray(raceRows)) return;

  horseRaceMap = {};
  console.log('Building horse mapping with', raceRows.length, 'rows');

  raceRows.forEach((raceRow, index) => {
    const course = (raceRow[0] || '').trim();
    const time = (raceRow[2] || '').trim();
    const horseName = (raceRow[20] || '').trim();

    if (!course || !time || !horseName) return;

    const raceKey = `${time}  ${course}`;

    // ✅ FIXED: Use Column 50 for HorseID (not 49)
    const horseID = (raceRow[50] || '').trim(); // Column 50 = HorseID
    const raceID = (raceRow[49] || '').trim();  // Column 49 = RaceID

    const cleanHorseName = horseName.toLowerCase().trim();

    if (horseID && horseID !== '') {
      horseRaceMap[horseID] = {
        raceKey: raceKey,
        course: course,
        time: time,
        horseName: horseName,
        raceID: raceID
      };

      // Also map by name for fallback
      horseRaceMap[cleanHorseName] = horseRaceMap[horseID];

      if (index < 3) {
        console.log(`✅ Mapped: "${horseName}" (HorseID: ${horseID}) -> ${raceKey}`);
      }
    } else {
      console.warn(`❌ No HorseID found for: ${horseName}`);
    }
  });

  console.log('Horse mapping complete. Total mapped:', Object.keys(horseRaceMap).length);
  console.log('Sample HorseIDs:', Object.keys(horseRaceMap).slice(0, 5));
}

function navigateToHorse(horseID, horseName) {
  console.log('=== NAVIGATING TO HORSE ===');
  console.log('Input - HorseID:', horseID, 'HorseName:', horseName);
  console.log('Total available mappings:', Object.keys(horseRaceMap).length);

  let horseData = null;
  const cleanHorseName = horseName.toLowerCase().trim();

  // Find horse data
  if (horseRaceMap[cleanHorseName]) {
    horseData = horseRaceMap[cleanHorseName];
    console.log('✅ Found by exact horse name match');
  } else if (horseID && horseID !== '' && horseRaceMap[horseID]) {
    horseData = horseRaceMap[horseID];
    console.log('✅ Found by HorseID');
  } else {
    // Try partial name matching
    const foundKey = Object.keys(horseRaceMap).find(key => {
      const mappedHorse = horseRaceMap[key];
      return mappedHorse && mappedHorse.horseName &&
        mappedHorse.horseName.toLowerCase().includes(cleanHorseName);
    });
    if (foundKey) {
      horseData = horseRaceMap[foundKey];
      console.log('✅ Found by partial name match');
    }
  }

  if (!horseData) {
    console.error('❌ Horse not found in mapping');
    alert(`Horse "${horseName}" not found in current racecard data.`);
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

      // Highlight the horse after race loads
      setTimeout(() => {
        console.log('🔍 Looking for horse to highlight:', horseData.horseName);
        highlightHorseInRace(horseData.horseName);
      }, 1500);

    } else {
      console.error('❌ Race not found in globalRaceRows:', raceKey);
      alert(`Race ${raceKey} not found. Please try refreshing the page.`);
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
// Improved horse highlighting function
function highlightHorseInRace(horseName) {
  console.log('🔍 Looking for horse to highlight:', horseName);

  let attempts = 0;
  const maxAttempts = 15; // Increased attempts

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
  console.log('Adding click handlers to', clickableHorses.length, 'horses');

  clickableHorses.forEach((horseElement, index) => {
    horseElement.style.cursor = 'pointer';
    horseElement.style.textDecoration = 'underline';
    horseElement.style.color = '#0066cc';

    horseElement.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const horseID = this.getAttribute('data-horse-id');
      const horseName = this.getAttribute('data-horse-name');

      console.log(`🐎 Horse clicked: "${horseName}" - HorseID: "${horseID}"`);
      console.log(`📊 This is horse ${index + 1} of ${clickableHorses.length} in drop odds`);

      // Since HorseID is empty in dropodds, we'll navigate by name
      navigateToHorse(horseID, horseName);
    });

    horseElement.addEventListener('mouseenter', function () {
      this.style.color = '#004499';
      this.style.textDecoration = 'underline';
    });

    horseElement.addEventListener('mouseleave', function () {
      this.style.color = '#0066cc';
      this.style.textDecoration = 'underline';
    });
  });
}

function loadDropOdds() {
  const container = document.getElementById("drop-odds-container");
  const scrollPosition = window.scrollY || document.documentElement.scrollTop;
  container.innerHTML = '<div class="loading">載入中...</div>';

  const csvUrl = "https://ukhorse888uk.github.io/dashboard/csv/dropodds.csv?cb=" + Date.now();

  const fractionalOddsMap = {
    "333/100": "10/3", "500/100": "5/1", "100/33": "3/1", "250/100": "5/2", "163/100": "13/8",
    "3/2": "6/4", "69/50": "11/8", "47/25": "15/8", "91/100": "10/11", "73/100": "8/13",
    "4/2": "7/4", "6/2": "11/4", "213/100": "21/10", "57/100": "4/7", "53/100": "8/15",
    "31/50": "8/13", "83/100": "5/6", "53/25": "85/40"
  };

  function decimalToFraction(decimal) {
    if (!decimal || decimal <= 1) return '--';

    const target = decimal - 1;
    const tolerance = 1.0E-6;
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = target;

    do {
      const a = Math.floor(b);
      let temp = h1; h1 = a * h1 + h2; h2 = temp;
      temp = k1; k1 = a * k1 + k2; k2 = temp;
      b = 1 / (b - a);
    } while (Math.abs(target - h1 / k1) > target * tolerance);

    let frac = h1 + "/" + k1;
    if (fractionalOddsMap[frac]) return fractionalOddsMap[frac];
    return frac;
  }

  function formatDecimal(num) {
    if (num % 1 === 0) return num.toString();
    return num.toFixed(2).replace(/\.?0+$/, '');
  }

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      console.log('Dropodds CSV loaded with headers:', results.meta.fields);

      if (results.errors && results.errors.length > 0) {
        console.error('Dropodds CSV parsing errors:', results.errors);
        container.innerHTML = '<div class="error">數據加載錯誤</div>';
        return;
      }

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
        )
        .filter(row => {
          const originalDec = parseFloat(row['Original']) || 0;
          const nowDec = parseFloat(row['NOW']) || 0;
          if (!originalDec || !nowDec) return false;

          const origFracVal = originalDec > 1 ? originalDec - 1 : 0;
          const nowFracVal = nowDec > 1 ? nowDec - 1 : 0;
          if (!origFracVal || !nowFracVal) return false;

          const pctDrop = ((origFracVal - nowFracVal) / origFracVal) * 100;
          return pctDrop >= 50;
        });

      data.sort((a, b) => a['Time'].localeCompare(b['Time'], undefined, { numeric: true }));

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
              <th>變 %</th>
              <th>賽果</th>
              <th>贏賠率</th>
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

        const originalFrac = decimalToFraction(originalDec);
        const nowFrac = decimalToFraction(nowDec);
        const spFrac = decimalToFraction(parseFloat(row['SP Odds']));
        const timeCellContent = isMobilePortrait
          ? `<span class="time-with-course">${row['Time'] || '--'}</span><span class="course-name">${row['Course'] || '--'}</span>`
          : (row['Time'] || '--');

        // ✅ FIXED: Use the correct HorseID column (Column T)
        const horseID = row['HorseID'] || '';
        const horseName = row['Horse Name'] || '';

        console.log(`Dropodds row ${index}: ${horseName} - HorseID: ${horseID}`);

        const clickableHorse = horseName ?
          `<span class="clickable-horse" data-horse-id="${horseID}" data-horse-name="${horseName}">${horseName}</span>` :
          '--';

        tableHTML += `
  <tr>
    <td class="time-cell">${timeCellContent}</td>
    ${!isMobilePortrait ? `<td class="course-cell">${row['Course'] || '--'}</td>` : ''}
    <td>${row['Num'] || '--'}</td>
    <td>${clickableHorse}</td>
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

      // Add click event listeners to horse names
      addHorseClickHandlers();

      let resizeTimeout;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const newIsMobilePortrait = window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;
          if (isMobilePortrait !== newIsMobilePortrait) loadDropOdds();
        }, 250);
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

document.addEventListener('DOMContentLoaded', () => {
  // Initialize horse navigation
  horseRaceMap = {};
  raceHorseMap = {};

  loadRaceFormData();

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

  if (arrow) {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      updateRaceArrow();
    });
  }

  if (raceArrowTab && raceList) {
    raceArrowTab.addEventListener('click', (e) => {
      e.stopPropagation();
      raceList.classList.toggle('open');
      updateRaceArrow();
    });
  }

  document.addEventListener('click', (e) => {
    const isMobile = window.innerWidth <= 1024;
    const topTabs = document.querySelectorAll('.tab-bar .tab-button');
    const clickedOnTopTab = Array.from(topTabs).some(tab => tab.contains(e.target));

    if (!isMobile) {
      if (dropdown && raceTab && dropdown.classList.contains('open') &&
        !dropdown.contains(e.target) && !raceTab.contains(e.target)) {
        dropdown.classList.remove('open');
        updateRaceArrow();
      }
    } else {
      if (raceList && raceArrowTab &&
        (clickedOnTopTab || (!raceList.contains(e.target) && !raceArrowTab.contains(e.target)))) {
        raceList.classList.remove('open');
        updateRaceArrow();
      }
    }
  });

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

  initTabs();
  updateRaceListVisibility();
  startAutoRefresh();

  const lastTab = localStorage.getItem('activeTab') || 'races';
  document.querySelector(`.tab-bar .tab[data-tab="${lastTab}"]`)?.click();

  const lastPosition = localStorage.getItem('scrollPosition');
  if (lastPosition) setTimeout(() => window.scrollTo(0, parseInt(lastPosition)), 0);

  window.addEventListener('beforeunload', () => {
    localStorage.setItem('scrollPosition', window.scrollY || document.documentElement.scrollTop);
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateRaceListVisibility, 250);
  });
});

// Initial load
loadDropOdds();
