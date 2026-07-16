// logs.js
let logs = [];

function addLog(entry) {
  logs.push(entry);
}

function getLogs() {
  return logs;
}

module.exports = { addLog, getLogs };
