# CoinPoker Intelligence Assistant - Deployment Guide

## Table of Contents

- [Overview](#overview)
- [Build Instructions](#build-instructions)
  - [Prerequisites](#prerequisites)
  - [Development Build](#development-build)
  - [Production Build](#production-build)
- [Packaging with Electron](#packaging-with-electron)
  - [Configuration](#configuration)
  - [Building for Different Platforms](#building-for-different-platforms)
  - [Code Signing](#code-signing)
- [Distribution Strategies](#distribution-strategies)
  - [Direct Download](#direct-download)
  - [Auto-Updates](#auto-updates)
  - [Platform-Specific Stores](#platform-specific-stores)
- [Update Mechanisms](#update-mechanisms)
  - [Manual Updates](#manual-updates)
  - [Automatic Updates](#automatic-updates)
  - [Update Server Setup](#update-server-setup)
- [Performance Monitoring](#performance-monitoring)
  - [Metrics Collection](#metrics-collection)
  - [Logging](#logging)
  - [Error Reporting](#error-reporting)
- [Deployment Checklist](#deployment-checklist)

## Overview

This guide covers the process of building, packaging, and distributing the CoinPoker Intelligence Assistant application. The application is built using Electron, which allows it to run as a desktop application across multiple platforms.

## Build Instructions

### Prerequisites

Before building the application, ensure you have the following installed:

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd poker-helper
npm install
```

### Development Build

For development and testing, use the following commands:

```bash
# Start the development server with hot reloading
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

The development build includes:
- Source maps for easier debugging
- Hot reloading for faster development
- Development-specific environment variables

### Production Build

For production deployment, use the following commands:

```bash
# Clean previous builds
npm run clean

# Build TypeScript files
npm run build:ts

# Package the application
npm run electron:build
```

The production build process:
1. Compiles TypeScript to JavaScript
2. Bundles and minifies code
3. Optimizes assets
4. Packages the application with Electron

## Packaging with Electron

The application uses `electron-builder` for packaging the application into distributable formats.

### Configuration

The packaging configuration is defined in the `build` section of `package.json`:

```json
"build": {
  "appId": "com.coinpoker.intelligence-assistant",
  "productName": "CoinPoker Intelligence Assistant",
  "directories": {
    "output": "build"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*"
  ],
  "mac": {
    "target": "dmg"
  },
  "win": {
    "target": "nsis"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

You can customize this configuration based on your specific requirements.

### Building for Different Platforms

#### Windows

```bash
npm run electron:build -- --win
```

This creates:
- NSIS installer (.exe)
- Portable executable (optional)

#### macOS

```bash
npm run electron:build -- --mac
```

This creates:
- DMG file (.dmg)
- ZIP archive (optional)

> **Note:** Building for macOS requires a macOS machine due to Apple's code signing requirements.

#### Linux

```bash
npm run electron:build -- --linux
```

This creates:
- AppImage (.AppImage)
- Debian package (.deb) (optional)
- RPM package (.rpm) (optional)

### Code Signing

For production releases, code signing is essential to avoid security warnings and ensure integrity.

#### Windows Code Signing

1. Obtain a code signing certificate from a trusted Certificate Authority
2. Configure in `electron-builder.yml`:

```yaml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${CERTIFICATE_PASSWORD}
```

#### macOS Code Signing

1. Obtain an Apple Developer ID certificate
2. Configure in `electron-builder.yml`:

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  hardenedRuntime: true
  entitlements: "entitlements.plist"
  entitlementsInherit: "entitlements.plist"
```

## Distribution Strategies

### Direct Download

The simplest distribution method is providing direct downloads from a website:

1. Host the packaged applications on a web server or CDN
2. Create a download page with links to different platform versions
3. Include installation instructions and system requirements

Example download page structure:
```html
<div class="downloads">
  <div class="download-option">
    <h3>Windows</h3>
    <a href="path/to/CoinPokerIntelligenceAssistant-Setup-1.0.0.exe">Download for Windows</a>
    <p>Windows 10 or later, 64-bit</p>
  </div>
  
  <div class="download-option">
    <h3>macOS</h3>
    <a href="path/to/CoinPokerIntelligenceAssistant-1.0.0.dmg">Download for macOS</a>
    <p>macOS 10.15 or later</p>
  </div>
  
  <div class="download-option">
    <h3>Linux</h3>
    <a href="path/to/CoinPokerIntelligenceAssistant-1.0.0.AppImage">Download for Linux</a>
    <p>Ubuntu 20.04 or equivalent</p>
  </div>
</div>
```

### Auto-Updates

For automatic updates, configure `electron-updater`:

1. Add to `package.json`:

```json
"dependencies": {
  "electron-updater": "^4.6.5"
}
```

2. Configure update sources in `electron-builder.yml`:

```yaml
publish:
  provider: "generic"
  url: "https://your-update-server.com/updates"
```

3. Implement update checking in your main process:

```typescript
import { autoUpdater } from 'electron-updater';

// Configure logging
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Check for updates
export function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();
}

// Listen for update events
autoUpdater.on('update-available', () => {
  console.log('Update available');
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded');
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
});
```

### Platform-Specific Stores

#### Microsoft Store

1. Create a Microsoft Developer account
2. Package your app as an MSIX
3. Submit through the Partner Center

#### Mac App Store

1. Enroll in the Apple Developer Program
2. Configure your app for Mac App Store submission
3. Submit through App Store Connect

## Update Mechanisms

### Manual Updates

For manual updates:

1. Notify users through the application UI
2. Provide a download link to the latest version
3. Include release notes

Example notification component:

```typescript
import React, { useState, useEffect } from 'react';
import { checkForUpdates } from '../utils/updates';

const UpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  
  useEffect(() => {
    // Check for updates on component mount
    const checkUpdate = async () => {
      const result = await checkForUpdates();
      setUpdateAvailable(result.available);
      setUpdateInfo(result.info);
    };
    
    checkUpdate();
    // Check periodically
    const interval = setInterval(checkUpdate, 1000 * 60 * 60); // Every hour
    
    return () => clearInterval(interval);
  }, []);
  
  if (!updateAvailable) return null;
  
  return (
    <div className="update-notification">
      <h3>Update Available</h3>
      <p>Version {updateInfo.version} is now available.</p>
      <a 
        href={updateInfo.downloadUrl} 
        className="update-button"
      >
        Download Update
      </a>
    </div>
  );
};

export default UpdateNotification;
```

### Automatic Updates

For automatic updates with `electron-updater`:

1. Configure update server
2. Implement update logic in main process
3. Create UI for update notifications

Example implementation:

```typescript
// In main.ts
import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Check for updates on app start
app.on('ready', () => {
  autoUpdater.checkForUpdates();
});

// Update events
autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available. Downloading now...`,
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded. It will be installed when you restart the application.`,
    buttons: ['Restart Now', 'Later']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  dialog.showErrorBox('Update Error', err.message);
});
```

### Update Server Setup

You can use a simple static file server for updates:

1. Create a directory structure:

```
/updates
  /win
    /latest-version.yml
    /CoinPokerIntelligenceAssistant-Setup-1.0.0.exe
  /mac
    /latest-version.yml
    /CoinPokerIntelligenceAssistant-1.0.0.dmg
  /linux
    /latest-version.yml
    /CoinPokerIntelligenceAssistant-1.0.0.AppImage
```

2. Generate `latest-version.yml` files during the build process
3. Host on a static file server or CDN

Example `latest-version.yml`:

```yaml
version: 1.0.0
files:
  - url: CoinPokerIntelligenceAssistant-Setup-1.0.0.exe
    sha512: [SHA512 hash of the file]
    size: [size in bytes]
path: CoinPokerIntelligenceAssistant-Setup-1.0.0.exe
sha512: [SHA512 hash of the file]
releaseDate: '2025-05-27T14:00:00.000Z'
```

## Performance Monitoring

### Metrics Collection

Implement performance monitoring using `prom-client`:

```typescript
import { Registry, Counter, Gauge, Histogram } from 'prom-client';

// Create a registry
const register = new Registry();

// Define metrics
const captureLatency = new Histogram({
  name: 'screen_capture_latency_ms',
  help: 'Screen capture latency in milliseconds',
  buckets: [10, 50, 100, 200, 500, 1000],
  registers: [register]
});

const ocrLatency = new Histogram({
  name: 'ocr_processing_latency_ms',
  help: 'OCR processing latency in milliseconds',
  buckets: [50, 100, 200, 500, 1000, 2000],
  registers: [register]
});

const llmLatency = new Histogram({
  name: 'llm_api_latency_ms',
  help: 'LLM API latency in milliseconds',
  buckets: [100, 200, 500, 1000, 2000, 5000],
  registers: [register]
});

const errorCounter = new Counter({
  name: 'error_count',
  help: 'Count of errors by type',
  labelNames: ['module', 'type'],
  registers: [register]
});

const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
  registers: [register]
});

// Export metrics
export function getMetrics() {
  return register.metrics();
}

// Example usage
export function recordCaptureLatency(latencyMs: number) {
  captureLatency.observe(latencyMs);
}

export function recordError(module: string, type: string) {
  errorCounter.inc({ module, type });
}
```

### Logging

Implement structured logging with `winston`:

```typescript
import winston from 'winston';
import path from 'path';
import { app } from 'electron';

// Define log directory
const logDir = path.join(app.getPath('userData'), 'logs');

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'coinpoker-assistant' },
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File logging
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
  ]
});

// Log rotation
// Implement log rotation to prevent log files from growing too large

export default logger;
```

### Error Reporting

Implement error reporting to track issues in production:

```typescript
import { app } from 'electron';
import logger from './logger';

// Global error handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Send to error reporting service
  reportError('uncaughtException', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Send to error reporting service
  reportError('unhandledRejection', reason);
});

// Error reporting function
function reportError(type: string, error: any) {
  // Implement your error reporting logic here
  // This could send errors to a service like Sentry, LogRocket, etc.
  
  // Example implementation:
  const errorData = {
    type,
    message: error.message || String(error),
    stack: error.stack,
    appVersion: app.getVersion(),
    platform: process.platform,
    timestamp: new Date().toISOString()
  };
  
  // Log locally
  logger.error('Error report:', errorData);
  
  // In a real implementation, you would send this to your error reporting service
  // Example: sendToErrorReportingService(errorData);
}

export { reportError };
```

## Deployment Checklist

Before deploying a new version, ensure you complete the following checklist:

- [ ] All tests pass (`npm test`)
- [ ] Code linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Environment variables are properly configured
- [ ] Build succeeds for all target platforms
- [ ] Application starts correctly on all platforms
- [ ] Auto-update mechanism works
- [ ] Performance metrics are within acceptable ranges
- [ ] Security measures are properly implemented
- [ ] Documentation is updated
- [ ] Version number is incremented in package.json
- [ ] Release notes are prepared
- [ ] Code is signed (for production releases)
- [ ] Backup of previous version is available

After deployment:

- [ ] Monitor error reports for the new version
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Address any critical issues promptly