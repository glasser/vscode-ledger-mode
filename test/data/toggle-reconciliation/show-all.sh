#!/bin/bash

# Display all test data for reconciliation toggle tests

# Change to the directory containing this script
cd "$(dirname "$0")"

for test_dir in */; do
    if [ -d "$test_dir" ]; then
        echo "=========================================="
        echo "TEST: ${test_dir%/}"
        echo "=========================================="
        
        echo ""
        echo "INPUT:"
        echo "------"
        if [ -f "$test_dir/input.ledger" ]; then
            awk '{printf "%2d→%s\n", NR-1, $0}' "$test_dir/input.ledger"
        else
            echo "(no input.ledger found)"
        fi
        
        echo ""
        echo "EXPECTED OUTPUTS:"
        echo "-----------------"
        
        for expected_file in "$test_dir"/expected-line*.ledger; do
            if [ -f "$expected_file" ]; then
                line_num=$(basename "$expected_file" .ledger | sed 's/expected-line//')
                echo ""
                echo "  When toggling line $line_num:"
                awk '{printf "%2d→%s\n", NR-1, $0}' "$expected_file"
            fi
        done
        
        echo ""
        echo ""
    fi
done
