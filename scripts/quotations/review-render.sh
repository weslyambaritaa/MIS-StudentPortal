#!/bin/sh
set -eu
apk add --no-cache poppler-utils >/dev/null
cd /repo/app/be/internal-api
node /repo/scripts/quotations/review-render.cjs
for type in private public online inhouse; do
  for variant in clone generated client; do
    pdftoppm -r 96 -png "/repo/.tmp-quotation-review/$type-$variant.pdf" "/repo/.tmp-quotation-review/$type-$variant"
  done
done
node /repo/scripts/quotations/compare-render.cjs
node --test test/quotation-document.test.cjs test/quotations-route.test.cjs
