import sys
from rembg import remove, new_session
from PIL import Image
sess = new_session('isnet-general-use')
for t in 'PNBRQK':
    im = Image.open(f'src/{t}.jpg').convert('RGB')
    out = remove(im, session=sess, post_process_mask=True)
    bb = out.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
    out = out.crop(bb)
    out.save(f'out/{t}_full.png')
    print(t, bb, out.size)
