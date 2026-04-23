#!/usr/bin/env bash
set -euo pipefail

# Accept an optional package version; default to 1.0.0 for local builds.
VERSION="${1:-1.0.0}"

# Resolve repo-relative paths so the script can be run from anywhere.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_DIR="$ROOT_DIR/build/prism-monitor_${VERSION}_all"
ARTIFACT_DIR="$ROOT_DIR/artifacts"

# Recreate the temporary package tree from scratch on every build.
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/DEBIAN"
mkdir -p "$STAGING_DIR/opt/prism-monitor/agent"
mkdir -p "$STAGING_DIR/opt/prism-monitor/server"
mkdir -p "$STAGING_DIR/opt/prism-monitor/dashboard"
mkdir -p "$STAGING_DIR/opt/prism-monitor/config"
mkdir -p "$STAGING_DIR/opt/prism-monitor/sql"
mkdir -p "$STAGING_DIR/opt/prism-monitor/bin"
mkdir -p "$STAGING_DIR/usr/local/bin"
mkdir -p "$STAGING_DIR/etc/systemd/system"
mkdir -p "$ARTIFACT_DIR"

# Install production runtime dependencies for the Node API so they can be copied
# directly into the package instead of fetched during package installation.
echo "Installing server dependencies..."
(
  cd "$ROOT_DIR/server"
  npm install
)

# Build the React dashboard ahead of time; the package ships the built static
# assets rather than running a frontend build on the target machine.
echo "Installing dashboard dependencies and building frontend..."
(
  cd "$ROOT_DIR/dashboard"
  npm install
  npm run build
)

# Generate the Debian control file by replacing the version placeholder.
sed "s/__VERSION__/$VERSION/" \
  "$ROOT_DIR/agent/packaging/full/DEBIAN/control.in" \
  > "$STAGING_DIR/DEBIAN/control"
printf '\n' >> "$STAGING_DIR/DEBIAN/control"

# Copy maintainer scripts that Debian will run during install and removal.
cp "$ROOT_DIR/agent/packaging/full/DEBIAN/postinst" "$STAGING_DIR/DEBIAN/postinst"
cp "$ROOT_DIR/agent/packaging/full/DEBIAN/prerm" "$STAGING_DIR/DEBIAN/prerm"
chmod 755 "$STAGING_DIR/DEBIAN/postinst" "$STAGING_DIR/DEBIAN/prerm"

# Stage the runtime files exactly where they should land on the installed system.
cp -R "$ROOT_DIR/agent/prism_agent" "$STAGING_DIR/opt/prism-monitor/agent/"
cp -R "$ROOT_DIR/server/src" "$STAGING_DIR/opt/prism-monitor/server/"
cp -R "$ROOT_DIR/server/node_modules" "$STAGING_DIR/opt/prism-monitor/server/"
cp -R "$ROOT_DIR/dashboard/dist" "$STAGING_DIR/opt/prism-monitor/dashboard/"
cp "$ROOT_DIR/server/package.json" "$STAGING_DIR/opt/prism-monitor/server/package.json"
if [ -f "$ROOT_DIR/server/package-lock.json" ]; then
  cp "$ROOT_DIR/server/package-lock.json" "$STAGING_DIR/opt/prism-monitor/server/package-lock.json"
fi
cp "$ROOT_DIR/agent/config/prism-agent.env.example" \
  "$STAGING_DIR/opt/prism-monitor/config/prism-agent.env.example"
cp "$ROOT_DIR/server/.env.example" \
  "$STAGING_DIR/opt/prism-monitor/config/prism-web.env.example"
cp "$ROOT_DIR/sql/schema.sql" "$STAGING_DIR/opt/prism-monitor/sql/schema.sql"
cp "$ROOT_DIR/sql/schema_document.sql" "$STAGING_DIR/opt/prism-monitor/sql/schema_document.sql"
cp "$ROOT_DIR/agent/packaging/full/bin/prism-init-db.sh" \
  "$STAGING_DIR/opt/prism-monitor/bin/prism-init-db.sh"
chmod 755 "$STAGING_DIR/opt/prism-monitor/bin/prism-init-db.sh"
cp "$ROOT_DIR/agent/packaging/full/systemd/prism-agent.service" \
  "$STAGING_DIR/etc/systemd/system/prism-agent.service"
cp "$ROOT_DIR/agent/packaging/full/systemd/prism-web.service" \
  "$STAGING_DIR/etc/systemd/system/prism-web.service"

# Expose a small wrapper command in /usr/local/bin so the DB init helper can be
# called as `prism-init-db` after the package is installed.
cat > "$STAGING_DIR/usr/local/bin/prism-init-db" <<'EOF'
#!/usr/bin/env bash
exec /opt/prism-monitor/bin/prism-init-db.sh "$@"
EOF
chmod 755 "$STAGING_DIR/usr/local/bin/prism-init-db"

# Ask Debian to turn the staging directory into the final .deb artifact.
dpkg-deb --build "$STAGING_DIR" "$ARTIFACT_DIR/prism-monitor_${VERSION}_all.deb"
echo "Built package: $ARTIFACT_DIR/prism-monitor_${VERSION}_all.deb"
