#!/usr/bin/env node

const { networkInterfaces } = require('node:os');
const { spawn } = require('node:child_process');

const BACKEND_PORT = process.env.BACKEND_PORT || '8000';

const getLanIpv4 = () => {
  const nets = networkInterfaces();
  const preferred = ['en0', 'en1', 'eth0', 'wlan0', 'Wi-Fi'];

  for (const key of preferred) {
    const entries = nets[key] || [];
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }

  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }

  return null;
};

const lanIp = getLanIpv4();
if (!lanIp) {
  console.error('[start:lan] LAN IPv4 address not found.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['expo', 'start', ...process.argv.slice(2)];
const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
  EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || `http://${lanIp}:${BACKEND_PORT}`,
};

console.log(`[start:lan] REACT_NATIVE_PACKAGER_HOSTNAME=${env.REACT_NATIVE_PACKAGER_HOSTNAME}`);
console.log(`[start:lan] EXPO_PUBLIC_BACKEND_URL=${env.EXPO_PUBLIC_BACKEND_URL}`);

const child = spawn(command, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (error) => {
  console.error('[start:lan] Failed to start Expo:', error.message);
  process.exit(1);
});
