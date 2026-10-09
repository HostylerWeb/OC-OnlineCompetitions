#!/usr/bin/env bash
# Online Competitions Debug Tunnel — Cloudflare Tunnel managed by devservers MCP
# No Coolify, no SSH reverse tunnel needed — cloudflared connects directly
# from your local dev server to Cloudflare's edge.
#
# Prerequisites (done once, globally):
#   cloudflared tunnel login
#   cloudflared tunnel create onlinecompetitions-debug
#   cloudflared tunnel route dns onlinecompetitions-debug debug.onlinecompetitions.co.uk
#
# Usage:
#   ./scripts/tunnel.sh start    — start tunnel
#   ./scripts/tunnel.sh stop     — stop tunnel
#   ./scripts/tunnel.sh status   — check tunnel

TUNNEL_NAME="onlinecompetitions-debug"
TUNNEL_LOCAL_PORT="3555"

start_tunnel() {
  echo "Starting Cloudflare tunnel: ${TUNNEL_NAME} → localhost:${TUNNEL_LOCAL_PORT}"
  echo ""
  echo "  Remote URL : https://debug.onlinecompetitions.co.uk"
  echo ""
  echo "  NOTE: For OAuth and magic links to work via the tunnel,"
  echo "  restart the client dev server with the tunnel env:"
  echo ""
  echo "    bun run dev:tunnel --filter=@oc/client"
  echo ""
  echo "  Otherwise the app works but Google sign-in and magic link"
  echo "  emails won't resolve (callbacks point to localhost:3555)."
  echo ""
  exec cloudflared tunnel run --url "http://localhost:${TUNNEL_LOCAL_PORT}" "${TUNNEL_NAME}"
}

stop_tunnel() {
  pkill -f "cloudflared.*tunnel.*${TUNNEL_NAME}" 2>/dev/null || true
  echo "Tunnel stopped"
}

status_tunnel() {
  if pgrep -f "cloudflared.*tunnel.*${TUNNEL_NAME}" >/dev/null 2>&1; then
    echo "Tunnel is running"
    echo "  Local:  localhost:${TUNNEL_LOCAL_PORT}"
    echo "  Remote: https://debug.onlinecompetitions.co.uk"
  else
    echo "Tunnel is not running"
    echo ""
    echo "To set up the tunnel for the first time:"
    echo "  1. cloudflared tunnel login"
    echo "  2. cloudflared tunnel create ${TUNNEL_NAME}"
    echo "  3. cloudflared tunnel route dns ${TUNNEL_NAME} debug.onlinecompetitions.co.uk"
    echo "  4. Then run: ./scripts/tunnel.sh start"
  fi
}

case "${1:-}" in
  start)   start_tunnel ;;
  stop)    stop_tunnel ;;
  status)  status_tunnel ;;
  restart) stop_tunnel; sleep 1; start_tunnel ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
