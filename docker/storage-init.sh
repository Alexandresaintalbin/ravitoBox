#!/bin/sh
set -eu

echo "Attente du schéma storage..."
until psql -tAc "select to_regclass('storage.buckets')" | grep -q buckets; do
  sleep 2
done

psql -v ON_ERROR_STOP=1 -f /storage.sql
echo "Bucket product-images prêt."
