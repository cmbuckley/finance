#!/bin/bash

script="$(dirname "$0")/hsbc.awk"
inplace=0

if [ "$1" = "-i" ]; then
    inplace=1
    shift
fi

for file in "$@"; do
    if [ -e "$file" ]; then
        if [ $inplace -eq 1 ]; then
            { rm "$file" && awk -f "$script" > "$file"; } < "$file"
        else
            awk -f "$script" "$file"
        fi
    else
        echo "$file: No such file or directory" >&2
        exit 1
    fi
done
