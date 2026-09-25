# Shader lab baselines (ENG-0070)

Reference captures of `?shaderlab` (QA/dev builds): every organ kind × every people, frozen time.

| File | URL |
|---|---|
| `grid-light-a.png` | `?shaderlab&frozen&light=0.2` |
| `grid-light-b.png` | `?shaderlab&frozen&light=0.6` (light from the opposite side) |
| `zoom-human-flesh.png` | `?shaderlab&frozen&light=0.2&zoom` (2.5×) |

Regenerate after a flesh-shader change and review the diff:
`npm run build:qa -- --outDir dist && node scripts/shoot.mjs docs/art/shaderlab "url:shaderlab&frozen&light=0.2"` …
Captured in SwiftShader at 1280×720.
