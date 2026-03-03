#!/bin/sh
# fake-gcs-server bucket initialization script.
# Runs via an init container (curlimages/curl) after fake-gcs-server starts.

set -e

GCS_ENDPOINT="${GCS_ENDPOINT:-http://fake-gcs:4443}"
GCS_BUCKET="${GCS_BUCKET:-prosearc}"

echo "Waiting for fake-gcs-server to be ready..."
until curl -sf "${GCS_ENDPOINT}/storage/v1/b" > /dev/null 2>&1; do
  sleep 1
done

echo "Creating bucket: ${GCS_BUCKET}"
# POST returns 409 if bucket already exists — ignore that error
curl -sf -X POST "${GCS_ENDPOINT}/storage/v1/b" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"${GCS_BUCKET}\"}" > /dev/null 2>&1 || true

echo "Fake GCS initialization complete."
