#!/bin/sh
set -eu
apk add --no-cache poppler-utils >/dev/null
templates=/repo/app/be/internal-api/src/modules/quotations/templates
review=/repo/.tmp-quotation-review
mkdir -p "$templates/artwork" "$review"
for type in private public online inhouse; do
  pdfinfo "$templates/$type.pdf"
  pdffonts "$templates/$type.pdf"
  pdftotext -bbox-layout "$templates/$type.pdf" "$review/$type.xml"
  pdftoppm -r 96 -png "$templates/$type.pdf" "$review/$type"
  for page in 1 2; do
    pdftocairo -svg -f "$page" -l "$page" "$templates/$type.pdf" "$templates/artwork/$type-$page.svg"
  done
done
