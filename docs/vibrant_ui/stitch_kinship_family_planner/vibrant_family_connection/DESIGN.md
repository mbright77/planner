---
name: Vibrant Family Connection
colors:
  surface: '#f4fafd'
  surface-dim: '#d4dbdd'
  surface-bright: '#f4fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f7'
  surface-container: '#e8eff1'
  surface-container-high: '#e2e9ec'
  surface-container-highest: '#dde4e6'
  on-surface: '#161d1f'
  on-surface-variant: '#5a413f'
  inverse-surface: '#2b3234'
  inverse-on-surface: '#ebf2f4'
  outline: '#8d706e'
  outline-variant: '#e2bebc'
  surface-tint: '#b3272c'
  primary: '#b3272c'
  on-primary: '#ffffff'
  primary-container: '#ff5f5d'
  on-primary-container: '#64000b'
  inverse-primary: '#ffb3ae'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fdd022'
  on-secondary-container: '#6f5900'
  tertiary: '#006a65'
  on-tertiary: '#ffffff'
  tertiary-container: '#0da79f'
  on-tertiary-container: '#003531'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad7'
  primary-fixed-dim: '#ffb3ae'
  on-primary-fixed: '#410005'
  on-primary-fixed-variant: '#910818'
  secondary-fixed: '#ffe084'
  secondary-fixed-dim: '#eec208'
  on-secondary-fixed: '#231b00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#7cf6ec'
  tertiary-fixed-dim: '#5dd9d0'
  on-tertiary-fixed: '#00201e'
  on-tertiary-fixed-variant: '#00504c'
  background: '#f4fafd'
  on-background: '#161d1f'
  surface-variant: '#dde4e6'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  stack-gap: 16px
  section-padding: 32px
---

## Brand & Style
The brand personality is exuberant, warm, and hyper-energetic, designed to appeal to both parents and children. It evokes a sense of "digital play" while maintaining the reliability required for family organization. 

The design style is a hybrid of **High-Contrast / Bold** and **Tactile** movements. It utilizes heavy saturated colors, oversized interactive elements, and subtle "squishy" animations to create a responsive, living interface. The goal is to move away from the "quiet" utility of standard productivity apps toward a "loud" and joyful shared space.

## Colors
The palette is built on a foundation of "Electric Coral" and "Sunshine Yellow" to drive immediate engagement. A diverse set of secondary accents (Turquoise, Purple, and Pink) is provided specifically for high-contrast profile identification, ensuring each family member has a distinct visual "home."

Gradients should be used to add "depth of energy" to primary actions, typically moving from the primary coral to a warmer orange or pink. Use pure white backgrounds to allow these saturated colors to breathe without feeling overwhelming.

## Typography
This design system utilizes **Plus Jakarta Sans** for its modern, geometric, yet friendly terminal endings that mimic the "live" feel of rounded fonts like Outfit. 

Headlines should always be set in extra-bold weights with tight letter spacing to create a rhythmic "pop." Body text remains medium-weight to ensure legibility against vibrant backgrounds. Use the "Label-Bold" style for micro-copy and tags to maintain the energetic personality even at small scales.

## Layout & Spacing
The layout follows a **Fluid Grid** model with generous margins to prevent the high-energy colors from feeling cluttered. A strict 8px rhythmic scale is used for all padding and margins. 

To maintain the "clean but energetic" requirement, use asymmetrical white space—larger top paddings for headers and compact gaps between related interactive cards. Elements should feel grouped into "activity blocks" rather than a continuous stream of data.

## Elevation & Depth
Depth is achieved through **Tonal Layers** and **Ambient Shadows**. Avoid harsh black shadows; instead, use soft, diffused shadows tinted with the primary coral or secondary yellow to make elements feel like they are floating on a cushion of light.

Interactive elements should use a "Pressed" state that removes the shadow and shifts the element slightly downward (2px) to simulate a physical button being pushed. Use semi-transparent white overlays (10-20% opacity) on top of colorful gradients to create subtle "glassy" highlights.

## Shapes
The shape language is defined by extreme roundedness (16px to 24px) to remove all "sharp edges" from the user experience, making it feel safe and inviting for all ages. 

Large containers and cards should use the `rounded-xl` (24px) setting, while internal elements like buttons and input fields use `rounded-lg` (16px). Profile avatars must always be perfect circles with a high-contrast 4px colored border.

## Components
- **Buttons:** Primary buttons use a linear gradient (Coral to Orange) with a subtle bottom-weighted shadow. Text is white and bold.
- **Cards:** White backgrounds with a subtle 1px border in a lighter tint of the primary color. Cards should "pop" on hover by increasing shadow spread.
- **Chips/Tags:** Use high-saturation background colors with white text for "Profile Tags" and light-tint backgrounds with dark text for "Category Tags."
- **Input Fields:** Thick 2px borders that turn Sunshine Yellow when focused. Use rounded-lg corners and large internal padding (16px).
- **Lists:** Use "Floating List Items" where each row is its own rounded card rather than a simple line-divided list.
- **Family Progress Bar:** A custom component using a thick, rounded track with a vibrant gradient fill to track shared goals or chores.
- **Playful Accents:** Incorporate small organic "blob" shapes in the background of sections to break the linear grid and add visual movement.