let activeTab = 'races';  // Default active tab on page load

// Load and display racecard CSV for 賽程列表 with courses grouped as expandable accordions
function loadRacecard() {
<<<<<<< HEAD
  Papa.parse("https://ges202507.github.io/dashboard/csv/racecard.csv", {
    download: true,
=======
 Papa.parse("https://ges202507.github.io/dashboard/csv/racecard.csv", {
  download: true,
>>>>>>> a89e83d8073fdeafae5a7d9b55ac47e8ff6be9f3
    complete: function (results) {
      const raceData = results.data.slice(1);
      const courseMap = {};

      // Group all races by course and race time
      raceData.forEach(row => {
        const course = row[1];
        const raceTime = row[2];

        if (!courseMap[course]) courseMap[course] = {};
        if (!courseMap[course][raceTime]) courseMap[course][raceTime] = [];

        courseMap[course][raceTime].push(row);
      });

      const raceList = document.getElementById('race-list');
      raceList.innerHTML = ''; // Clear previous list

      // For each course, create a collapsible header
      Object.keys(courseMap).forEach(course => {
        const courseHeader = document.createElement('div');
        courseHeader.classList.add('course-header');
        courseHeader.textContent = course;

        // Container for all race times under this course
        const raceTimesContainer = document.createElement('div');
        raceTimesContainer.classList.add('race-list-inner');
        raceTimesContainer.style.display = 'none';

        // For each race time under the course, create a race time button
        Object.keys(courseMap[course]).forEach(raceTime => {
          const raceKey = `${course} - ${raceTime}`;
          const button = document.createElement('button');
          button.textContent = raceKey;

          // On clicking race time button, show all horses in that race
          button.addEventListener('click', () => {
            // Remove active class from all race time buttons
            raceTimesContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            displayRace(courseMap[course][raceTime], raceKey);
          });

          raceTimesContainer.appendChild(button);
        });

        // Expand/collapse race times container on course header click
        courseHeader.addEventListener('click', () => {
          const isExpanded = courseHeader.classList.toggle('expanded');
          raceTimesContainer.style.display = isExpanded ? 'block' : 'none';
        });

        raceList.appendChild(courseHeader);
        raceList.appendChild(raceTimesContainer);
      });
    }
  });
}


// Display race details on the right side for 賽程列表
function displayRace(raceRows, raceKey) {
  const raceDetails = document.getElementById('race-details');
  raceDetails.innerHTML = `<h2>${raceKey}</h2>`;

  raceRows.forEach(row => {
    const number = row[11];
    const horse = row[12];
    const draw = row[16];
    const jockey = row[14];
    const trainer = row[15];
    const odds = row[18];

    const p = document.createElement('p');
    p.textContent = `${number}號　馬名: ${horse}　擋位: ${draw}　騎師: ${jockey}　練馬師: ${trainer}　賠率: ${odds}`;
    raceDetails.appendChild(p);
  });
}

// Load and display DropOdds CSV for 落飛馬 tab
function loadDropOdds() {
  Papa.parse("https://ges202507.github.io/dashboard/csv/dropodds.csv", {
<<<<<<< HEAD
    download: true,
=======
  download: true,
>>>>>>> a89e83d8073fdeafae5a7d9b55ac47e8ff6be9f3
    complete: function (results) {
      const data = results.data;
      const tableHead = document.querySelector("#drop-odds-table thead");
      const tableBody = document.querySelector("#drop-odds-table tbody");

      tableHead.innerHTML = "";
      tableBody.innerHTML = "";

      if (data.length <= 1) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.textContent = "沒有資料";
        cell.colSpan = 10;  // updated for 10 columns
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
      }

      // Headers in Traditional Chinese matching your data columns
      const headers = [
        "賽時",        // Time (A)
        "場地",        // Course (B)
        "馬名",        // Horse Name (D)
        "初盤賠率",    // Original Odds (E)
        "現時賠率",    // Now Odds (F)
        "賠率變動",    // Change (G)
        "變動百分比",  // % Change (H)
        "賠率取時間",  // Odd Taken Time (I)
        "名次",        // Finish Position (J)
        "SP賠率"       // SP Odds (K)
      ];

      const headerRow = document.createElement("tr");
      headers.forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
      });
      tableHead.appendChild(headerRow);

      data.slice(1).forEach(row => {
        // Defensive check if row is complete enough
        if (row.length < 11) return;

        const tr = document.createElement("tr");

        // Order: A,B,D,E,F,G,H,I,J,K → row[0], row[1], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]
        [
          row[0],  // Time (A)
          row[1],  // Course (B)
          row[3],  // Horse Name (D)
          row[4],  // Original Odds (E)
          row[5],  // Now Odds (F)
          row[6],  // Change (G) — add minus and green text
          row[7],  // % Change (H) — add minus and green text
          row[8],  // Odd Taken Time (I)
          row[9],  // Finish Position (J)
          row[10]  // SP Odds (K)
        ].forEach((text, index) => {
          const td = document.createElement("td");

          if ((index === 5 || index === 6) && text !== "") {  // index 5 = change, index 6 = % change
            td.textContent = "-" + text;
            td.classList.add("negative-change");
          } else {
            td.textContent = text;
          }

          tr.appendChild(td);
        });

        tableBody.appendChild(tr);
      });
    }
  });
}

// Refresh only the active tab's data
function refreshData() {
  if (activeTab === 'races') {
    loadRacecard();
  } else if (activeTab === 'drops') {
    loadDropOdds();
  }
}

// Handle tab clicks
document.querySelectorAll('.tab-bar .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active from all tabs and add to clicked
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    activeTab = tab.dataset.tab;

    // Show/hide content accordingly
    document.getElementById('race-list').style.display = activeTab === 'races' ? 'block' : 'none';
    document.getElementById('race-details').style.display = activeTab === 'races' ? 'block' : 'none';
    document.getElementById('drop-odds').style.display = activeTab === 'drops' ? 'block' : 'none';

    // Load the relevant CSV data for the selected tab
    if (activeTab === 'races') {
      loadRacecard();
    } else if (activeTab === 'drops') {
      loadDropOdds();
    }
  });
});

// On initial load, set UI to default tab and load data
window.addEventListener('DOMContentLoaded', () => {
  // Activate default tab visually
  const defaultTab = document.querySelector(`.tab-bar .tab[data-tab="${activeTab}"]`);
  if (defaultTab) defaultTab.classList.add('active');

  // Show/hide containers accordingly
  document.getElementById('race-list').style.display = activeTab === 'races' ? 'block' : 'none';
  document.getElementById('race-details').style.display = activeTab === 'races' ? 'block' : 'none';
  document.getElementById('drop-odds').style.display = activeTab === 'drops' ? 'block' : 'none';

  // Load initial data for default tab
  if (activeTab === 'races') {
    loadRacecard();
  } else if (activeTab === 'drops') {
    loadDropOdds();
  }
});

// Auto-refresh every 30 seconds
setInterval(refreshData, 30000);




