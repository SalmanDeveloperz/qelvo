# Qelvo brand kit

The mark is a Q whose tail is a flat baseline rule: the line every resume sits on. The ring takes the text colour and the rule takes the accent, so it works on any background and in every app theme.

| File | Use it for |
|---|---|
| `qelvo-avatar-800.png` | GitHub org avatar, LinkedIn page logo, any square profile picture |
| `qelvo-icon-dark-1024.png`, `qelvo-icon-light-1024.png` | App icons, rounded tiles |
| `qelvo-logo-dark.*`, `qelvo-logo-light.*` | Mark plus wordmark, on dark or light backgrounds |
| `qelvo-mark-dark.svg`, `qelvo-mark-light.svg` | The mark alone, transparent background |
| `qelvo-linkedin-banner.png` | LinkedIn cover image (1584 x 396) |
| `qelvo-github-social.png` | GitHub social preview (1280 x 640) |
| `qelvo-og.svg` | Source of `public/og.png`, the link preview image |

Colours: ink `#121419`, paper `#F6F2EA`, amber `#FFB547` (deep amber `#E08A00` on light backgrounds). The wordmark is Poppins SemiBold, converted to outlines.

Everything here is generated. Change `scripts/brand.ts`, then run:

```bash
npx tsx scripts/brand.ts && python scripts/brand_png.py
```

Please don't stretch, recolour or redraw the mark, and use your own name and logo if you run a fork as a public service.
