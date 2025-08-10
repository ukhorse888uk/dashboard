let activeTab = 'races';  // Default active tab on page load

// Load and display racecard CSV for 賽程列表 with courses grouped as expandable accordions
function loadRacecard() {
  Papa.parse("https://ges202507.github.io/dashboard/csv/racecard.csv", {
    download: true,
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
// Load and display DropOdds CSV for 落飛馬 tab
function loadDropOdds() {
  Papa.parse("https://ges202507.github.io/dashboard/csv/dropodds.csv", {
    download: true,
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
        cell.colSpan = 10;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
      }

      // Updated headers per your mapping
      const headers = [
        "赛时",          // Time (col B)
        "场地",          // Course (col C)
        "号码",          // Horse Number (col D)
        "马名",          // Horse Name (col E)
        "隔夜价格",      // Lastnight Price (col F)
        "现时价格",      // Now Odds (last column odds)
        "变动",          // Change (difference)
        "变动 %",        // % Change
        "最早掉价 时/赔",  // Earliest Big Drop (col G)
        "最低价格 时/赔"   // Lowest Odds Drop (col A)
      ];

      // Create header row
      const headerRow = document.createElement("tr");
      headers.forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
      });
      tableHead.appendChild(headerRow);

      // Process each data row (skip header)
      data.slice(1).forEach(row => {
        if (row.length < 7) return; // Minimal length check

        const tr = document.createElement("tr");

        // Extract last column for current odds and time
        const lastCol = row[row.length - 1];
        const [nowTime, nowOdd] = lastCol.includes(' / ') ? lastCol.split(' / ') : ["", lastCol];

        // Parse numbers safely
        const lastnightPrice = parseFloat(row[5]) || 0;
        const nowOddNum = parseFloat(nowOdd) || 0;
        const change = nowOddNum - lastnightPrice;
        const percentChange = lastnightPrice ? (change / lastnightPrice) * 100 : 0;

        // 1. Time (col B)
        const tdTime = document.createElement("td");
        tdTime.textContent = row[1];
        tr.appendChild(tdTime);

        // 2. Course (col C)
        const tdCourse = document.createElement("td");
        tdCourse.textContent = row[2];
        tr.appendChild(tdCourse);

        // 3. Horse Number (col D)
        const tdNumber = document.createElement("td");
        tdNumber.textContent = row[3];
        tr.appendChild(tdNumber);

        // 4. Horse Name (col E)
        const tdName = document.createElement("td");
        tdName.textContent = row[4];
        tr.appendChild(tdName);

        // 5. Lastnight Price (col F)
        const tdLastNight = document.createElement("td");
        tdLastNight.textContent = row[5];
        tr.appendChild(tdLastNight);

        // 6. Now Odds (last column)
        const tdNowOdd = document.createElement("td");
        tdNowOdd.innerHTML = `<div>${nowTime}</div><div>${nowOdd}</div>`;
        tr.appendChild(tdNowOdd);

        // 7. Change (difference)
        const tdChange = document.createElement("td");
        const absChange = Math.abs(change).toFixed(2);
        if (absChange === "0.00") {
          tdChange.textContent = "";
        } else {
          tdChange.textContent = (change < 0 ? '-' : '') + absChange;
          tdChange.style.color = change < 0 ? 'green' : 'black';
        }
        tr.appendChild(tdChange);

        // 8. Percent Change
        const tdPercent = document.createElement("td");
        const absPercent = Math.abs(percentChange).toFixed(2);
        if (absPercent === "0.00") {
          tdPercent.textContent = "";
        } else {
          tdPercent.textContent = (change < 0 ? '-' : '') + absPercent + '%';
          tdPercent.style.color = change < 0 ? 'green' : 'black';
        }
        tr.appendChild(tdPercent);


        // 9. Earliest big drop (col G)
        const tdEarliestDrop = document.createElement("td");
        const earliestDrop = row[6] || '';
        if (earliestDrop.includes(' / ')) {
          const [dropTime, dropOdd] = earliestDrop.split(' / ');
          tdEarliestDrop.innerHTML = `<div>${dropTime}</div><div>${dropOdd}</div>`;
        } else {
          tdEarliestDrop.textContent = earliestDrop;
        }
        tr.appendChild(tdEarliestDrop);

        // 10. Lowest odds drop (col A)
        const tdLowest = document.createElement("td");
        const lowest = row[0] || '';
        if (lowest.includes(' / ')) {
          const [lowTime, lowOdd] = lowest.split(' / ');
          tdLowest.innerHTML = `<div>${lowTime}</div><div>${lowOdd}</div>`;
        } else {
          tdLowest.textContent = lowest;
        }
        tr.appendChild(tdLowest);

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
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    activeTab = tab.dataset.tab;

    document.getElementById('race-list').style.display = activeTab === 'races' ? 'block' : 'none';
    document.getElementById('race-details').style.display = activeTab === 'races' ? 'block' : 'none';
    document.getElementById('drop-odds').style.display = activeTab === 'drops' ? 'block' : 'none';

    if (activeTab === 'races') {
      loadRacecard();
    } else if (activeTab === 'drops') {
      loadDropOdds();
    }
  });
});

// On initial load, set UI to default tab and load data
window.addEventListener('DOMContentLoaded', () => {
  const defaultTab = document.querySelector(`.tab-bar .tab[data-tab="${activeTab}"]`);
  if (defaultTab) defaultTab.classList.add('active');

  document.getElementById('race-list').style.display = activeTab === 'races' ? 'block' : 'none';
  document.getElementById('race-details').style.display = activeTab === 'races' ? 'block' : 'none';
  document.getElementById('drop-odds').style.display = activeTab === 'drops' ? 'block' : 'none';

  if (activeTab === 'races') {
    loadRacecard();
  } else if (activeTab === 'drops') {
    loadDropOdds();
  }
});

// Auto-refresh every 30 seconds
setInterval(refreshData, 30000);






