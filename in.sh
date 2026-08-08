#!/bin/bash

# Dừng thực thi nếu có lỗi
set -e

echo "[1/4] Cập nhật danh sách gói hệ thống..."
if command -v apt &> /dev/null; then
    sudo apt update -y
    sudo apt install -y curl build-essential
elif command -v yum &> /dev/null; then
    sudo yum makecache
    sudo yum install -y curl gcc-c++ make
elif command -v dnf &> /dev/null; then
    sudo dnf makecache
    sudo dnf install -y curl gcc-c++ make
else
    echo "Không tìm thấy trình quản lý gói phù hợp (apt/yum/dnf)."
    exit 1
fi

echo "[2/4] Tải và cài đặt NVM (Node Version Manager)..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

echo "[3/4] Cấu hình môi trường NVM..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "[4/4] Tải phiên bản Node.js LTS và NPM mới nhất..."
nvm install --lts
nvm use --lts
nvm alias default lts/*

echo "=========================================="
echo " CÀI ĐẶT HOÀN TẤT!"
echo " Node.js version: $(node -v)"
echo " NPM version:     $(npm -v)"
echo "=========================================="
