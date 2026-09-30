/**
 * VLSM Tutor - Main Application JavaScript Engine
 */

let subnetCount = 0;
let quizStreak = parseInt(localStorage.getItem('vlsm_quiz_streak') || '0');
let currentQuizQuestion = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    populateBasePrefixOptions();
    addSubnetInput("LAN A (Sales)", 60);
    addSubnetInput("LAN B (Engineering)", 25);
    addSubnetInput("WAN Link", 2);
    updateBinaryVisualizer(24);
    buildCidrTable();
    generateQuizQuestion();
    updateStreakDisplay();
});

// Navigation Tab Switching
function switchTab(tabId) {
    ['calculator', 'teach', 'quiz', 'reference'].forEach(id => {
        document.getElementById(`sec-${id}`).classList.add('hidden');
        document.getElementById(`tab-${id}`).classList.remove('active-nav');
    });
    document.getElementById(`sec-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active-nav');
}

// Populate Base CIDR Dropdown Options
function populateBasePrefixOptions() {
    const select = document.getElementById('basePrefix');
    select.innerHTML = '';
    for (let i = 8; i <= 30; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `/${i} (${calculateSubnetMask(i)})`;
        if (i === 24) opt.selected = true;
        select.appendChild(opt);
    }
}

// Add Subnet Input Row
function addSubnetInput(defaultName = '', defaultHosts = '') {
    subnetCount++;
    const container = document.getElementById('subnetInputs');
    const row = document.createElement('div');
    row.id = `subnet-row-${subnetCount}`;
    row.className = 'flex items-center space-x-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800';
    row.innerHTML = `
        <input type="text" placeholder="Subnet Name (e.g., Sales)" value="${defaultName || 'Subnet ' + subnetCount}" class="sub-name flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
        <input type="number" placeholder="Hosts Needed" value="${defaultHosts}" min="1" class="sub-hosts w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500">
        <button onclick="removeSubnetInput(${subnetCount})" class="text-rose-400 hover:text-rose-300 px-2 py-1 text-lg">×</button>
    `;
    container.appendChild(row);
}

function removeSubnetInput(id) {
    const row = document.getElementById(`subnet-row-${id}`);
    if (row) row.remove();
}

// VLSM Calculation Algorithm
function calculateVLSM() {
    const baseIpStr = document.getElementById('baseIp').value.trim();
    const basePrefix = parseInt(document.getElementById('basePrefix').value);
    const outputContainer = document.getElementById('calcOutput');

    if (!isValidIp(baseIpStr)) {
        outputContainer.innerHTML = `<div class="bg-rose-950/50 border border-rose-800 text-rose-300 p-4 rounded-xl text-sm">⚠️ Invalid Base IP Address entered.</div>`;
        return;
    }

    // Collect requirements
    const rows = document.querySelectorAll('#subnetInputs > div');
    let subnets = [];
    rows.forEach(r => {
        const name = r.querySelector('.sub-name').value.trim() || 'Unnamed';
        const hosts = parseInt(r.querySelector('.sub-hosts').value);
        if (!isNaN(hosts) && hosts > 0) {
            subnets.push({ name, hostsNeeded: hosts });
        }
    });

    if (subnets.length === 0) {
        outputContainer.innerHTML = `<div class="bg-amber-950/50 border border-amber-800 text-amber-300 p-4 rounded-xl text-sm">⚠️ Please enter at least one subnet host requirement.</div>`;
        return;
    }

    // Sort descending by hosts required
    subnets.sort((a, b) => b.hostsNeeded - a.hostsNeeded);

    let currentIpNum = ipToLong(baseIpStr);
    let results = [];

    for (let sub of subnets) {
        let neededTotal = sub.hostsNeeded + 2; // Host IDs + Network + Broadcast
        let hostBits = Math.ceil(Math.log2(neededTotal));
        if (hostBits < 2) hostBits = 2; // Min /30 for 2 hosts
        let prefix = 32 - hostBits;
        let totalIps = Math.pow(2, hostBits);

        let netIp = longToIp(currentIpNum);
        let firstUsable = longToIp(currentIpNum + 1);
        let lastUsable = longToIp(currentIpNum + totalIps - 2);
        let broadcast = longToIp(currentIpNum + totalIps - 1);
        let mask = calculateSubnetMask(prefix);

        results.push({
            name: sub.name,
            hostsNeeded: sub.hostsNeeded,
            allocatedHosts: totalIps - 2,
            prefix: prefix,
            mask: mask,
            netIp: netIp,
            range: `${firstUsable} - ${lastUsable}`,
            broadcast: broadcast
        });

        currentIpNum += totalIps;
    }

    // Build Results HTML Table
    let html = `
        <div class="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 overflow-x-auto">
            <h3 class="text-lg font-bold text-emerald-400 mb-4 flex items-center">
                <span class="mr-2">✅</span> Calculated VLSM Subnets
            </h3>
            <table class="w-full text-left font-mono text-sm">
                <thead class="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                        <th class="p-3">Subnet Name</th>
                        <th class="p-3">Needed / Alloc</th>
                        <th class="p-3">Prefix</th>
                        <th class="p-3">Subnet Mask</th>
                        <th class="p-3">Network IP</th>
                        <th class="p-3">Usable Range</th>
                        <th class="p-3">Broadcast</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
    `;

    results.forEach(res => {
        html += `
            <tr class="hover:bg-slate-800/30">
                <td class="p-3 font-semibold text-slate-200">${res.name}</td>
                <td class="p-3 text-slate-400">${res.hostsNeeded} / <span class="text-indigo-400">${res.allocatedHosts}</span></td>
                <td class="p-3 text-indigo-300 font-bold">/${res.prefix}</td>
                <td class="p-3 text-slate-300">${res.mask}</td>
                <td class="p-3 text-emerald-400 font-bold">${res.netIp}</td>
                <td class="p-3 text-cyan-300">${res.range}</td>
                <td class="p-3 text-amber-300">${res.broadcast}</td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    outputContainer.innerHTML = html;
}

// IP Conversion Helpers
function ipToLong(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function longToIp(long) {
    return [(long >>> 24) & 255, (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join('.');
}

function isValidIp(ip) {
    return /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.){3}(25[0-5]|(2[0-4]|1\d|[1-9]|)\d)$/.test(ip);
}

function calculateSubnetMask(prefix) {
    let mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return longToIp(mask);
}

// Binary Visualizer Render
function updateBinaryVisualizer(cidr) {
    document.getElementById('sliderCidrVal').textContent = `/${cidr}`;
    const container = document.getElementById('binaryOctets');
    container.innerHTML = '';

    let bitsRemaining = parseInt(cidr);

    for (let o = 0; o < 4; o++) {
        let octetBits = '';
        for (let b = 0; b < 8; b++) {
            if (bitsRemaining > 0) {
                octetBits += `<span class="inline-block w-6 h-8 line-height-8 bg-indigo-600 text-white font-bold rounded m-0.5 pt-1">1</span>`;
                bitsRemaining--;
            } else {
                octetBits += `<span class="inline-block w-6 h-8 line-height-8 bg-slate-800 text-slate-500 rounded m-0.5 pt-1">0</span>`;
            }
        }
        container.innerHTML += `<div class="bg-slate-950 p-2 rounded-lg border border-slate-800">${octetBits}</div>`;
    }
}

// Practice Quiz Generator
function generateQuizQuestion() {
    const prefixes = [24, 25, 26, 27, 28, 29, 30];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const totalIps = Math.pow(2, 32 - prefix);
    const usableHosts = totalIps - 2;
    const mask = calculateSubnetMask(prefix);

    const questions = [
        {
            q: `How many usable host IP addresses are available in a /${prefix} subnet?`,
            a: usableHosts.toString(),
            options: [usableHosts.toString(), (usableHosts + 2).toString(), (usableHosts - 2).toString(), (usableHosts + 10).toString()].sort(() => Math.random() - 0.5)
        },
        {
            q: `What is the subnet mask for a /${prefix} CIDR network prefix?`,
            a: mask,
            options: [mask, calculateSubnetMask(prefix - 1), calculateSubnetMask(prefix + 1), "255.255.255.0"].filter((v, i, a) => a.indexOf(v) === i).sort(() => Math.random() - 0.5)
        }
    ];

    currentQuizQuestion = questions[Math.floor(Math.random() * questions.length)];

    const card = document.getElementById('quizCard');
    card.innerHTML = `
        <h3 class="text-lg font-bold text-slate-100">${currentQuizQuestion.q}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            ${currentQuizQuestion.options.map(opt => `
                <button onclick="submitQuizAnswer('${opt}')" class="bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-300 font-mono font-bold p-3 rounded-xl border border-slate-700 transition">
                    ${opt}
                </button>
            `).join('')}
        </div>
        <div id="quizFeedback" class="mt-4"></div>
    `;
}

function submitQuizAnswer(selected) {
    const feedback = document.getElementById('quizFeedback');
    if (selected === currentQuizQuestion.a) {
        quizStreak++;
        localStorage.setItem('vlsm_quiz_streak', quizStreak);
        updateStreakDisplay();
        feedback.innerHTML = `<div class="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-sm font-bold">🎉 Correct! Great job.</div>`;
    } else {
        quizStreak = 0;
        localStorage.setItem('vlsm_quiz_streak', quizStreak);
        updateStreakDisplay();
        feedback.innerHTML = `<div class="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-sm font-bold">❌ Incorrect. Correct answer was: ${currentQuizQuestion.a}</div>`;
    }

    setTimeout(generateQuizQuestion, 1800);
}

function updateStreakDisplay() {
    document.getElementById('quizScore').textContent = quizStreak;
    const badge = document.getElementById('streakBadge');
    if (quizStreak > 0) {
        badge.textContent = `${quizStreak}🔥`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Build Reference Table
function buildCidrTable() {
    const tbody = document.getElementById('cidrTableBody');
    tbody.innerHTML = '';
    for (let i = 8; i <= 30; i++) {
        let total = Math.pow(2, 32 - i);
        let usable = total > 2 ? total - 2 : 0;
        let mask = calculateSubnetMask(i);
        let wildcard = longToIp((~ipToLong(mask)) >>> 0);

        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/40">
                <td class="p-3 text-indigo-400 font-bold">/${i}</td>
                <td class="p-3 text-slate-200">${mask}</td>
                <td class="p-3 text-slate-400">${wildcard}</td>
                <td class="p-3 text-cyan-300">${total.toLocaleString()}</td>
                <td class="p-3 text-emerald-400">${usable.toLocaleString()}</td>
            </tr>
        `;
    }
}

function filterCidrTable() {
    let input = document.getElementById('cidrSearch').value.toLowerCase();
    let rows = document.querySelectorAll('#cidrTableBody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(input) ? '' : 'none';
    });
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}
