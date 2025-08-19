// ===== Active tab =====
let activeTab = localStorage.getItem('activeTab') || 'races';

function loadRacecard() {
  Papa.parse("https://ukhorse888uk.github.io/dashboard/csv/racecard.csv?cb=" + Date.now(), {
    download: true,
    complete: function (results) {
      // 1. Data filtering and validation
      const validRows = results.data
        .filter(row => row && row.length > 0) // Remove empty rows
        .filter(row => row[1] && String(row[1]).trim() !== ""); // Remove empty course names

      if (!validRows || validRows.length <= 1) {
        document.getElementById('sidebar').innerHTML = ''; // Clear sidebar
        return;
      }

      const raceRows = validRows.slice(1); // Skip header

      // 2. Group races by course and raceKey
      const courseMap = {};
      raceRows.forEach(row => {
        const course = (row[1] || '').trim();
        if (!course) return; // Skip if course is empty

        const raceTime = (row[2] || '').trim();
        const raceKey = `${course} ${raceTime}`;
        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceKey]) courseMap[course][raceKey] = [];
        courseMap[course][raceKey].push(row);
      });

      // 3. Clean up empty courses
      Object.keys(courseMap).forEach(course => {
        if (Object.keys(courseMap[course]).length === 0) {
          delete courseMap[course];
        }
      });

      // 4. Build sidebar UI
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

      // 5. Restore last opened course & race
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

  // Get race metadata
  const raceData = raceRows[0];
  const distance = raceData[5] || 'N/A';
  const raceClass = raceData[4] || 'N/A';
  const going = raceData[7] || 'N/A';
  const raceName = raceData[3] || '';
  const rawPrize = raceData[6] || '';
  const prizeValue = rawPrize.replace(/[^0-9]/g, '');
  const formattedPrize = prizeValue ? `£${parseInt(prizeValue).toLocaleString()}` : 'N/A';

  // Create race header (Chinese labels)
  const raceHeader = document.createElement('div');
  raceHeader.className = 'race-header'; // Add this to your CSS
  raceHeader.innerHTML = `
    <div class="race-title">${raceKey}</div>
    <div class="race-meta">
      <span>距離: ${distance}m</span>
      <span>班數: ${raceClass}</span>
      <span>地質: ${going}</span>
      <span>獎金: ${formattedPrize}</span>
    </div>
    ${raceName ? `<div class="race-name">${raceName}</div>` : ''}
  `;
  raceDetails.appendChild(raceHeader);

  // Create table - SINGLE DECLARATION
  const table = document.createElement('table');
  table.className = 'race-table';

  // Header Row (Chinese column headers)
  const headerRow = document.createElement('tr');
  ['號碼(檔)', '馬名', '年齡', '近戰績', '隔夜', '最近'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Horse Rows
  raceRows.forEach((row, index) => {
    const horseNumber = row[11] || '';     // Column L
    const draw = row[16] || '';            // Column Q
    const horseName = row[12] || '';       // Column M
    const age = row[13] || '';             // Column N
    const latestRecord = row[26] || '';    // Column AA
    const lastnightOdds = row[18] || '-';  // Column S
    const nowOdds = row[19] || '-';        // Column T
    const jockey = row[14] || '';          // Column O
    const trainer = row[15] || '';         // Column P
    const silkUrl = row[9] || '';          // Column J (NEW: Silk URL)

    const horseRow = document.createElement('tr');
    horseRow.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9';

    // Column 1: Number + Silk (Updated)
    const numCell = document.createElement('td');
    numCell.innerHTML = `
      <div style="font-weight:bold">${horseNumber} (${draw})</div>
      <div style="height:24px">${silkUrl ? `<img src="${silkUrl}" class="horse-silk">` : ''}</div>
      <div></div>
    `;
    horseRow.appendChild(numCell);

    // Column 2: Name + Jockey/Trainer
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `
      <div style="font-weight:bold">${horseName}</div>
      <div><span class="jockey-badge">騎 ${jockey}</span></div>
      <div><span class="trainer-badge">練 ${trainer}</span></div>
    `;
    horseRow.appendChild(nameCell);

    // Columns 3-6 (unchanged)
    [age, latestRecord, lastnightOdds, nowOdds].forEach(text => {
      const cell = document.createElement('td');
      cell.innerHTML = `<div>${text}</div><div></div><div></div>`;
      horseRow.appendChild(cell);
    });

    table.appendChild(horseRow);
  });

  raceDetails.appendChild(table);
}



function loadDropOdds() {
  const grid = document.getElementById("drop-odds-grid");
  grid.innerHTML = '<div class="loading">載入中...</div>';

  // Rest of your loadDropOdds() code
}



// Function to load drop odds data with table layout
function loadDropOdds() {
  console.log("Starting drop odds load...");

  const container = document.getElementById("drop-odds-container");
  if (!container) {
    console.error("Drop odds container not found!");
    return;
  }

  container.innerHTML = '<div class="loading">載入中...</div>';

  const csvUrl = "https://ukhorse888uk.github.io/dashboard/csv/dropodds.csv?cb=" + Date.now();
  console.log("Fetching:", csvUrl);

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      console.log("Raw results:", results);

      if (!results.data || results.data.length === 0) {
        console.warn("No data received", results);
        container.innerHTML = '<div class="error">沒有數據 (Empty)</div>';
        return;
      }

      // Create table
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

      // Process data
      results.data
        .filter(row => row && row.Time && row['Horse Name'])
        .sort((a, b) => a.Time.localeCompare(b.Time))
        .forEach(row => {
          // Map columns as requested
          const time = row.Time || '--'; // Col B
          const course = row.Course || '--'; // Col C
          const num = row.Num || '--'; // Col D
          const horseName = row['Horse Name'] || '--'; // Col E
          const original = parseFloat(row.Original) || 0; // Col F
          const current = parseFloat(row.NOW) || 0; // Col G
          const change = parseFloat(row.Change) || (current - original); // Col H
          const pctChange = parseFloat(row['%']) || (original ? (change / original) * 100 : 0); // Col I
          const spOdds = row['SP Odds'] || '--'; // Col P

          const colorClass = pctChange <= -48 ? 'green' : pctChange >= 48 ? 'red' : '';

          tableHTML += `
            <tr>
              <td>${time}</td>
              <td>${course}</td>
              <td>${num}</td>
              <td>${horseName}</td>
              <td>${original.toFixed(2)}</td>
              <td>${current.toFixed(2)}</td>
              <td class="${colorClass}">${change.toFixed(2)}</td>
              <td class="${colorClass}">${pctChange.toFixed(2)}%</td>
              <td>${spOdds}</td>
              <td>${spOdds}</td>
            </tr>
          `;
        });

      tableHTML += `
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    },
    error: function (err) {
      console.error("Papa Parse error:", err);
      container.innerHTML = `<div class="error">加載失敗 (Error)<br>${err.message}</div>`;
    }
  });
}

// Modify tab switching for drop odds
document.addEventListener('DOMContentLoaded', function () {
  // Store the original tab switching code
  const originalTabs = document.querySelectorAll('.tab-bar .tab');

  originalTabs.forEach(tab => {
    // Remove any existing event listeners
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);

    // Add new event listener
    newTab.addEventListener('click', function () {
      // Set active tab
      document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
      newTab.classList.add('active');
      const activeTab = newTab.dataset.tab;
      localStorage.setItem('activeTab', activeTab);

      // Get elements
      const sidebar = document.getElementById('sidebar');
      const mainContent = document.getElementById('main-content');

      if (activeTab === 'drops') {
        // Switch to Drop Odds (full-width)
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
        // Switch to Racecard (with sidebar)
        sidebar.style.flex = '0 0 220px';
        sidebar.style.width = '220px';
        sidebar.style.opacity = '1';
        sidebar.style.overflow = 'auto';

        mainContent.style.flex = '1';
        mainContent.style.maxWidth = 'calc(100% - 220px)';

        document.getElementById('race-details').style.display = 'block';
        document.getElementById('drop-odds').style.display = 'none';

        // Call your original loadRacecard function
        if (typeof loadRacecard === 'function') {
          loadRacecard();
        }
      }
    });
  });

  // Set initial tab based on localStorage or default
  const savedTab = localStorage.getItem('activeTab') || 'races';
  const tabElement = document.querySelector(`.tab[data-tab="${savedTab}"]`);
  if (tabElement) {
    tabElement.click();
  }
});
// ===== Corrected Tab Switching =====
document.querySelectorAll('.tab-bar .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Set active tab
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    localStorage.setItem('activeTab', activeTab);

    // Get elements
    const container = document.querySelector('.container');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    if (activeTab === 'drops') {
      // Switch to Drop Odds (full-width)
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
      // Switch to Racecard (with sidebar)
      sidebar.style.flex = '0 0 220px';
      sidebar.style.width = '220px';
      sidebar.style.opacity = '1';
      sidebar.style.overflow = 'auto';

      mainContent.style.flex = '1';
      mainContent.style.maxWidth = 'calc(100% - 220px)';

      document.getElementById('race-details').style.display = 'block';
      document.getElementById('drop-odds').style.display = 'none';
      loadRacecard();
    }
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




