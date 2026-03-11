#!/bin/bash
# Description: Helper script to append configuration or notes to a shared Google Doc using gws.
# Usage: ./scripts/log_to_doc.sh "Your note here"

# Set your Google Doc ID here once you create a doc. You can also export this in your shell.
DOC_ID="${WHOFED_DOC_ID:-}"

if [ -z "$DOC_ID" ]; then
    echo "Error: WHOFED_DOC_ID is not set."
    echo "Please create a Google Doc and set the Document ID."
    echo "You can do this by running:"
    echo '  export WHOFED_DOC_ID="your_document_id_from_url"'
    echo "Or paste the ID directly into this script."
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 \"Text to append\""
    exit 1
fi

# Append a timestamp to the log to keep things organized
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
FORMATTED_TEXT="[$TIMESTAMP] $1\n"

echo "Appending to Google Doc ($DOC_ID)..."

# Run the gws helper tool to write to the document
gws docs +write "$DOC_ID" "$FORMATTED_TEXT"

if [ $? -eq 0 ]; then
    echo "✅ Successfully appended to Google Doc!"
else
    echo "❌ Failed to append to Google Doc. Ensure you are authenticated by running 'gws auth login'."
fi
