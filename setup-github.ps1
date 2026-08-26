# ============================================================
# 《议会博弈》GitHub 一键建仓脚本
# 在沙箱外运行：右键 → "用 PowerShell 运行"
# 或在终端执行：powershell -ExecutionPolicy Bypass -File setup-github.ps1
# ============================================================

param(
    [string]$RepoName = "parliament-game",
    [string]$Description = "《议会博弈》— 博弈论策略多人在线谈判游戏",
    [switch]$Private = $false
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor DarkYellow
Write-Host "  《议会博弈》GitHub 建仓脚本" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor DarkYellow

# ---- 1. 检查 git ----
Write-Host "[1/6] 检查 git..." -ForegroundColor Cyan
$gitInstalled = $false
try {
    $gitVersion = git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  git 已安装: $gitVersion" -ForegroundColor Green
        $gitInstalled = $true
    }
} catch {}

if (-not $gitInstalled) {
    Write-Host "  git 未安装，正在通过 winget 安装..." -ForegroundColor Yellow
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    try {
        $gitVersion = git --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  git 安装成功: $gitVersion" -ForegroundColor Green
            $gitInstalled = $true
        }
    } catch {
        Write-Host "  git 安装失败，请手动安装: https://git-scm.com/download/win" -ForegroundColor Red
        exit 1
    }
}

# ---- 2. 检查 gh CLI ----
Write-Host "[2/6] 检查 GitHub CLI (gh)..." -ForegroundColor Cyan
$ghInstalled = $false
try {
    $ghVersion = gh --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  gh 已安装: $($ghVersion.Split("`n")[0])" -ForegroundColor Green
        $ghInstalled = $true
    }
} catch {}

if (-not $ghInstalled) {
    Write-Host "  gh 未安装，正在通过 winget 安装..." -ForegroundColor Yellow
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    try {
        $ghVersion = gh --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  gh 安装成功" -ForegroundColor Green
            $ghInstalled = $true
        }
    } catch {
        Write-Host "  gh 安装失败，请手动安装: https://cli.github.com/" -ForegroundColor Red
    }
}

# ---- 3. 初始化 git 仓库 ----
Write-Host "[3/6] 初始化 git 仓库..." -ForegroundColor Cyan
Set-Location $projectDir

if (Test-Path ".git") {
    Write-Host "  git 仓库已存在，跳过初始化" -ForegroundColor Yellow
} else {
    git init
    # 配置 git 用户（如未设置）
    $userName = git config user.name 2>&1
    if (-not $userName) {
        git config user.name "parliament-game-dev"
        git config user.email "dev@parliament-game.local"
        Write-Host "  已设置默认 git 用户信息" -ForegroundColor Yellow
    }
    Write-Host "  git 仓库已初始化" -ForegroundColor Green
}

# ---- 4. 提交代码 ----
Write-Host "[4/6] 暂存并提交代码..." -ForegroundColor Cyan
git add -A
$status = git status --porcelain 2>&1
if (-not $status) {
    Write-Host "  没有需要提交的变更" -ForegroundColor Yellow
} else {
    $commitMsg = @"
v0 骨架：三层分离架构搭建完成

- shared: 共享类型与常量（RoomState/Player/Bill/Promise/Vote + Socket 事件契约）
- server: Express + Socket.IO + SQLite + JWT + 房间状态机 + AI NPC
- client: Vue 3 + Vite + Pinia + Element Plus + Phaser 3 议会桌场景
- 设计 tokens: 暗黑权谋风（墨黑/暗金/衬线）
- 联调验证: 3 轮完整循环跑通，阶段流转/AI 填位/投票结算/终局排名均正常
"@
    git commit -m $commitMsg
    Write-Host "  代码已提交" -ForegroundColor Green
}

# ---- 5. 创建 GitHub 仓库 ----
Write-Host "[5/6] 创建 GitHub 仓库..." -ForegroundColor Cyan

$repoExists = $false
if ($ghInstalled) {
    # 检查 gh 是否已认证
    $authStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  gh 未认证，正在启动浏览器登录..." -ForegroundColor Yellow
        gh auth login --web --git-protocol https
    }

    # 创建仓库
    $visibilityFlag = if ($Private) { "--private" } else { "--public" }
    $createResult = gh repo create $RepoName $visibilityFlag --description $Description --source=. --remote=origin --push 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  GitHub 仓库已创建并推送" -ForegroundColor Green
        $repoUrl = gh repo view --json url -q .url 2>&1
        Write-Host "  仓库地址: $repoUrl" -ForegroundColor Cyan
        $repoExists = $true
    } else {
        Write-Host "  gh 创建仓库失败: $createResult" -ForegroundColor Yellow
        Write-Host "  可能仓库已存在，尝试添加远程..." -ForegroundColor Yellow
    }
}

if (-not $repoExists) {
    Write-Host "`n  gh 不可用或创建失败，请手动操作：" -ForegroundColor Yellow
    Write-Host "  1. 打开 https://github.com/new" -ForegroundColor White
    Write-Host "  2. 仓库名填: $RepoName" -ForegroundColor White
    Write-Host "  3. 描述填: $Description" -ForegroundColor White
    Write-Host "  4. 不要勾选 'Add a README'（已有代码）" -ForegroundColor White
    Write-Host "  5. 创建后复制仓库 URL" -ForegroundColor White
    Write-Host "`n  然后运行以下命令推送：" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/<你的用户名>/$RepoName.git" -ForegroundColor White
    Write-Host "  git branch -M main" -ForegroundColor White
    Write-Host "  git push -u origin main`n" -ForegroundColor White

    $remoteUrl = Read-Host "请输入你的 GitHub 仓库 URL（或按回车跳过）"
    if ($remoteUrl) {
        git remote remove origin 2>$null
        git remote add origin $remoteUrl
        git branch -M main
        git push -u origin main
        Write-Host "  代码已推送到 $remoteUrl" -ForegroundColor Green
    }
}

# ---- 6. 完成 ----
Write-Host "[6/6] 完成！" -ForegroundColor Green
Write-Host "`n========================================" -ForegroundColor DarkYellow
Write-Host "  《议会博弈》已推送到 GitHub" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor DarkYellow

if ($ghInstalled) {
    $finalUrl = gh repo view --json url -q .url 2>&1
    if ($finalUrl) {
        Write-Host "  仓库地址: $finalUrl`n" -ForegroundColor Cyan
    }
}
