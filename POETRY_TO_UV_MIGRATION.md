# 🎮 Nexus-Console Poetry → UV Migration Guide

## Overview

Nexus-Console is the UI/control interface for the Happy ecosystem. It depends on shared-config packages and must be migrated after shared-config is complete.

## Architecture Context

```
nexus-console/
├── frontend/               # React/TypeScript UI
│   ├── package.json
│   └── src/
├── backend/               # Python FastAPI/WebSocket server
│   ├── pyproject.toml    # Poetry config to migrate
│   └── src/
├── shared/                # Shared types/interfaces
└── docker/                # Container configs
```

## Pre-Migration Requirements

### ✅ Prerequisites
- [ ] shared-config migration complete
- [ ] shared-config packages published to GitHub Packages
- [ ] UV installed locally (`brew install uv`)
- [ ] GitHub Packages authentication configured

### 📦 Dependency Audit
```bash
cd ~/Development/business-org/nexus-console

# Backend dependencies
cd backend
poetry show --tree > ../migration-audit/backend-deps.txt
poetry export -f requirements.txt > ../migration-audit/backend-requirements.txt

# Check shared-config usage
grep -r "business-org-shared-config" . > ../migration-audit/shared-config-usage.txt
```

## Migration Steps

### Phase 1: Backend Migration

#### 1. Create Migration Branch
```bash
git checkout main
git pull origin main
git checkout -b chore/migrate-to-uv-nexus

# Backup files
cp backend/pyproject.toml backend/pyproject.toml.poetry-backup
cp backend/poetry.lock backend/poetry.lock.backup
```

#### 2. Migrate Backend to UV
```bash
cd backend

# Run migration tool
uvx migrate-to-uv

# Manual adjustments for shared-config
```

#### 3. Update Backend pyproject.toml
```toml
# backend/pyproject.toml
[project]
name = "nexus-console-backend"
version = "2.0.0"
description = "Backend service for Nexus Console"
readme = "README.md"
requires-python = ">=3.12"
license = {text = "MIT"}

dependencies = [
    # Framework
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.30.0",
    "websockets>=12.0",
    
    # Shared packages from GitHub
    "business-org-shared-config>=1.0.0",
    
    # Data handling
    "pydantic>=2.0.0",
    "redis>=5.0.0",
    
    # Monitoring
    "prometheus-client>=0.20.0",
    "opentelemetry-api>=1.24.0",
    "structlog>=24.0.0",
]

[tool.uv]
# Package configuration
package = true
env-file = "../.env"

# GitHub Packages source
index-url = "https://pypi.org/simple"
extra-index-url = ["https://pypi.pkg.github.com/happy-patterns-org"]

[tool.uv.dev-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "mypy>=1.11.0",
    "ruff>=0.6.0",
    "black>=23.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

#### 4. Configure GitHub Packages Authentication
```bash
# Create .netrc for GitHub Packages
cat >> ~/.netrc << EOF
machine pypi.pkg.github.com
login ${GITHUB_USERNAME}
password ${GITHUB_TOKEN}
EOF

chmod 600 ~/.netrc

# Or use environment variable
export UV_EXTRA_INDEX_URL="https://${GITHUB_TOKEN}@pypi.pkg.github.com/happy-patterns-org"
```

### Phase 2: Frontend Configuration

#### 1. Update Frontend package.json
```json
// frontend/package.json
{
  "name": "nexus-console-frontend",
  "version": "2.0.0",
  "private": true,
  "dependencies": {
    "@happy-patterns-org/shared-config-ts": "^1.0.0",
    "@happy-patterns-org/observatory-types": "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@reduxjs/toolkit": "^2.0.0",
    "socket.io-client": "^4.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

#### 2. Configure NPM for GitHub Packages
```bash
# frontend/.npmrc
@happy-patterns-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Phase 3: Unified Build System

#### 1. Root Makefile
```makefile
# Makefile (root)
.PHONY: help bootstrap dev test build docker

BACKEND_DIR := backend
FRONTEND_DIR := frontend

help:
	@echo "Nexus Console - UV-based build system"
	@echo "  bootstrap  - Set up full environment"
	@echo "  dev       - Run development servers"
	@echo "  test      - Run all tests"
	@echo "  build     - Build for production"
	@echo "  docker    - Build Docker images"

bootstrap:
	@echo "🎮 Bootstrapping Nexus Console..."
	# Backend setup with UV
	cd $(BACKEND_DIR) && uv sync
	# Frontend setup
	cd $(FRONTEND_DIR) && npm ci
	@echo "✅ Bootstrap complete"

dev:
	@echo "🚀 Starting development servers..."
	# Start backend with hot reload
	cd $(BACKEND_DIR) && uv run uvicorn src.main:app --reload &
	# Start frontend dev server
	cd $(FRONTEND_DIR) && npm run dev

test:
	@echo "🧪 Running tests..."
	# Backend tests
	cd $(BACKEND_DIR) && uv run pytest tests/ -v
	cd $(BACKEND_DIR) && uv run mypy src/
	# Frontend tests
	cd $(FRONTEND_DIR) && npm test

build:
	@echo "📦 Building for production..."
	# Backend doesn't need building
	# Frontend production build
	cd $(FRONTEND_DIR) && npm run build

docker:
	@echo "🐳 Building Docker images..."
	docker build -f docker/backend.dockerfile -t nexus-console-backend .
	docker build -f docker/frontend.dockerfile -t nexus-console-frontend .
```

### Phase 4: Docker Configuration

#### 1. Update Backend Dockerfile
```dockerfile
# docker/backend.dockerfile
FROM python:3.12-slim

# Install UV
RUN pip install uv

WORKDIR /app

# Copy dependency files
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies using UV
RUN uv sync --frozen --no-dev

# Copy application code
COPY backend/src ./src

# Run with UV
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Phase 5: Integration Updates

#### 1. Update WebSocket Connection
```python
# backend/src/websocket/manager.py
from shared_config import Config
from observatory_types import MetricEvent

class ConnectionManager:
    def __init__(self):
        self.config = Config()
        self.active_connections: dict[str, WebSocket] = {}
    
    async def broadcast_metric(self, metric: MetricEvent):
        """Broadcast metric to all connected clients"""
        message = metric.model_dump_json()
        for connection in self.active_connections.values():
            await connection.send_text(message)
```

#### 2. Frontend Integration
```typescript
// frontend/src/services/api.ts
import { Config } from '@happy-patterns-org/shared-config-ts';
import { MetricEvent } from '@happy-patterns-org/observatory-types';

const config = new Config();

export class NexusAPI {
  private ws: WebSocket;
  
  constructor() {
    this.ws = new WebSocket(config.nexusWebSocketUrl);
  }
  
  onMetric(callback: (metric: MetricEvent) => void) {
    this.ws.onmessage = (event) => {
      const metric = JSON.parse(event.data) as MetricEvent;
      callback(metric);
    };
  }
}
```

### Phase 6: CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: Nexus Console CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

jobs:
  test-backend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install UV
        run: |
          curl -LsSf https://astral.sh/uv/install.sh | sh
          echo "$HOME/.cargo/bin" >> $GITHUB_PATH
      
      - name: Configure GitHub Packages
        run: |
          echo "UV_EXTRA_INDEX_URL=https://${{ secrets.GITHUB_TOKEN }}@pypi.pkg.github.com/happy-patterns-org" >> $GITHUB_ENV
      
      - name: Cache UV
        uses: actions/cache@v4
        with:
          path: ~/.cache/uv
          key: ${{ runner.os }}-uv-backend-${{ hashFiles('backend/uv.lock') }}
      
      - name: Install dependencies
        working-directory: backend
        run: uv sync
      
      - name: Run tests
        working-directory: backend
        run: |
          uv run pytest tests/ -v --cov=src
          uv run mypy src/
          uv run ruff check src/

  test-frontend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: https://npm.pkg.github.com
      
      - name: Cache npm
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-npm-${{ hashFiles('frontend/package-lock.json') }}
      
      - name: Install dependencies
        working-directory: frontend
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm ci
      
      - name: Run tests
        working-directory: frontend
        run: |
          npm run type-check
          npm test
          npm run build

  docker-build:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push images
        run: |
          docker buildx build \
            --platform linux/amd64,linux/arm64 \
            --push \
            -t ghcr.io/happy-patterns-org/nexus-console-backend:latest \
            -f docker/backend.dockerfile .
          
          docker buildx build \
            --platform linux/amd64,linux/arm64 \
            --push \
            -t ghcr.io/happy-patterns-org/nexus-console-frontend:latest \
            -f docker/frontend.dockerfile .
```

## Testing Strategy

### 1. Backend Testing
```python
# backend/tests/test_shared_config.py
import pytest
from shared_config import Config

def test_shared_config_import():
    """Test that shared-config imports work"""
    config = Config()
    assert config.nexus_port == 8000

@pytest.mark.asyncio
async def test_websocket_with_observatory_types():
    """Test WebSocket with observatory types"""
    from observatory_types import MetricEvent
    from src.websocket.manager import ConnectionManager
    
    manager = ConnectionManager()
    metric = MetricEvent(name="test", value=42)
    # Test broadcast doesn't raise
    await manager.broadcast_metric(metric)
```

### 2. Frontend Testing
```typescript
// frontend/src/__tests__/shared-config.test.ts
import { Config } from '@happy-patterns-org/shared-config-ts';

describe('Shared Config Integration', () => {
  it('should load configuration', () => {
    const config = new Config();
    expect(config.nexusWebSocketUrl).toBeDefined();
  });
});
```

### 3. End-to-End Testing
```bash
# scripts/test-e2e.sh
#!/bin/bash
echo "🧪 Running E2E tests..."

# Start backend
cd backend && uv run uvicorn src.main:app &
BACKEND_PID=$!

# Start frontend
cd ../frontend && npm run preview &
FRONTEND_PID=$!

# Wait for services
sleep 5

# Run E2E tests
npm run test:e2e

# Cleanup
kill $BACKEND_PID $FRONTEND_PID
```

## Rollback Plan

### Quick Rollback (< 30 minutes)
```bash
# Restore Poetry files
cd backend
mv pyproject.toml.poetry-backup pyproject.toml
mv poetry.lock.backup poetry.lock
rm -rf .venv
poetry install

# Revert Git changes
git checkout main
git branch -D chore/migrate-to-uv-nexus
```

### Production Rollback
1. Revert Docker images to previous tags
2. Restore Poetry-based CI/CD
3. Notify team of rollback
4. Debug UV issues offline

## Verification Checklist

- [ ] Backend starts with `uv run uvicorn`
- [ ] Frontend builds successfully
- [ ] WebSocket connections work
- [ ] Shared-config imports resolve
- [ ] Docker images build
- [ ] CI/CD pipeline green
- [ ] E2E tests pass
- [ ] Performance improved (measure startup time)

## Common Issues & Solutions

### Issue: Cannot find shared-config package
```bash
# Ensure GitHub Packages authentication
export UV_EXTRA_INDEX_URL="https://${GITHUB_TOKEN}@pypi.pkg.github.com/happy-patterns-org"

# Or add to ~/.netrc
```

### Issue: Frontend cannot resolve @happy-patterns-org packages
```bash
# Ensure .npmrc has correct token
echo "@happy-patterns-org:registry=https://npm.pkg.github.com" > frontend/.npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> frontend/.npmrc
```

### Issue: Docker build fails
```dockerfile
# Add GitHub token as build arg
ARG GITHUB_TOKEN
ENV UV_EXTRA_INDEX_URL="https://${GITHUB_TOKEN}@pypi.pkg.github.com/happy-patterns-org"
```

## Performance Metrics

Track these metrics before/after migration:

1. **Backend startup time**
   - Poetry: ~45 seconds
   - UV: ~3 seconds (target)

2. **CI/CD pipeline duration**
   - Poetry: ~8 minutes
   - UV: ~2 minutes (target)

3. **Docker image build time**
   - Poetry: ~5 minutes
   - UV: ~1 minute (target)

4. **Developer install time**
   - Poetry: ~2 minutes
   - UV: ~10 seconds (target)

## Next Steps

After successful migration:
1. Update developer documentation
2. Train team on UV commands
3. Monitor for issues for 48 hours
4. Begin happy-observatory migration
5. Update deployment documentation
