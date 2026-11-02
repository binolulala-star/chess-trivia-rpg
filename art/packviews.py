import base64, io, sys
from PIL import Image
types = sys.argv[1:] or ['Q']
ANG = [0, 45, 90, 135, 180]
lines = ['// 由 art/packviews.py 產生：多角度立牌（去背、對齊底座，畫布 720x780，底座寬 380、底緣 y=752）', 'export const VIEWS = {']
for t in types:
    lines.append(f"  {t}: {{ w: 720, h: 780, ped: 380, base: 752, angles: {ANG}, src: [")
    for a in ANG:
        im = Image.open(f'views/{t}/out/{a}.png')
        b = io.BytesIO(); im.save(b, 'WEBP', quality=84, method=6); d = b.getvalue()
        print(t, a, len(d)//1024, 'KB')
        lines.append(f"    'data:image/webp;base64,{base64.b64encode(d).decode()}',")
    lines.append('  ] },')
lines.append('};')
open('../src/views.js', 'w').write('\n'.join(lines) + '\n')
