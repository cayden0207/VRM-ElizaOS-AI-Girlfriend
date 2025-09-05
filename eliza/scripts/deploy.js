#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class DeploymentScript {
  constructor() {
    this.startTime = Date.now();
    this.step = 0;
  }

  log(message, type = 'info') {
    this.step++;
    const timestamp = new Date().toISOString().substr(11, 8);
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📋';
    console.log(`[${timestamp}] ${prefix} Step ${this.step}: ${message}`);
  }

  async deploy() {
    console.log('🚀 Starting Phase 3 Production Deployment');
    console.log('='.repeat(60));

    try {
      // Pre-deployment checks
      await this.preDeploymentChecks();
      
      // Build and optimize
      await this.buildAndOptimize();
      
      // Deploy to Vercel
      await this.deployToVercel();
      
      // Post-deployment verification
      await this.postDeploymentVerification();
      
      this.log('Deployment completed successfully!', 'success');
      
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    this.log('Running pre-deployment checks');

    // Check if required files exist
    const requiredFiles = [
      'vercel.json',
      'bridge/production-bridge.js',
      'package.json',
      '.env.production'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Check package.json for required dependencies
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['express', 'cors', 'compression', 'helmet', 'express-rate-limit'];
    
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies[dep]) {
        throw new Error(`Required dependency missing: ${dep}`);
      }
    }

    // Check characters directory
    if (!fs.existsSync('characters') || fs.readdirSync('characters').length === 0) {
      throw new Error('Characters directory is empty');
    }

    this.log('All pre-deployment checks passed', 'success');
  }

  async buildAndOptimize() {
    this.log('Building and optimizing for production');

    try {
      // Clean dist directory if it exists
      if (fs.existsSync('dist')) {
        execSync('rm -rf dist', { stdio: 'pipe' });
      }

      // Create optimized package.json for deployment
      this.createOptimizedPackageJson();
      
      // Validate all character files
      this.validateCharacterFiles();
      
      // Create deployment info
      this.createDeploymentInfo();

      this.log('Build and optimization completed', 'success');
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  createOptimizedPackageJson() {
    const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    const optimizedPkg = {
      name: originalPkg.name,
      version: originalPkg.version,
      description: 'VRM ElizaOS AI Girlfriend - Production Build',
      type: 'module',
      scripts: {
        start: 'node bridge/production-bridge.js',
        build: 'echo "Build complete"'
      },
      dependencies: {
        express: originalPkg.dependencies.express,
        cors: originalPkg.dependencies.cors,
        compression: originalPkg.dependencies.compression,
        helmet: originalPkg.dependencies.helmet,
        'express-rate-limit': originalPkg.dependencies['express-rate-limit']
      },
      engines: {
        node: '>=18.0.0'
      }
    };

    fs.writeFileSync('package.json.backup', JSON.stringify(originalPkg, null, 2));
    fs.writeFileSync('package.json', JSON.stringify(optimizedPkg, null, 2));
    
    this.log('Created optimized package.json');
  }

  validateCharacterFiles() {
    const charactersDir = 'characters';
    const files = fs.readdirSync(charactersDir).filter(f => f.endsWith('.json'));
    
    let validCount = 0;
    let totalSize = 0;

    for (const file of files) {
      try {
        const filePath = path.join(charactersDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const character = JSON.parse(content);
        
        // Validate required fields
        if (!character.name || !character.bio || !character.lore) {
          throw new Error(`Invalid character file: ${file}`);
        }
        
        totalSize += content.length;
        validCount++;
      } catch (error) {
        throw new Error(`Character validation failed for ${file}: ${error.message}`);
      }
    }

    this.log(`Validated ${validCount} characters (${Math.round(totalSize/1024)}KB total)`);
  }

  createDeploymentInfo() {
    const deploymentInfo = {
      buildTime: new Date().toISOString(),
      version: '3.0.0',
      phase: 3,
      features: [
        'production_optimized',
        'response_caching',
        'enhanced_dialogue',
        'emotion_detection',
        'personality_adaptation',
        'security_hardened',
        'performance_monitored'
      ],
      characters: fs.readdirSync('characters').filter(f => f.endsWith('.json')).length,
      nodeVersion: process.version,
      environment: 'production'
    };

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    this.log('Created deployment info');
  }

  async deployToVercel() {
    this.log('Deploying to Vercel');

    try {
      // Check if Vercel CLI is available
      try {
        execSync('vercel --version', { stdio: 'pipe' });
      } catch {
        throw new Error('Vercel CLI not found. Install with: npm i -g vercel');
      }

      // Deploy to Vercel
      this.log('Running Vercel deployment...');
      const deployOutput = execSync('vercel --prod --yes', { 
        encoding: 'utf8',
        timeout: 300000 // 5 minutes timeout
      });

      // Extract deployment URL
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+/);
      if (urlMatch) {
        this.deploymentUrl = urlMatch[0];
        this.log(`Deployment URL: ${this.deploymentUrl}`, 'success');
      }

      this.log('Vercel deployment completed', 'success');
    } catch (error) {
      throw new Error(`Vercel deployment failed: ${error.message}`);
    }
  }

  async postDeploymentVerification() {
    if (!this.deploymentUrl) {
      this.log('Skipping post-deployment verification (no URL)', 'warning');
      return;
    }

    this.log('Running post-deployment verification');

    try {
      // Test health endpoint
      const healthResponse = await fetch(`${this.deploymentUrl}/health`);
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      const healthData = await healthResponse.json();
      if (!healthData.success) {
        throw new Error('Health check returned failure');
      }

      this.log(`Health check passed - ${healthData.elizaOS.charactersLoaded} characters loaded`, 'success');

      // Test characters endpoint
      const charactersResponse = await fetch(`${this.deploymentUrl}/api/characters`);
      if (!charactersResponse.ok) {
        throw new Error(`Characters endpoint failed: ${charactersResponse.status}`);
      }

      const charactersData = await charactersResponse.json();
      this.log(`Characters endpoint verified - ${charactersData.data.total} characters available`, 'success');

      // Test a simple chat
      const chatResponse = await fetch(`${this.deploymentUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'deploy_test',
          characterId: 'alice',
          message: 'Hello, deployment test!'
        })
      });

      if (!chatResponse.ok) {
        throw new Error(`Chat test failed: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      if (!chatData.success) {
        throw new Error('Chat test returned failure');
      }

      this.log('Chat functionality verified', 'success');
      this.log('All post-deployment tests passed', 'success');

    } catch (error) {
      throw new Error(`Post-deployment verification failed: ${error.message}`);
    }
  }

  cleanup() {
    // Restore original package.json
    if (fs.existsSync('package.json.backup')) {
      fs.renameSync('package.json.backup', 'package.json');
      this.log('Restored original package.json');
    }
  }
}

// Run deployment
const deployment = new DeploymentScript();

process.on('exit', () => {
  deployment.cleanup();
});

process.on('SIGINT', () => {
  deployment.cleanup();
  process.exit(0);
});

deployment.deploy().catch(error => {
  console.error('Deployment script failed:', error);
  deployment.cleanup();
  process.exit(1);
});