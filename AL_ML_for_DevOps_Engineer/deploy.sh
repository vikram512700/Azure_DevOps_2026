#!/bin/bash

# AI/ML DevOps Guide - Quick Deploy Script
# This script helps you deploy to GitHub Pages

echo "🚀 AI/ML DevOps Guide - GitHub Pages Deployment"
echo "================================================"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    echo "   Visit: https://git-scm.com/downloads"
    exit 1
fi

echo "✅ Git is installed"
echo ""

# Get GitHub username
read -p "Enter your GitHub username: " github_username

if [ -z "$github_username" ]; then
    echo "❌ GitHub username cannot be empty"
    exit 1
fi

# Repository name
repo_name="ai-ml-devops-guide"

echo ""
echo "📋 Setup Summary:"
echo "   GitHub Username: $github_username"
echo "   Repository Name: $repo_name"
echo "   Live URL: https://$github_username.github.io/$repo_name/"
echo ""

read -p "Does this look correct? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Setup cancelled"
    exit 0
fi

echo ""
echo "🔧 Setting up Git repository..."

# Initialize git if not already done
if [ ! -d ".git" ]; then
    git init
    echo "✅ Initialized Git repository"
else
    echo "✅ Git repository already initialized"
fi

# Update README with username
sed -i.bak "s/YOUR-USERNAME/$github_username/g" README.md 2>/dev/null || \
    sed -i '' "s/YOUR-USERNAME/$github_username/g" README.md
rm -f README.md.bak
echo "✅ Updated README with your username"

# Add all files
git add .
echo "✅ Added files to Git"

# Commit
git commit -m "Initial commit: Add AI/ML DevOps Guide" 2>/dev/null || echo "✅ Files already committed"

# Rename branch to main
git branch -M main
echo "✅ Renamed branch to main"

# Add remote
git remote add origin "https://github.com/$github_username/$repo_name.git" 2>/dev/null || \
    git remote set-url origin "https://github.com/$github_username/$repo_name.git"
echo "✅ Added remote repository"

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Create the repository on GitHub:"
echo "   - Go to: https://github.com/new"
echo "   - Repository name: $repo_name"
echo "   - Make it PUBLIC (required for free GitHub Pages)"
echo "   - DO NOT initialize with README"
echo "   - Click 'Create repository'"
echo ""
echo "2. After creating the repository, press ENTER to continue..."
read

echo ""
echo "⬆️  Pushing to GitHub..."
if git push -u origin main; then
    echo "✅ Successfully pushed to GitHub!"
else
    echo "⚠️  Push failed. You may need to authenticate."
    echo "   Try running: git push -u origin main"
fi

echo ""
echo "🌐 Enable GitHub Pages:"
echo "   1. Go to: https://github.com/$github_username/$repo_name/settings/pages"
echo "   2. Under 'Source', select: main branch, / (root)"
echo "   3. Click 'Save'"
echo "   4. Wait 2-3 minutes"
echo ""
echo "🎉 Your site will be live at:"
echo "   https://$github_username.github.io/$repo_name/"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "✅ Setup complete!"
