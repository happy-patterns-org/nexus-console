#!/bin/bash
# Migration script to align nexus-console with shared-config

echo "Starting migration to align with @happy-devkit/shared-config..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to update port references
update_ports() {
    echo -e "${YELLOW}Updating port configurations...${NC}"
    
    # Update vite.config.ts
    if [ -f "vite.config.ts" ]; then
        sed -i.bak 's/localhost:8000/localhost:3001/g' vite.config.ts
        echo -e "${GREEN}✓ Updated vite.config.ts${NC}"
    fi
    
    # Update documentation
    find docs -name "*.md" -type f -exec sed -i.bak 's/localhost:8000/localhost:3001/g' {} \;
    find docs -name "*.md" -type f -exec sed -i.bak 's/localhost:3001\/api\/bridge/localhost:8080\/api/g' {} \;
    echo -e "${GREEN}✓ Updated documentation files${NC}"
    
    # Update example files
    find examples -name "*.ts" -o -name "*.tsx" -type f -exec sed -i.bak 's/localhost:8000/localhost:3001/g' {} \;
    echo -e "${GREEN}✓ Updated example files${NC}"
}

# Function to update environment variables
update_env_vars() {
    echo -e "${YELLOW}Updating environment variables...${NC}"
    
    # Create new .env.example aligned with shared-config
    cat > .env.shared-config <<EOF
# Nexus Console Environment Configuration
# Aligned with @happy-devkit/shared-config

# Console Configuration
CONSOLE_HOST=localhost
CONSOLE_PORT=3001

# Bridge Configuration
BRIDGE_HOST=localhost
BRIDGE_PORT=8080

# Terminal Server Configuration (if separate from console)
TERMINAL_SERVER_HOST=localhost
TERMINAL_SERVER_PORT=3001

# Feature Flags
CONSOLE_PTY_ENABLED=true
CONSOLE_AGENT_MANAGEMENT=true

# Node Environment
NODE_ENV=development
EOF
    
    echo -e "${GREEN}✓ Created .env.shared-config${NC}"
}

# Function to create import mapping file
create_import_mappings() {
    echo -e "${YELLOW}Creating import mappings...${NC}"
    
    cat > docs/IMPORT-MAPPINGS.md <<EOF
# Import Mappings for Shared Configuration

## Replace These Imports

### BridgeClient.ts / BridgeClientEnhanced.ts
\`\`\`typescript
// Old
const bridgeUrl = 'http://localhost:3001/api/bridge';

// New
import { getBridgeAPIUrl } from '@happy-devkit/shared-config';
const bridgeUrl = getBridgeAPIUrl('/health');
\`\`\`

### TerminalWebSocket.ts / TerminalWebSocketConfigured.ts
\`\`\`typescript
// Old
const wsUrl = 'ws://localhost:8000/terminal/ws';

// New
import { getConsolePTYUrl } from '@happy-devkit/shared-config';
const wsUrl = getConsolePTYUrl(sessionId);
\`\`\`

### Type Imports
\`\`\`typescript
// Old
interface PTYMessage { ... }
interface TerminalSession { ... }

// New
import type { 
  PTYMessage, 
  TerminalSession,
  AgentCommand,
  AgentHealthData 
} from '@happy-devkit/shared-config';
\`\`\`

## Environment Variables

| Old Variable | New Variable | Default Value |
|-------------|--------------|---------------|
| VITE_CONSOLE_WS_TARGET | CONSOLE_HOST + CONSOLE_PORT | localhost:3001 |
| VITE_CONSOLE_API_TARGET | CONSOLE_HOST + CONSOLE_PORT | localhost:3001 |
| BRIDGE_HOST + ':3001' | BRIDGE_HOST + ':' + BRIDGE_PORT | localhost:8080 |
EOF
    
    echo -e "${GREEN}✓ Created import mappings documentation${NC}"
}

# Function to check for issues
check_issues() {
    echo -e "${YELLOW}Checking for remaining issues...${NC}"
    
    # Check for old port references
    echo "Checking for old port 8000 references:"
    grep -r "8000" --include="*.ts" --include="*.tsx" src/ || echo -e "${GREEN}✓ No port 8000 references found${NC}"
    
    echo "Checking for old bridge port 3001 references:"
    grep -r "3001.*bridge" --include="*.ts" --include="*.tsx" src/ || echo -e "${GREEN}✓ No bridge port 3001 references found${NC}"
    
    # Check for hardcoded URLs
    echo "Checking for hardcoded localhost URLs:"
    grep -r "localhost:[0-9]" --include="*.ts" --include="*.tsx" src/ || echo -e "${GREEN}✓ No hardcoded URLs found${NC}"
}

# Main execution
echo "This script will help migrate nexus-console to use shared-config"
echo "It will:"
echo "1. Update port references (8000 -> 3001 for console, 3001 -> 8080 for bridge)"
echo "2. Create aligned environment variable files"
echo "3. Create import mapping documentation"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Backup current state
    echo -e "${YELLOW}Creating backup...${NC}"
    tar -czf nexus-console-backup-$(date +%Y%m%d-%H%M%S).tar.gz --exclude=node_modules --exclude=dist .
    echo -e "${GREEN}✓ Backup created${NC}"
    
    # Run migrations
    update_ports
    update_env_vars
    create_import_mappings
    
    # Check for issues
    check_issues
    
    echo -e "${GREEN}Migration preparation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes made by this script"
    echo "2. Link the shared-config package:"
    echo "   cd ../happy-devkit/packages/shared-config && npm link"
    echo "   cd - && npm link @happy-devkit/shared-config"
    echo "3. Update imports according to docs/IMPORT-MAPPINGS.md"
    echo "4. Test the application with new configuration"
    echo ""
    echo -e "${YELLOW}Note: This script prepared the migration but manual code updates are still required${NC}"
else
    echo "Migration cancelled"
fi