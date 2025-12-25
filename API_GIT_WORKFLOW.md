# API Git Workflow Guide

## Repository Configuration

Your API folder is now connected to: **https://github.com/matti7866/api.git**

### Current Setup
- **Branch**: `main`
- **Remote**: `origin` → `matti7866/api`
- **Tracking**: Local `main` tracks `origin/main`
- **Location**: `/Applications/XAMPP/xamppfiles/htdocs/snt/api/` (separate repo)

## Daily Workflow for API Updates

### 1. Making Changes
Edit your API files as needed in `/Applications/XAMPP/xamppfiles/htdocs/snt/api/`

### 2. Check Status
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/snt/api
git status
```
This shows which files have been modified.

### 3. Stage Your Changes
```bash
# Stage all changes
git add .

# Or stage specific files
git add path/to/file.php
```

### 4. Commit Your Changes
```bash
git commit -m "Brief description of your changes"
```

**Example commit messages:**
- `git commit -m "Fix authentication bug in login.php"`
- `git commit -m "Add new residence endpoints"`
- `git commit -m "Update CORS headers configuration"`

### 5. Push to GitHub
```bash
git push
```

### 6. Pull Latest Changes
If you made changes on your online server and pushed to GitHub:
```bash
git pull
```

## Quick Command Reference

| Action | Command |
|--------|---------|
| Check status | `git status` |
| Stage all changes | `git add .` |
| Commit changes | `git commit -m "message"` |
| Push to GitHub | `git push` |
| Pull from GitHub | `git pull` |
| View commit history | `git log --oneline` |

## Common Scenarios

### Update API Locally and Push
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/snt/api
# Make your changes
git add .
git commit -m "Your changes description"
git push
```

### Get Changes from Online Server
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/snt/api
git pull
```

---
**Last Updated**: November 25, 2025
**Repository**: matti7866/api
**Branch**: main
