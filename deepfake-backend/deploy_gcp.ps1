# ==============================================================================
# Google Cloud Run Deployment Script
# ==============================================================================
# This script deploys the FastAPI backend to Google Cloud Run.
# Google Cloud Build will compile the Docker image, so you do not need Docker
# installed on your local machine.
# ==============================================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting Google Cloud Run Deployment Setup" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate and resolve gcloud PATH automatically on Windows
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue) -and -not (Get-Command gcloud.cmd -ErrorAction SilentlyContinue)) {
    $commonPaths = @(
        "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin",
        "$env:USERPROFILE\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin",
        "$env:LOCALAPPDATA\Google\Cloud SDK",
        "$env:USERPROFILE\AppData\Local\Google\Cloud SDK",
        "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin",
        "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin"
    )

    foreach ($p in $commonPaths) {
        if (Test-Path "$p\gcloud.cmd") {
            $env:PATH += ";$p"
            Write-Host "[INFO] Automatically located Google Cloud CLI at: $p" -ForegroundColor Cyan
            break
        }
        elseif (Test-Path "$p\gcloud") {
            $env:PATH += ";$p"
            Write-Host "[INFO] Automatically located Google Cloud CLI at: $p" -ForegroundColor Cyan
            break
        }
    }
}

# Verify if gcloud is now accessible
$gcloudExists = $false
if (Get-Command gcloud -ErrorAction SilentlyContinue) { $gcloudExists = $true }
elseif (Get-Command gcloud.cmd -ErrorAction SilentlyContinue) { $gcloudExists = $true }
else {
    try {
        $null = & gcloud --version -ErrorAction SilentlyContinue
        $gcloudExists = $true
    } catch {
        $gcloudExists = $false
    }
}

if (-not $gcloudExists) {
    Write-Host "[ERROR] 'gcloud' command-line utility was not found in your current path." -ForegroundColor Red
    Write-Host "Please download and install Google Cloud SDK: https://cloud.google.com/sdk" -ForegroundColor Yellow
    Write-Host "NOTE: If you recently installed the Cloud SDK, you MUST restart your IDE and terminal window to reload Windows environment variables." -ForegroundColor Yellow
    Exit
}

Write-Host "[INFO] Google Cloud SDK is verified." -ForegroundColor Green

# 2. Instruct user on authentication
Write-Host ""
Write-Host "Step 1: Authenticate with Google Cloud" -ForegroundColor Yellow
Write-Host "Run the following command in your terminal if you haven't logged in:" -ForegroundColor Gray
Write-Host "  gcloud auth login" -ForegroundColor White
Write-Host "Press enter after you have verified your login status..." -ForegroundColor Gray
Read-Host

# 3. Instruct user on project configuration
Write-Host ""
Write-Host "Step 2: Configure your Google Cloud Project" -ForegroundColor Yellow
$projectId = Read-Host "Enter your Google Cloud Project ID (e.g. deepfake-scanner-12345)"
if ([string]::IsNullOrEmpty($projectId)) {
    Write-Host "[ERROR] Project ID cannot be empty." -ForegroundColor Red
    Exit
}

Write-Host "Setting active project to '$projectId'..." -ForegroundColor Gray
gcloud config set project $projectId

# 4. Trigger Cloud Run Deployment
Write-Host ""
Write-Host "Step 3: Deploying to Google Cloud Run..." -ForegroundColor Yellow
Write-Host "This will build the Docker container using Cloud Build and deploy it to a serverless instance." -ForegroundColor Gray
Write-Host "Parameters used: Region=us-central1, Memory=2Gi, CPU=2, Scaled to 0 when idle (Min Instances=0)." -ForegroundColor Gray
Write-Host ""

gcloud run deploy deepfake-backend `
    --source . `
    --platform managed `
    --region us-central1 `
    --allow-unauthenticated `
    --memory 2Gi `
    --cpu 2 `
    --min-instances 0 `
    --max-instances 5

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Deployment Process Completed!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "If the deployment was successful, copy the Service URL provided above" -ForegroundColor Yellow
Write-Host "and paste it as 'NEXT_PUBLIC_API_URL' in your frontend .env file." -ForegroundColor Yellow
