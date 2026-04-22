---
name: Kinship UI
colors:
  surface: '#f7f9ff'
  surface-dim: '#d8dadf'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ee'
  surface-container-highest: '#e0e2e8'
  on-surface: '#181c20'
  on-surface-variant: '#404750'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eff1f6'
  outline: '#707881'
  outline-variant: '#c0c7d1'
  surface-tint: '#00639a'
  primary: '#00639a'
  on-primary: '#ffffff'
  primary-container: '#5da9e9'
  on-primary-container: '#003c61'
  inverse-primary: '#96ccff'
  secondary: '#9e4042'
  on-secondary: '#ffffff'
  secondary-container: '#fd898a'
  on-secondary-container: '#752126'
  tertiary: '#41664c'
  on-tertiary: '#ffffff'
  tertiary-container: '#84ac8e'
  on-tertiary-container: '#1c4029'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cee5ff'
  primary-fixed-dim: '#96ccff'
  on-primary-fixed: '#001d32'
  on-primary-fixed-variant: '#004a76'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b1'
  on-secondary-fixed: '#410008'
  on-secondary-fixed-variant: '#7f282c'
  tertiary-fixed: '#c3edcb'
  tertiary-fixed-dim: '#a7d0b0'
  on-tertiary-fixed: '#00210e'
  on-tertiary-fixed-variant: '#2a4e36'
  background: '#f7f9ff'
  on-background: '#181c20'
  surface-variant: '#e0e2e8'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  unit-1: 4px
  unit-2: 8px
  unit-4: 16px
  unit-6: 24px
  unit-8: 32px
  margin-mobile: 20px
  gutter: 16px
  touch-target-min: 48px
---

## Brand & Style

The design system is centered on the concept of "Digital Warmth." It aims to reduce the cognitive load of household management by evoking feelings of safety, organization, and familial connection. The target audience includes busy parents, co-parents, and children, requiring an interface that feels like a supportive assistant rather than a rigid tool.

The style is **Modern Minimalist with Tactile Softness**. It avoids the clinical coldness of traditional productivity apps by using generous whitespace, organic shapes, and a palette inspired by nature. The mobile-first approach ensures that functionality is never sacrificed for form, prioritizing large touch targets and thumb-friendly navigation to accommodate "on-the-go" usage.

## Colors

The palette is designed for high-speed recognition through color-coding. The primary colors act as "Family Member Tags," allowing users to identify whose schedule or task they are viewing at a glance.

- **Sky Blue (#5DA9E9):** Trustworthy and calm; used for primary actions and "Member A."
- **Coral Pink (#FF8B8B):** Energetic and warm; used for alerts and "Member B."
- **Sage Green (#8DB596):** Natural and soothing; used for success states and "Member C."
- **Golden Yellow (#F4D35E):** Cheerful and bright; used for highlights and "Member D."
- **Neutral Surface (#F9F9F7):** An off-white "linen" base that reduces eye strain compared to pure white.
- **Deep Charcoal (#2D3132):** High-contrast text for maximum legibility without the harshness of pure black.

## Typography

This design system utilizes **Plus Jakarta Sans** for headlines to provide a soft, modern geometric feel that remains friendly. **Public Sans** is used for all body and UI text due to its exceptional readability and neutral, institutional clarity.

Hierarchy is established through weight rather than dramatic size shifts to maintain a clean, compact mobile layout. Use sentence case for all headers to maintain a conversational tone.

## Layout & Spacing

This design system employs a **Fluid Grid** model optimized for narrow viewports. The layout relies on a 4-pixel base unit to ensure consistent vertical rhythm. 

- **Margins:** 20px side margins provide a generous "frame" for content on mobile devices.
- **Touch Targets:** All interactive elements (buttons, toggles, profile switchers) must maintain a minimum height of 48px to ensure accessibility for all family members.
- **Stacking:** Vertical spacing between cards should default to 16px to maintain a sense of distinct, manageable tasks.

## Elevation & Depth

To create a tactile, approachable interface, this design system uses **Ambient Shadows** and tonal layering. 

- **Surface Level (0dp):** The neutral off-white background.
- **Card Level (1dp):** All primary content containers. Use a very soft, diffused shadow: `box-shadow: 0 4px 12px rgba(45, 49, 50, 0.05)`.
- **Active/Floating Level (2dp):** Floating Action Buttons (FABs) or active modals. Increase shadow spread and slightly increase opacity: `box-shadow: 0 8px 24px rgba(45, 49, 50, 0.1)`.

Avoid harsh borders. Depth should be felt through the subtle play of light rather than heavy lines.

## Shapes

The shape language is defined by **large, friendly radii**. Sharp corners are non-existent in this design system, as they evoke tension.

- **Cards & Modals:** 20px corner radius (Rounded-XL).
- **Buttons & Inputs:** 12px corner radius (Rounded-LG).
- **Chips & Tags:** Fully pill-shaped (rounded-full) to contrast against the structured cards.
- **Profile Icons:** Always circular to reinforce the "individual" identity within the family unit.

## Components

- **Cards:** The primary organizational unit. Cards should have a white background, 20px corners, and a 1px soft gray border (#F0F0F0) to define edges against the off-white background.
- **Buttons:** High-affordance with 12px corners. Primary buttons use Sky Blue with white text. Secondary buttons use a ghost style with a 2px Sky Blue border.
- **Profile Chips:** Small pill-shaped badges used within cards. They should use the member's specific profile color as a background with 10% opacity and a darker version of that color for the text.
- **Inputs:** Fields should be 56px tall with a light gray fill (#F2F2F0) and 12px corners. The label should float or sit clearly above the input in `label-sm`.
- **Navigation:** A persistent bottom navigation bar with large, Material-inspired rounded icons. Use the active member's color to highlight the selected state.
- **Checkboxes:** Larger than standard (24x24px) with rounded corners (6px) to make "checking off" chores feel satisfying and easy for children.