# DESIGN SYSTEM: Backboard OS for Municipal Outreach

## 1. Aesthetic Direction: "Humane Utility & Dignified Minimalism"

**The Context**: Our core user is a municipal social worker operating out of their car, constantly context-switching between high-stress, real-world crises. 
**The Vibe**: We must completely reject the standard "SaaS/AI" aesthetics (no purple gradients, no glassmorphism, no generic rounded 'bubbly' interfaces, no Inter font). The visual language must blend **industrial utilitarianism** with **editorial elegance**. 

The app must feel like a deeply reliable, subpoena-safe archival tool, while simultaneously affording immense dignity to the clients it tracks. It should feel calming, authoritative, and tactile.

---

## 2. Typography

We use a high-contrast typographical pairing to separate the *human* element from the *data* element.

*   **Primary Display (Client Names, Client Profiles, Main Titles): `Instrument Serif` or `Newsreader` (or similar high-quality serif)**
    *   *Rationale*: A beautiful, classic serif adds editorial dignity and humanity to the clients' profiles, instantly breaking away from a sterile dashboard feel. It grounds the UI in a printed, established reality.
    *   *Usage*: Only for `h1` client names, major page headers, and highly empathetic narrative summaries.
*   **Primary UI & Body (Case Notes, Summaries, Buttons): `Geist Sans` or `Satoshi`**
    *   *Rationale*: Geometrical, highly legible, but with distinct character. It handles dense data perfectly without feeling like generic system fonts. Perfect for the "actionable overview" paragraphs.
    *   *Usage*: All standard paragraphs, UI element labels, buttons, and Backboard thread text.
*   **Monospace & Metadata: `Geist Mono` or `JetBrains Mono`**
    *   *Rationale*: For precise, immutable data like timestamps, Auth0 IDs, and system auto-tags. It reinforces the "factual/subpoena-safe" nature of the ingested data.
    *   *Usage*: Timestamps on the timeline, tag labels (`[HOUSING]`, `[SUBSTANCE_USE]`), and system logs.

---

## 3. Color Palette

**"Calm, Grounded, and Distinctive"** - A palette designed to reduce eye strain in a car while maintaining sharp contrast.

*   **Backgrounds & Surfaces**:
    *   `bg-base`: `#F9F8F6` (Alabaster / Warm off-white). Reduces glare in high-light environments (cars) compared to stark white.
    *   `bg-surface`: `#FFFFFF` (Pure white). Used exclusively for the prominent memory cards and case notes.
    *   `bg-surface-elevated`: `#F2EFEA` (Bone). For secondary side-panels or navigation.
*   **Text & Borders**:
    *   `text-primary`: `#1C1B1A` (Deep soft charcoal). Never use pure `#000000` to avoid harsh contrast fatigue.
    *   `text-secondary`: `#5E5C5A` (Warm, legible grey) for metadata and timestamps.
    *   `border-subtle`: `#E6E4DF` (Soft divider line).
*   **Semantic / Crisis Colors**:
    *   *We avoid bright neon "alert" fatigue. Colors must be muted but distinct.*
    *   `status-high-bg`: `#FCE8E6` | `status-high-text`: `#A52A20` (Dusty Red)
    *   `status-med-bg`: `#FEF2E4`  | `status-med-text`: `#B05D0D` (Burnt Orange)
    *   `status-low-bg`: `#EBF2ED`  | `status-low-text`: `#2B653F` (Sage Green)
*   **Accent (Interactive & AI)**:
    *   `accent-primary`: `#2A4B7C` (A trustworthy, muted dark stellar blue). Used for primary actions like "Record Visit" or "Generate Audio Recap".
    *   `accent-ai`: `#4A5E4F` (Deep forest green). Used when Backboard / Gemini is synthesizing information, moving away from the typical "AI sparkle" blue/purple to something grounded and natural.

---

## 4. Textures, Geometry & Depth

*   **Background Texture**: Apply a barely perceptible SVG noise/grain overlay (opacity `0.02 - 0.04`) across the main background. This gives the application a tactile, physical paper-like feel, increasing trust and reducing the "digital fatigue".
*   **Geometry & Borders**:
    *   *No generic bubbly corners.* Use slightly sharper corners. 
    *   `border-radius`: Use `rounded-sm` (4px) or `rounded-md` (6px) for cards, and `rounded-none` for full-bleed timeline dividers. This creates a serious, structured, "archival" feel. It is a tool for professionals, not a consumer social network.
    *   Use sharp `1px` borders on inputs and cards to define clear boundaries.
*   **Shadows (Depth System)**:
    *   Minimalism relies on controlled depth. Do not over-shadow.
    *   `shadow-sm`: `0 1px 2px rgba(28, 27, 26, 0.04)` (for buttons and small interactive items).
    *   `shadow-float`: `0 12px 32px -4px rgba(28, 27, 26, 0.08)` (for the PWA bottom navigation bar or floating action buttons).

---

## 5. Spacing & Mobile-First "Car Dashboard" Rules

Because Sarah (the core persona) works on a phone in her car:
*   **Generous Touch Targets**: Minimum interactive area of `48x48px` absolute minimum. Buttons must be easily tappable while distracted.
*   **Rhythm**: Vertical rhythm must be extremely strict (`gap-4`, `gap-6`, `pb-8`) to make the chronological timeline (Backboard threads) easy to scan while scrolling with a thumb.
*   **Navigation**: Bottom-tab navigation is mandatory for the PWA to ensure single-handed thumb reachability.
*   **Visual Hierarchy**: The "Actionable Summary" must be the highest contrast element on the case page, accessible without any scrolling.

---

## 6. Motion & Micro-interactions

Motion should be utilized functionally, not purely decoratively. It should signify system state and guide the user's eye.

*   **Audio Recaps (ElevenLabs)**: When the audio summary is playing, use a very subtle, fluid CSS-only waveform animation or a soft pulsing glow in `accent-primary`. No jarring pop-ups; it should feel like an integrated ambient feature.
*   **Transitions**: Use an "ease-out-expo" (`cubic-bezier(0.16, 1, 0.3, 1)`) for sheet slides, route changes, and modal reveals. They should feel incredibly snappy but smooth, never sluggish. Duration should be crisp (`duration-300` or `duration-400`).
*   **AI Ingestion State**: When a voice memo is being transcribed and ingested by Backboard, replace the typical loading spinner with a skeleton text block that gently shimmers, transitioning smoothly into the final structured case note. 

---

## 7. Development Guidelines (CSS/Tailwind)

*   **CSS Variables**: All colors and core spacing must be defined in `globals.css` as CSS variables mapped to Tailwind config, ensuring a single source of truth.
*   **Tailwind Typography Plate**: We will heavily utilize `@tailwindcss/typography` (`prose`) for the dense markdown content generated by the AI, overriding default styles with our custom color variables and font choices.
*   **Accessibility**: All text/background combinations must pass WCAG AAA contrast ratios. There is zero tolerance for low-contrast grey-on-grey text in a municipal application.

***

*Note for Future Agents: ALWAYS reference this document before implementing any new UI component, page layout, or interactive feature. Do not default back to generic Tailwind presets.*
