#!/bin/bash

for v in `deno coverage | grep "All files" | perl -lane 'print / \d+/g'`; do 
    if [[ "$v" -lt "85" ]]; then 
        echo "Threshold below 85"; 
        exit 1; 
    fi; 
done
echo "Threshold met"
