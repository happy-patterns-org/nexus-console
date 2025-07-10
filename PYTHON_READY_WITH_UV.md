# Python-Ready with UV

## Overview

Nexus Console is primarily a TypeScript/JavaScript project, consistent with happy-observatory and the broader Happy ecosystem. However, we maintain UV configuration for potential future Python components.

## Current State

- **Primary Implementation**: TypeScript/JavaScript
- **Python Setup**: UV configuration ready in `/server` directory
- **Status**: No active Python code, but ready for future expansion

## UV Configuration

The `server/` directory contains:
- `pyproject.toml` - UV-compatible Python project configuration
- `requirements.txt` - Legacy dependencies (backup)
- `migrate-to-uv.sh` - Migration script for when Python code is added

## When to Use Python

Consider adding Python components for:
- Machine learning integrations
- Complex data processing pipelines
- Integration with Python-only libraries
- Performance-critical backend services

## Activating Python Development

When you're ready to add Python code:

```bash
cd server
./migrate-to-uv.sh  # Sets up UV environment
uv sync             # Install dependencies
```

Then update the npm scripts in package.json to use the actual Python server.

## Consistency with Happy Ecosystem

- **happy-observatory**: TypeScript-based
- **nexus-console**: TypeScript-based
- **happy-devkit**: Python with UV

This approach maintains architectural consistency while being prepared for future needs.