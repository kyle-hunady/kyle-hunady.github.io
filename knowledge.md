# Kyle Hunady — Knowledge Document
*Source-of-truth for writing on-site copy. Use this to fill placeholders.*

---

## Voice & Tone

**In his own words (verbatim):**
- "playing with fancier equipment"
- "the metallic soup"
- "longitudinal data is always fascinating" — said earnestly about latte art
- "Kyle cafe is open every day of the week"
- "raw honesty would be refreshing"
- "doing what I can to make fellow idea-generators succeed"
- "a deeper curiosity bore from this"

**What this tells you:**
- Direct. Specific. Doesn't reach for cleverness.
- Scientist brain and hobbyist brain are not separate. He'll use "longitudinal data" about latte art without irony.
- Pragmatic framing: cost, scalability, simplicity matter. Not just "is it cool?"
- Light humor that lands because it's incidental, not performed.
- Values honesty and raw process over polished output. Doesn't hide failures.
- Facilitator instinct — frames his work in terms of enabling others, not personal credit.
- Comfortable being genuinely enthusiastic ("love using fancy equipment", "Love to teach peers").

**What to avoid:**
- Snarky meta-commentary on himself
- Overselling or inflating stakes
- Separating the tinkerer from the academic — they're the same person
- Vague "passion for science" language
- Fortune-cookie closers

---

## Background / About Page

**Education:**
- B.S. Materials Science and Engineering, Georgia Tech
- PhD Candidate, Materials Science, California Institute of Technology — expected 2027
- Advisor: [to fill in]

**How it started:**
Kyle has always been into how things work — taking apart appliances, tinkering with Arduinos, methodically testing baking recipes. Materials science felt right because it sits inside every form of engineering. As a freshman at Georgia Tech, he responded to a chance email from a graduate student (Ah-Young Song) seeking undergraduate research help. That landed him in Li-ion battery work.

The deeper draw: understanding atomic-level interactions, statistical mechanics, spectroscopy. That curiosity pulled him away from electrochemistry and toward structural materials — and toward a PhD. With the space economy accelerating, high-performance, high-temperature structural materials felt more timely than ever.

**One-paragraph bio (ready to drop in):**

> I grew up taking things apart — appliances, recipes, whatever was available. Materials science was the right fit because it's embedded in everything. I started research as a freshman at Georgia Tech, studying Li-ion batteries after responding to a cold email from a grad student looking for help. By the time I finished undergrad, I'd moved from electrochemistry toward a deeper curiosity: how do atoms actually organize themselves, and what happens at the boundary of order and disorder? That question brought me to Caltech, where I'm now a fourth-year PhD candidate working on two projects that share a lot of underlying physics and almost nothing else on the surface.

---

## Research Page

### Project 01 — Entropy of High-Entropy Alloys

**The premise the field assumes:**
High-entropy alloys (HEAs) are multi-principal-element alloys — typically five or more elements in roughly equal proportions. The field's working assumption: adding more elements increases configurational entropy, which by Gibbs free energy should stabilize the alloy, especially at high temperatures (hence interest for engine components).

**What Kyle actually studied:**
That assumption is widely accepted but rarely measured. Kyle's work investigates whether entropy is actually doing the work people claim. His group measured the *absolute* entropy of these alloys via heat capacity measurements from 2K to 400K — in Al-doped CoCrFe(Mn)Ni and NbTa₀.₅TiZr systems.

**The finding:**
Al addition actually *decreases* entropy — the opposite of what the field assumes. Manuscript currently under review.

**Copy (ready to drop in, replacing placeholder):**

> High-entropy alloys (HEAs) are built on a premise: mix enough elements in roughly equal proportions and the configurational entropy stabilizes the alloy — a thermodynamic argument that has driven the field for decades. What the field rarely does is measure it.
>
> My work tests that assumption directly. Using heat capacity measurements from 2K to 400K, we measured the absolute entropy of Al-doped CoCrFe(Mn)Ni and NbTa₀.₅TiZr systems. The result: Al addition decreases entropy. That finding runs counter to the common assumption in the literature. Manuscript under review.

---

### Project 02 — Mössbauer Spectrometer Miniaturization

**The problem:**
Mössbauer spectroscopy identifies iron-bearing minerals with high specificity — uniquely valuable for Mars geology and habitability questions. But existing instruments are too large and power-hungry for next-generation landers and rovers with tight mass and power budgets.

**Kyle's work:**
Miniaturizing the spectrometer hardware without losing the sensitivity needed to do real science on the Martian (or lunar) surface.

**Connected project — Monte Carlo ray-tracing simulator:**
To guide instrument design, Kyle built a Monte Carlo photon ray-tracer that models different source/sample/detector geometries. The tradeoff: more photon counts often comes at the cost of spectral distortion. The simulator characterizes this distortion via a smearing kernel, which can then be used to correct fits to real experimental data. Outputs include interactive Plotly visualizations of photon path distributions for different geometric arrangements.

*(This simulator is a featured project — see Projects section below.)*

---

## Projects Page

### Monte Carlo Mössbauer Ray-Tracer
`Python · Plotly · Instrumentation`

Designing a miniaturized Mössbauer spectrometer for Mars means making hard tradeoffs between photon count rate and spectral fidelity — getting more signal often means accepting geometric distortion. I built a Monte Carlo photon ray-tracer to model these tradeoffs across different source, sample, and detector arrangements. The simulator characterizes spectral distortion through a smearing kernel, which can be applied to correct fits on real hardware. Output includes interactive 3D Plotly visualizations of photon trajectories — useful for intuition as much as optimization.

*Relevant to ongoing Mössbauer miniaturization work for Mars and lunar missions.*

---

### Entropy of High-Entropy Alloys (research software + visualizations)
`Python · VASP · Data analysis`

Supporting software and visualizations for the HEA entropy manuscript. Includes heat capacity data pipelines, entropy calculations, and interactive figures. Also features POSCAR-based 3D visualizations of disordered alloy crystal structures — rotatable configurations generated from VASP that make the structural disorder tangible.

*Manuscript under review at [journal].*

---

### ESP32 Subway Tracker
`C++ · ESP32 · Hardware`

Subway arrival displays — the kind people mount on walls — usually run on a Raspberry Pi (~$40) parsing transit protocol data. I got it working on an ESP32 ($5) with a 2" OLED display ($5). The result is a $10 desktop widget that does the same job. Code on GitHub.

[github.com/kyle-hunady → subway tracker]

---

### Coffee Cropper *(fun mention)*
`Python · OpenCV`

This site's latte art photos don't crop themselves. Coffee Cropper uses bilateral filtering and Hough circle detection to find the coffee surface in a photo, crop it, and export it — automatically, for all 116+ images. The hardest part was distinguishing the cup rim from the plate beneath it. See `coffee-cropper/` in the site repo.

---

## About Page — Leadership & Service

### At Georgia Tech

**Molecular Gastronomists** (President/organizer)
Ran a culinary science club. Organized cooking and baking events in communal kitchens, and gave short lectures on the science behind what we were making — tempered chocolate, protein denaturation, that kind of thing. Good excuse to make food and explain why it works.

**HIVE & MILL** (Volunteer)
Volunteered at the HIVE (electrical engineering makerspace) and the MILL (Materials Innovation Learning Lab, the MSE equivalent). Got to learn from other people's projects and help where I could. Two of the best places on campus.

---

### At Caltech

**Strategic Communications Chair, Graduate Student Council**
Manages the mailing list for all Caltech graduate students. Coordinates how student organizations and the university advertise events to the graduate community. The appeal: a role in professional representation — knowing how to speak on behalf of an organization clearly and appropriately. Also genuinely enjoys helping people get their ideas in front of an audience.

**President, EAS Graduate Student Advisory Board** (Division of Engineering and Applied Sciences)
Liaison between graduate students and division administration. Scope covers community events, awards to encourage good mentorship, and climate survey feedback used to improve the graduate student experience. Leads a team of 10. Delegates tasks across a broad portfolio of responsibilities.

*The thread:* Kyle gravitates toward infrastructure roles — the ones where his output is other people's success. Makerspaces, mailing lists, advisory boards. Not the spotlight; the scaffolding.

---

## Latte Log Page

**Why document every attempt:**
He loves the ceremony — "Kyle cafe is open every day" describes the daily ritual. He discovered how genuinely difficult latte art is, and in a world of curated, cleaned-up content, decided that an honest record of a skill in progress might be worth sharing. The longitudinal data is also just interesting to him.

**Copy (short version, for the page header):**

> I started making latte art a while ago. I document every attempt — the good ones, the bad ones, the ones that look like something I can't identify. The data set keeps growing.

**Expanded version (if more space is needed):**

> Kyle cafe is open every day. I love the ceremony of it. I also discovered early on that latte art is genuinely, surprisingly difficult — and that documenting every attempt honestly felt more interesting than only sharing the ones that worked. There's something to a longitudinal record. The progression is visible. The failures are visible too.

---

## Publications & Presentations

- *Manuscript on HEA entropy of Al-doped systems* — under review, 2026
- Talk, TMS Annual Meeting, 2026 — entropy of high-entropy alloys
- Talk, TMS Annual Meeting, 2025 — entropy of high-entropy alloys

*(Add journal name and co-authors when manuscript is accepted.)*

---

## Quick Facts (for SEO, meta, structured data)

- Full name: Kyle Hunady
- Institution: California Institute of Technology (Caltech)
- Department: Materials Science
- Year: Fourth-year PhD candidate, expected 2027
- Undergrad: Georgia Tech, B.S. Materials Science and Engineering
- Email: khunady@caltech.edu
- GitHub: kyle-hunady
- Site: kyle-hunady.github.io
- Research keywords: high-entropy alloys, materials thermodynamics, Mössbauer spectroscopy, Mars mineralogy, instrumentation, configurational entropy
