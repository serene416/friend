#!/usr/bin/env bash
set -euo pipefail

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not found. Install with: brew install ngrok/ngrok/ngrok" >&2
  exit 1
fi

CONFIG_FLAGS=()
DEFAULT_CONFIG_MAC="$HOME/Library/Application Support/ngrok/ngrok.yml"
DEFAULT_CONFIG_LINUX="$HOME/.config/ngrok/ngrok.yml"

if [ -f "$DEFAULT_CONFIG_MAC" ]; then
  CONFIG_FLAGS+=(--config "$DEFAULT_CONFIG_MAC")
fi
if [ -f "$DEFAULT_CONFIG_LINUX" ]; then
  CONFIG_FLAGS+=(--config "$DEFAULT_CONFIG_LINUX")
fi

CONFIG_FLAGS+=(--config "./ngrok.yml")

if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  ngrok start --authtoken "$NGROK_AUTHTOKEN" "${CONFIG_FLAGS[@]}" backend
else
  ngrok start "${CONFIG_FLAGS[@]}" backend
fi
