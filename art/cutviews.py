# 多角度立牌：去背 → 以底座寬度與中心對齊 → 輸出統一畫布
import sys, os, numpy as np
from rembg import remove, new_session
from PIL import Image
type_ = sys.argv[1] if len(sys.argv) > 1 else 'Q'
ANG = [0, 45, 90, 135, 180]
CW, CH, PED, BASE_Y = 720, 780, 380, 752   # 畫布、底座寬度、底座底緣 y
sess = new_session('isnet-general-use')
os.makedirs(f'views/{type_}/out', exist_ok=True)
for a in ANG:
    im = Image.open(f'views/{type_}/{a}.jpg').convert('RGB')
    out = remove(im, session=sess, post_process_mask=True)
    al = np.array(out.getchannel('A'))
    # 去綠邊：邊緣半透明像素若偏綠，壓低綠色
    rgb = np.array(out).astype(np.int32)
    # 全域去綠溢色：綠不得超過紅藍較大者（金、粉紅、大理石不受影響；騎士綠符文請加 --keepgreen）
    if '--keepgreen' not in sys.argv:
        rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]))
        yg = (rgb[..., 1] >= 0.86 * rgb[..., 0]) & (rgb[..., 2] <= 0.78 * rgb[..., 1]) & (rgb[..., 1] > 60)  # 黃綠（背景綠混火焰）
        rgb[..., 1] = np.where(yg, rgb[..., 2], rgb[..., 1])
        semi = al < 235   # 半透明（火焰、發光邊緣）混到背景綠：綠壓到紅藍最小值以下
        rgb[..., 1] = np.where(semi, np.minimum(rgb[..., 1], np.minimum(rgb[..., 0], rgb[..., 2])), rgb[..., 1])
    out = Image.fromarray(np.dstack([np.clip(rgb[..., :3], 0, 255), al]).astype(np.uint8), 'RGBA')
    ys, xs = np.where(al > 40)
    y1 = ys.max(); y0 = ys.min(); H = y1 - y0
    # 底座區：最低 18% 內最寬的一列
    best = (0, 0, 0)
    for y in range(int(y1 - 0.18 * H), y1 + 1):
        r = np.where(al[y] > 40)[0]
        if len(r) and r.max() - r.min() > best[0]: best = (r.max() - r.min(), r.min(), r.max())
    pw, xa, xb = best; cx = (xa + xb) / 2
    s = PED / pw
    scaled = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    ox = round(CW / 2 - cx * s); oy = round(BASE_Y - y1 * s)
    canvas.alpha_composite(scaled, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy))) if (ox < 0 or oy < 0) else canvas.paste(scaled, (ox, oy), scaled)
    canvas.save(f'views/{type_}/out/{a}.png')
    print(type_, a, 'ped', pw, 'scale', round(s, 3), 'offset', ox, oy, 'tight', al[:, :].max())
