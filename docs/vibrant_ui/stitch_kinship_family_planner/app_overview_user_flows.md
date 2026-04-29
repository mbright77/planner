# Family Planner PWA: High-Level Overview & User Flows

## Core Concept
The Family Planner is a collaborative, mobile-first PWA designed to streamline household management through high-visibility color-coding. By assigning a unique color and avatar to each family member, the app transforms a complex shared schedule into an intuitive, glanceable dashboard.

---

## Key Features

### 1. Centralized Dashboard (Home)
The nerve center of the app. It provides an immediate "Team" overview of the current day's timeline, a mini-calendar for the week, and the dinner plan.

### 2. Color-Coded Collaboration (Calendar & Meals)
*   **Calendar:** A weekly view where events are color-blocked based on the assigned family member.
*   **Meals:** A weekly planner where dinner assignments and requests are visually linked to profiles, making it clear who's responsible or who made a suggestion.

### 3. Shared Shopping List
A real-time checklist categorized by aisle (Produce, Dairy, etc.). Each item identifies who added it via their profile color and avatar, ensuring accountability and clarity.

### 4. Profile Management
The foundation of the app's visual logic. Here, users create family profiles, assign distinct colors, and manage individual details.

---

## Primary User Flows

### Flow A: Daily Check-In
1.  **Launch:** User opens the app to the **Home Dashboard**.
2.  **Review:** Scans the **Today's Plan** timeline to see immediate commitments.
3.  **Meal Sync:** Checks **Dinner Tonight** to see the planned meal and who is "owning" it.
4.  **Quick Add:** Uses the **Floating Action Button (FAB)** to add a last-minute reminder or shopping item.

### Flow B: Weekly Planning
1.  **Navigate:** User switches to the **Calendar** or **Meals** tab.
2.  **Review Gaps:** Identifies days without events or meals.
3.  **Add/Edit:** Taps a day or the FAB to open a creation modal.
4.  **Assign:** Selects one or more family profiles to link to the new entry.
5.  **Confirm:** The entry appears instantly with the correct color coding across all relevant screens.

### Flow C: Grocery Run
1.  **Navigate:** User opens the **Shopping List**.
2.  **Add Items:** Quickly types new items into the "Add item" field.
3.  **Shop:** In-store, the user checks off items as they are found.
4.  **Complete:** Checked items dim or move, providing a clear view of remaining needs.

---

## Design Principles
*   **Warm & Modern:** Uses the *Kinship UI* system with soft blues (`#5DA9E9`), rounded corners (12-20px), and "Plus Jakarta Sans" typography.
*   **Accessibility:** High-contrast text and dual-signaling (color + icons/avatars) ensure the app is usable for everyone in the family.
*   **Mobile-First:** Large touch targets and bottom-tab navigation optimized for one-handed use.