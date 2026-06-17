#!/bin/bash

while true
do
  aider \
    --model ollama/qwen2.5-coder:7b \
    --yes-always \
    --message-file goal.txt

  npm test

  if [ $? -eq 0 ]
  then
    git add .
    git commit -m "agent progress"
  fi

  sleep 60
done
