.PHONY: help install serve dev ngrok up stop status tunnel-url oauth-origin oauth-open

PORT ?= 3000
HOST ?= 127.0.0.1
RUN_DIR := .run
SERVER_PID_FILE := $(RUN_DIR)/server.pid
NGROK_PID_FILE := $(RUN_DIR)/ngrok.pid

help:
	@echo "Available targets:"
	@echo "  make install       # install npm dependencies"
	@echo "  make serve         # run the local server in foreground"
	@echo "  make dev           # run the local server in watch mode"
	@echo "  make ngrok         # run ngrok for PORT in foreground"
	@echo "  make up            # start local server + ngrok in background and print URL"
	@echo "  make stop          # stop background server + ngrok started by make up"
	@echo "  make status        # show background process status and current ngrok URL"
	@echo "  make tunnel-url    # print current ngrok public URL"
	@echo "  make oauth-origin  # print current OAuth authorized JavaScript origin value"
	@echo "  make oauth-open    # open Google Cloud credentials page and print current origin"

install:
	npm install

serve:
	HOST=$(HOST) PORT=$(PORT) npm start

dev:
	HOST=$(HOST) PORT=$(PORT) npm run dev

ngrok:
	ngrok http $(PORT)

up:
	@PORT=$(PORT) HOST=$(HOST) RUN_DIR=$(RUN_DIR) ./scripts/dev-up.sh

stop:
	@PORT=$(PORT) RUN_DIR=$(RUN_DIR) ./scripts/dev-stop.sh

status:
	@PORT=$(PORT) RUN_DIR=$(RUN_DIR) ./scripts/dev-status.sh

tunnel-url:
	@curl -fsS http://127.0.0.1:4040/api/tunnels | python3 -c 'import json,sys; data=json.load(sys.stdin); tunnels=[t.get("public_url","") for t in data.get("tunnels",[]) if t.get("proto")=="https"]; print(tunnels[0] if tunnels else "")'

oauth-origin:
	@URL=`$(MAKE) --no-print-directory tunnel-url`; \
	if [ -z "$$URL" ]; then \
		echo "No active ngrok https tunnel found."; \
		exit 1; \
	fi; \
	python3 -c 'import sys,urllib.parse; print("{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(sys.argv[1])))' "$$URL"

oauth-open:
	@ORIGIN=`$(MAKE) --no-print-directory oauth-origin`; \
	echo "Add this value to Google OAuth authorized JavaScript origins:"; \
	echo "$$ORIGIN"; \
	if command -v open >/dev/null 2>&1; then \
		open https://console.cloud.google.com/apis/credentials; \
	fi
