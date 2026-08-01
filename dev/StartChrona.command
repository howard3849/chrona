#!/bin/zsh

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

APP_DIRS=(
  "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Projects/Chrona"
  "$HOME/Projects/Chrona"
  "$HOME/Codex/Chrona"
  "/Users/Admin/Projects/Chrona"
  "/Users/Howard/Projects/Chrona"
)

START_PORT=8000
END_PORT=8099

echo
echo "=== Starting Chrona $(date) ==="

PYTHON_BIN="$(command -v python3)"

if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: python3 was not found."
    osascript -e 'display alert "Chrona" message "Python 3 could not be found."'
    read -n 1 -s -r -p "Press any key to close..."
    echo
    exit 1
fi

echo "Using Python: $PYTHON_BIN"

APP_DIR=""
for DIR in "${APP_DIRS[@]}"; do
    if [ -d "$DIR" ] && [ -f "$DIR/index.html" ]; then
        APP_DIR="$DIR"
        break
    fi
done

if [ -z "$APP_DIR" ]; then
    echo "ERROR: Chrona folder was not found."
    osascript -e 'display alert "Chrona" message "Could not find the Chrona project folder."'
    read -n 1 -s -r -p "Press any key to close..."
    echo
    exit 1
fi

echo "Using Chrona directory: $APP_DIR"

PID_FILE="$APP_DIR/.chrona-server.pid"
PORT_FILE="$APP_DIR/.chrona-server.port"

echo "Stopping previous Chrona server..."

# Stop the server recorded by an earlier run of this launcher.
if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE" 2>/dev/null)"
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping saved Chrona process: $OLD_PID"
        kill "$OLD_PID" 2>/dev/null
        sleep 1
        if kill -0 "$OLD_PID" 2>/dev/null; then
            kill -9 "$OLD_PID" 2>/dev/null
        fi
    fi
    rm -f "$PID_FILE" "$PORT_FILE"
fi

# Also stop orphaned Python HTTP servers whose working directory is this Chrona folder.
for PID in $(pgrep -f "python.*-m http\.server" 2>/dev/null); do
    PROCESS_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
    if [ "$PROCESS_CWD" = "$APP_DIR" ]; then
        echo "Stopping orphaned Chrona server: $PID"
        kill "$PID" 2>/dev/null
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null
        fi
    fi
done

# Find the first unused TCP port in the preferred range.
PORT=""
for CANDIDATE in {$START_PORT..$END_PORT}; do
    if ! lsof -nP -iTCP:"$CANDIDATE" -sTCP:LISTEN >/dev/null 2>&1; then
        PORT="$CANDIDATE"
        break
    fi
done

if [ -z "$PORT" ]; then
    echo "ERROR: No unused port was found between $START_PORT and $END_PORT."
    read -n 1 -s -r -p "Press any key to close..."
    echo
    exit 1
fi

cd "$APP_DIR" || exit 1

echo
echo "======================================"
echo "Starting Chrona"
echo "Directory: $APP_DIR"
echo "URL: http://localhost:$PORT"
echo "======================================"
echo

"$PYTHON_BIN" -m http.server "$PORT" --bind 127.0.0.1 &
SERVER_PID=$!

echo "$SERVER_PID" > "$PID_FILE"
echo "$PORT" > "$PORT_FILE"

cleanup() {
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null
    fi
    rm -f "$PID_FILE" "$PORT_FILE"
}
trap cleanup EXIT INT TERM

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "ERROR: Chrona server failed to start."
    rm -f "$PID_FILE" "$PORT_FILE"
    read -n 1 -s -r -p "Press any key to close..."
    echo
    exit 1
fi

open "http://localhost:$PORT"

wait "$SERVER_PID"

echo
read -n 1 -s -r -p "Chrona stopped. Press any key to close..."
echo
