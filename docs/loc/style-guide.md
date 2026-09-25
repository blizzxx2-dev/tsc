# Localisation style guide — archaic register (LOC-0038, LOC-0039, LOC-0040)

For translators and reviewers of *Suture & Steel: The Malison Hours*. Read with the termbase
(`docs/loc/termbase.csv`), the key conventions (`docs/loc/keys.md`), the period-medicine reference
([period-medicine.md](period-medicine.md)) and the XLIFF notes (context, speaker, pixel budget).
Status: **draft** — per-language register targets and sample lines become binding once each lead
translator approves them (handoff LOC-0038).

## 1. The English voice (summary of the NAR diction rules)
- **World:** a grim early-modern free city — plague, guilds, pike-and-shot, witch hunters, candlelight.
  Think 16th–17th-century Central Europe, not high fantasy and not modern hospital drama.
- **Register:** archaic *flavour*, modern *readability*. Period vocabulary ("sawbones", "pestilence",
  "writ", "muster", "humours"), no pseudo-Shakespearean grammar (no "thee/thou/doth"). Contractions are
  fine in speech (Ilse, Mauer); Stroh and the narrator rarely contract.
- **No modern medicine:** no "vital signs", "infection", "bacteria", "surgery room", "patient monitor",
  "OK". The HUD word "VITALS" is a game term; in dialogue say pulse, strength, humours.
- **Black humour** comes from institutions and folk belief (guild fees, turnip payments, pie vendors),
  never from the patient's suffering.
- **Voices:**
  | Speaker | Voice |
  |---|---|
  | Narrator | Dry, laconic, present tense; a sting of irony in the last clause |
  | Master Haller | Gruff mentor; short imperative sentences; trade jargon |
  | Sister Ilse | Calm, practical, precise instructions under pressure; pious but never preachy |
  | Captain Mauer | Blunt soldier; mild oaths ("damn you"); impatient |
  | Inquisitor Stroh | Courtly, soft, menacing; over-polite; lets silences do the work ("I counted.") |
  | The Choir / Malison | Liturgical fragments, hymn-like |
- **Callouts and barks** must be readable in ~2.5 s: keep them short; lead with the verb or the danger.

## 2. Proper-name policy (LOC-0039)
- **Latin-script languages:** character and place names stay **untranslated** (Kreuzer, Ilse, Stroh,
  Haller, Mauer, Kessendorf, Weissburg, Grauwald, Saint Ildra — "Saint" itself is translated: Sankt/sainte/
  santa/święta/santa). Descriptive institution names are translated with the termbase (Hollow Choir →
  *der Hohle Chor*…). The game title *Suture & Steel* is never translated.
- **RU / ZH / JA / KO:** approved transliterations recorded **once** in the termbase and reused on store
  pages (e.g. Kreuzer → Кройцер / 克罗伊策 / クロイツァー / 크로이처). Proposed forms are in the termbase;
  lead translators approve them.
- Rank letters XS/S/A/B/C are never translated or transliterated.

## 3. Sensitivity notes (LOC-0040; follows the NAR sensitivity brief)
- The church, saints and heresy are **fictional**. Do **not** substitute real saints, deities,
  scripture, liturgical formulas or real church institutions (no "Holy Office", no real Inquisition
  names, no Bible quotations). Canonical-hour names are used as-is from each language's liturgical
  vocabulary.
- **Pentagram:** the five-pointed star is a *prayer sign* in the fiction. Translate neutrally ("star",
  "five-pointed star") — never "pentagram", "devil's sign" or occult jargon.
- **Witch hunts:** keep terms neutral and period-appropriate ("witch hunter", "Inquisitor",
  "Tribunal"); the game depicts persecution critically — do not add slurs or sensational terms.
- No real ethnic groups, nations or religions as stand-ins for fictional peoples (beast-folk, dwarves).

## 4. Per-language register targets
| Language | Address between characters | UI / tutorial text | Notes |
|---|---|---|---|
| **German** | Period **Ihr-forms** ("Zeigt mir Eure Hände") for Stroh, Haller, Mauer and Ilse addressing the Doctor, and the Doctor addressing them; no modern *Sie* in dialogue | Neutral infinitive/imperative without address ("Faden wählen", "Klicken, um fortzufahren") | Compounds > 14 letters get soft hyphens (U+00AD, LOC-0058); ß/ẞ allowed |
| **French** | **Vouvoiement throughout** — including Ilse and Mauer | Infinitive or *vous* | Type plain spaces before ; : ! ? and inside « » — the renderer inserts U+202F/U+00A0 (LOC-0056) |
| **Spanish (Spain)** | Archaic **vos/vosotros** forms in dialogue (*Enseñadme vuestras manos*); Stroh may use *vuestra merced* ironically | Neutral infinitive (*Pulsar para continuar*) | Opening ¿ ¡ always; gendered agreement for patients via the `gender` select |
| **Polish** | *Pan/Panie Doktorze*; Stroh's courtly irony at the lead translator's discretion (e.g. *Waszmość*) | Neutral infinitive | Plural forms one/few/many/other for every counted string |
| **Brazilian Portuguese** | ***o senhor / a senhora*** for the Doctor; formal vocabulary for Stroh | Neutral infinitive | "Hospice" is **not** *hospício* (= asylum in PT-BR): use *casa de caridade* (termbase) |
RU, ZH-Hans, JA, KO and IT sections are added at Beta (LOC-0044).

## 5. Sample lines (15) — drafts for lead-translator approval
Drafts by the loc lead; each lead translator corrects and approves (or replaces) them. Polish drafts are
left to the Polish lead translator.

| # | Id / speaker | English | German (draft) | French (draft) | Spanish – Spain (draft) | Portuguese – Brazil (draft) | Polish |
|---|---|---|---|---|---|---|---|
| 1 | prologue.001 · Narrator | The Free City of Kessendorf. Winter, in the ninth year of the Long Muster. | Die Freie Stadt Kessendorf. Winter, im neunten Jahr der Langen Musterung. | La ville libre de Kessendorf. L'hiver, en la neuvième année de la Longue Levée. | La Ciudad Libre de Kessendorf. Invierno, en el noveno año de la Larga Leva. | A Cidade Livre de Kessendorf. Inverno, no nono ano da Longa Convocação. | |
| 2 | prologue.005 · Haller | Letters. Letters don't stop a man bleeding into the straw. Hands do. Show me your hands. | Briefe. Briefe halten keinen Mann davon ab, ins Stroh zu bluten. Hände schon. Zeigt mir Eure Hände. | Des lettres. Les lettres n'empêchent pas un homme de saigner sur la paille. Les mains, si. Montrez-moi vos mains. | Cartas. Las cartas no impiden que un hombre se desangre sobre la paja. Las manos, sí. Mostradme vuestras manos. | Cartas. Cartas não impedem um homem de sangrar na palha. Mãos, sim. Mostre-me as suas mãos. | |
| 3 | prologue.010 · Haller | And Kreuzer — in this hospice we do not lose patients to simple work. | Und, Kreuzer – in diesem Hospiz verlieren wir keine Patienten an einfacher Arbeit. | Et, Kreuzer — dans cet hospice, on ne perd pas de patients sur un travail simple. | Y, Kreuzer: en este hospicio no perdemos pacientes por un trabajo sencillo. | E, Kreuzer — nesta casa de caridade não perdemos pacientes em trabalho simples. | |
| 4 | s1-2.001 · Narrator | The drover lived. He paid in turnips and a promise not to gamble again. He will break it by Friday. | Der Viehtreiber überlebte. Er bezahlte mit Rüben und dem Versprechen, nie wieder zu spielen. Bis Freitag hat er es gebrochen. | Le bouvier a survécu. Il a payé en navets et en promettant de ne plus jouer. Il aura manqué à sa parole avant vendredi. | El boyero vivió. Pagó con nabos y con la promesa de no volver a jugar. La romperá antes del viernes. | O tropeiro sobreviveu. Pagou com nabos e a promessa de nunca mais jogar. Vai quebrá-la até sexta. | |
| 5 | s1-2.002 · Mauer | Make way! Make way, damn you! Surgeon! Where's the surgeon? | Platz da! Platz da, verdammt! Wundarzt! Wo ist der Wundarzt? | Place ! Place, bon sang ! Chirurgien ! Où est le chirurgien ? | ¡Abrid paso! ¡Abrid paso, maldita sea! ¡Cirujano! ¿Dónde está el cirujano? | Abram caminho! Abram caminho, diabos! Cirurgião! Cadê o cirurgião? | |
| 6 | s1-2.006 · Haller | Nick the flesh at the entry with the lancet — twice — to free the barbs. Then pull. Cleanly. | Ritzt das Fleisch am Einschuss mit der Lanzette – zweimal –, um die Widerhaken zu lösen. Dann zieht. Sauber. | Entaillez la chair à l'entrée avec la lancette — deux fois — pour libérer les barbelures. Puis tirez. Proprement. | Haced dos cortes en la carne de la entrada con la lanceta para soltar las lengüetas. Luego tirad. Limpiamente. | Corte a carne na entrada com a lanceta — duas vezes — para soltar as farpas. Depois puxe. Sem rasgar. | |
| 7 | op1-2.p0.1 · Ilse | The arrow's barbed. Lancet first — two nicks at the entry wound. Then seize it with the tongs and pull it well clear. | Der Pfeil hat Widerhaken. Erst die Lanzette – zwei Schnitte an der Eintrittswunde. Dann mit der Zange fassen und ganz herausziehen. | La flèche est barbelée. La lancette d'abord : deux entailles à la plaie d'entrée. Puis saisissez-la avec les pinces et tirez-la bien dehors. | La flecha tiene lengüetas. Primero la lanceta: dos cortes en la herida de entrada. Luego asidla con las tenazas y sacadla del todo. | A flecha é farpada. Primeiro a lanceta — dois cortes na entrada. Depois segure com a tenaz e puxe bem para fora. | |
| 8 | s1-4.005 · Stroh | A plague case. In the city. How very interesting. | Ein Pestfall. In der Stadt. Wie überaus interessant. | Un cas de peste. En ville. Comme c'est intéressant. | Un caso de peste. En la ciudad. Qué sumamente interesante. | Um caso de peste. Na cidade. Que interessante. | |
| 9 | s1-4.007 · Stroh | Please, do carry on, Doctor. I only wish to watch. Pestilence so often has a sponsor. | Bitte, fahrt nur fort, Doktor. Ich wünsche lediglich zuzusehen. Die Pestilenz hat so oft einen Gönner. | Je vous en prie, continuez, docteur. Je souhaite seulement regarder. La pestilence a si souvent un parrain. | Os lo ruego, proseguid, doctor. Solo deseo mirar. La pestilencia tiene tan a menudo un padrino. | Por favor, prossiga, doutor. Desejo apenas observar. A pestilência tantas vezes tem um patrono. | |
| 10 | s1-5.007 · Haller | Trace the five-pointed star and still your heart. For a few breaths, the world will wait for you. | Zieht den fünfzackigen Stern und bringt Euer Herz zur Ruhe. Ein paar Atemzüge lang wird die Welt auf Euch warten. | Tracez l'étoile à cinq branches et apaisez votre cœur. Le temps de quelques souffles, le monde vous attendra. | Trazad la estrella de cinco puntas y aquietad vuestro corazón. Durante unos alientos, el mundo os esperará. | Trace a estrela de cinco pontas e aquiete o coração. Por alguns fôlegos, o mundo vai esperar pelo senhor. | |
| 11 | s1-5.008 · Haller | Do not do it where the Inquisitor can see. The Tribunal does not distinguish between a prayer and a spell. | Tut es nicht, wo der Inquisitor es sehen kann. Das Tribunal unterscheidet nicht zwischen Gebet und Zauber. | Ne le faites pas sous les yeux de l'Inquisiteur. Le Tribunal ne fait aucune différence entre une prière et un sortilège. | No lo hagáis donde el Inquisidor pueda veros. El Tribunal no distingue entre una plegaria y un conjuro. | Não faça isso onde o Inquisidor possa ver. O Tribunal não distingue uma prece de um feitiço. | |
| 12 | s1-end.007 · Stroh | Tell me — at the end, your hands moved so very quickly. Almost as if time itself were… obliging you. | Sagt mir – am Ende bewegten sich Eure Hände so überaus schnell. Fast, als wäre die Zeit selbst Euch … zu Diensten. | Dites-moi — à la fin, vos mains allaient si vite. Presque comme si le temps lui-même… se pliait à votre volonté. | Decidme: al final, vuestras manos se movían con tanta presteza. Casi como si el propio tiempo os… complaciera. | Diga-me — no fim, suas mãos se moviam tão depressa. Quase como se o próprio tempo estivesse… a seu serviço. | |
| 13 | s2-end.006 · Stroh | I counted. | Ich habe gezählt. | J'ai compté. | Los conté. | Eu contei. | |
| 14 | bark.flooded · Ilse | Too much blood — draw it off with the leech-pipe before you stitch! | Zu viel Blut – saugt es mit dem Egelrohr ab, bevor Ihr näht! | Trop de sang — aspirez-le avec la pipe à sangsue avant de recoudre ! | ¡Demasiada sangre! Retiradla con el caño de sanguijuela antes de coser. | Sangue demais — drene com o tubo-sanguessuga antes de costurar! | |
| 15 | bark.low-vitals · Ilse | Vitals are failing! Use the tincture, Doctor! | Seine Kräfte schwinden! Die Tinktur, Doktor! | Ses forces l'abandonnent ! La teinture, docteur ! | ¡Se nos va! ¡La tintura, doctor! | Ele está se esvaindo! A tintura, doutor! | |
