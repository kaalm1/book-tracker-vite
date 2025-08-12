#!/bin/bash
# deploy.sh

# Clean previous builds
npm run clean

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
firebase deploy --only functions

# View logs
firebase functions:log
