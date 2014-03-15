#!/bin/bash

{ rm "$1" && awk -f "$(dirname "$0")/hsbc.awk" > "$1"; } < "$1"
