#!/bin/bash

# SiteWard Quick Start Script
# This script helps you get SiteWard up and running in minutes

set -e

echo "🚀 SiteWard - AI Website Maintenance System"
echo "==========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "📦 Installing backend dependencies..."
cd siteward-backend
npm install
cd ..

echo ""
echo "📦 Installing frontend dependencies..."
cd siteward-frontend
npm install
cd ..

# Setup environment files
echo ""
echo "🔧 Setting up environment files..."

if [ ! -f siteward-backend/.env ]; then
    cp siteward-backend/.env.example siteward-backend/.env
    echo "✅ Created siteward-backend/.env"
    echo "⚠️  Please update siteward-backend/.env with your API keys"
else
    echo "✅ siteward-backend/.env already exists"
fi

if [ ! -f siteward-frontend/.env.local ]; then
    cp siteward-frontend/.env.example siteward-frontend/.env.local
    echo "✅ Created siteward-frontend/.env.local"
    echo "⚠️  Please update siteward-frontend/.env.local with your API keys"
else
    echo "✅ siteward-frontend/.env.local already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your environment variables in:"
echo "   - siteward-backend/.env"
echo "   - siteward-frontend/.env.local"
echo ""
echo "2. Set up your Supabase database schema"
echo "   (Run the SQL from README.md in your Supabase editor)"
echo ""
echo "3. Start the development servers:"
echo "   - Backend: cd siteward-backend && npm run dev"
echo "   - Frontend: cd siteward-frontend && npm run dev"
echo ""
echo "4. Open http://localhost:5173 in your browser"
echo ""
echo "Happy coding! 🚀"
