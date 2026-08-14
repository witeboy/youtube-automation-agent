const path = require('path');

function getAppDataRoot() {
  return process.env.YAA_DATA_DIR
    ? path.resolve(process.env.YAA_DATA_DIR)
    : path.join(__dirname, '..');
}

function appDataPath(...segments) {
  return path.join(getAppDataRoot(), ...segments);
}

module.exports = { getAppDataRoot, appDataPath };
