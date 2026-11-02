# 智策棋鋒 Chess Trivia RPG

西洋棋 × 國小題庫 × 3D RPG 對決。單檔 HTML（Three.js 已內嵌，不連外部網路）。

## 直接遊玩 / 部署
根目錄的 `index.html` 就是完整遊戲，任何靜態伺服器都能跑：

    python3 -m http.server 8080 --bind 0.0.0.0

瀏覽 `http://<主機 IP>:8080`。

## Mac mini 開機自動啟動
1. 把 repo 放在 `~/apps/chess-trivia`
2. 編輯 `deploy/com.chesstrivia.web.plist`，把 `YOURNAME` 換成你的 macOS 使用者名稱
3. 執行：

        cp deploy/com.chesstrivia.web.plist ~/Library/LaunchAgents/
        launchctl load ~/Library/LaunchAgents/com.chesstrivia.web.plist

更新：`git pull` 即可（靜態檔，不用重啟）。

## 開發
    npm install
    node build.mjs        # 產生 dist/chess-trivia-rpg-3d.html
    cp dist/chess-trivia-rpg-3d.html index.html

## 高清雕像棋子
`art/src/` 是六張雕像原圖。重新產生內嵌圖檔：

    pip install "rembg[cpu]" pillow
    cd art && python3 cut.py && python3 pack.py   # 產生 src/art.js
    cd .. && node build.mjs

遊戲內工具列「棋子」可切換「高清雕像／3D 模型」。

## 多角度立牌（目前：皇后）
把同一尊雕像的 0°/45°/90°/135°/180° 五張綠幕圖放進 `art/views/<棋種>/`（檔名 `0.jpg`…`180.jpg`），然後：

    cd art && python3 cutviews.py Q && python3 packviews.py Q   # 去背、對齊底座、輸出 src/views.js
    cd .. && node build.mjs

遊戲會依鏡頭與棋子朝向的夾角自動切換圖片，另一側用鏡像。
