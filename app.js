/**
 * Converts IPv4 dotted string to 32-bit unsigned integer
 */
function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Converts 32-bit unsigned integer back to IPv4 dotted string
 */
function longToIp(long) {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255
  ].join('.');
}

/**
 * Adds a new subnet input row
 */
function addSubnetRow() {
  const container = document.getElementById('subnetRows');
  const div = document.createElement('div');
  div.className = 'subnet-row';
  div.innerHTML = `
    <input type="text" placeholder="Subnet Name" />
    <input type="number" placeholder="Hosts Needed" />
    <button class="btn-icon btn-remove">🗑</button>
  `;
  container.appendChild(div);
  
  // Attach removal listener to new row
  div.querySelector('.btn-remove').addEventListener('click', function() {
    div.remove();
  });
}

/**
 * Main VLSM Calculation Function
 */
function calculateVLSM() {
  const majorNetworkInput = document.getElementById('majorNetwork').value.trim();
  const [ipStr, cidrStr] = majorNetworkInput.split('/');
  
  if (!ipStr || !cidrStr || isNaN(cidrStr)) {
    alert('Please enter a valid CIDR network (e.g., 192.168.1.0/24)');
    return;
  }

  const baseCidr = parseInt(cidrStr, 10);
  let currentIp = ipToLong(ipStr);
  const totalCapacity = Math.pow(2, 32 - baseCidr);

  // Read subnets from DOM
  const rows = document.querySelectorAll('.subnet-row');
  let subnets = [];

  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0].value.trim() || 'Unnamed';
    const needed = parseInt(inputs[1].value, 10) || 0;
    if (needed > 0) {
      subnets.push({ name, needed });
    }
  });

  // Sort subnets descending by hosts needed (standard VLSM rule)
  subnets.sort((a, b) => b.needed - a.needed);

  let totalAllocatedIps = 0;
  const resultsTable = document.getElementById('resultsTable');
  resultsTable.innerHTML = '';

  subnets.forEach(subnet => {
    // Determine block size needed (+2 for Network and Broadcast IP)
    let hostBits = Math.ceil(Math.log2(subnet.needed + 2));
    if (hostBits < 2) hostBits = 2; // Minimum /30 prefix size

    const prefix = 32 - hostBits;
    const blockSize = Math.pow(2, hostBits);

    // Calculate IPs
    const networkAddr = longToIp(currentIp);
    const firstUsable = longToIp(currentIp + 1);
    const lastUsable = longToIp(currentIp + blockSize - 2);
    const broadcastAddr = longToIp(currentIp + blockSize - 1);
    const usableHosts = blockSize - 2;

    totalAllocatedIps += blockSize;

    // Render table entry
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${subnet.name}</strong></td>
      <td>${subnet.needed}</td>
      <td>${usableHosts} <span class="badge">/${prefix}</span></td>
      <td>${networkAddr}</td>
      <td>${firstUsable} - ${lastUsable}</td>
      <td>${broadcastAddr}</td>
    `;
    resultsTable.appendChild(tr);

    // Offset IP address pointer to next block
    currentIp += blockSize;
  });

  // Render Metric Updates
  const unassigned = totalCapacity - totalAllocatedIps;
  const percentage = Math.round((totalAllocatedIps / totalCapacity) * 100);

  document.getElementById('usedIps').innerText = `${totalAllocatedIps} / ${totalCapacity} IPs Used`;
  document.getElementById('usedPercentage').innerText = `${percentage}% Capacity`;
  document.getElementById('totalCapacity').innerText = totalCapacity;
  document.getElementById('unassignedIps').innerText = unassigned < 0 ? 'Exceeded' : unassigned;
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAddSubnet').addEventListener('click', addSubnetRow);
  document.getElementById('btnCalculate').addEventListener('click', calculateVLSM);

  // Bind removal handler for initial static rows
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', function() {
      this.parentElement.remove();
    });
  });

  // Run calculation on page load
  calculateVLSM();
});
