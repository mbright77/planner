---
name: Kinship UI
colors:
  background: '#f4fafd'
  surface: '#ffffff'
  surface-subtle: '#e8eff1'
  text: '#161d1f'
  text-muted: '#8d706e'
  border: '#ffd4d2'
  primary: '#b3272c'
  primary-strong: '#b3272c'
  primary-container: '#ff5f5d'
  secondary: '#735c00'
  secondary-container: '#fdd022'
  tertiary: '#006a65'
  tertiary-container: '#0da79f'
  on-surface-variant: '#5a413f'
  outline: '#8d706e'
  shadow: '0 4px 12px rgba(255, 95, 93, 0.08)'
  shadow-floating: '0 8px 24px rgba(255, 95, 93, 0.25)'
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

- **Crimson Red (#B3272C / #FF5F5D):** Primary action color; used for buttons, active states, and interactive highlights.
- **Warm Gold (#FDD022):** Secondary accent; used for secondary actions and highlights.
- **Teal (#006A65 / #0DA79F):** Tertiary accent; used for complementary UI elements.
- **Light Blue Surface (#F4FAFD):** Airy background that keeps the layout calm without pure white flatness.
- **Deep Charcoal (#161D1F):** High-contrast text for maximum legibility without the harshness of pure black.
- **Muted Mauve (#8D706E):** Secondary text and inactive labels; warm neutral to complement the red primary.

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
- **Buttons:** High-affordance with 12px corners. Primary buttons use Crimson Red with white text. Secondary buttons use a ghost style with a 2px Crimson Red border.
- **Profile Chips:** Small pill-shaped badges used within cards. They should use the member's specific profile color as a background with 10% opacity and a darker version of that color for the text.
- **Inputs:** Fields should be 56px tall with a light gray fill (#F2F2F0) and 12px corners. The label should float or sit clearly above the input in `label-sm`.
- **Navigation:** A persistent bottom navigation bar with large, Material-inspired rounded icons. Use the active member's color to highlight the selected state.
- **Checkboxes:** Larger than standard (24x24px) with rounded corners (6px) to make "checking off" chores feel satisfying and easy for children.