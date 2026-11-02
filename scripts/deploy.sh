#!/usr/bin/env bash
# Copies the working tree to the VPS and rebuilds the containers.
#
#   scripts/deploy.sh            # deploy to hetzner-arch:~/golem
#   DEPLOY_HOST=other scripts/deploy.sh
#
# .env and data/ on the server are never touched; .env is created there once by hand.
set -euo pipefail

host="${DEPLOY_HOST:-hetzner-arch}"
dir="${DEPLOY_DIR:-golem}"

cd "$(dirname "$0")/.."

# macOS tar otherwise adds ._* AppleDouble files beside every file with extended attributes.
export COPYFILE_DISABLE=1

# Every file git would track, committed or not, so .gitignore keeps node_modules,
# build output, data/ and .env out of the upload.
git ls-files -z --cached --others --exclude-standard |
	tar --null -T - -czf - |
	ssh "$host" "set -e
		mkdir -p ~/$dir/data
		cd ~/$dir
		test -f .env || { echo 'Missing ~/$dir/.env on $host.' >&2; exit 1; }
		# Remove the previous copy so deleted files do not linger, keeping secrets and the database.
		find . -mindepth 1 -maxdepth 1 ! -name .env ! -name data -exec rm -rf {} +
		tar -xzf -
		docker compose up -d --build --remove-orphans
		docker image prune -f >/dev/null
		docker compose ps"
