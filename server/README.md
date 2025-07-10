# Nexus Console Server (Future Python Component)

This directory is reserved for a future Python server component. Currently, Nexus Console is implemented entirely in TypeScript/JavaScript.

## 🚀 Quick Start with UV

This server now uses UV for fast, reliable Python dependency management.

### Prerequisites
- Python 3.11+
- UV installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Setup

```bash
# First time setup
cd server
uv sync

# Or use npm from project root
npm run server:setup
```

### Running the Server

```bash
# Development mode (with auto-reload)
npm run server:dev

# Production mode
npm run server:prod

# Or directly with UV
cd server
uv run uvicorn main:app --reload --port 3001
```

## 📦 Dependencies

Dependencies are managed in `pyproject.toml`:
- **Production**: FastAPI, uvicorn, websockets, pydantic, etc.
- **Development**: pytest, black, ruff, mypy

## 🧪 Testing

```bash
cd server
uv run pytest
uv run mypy .
uv run ruff check .
```

## 🔄 Migration from pip/requirements.txt

If you're migrating from the old setup:

```bash
cd server
./migrate-to-uv.sh
```

This will:
1. Back up your existing requirements files
2. Create a UV-managed virtual environment
3. Install all dependencies via UV

## 🐳 Docker Support

For Docker builds, use:

```dockerfile
FROM python:3.11-slim
RUN pip install uv
WORKDIR /app
COPY pyproject.toml .
RUN uv sync --frozen --no-dev
COPY . .
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
```

## 🛠️ Development

### Adding Dependencies

```bash
# Add a production dependency
uv add fastapi

# Add a dev dependency
uv add --dev pytest

# Update all dependencies
uv sync --upgrade
```

### Environment Variables

Create a `.env` file in the server directory:

```env
CONSOLE_HOST=localhost
CONSOLE_PORT=3001
JWT_SECRET=your-secret-key
```

## 📚 API Documentation

Once running, visit:
- API docs: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc

## 🚨 Troubleshooting

### UV not found
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# Then restart your terminal or run:
source ~/.cargo/env
```

### Port already in use
```bash
# Find and kill the process using port 3001
lsof -ti:3001 | xargs kill -9
```

### Module not found errors
```bash
# Ensure you're using UV to run the server
cd server
uv sync  # Reinstall dependencies
uv run uvicorn main:app --reload
```