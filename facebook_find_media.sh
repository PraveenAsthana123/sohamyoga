#!/usr/bin/env bash

echo "============================================================"
echo "             FACEBOOK - FIND IMAGE / VIDEO"
echo "============================================================"

find \
    /home/praveen/Pictures \
    /mnt/deepa/sohamyoga \
    -type f \
    \( \
      -iname "*.jpg" \
      -o -iname "*.jpeg" \
      -o -iname "*.png" \
      -o -iname "*.webp" \
      -o -iname "*.mp4" \
      -o -iname "*.mov" \
    \) \
    2>/dev/null |
    grep -v node_modules |
    head -100
