#!/bin/bash
# PredictionScope Setup Script
# Run this once to initialize the project.

set -e

echo "═══════════════════════════════════════"
echo "  PredictionScope Setup"
echo "═══════════════════════════════════════"

# Check prerequisites
echo ""
echo "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git required"; exit 1; }

echo "✅ Python $(python3 --version | cut -d' ' -f2)"
echo "✅ Node $(node --version)"
echo "✅ Git $(git --version | cut -d' ' -f3)"

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt --quiet

# Install Node dependencies
echo ""
echo "Installing Node dependencies..."
cd site && npm install && cd ..

# Create directories
echo ""
echo "Creating directory structure..."
mkdir -p logs/runs
mkdir -p data/market-snapshots
mkdir -p data/performance
mkdir -p content/{learn,markets,best}

# Environment setup
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file — please fill in your API keys"
else
    echo "✅ .env file already exists"
fi

# Git setup
if [ ! -d .git ]; then
    git init
    echo "📁 Initialized git repository"
fi

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.next/
out/
logs/
data/market-snapshots/
data/performance/
__pycache__/
*.pyc
.vercel/
EOF

echo ""
echo "═══════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Fill in your API keys in .env"
echo "  2. Run a dry test: python agent/core.py --dry-run"
echo "  3. Review generated content in content/"
echo "  4. When ready, run without --dry-run to create PRs"
echo ""
