#!/usr/bin/env bash
set -euo pipefail

# Known deployed API revision with stale-form protection.
revision=17fb47ae01a4dc11ca0e51bfb518afd259b3596c
mkdir -p .demo-backend
curl --fail --silent --show-error --location --retry 2 \
  "https://codeload.github.com/vigufarm-web/laporankebun/tar.gz/${revision}" |
  tar -xz --strip-components=1 -C .demo-backend \
    "laporankebun-${revision}/server.js" \
    "laporankebun-${revision}/package.json" \
    "laporankebun-${revision}/package-lock.json" \
    "laporankebun-${revision}/lib" \
    "laporankebun-${revision}/public"

# Only the Input Data Kebun gateway listens on Render's public port.
node --input-type=module -e '
  import {readFileSync,writeFileSync} from "node:fs";
  const file = ".demo-backend/server.js";
  const original = readFileSync(file, "utf8");
  const listener = ".listen(PORT, \x270.0.0.0\x27,";
  if (original.split(listener).length !== 2) throw Error("Listener API berubah.");
  writeFileSync(file, original.replace(listener, ".listen(PORT, \x27127.0.0.1\x27,"));
'
node patch-demo-sales.mjs .demo-backend/server.js
npm ci --omit=dev --prefix .demo-backend
