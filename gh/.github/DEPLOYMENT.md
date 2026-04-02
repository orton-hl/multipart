# Deployment Guide - Hostinger via GitHub Actions

This guide explains how to set up automated deployment to Hostinger using GitHub Actions.

## Prerequisites

1. **Docker installed on Hostinger server**
2. **SSH access to Hostinger server**
3. **Docker Hub account** (docker.io/orton-hl)

## Required GitHub Secrets

Navigate to your repository: **Settings → Secrets and variables → Actions → New repository secret**

Add the following secrets:

### Docker Registry Secrets
| Secret Name | Description | Example |
|------------|-------------|---------|
| `DOCKER_USERNAME` | Docker Hub username | `orton-hl` |
| `DOCKER_PASSWORD` | Docker Hub password or access token | `dckr_pat_xxxxx` |

### Hostinger SSH Secrets
| Secret Name | Description | Example |
|------------|-------------|---------|
| `HOSTINGER_SSH_HOST` | Hostinger server IP or hostname | `123.45.67.89` or `vps.hostinger.com` |
| `HOSTINGER_SSH_USER` | SSH username | `root` or `ubuntu` |
| `HOSTINGER_SSH_KEY` | SSH private key | Contents of your `~/.ssh/id_rsa` |
| `HOSTINGER_SSH_PORT` | SSH port (optional, defaults to 22) | `22` |

### Application Environment Secrets (Optional)
| Secret Name | Description | Example |
|------------|-------------|---------|
| `API_BASE_URL` | Backend API URL | `https://api.yourdomain.com` |
| `AUTH_URL` | Authentication service URL | `https://auth.yourdomain.com` |
| `STORAGE_URL` | Storage service URL | `https://storage.yourdomain.com` |
| `CDN_URL` | CDN URL | `https://cdn.yourdomain.com` |

## Setting up SSH Access

### 1. Generate SSH Key Pair (if you don't have one)

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions"
```

This creates:
- Private key: `~/.ssh/id_rsa`
- Public key: `~/.ssh/id_rsa.pub`

### 2. Add Public Key to Hostinger Server

```bash
# Copy public key to Hostinger
ssh-copy-id -i ~/.ssh/id_rsa.pub user@your-hostinger-server

# Or manually:
cat ~/.ssh/id_rsa.pub | ssh user@your-hostinger-server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3. Add Private Key to GitHub Secrets

```bash
# Display private key
cat ~/.ssh/id_rsa
```

Copy the entire output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) and add it as the `HOSTINGER_SSH_KEY` secret in GitHub.

## Setting up Docker on Hostinger

If Docker is not installed on your Hostinger server:

```bash
# SSH into your Hostinger server
ssh user@your-hostinger-server

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
```

## Workflow Triggers

The deployment workflow runs automatically when:

1. **Push to main branch**: Any commit pushed to `main` triggers deployment
2. **Manual trigger**: Go to **Actions → Deploy to Hostinger → Run workflow**

## Configuration

### Change Deployment Branch

Edit [`.github/workflows/deploy.yml`](workflows/deploy.yml):

```yaml
on:
  push:
    branches:
      - main  # Change to your preferred branch
```

### Change Port Mapping

Edit the `env` section in [`.github/workflows/deploy.yml`](workflows/deploy.yml):

```yaml
env:
  HOST_PORT: 8080  # Change to your desired host port
  CONTAINER_PORT: 80
```

### Customize Environment Variables

The workflow passes environment variables to the container. Add more in the deploy step:

```yaml
docker run -d \
  -e CUSTOM_VAR="${{ secrets.CUSTOM_VAR }}" \
  ...
```

## Deployment Flow

```
┌─────────────────┐
│  Push to main   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Read .version   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Docker    │
│ Image           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Push to         │
│ Docker Hub      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SSH to          │
│ Hostinger       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pull latest     │
│ image           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Restart         │
│ container       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cleanup old     │
│ images          │
└─────────────────┘
```

## Version Management

The workflow reads version from `.version` file in the repository root. To manage versions:

### Local Development (Using Makefile)

```bash
# Bump patch version (1.0.0 → 1.0.1)
make bump-patch

# Bump minor version (1.0.0 → 1.1.0)
make bump-minor

# Bump major version (1.0.0 → 2.0.0)
make bump-major

# Commit and push
git add .version
git commit -m "Bump version to $(cat .version)"
git push origin main
```

### Manual Version Update

```bash
# Edit .version file
echo "1.2.3" > .version

# Commit and push
git add .version
git commit -m "Release version 1.2.3"
git push origin main
```

## Monitoring Deployment

### View Workflow Status

1. Go to **Actions** tab in GitHub
2. Click on the latest workflow run
3. Monitor each step's progress

### Check Application on Server

```bash
# SSH into Hostinger
ssh user@your-hostinger-server

# Check running containers
docker ps

# View logs
docker logs fin-man-ui-container

# Follow logs in real-time
docker logs -f fin-man-ui-container
```

### Access Application

After successful deployment, access your app at:
```
http://your-hostinger-server:8080
```

## Troubleshooting

### Deployment Fails at SSH Step

**Issue**: Cannot connect to Hostinger server

**Solutions**:
- Verify `HOSTINGER_SSH_HOST`, `HOSTINGER_SSH_USER`, and `HOSTINGER_SSH_KEY` secrets
- Check if SSH port is correct (default: 22)
- Ensure public key is in `~/.ssh/authorized_keys` on server
- Test SSH connection locally: `ssh user@your-hostinger-server`

### Docker Pull Fails

**Issue**: Cannot pull image from registry

**Solutions**:
- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets
- Check if image was pushed successfully in previous step
- Manually login on server: `docker login docker.io`

### Container Won't Start

**Issue**: Container stops immediately after starting

**Solutions**:
- Check logs: `docker logs fin-man-ui-container`
- Verify environment variables are set correctly
- Check if port 8080 is already in use: `sudo netstat -tulpn | grep 8080`
- Try running container manually to debug

### Port Already in Use

**Issue**: Port 8080 is already occupied

**Solutions**:
```bash
# Find process using port 8080
sudo lsof -i :8080

# Kill the process or change HOST_PORT in workflow
```

## Manual Deployment (Fallback)

If GitHub Actions fails, deploy manually using the Makefile:

```bash
# On your local machine
make deploy

# Then SSH to Hostinger and pull
ssh user@your-hostinger-server
docker pull docker.io/orton-hl/fin-man-ui:latest
docker stop fin-man-ui-container
docker rm fin-man-ui-container
docker run -d --name fin-man-ui-container -p 8080:80 --restart unless-stopped docker.io/orton-hl/fin-man-ui:latest
```

## Security Best Practices

1. **Use Docker Hub Access Tokens** instead of passwords for `DOCKER_PASSWORD`
2. **Rotate SSH keys** regularly
3. **Use environment-specific secrets** for staging vs production
4. **Enable branch protection** on main branch
5. **Review workflow logs** after each deployment
6. **Set up monitoring** and alerts for your application

## Next Steps

1. Set up a custom domain with reverse proxy (nginx)
2. Enable HTTPS with Let's Encrypt
3. Configure log aggregation
4. Set up health checks and monitoring
5. Implement blue-green deployment strategy
