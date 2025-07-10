#!/bin/bash

echo "🚀 Migrating Nexus Console server to UV..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ UV is not installed. Please install it first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Backup existing files
echo "📦 Backing up existing files..."
cp requirements.txt requirements.txt.backup
cp requirements-dev.txt requirements-dev.txt.backup

# Create virtual environment with UV
echo "🔧 Creating UV environment..."
uv venv

# Sync dependencies
echo "📥 Installing dependencies with UV..."
uv sync

echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Test the server: npm run server:dev"
echo "2. Remove old requirements files after confirming everything works"
echo "3. Update any deployment scripts to use 'uv run' instead of 'python'"