# Malison design language (ART-0226)

The eight Malison Hours are one family. Every Hour is built from the same three pieces of anatomy,
wears the shared curse-violet, and adds **one** secondary colour and **one** signature shape of its
own. The side-by-side silhouette sheet is live at `?scene=woundlab&page=7`; the Hour colours are
`HOUR_SECONDARY` (and the flesh-corruption palettes `HOUR_CURSE`) in `src/art/curse.ts`.

## Common anatomy

| Piece | Rule | How it shows |
| --- | --- | --- |
| **Woven-thread body** | Every Malison is cloth, cord or thread worked into a body; loose threads always trail from it. | A fine cross-weave in the body; three violet threads hang beneath every silhouette; shards are knots of the same thread (ART-0228). |
| **Liturgical fragments** | A scrap of the office it perverts is caught in the body: rubric, a psalm line, a wick, a bell. | A rubricated line of text crosses each body; Matins' wax, Prime's written names, Vespers' wicks. |
| **The eye** | Each Hour has exactly one eye, placed where its signature shape draws the gaze. | A single lit eye in the secondary colour: Matins' great lidded eye, Terce's eye in the crown band, None's at the head segment. |

## Colour

- **Curse-violet** (`#b060ff` family, bible §5) is shared: seams, threads, rim light and the flesh
  corruption. It is reserved for Malison and Choir content (ART-0012).
- **One secondary colour per Hour**, distinct in hue *and* value so the Hours read apart even in
  greyscale: Matins candle-wax ivory, Lauds dawn gold, Prime rubric vermilion, Terce furnace
  orange, Sext bleached noon white, None loam ochre, Vespers tallow gold, Compline night blue.
- Body values stay near-black ink: the secondary colour lives in rims, eyes and effects, never in
  the mass, so the silhouette carries the read.

## Silhouettes (distinctness)

| Hour | Signature shape | Silhouette read |
| --- | --- | --- |
| Matins | A hooded shroud with one great eye | Tall rounded hood over a scalloped bell |
| Lauds | Two antiphonal bodies joined by a light-thread | Two open rings side by side |
| Prime | A hunched scribe with a fan of quill fingers | Round body, small head, a spray of lines up-right |
| Terce | A crown of flame tongues | Spiked crown on a flat band |
| Sext | A slumped stone torpor under a halo and a gnomon | Low wide mound under a ring and a spike |
| None | An hourglass-segmented burrower | A long horizontal chain of pinched segments |
| Vespers | A tall lamp-lighter trailing wicks | A narrow upright with a raised pole and a lamp |
| Compline | A veiled sleeper laid out long | A long low recumbent veil |

The rule for any new Hour or variant: it must stay recognisable as a black shape at 64 px, and
must not share its outline class (tall / paired / fan / spiked / mound / chain / pole / recumbent)
with an existing Hour.
