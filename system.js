import si from "systeminformation";

export async function getStats() {
  // CPU
  const cpu = await si.currentLoad();

  // RAM
  const mem = await si.mem();
  const usedRAMGB = (mem.used / 1024 / 1024 / 1024).toFixed(2);
  const totalRAMGB = (mem.total / 1024 / 1024 / 1024).toFixed(2);

  // Temperatura
  const temp = await si.cpuTemperature();

  // Red
  const network = await si.networkStats();
  const upKBps = network[0].rx_sec / 1024;
  const downKBps = network[0].tx_sec / 1024;

  // Disco
  const disk = await si.fsSize();
  const disks = disk.map((d) => {
    const usedGB = (d.used / 1024 / 1024 / 1024).toFixed(2);
    const sizeGB = (d.size / 1024 / 1024 / 1024).toFixed(2);
    const porcent = d.use;
    return { name: d.mount, usedGB: usedGB, sizeGB: sizeGB, porcent: porcent };
  });

  return {
    cpu: cpu.currentLoad.toFixed(1),
    ram: { usedRAMGB, totalRAMGB },
    temp: temp.main,
    network: { upKBps, downKBps },
    disks: disks,
  };
}
