#!/bin/bash
# Description: Helper script to git add, commit with user prompt, and git push.

# Stage all changes
git add .
echo "Staged all changes."

# Prompt user for commit message
read -p "Enter commit message: " msg

if [ -z "$msg" ]; then
  echo "Aborting: Commit message cannot be empty."
  exit 1
fi

# Commit
git commit -m "$msg"

# Push
git push
