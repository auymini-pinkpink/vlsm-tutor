document.addEventListener("DOMContentLoaded", () => {
  const subnetRowsContainer = document.getElementById("subnetRows");
  const btnAddSubnet = document.getElementById("btnAddSubnet");
  const btnCalculate = document.getElementById("btnCalculate");

  // Add new subnet row
  btnAddSubnet.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "subnet-row";
    row.innerHTML = `
      <input type="text" class="subnet-name-input" placeholder="Subnet Name" value="LAN_${String.fromCharCode(65 + subnetRowsContainer.children.length)}" />
      <input type="number" class="subnet-hosts-input" placeholder="Hosts Needed" value="10" />
      <button class="btn-icon btn-remove" title="Remove Subnet">🗑</button>
    `;
    subnetRowsContainer.appendChild(row);
  });

  // Remove subnet row handler
  subnetRowsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-remove")) {
      e.target.closest(".subnet-row").remove();
    }
  });

  // Convert IP string to 32-bit unsigned integer
  function ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  // Convert 32-bit unsigned integer to IP string
  function intToIp(int) {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255
    ].join('.');
  }

  // Calculate VLSM Subnet allocations
  btnCalculate.addEventListener("click", () => {
    const majorInput = document.getElementById("majorNetwork").value.trim();
    const [ipStr, cidrStr] = majorInput.split('/');
    
    if (!ipStr || !cidrStr) {
      alert("Please enter a valid CIDR network prefix (e.g. 192.168.1.0/24)");
      return;
    }

    const majorCidr = parseInt(cidrStr, 10);
    const majorIpInt = ipToInt(ipStr);
    const totalNetworkCapacity = Math.pow(2, 32 - majorCidr);

    // Extract subnets from inputs
    const subnetInputs = Array.from(document.querySelectorAll(".subnet-row"));
    const subnets = subnetInputs.map(row => ({
      name: row.querySelector(".subnet-name-input").value || "Subnet",
      hostsNeeded: parseInt(row.querySelector(".subnet-hosts-input").value, 10) || 0
    })).filter(s => s.hostsNeeded > 0);

    // Sort subnets descending by hosts needed (VLSM Requirement)
    subnets.sort((a, b) => b.hostsNeeded - a.hostsNeeded);

    let currentIpInt = majorIpInt;
    let totalAllocatedIps = 0;
    const resultsTable = document.getElementById("resultsTable");
    resultsTable.innerHTML = "";

    subnets.forEach(subnet => {
      // Find required host bits
      const hostBits = Math.ceil(Math.log2(subnet.hostsNeeded + 2));
      const subnetCidr = 32 - hostBits;
      const allocatedSize = Math.pow(2, hostBits);

      const netAddress = intToIp(currentIpInt);
      const firstUsable = intToIp(currentIpInt + 1);
      const lastUsable = intToIp(currentIpInt + allocatedSize - 2);
      const broadcast = intToIp(currentIpInt + allocatedSize - 1);

      totalAllocatedIps += allocatedSize;

      // Append row to results table with green styled CSS classes
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="subnet-name">${subnet.name}</td>
        <td>${subnet.hostsNeeded}</td>
        <td class="allocated">${allocatedSize - 2} (/${subnetCidr})</td>
        <td class="network-addr">${netAddress}</td>
        <td class="usable-range">${firstUsable} - ${lastUsable}</td>
        <td class="broadcast">${broadcast}</td>
      `;
      resultsTable.appendChild(tr);

      currentIpInt += allocatedSize;
    });

    // Update space allocation metric boxes
    document.getElementById("usedIps").textContent = `${totalAllocatedIps} / ${totalNetworkCapacity} IPs Used`;
    const capacityPercent = Math.min(100, Math.round((totalAllocatedIps / totalNetworkCapacity) * 100));
    document.getElementById("usedPercentage").textContent = `${capacityPercent}% Capacity`;
    document.getElementById("totalCapacity").textContent = totalNetworkCapacity;
    document.getElementById("unassignedIps").textContent = Math.max(0, totalNetworkCapacity - totalAllocatedIps);
  });

  // Initial calculation trigger
  btnCalculate.click();
});
