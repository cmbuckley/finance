#!/bin/bash

script="$(dirname "$0")/hsbc.awk"

for file in "$@"; do
    if [ -e "$file" ]; then
        { rm "$file" && awk -f "$script" > "$file"; } < "$file"
    else
        echo "$file: No such file or directory" >&2
        exit 1
    fi
done
