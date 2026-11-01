import base64, io, json
from PIL import Image
H = 720
lines = ['// 由 art/pack.py 產生：六種棋子高清雕像（去背 WebP，內嵌）', 'export const ART = {']
meta = {}
for t in 'PNBRQK':
    im = Image.open(f'out/{t}_full.png')
    w = round(im.width * H / im.height)
    im = im.resize((w, H), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=86, method=6); d = b.getvalue()
    print(t, im.size, len(d) // 1024, 'KB')
    lines.append(f"  {t}: {{ w: {w}, h: {H}, src: 'data:image/webp;base64,{base64.b64encode(d).decode()}' }},")
lines.append('};')
open('../src/art.js', 'w').write('\n'.join(lines) + '\n')
